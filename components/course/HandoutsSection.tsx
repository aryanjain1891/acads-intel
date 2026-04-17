"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import FilePreview from "@/components/FilePreview";
import { useToast } from "@/components/Toast";
import { apiPut, apiPostForm } from "@/lib/api";
import type { Handout } from "@/lib/types";

type ConfirmDelete = { type: string; id: string; name: string } | null;

export default function HandoutsSection({
  courseId,
  handouts,
  reload,
  setConfirmDelete,
  openPreviews,
  setOpenPreviews,
}: {
  courseId: string;
  handouts: Handout[];
  reload: () => void;
  setConfirmDelete: (v: ConfirmDelete) => void;
  openPreviews: Set<string>;
  setOpenPreviews: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const { toast } = useToast();

  const [showAddHandout, setShowAddHandout] = useState(false);
  const [handoutFile, setHandoutFile] = useState<File | null>(null);
  const [editingHandout, setEditingHandout] = useState<string | null>(null);
  const [editHandoutName, setEditHandoutName] = useState("");

  const addHandout = async () => {
    if (!handoutFile) { toast("Please select a file", "error"); return; }
    const formData = new FormData();
    formData.append("courseId", courseId);
    formData.append("file", handoutFile);
    const res = await apiPostForm("/api/handouts", formData);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Handout uploaded");
    setHandoutFile(null);
    setShowAddHandout(false);
    reload();
  };

  const renameHandout = async (id: string) => {
    if (!editHandoutName.trim()) { toast("Name is required", "error"); return; }
    const res = await apiPut(`/api/handouts/${id}`, { displayName: editHandoutName.trim() });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Handout renamed");
    setEditingHandout(null);
    reload();
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Handouts</h2>
        <button onClick={() => setShowAddHandout(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ Upload</button>
      </div>

      {handouts.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-muted">No handouts uploaded yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {handouts.map((h) => (
            <div key={h.id} className="px-5 py-3">
              {editingHandout === h.id ? (
                <div className="space-y-2">
                  <input
                    value={editHandoutName}
                    onChange={(e) => setEditHandoutName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameHandout(h.id); if (e.key === "Escape") setEditingHandout(null); }}
                    placeholder="Display name"
                    autoFocus
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => renameHandout(h.id)} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover">Save</button>
                    <button onClick={() => setEditingHandout(null)} className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:text-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <div>
                        <p className="text-sm font-medium">{h.displayName || h.filename}</p>
                        {h.displayName && h.displayName !== h.filename && (
                          <p className="text-xs text-muted truncate max-w-md">{h.filename}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`/api/files/${h.path}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">New Tab</a>
                      <button
                        onClick={() => setOpenPreviews((prev) => { const next = new Set(prev); const key = `/api/files/${h.path}`; next.has(key) ? next.delete(key) : next.add(key); return next; })}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${openPreviews.has(`/api/files/${h.path}`) ? "border-accent text-accent" : "border-border text-muted hover:border-accent hover:text-accent"}`}
                      >{openPreviews.has(`/api/files/${h.path}`) ? "Hide" : "Preview"}</button>
                      <button onClick={() => { setEditingHandout(h.id); setEditHandoutName(h.displayName || h.filename); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition-colors">Rename</button>
                      <button onClick={() => setConfirmDelete({ type: "handout", id: h.id, name: h.displayName || h.filename })} className="text-xs text-danger hover:underline">Delete</button>
                    </div>
                  </div>
                  {openPreviews.has(`/api/files/${h.path}`) && (
                    <div className="mt-3 h-[600px] overflow-hidden rounded-lg border border-border">
                      <FilePreview url={`/api/files/${h.path}`} filename={h.path || h.filename} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAddHandout} onClose={() => setShowAddHandout(false)} title="Upload Handout">
        <div className="space-y-3">
          <input type="file" onChange={(e) => setHandoutFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={addHandout} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Upload</button>
        </div>
      </Modal>
    </>
  );
}
