import type { NextRequest } from "next/server";

// Acads Intel is a single-user local app. Any non-loopback origin is a
// misconfiguration or attack — gate sensitive routes on this check.
export function isLocalhost(req: NextRequest): boolean {
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
