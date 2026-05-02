import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import lockfile from "proper-lockfile";

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_DIR = path.join(process.cwd(), "content");

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

async function ensureJSONFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

export async function readJSON<T>(filename: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function writeJSON<T>(filename: string, data: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, filename);
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

/**
 * Atomic read-modify-write of a JSON file. Uses proper-lockfile to serialize
 * concurrent writers to the same file, preventing lost updates.
 */
export async function updateJSON<T>(
  filename: string,
  mutator: (items: T[]) => T[] | Promise<T[]>
): Promise<T[]> {
  const filePath = path.join(DATA_DIR, filename);
  await ensureJSONFile(filePath);
  const release = await lockfile.lock(filePath, {
    retries: { retries: 10, factor: 1.5, minTimeout: 50, maxTimeout: 1000 },
    stale: 10000,
  });
  try {
    const items = await readJSON<T>(filename);
    const next = await mutator(items);
    await writeJSON(filename, next);
    return next;
  } finally {
    await release();
  }
}

// Optional LibreOffice integration: if soffice is present on the machine, we
// auto-convert Office files to PDF on upload for nicer inline previews. If not,
// the file is saved as-is and the client-side renderer handles preview.
const SOFFICE_PATHS = [
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/usr/bin/soffice",
  "/usr/local/bin/soffice",
  "soffice",
];

async function findSoffice(): Promise<string | null> {
  for (const p of SOFFICE_PATHS) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // not at this path
    }
  }
  return null;
}

async function convertToPdf(inputPath: string, outputDir: string): Promise<string | null> {
  const soffice = await findSoffice();
  if (!soffice) return null;
  try {
    await execFileAsync(soffice, [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", outputDir,
      inputPath,
    ], { timeout: 60000 });
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const pdfPath = path.join(outputDir, `${baseName}.pdf`);
    await fs.access(pdfPath);
    return pdfPath;
  } catch (err) {
    console.error(`[storage] LibreOffice conversion failed for ${path.basename(inputPath)}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const CONVERTIBLE_EXTENSIONS = new Set(["pptx", "ppt", "odp", "docx", "doc", "odt"]);

function sanitizeFilename(name: string): string {
  // Strip path separators and null bytes; keep a readable name.
  const base = name.split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/\0/g, "").replace(/^\.+/, "");
  return cleaned || "file";
}

function assertInside(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Path escapes allowed root");
  }
}

export async function saveUpload(
  subdir: string,
  courseId: string,
  filename: string,
  buffer: Buffer
): Promise<{ relativePath: string; convertedFilename: string }> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`);
  }
  const safeName = sanitizeFilename(filename);
  const safeCourseId = sanitizeFilename(courseId);
  const dir = path.join(CONTENT_DIR, subdir, safeCourseId);
  assertInside(CONTENT_DIR, dir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, safeName);
  assertInside(CONTENT_DIR, filePath);
  await fs.writeFile(filePath, buffer);

  const ext = safeName.split(".").pop()?.toLowerCase() || "";
  if (CONVERTIBLE_EXTENSIONS.has(ext)) {
    const pdfPath = await convertToPdf(filePath, dir);
    if (pdfPath) {
      await fs.unlink(filePath).catch(() => {});
      const pdfFilename = path.basename(pdfPath);
      return {
        relativePath: path.join(subdir, safeCourseId, pdfFilename),
        convertedFilename: pdfFilename,
      };
    }
  }

  return { relativePath: path.join(subdir, safeCourseId, safeName), convertedFilename: safeName };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const filePath = path.join(CONTENT_DIR, relativePath);
  try {
    assertInside(CONTENT_DIR, filePath);
    await fs.unlink(filePath);
  } catch {
    // file may not exist, or escape attempt — swallow
  }
}

export async function deleteDir(relativePath: string): Promise<void> {
  const target = path.join(CONTENT_DIR, relativePath);
  try {
    assertInside(CONTENT_DIR, target);
    await fs.rm(target, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

export async function getFilePath(relativePath: string): Promise<string> {
  return path.join(CONTENT_DIR, relativePath);
}

export function getAbsolutePath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}
