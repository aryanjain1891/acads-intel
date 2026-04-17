"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ApiKeyBanner() {
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem("apiKeyBannerDismissed") === "1");
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setKeySet(Boolean(d.geminiKeySet)))
      .catch(() => setKeySet(true)); // fail quietly — don't pester on errors
  }, []);

  if (keySet !== false || dismissed || pathname === "/settings") return null;

  const dismiss = () => {
    sessionStorage.setItem("apiKeyBannerDismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-6 py-2.5 text-sm">
      <div className="text-warning">
        <span className="font-medium">Gemini API key not set.</span>{" "}
        <span className="text-foreground">
          PDF transcription and AI features need one.{" "}
          <Link href="/settings" className="font-medium underline">
            Set it up →
          </Link>
        </span>
      </div>
      <button
        onClick={dismiss}
        className="rounded p-1 text-muted hover:bg-warning/10 hover:text-foreground"
        title="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
