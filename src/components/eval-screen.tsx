"use client";

import { Check, DownloadSimple, FastForward, Hourglass, Play } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { call } from "@/api/client";
import { FileCard } from "@/components/file-card";
import { Panel, Shell } from "@/components/shell";
import type { EvalAttempt, EvalTask } from "@/lib/domain";

function outcomeDetail(attempt: EvalAttempt | undefined, live: boolean, elapsed: number) {
  if (live) return `Running, ${elapsed}s`;
  if (!attempt || attempt.outcome === "pending") return "Pending";
  if (attempt.outcome === "success") return attempt.score === null ? "Success" : `Success, score ${attempt.score}`;
  if (attempt.outcome === "skip") return "Skipped, no score";
  return "Timed out, no score";
}

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
  const tasks = query.data?.tasks ?? [];
  return (
    <Shell>
      <Panel
        title="Eval"
        action={
          <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm" href="/api/harness/eval/export">
            <DownloadSimple size={16} />
            Export CSV
          </Link>
        }
      >
        <label className="mb-6 block max-w-sm text-sm">
          Participant id, optional
          <input className="mt-1 min-h-9 w-full rounded-control border border-line bg-panel px-3" value={participant} onChange={(event) => setParticipant(event.target.value)} />
        </label>
        {running ? <p role="status" className="sr-only">{`Timer ${elapsed} seconds`}</p> : null}
        <ul className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const attempt = attempts.find((item) => item.taskId === task.id);
            const live = running === task.id;
            return (
              <li key={task.id} className="min-w-0">
                <FileCard title={task.title} detail={outcomeDetail(attempt, live, elapsed)} preview={task.prompt} />
                <div className="mt-2 flex flex-wrap items-center gap-1 px-0.5">
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink"
                    type="button"
                    onClick={(event) => {
                      setRunning(task.id);
                      setStarted(event.timeStamp);
                      setNow(event.timeStamp);
                    }}
                  >
                    <Play size={15} />
                    Start
                  </button>
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={(event) => finish(task.id, "success", event.timeStamp)}>
                    <Check size={15} />
                    Success
                  </button>
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={(event) => finish(task.id, "skip", event.timeStamp)}>
                    <FastForward size={15} />
                    Skip
                  </button>
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={(event) => finish(task.id, "timeout", event.timeStamp)}>
                    <Hourglass size={15} />
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
