import { NextRequest, NextResponse } from "next/server";
import { isLocalhost } from "@/lib/auth";
import { buildConsentUrl } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Settings first" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.redirect(buildConsentUrl());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
