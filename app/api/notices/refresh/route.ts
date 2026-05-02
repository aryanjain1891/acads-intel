import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readJSON, updateJSON } from "@/lib/storage";
import { isConnected, listMessages, getMessage, buildCourseQuery } from "@/lib/gmail";
import type { Course, Notice } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  if (!(await isConnected())) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  const courses = await readJSON<Course>("courses.json");
  const course = courses.find((c) => c.id === courseId);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const query = buildCourseQuery(course.matchPatterns);
  if (!query) {
    return NextResponse.json({ error: "Set sender or subject patterns for this course first", added: 0 }, { status: 400 });
  }

  let refs;
  try {
    refs = await listMessages(query, 50);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gmail list failed" }, { status: 502 });
  }

  const existing = await readJSON<Notice>("notices.json");
  const existingIds = new Set(
    existing.filter((n) => n.courseId === courseId && n.source === "gmail").map((n) => n.externalId)
  );
  const newRefs = refs.filter((r) => !existingIds.has(r.id));

  const fetched: Notice[] = [];
  const now = new Date().toISOString();
  for (const ref of newRefs) {
    try {
      const msg = await getMessage(ref.id);
      const isoDate = parseDate(msg.date) || now;
      fetched.push({
        id: uuidv4(),
        courseId,
        source: "gmail",
        externalId: msg.id,
        from: msg.from,
        subject: msg.subject,
        date: isoDate,
        rawText: msg.bodyText,
        createdAt: now,
      });
    } catch (err) {
      console.error(`[notices/refresh] failed to fetch ${ref.id}:`, err instanceof Error ? err.message : err);
    }
  }

  if (fetched.length > 0) {
    await updateJSON<Notice>("notices.json", (items) => [...items, ...fetched]);
  }
  return NextResponse.json({ added: fetched.length, scanned: refs.length });
}

function parseDate(rfc: string): string | null {
  if (!rfc) return null;
  const d = new Date(rfc);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
