"use client";

import { useState } from "react";

interface CopyPathButtonProps {
  absolutePath: string;
  projectRoot: string;
  label?: string;
  small?: boolean;
}

export default function CopyPathButton({ absolutePath, projectRoot, label = "Copy Path", small }: CopyPathButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!absolutePath || !projectRoot) return null;

  const relativePath = absolutePath.startsWith(projectRoot)
    ? absolutePath.slice(projectRoot.length + 1)
    : absolutePath;

  const copy = async () => {
    await navigator.clipboard.writeText(absolutePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      title={`${absolutePath}\nClick to copy absolute path — paste into any AI tool`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface font-medium transition-colors hover:bg-surface-hover ${
        copied ? "text-success" : "text-foreground"
      } ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
    >
      {copied ? (
        <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
      {copied ? "Copied!" : label}
      <span className="text-muted">· {relativePath}</span>
    </button>
  );
}
