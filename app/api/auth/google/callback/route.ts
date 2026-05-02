import { NextRequest, NextResponse } from "next/server";
import { isLocalhost } from "@/lib/auth";
import { exchangeCodeForTokens, writeAuthFile } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/settings?gmail=error&reason=${encodeURIComponent(error)}`, req.url));
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings?gmail=error&reason=missing_code", req.url));
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    await writeAuthFile({
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
    });
    return NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
  } catch (err) {
    const reason = err instanceof Error ? err.message : "exchange_failed";
    return NextResponse.redirect(new URL(`/settings?gmail=error&reason=${encodeURIComponent(reason)}`, req.url));
  }
}
