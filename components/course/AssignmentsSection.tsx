"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import PromptButton from "@/components/PromptButton";
import { useToast } from "@/components/Toast";
import { apiPost } from "@/lib/api";

export default function AssignmentsSection({
  courseId,
  assignments,
  reload,
}: {
  courseId: string;
  assignments: string[];
  reload: () => void;
}) {
  const { toast } = useToast();

  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [assignmentSlug, setAssignmentSlug] = useState("");
  const [showAssignments, setShowAssignments] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`show-assignments-${courseId}`);
      return stored === null ? true : stored === "true";
    }
    return true;
  });

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

  return (
    <>
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

      <Modal open={showAddAssignment} onClose={() => setShowAddAssignment(false)} title="New Assignment">
        <div className="space-y-3">
          <input placeholder="Assignment name (e.g. assignment-1)" value={assignmentSlug} onChange={(e) => setAssignmentSlug(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addAssignment} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Create</button>
        </div>
      </Modal>
    </>
  );
}
