import { NextRequest, NextResponse } from "next/server";
import { isLocalhost } from "@/lib/auth";
import { deleteAuthFile } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteAuthFile();
  return NextResponse.json({ ok: true });
}
