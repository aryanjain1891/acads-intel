"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import PromptButton from "@/components/PromptButton";
import { useToast } from "@/components/Toast";
import { apiPost, apiPut, apiDelete, apiPostForm } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ResizablePanel from "@/components/ResizablePanel";
import FilePreview from "@/components/FilePreview";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableItem from "@/components/SortableItem";
import type { Course, Exam, EvalComponent, Resource, Handout, Deadline } from "@/lib/types";

export default function CourseDetail({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [scores, setScores] = useState<EvalComponent[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [plan, setPlan] = useState("");
  const [planDraft, setPlanDraft] = useState("");
  const [planEditing, setPlanEditing] = useState(false);
  const [assignments, setAssignments] = useState<string[]>([]);

  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddScore, setShowAddScore] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showAddPYQ, setShowAddPYQ] = useState(false);
  const [showAddHandout, setShowAddHandout] = useState(false);
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [pyqFile, setPyqFile] = useState<File | null>(null);
  const [pyqTitle, setPyqTitle] = useState("");
  const [pyqSolutionStatus, setPyqSolutionStatus] = useState<"included" | "separate" | "unavailable">("unavailable");
  const [pyqSolutionFile, setPyqSolutionFile] = useState<File | null>(null);
  const [showPracticePlan, setShowPracticePlan] = useState(false);

  const [examForm, setExamForm] = useState({ type: "", title: "", date: "", syllabus: "" });
  const [scoreForm, setScoreForm] = useState({ name: "", weightage: 0, maxMarks: "", obtained: "" });
  const [resourceType, setResourceType] = useState<"link" | "file">("link");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [handoutFile, setHandoutFile] = useState<File | null>(null);
  const [deadlineForm, setDeadlineForm] = useState({ title: "", date: "", type: "assignment" as Deadline["type"] });
  const [assignmentSlug, setAssignmentSlug] = useState("");

  const [editingExam, setEditingExam] = useState<string | null>(null);
  const [editExamForm, setEditExamForm] = useState({ type: "", title: "", date: "", syllabus: "" });
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({ title: "", url: "" });
  const [editingHandout, setEditingHandout] = useState<string | null>(null);
  const [editHandoutName, setEditHandoutName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [showAssignments, setShowAssignments] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`show-assignments-${courseId}`);
      return stored === null ? true : stored === "true";
    }
    return true;
  });
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkTitles, setBulkTitles] = useState<string[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const foldersInitialized = useRef(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [persistedFolders, setPersistedFolders] = useState<string[]>([]);
  const [generatingExplainer, setGeneratingExplainer] = useState<Set<string>>(new Set());
  const [explainerStatus, setExplainerStatus] = useState<Record<string, { hasTranscript: boolean; hasExplainer: boolean; explainerUrl?: string }>>({});
  const [mdPreviews, setMdPreviews] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const scoreTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localScoreEdits, setLocalScoreEdits] = useState<Record<string, string>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const reload = useCallback(() => {
    fetch(`/api/courses`).then((r) => r.json()).then((all: Course[]) => {
      setCourse(all.find((c) => c.id === courseId) || null);
    }).catch(() => {});
    fetch(`/api/exams?courseId=${courseId}`).then((r) => r.json()).then(setExams).catch(() => {});
    fetch(`/api/scores?courseId=${courseId}`).then((r) => r.json()).then(setScores).catch(() => {});
    fetch(`/api/resources?courseId=${courseId}`).then((r) => r.json()).then(setResources).catch(() => {});
    fetch(`/api/resource-folders?courseId=${courseId}`).then((r) => r.json()).then((data: { name: string }[]) => setPersistedFolders(data.map((f) => f.name))).catch(() => {});
    fetch(`/api/handouts?courseId=${courseId}`).then((r) => r.json()).then(setHandouts).catch(() => {});
    fetch(`/api/deadlines?courseId=${courseId}`).then((r) => r.json()).then(setDeadlines).catch(() => {});
    fetch(`/api/plans/${courseId}`).then((r) => r.json()).then((d: { content: string; path?: string }) => {
      setPlan(d.content);
      setPlanDraft(d.content);
    }).catch(() => {});
    fetch(`/api/assignments/${courseId}`).then((r) => r.json()).then((d: { assignments: string[]; basePath: string; projectPath: string }) => {
      setAssignments(d.assignments);
    }).catch(() => {});
    fetch(`/api/deep-explain/status?courseId=${courseId}`).then((r) => r.json()).then(setExplainerStatus).catch(() => {});
  }, [courseId]);

  const refreshExplainerStatus = useCallback((signal?: AbortSignal) => {
    fetch(`/api/deep-explain/status?courseId=${courseId}`, { signal })
      .then((r) => r.json())
      .then((data) => {
        if (!signal?.aborted) setExplainerStatus(data);
      })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => { reload(); }, [reload]);

  // Auto-poll: while any PDF resource lacks a transcript, refetch status periodically.
  // AbortController prevents setState-after-unmount and cancels in-flight fetches
  // when the user navigates away or the deps change.
  useEffect(() => {
    const pdfResources = resources.filter((r) => r.type === "file" && r.url.endsWith(".pdf"));
    const missingTranscript = pdfResources.filter((r) => !explainerStatus[r.id]?.hasTranscript);
    if (missingTranscript.length === 0) return;
    const controller = new AbortController();
    const interval = setInterval(() => refreshExplainerStatus(controller.signal), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [resources, explainerStatus, refreshExplainerStatus]);

  if (!course) {
    return <div className="py-20 text-center text-muted">Loading course...</div>;
  }

  // --- handlers ---

  const addExam = async () => {
    if (!examForm.title.trim()) { toast("Title is required", "error"); return; }
    const res = await apiPost("/api/exams", { ...examForm, courseId });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Exam added");
    setExamForm({ type: "", title: "", date: "", syllabus: "" });
    setShowAddExam(false);
    reload();
  };

  const updateExam = async (id: string) => {
    const res = await apiPut(`/api/exams/${id}`, editExamForm);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Exam updated");
    setEditingExam(null);
    reload();
  };

  const doDeleteExam = async (id: string) => {
    const res = await apiDelete(`/api/exams/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Exam deleted");
    reload();
  };

  const addScore = async () => {
    if (!scoreForm.name.trim()) { toast("Component name is required", "error"); return; }
    if (!scoreForm.weightage || scoreForm.weightage <= 0) { toast("Weightage must be greater than 0", "error"); return; }
    const rawMax = String(scoreForm.maxMarks ?? "").trim();
    const rawObtained = String(scoreForm.obtained ?? "").trim();
    const maxMarks = rawMax === "" ? null : Number(rawMax);
    const obtained = rawObtained === "" ? null : Number(rawObtained);
    if (maxMarks !== null && (!Number.isFinite(maxMarks) || maxMarks <= 0)) {
      toast("Max marks must be a positive number", "error");
      return;
    }
    if (obtained !== null && !Number.isFinite(obtained)) {
      toast("Obtained must be a number", "error");
      return;
    }
    if (obtained !== null && maxMarks !== null && obtained > maxMarks) {
      toast("Obtained cannot exceed max marks", "error");
      return;
    }
    const res = await apiPost("/api/scores", {
      courseId,
      name: scoreForm.name,
      weightage: scoreForm.weightage,
      maxMarks,
      obtained,
    });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Component added");
    setScoreForm({ name: "", weightage: 0, maxMarks: "", obtained: "" });
    setShowAddScore(false);
    reload();
  };

  const updateScore = (id: string, field: string, value: string) => {
    const key = `${id}_${field}`;
    setLocalScoreEdits((prev) => ({ ...prev, [key]: value }));
    if (scoreTimers.current[key]) clearTimeout(scoreTimers.current[key]);
    scoreTimers.current[key] = setTimeout(async () => {
      const val = value === "" ? null : Number(value);
      const res = await apiPut(`/api/scores/${id}`, { [field]: val });
      if (!res.ok) toast(res.error, "error");
      else {
        setLocalScoreEdits((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        reload();
      }
    }, 600);
  };

  const getScoreValue = (id: string, field: string, stateVal: number | null) => {
    const key = `${id}_${field}`;
    if (key in localScoreEdits) return localScoreEdits[key];
    return stateVal ?? "";
  };

  const doDeleteScore = async (id: string) => {
    const res = await apiDelete(`/api/scores/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Component deleted");
    reload();
  };

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

  const doDeleteResource = async (id: string) => {
    const res = await apiDelete(`/api/resources/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Resource deleted");
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

  const doDeleteHandout = async (id: string) => {
    const res = await apiDelete(`/api/handouts/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Handout deleted");
    reload();
  };

  const savePlan = async () => {
    const res = await apiPut(`/api/plans/${courseId}`, { content: planDraft });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Plan saved");
    setPlan(planDraft);
    setPlanEditing(false);
    reload();
  };

  const addDeadline = async () => {
    if (!deadlineForm.title.trim()) { toast("Title is required", "error"); return; }
    const res = await apiPost("/api/deadlines", { ...deadlineForm, courseId, done: false });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Deadline added");
    setDeadlineForm({ title: "", date: "", type: "assignment" });
    setShowAddDeadline(false);
    reload();
  };

  const toggleDeadline = async (d: Deadline) => {
    const res = await apiPut(`/api/deadlines/${d.id}`, { done: !d.done });
    if (!res.ok) { toast(res.error, "error"); return; }
    reload();
  };

  const doDeleteDeadline = async (id: string) => {
    const res = await apiDelete(`/api/deadlines/${id}`);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Deadline deleted");
    reload();
  };

  const addAssignment = async () => {
    if (!assignmentSlug.trim()) { toast("Assignment name is required", "error"); return; }
    const res = await apiPost(`/api/assignments/${courseId}`, { slug: assignmentSlug });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Assignment created");
    setAssignmentSlug("");
    setShowAddAssignment(false);
    reload();
  };

  const toggleAssignmentsSection = () => {
    const next = !showAssignments;
    setShowAssignments(next);
    localStorage.setItem(`show-assignments-${courseId}`, String(next));
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

  const isPreviewable = (fileType: string | null, url: string) => {
    if (!fileType && !url) return false;
    const ft = (fileType || "").toLowerCase();
    const ext = url.split(".").pop()?.toLowerCase() || "";
    return ft.startsWith("image/") || ft === "application/pdf" || ["pdf", "jpg", "jpeg", "png", "gif", "webp", "md"].includes(ext);
  };

  const isMdFile = (url: string) => url.split(".").pop()?.toLowerCase() === "md";

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

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    if (type === "exam") doDeleteExam(id);
    else if (type === "score") doDeleteScore(id);
    else if (type === "resource") doDeleteResource(id);
    else if (type === "handout") doDeleteHandout(id);
    else if (type === "deadline") doDeleteDeadline(id);
  };

  const doneScores = scores.filter(
    (s) => s.obtained !== null && s.maxMarks !== null && s.maxMarks > 0
  );
  const weightedTotal = doneScores.reduce((a, s) => {
    const max = s.maxMarks ?? 0;
    const got = s.obtained ?? 0;
    return max > 0 ? a + (got / max) * s.weightage : a;
  }, 0);
  const completedWeight = doneScores.reduce((a, s) => a + s.weightage, 0);
  const totalWeight = scores.reduce((a, s) => a + s.weightage, 0);

  return (
    <div className="space-y-8">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{course.code}</span>
            <span className="text-xs text-muted">{course.credits} credits</span>
          </div>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <p className="text-sm text-muted">{course.instructor}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PromptButton
            label="Ask about notes"
            icon="💬"
            prompt={`I'll attach my course transcripts. Please answer this question using them: `}
            small
          />
          <PromptButton
            label="Summarize modules"
            icon="📝"
            prompt={`I'll attach my course module notes. Please summarize the key concepts from all the modules.`}
            small
          />
          <PromptButton
            label="Exam prep"
            icon="📖"
            prompt={`I'll attach my course module notes. Please help me prepare for my upcoming exam — list important topics, formulas, and concepts to review.`}
            small
          />
          <PromptButton
            label="Deep Explain"
            icon="🧠"
            prompt={`I'll attach a lecture transcript. Please create a comprehensive deep explanation. Start from the beginning and explain every concept in depth. Include a notation/abbreviation table, numbered "Part N:" sections, step-by-step walkthroughs of every example, and "Feel:" callouts with intuitive analogies. Cover everything — do not skip or summarize any topic.`}
            small
          />
        </div>
      </div>

      {/* ===== EXAMS & DEADLINES ===== */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Exams & Deadlines</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddDeadline(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">+ Deadline</button>
            <button onClick={() => setShowAddExam(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ Exam</button>
          </div>
        </div>

        {exams.length === 0 && deadlines.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">No exams or deadlines added yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Syllabus / Notes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  {editingExam === e.id ? (
                    <>
                      <td className="px-5 py-2"><input value={editExamForm.type} onChange={(ev) => setEditExamForm((f) => ({ ...f, type: ev.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></td>
                      <td className="px-5 py-2"><input value={editExamForm.title} onChange={(ev) => setEditExamForm((f) => ({ ...f, title: ev.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></td>
                      <td className="px-5 py-2"><input type="date" value={editExamForm.date} onChange={(ev) => setEditExamForm((f) => ({ ...f, date: ev.target.value }))} className="rounded border border-border bg-background px-2 py-1 text-xs" /></td>
                      <td className="px-5 py-2"><input value={editExamForm.syllabus} onChange={(ev) => setEditExamForm((f) => ({ ...f, syllabus: ev.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></td>
                      <td className="px-5 py-2 text-right">
                        <button onClick={() => updateExam(e.id)} className="mr-2 text-xs font-medium text-accent hover:underline">Save</button>
                        <button onClick={() => setEditingExam(null)} className="text-xs text-muted hover:underline">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3"><span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{e.type}</span></td>
                      <td className="px-5 py-3 font-medium">{e.title}</td>
                      <td className="px-5 py-3 text-muted">{e.date ? new Date(e.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : <span className="italic">TBA</span>}</td>
                      <td className="px-5 py-3 text-muted">{e.syllabus || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => { setEditingExam(e.id); setEditExamForm({ type: e.type, title: e.title, date: e.date, syllabus: e.syllabus }); }} className="mr-2 text-xs text-muted hover:text-foreground">Edit</button>
                        <button onClick={() => setConfirmDelete({ type: "exam", id: e.id, name: e.title })} className="text-xs text-danger hover:underline">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {deadlines.length > 0 && exams.length > 0 && (
                <tr><td colSpan={5} className="px-5 py-1"><div className="border-t border-dashed border-border" /></td></tr>
              )}
              {deadlines.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-5 py-3"><span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">{d.type}</span></td>
                  <td className={`px-5 py-3 font-medium ${d.done ? "line-through text-muted" : ""}`}>{d.title}</td>
                  <td className="px-5 py-3 text-muted">{d.date ? new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : <span className="italic">TBA</span>}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleDeadline(d)} className={`text-xs font-medium ${d.done ? "text-success" : "text-muted hover:text-foreground"}`}>{d.done ? "Done" : "Mark done"}</button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setConfirmDelete({ type: "deadline", id: d.id, name: d.title })} className="text-xs text-danger hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ===== SCORES ===== */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Evaluation Components</h2>
          <button onClick={() => setShowAddScore(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ Add Component</button>
        </div>

        {scores.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">No evaluation components. Add your course&apos;s grading structure.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Component</th>
                  <th className="px-5 py-3">Weight</th>
                  <th className="px-5 py-3">Max</th>
                  <th className="px-5 py-3">Obtained</th>
                  <th className="px-5 py-3">Wtd %</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => {
                  const wtd = s.obtained !== null && s.maxMarks ? ((s.obtained / s.maxMarks) * s.weightage).toFixed(1) : null;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-muted">{s.weightage}%</td>
                      <td className="px-5 py-2">
                        <input
                          type="number"
                          value={getScoreValue(s.id, "maxMarks", s.maxMarks)}
                          placeholder="—"
                          onChange={(e) => updateScore(s.id, "maxMarks", e.target.value)}
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-5 py-2">
                        <input
                          type="number"
                          value={getScoreValue(s.id, "obtained", s.obtained)}
                          placeholder="—"
                          onChange={(e) => updateScore(s.id, "obtained", e.target.value)}
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-5 py-3">{wtd !== null ? <span className="font-medium">{wtd}%</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setConfirmDelete({ type: "score", id: s.id, name: s.name })} className="text-xs text-danger hover:underline">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-6 border-t border-border px-5 py-4">
              <div>
                <p className="text-xs text-muted">Total Weight</p>
                <p className="text-lg font-bold">{totalWeight}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">Completed</p>
                <p className="text-lg font-bold">{completedWeight}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">Weighted Score</p>
                <p className="text-lg font-bold">{weightedTotal.toFixed(1)}%</p>
              </div>
              {completedWeight > 0 && (
                <div>
                  <p className="text-xs text-muted">Effective %</p>
                  <p className="text-lg font-bold">{((weightedTotal / completedWeight) * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ===== RESOURCES & HANDOUTS ===== */}
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
                    {pyqs.map((p, i) => {
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

        {/* Handouts */}
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
      </section>

      {/* ===== PLAN ===== */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Study Plan</h2>
          <div className="flex gap-2">
            {planEditing ? (
              <>
                <button onClick={savePlan} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">Save</button>
                <button onClick={() => { setPlanDraft(plan); setPlanEditing(false); }} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-hover">Cancel</button>
              </>
            ) : (
              <button onClick={() => setPlanEditing(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">Edit</button>
            )}
          </div>
        </div>

        {planEditing ? (
          <div className="grid grid-cols-2 gap-4 p-5">
            <textarea
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              className="min-h-[300px] w-full rounded-xl border border-border bg-background p-4 font-mono text-sm outline-none focus:border-accent"
              placeholder="# Study Plan&#10;&#10;Write your plan in Markdown..."
            />
            <div className="prose min-h-[300px] max-w-none rounded-xl border border-border bg-background p-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{planDraft}</ReactMarkdown>
            </div>
          </div>
        ) : plan ? (
          <div className="prose max-w-none p-5 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted">
            No study plan yet. Click Edit to start writing.
          </div>
        )}
      </section>

      {/* ===== ASSIGNMENTS ===== */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Assignments</h2>
            <button
              onClick={toggleAssignmentsSection}
              className={`relative h-5 w-9 rounded-full transition-colors ${showAssignments ? "bg-accent" : "bg-border"}`}
              title={showAssignments ? "Hide assignments" : "Show assignments"}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${showAssignments ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
          {showAssignments && (
            <button onClick={() => setShowAddAssignment(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">+ New Assignment</button>
          )}
        </div>

        {showAssignments && (
          assignments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">No assignments yet. Create one to get started.</div>
          ) : (
            <div className="divide-y divide-border">
              {assignments.map((a) => (
                <div key={a} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📁</span>
                    <p className="text-sm font-medium">{a}</p>
                  </div>
                  <PromptButton
                    label="Ask about this"
                    icon="💬"
                    prompt={`I'll attach my assignment files. Please help me work through this assignment step by step.`}
                    small
                  />
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ===== MODALS ===== */}
      <Modal open={showAddExam} onClose={() => setShowAddExam(false)} title="Add Exam">
        <div className="space-y-3">
          <input placeholder="Type (e.g. Quiz, Midsem, Endsem)" value={examForm.type} onChange={(e) => setExamForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input placeholder="Title" value={examForm.title} onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="date" value={examForm.date} onChange={(e) => setExamForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input placeholder="Syllabus / Topics" value={examForm.syllabus} onChange={(e) => setExamForm((f) => ({ ...f, syllabus: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addExam} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Exam</button>
        </div>
      </Modal>

      <Modal open={showAddScore} onClose={() => setShowAddScore(false)} title="Add Evaluation Component">
        <div className="space-y-3">
          <input placeholder="Component Name (e.g. Quiz 1, Project)" value={scoreForm.name} onChange={(e) => setScoreForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Weightage (%)" value={scoreForm.weightage || ""} onChange={(e) => setScoreForm((f) => ({ ...f, weightage: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Max Marks (optional)" value={scoreForm.maxMarks} onChange={(e) => setScoreForm((f) => ({ ...f, maxMarks: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Obtained (optional)" value={scoreForm.obtained} onChange={(e) => setScoreForm((f) => ({ ...f, obtained: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addScore} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Component</button>
        </div>
      </Modal>

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

      <Modal open={showAddHandout} onClose={() => setShowAddHandout(false)} title="Upload Handout">
        <div className="space-y-3">
          <input type="file" onChange={(e) => setHandoutFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={addHandout} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Upload</button>
        </div>
      </Modal>

      <Modal open={showAddDeadline} onClose={() => setShowAddDeadline(false)} title="Add Deadline">
        <div className="space-y-3">
          <input placeholder="Title" value={deadlineForm.title} onChange={(e) => setDeadlineForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="date" value={deadlineForm.date} onChange={(e) => setDeadlineForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <select value={deadlineForm.type} onChange={(e) => setDeadlineForm((f) => ({ ...f, type: e.target.value as Deadline["type"] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
            <option value="report">Report</option>
            <option value="other">Other</option>
          </select>
          <button onClick={addDeadline} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Deadline</button>
        </div>
      </Modal>

      <Modal open={showAddAssignment} onClose={() => setShowAddAssignment(false)} title="New Assignment">
        <div className="space-y-3">
          <input placeholder="Assignment name (e.g. assignment-1)" value={assignmentSlug} onChange={(e) => setAssignmentSlug(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addAssignment} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Create</button>
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

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmDelete?.type || "item"}?`}
        message={`Are you sure you want to delete "${confirmDelete?.name || ""}"? This cannot be undone.`}
      />
    </div>
  );
}
