"use client";

import { useEffect, useRef, useState } from "react";

interface FilePreviewProps {
  url: string;
  fileType?: string | null;
  filename: string;
  className?: string;
}

const OFFICE_EXTS = ["pptx", "ppt", "docx", "doc", "odp", "odt"];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

export default function FilePreview({ url, fileType, filename, className = "" }: FilePreviewProps) {
  const ext = extOf(filename);
  const isImage = fileType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf" || fileType === "application/pdf";
  const isOffice = OFFICE_EXTS.includes(ext);

  if (isImage) {
    return <img src={url} alt={filename} className={`h-full w-full object-contain bg-background ${className}`} />;
  }
  if (isPdf) {
    return <iframe src={url} title={filename} className={`h-full w-full bg-white ${className}`} />;
  }
  if (isOffice) {
    return <OfficePreview url={url} filename={filename} className={className} />;
  }
  // Fallback for unknown types — let the browser try, otherwise download link
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-surface p-6 text-center text-sm text-muted ${className}`}>
      <p>Preview not available for this file type.</p>
      <a href={url} download={filename} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">
        Download {filename}
      </a>
    </div>
  );
}

function OfficePreview({ url, filename, className }: { url: string; filename: string; className: string }) {
  const ext = extOf(filename);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      setStatus("loading");
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();

        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        if (ext === "docx" || ext === "doc" || ext === "odt") {
          const mammoth = await import("mammoth");
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = `<div class="prose prose-sm max-w-none p-6 bg-white text-black">${result.value}</div>`;
        } else {
          // pptx / ppt / odp
          const { init } = await import("pptx-preview");
          if (cancelled || !containerRef.current) return;
          const previewer = init(containerRef.current, {
            width: containerRef.current.clientWidth || 800,
          });
          await previewer.preview(buffer);
        }

        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to render");
        }
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [url, ext]);

  return (
    <div className={`relative h-full w-full overflow-auto bg-white ${className}`}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Rendering preview…
          </span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
          <p>Could not render preview.</p>
          <p className="text-xs">{errorMsg}</p>
          <a href={url} download={filename} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">
            Download {filename}
          </a>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
