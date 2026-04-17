import { NextRequest, NextResponse } from "next/server";
import { updateJSON, deleteDir } from "@/lib/storage";
import type { Course, Exam, EvalComponent, Deadline, Resource, Handout, ResourceFolder } from "@/lib/types";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, code, instructor, credits } = body;

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

  // Clean up uploaded files and assignment workspaces. Best-effort.
  await deleteDir(`resources/${id}`, "content");
  await deleteDir(`handouts/${id}`, "content");
  await deleteDir(`plans/${id}.md`, "content");
  await deleteDir(id, "assignments");

  return NextResponse.json({ success: true });
}
