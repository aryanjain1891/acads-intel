import { promises as fs } from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const MODEL = "gemini-2.5-flash-lite";
const INLINE_MAX_MB = 20;
const MAX_RETRIES = 5;

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odp: "application/vnd.oasis.opendocument.presentation",
  odt: "application/vnd.oasis.opendocument.text",
};

const SUPPORTED_EXTS = new Set(Object.keys(MIME_MAP));

const TRANSCRIBE_PROMPT =
  "Transcribe this entire document to a single clean markdown transcript. " +
  "Preserve all content, formulas, diagrams (describe them in [brackets]), and structure. " +
  "Use proper markdown: headings, lists, code blocks for pseudocode. " +
  "Output one continuous transcript with no page labels or commentary.";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadFileToGemini(apiKey: string, filePath: string, mimeType: string): Promise<string> {
  const stat = await fs.stat(filePath);
  const buffer = await fs.readFile(filePath);
  const start = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(stat.size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: path.basename(filePath) } }),
    }
  );
  if (!start.ok) throw new Error(`Files upload init failed: ${start.status} ${await start.text()}`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("No upload URL from Gemini Files API");

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Length": String(stat.size),
    },
    body: new Uint8Array(buffer),
  });
  if (!upload.ok) throw new Error(`Files upload failed: ${upload.status} ${await upload.text()}`);
  const result = await upload.json();
  return result?.file?.uri as string;
}

async function transcribeOne(relativeUrl: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const ext = relativeUrl.split(".").pop()?.toLowerCase() || "";
  if (!SUPPORTED_EXTS.has(ext)) return;
  const mimeType = MIME_MAP[ext];

  const filePath = path.join(CONTENT_DIR, relativeUrl);
  const outputPath = filePath.replace(/\.[^.]+$/, ".md");

  try {
    await fs.access(outputPath);
    return; // already transcribed
  } catch {
    // proceed
  }

  const sizeMb = (await fs.stat(filePath)).size / (1024 * 1024);

  let partsPayload: Array<Record<string, unknown>>;
  if (sizeMb <= INLINE_MAX_MB) {
    const buffer = await fs.readFile(filePath);
    partsPayload = [
      { text: TRANSCRIBE_PROMPT },
      { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
    ];
  } else {
    const uri = await uploadFileToGemini(apiKey, filePath, mimeType);
    partsPayload = [
      { text: TRANSCRIBE_PROMPT },
      { file_data: { mime_type: mimeType, file_uri: uri } },
    ];
  }

  let lastError = "";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: partsPayload }] }),
        }
      );

      if (res.status === 429 && attempt < MAX_RETRIES - 1) {
        await sleep(2 ** (attempt + 2) * 1000);
        continue;
      }

      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${await res.text()}`;
        break;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (!text) {
        lastError = "Empty response from Gemini";
        break;
      }

      await fs.writeFile(outputPath, text, "utf-8");
      await updateTranscriptsIndex(path.dirname(outputPath));
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (lastError) {
    await fs.writeFile(outputPath, `[Transcription error: ${lastError}]`, "utf-8");
  }
}

async function updateTranscriptsIndex(dir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir);
    const mdFiles = entries
      .filter((f) => f.endsWith(".md") && f !== "_transcripts_index.md")
      .sort();
    if (mdFiles.length === 0) return;
    const body =
      "# Transcripts Index\n\nAvailable transcripts in this folder:\n\n" +
      mdFiles.map((f) => `- ${f}`).join("\n") +
      "\n";
    await fs.writeFile(path.join(dir, "_transcripts_index.md"), body, "utf-8");
  } catch {
    // ignore
  }
}

/**
 * Fire-and-forget transcription for PDF/PPTX/DOCX. The .md transcript appears
 * next to the source file when done. Requires GEMINI_API_KEY in the server env.
 */
export function triggerOCR(relativeUrl: string) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[ocr] GEMINI_API_KEY not set — skipping OCR for", relativeUrl);
    return;
  }
  transcribeOne(relativeUrl).catch((err) => {
    console.error("[ocr] Failed for", relativeUrl, err);
  });
}
