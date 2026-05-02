import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { updateJSON } from "@/lib/storage";
import type { Notice } from "@/lib/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const courseId = formData.get("courseId") as string | null;
  const file = formData.get("file") as File | null;

  if (!courseId || !file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing required fields: courseId, file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB" }, { status: 413 });
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".txt") && !lower.endsWith(".eml")) {
    return NextResponse.json({ error: "Only .txt and .eml files are accepted" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawText: string;
  try {
    rawText = buffer.toString("utf-8").replace(/\r\n/g, "\n");
  } catch {
    return NextResponse.json({ error: "File is not valid utf-8" }, { status: 400 });
  }
  if (!rawText.trim()) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const notice: Notice = {
    id: uuidv4(),
    courseId: String(courseId),
    source: "upload",
    filename: file.name,
    rawText,
    date: now,
    createdAt: now,
  };
  await updateJSON<Notice>("notices.json", (items) => [...items, notice]);
  return NextResponse.json(notice, { status: 201 });
}
