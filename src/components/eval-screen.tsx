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
    const timer = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);
  const save = useMutation({
    mutationFn: (next: EvalAttempt[]) => call("/api/harness/eval", { method: "PUT", body: { participantId: participant, attempts: next } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["eval"] }),
  });
  function finish(taskId: string, outcome: "success" | "skip" | "timeout", at: number) {
    const ms = outcome === "success" && started ? Math.round(at - started) : null;
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
          <Link className="inline-flex min-h-9 items-center rounded-control border border-line px-3 text-sm" href="/api/harness/eval/export">
            Export CSV
          </Link>
        }
      >
        <label className="mb-4 block max-w-sm text-sm">
          Participant id, optional
          <input className="mt-1 min-h-9 w-full rounded-control border border-line bg-panel px-3" value={participant} onChange={(event) => setParticipant(event.target.value)} />
        </label>
        {running ? <p role="status" className="mb-3 text-sm">Timer {elapsed}s</p> : null}
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-panel">
          {(query.data?.tasks ?? []).map((task) => {
            const attempt = attempts.find((item) => item.taskId === task.id);
            const live = running === task.id;
            return (
              <li key={task.id} className={live ? "flex flex-wrap items-center gap-x-6 gap-y-3 bg-soft/60 px-4 py-3.5" : "flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5"}>
                <div className="min-w-0 flex-1 basis-80">
                  <p className="text-sm font-medium">
                    {task.title}
                    <span className="ml-2 inline-flex rounded-full bg-soft px-2 py-0.5 align-middle text-[11px] font-normal text-secondary">
                      {attempt?.outcome ?? "pending"}
                      {attempt?.outcome === "success" && attempt.score !== null ? `, score ${attempt.score}` : ""}
                      {attempt?.outcome === "skip" || attempt?.outcome === "timeout" ? ", no score" : ""}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-secondary">{task.prompt}</p>
                </div>
                <div className="flex items-center gap-1">
                  {live ? <span className="mr-2 text-[13px] tabular-nums text-ink">{elapsed}s</span> : null}
                  <button
                    className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-ink hover:bg-primary-hover"
                    type="button"
                    onClick={(event) => {
                      setRunning(task.id);
                      setStarted(event.timeStamp);
                      setNow(event.timeStamp);
                    }}
                  >
                    Start
                  </button>
                  {(["success", "skip", "timeout"] as const).map((outcome) => (
                    <button key={outcome} className="h-8 rounded-lg px-2.5 text-[13px] capitalize text-secondary hover:bg-soft hover:text-ink" type="button" onClick={(event) => finish(task.id, outcome, event.timeStamp)}>
                      {outcome}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </Shell>
  );
}
