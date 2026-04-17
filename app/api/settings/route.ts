import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

// Only allow local loopback callers. Acads Intel is a single-user local app;
// any request from a non-loopback origin is a misconfiguration or attack.
function isLocalhost(req: NextRequest): boolean {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (!localHosts.has(hostname)) return false;
  if (forwardedFor && !forwardedFor.split(",").every((ip) => localHosts.has(ip.trim()))) {
    return false;
  }
  return true;
}

export async function GET() {
  return NextResponse.json({
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.geminiKey === "string" ? body.geminiKey.trim() : "";

  if (key && !/^[A-Za-z0-9_\-.]{10,200}$/.test(key)) {
    return NextResponse.json({ error: "Key contains invalid characters" }, { status: 400 });
  }

  let existing = "";
  try {
    existing = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    // file doesn't exist yet
  }

  const lines = existing.split("\n").filter((l) => !l.startsWith("GEMINI_API_KEY="));
  if (key) lines.push(`GEMINI_API_KEY=${key}`);
  const next = lines.filter((l) => l !== "").join("\n") + "\n";

  await fs.writeFile(ENV_PATH, next, { mode: 0o600 });

  return NextResponse.json({ ok: true, restartRequired: true });
}
