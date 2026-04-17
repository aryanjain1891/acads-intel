import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { readJSON, writeJSON, saveUpload } from "@/lib/storage";
import { triggerOCR } from "@/lib/ocr";
import type { Resource } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

async function syncRenamedFiles(resources: Resource[]): Promise<boolean> {
  let changed = false;
  const trackedUrls = new Set(resources.filter((r) => r.type === "file").map((r) => r.url));

  for (const r of resources) {
    if (r.type !== "file") continue;
    const fullPath = path.join(CONTENT_DIR, r.url);
    try {
      await fs.access(fullPath);
    } catch {
      const dir = path.dirname(fullPath);
      const ext = path.extname(r.url);
      try {
        const files = await fs.readdir(dir);
        const candidates = files.filter(
          (f) => path.extname(f) === ext && !trackedUrls.has(path.join(path.dirname(r.url), f))
        );
        if (candidates.length === 1) {
          const newFilename = candidates[0];
          const newUrl = path.join(path.dirname(r.url), newFilename);
          trackedUrls.delete(r.url);
          trackedUrls.add(newUrl);
          r.url = newUrl;
          r.title = path.basename(newFilename, ext);
          changed = true;
        }
      } catch { /* directory doesn't exist */ }
    }
  }
  return changed;
}

export async function GET(req: NextRequest) {
  const resources = await readJSON<Resource>("resources.json");

  const synced = await syncRenamedFiles(resources);
  if (synced) await writeJSON("resources.json", resources);

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (courseId) {
    const filtered = resources.filter((r) => r.courseId === courseId);
    return NextResponse.json(filtered);
  }
  return NextResponse.json(resources);
}

function getFileTypeFromExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const type = formData.get("type") as string | null;
  const courseId = formData.get("courseId") as string | null;

  if (!type || !courseId) {
    return NextResponse.json(
      { error: "Missing required fields: type, courseId" },
      { status: 400 }
    );
  }

  const folder = (formData.get("folder") as string | null) || "";
  const isPYQ = formData.get("isPYQ") === "true";
  const isSolution = formData.get("isSolution") === "true";
  const solutionStatus = (formData.get("solutionStatus") as Resource["solutionStatus"]) || undefined;
  const solutionId = (formData.get("solutionId") as string) || undefined;
  const resources = await readJSON<Resource>("resources.json");
  const maxOrder = resources.filter((r) => r.courseId === courseId).reduce((m, r) => Math.max(m, r.order ?? 0), -1);

  if (type === "link") {
    const title = formData.get("title") as string | null;
    const url = formData.get("url") as string | null;
    if (!title || !url) {
      return NextResponse.json(
        { error: "Missing required fields for link: title, url" },
        { status: 400 }
      );
    }
    const resource: Resource = {
      id: uuidv4(),
      courseId: String(courseId),
      title: String(title),
      type: "link",
      url: String(url),
      fileType: null,
      folder,
      order: maxOrder + 1,
    };
    resources.push(resource);
    await writeJSON("resources.json", resources);
    return NextResponse.json(resource, { status: 201 });
  }

  if (type === "file") {
    const files = formData.getAll("file") as File[];
    const titles = formData.getAll("title") as string[];
    if (files.length === 0 || files.some((f) => !(f instanceof File))) {
      return NextResponse.json(
        { error: "Missing required fields for file: title, file" },
        { status: 400 }
      );
    }
    // Pre-buffer all files before any disk/conversion work to avoid
    // concurrent LibreOffice calls which fail silently
    const buffered = await Promise.all(
      files.map(async (f) => ({ file: f, buffer: Buffer.from(await f.arrayBuffer()) }))
    );

    const created: Resource[] = [];
    for (let i = 0; i < buffered.length; i++) {
      const { file, buffer } = buffered[i];
      const title = titles[i] || file.name;
      const { relativePath, convertedFilename } = await saveUpload("resources", courseId, file.name, buffer);
      const fileType = getFileTypeFromExtension(convertedFilename);

      let finalUrl = relativePath;
      const ext = convertedFilename.split(".").pop() || "";
      const safeTitle = String(title).replace(/[/\\]/g, "_");
      const expectedFilename = safeTitle + "." + ext;
      if (expectedFilename !== convertedFilename) {
        const oldPath = path.join(CONTENT_DIR, relativePath);
        const newPath = path.join(path.dirname(oldPath), expectedFilename);
        try {
          await fs.rename(oldPath, newPath);
          finalUrl = path.join("resources", courseId, expectedFilename);
        } catch {
          // keep original filename if rename fails
        }
      }

      const resource: Resource = {
        id: uuidv4(),
        courseId: String(courseId),
        title: String(title),
        type: "file",
        url: finalUrl,
        fileType,
        folder,
        order: maxOrder + 1 + i,
        ...(isPYQ && { isPYQ: true, ...(isSolution && { isSolution: true }), solutionStatus, solutionId }),
      };
      resources.push(resource);
      created.push(resource);
    }
    await writeJSON("resources.json", resources);
    for (const r of created) {
      if (r.fileType === "application/pdf") {
        triggerOCR(r.url);
      }
    }
    return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type. Must be: link or file" }, { status: 400 });
}
