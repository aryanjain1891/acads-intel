"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiPost, apiPut } from "@/lib/api";
import type { EvalComponent } from "@/lib/types";

type ConfirmDelete = { type: string; id: string; name: string } | null;

export default function ScoresSection({
  courseId,
  scores,
  reload,
  setConfirmDelete,
}: {
  courseId: string;
  scores: EvalComponent[];
  reload: () => void;
  setConfirmDelete: (v: ConfirmDelete) => void;
}) {
  const { toast } = useToast();

  const [showAddScore, setShowAddScore] = useState(false);
  const [scoreForm, setScoreForm] = useState({ name: "", weightage: 0, maxMarks: "", obtained: "" });
  const scoreTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localScoreEdits, setLocalScoreEdits] = useState<Record<string, string>>({});

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
    <>
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

      <Modal open={showAddScore} onClose={() => setShowAddScore(false)} title="Add Evaluation Component">
        <div className="space-y-3">
          <input placeholder="Component Name (e.g. Quiz 1, Project)" value={scoreForm.name} onChange={(e) => setScoreForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Weightage (%)" value={scoreForm.weightage || ""} onChange={(e) => setScoreForm((f) => ({ ...f, weightage: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Max Marks (optional)" value={scoreForm.maxMarks} onChange={(e) => setScoreForm((f) => ({ ...f, maxMarks: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <input type="number" placeholder="Obtained (optional)" value={scoreForm.obtained} onChange={(e) => setScoreForm((f) => ({ ...f, obtained: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <button onClick={addScore} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">Add Component</button>
        </div>
      </Modal>
    </>
  );
}
