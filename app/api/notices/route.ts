import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readJSON, updateJSON } from "@/lib/storage";
import type { Notice } from "@/lib/types";

const MAX_PASTE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(req: NextRequest) {
  const notices = await readJSON<Notice>("notices.json");
  const courseId = req.nextUrl.searchParams.get("courseId");
  const filtered = courseId ? notices.filter((n) => n.courseId === courseId) : notices;
  filtered.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const rawText = typeof body.rawText === "string" ? body.rawText : "";

  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  if (!rawText.trim()) return NextResponse.json({ error: "rawText required" }, { status: 400 });
  if (Buffer.byteLength(rawText, "utf-8") > MAX_PASTE_BYTES) {
    return NextResponse.json({ error: "Pasted content exceeds 5 MB" }, { status: 413 });
  }

  const now = new Date().toISOString();
  const notice: Notice = {
    id: uuidv4(),
    courseId,
    source: "paste",
    rawText: rawText.replace(/\r\n/g, "\n"),
    date: now,
    createdAt: now,
  };
  await updateJSON<Notice>("notices.json", (items) => [...items, notice]);
  return NextResponse.json(notice, { status: 201 });
}
