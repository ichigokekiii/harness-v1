"use client";

import { At, CaretDown, PaperPlaneRight, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { call } from "@/api/client";
import { Shell } from "@/components/shell";
import { LOCAL_MODEL } from "@/lib/model";
import type { ChatMessage, Health, Thread } from "@/lib/domain";
import { cn } from "@/lib/cn";

type ThreadList = { threads: { id: string; title: string; updatedAt: string; preview: string }[] };
type ThreadResponse = { thread: Thread; health: Health };

const suggestions = [
  ["What should Grade 7 study about ecosystems?", "Grade 7 ecosystems"],
  ["When do lab hours end?", "Lab hours disagree"],
  ["What does the attendance memo say?", "Old attendance memo"],
  ["What is the school bus schedule?", "Missing bus schedule"],
] as const;

export function ChatHome() {
  return (
    <Shell>
      <ChatColumn />
    </Shell>
  );
}

export function ChatThread({ id }: { id: string }) {
  return (
    <Shell>
      <ChatColumn threadId={id} />
    </Shell>
  );
}

function ChatColumn({ threadId }: { threadId?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["threads"], queryFn: () => call<ThreadList>("/api/harness/threads") });
  const thread = useQuery({
    queryKey: ["thread", threadId],
    enabled: Boolean(threadId),
    queryFn: () => call<ThreadResponse>(`/api/harness/threads/${threadId}`),
  });
  const health = useQuery({ queryKey: ["health"], queryFn: () => call<{ health: Health }>("/api/harness/health") });
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ask = useMutation({
    mutationFn: (value: string) => call<{ threadId: string }>("/api/harness/threads/ask", { method: "POST", body: { text: value } }),
    onSuccess: async (result) => {
      setText("");
      await client.invalidateQueries({ queryKey: ["threads"] });
      await client.invalidateQueries({ queryKey: ["thread", result.threadId] });
      router.push(`/chat/${result.threadId}`);
    },
  });
  const ticket = useMutation({
    mutationFn: () => call(`/api/harness/threads/${threadId}/ticket`, { method: "POST", body: {} }),
  });
  const offline = useMutation({
    mutationFn: (model: "up" | "down") => call("/api/harness/health", { method: "PUT", body: { model } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["health"] });
      await client.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });

  const message = thread.data?.thread.messages.filter((item) => item.role === "assistant").at(-1);
  const citations = message?.citations ?? [];
  const citation = citations[active];
  const modelDown = (thread.data?.health.model ?? health.data?.health.model) === "down";

  const grouped = useMemo(() => list.data?.threads ?? [], [list.data?.threads]);

  return (
    <div className="grid min-h-[calc(100dvh-56px)] md:min-h-dvh md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line md:block">
        <div className="p-3">
          <Link className="flex min-h-11 items-center rounded-control px-2 text-sm font-medium hover:bg-soft" href="/chat">
            New chat
          </Link>
        </div>
        <div className="px-4 pb-2 text-xs text-muted">Recent</div>
        <ul className="space-y-1 px-2">
          {grouped.map((item) => (
            <li key={item.id}>
              <Link
                className={cn("flex min-h-11 items-center rounded-control px-2 text-sm", item.id === threadId ? "bg-panel font-medium" : "text-secondary")}
                href={`/chat/${item.id}`}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-w-0 flex-col">
        <div className="flex gap-2 overflow-auto border-b border-line p-2 md:hidden">
          <Link className="inline-flex min-h-11 shrink-0 items-center rounded-control px-2 text-sm" href="/chat">
            New chat
          </Link>
          {grouped.map((item) => (
            <Link key={item.id} className="inline-flex min-h-11 shrink-0 items-center rounded-control px-2 text-sm" href={`/chat/${item.id}`}>
              {item.title}
            </Link>
          ))}
        </div>
        {modelDown ? (
          <p className="border-b border-line bg-cite px-4 py-2 text-sm text-cite-ink" role="status">
            Search only, model offline
          </p>
        ) : null}
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 py-8">
          {!threadId ? (
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">Chat</h1>
              <p className="mt-2 text-sm text-secondary">Ask from the sample library. The answer stays next to the page.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {suggestions.map(([prompt, label]) => (
                  <button
                    key={label}
                    className="min-h-11 rounded-panel border border-line bg-panel px-3 text-left text-sm"
                    type="button"
                    onClick={() => ask.mutate(prompt)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : thread.isLoading ? (
            <p role="status" className="text-sm text-secondary">Loading the thread</p>
          ) : thread.isError ? (
            <p className="text-sm text-danger">The thread could not load.</p>
          ) : (
            <ThreadBody
              messages={thread.data?.thread.messages ?? []}
              active={active}
              onCite={(index) => {
                setActive(index);
                setSourcesOpen(true);
                const title = citations[index]?.title;
                if (title) void call("/api/harness/activity/open", { method: "POST", body: { title } });
              }}
              onTicket={() => ticket.mutate()}
              ticketDone={ticket.isSuccess}
            />
          )}
          <form
            className="sticky bottom-4 mt-8 rounded-composer border border-line bg-panel p-3 shadow"
            data-mp-def="composer"
            data-mp-id="composer"
            onSubmit={(event) => {
              event.preventDefault();
              const value = text.trim();
              if (!value) return;
              ask.mutate(attached ? `${value}\nAttached: ${attached}` : value);
            }}
          >
            {attached ? <p className="mb-2 text-xs text-secondary">Attached: {attached}</p> : null}
            <label className="sr-only" htmlFor="composer">
              Message
            </label>
            <textarea
              id="composer"
              className="min-h-16 w-full resize-none bg-transparent text-sm"
              placeholder="Ask about a sample page"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="mt-2 flex items-center gap-1">
              <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-secondary" title="Attach a file">
                <Plus size={18} />
                <span className="sr-only">Attach a file</span>
                <input
                  className="sr-only"
                  type="file"
                  onChange={(event) => setAttached(event.target.files?.[0]?.name ?? null)}
                />
              </label>
              <button className="inline-flex size-11 items-center justify-center rounded-full text-secondary" type="button" aria-label="Mention a source" onClick={() => setSourcesOpen(true)}>
                <At size={18} />
              </button>
              <div className="relative">
                <button className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-secondary" type="button" aria-expanded={modelOpen} onClick={() => setModelOpen((value) => !value)}>
                  {LOCAL_MODEL}
                  <CaretDown size={14} />
                </button>
                {modelOpen ? (
                  <div className="absolute bottom-12 left-0 z-10 w-64 rounded-panel border border-line bg-panel p-2 shadow">
                    <p className="px-2 py-1 text-sm">{LOCAL_MODEL}</p>
                    <p className="px-2 pb-2 text-xs text-muted">Runs on this machine</p>
                    <button
                      className="min-h-11 w-full rounded-control px-2 text-left text-sm hover:bg-soft"
                      type="button"
                      onClick={() => {
                        offline.mutate(modelDown ? "up" : "down");
                        setModelOpen(false);
                      }}
                    >
                      {modelDown ? "Use the local model" : "Search only"}
                    </button>
                  </div>
                ) : null}
              </div>
              <button className="ml-auto inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-ink" type="submit" aria-label="Send" disabled={ask.isPending}>
                <PaperPlaneRight size={18} />
              </button>
            </div>
            {ask.isError ? <p className="mt-2 text-sm text-danger">{ask.error.message}</p> : null}
          </form>
        </div>
        {sourcesOpen && citation ? (
          <SourceRail citation={citation} onClose={() => setSourcesOpen(false)} />
        ) : null}
      </section>
    </div>
  );
}

function ThreadBody({
  messages,
  active,
  onCite,
  onTicket,
  ticketDone,
}: {
  messages: ChatMessage[];
  active: number;
  onCite: (index: number) => void;
  onTicket: () => void;
  ticketDone: boolean;
}) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <article key={message.id}>
          {message.role === "user" ? (
            <p className="ml-auto max-w-[80%] rounded-composer bg-soft px-4 py-3 text-sm">{message.content}</p>
          ) : (
            <div>
              {message.kind === "conflict" ? <p className="mb-2 text-sm font-medium text-warning">Sources disagree</p> : null}
              {message.kind === "superseded" ? <p className="mb-2 text-sm font-medium">This passage is superseded</p> : null}
              <p className="text-[15px] leading-7">
                {message.segments?.length
                  ? message.segments.map((segment, index) => (
                      <span key={`${message.id}-${index}`}>
                        {segment.text}
                        {segment.cite ? (
                          <button
                            className="mx-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-cite px-2 text-xs font-medium text-cite-ink"
                            type="button"
                            aria-label={`Source ${segment.cite}, ${message.citations?.[segment.cite - 1]?.title ?? ""}, page ${message.citations?.[segment.cite - 1]?.page ?? ""}`}
                            onClick={() => onCite(segment.cite! - 1)}
                          >
                            {segment.cite}
                          </button>
                        ) : null}
                      </span>
                    ))
                  : message.content}
              </p>
              {message.citations?.map((citation) =>
                citation.status === "superseded" ? (
                  <p key={citation.id} className="mt-2 text-sm text-secondary">
                    {citation.note}
                  </p>
                ) : null,
              )}
              {message.kind === "decline" || message.kind === "search" ? (
                <button className="mt-3 min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={onTicket}>
                  {ticketDone ? "Ticket sent" : "Report missing document"}
                </button>
              ) : null}
            </div>
          )}
        </article>
      ))}
      <span className="sr-only">Active source {active + 1}</span>
    </div>
  );
}

function SourceRail({
  citation,
  onClose,
}: {
  citation: NonNullable<ChatMessage["citations"]>[number];
  onClose: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-[380px] overflow-auto border-l border-line bg-panel p-4 shadow" data-mp-def="source-rail" data-mp-id={`source-${citation.id}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sources</h2>
        <button className="min-h-11 px-2 text-sm" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mt-3 text-sm font-medium">{citation.title}</p>
      <p className="text-xs text-muted">Page {citation.page}</p>
      {citation.note ? <p className="mt-2 text-sm text-secondary">{citation.note}</p> : null}
      <article className="relative mt-4 min-h-[420px] rounded-panel border border-line bg-white p-6 text-sm leading-6 text-cite-ink">
        <p className="text-xs uppercase tracking-wide text-muted">Sample page</p>
        <p className="mt-6">{citation.title}</p>
        <mark
          className="mt-4 block border border-cite-ink bg-cite px-2 py-3 text-cite-ink"
          style={{ marginTop: citation.highlightTop }}
        >
          {citation.snippet}
        </mark>
      </article>
    </aside>
  );
}
