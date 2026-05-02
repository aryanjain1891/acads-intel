import { NextRequest, NextResponse } from "next/server";
import { updateJSON } from "@/lib/storage";
import type { Notice } from "@/lib/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let removed = false;
  await updateJSON<Notice>("notices.json", (items) => {
    const next = items.filter((n) => n.id !== id);
    removed = next.length !== items.length;
    return next;
  });
  if (!removed) return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
