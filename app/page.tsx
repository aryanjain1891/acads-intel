"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiPost } from "@/lib/api";
import type { Course, Exam, EvalComponent, Deadline } from "@/lib/types";

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return Infinity;
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "TBA";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [scores, setScores] = useState<EvalComponent[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "", code: "", instructor: "", credits: 3 });

  const reload = () => {
    fetch("/api/courses").then((r) => r.json()).then(setCourses).catch(() => {});
    fetch("/api/exams").then((r) => r.json()).then(setExams).catch(() => {});
    fetch("/api/scores").then((r) => r.json()).then(setScores).catch(() => {});
    fetch("/api/deadlines").then((r) => r.json()).then(setDeadlines).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const upcoming = [...exams.filter((e) => e.date), ...deadlines.filter((d) => !d.done && d.date)]
    .map((item) => ({
      ...item,
      isDeadline: "done" in item,
      days: daysUntil(item.date),
    }))
    .filter((item) => item.days >= 0 && item.days < Infinity)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const courseScore = (courseId: string) => {
    const items = scores.filter((s) => s.courseId === courseId);
    const done = items.filter((s) => s.obtained !== null && s.maxMarks);
    if (done.length === 0) return null;
    const weighted = done.reduce((acc, s) => acc + (s.obtained! / s.maxMarks!) * s.weightage, 0);
    const totalWeight = done.reduce((acc, s) => acc + s.weightage, 0);
    return { weighted, totalWeight };
  };

  const { toast } = useToast();

  const sortedCourses = [...courses].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const addCourse = async () => {
    if (!courseForm.name.trim()) { toast("Course name is required", "error"); return; }
    if (!courseForm.code.trim()) { toast("Course code is required", "error"); return; }
    const res = await apiPost("/api/courses", courseForm);
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Course added");
    setCourseForm({ name: "", code: "", instructor: "", credits: 3 });
    setShowAddCourse(false);
    reload();
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">Your semester at a glance</p>
        </div>
        <button
          onClick={() => setShowAddCourse(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          + Add Course
        </button>
      </div>

      {courses.length === 0 && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-bold">Welcome 👋</h2>
          <p className="mt-2 text-sm text-muted">
            Acads Intel keeps your semester in one place — courses, exams, scores, lecture notes, handouts, study plans, and assignments.
          </p>
          <ol className="mt-4 space-y-2 text-sm">
            <li><span className="font-semibold">1.</span> Click <span className="font-medium">+ Add Course</span> (top right) to add your first subject.</li>
            <li><span className="font-semibold">2.</span> Open the course to set up its grading components, upload resources, and plan your studies.</li>
            <li><span className="font-semibold">3.</span> Add exam dates and deadlines — they&apos;ll show up on your dashboard and calendar.</li>
          </ol>
          <p className="mt-4 text-xs text-muted">All your data stays on your machine. Nothing is uploaded anywhere.</p>
        </section>
      )}

      {/* Upcoming */}
      {courses.length > 0 && (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
            No upcoming exams or deadlines. Add some from a course page.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">In</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium">{formatDate(item.date)}</td>
                    <td className="px-4 py-3">{courseName(item.courseId)}</td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isDeadline
                          ? "bg-warning/10 text-warning"
                          : "bg-accent/10 text-accent"
                      }`}>
                        {item.isDeadline ? (item as Deadline & { days: number }).type : (item as Exam & { days: number }).type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold ${item.days <= 2 ? "text-danger" : item.days <= 7 ? "text-warning" : "text-muted"}`}>
                        {item.days === 0 ? "Today" : item.days === 1 ? "Tomorrow" : `${item.days}d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* Course Cards */}
      {courses.length > 0 && (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Courses</h2>
        {(
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCourses.map((c) => {
              const sc = courseScore(c.id);
              const pendingExams = exams.filter((e) => e.courseId === c.id && e.date && daysUntil(e.date) >= 0).length;
              return (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="rounded-xl border border-border bg-surface p-5 transition-all hover:border-accent/30 hover:shadow-md"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{c.code}</span>
                    <span className="text-xs text-muted">{c.credits} cr</span>
                  </div>
                  <h3 className="mb-1 font-semibold">{c.name}</h3>
                  <p className="mb-3 text-xs text-muted">{c.instructor}</p>
                  <div className="flex items-center justify-between text-xs">
                    {sc ? (
                      <span className="font-medium">
                        {sc.weighted.toFixed(1)}% <span className="text-muted">/ {sc.totalWeight}%</span>
                      </span>
                    ) : (
                      <span className="text-muted">No scores yet</span>
                    )}
                    {pendingExams > 0 && (
                      <span className="text-muted">{pendingExams} upcoming</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Add Course Modal */}
      <Modal open={showAddCourse} onClose={() => setShowAddCourse(false)} title="Add Course">
        <div className="space-y-3">
          <input
            placeholder="Course Name"
            value={courseForm.name}
            onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            placeholder="Course Code"
            value={courseForm.code}
            onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            placeholder="Instructor"
            value={courseForm.instructor}
            onChange={(e) => setCourseForm((f) => ({ ...f, instructor: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="Credits"
            value={courseForm.credits}
            onChange={(e) => setCourseForm((f) => ({ ...f, credits: Number(e.target.value) }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={addCourse}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Add Course
          </button>
        </div>
      </Modal>
    </div>
  );
}
