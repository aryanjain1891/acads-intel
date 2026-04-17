"use client";

import { useRef, useState, type ReactNode } from "react";
import Modal from "@/components/Modal";
import PromptButton from "@/components/PromptButton";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ResizablePanel from "@/components/ResizablePanel";
import FilePreview from "@/components/FilePreview";
import { useToast } from "@/components/Toast";
import { apiPost, apiPut, apiPostForm } from "@/lib/api";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableItem from "@/components/SortableItem";
import type { Resource } from "@/lib/types";
import { isPreviewable, isMdFile } from "@/lib/courseHelpers";

type ConfirmDelete = { type: string; id: string; name: string } | null;

export default function ResourcesSection({
  courseId,
  resources,
  setResources,
  persistedFolders,
  explainerStatus,
  generatingExplainer,
  setGeneratingExplainer,
  reload,
  setConfirmDelete,
  openPreviews,
  setOpenPreviews,
  handoutsSlot,
}: {
  courseId: string;
  resources: Resource[];
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
  persistedFolders: string[];
  explainerStatus: Record<string, { hasTranscript: boolean; hasExplainer: boolean; explainerUrl?: string }>;
  generatingExplainer: Set<string>;
  setGeneratingExplainer: React.Dispatch<React.SetStateAction<Set<string>>>;
  reload: () => void;
  setConfirmDelete: (v: ConfirmDelete) => void;
  openPreviews: Set<string>;
  setOpenPreviews: React.Dispatch<React.SetStateAction<Set<string>>>;
  handoutsSlot: ReactNode;
}) {
  const { toast } = useToast();

  const [showAddResource, setShowAddResource] = useState(false);
  const [showAddPYQ, setShowAddPYQ] = useState(false);
  const [pyqFile, setPyqFile] = useState<File | null>(null);
  const [pyqTitle, setPyqTitle] = useState("");
  const [pyqSolutionStatus, setPyqSolutionStatus] = useState<"included" | "separate" | "unavailable">("unavailable");
  const [pyqSolutionFile, setPyqSolutionFile] = useState<File | null>(null);
  const [showPracticePlan, setShowPracticePlan] = useState(false);

  const [resourceType, setResourceType] = useState<"link" | "file">("link");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({ title: "", url: "" });

  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkTitles, setBulkTitles] = useState<string[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const foldersInitialized = useRef(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [mdPreviews, setMdPreviews] = useState<Record<string, string>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const addResource = async () => {
    if (!resourceTitle.trim()) { toast("Title is required", "error"); return; }
    if (resourceType === "link" && !resourceUrl.trim()) { toast("URL is required", "error"); return; }
    if (resourceType === "file" && !resourceFile) { toast("Please select a file", "error"); return; }
    const folderSelect = document.getElementById("resource-folder-select") as HTMLSelectElement | null;
    const folder = folderSelect?.value || "";
    const formData = new FormData();
    formData.append("courseId", courseId);
    formData.append("title", resourceTitle);
    formData.append("type", resourceType);
    if (folder) formData.append("folder", folder);
    if (resourceType === "link") {
      formData.append("url", resourceUrl);
    } else if (resourceFile) {
      formData.append("file", resourceFile);
    }
    const res = await apiPostForm("/api/resources", formData);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Resource added");
    setResourceTitle("");
    setResourceUrl("");
    setResourceFile(null);
    setShowAddResource(false);
    reload();
  };

  const addPYQ = async () => {
    if (!pyqTitle.trim()) { toast("Title is required", "error"); return; }
    if (!pyqFile) { toast("Please select a file", "error"); return; }
    if (pyqSolutionStatus === "separate" && !pyqSolutionFile) { toast("Please select a solution file", "error"); return; }

    let solutionId = "";

    if (pyqSolutionStatus === "separate" && pyqSolutionFile) {
      const solForm = new FormData();
      solForm.append("courseId", courseId);
      solForm.append("title", `${pyqTitle.trim()} - Solution`);
      solForm.append("type", "file");
      solForm.append("file", pyqSolutionFile);
      solForm.append("isPYQ", "true");
      solForm.append("isSolution", "true");
      const solRes = await apiPostForm<{ id: string }>("/api/resources", solForm);
      if (!solRes.ok) { toast("Failed to upload solution file", "error"); return; }
      solutionId = solRes.data.id;
    }

    const formData = new FormData();
    formData.append("courseId", courseId);
    formData.append("title", pyqTitle);
    formData.append("type", "file");
    formData.append("file", pyqFile);
    formData.append("isPYQ", "true");
    formData.append("solutionStatus", pyqSolutionStatus);
    if (solutionId) formData.append("solutionId", solutionId);
    const res = await apiPostForm("/api/resources", formData);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("PYQ added");
    setPyqTitle("");
    setPyqFile(null);
    setPyqSolutionStatus("unavailable");
    setPyqSolutionFile(null);
    setShowAddPYQ(false);
    reload();
  };

  const updatePYQSolution = async (id: string, status: Resource["solutionStatus"], solutionId?: string) => {
    const payload: Record<string, unknown> = { solutionStatus: status };
    if (status === "separate" && solutionId) payload.solutionId = solutionId;
    else payload.solutionId = "";
    const res = await apiPut(`/api/resources/${id}`, payload);
    if (!res.ok) { toast(res.error, "error"); return; }
    reload();
  };

  const updateResource = async (id: string) => {
    if (!editResourceForm.title.trim()) { toast("Title is required", "error"); return; }
    const target = resources.find((r) => r.id === id);
    const payload = target?.type === "file" ? { title: editResourceForm.title } : editResourceForm;
    const res = await apiPut(`/api/resources/${id}`, payload);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Resource updated");
    setEditingResource(null);
    reload();
  };

  const triggerDeepExplain = async (r: Resource) => {
    setGeneratingExplainer((prev) => { const next = new Set(prev); next.add(r.id); return next; });
    try {
      const res = await fetch("/api/deep-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: r.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to generate", "error"); return; }
      if (data.alreadyExists) { toast("Deep explainer already exists"); }
      else { toast("Deep explainer generated!"); }
      reload();
    } catch { toast("Failed to generate deep explainer", "error"); }
    finally { setGeneratingExplainer((prev) => { const next = new Set(prev); next.delete(r.id); return next; }); }
  };

  const bulkUploadResources = async () => {
    if (bulkFiles.length === 0) { toast("Select files first", "error"); return; }
    const formData = new FormData();
    formData.append("courseId", courseId);
    formData.append("type", "file");
    for (let i = 0; i < bulkFiles.length; i++) {
      formData.append("file", bulkFiles[i]);
      formData.append("title", bulkTitles[i] || bulkFiles[i].name);
    }
    const res = await apiPostForm("/api/resources", formData);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast(`${bulkFiles.length} resource(s) uploaded`);
    setBulkFiles([]);
    setBulkTitles([]);
    setShowBulkUpload(false);
    reload();
  };

  const toggleMdPreview = async (fileUrl: string) => {
    const key = `/api/files/${fileUrl}`;
    setOpenPreviews((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    if (!mdPreviews[key]) {
      try {
        const res = await fetch(key);
        const text = await res.text();
        setMdPreviews((prev) => ({ ...prev, [key]: text }));
      } catch {}
    }
  };

  const pyqs = resources.filter((r) => r.isPYQ && !r.isSolution).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  const nonPyqResources = resources.filter((r) => !r.isPYQ);

  const resourceFolders = (() => {
    const folders = new Set<string>();
    nonPyqResources.forEach((r) => { if (r.folder) folders.add(r.folder); });
    persistedFolders.forEach((f) => folders.add(f));
    return Array.from(folders).sort();
  })();

  if (!foldersInitialized.current && resourceFolders.length > 0) {
    foldersInitialized.current = true;
    setCollapsedFolders(new Set(resourceFolders));
  }

  const sortedResources = [...nonPyqResources].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const resourcesByFolder = (() => {
    const map: Record<string, Resource[]> = { "": [] };
    resourceFolders.forEach((f) => { map[f] = []; });
    sortedResources.forEach((r) => {
      const f = r.folder || "";
      if (!map[f]) map[f] = [];
      map[f].push(r);
    });
    return map;
  })();

  const toggleResourceSelect = (id: string) => {
    setSelectedResources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const moveSelectedToFolder = async (folder: string) => {
    const cleanFolder = folder.trim();
    const ids = Array.from(selectedResources);
    if (ids.length === 0) return;
    if (cleanFolder && !resourceFolders.includes(cleanFolder)) {
      await apiPost("/api/resource-folders", { courseId, name: cleanFolder });
    }
    const res = await apiPut("/api/resources/bulk-update", {
      updates: ids.map((id) => ({ id, folder: cleanFolder })),
    });
    if (!res.ok) { toast(res.error, "error"); return; }
    setSelectedResources(new Set());
    toast(`Moved ${ids.length} resource(s)`);
    reload();
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) { toast("Folder name is required", "error"); return; }
    const name = newFolderName.trim();
    await apiPost("/api/resource-folders", { courseId, name });
    if (selectedResources.size > 0) {
      await moveSelectedToFolder(name);
    } else {
      toast(`Folder "${name}" created`);
      reload();
    }
    setShowNewFolder(false);
    setNewFolderName("");
  };

  const handleResourceDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedResources.findIndex((r) => r.id === active.id);
    const newIndex = sortedResources.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const targetResource = sortedResources[newIndex];
    const draggedResource = sortedResources[oldIndex];
    const reordered = arrayMove(sortedResources, oldIndex, newIndex);
    const folderChanged = (draggedResource.folder || "") !== (targetResource.folder || "");
    if (folderChanged) {
      reordered[newIndex] = { ...reordered[newIndex], folder: targetResource.folder || "" };
    }
    const updated = reordered.map((r, i) => ({ ...r, order: i }));
    const pyqResources = resources.filter((r) => r.isPYQ);
    setResources([...updated, ...pyqResources]);
    if (folderChanged) {
      await apiPut(`/api/resources/${active.id}`, { folder: targetResource.folder || "" });
    }
    await apiPut("/api/resources/reorder", { orderedIds: updated.map((r) => r.id) });
  };

  return (
    <>
      <section className="rounded-xl border border-border bg-surface">
        {/* Resources header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Resources</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowNewFolder(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">+ Folder</button>
            <button onClick={() => setShowBulkUpload(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">Bulk Upload</button>
            <button onClick={() => setShowAddResource(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ Add Resource</button>
          </div>
        </div>

        {/* Multi-select action bar */}
        {selectedResources.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent/5 px-5 py-2.5">
            <span className="text-xs font-medium text-accent">{selectedResources.size} selected</span>
            <span className="text-xs text-muted">→</span>
            {resourceFolders.map((f) => (
              <button key={f} onClick={() => moveSelectedToFolder(f)} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:border-accent hover:text-accent transition-colors">{f}</button>
            ))}
            <button onClick={() => moveSelectedToFolder("")} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:border-accent hover:text-accent transition-colors">Uncategorized</button>
            <button onClick={() => setShowNewFolder(true)} className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition-colors">+ New folder</button>
            <button onClick={() => setSelectedResources(new Set())} className="ml-auto text-xs text-muted hover:text-foreground">Clear</button>
          </div>
        )}

        {resources.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-muted">No resources yet. Add links or upload files.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleResourceDragEnd}>
            <SortableContext items={sortedResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {Object.entries(resourcesByFolder).map(([folder, items]) => {
                if (items.length === 0 && !folder) return null;
                return (
                  <div key={folder || "__root__"}>
                    {folder && (
                      <button
                        onClick={() => setCollapsedFolders((prev) => {
                          const next = new Set(prev);
                          next.has(folder) ? next.delete(folder) : next.add(folder);
                          return next;
                        })}
                        className="flex w-full items-center gap-2 border-b border-border bg-background/50 px-5 py-2 text-left hover:bg-surface-hover transition-colors"
                      >
                        <span className={`text-[10px] text-muted transition-transform ${collapsedFolders.has(folder) ? "" : "rotate-90"}`}>▶</span>
                        <span className="text-xs">📁</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{folder}</span>
                        <span className="text-[10px] text-muted">({items.length})</span>
                      </button>
                    )}
                    {!collapsedFolders.has(folder) && (items.length === 0 ? (
                      <div className="px-5 py-3 text-center text-xs text-muted italic">Empty folder — select resources and move them here</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {items.map((r) => (
                          <SortableItem key={r.id} id={r.id}>
                            <div className={`px-5 py-3 ${selectedResources.has(r.id) ? "bg-accent/5" : ""}`}>
                              {editingResource === r.id ? (
                                <div className="space-y-2">
                                  <input key="edit-title" value={editResourceForm.title} onChange={(e) => setEditResourceForm((f) => ({ ...f, title: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") updateResource(r.id); if (e.key === "Escape") setEditingResource(null); }} placeholder="Title" autoFocus className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent" />
                                  {r.type === "link" && (
                                    <input key="edit-url" value={editResourceForm.url} onChange={(e) => setEditResourceForm((f) => ({ ...f, url: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") updateResource(r.id); if (e.key === "Escape") setEditingResource(null); }} placeholder="URL" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent" />
                                  )}
                                  <div className="flex gap-2">
                                    <button onClick={() => updateResource(r.id)} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover">Save</button>
                                    <button onClick={() => setEditingResource(null)} className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:text-foreground">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <input type="checkbox" checked={selectedResources.has(r.id)} onChange={() => toggleResourceSelect(r.id)} className="h-3.5 w-3.5 shrink-0 rounded border-border accent-accent" />
                                      <span className="text-lg">{r.type === "link" ? "🔗" : "📄"}</span>
                                      <div>
                                        <p className="text-sm font-medium">{r.title}</p>
                                        {r.type === "link" && <p className="text-xs text-muted truncate max-w-md">{r.url}</p>}
                                        {r.type === "file" && <p className="text-xs text-muted">{r.fileType} file</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {r.type === "link" ? (
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">Open</a>
                                      ) : (
                                        <>
                                          <a href={`/api/files/${r.url}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">New Tab</a>
                                          {isPreviewable(r.fileType, r.url) && (
                                            <button
                                              onClick={() => isMdFile(r.url) ? toggleMdPreview(r.url) : setOpenPreviews((prev) => { const next = new Set(prev); const key = `/api/files/${r.url}`; next.has(key) ? next.delete(key) : next.add(key); return next; })}
                                              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${openPreviews.has(`/api/files/${r.url}`) ? "border-accent text-accent" : "border-border text-muted hover:border-accent hover:text-accent"}`}
                                            >{openPreviews.has(`/api/files/${r.url}`) ? "Hide" : "Preview"}</button>
                                          )}
                                        </>
                                      )}
                                      {explainerStatus[r.id]?.hasExplainer ? (
                                        <button
                                          onClick={() => toggleMdPreview(explainerStatus[r.id]!.explainerUrl!)}
                                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${openPreviews.has(`/api/files/${explainerStatus[r.id]?.explainerUrl}`) ? "border-green-600 text-green-600 bg-green-500/20" : "border-green-600/30 bg-green-500/10 text-green-600 hover:bg-green-500/20"}`}
                                        >{openPreviews.has(`/api/files/${explainerStatus[r.id]?.explainerUrl}`) ? "Hide Explainer" : "✓ Explainer"}</button>
                                      ) : explainerStatus[r.id]?.hasTranscript ? (
                                        <button
                                          onClick={() => triggerDeepExplain(r)}
                                          disabled={generatingExplainer.has(r.id)}
                                          className="rounded-md border border-purple-600/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >{generatingExplainer.has(r.id) ? (
                                          <span className="flex items-center gap-1.5">
                                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                                            Generating...
                                          </span>
                                        ) : "Deep Explain"}</button>
                                      ) : null}
                                      <button onClick={() => { setEditingResource(r.id); setEditResourceForm({ title: r.title, url: r.url || "" }); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition-colors">Rename</button>
                                      <button onClick={() => setConfirmDelete({ type: "resource", id: r.id, name: r.title })} className="text-xs text-danger hover:underline">Delete</button>
                                    </div>
                                  </div>
                                  {openPreviews.has(`/api/files/${r.url}`) && (
                                    <ResizablePanel defaultHeight={r.fileType?.startsWith("image/") ? 400 : 600} className="mt-3 rounded-lg border border-border overflow-hidden">
                                      <FilePreview url={`/api/files/${r.url}`} fileType={r.fileType} filename={r.url || r.title} />

                                    </ResizablePanel>
                                  )}
                                  {(() => {
                                    const explainerUrl = explainerStatus[r.id]?.explainerUrl;
                                    const explainerKey = explainerUrl ? `/api/files/${explainerUrl}` : null;
                                    if (!explainerKey || !openPreviews.has(explainerKey)) return null;
                                    return (
                                      <div className="mt-3 overflow-hidden rounded-lg border border-green-600/30">
                                        <div className="border-b border-green-600/20 bg-green-500/5 px-4 py-2 text-xs font-semibold text-green-600 uppercase tracking-wider">Deep Explainer</div>
                                        <ResizablePanel defaultHeight={600}>
                                          <div className="bg-background px-6 py-5">
                                            <MarkdownRenderer content={mdPreviews[explainerKey] || "Loading..."} />
                                          </div>
                                        </ResizablePanel>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </SortableItem>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
        )}

        {/* Divider */}
        <div className="mx-5 border-t border-dashed border-border" />

        {/* PYQ sub-section */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Previous Year Questions</h2>
          <button onClick={() => setShowAddPYQ(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ Add PYQ</button>
        </div>

        {pyqs.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border">
            <PromptButton
              label="Solve PYQ"
              icon="✍️"
              prompt={`I'll attach my past-year question papers and module notes. Please solve the questions using concepts from the notes — show step-by-step solutions.`}
              small
            />
            <PromptButton
              label="PYQ Practice Plan"
              icon="📋"
              prompt={`I'll attach my past-year question papers and module notes. Please create a PYQ practice plan — list the papers, which have solutions available, and suggest a day-by-day study schedule using the notes.`}
              small
            />
          </div>
        )}

        {pyqs.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-muted">No PYQs added yet. Upload past question papers to get started.</div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {pyqs.map((p) => {
                const linkedSolution = p.solutionStatus === "separate" && p.solutionId
                  ? resources.find((r) => r.id === p.solutionId)
                  : null;
                return (
                  <div key={p.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📝</span>
                        <div>
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-muted">{p.fileType} file</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Solution badge */}
                        {p.solutionStatus === "included" && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">Solution included</span>
                        )}
                        {p.solutionStatus === "separate" && linkedSolution && (
                          <a href={`/api/files/${linkedSolution.url}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:underline">
                            Solution: {linkedSolution.title} ↗
                          </a>
                        )}
                        {p.solutionStatus === "separate" && !linkedSolution && (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-600">Solution missing</span>
                        )}
                        {(!p.solutionStatus || p.solutionStatus === "unavailable") && (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-600">No solution</span>
                        )}

                        {/* Solution status dropdown */}
                        <select
                          value={p.solutionStatus || "unavailable"}
                          onChange={async (e) => {
                            const val = e.target.value as Resource["solutionStatus"];
                            if (val === "separate") {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".pdf,.doc,.docx,.ppt,.pptx";
                              input.onchange = async () => {
                                const file = input.files?.[0];
                                if (!file) return;
                                const solForm = new FormData();
                                solForm.append("courseId", courseId);
                                solForm.append("title", `${p.title} - Solution`);
                                solForm.append("type", "file");
                                solForm.append("file", file);
                                solForm.append("isPYQ", "true");
                                solForm.append("isSolution", "true");
                                const solRes = await apiPostForm<{ id: string }>("/api/resources", solForm);
                                if (!solRes.ok) { toast("Failed to upload solution", "error"); return; }
                                await updatePYQSolution(p.id, "separate", solRes.data.id);
                              };
                              input.click();
                            } else {
                              updatePYQSolution(p.id, val);
                            }
                          }}
                          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] outline-none focus:border-accent"
                        >
                          <option value="unavailable">No solution</option>
                          <option value="included">Solution included</option>
                          <option value="separate">Upload solution...</option>
                        </select>

                        <a href={`/api/files/${p.url}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">Open</a>
                        {isPreviewable(p.fileType, p.url) && (
                          <button
                            onClick={() => setOpenPreviews((prev) => { const next = new Set(prev); const key = `/api/files/${p.url}`; next.has(key) ? next.delete(key) : next.add(key); return next; })}
                            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${openPreviews.has(`/api/files/${p.url}`) ? "border-accent text-accent" : "border-border text-muted hover:border-accent hover:text-accent"}`}
                          >{openPreviews.has(`/api/files/${p.url}`) ? "Hide" : "Preview"}</button>
                        )}
                        <button onClick={() => { setEditingResource(p.id); setEditResourceForm({ title: p.title, url: p.url || "" }); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition-colors">Rename</button>
                        <button onClick={() => setConfirmDelete({ type: "resource", id: p.id, name: p.title })} className="text-xs text-danger hover:underline">Delete</button>
                      </div>
                    </div>
                    {editingResource === p.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input value={editResourceForm.title} onChange={(e) => setEditResourceForm((f) => ({ ...f, title: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") updateResource(p.id); if (e.key === "Escape") setEditingResource(null); }} placeholder="Title" autoFocus className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent" />
                        <button onClick={() => updateResource(p.id)} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover">Save</button>
                        <button onClick={() => setEditingResource(null)} className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:text-foreground">Cancel</button>
                      </div>
                    )}
                    {openPreviews.has(`/api/files/${p.url}`) && (
                      <div className="mt-3 h-[600px] overflow-hidden rounded-lg border border-border">
                        <FilePreview url={`/api/files/${p.url}`} filename={p.url || p.title} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Practice plan */}
            <div className="border-t border-border">
              <button
                onClick={() => setShowPracticePlan((v) => !v)}
                className="flex w-full items-center gap-2 px-5 py-3 text-left hover:bg-surface-hover transition-colors"
              >
                <span className={`text-[10px] text-muted transition-transform ${showPracticePlan ? "rotate-90" : ""}`}>▶</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Practice Plan</span>
              </button>
              {showPracticePlan && (
                <div className="px-5 pb-4">
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-foreground">
                    {pyqs.map((p) => {
                      const linked = p.solutionStatus === "separate" && p.solutionId
                        ? resources.find((r) => r.id === p.solutionId)
                        : null;
                      return (
                        <li key={p.id}>
                          <span className="font-medium">{p.title}</span>
                          {p.solutionStatus === "included" && (
                            <span className="text-muted"> — solve, then check embedded solution, note weak topics</span>
                          )}
                          {p.solutionStatus === "separate" && linked && (
                            <span className="text-muted"> — solve, then refer to <span className="font-medium text-foreground">{linked.title}</span>, revise gaps</span>
                          )}
                          {(!p.solutionStatus || p.solutionStatus === "unavailable") && (
                            <span className="text-muted"> — attempt, then use module notes to self-check</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </>
        )}

        {/* Divider between PYQs and handouts */}
        <div className="mx-5 border-t border-dashed border-border" />

        {handoutsSlot}
      </section>

      <Modal open={showAddResource} onClose={() => setShowAddResource(false)} title="Add Resource">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setResourceType("link")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${resourceType === "link" ? "bg-accent text-white" : "border border-border hover:bg-surface-hover"}`}>Link</button>
            <button onClick={() => setResourceType("file")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${resourceType === "file" ? "bg-accent text-white" : "border border-border hover:bg-surface-hover"}`}>File</button>
          </div>
          <input placeholder="Title" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          {resourceType === "link" ? (
            <input key="link-url" placeholder="URL" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          ) : (
            <input key="file-upload" type="file" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          )}
          {resourceFolders.length > 0 && (
            <select id="resource-folder-select" defaultValue="" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
              <option value="">No folder</option>
              {resourceFolders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <button onClick={addResource} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Resource</button>
        </div>
      </Modal>

      <Modal open={showAddPYQ} onClose={() => { setShowAddPYQ(false); setPyqFile(null); setPyqTitle(""); setPyqSolutionStatus("unavailable"); setPyqSolutionFile(null); }} title="Add PYQ">
        <div className="space-y-3">
          <input placeholder="Title (e.g. Mid-Sem 2024)" value={pyqTitle} onChange={(e) => setPyqTitle(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Question paper</label>
            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={(e) => setPyqFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Solution availability</label>
            <select value={pyqSolutionStatus} onChange={(e) => setPyqSolutionStatus(e.target.value as "included" | "separate" | "unavailable")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
              <option value="unavailable">No solution available</option>
              <option value="included">Solution included in this PDF</option>
              <option value="separate">Solution in a separate file</option>
            </select>
          </div>
          {pyqSolutionStatus === "separate" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Solution file</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={(e) => setPyqSolutionFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          )}
          <button onClick={addPYQ} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add PYQ</button>
        </div>
      </Modal>

      <Modal open={showBulkUpload} onClose={() => { setShowBulkUpload(false); setBulkFiles([]); setBulkTitles([]); }} title="Bulk Upload Resources">
        <div className="space-y-4">
          <input
            type="file"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setBulkFiles(files);
              setBulkTitles(files.map((f) => f.name.replace(/\.[^/.]+$/, "")));
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {bulkFiles.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              <p className="text-xs font-medium text-muted">{bulkFiles.length} file(s) selected — edit titles below:</p>
              {bulkFiles.map((f, i) => (
                <div key={f.name + i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-muted">{i + 1}</span>
                  <input
                    value={bulkTitles[i] || ""}
                    onChange={(e) => setBulkTitles((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
                    placeholder={f.name}
                  />
                  <span className="shrink-0 text-[10px] text-muted">{f.name.split(".").pop()}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={bulkUploadResources} disabled={bulkFiles.length === 0} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40">Upload {bulkFiles.length > 0 ? `${bulkFiles.length} File(s)` : ""}</button>
        </div>
      </Modal>

      <Modal open={showNewFolder} onClose={() => { setShowNewFolder(false); setNewFolderName(""); }} title="New Folder">
        <div className="space-y-3">
          <input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {selectedResources.size > 0 && (
            <p className="text-xs text-muted">{selectedResources.size} selected resource(s) will be moved into this folder.</p>
          )}
          <button onClick={createFolder} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            {selectedResources.size > 0 ? `Create & Move ${selectedResources.size} Item(s)` : "Create Folder"}
          </button>
        </div>
      </Modal>
    </>
  );
}
