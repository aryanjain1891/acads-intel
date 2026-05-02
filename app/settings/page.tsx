"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

function SettingsInner() {
  const [geminiKey, setGeminiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);

  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [clientIdSet, setClientIdSet] = useState(false);
  const [clientSecretSet, setClientSecretSet] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const { toast } = useToast();
  const params = useSearchParams();
  const router = useRouter();

  const loadStatus = useCallback(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setKeySet(Boolean(d.geminiKeySet));
        setClientIdSet(Boolean(d.googleClientIdSet));
        setClientSecretSet(Boolean(d.googleClientSecretSet));
      })
      .catch(() => {});
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((d: { connected: boolean; email?: string }) => {
        setGmailConnected(Boolean(d.connected));
        setGmailEmail(d.email || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const gmail = params.get("gmail");
    if (gmail === "connected") {
      toast("Gmail connected");
      router.replace("/settings");
    } else if (gmail === "error") {
      toast(`Gmail connection failed: ${params.get("reason") || "unknown error"}`, "error");
      router.replace("/settings");
    }
  }, [params, router, toast]);

  const saveGemini = async () => {
    setSavingGemini(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiKey }),
    });
    setSavingGemini(false);
    if (!res.ok) { toast("Failed to save", "error"); return; }
    const data = await res.json();
    setKeySet(Boolean(geminiKey.trim()));
    setRestartRequired(Boolean(data.restartRequired));
    setGeminiKey("");
    toast("Saved. Restart the app for the key to take effect.");
  };

  const saveGoogle = async () => {
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      toast("Provide both client ID and secret", "error");
      return;
    }
    setSavingGoogle(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        googleClientId,
        googleClientSecret,
      }),
    });
    setSavingGoogle(false);
    if (!res.ok) { toast("Failed to save Google credentials", "error"); return; }
    setClientIdSet(true);
    setClientSecretSet(true);
    setGoogleClientId("");
    setGoogleClientSecret("");
    setRestartRequired(true);
    toast("Saved. Restart the app, then click Connect Gmail.");
  };

  const disconnectGmail = async () => {
    setDisconnecting(true);
    const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
    setDisconnecting(false);
    if (!res.ok) { toast("Failed to disconnect", "error"); return; }
    toast("Gmail disconnected");
    setGmailConnected(false);
    setGmailEmail(null);
  };

  const credsReady = clientIdSet && clientSecretSet;

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
              Needed for auto-transcribing PDF lecture notes and compiling notice boards. Free at{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline">
                aistudio.google.com/apikey
              </a>
              . Saved to <code className="rounded bg-background px-1.5 py-0.5 text-xs">.env.local</code> on your machine — never leaves your laptop.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${keySet ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
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
            onClick={saveGemini}
            disabled={savingGemini || !geminiKey.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingGemini ? "Saving..." : "Save"}
          </button>
        </div>

        {restartRequired && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠️ Saved. Restart the dev server (Ctrl+C, then <code className="rounded bg-background px-1">npm run dev</code>) for the new key to take effect.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Gmail</h2>
            <p className="mt-1 text-sm text-muted">
              Connect Gmail (read-only) to auto-pull course notices into the per-course notice board. Set up an OAuth client in{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-accent underline">
                Google Cloud Console
              </a>{" "}
              with redirect URI <code className="rounded bg-background px-1.5 py-0.5 text-xs">http://localhost:3000/api/auth/google/callback</code>. See README for details.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${gmailConnected ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {gmailConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder={clientIdSet ? "••••••••  (paste a new ID to replace)" : "OAuth Client ID"}
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            autoComplete="off"
          />
          <input
            type="password"
            placeholder={clientSecretSet ? "••••••••  (paste a new secret to replace)" : "OAuth Client Secret"}
            value={googleClientSecret}
            onChange={(e) => setGoogleClientSecret(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            autoComplete="off"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={saveGoogle}
            disabled={savingGoogle || (!googleClientId.trim() && !googleClientSecret.trim())}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingGoogle ? "Saving..." : "Save credentials"}
          </button>
          {gmailConnected ? (
            <button
              onClick={disconnectGmail}
              disabled={disconnecting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <a
              href="/api/auth/google/start"
              className={`rounded-lg border border-border px-4 py-2 text-sm font-medium ${credsReady ? "text-foreground hover:border-accent hover:text-accent" : "pointer-events-none cursor-not-allowed opacity-50 text-muted"}`}
            >
              Connect Gmail
            </a>
          )}
        </div>

        {gmailConnected && gmailEmail && (
          <p className="mt-3 text-xs text-muted">Connected as <span className="font-medium text-foreground">{gmailEmail}</span></p>
        )}
        {!credsReady && !gmailConnected && (
          <p className="mt-3 text-xs text-muted">Save your OAuth client ID and secret first, restart the app, then click Connect Gmail.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        <h2 className="mb-2 text-base font-semibold text-foreground">Your data</h2>
        <p>
          Everything you put into Acads Intel lives on your laptop inside the project folder — in{" "}
          <code className="rounded bg-background px-1">data/</code> and{" "}
          <code className="rounded bg-background px-1">content/</code>. Back up the folder to back up your data. Delete the folder to delete everything.
        </p>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading...</div>}>
      <SettingsInner />
    </Suspense>
  );
}
