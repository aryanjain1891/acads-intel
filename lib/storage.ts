import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_DIR = path.join(process.cwd(), "content");
const ASSIGNMENTS_DIR = path.join(process.cwd(), "assignments");

export async function readJSON<T>(filename: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export async function writeJSON<T>(filename: string, data: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function readPlan(courseId: string): Promise<string> {
  const filePath = path.join(CONTENT_DIR, "plans", `${courseId}.md`);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

export async function writePlan(courseId: string, content: string): Promise<void> {
  const dir = path.join(CONTENT_DIR, "plans");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${courseId}.md`), content, "utf-8");
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
  } catch {
    return null;
  }
}

const CONVERTIBLE_EXTENSIONS = new Set(["pptx", "ppt", "odp", "docx", "doc", "odt"]);

export async function saveUpload(
  subdir: string,
  courseId: string,
  filename: string,
  buffer: Buffer
): Promise<{ relativePath: string; convertedFilename: string }> {
  const dir = path.join(CONTENT_DIR, subdir, courseId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (CONVERTIBLE_EXTENSIONS.has(ext)) {
    const pdfPath = await convertToPdf(filePath, dir);
    if (pdfPath) {
      await fs.unlink(filePath).catch(() => {});
      const pdfFilename = path.basename(pdfPath);
      return {
        relativePath: path.join(subdir, courseId, pdfFilename),
        convertedFilename: pdfFilename,
      };
    }
  }

  return { relativePath: path.join(subdir, courseId, filename), convertedFilename: filename };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const filePath = path.join(CONTENT_DIR, relativePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may not exist
  }
}

export async function getFilePath(relativePath: string): Promise<string> {
  return path.join(CONTENT_DIR, relativePath);
}

export async function listAssignments(courseId: string): Promise<string[]> {
  const dir = path.join(ASSIGNMENTS_DIR, courseId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function createAssignment(courseId: string, slug: string): Promise<void> {
  const dir = path.join(ASSIGNMENTS_DIR, courseId, slug);
  await fs.mkdir(dir, { recursive: true });
  const readme = path.join(dir, "README.md");
  await fs.writeFile(readme, `# ${slug}\n\nAssignment workspace.\n`, "utf-8");
}

export function getAbsolutePath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}
