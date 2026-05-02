import { promises as fs } from "fs";
import path from "path";
import type { MatchPatterns } from "./types";

const AUTH_PATH = path.join(process.cwd(), "data", "google-auth.json");

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface AuthFile {
  refreshToken: string;
  connectedAt: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

export async function readAuthFile(): Promise<AuthFile | null> {
  try {
    const raw = await fs.readFile(AUTH_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.refreshToken === "string") return parsed as AuthFile;
    return null;
  } catch {
    return null;
  }
}

export async function writeAuthFile(data: AuthFile): Promise<void> {
  await fs.mkdir(path.dirname(AUTH_PATH), { recursive: true });
  await fs.writeFile(AUTH_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function deleteAuthFile(): Promise<void> {
  tokenCache = null;
  await fs.unlink(AUTH_PATH).catch(() => {});
}

export async function isConnected(): Promise<boolean> {
  return (await readAuthFile()) !== null;
}

export function getOAuthRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/auth/google/callback`;
}

export function buildConsentUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOAuthRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  if (state) params.set("state", state);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{ refreshToken: string; accessToken: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getOAuthRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error("No refresh_token in response — user may have previously consented; revoke access at myaccount.google.com and retry.");
  }
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const auth = await readAuthFile();
  if (!auth) throw new Error("Gmail not connected");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: auth.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

export async function getProfileEmail(): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${GMAIL_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.emailAddress || null;
  } catch {
    return null;
  }
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export async function listMessages(query: string, maxResults = 50): Promise<GmailMessageRef[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const res = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail list failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return (data.messages || []) as GmailMessageRef[];
}

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  bodyText: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function decodeB64Url(s: string): string {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBody(part: GmailPart): string {
  // Prefer text/plain anywhere in the tree; fall back to stripped text/html.
  const plain = findPart(part, "text/plain");
  if (plain?.body?.data) return decodeB64Url(plain.body.data);
  const html = findPart(part, "text/html");
  if (html?.body?.data) return stripHtml(decodeB64Url(html.body.data));
  return "";
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts || []) {
    const hit = findPart(child, mime);
    if (hit) return hit;
  }
  return null;
}

export async function getMessage(id: string): Promise<GmailMessage> {
  const token = await getAccessToken();
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail get failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  const headers: { name: string; value: string }[] = data.payload?.headers || [];
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  return {
    id: data.id,
    from: get("From"),
    subject: get("Subject"),
    date: get("Date"),
    bodyText: extractBody(data.payload || {}),
  };
}

function sanitizeKeyword(s: string): string {
  // Strip parens and quotes — both have meaning inside subject:(...) and would
  // break the query. Other Gmail operators just pass through as plain text.
  return s.replace(/[()"]/g, "").trim();
}

function isoToGmailDate(iso: string): string | null {
  // Gmail's after: operator wants YYYY/MM/DD; HTML date inputs give YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.replace(/-/g, "/");
}

export function buildCourseQuery(p: MatchPatterns | undefined): string | null {
  const senders = (p?.senders || []).map((s) => s.trim()).filter(Boolean);
  const keywords = (p?.subjectKeywords || []).map(sanitizeKeyword).filter(Boolean);
  if (senders.length === 0 && keywords.length === 0) return null;

  const parts: string[] = [];
  if (senders.length > 0) {
    parts.push(`(${senders.map((s) => `from:${s}`).join(" OR ")})`);
  }
  if (keywords.length > 0) {
    // subject:(word1 word2) → all words must appear in the subject (any order).
    // Looser than subject:"phrase" which requires an exact contiguous match.
    parts.push(`(${keywords.map((k) => `subject:(${k})`).join(" OR ")})`);
  }
  const gmailDate = p?.sinceDate ? isoToGmailDate(p.sinceDate) : null;
  parts.push(gmailDate ? `after:${gmailDate}` : `newer_than:120d`);
  return parts.join(" ");
}
