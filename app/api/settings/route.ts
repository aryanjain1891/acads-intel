import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isLocalhost } from "@/lib/auth";

const ENV_PATH = path.join(process.cwd(), ".env.local");

const KEY_RE = /^[A-Za-z0-9_\-.]{10,200}$/;
// Google OAuth client secrets contain "/" and other characters not in KEY_RE.
const SECRET_RE = /^[A-Za-z0-9_\-./~]{10,200}$/;

async function rewriteEnv(updates: Record<string, string | null>): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    // file doesn't exist yet
  }
  const keysToReplace = new Set(Object.keys(updates));
  const lines = existing
    .split("\n")
    .filter((l) => {
      const eq = l.indexOf("=");
      if (eq === -1) return l !== "";
      return !keysToReplace.has(l.slice(0, eq));
    });
  for (const [k, v] of Object.entries(updates)) {
    if (v) lines.push(`${k}=${v}`);
  }
  const next = lines.filter((l) => l !== "").join("\n") + "\n";
  await fs.writeFile(ENV_PATH, next, { mode: 0o600 });
}

export async function GET() {
  return NextResponse.json({
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY?.trim()),
    googleClientIdSet: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    googleClientSecretSet: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
  });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, string | null> = {};

  if ("geminiKey" in body) {
    const v = typeof body.geminiKey === "string" ? body.geminiKey.trim() : "";
    if (v && !KEY_RE.test(v)) {
      return NextResponse.json({ error: "Gemini key contains invalid characters" }, { status: 400 });
    }
    updates.GEMINI_API_KEY = v || null;
  }

  if ("googleClientId" in body) {
    const v = typeof body.googleClientId === "string" ? body.googleClientId.trim() : "";
    if (v && !KEY_RE.test(v)) {
      return NextResponse.json({ error: "Google client ID contains invalid characters" }, { status: 400 });
    }
    updates.GOOGLE_CLIENT_ID = v || null;
  }

  if ("googleClientSecret" in body) {
    const v = typeof body.googleClientSecret === "string" ? body.googleClientSecret.trim() : "";
    if (v && !SECRET_RE.test(v)) {
      return NextResponse.json({ error: "Google client secret contains invalid characters" }, { status: 400 });
    }
    updates.GOOGLE_CLIENT_SECRET = v || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No recognized fields" }, { status: 400 });
  }

  await rewriteEnv(updates);

  return NextResponse.json({ ok: true, restartRequired: true });
}
