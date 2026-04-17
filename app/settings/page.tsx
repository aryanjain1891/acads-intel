"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setKeySet(Boolean(d.geminiKeySet)))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiKey }),
    });
    setSaving(false);
    if (!res.ok) {
      toast("Failed to save", "error");
      return;
    }
    const data = await res.json();
    setKeySet(Boolean(geminiKey.trim()));
    setRestartRequired(Boolean(data.restartRequired));
    setGeminiKey("");
    toast("Saved. Restart the app for the key to take effect.");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Configure optional integrations</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Google Gemini API key</h2>
            <p className="mt-1 text-sm text-muted">
              Needed for auto-transcribing PDF lecture notes. Free at{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline">
                aistudio.google.com/apikey
              </a>
              . Saved to <code className="rounded bg-background px-1.5 py-0.5 text-xs">.env.local</code> on your machine — never leaves your laptop.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              keySet ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {keySet ? "Set" : "Not set"}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="password"
            placeholder={keySet ? "••••••••••••  (paste a new key to replace)" : "Paste your Gemini API key"}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            autoComplete="off"
          />
          <button
            onClick={save}
            disabled={saving || !geminiKey.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {restartRequired && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠️ Saved. Restart the dev server (Ctrl+C, then <code className="rounded bg-background px-1">npm run dev</code>) for the new key to take effect.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        <h2 className="mb-2 text-base font-semibold text-foreground">Your data</h2>
        <p>
          Everything you put into Acads Intel lives on your laptop inside the project folder — in{" "}
          <code className="rounded bg-background px-1">data/</code>,{" "}
          <code className="rounded bg-background px-1">content/</code>, and{" "}
          <code className="rounded bg-background px-1">assignments/</code>. Back up the folder to back up your data. Delete the folder to delete everything.
        </p>
      </section>
    </div>
  );
}
