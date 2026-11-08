"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { call } from "@/api/client";
import { Panel, Shell } from "@/components/shell";
import type { EvalAttempt, EvalTask } from "@/lib/domain";

export function EvalScreen() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["eval"],
    queryFn: () => call<{ tasks: EvalTask[]; attempts: EvalAttempt[] }>("/api/harness/eval"),
  });
  const [draft, setDraft] = useState<EvalAttempt[] | null>(null);
  const [participantDraft, setParticipant] = useState<string | null>(null);
  const attempts = draft ?? query.data?.attempts ?? [];
  const participant = participantDraft ?? attempts[0]?.participantId ?? "";
  const [running, setRunning] = useState<string | null>(null);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);
  const save = useMutation({
    mutationFn: (next: EvalAttempt[]) => call("/api/harness/eval", { method: "PUT", body: { participantId: participant, attempts: next } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["eval"] }),
  });
  function finish(taskId: string, outcome: "success" | "skip" | "timeout") {
    const ms = outcome === "success" && started ? Date.now() - started : null;
    const next = attempts.map((attempt) =>
      attempt.taskId === taskId
        ? { ...attempt, outcome, ms, score: outcome === "success" ? 1 : null, participantId: participant }
        : attempt,
    );
    setDraft(next);
    setRunning(null);
    save.mutate(next);
  }
  const elapsed = running ? Math.round((now - started) / 1000) : 0;
  return (
    <Shell>
      <Panel
        title="Eval"
        action={
          <Link className="inline-flex min-h-11 items-center rounded-control border border-line px-3 text-sm" href="/api/harness/eval/export">
            Export CSV
          </Link>
        }
      >
        <label className="mb-4 block max-w-sm text-sm">
          Participant id, optional
          <input className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-3" value={participant} onChange={(event) => setParticipant(event.target.value)} />
        </label>
        {running ? <p role="status" className="mb-3 text-sm">Timer {elapsed}s</p> : null}
        <ul className="space-y-3">
          {(query.data?.tasks ?? []).map((task) => {
            const attempt = attempts.find((item) => item.taskId === task.id);
            return (
              <li key={task.id} className="rounded-panel border border-line bg-panel p-4">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-secondary">{task.prompt}</p>
                <p className="mt-1 text-xs text-muted">
                  {attempt?.outcome ?? "pending"}
                  {attempt?.outcome === "success" && attempt.score !== null ? ` · score ${attempt.score}` : ""}
                  {attempt?.outcome === "skip" || attempt?.outcome === "timeout" ? " · no score" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="min-h-11 rounded-control bg-primary px-3 text-sm text-primary-ink"
                    type="button"
                    onClick={() => {
                      setRunning(task.id);
                      setStarted(Date.now());
                      setNow(Date.now());
                    }}
                  >
                    Start
                  </button>
                  <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => finish(task.id, "success")}>
                    Success
                  </button>
                  <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => finish(task.id, "skip")}>
                    Skip
                  </button>
                  <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => finish(task.id, "timeout")}>
                    Timeout
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </Shell>
  );
}
