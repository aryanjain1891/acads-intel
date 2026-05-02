import { NextRequest, NextResponse } from "next/server";
import { updateJSON } from "@/lib/storage";
import type { SavedNotice } from "@/lib/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let removed = false;
  await updateJSON<SavedNotice>("saved-notices.json", (items) => {
    const next = items.filter((s) => s.id !== id);
    removed = next.length !== items.length;
    return next;
  });
  if (!removed) return NextResponse.json({ error: "Saved notice not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
