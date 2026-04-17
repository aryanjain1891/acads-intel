import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getFilePath } from "@/lib/storage";

function getContentTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    md: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    html: "text/html",
  };
  return map[ext] ?? "application/octet-stream";
}

const CONTENT_ROOT = path.resolve(process.cwd(), "content");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  if (pathSegments.some((s) => s.includes("\0") || s === ".." || s.startsWith("/"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const relativePath = path.join(...pathSegments);
  const filePath = await getFilePath(relativePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(CONTENT_ROOT + path.sep) && resolved !== CONTENT_ROOT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }
    const buffer = await fs.readFile(resolved);
    const contentType = getContentTypeFromExtension(pathSegments[pathSegments.length - 1] ?? "");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
