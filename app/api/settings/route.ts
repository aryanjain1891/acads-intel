import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

export async function GET() {
  return NextResponse.json({
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const key = typeof body.geminiKey === "string" ? body.geminiKey.trim() : "";

  let existing = "";
  try {
    existing = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    // file doesn't exist yet
  }

  const lines = existing.split("\n").filter((l) => !l.startsWith("GEMINI_API_KEY="));
  if (key) lines.push(`GEMINI_API_KEY=${key}`);
  const next = lines.filter((l) => l !== "").join("\n") + "\n";

  await fs.writeFile(ENV_PATH, next, "utf-8");

  return NextResponse.json({ ok: true, restartRequired: true });
}
