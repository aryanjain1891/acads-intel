import { NextRequest, NextResponse } from "next/server";
import { updateJSON, deleteDir } from "@/lib/storage";
import type { Course, Exam, EvalComponent, Deadline, Resource, Handout, ResourceFolder, Notice, SavedNotice, MatchPatterns } from "@/lib/types";

function sanitizeMatchPatterns(input: unknown): MatchPatterns | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as { senders?: unknown; subjectKeywords?: unknown; sinceDate?: unknown };
  const toArr = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const cleaned = v
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 50);
    return cleaned.length > 0 ? cleaned : [];
  };
  const senders = toArr(raw.senders);
  const subjectKeywords = toArr(raw.subjectKeywords);
  const sinceDate =
    typeof raw.sinceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.sinceDate.trim())
      ? raw.sinceDate.trim()
      : undefined;
  return { senders, subjectKeywords, sinceDate };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, code, instructor, credits, matchPatterns } = body;
  const cleanedPatterns = matchPatterns !== undefined ? sanitizeMatchPatterns(matchPatterns) : undefined;

  let updated: Course | null = null;
  await updateJSON<Course>("courses.json", (courses) => {
    const index = courses.findIndex((c) => c.id === id);
    if (index === -1) return courses;
    updated = {
      ...courses[index],
      ...(name !== undefined && { name: String(name) }),
      ...(code !== undefined && { code: String(code) }),
      ...(instructor !== undefined && { instructor: String(instructor) }),
      ...(credits !== undefined && { credits: Number(credits) }),
      ...(matchPatterns !== undefined && { matchPatterns: cleanedPatterns }),
    };
    courses[index] = updated;
    return courses;
  });
  if (!updated) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let found = false;
  await updateJSON<Course>("courses.json", (courses) => {
    const next = courses.filter((c) => c.id !== id);
    found = next.length !== courses.length;
    return next;
  });
  if (!found) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Cascade through all related data. These all use updateJSON so they lock
  // their respective files individually — no cross-file transaction needed.
  await updateJSON<Exam>("exams.json", (items) => items.filter((e) => e.courseId !== id));
  await updateJSON<EvalComponent>("scores.json", (items) => items.filter((s) => s.courseId !== id));
  await updateJSON<Deadline>("deadlines.json", (items) => items.filter((d) => d.courseId !== id));
  await updateJSON<Resource>("resources.json", (items) => items.filter((r) => r.courseId !== id));
  await updateJSON<Handout>("handouts.json", (items) => items.filter((h) => h.courseId !== id));
  await updateJSON<ResourceFolder>("resource-folders.json", (items) => items.filter((f) => f.courseId !== id));
  await updateJSON<Notice>("notices.json", (items) => items.filter((n) => n.courseId !== id));
  await updateJSON<SavedNotice>("saved-notices.json", (items) => items.filter((s) => s.courseId !== id));

  // Clean up uploaded files. Best-effort.
  await deleteDir(`resources/${id}`);
  await deleteDir(`handouts/${id}`);

  return NextResponse.json({ success: true });
}
