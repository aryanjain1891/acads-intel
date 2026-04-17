import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readJSON, updateJSON, saveUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";
import type { Handout } from "@/lib/types";

export async function GET(req: NextRequest) {
  const handouts = await readJSON<Handout>("handouts.json");
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (courseId) {
    const filtered = handouts.filter((h) => h.courseId === courseId);
    return NextResponse.json(filtered);
  }
  return NextResponse.json(handouts);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const courseId = formData.get("courseId") as string | null;
  const file = formData.get("file") as File | null;

  if (!courseId || !file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing required fields: courseId, file" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit` },
      { status: 413 }
    );
  }

  const filename = file.name;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { relativePath, convertedFilename } = await saveUpload("handouts", courseId, filename, buffer);

  const displayName = filename.replace(/\.[^/.]+$/, "") + (convertedFilename !== filename ? " (PDF)" : "");
  const handout: Handout = {
    id: uuidv4(),
    courseId: String(courseId),
    filename: convertedFilename,
    displayName,
    path: relativePath,
  };
  await updateJSON<Handout>("handouts.json", (items) => [...items, handout]);
  return NextResponse.json(handout, { status: 201 });
}
