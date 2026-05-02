import { NextResponse } from "next/server";
import { isConnected, getProfileEmail } from "@/lib/gmail";

export async function GET() {
  const connected = await isConnected();
  if (!connected) return NextResponse.json({ connected: false });
  const email = await getProfileEmail();
  return NextResponse.json({ connected: true, email });
}
