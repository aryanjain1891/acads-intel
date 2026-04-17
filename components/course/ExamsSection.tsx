"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiPost, apiPut } from "@/lib/api";
import type { Exam, Deadline } from "@/lib/types";

type ConfirmDelete = { type: string; id: string; name: string } | null;

export default function ExamsSection({
  courseId,
  exams,
  deadlines,
  reload,
  setConfirmDelete,
}: {
  courseId: string;
  exams: Exam[];
  deadlines: Deadline[];
  reload: () => void;
  setConfirmDelete: (v: ConfirmDelete) => void;
}) {
  const { toast } = useToast();

  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [examForm, setExamForm] = useState({ type: "", title: "", date: "", syllabus: "" });
  const [deadlineForm, setDeadlineForm] = useState({ title: "", date: "", type: "assignment" as Deadline["type"] });
  const [editingExam, setEditingExam] = useState<string | null>(null);
  const [editExamForm, setEditExamForm] = useState({ type: "", title: "", date: "", syllabus: "" });

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

  return (
    <>
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

      <Modal open={showAddExam} onClose={() => setShowAddExam(false)} title="Add Exam">
        <div className="space-y-3">
          <input placeholder="Type (e.g. Quiz, Midsem, Endsem)" value={examForm.type} onChange={(e) => setExamForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input placeholder="Title" value={examForm.title} onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="date" value={examForm.date} onChange={(e) => setExamForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input placeholder="Syllabus / Topics" value={examForm.syllabus} onChange={(e) => setExamForm((f) => ({ ...f, syllabus: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addExam} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Exam</button>
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
    </>
  );
}

