"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useToast } from "@/components/Toast";
import { apiPost, apiPostForm, apiPut, apiDelete } from "@/lib/api";
import type { Course, Notice, SavedNotice } from "@/lib/types";

type ConfirmDelete = { type: string; id: string; name: string } | null;

interface CompiledNotice {
  title: string;
  body: string;
}

const SOURCE_ICON: Record<Notice["source"], string> = {
  gmail: "📧",
  paste: "📋",
  upload: "📎",
};

const DEFAULT_PROMPT_PLACEHOLDER =
  "Compile all announcements into a clean notice board, one item per distinct announcement. Preserve every date, time, and room number.";

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function noticeLabel(n: Notice): string {
  if (n.source === "gmail") return n.subject || n.from || "Gmail";
  if (n.source === "upload") return n.filename || "uploaded file";
  return n.rawText.slice(0, 60).replace(/\n/g, " ").trim() + (n.rawText.length > 60 ? "…" : "");
}

export default function NoticesSection({
  courseId,
  course,
  notices,
  savedNotices,
  gmailConnected,
  reload,
  setConfirmDelete,
}: {
  courseId: string;
  course: Course;
  notices: Notice[];
  savedNotices: SavedNotice[];
  gmailConnected: boolean;
  reload: () => void;
  setConfirmDelete: (v: ConfirmDelete) => void;
}) {
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [showPatterns, setShowPatterns] = useState(false);
  const [sendersText, setSendersText] = useState((course.matchPatterns?.senders || []).join("\n"));
  const [keywordsText, setKeywordsText] = useState((course.matchPatterns?.subjectKeywords || []).join("\n"));
  const [sinceDate, setSinceDate] = useState(course.matchPatterns?.sinceDate || "");

  const [prompt, setPrompt] = useState("");
  const [compiled, setCompiled] = useState<CompiledNotice | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [savingCompiled, setSavingCompiled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedNotice, setExpandedNotice] = useState<Set<string>>(new Set());
  const [expandedSaved, setExpandedSaved] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(true);

  // Track which input notices are selected for compile. Default = all selected;
  // when the notice list changes, include any new ids that weren't previously
  // explicitly excluded (treat freshly fetched notices as in-scope).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const n of notices) if (!prev.size || !prev.has(n.id)) next.add(n.id);
      // Drop ids that no longer exist
      const valid = new Set(notices.map((n) => n.id));
      for (const id of next) if (!valid.has(id)) next.delete(id);
      return next;
    });
  // We intentionally only react to the ids list, not the prev set itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices.map((n) => n.id).join(",")]);

  const toggleNoticeExpand = (id: string) => {
    setExpandedNotice((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSavedExpand = (id: string) => {
    setExpandedSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(notices.map((n) => n.id)));
  const selectNone = () => setSelected(new Set());

  const submitAdd = async () => {
    if (uploadFile) {
      const fd = new FormData();
      fd.append("courseId", courseId);
      fd.append("file", uploadFile);
      const res = await apiPostForm("/api/notices/upload", fd);
      if (!res.ok) { toast(res.error, "error"); return; }
      toast("Notice added");
    } else if (pasteText.trim()) {
      const res = await apiPost("/api/notices", { courseId, rawText: pasteText });
      if (!res.ok) { toast(res.error, "error"); return; }
      toast("Notice added");
    } else {
      toast("Paste text or pick a file", "error");
      return;
    }
    setPasteText("");
    setUploadFile(null);
    setShowAdd(false);
    reload();
  };

  const savePatterns = async () => {
    const senders = sendersText.split("\n").map((s) => s.trim()).filter(Boolean);
    const subjectKeywords = keywordsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const cleanedDate = sinceDate.trim();
    if (cleanedDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanedDate)) {
      toast("Start date must be YYYY-MM-DD", "error");
      return;
    }
    const res = await apiPut(`/api/courses/${courseId}`, {
      matchPatterns: { senders, subjectKeywords, sinceDate: cleanedDate || undefined },
    });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Match patterns saved");
    setShowPatterns(false);
    reload();
  };

  const refreshFromGmail = async () => {
    setRefreshing(true);
    const res = await apiPost<{ added: number; scanned: number }>("/api/notices/refresh", { courseId });
    setRefreshing(false);
    if (!res.ok) { toast(res.error, "error"); return; }
    const { added, scanned } = res.data;
    toast(added === 0 ? `No new notices (scanned ${scanned})` : `Pulled ${added} new (scanned ${scanned})`);
    if (added > 0) reload();
  };

  const compile = async () => {
    if (selected.size === 0) {
      toast("Select at least one notice to compile", "error");
      return;
    }
    setCompiling(true);
    setCompiled(null);
    const res = await apiPost<{ title: string; body: string; usedCount: number }>(
      "/api/notices/compile",
      { courseId, prompt, noticeIds: Array.from(selected) }
    );
    setCompiling(false);
    if (!res.ok) { toast(res.error, "error"); return; }
    setCompiled({ title: res.data.title, body: res.data.body });
    setEditTitle(res.data.title);
  };

  const saveCompiled = async () => {
    if (!compiled) return;
    const title = (editTitle.trim() || compiled.title).slice(0, 200);
    setSavingCompiled(true);
    const res = await apiPost("/api/saved-notices", {
      courseId,
      title,
      body: compiled.body,
    });
    setSavingCompiled(false);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Saved");
    reload();
  };

  const deleteSaved = async (id: string) => {
    const res = await apiDelete(`/api/saved-notices/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Removed from saved");
    reload();
  };

  const hasPatterns = (course.matchPatterns?.senders?.length || 0) + (course.matchPatterns?.subjectKeywords?.length || 0) > 0;
  const refreshDisabled = !gmailConnected || !hasPatterns || refreshing;
  const refreshTitle = !gmailConnected
    ? "Connect Gmail in Settings first"
    : !hasPatterns
    ? "Set sender/subject match patterns first"
    : "";

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Notice Board</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPatterns(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
          >
            ⚙ Match patterns
          </button>
          <button
            onClick={refreshFromGmail}
            disabled={refreshDisabled}
            title={refreshTitle}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh from Gmail"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            + Add notice
          </button>
        </div>
      </div>

      {savedNotices.length > 0 && (
        <div className="border-b border-border px-5 py-4">
          <button
            onClick={() => setShowSaved((v) => !v)}
            className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted hover:text-foreground"
          >
            <span>{showSaved ? "▾" : "▸"}</span>
            <span>⭐ Saved ({savedNotices.length})</span>
          </button>
          {showSaved && (
            <div className="space-y-2">
              {savedNotices.map((s) => {
                const isOpen = expandedSaved.has(s.id);
                return (
                  <div key={s.id} className="rounded-lg border border-border bg-background">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <button
                        onClick={() => toggleSavedExpand(s.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-xs text-muted">{isOpen ? "▾" : "▸"}</span>
                        <span className="text-sm font-medium">{s.title}</span>
                      </button>
                      <button
                        onClick={() => deleteSaved(s.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border px-3 py-2">
                        <MarkdownRenderer content={s.body} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {notices.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-muted">
          No notices yet. Connect Gmail and set match patterns, or add notices manually.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-5 py-2 text-xs text-muted">
            <span>{selected.size} of {notices.length} selected</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="hover:text-accent">All</button>
              <span>·</span>
              <button onClick={selectNone} className="hover:text-accent">None</button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {notices.map((n) => {
              const isOpen = expandedNotice.has(n.id);
              const isSelected = selected.has(n.id);
              return (
                <div key={n.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(n.id)}
                      className="h-4 w-4 cursor-pointer accent-accent"
                      aria-label={`Include ${noticeLabel(n)} in compile`}
                    />
                    <button
                      onClick={() => toggleNoticeExpand(n.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span className="text-lg" aria-hidden>{SOURCE_ICON[n.source]}</span>
                      <span className="text-xs text-muted w-12 shrink-0">{formatDate(n.date || n.createdAt)}</span>
                      <span className={`text-sm truncate ${isSelected ? "" : "text-muted"}`}>{noticeLabel(n)}</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: "notice", id: n.id, name: noticeLabel(n) })}
                      className="text-xs text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-2 rounded-lg border border-border bg-background px-3 py-2">
                      {n.source === "gmail" && (
                        <div className="text-xs text-muted">
                          <div><span className="font-semibold">From:</span> {n.from}</div>
                          <div><span className="font-semibold">Subject:</span> {n.subject}</div>
                        </div>
                      )}
                      <pre className="whitespace-pre-wrap break-words text-xs text-foreground">{n.rawText}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="space-y-3 border-t border-border px-5 py-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={DEFAULT_PROMPT_PLACEHOLDER}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={compile}
          disabled={compiling || selected.size === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {compiling ? "Compiling..." : `Compile (${selected.size} selected)`}
        </button>

        {compiled && (
          <div className="mt-2 rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="flex-1 min-w-[200px] rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-accent"
              />
              <button
                onClick={saveCompiled}
                disabled={savingCompiled}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {savingCompiled ? "Saving..." : "⭐ Save"}
              </button>
            </div>
            <div className="px-3 py-2">
              <MarkdownRenderer content={compiled.body} />
            </div>
            <p className="border-t border-border px-3 py-2 text-xs text-muted">
              This live output is replaced on the next compile. Save to keep it.
            </p>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add notice">
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste content here (WhatsApp export, email body, plain text)..."
            rows={8}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            disabled={!!uploadFile}
          />
          <div className="text-center text-xs text-muted">— or —</div>
          <input
            type="file"
            accept=".txt,.eml"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            disabled={pasteText.trim().length > 0}
          />
          <button onClick={submitAdd} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            Save
          </button>
        </div>
      </Modal>

      <Modal open={showPatterns} onClose={() => setShowPatterns(false)} title="Match patterns">
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Used by &quot;Refresh from Gmail&quot; to filter messages for this course.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium">Senders (one per line)</label>
            <textarea
              value={sendersText}
              onChange={(e) => setSendersText(e.target.value)}
              placeholder="nalanda@bits-pilani.ac.in&#10;prof.x@bits-pilani.ac.in"
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Subject keywords (one per line)</label>
            <textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="CS F211&#10;F211"
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted">Each line matches if all its words appear anywhere in the subject (any order).</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Start date (optional)</label>
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted">Emails before this date are skipped. Leave blank to use the last 120 days.</p>
          </div>
          <button onClick={savePatterns} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            Save
          </button>
        </div>
      </Modal>
    </section>
  );
}
