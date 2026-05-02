"use client";

import { use, useEffect, useState, useCallback } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import ExamsSection from "@/components/course/ExamsSection";
import ScoresSection from "@/components/course/ScoresSection";
import ResourcesSection from "@/components/course/ResourcesSection";
import HandoutsSection from "@/components/course/HandoutsSection";
import NoticesSection from "@/components/course/NoticesSection";
import { deleteExam, deleteScore, deleteResource, deleteHandout, deleteDeadline, deleteNotice } from "@/lib/courseHelpers";
import type { Course, Exam, EvalComponent, Resource, Handout, Deadline, Notice, SavedNotice } from "@/lib/types";

export default function CourseDetail({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [scores, setScores] = useState<EvalComponent[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [persistedFolders, setPersistedFolders] = useState<string[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [savedNotices, setSavedNotices] = useState<SavedNotice[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());
  const [generatingExplainer, setGeneratingExplainer] = useState<Set<string>>(new Set());
  const [explainerStatus, setExplainerStatus] = useState<Record<string, { hasTranscript: boolean; hasExplainer: boolean; explainerUrl?: string }>>({});

  const { toast } = useToast();

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
    fetch(`/api/notices?courseId=${courseId}`).then((r) => r.json()).then(setNotices).catch(() => {});
    fetch(`/api/saved-notices?courseId=${courseId}`).then((r) => r.json()).then(setSavedNotices).catch(() => {});
    fetch(`/api/auth/google/status`).then((r) => r.json()).then((d: { connected: boolean }) => setGmailConnected(!!d.connected)).catch(() => {});
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

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    let res: { ok: true } | { ok: false; error: string } | null = null;
    let label = "";
    if (type === "exam") { res = await deleteExam(id); label = "Exam deleted"; }
    else if (type === "score") { res = await deleteScore(id); label = "Component deleted"; }
    else if (type === "resource") { res = await deleteResource(id); label = "Resource deleted"; }
    else if (type === "handout") { res = await deleteHandout(id); label = "Handout deleted"; }
    else if (type === "deadline") { res = await deleteDeadline(id); label = "Deadline deleted"; }
    else if (type === "notice") { res = await deleteNotice(id); label = "Notice deleted"; }
    if (res) {
      if (!res.ok) { toast(res.error, "error"); return; }
      toast(label);
      reload();
    }
  };

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
      </div>

      <ExamsSection
        courseId={courseId}
        exams={exams}
        deadlines={deadlines}
        reload={reload}
        setConfirmDelete={setConfirmDelete}
      />

      <ScoresSection
        courseId={courseId}
        scores={scores}
        reload={reload}
        setConfirmDelete={setConfirmDelete}
      />

      <ResourcesSection
        courseId={courseId}
        resources={resources}
        setResources={setResources}
        persistedFolders={persistedFolders}
        explainerStatus={explainerStatus}
        generatingExplainer={generatingExplainer}
        setGeneratingExplainer={setGeneratingExplainer}
        reload={reload}
        setConfirmDelete={setConfirmDelete}
        openPreviews={openPreviews}
        setOpenPreviews={setOpenPreviews}
        handoutsSlot={
          <HandoutsSection
            courseId={courseId}
            handouts={handouts}
            reload={reload}
            setConfirmDelete={setConfirmDelete}
            openPreviews={openPreviews}
            setOpenPreviews={setOpenPreviews}
          />
        }
      />

      <NoticesSection
        courseId={courseId}
        course={course}
        notices={notices}
        savedNotices={savedNotices}
        gmailConnected={gmailConnected}
        reload={reload}
        setConfirmDelete={setConfirmDelete}
      />

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
