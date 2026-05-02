import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readJSON, updateJSON } from "@/lib/storage";
import type { SavedNotice } from "@/lib/types";

export async function GET(req: NextRequest) {
  const all = await readJSON<SavedNotice>("saved-notices.json");
  const courseId = req.nextUrl.searchParams.get("courseId");
  const filtered = courseId ? all.filter((s) => s.courseId === courseId) : all;
  filtered.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const itemBody = typeof body.body === "string" ? body.body : "";

  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!itemBody.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const saved: SavedNotice = {
    id: uuidv4(),
    courseId,
    title,
    body: itemBody,
    savedAt: new Date().toISOString(),
  };
  await updateJSON<SavedNotice>("saved-notices.json", (items) => [...items, saved]);
  return NextResponse.json(saved, { status: 201 });
}
