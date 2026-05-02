import { NextRequest, NextResponse } from "next/server";
import { readJSON } from "@/lib/storage";
import { compileNotices } from "@/lib/gemini";
import type { Notice } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const noticeIds = Array.isArray(body.noticeIds)
    ? body.noticeIds.filter((x: unknown): x is string => typeof x === "string")
    : null;

  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const all = await readJSON<Notice>("notices.json");
  let items = all
    .filter((n) => n.courseId === courseId)
    .sort((a, b) => (a.date || a.createdAt).localeCompare(b.date || b.createdAt));

  if (noticeIds && noticeIds.length > 0) {
    const allow = new Set(noticeIds);
    items = items.filter((n) => allow.has(n.id));
  } else if (noticeIds && noticeIds.length === 0) {
    return NextResponse.json({ error: "Select at least one notice" }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "No notices selected for this course" }, { status: 400 });
  }

  const concatenated = items
    .map((n, i) => {
      const head = `--- Notice ${i + 1} | source: ${n.source} | ${n.date || n.createdAt} ---`;
      const meta = n.source === "gmail" ? `${n.from || ""} | ${n.subject || ""}` : n.filename || "";
      return [head, meta, n.rawText].filter(Boolean).join("\n");
    })
    .join("\n\n");

  try {
    const compiled = await compileNotices(prompt, concatenated);
    return NextResponse.json({ title: compiled.title, body: compiled.body, usedCount: items.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Compile failed" }, { status: 502 });
  }
}
