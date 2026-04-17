"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/components/Toast";
import { apiPut } from "@/lib/api";

export default function StudyPlanSection({
  courseId,
  plan,
  setPlan,
  reload,
}: {
  courseId: string;
  plan: string;
  setPlan: (v: string) => void;
  reload: () => void;
}) {
  const { toast } = useToast();
  const [planDraft, setPlanDraft] = useState(plan);
  const [planEditing, setPlanEditing] = useState(false);

  // Keep draft in sync with parent plan when not editing.
  useEffect(() => {
    if (!planEditing) setPlanDraft(plan);
  }, [plan, planEditing]);

  const savePlan = async () => {
    const res = await apiPut(`/api/plans/${courseId}`, { content: planDraft });
    if (!res.ok) { toast(res.error, "error"); return; }
    toast("Plan saved");
    setPlan(planDraft);
    setPlanEditing(false);
    reload();
  };

  return (
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
  );
}
