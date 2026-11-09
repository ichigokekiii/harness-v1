"use client";

import { ArrowUp, At, CaretDown, Check, Copy, FileText, Plus, Warning, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { call } from "@/api/client";
import { FileCard } from "@/components/file-card";
import { Shell } from "@/components/shell";
import { LOCAL_MODEL } from "@/lib/model";
import type { ChatMessage, Health, Thread } from "@/lib/domain";
import { cn } from "@/lib/cn";

type ThreadResponse = { thread: Thread; health: Health };
type Citation = NonNullable<ChatMessage["citations"]>[number];

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
  const thread = useQuery({
    queryKey: ["thread", threadId],
    enabled: Boolean(threadId),
    queryFn: () => call<ThreadResponse>(`/api/harness/threads/${threadId}`),
  });
  const health = useQuery({ queryKey: ["health"], queryFn: () => call<{ health: Health }>("/api/harness/health") });
  const [source, setSource] = useState<Citation | null>(null);
  const ask = useMutation({
    mutationFn: (value: string) => call<{ threadId: string }>("/api/harness/threads/ask", { method: "POST", body: { text: value } }),
    onSuccess: async (result) => {
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

  const modelDown = (thread.data?.health.model ?? health.data?.health.model) === "down";
  const empty = !threadId && !ask.isPending;

  function openSource(citation: Citation) {
    setSource(citation);
    void call("/api/harness/activity/open", { method: "POST", body: { title: citation.title } });
  }

  const composer = (
    <Composer
      pending={ask.isPending}
      error={ask.isError ? ask.error.message : null}
      modelDown={modelDown}
      onToggleModel={() => offline.mutate(modelDown ? "up" : "down")}
      onSubmit={(value) => ask.mutate(value)}
      autoFocus={empty}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-48px)] min-w-0 md:h-dvh">
      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="hidden h-[52px] shrink-0 items-center px-5 md:flex">
          <p className="truncate text-[15px] text-ink">{thread.data?.thread.title ?? ""}</p>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[12vh]">
            <div className="w-full max-w-[768px]">
              <h1 className="mb-7 text-balance text-center text-[28px] font-normal tracking-[-0.02em]">What are we teaching today?</h1>
              {modelDown ? <OfflineNote onRestore={() => offline.mutate("up")} /> : null}
              {composer}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[768px] px-4 pb-10 pt-4 md:px-6">
                {ask.isPending && !threadId ? (
                  <PendingTurn text={ask.variables ?? ""} />
                ) : thread.isLoading ? (
                  <ThreadSkeleton />
                ) : thread.isError ? (
                  <p className="py-10 text-center text-[14px] text-danger">This chat could not load. Refresh to try again.</p>
                ) : (
                  <>
                    <ThreadBody
                      messages={thread.data?.thread.messages ?? []}
                      onCite={openSource}
                      onTicket={() => ticket.mutate()}
                      ticketDone={ticket.isSuccess}
                    />
                    {ask.isPending ? <PendingTurn text={ask.variables ?? ""} /> : null}
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 bg-root px-4 pb-4 md:px-6">
              <div className="mx-auto w-full max-w-[768px]">
                {modelDown ? <OfflineNote onRestore={() => offline.mutate("up")} /> : null}
                {composer}
              </div>
            </div>
          </>
        )}
      </section>
      {source ? <SourceRail citation={source} onClose={() => setSource(null)} /> : null}
    </div>
  );
}

function OfflineNote({ onRestore }: { onRestore: () => void }) {
  return (
    <p className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-[13px] text-secondary" role="status">
      <Warning size={14} className="text-warning" weight="fill" />
      Search only, model offline
      <button className="font-medium text-ink underline underline-offset-2" type="button" onClick={onRestore}>
        Turn it back on
      </button>
    </p>
  );
}

function Composer({
  pending,
  error,
  modelDown,
  onToggleModel,
  onSubmit,
  autoFocus,
}: {
  pending: boolean;
  error: string | null;
  modelDown: boolean;
  onToggleModel: () => void;
  onSubmit: (value: string) => void;
  autoFocus: boolean;
}) {
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ready = text.trim().length > 0 && !pending;

  useEffect(() => {
    if (!modelOpen) return;
    function onDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setModelOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [modelOpen]);

  return (
    <form
      className="rounded-composer bg-panel px-2.5 pb-2 pt-3 shadow-composer transition-shadow focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--text-primary)_22%,transparent),0_8px_24px_-10px_rgb(38_37_30/22%)]"
      data-mp-def="composer"
      data-mp-id="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = text.trim();
        if (!value || pending) return;
        onSubmit(attached ? `${value}\nAttached: ${attached}` : value);
        setText("");
        setAttached(null);
      }}
    >
      {attached ? (
        <div className="mb-2 ml-1.5 inline-flex items-center gap-2 rounded-xl border border-line py-1.5 pl-2.5 pr-1.5 text-[13px]">
          <FileText size={16} className="text-secondary" />
          <span className="max-w-[240px] truncate">{attached}</span>
          <button className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-soft hover:text-ink" type="button" aria-label="Remove attachment" onClick={() => setAttached(null)}>
            <X size={12} />
          </button>
        </div>
      ) : null}
      <label className="sr-only" htmlFor="composer">
        Message
      </label>
      <textarea
        id="composer"
        autoFocus={autoFocus}
        rows={1}
        className="block max-h-52 min-h-7 w-full resize-none bg-transparent px-1.5 text-[16px] leading-7 [field-sizing:content] focus-visible:outline-none"
        placeholder="Ask about a page in the library"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="mt-2 flex items-center gap-0.5">
        <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-secondary hover:bg-soft hover:text-ink" title="Attach a file">
          <Plus size={18} />
          <span className="sr-only">Attach a file</span>
          <input className="sr-only" type="file" onChange={(event) => setAttached(event.target.files?.[0]?.name ?? null)} />
        </label>
        <button className="inline-flex size-9 items-center justify-center rounded-full text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Mention a source" title="Mention a source" onClick={() => setText((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@`)}>
          <At size={18} />
        </button>
        <div ref={menuRef} className="relative ml-1">
          <button
            className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[13px] text-secondary hover:bg-soft hover:text-ink"
            type="button"
            aria-haspopup="menu"
            aria-expanded={modelOpen}
            onClick={() => setModelOpen((value) => !value)}
          >
            {modelDown ? "Search only" : LOCAL_MODEL}
            <CaretDown size={12} />
          </button>
          {modelOpen ? (
            <div className="absolute bottom-[calc(100%+6px)] left-0 z-20 w-[264px] rounded-xl bg-elevated p-1.5 shadow-pop" role="menu">
              <ModelOption
                title={LOCAL_MODEL}
                body="Runs on this machine"
                selected={!modelDown}
                onSelect={() => {
                  if (modelDown) onToggleModel();
                  setModelOpen(false);
                }}
              />
              <ModelOption
                title="Search only"
                body="Returns pages without writing an answer"
                selected={modelDown}
                onSelect={() => {
                  if (!modelDown) onToggleModel();
                  setModelOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
        <button
          className={cn(
            "ml-auto inline-flex size-9 items-center justify-center rounded-full transition-colors",
            ready ? "bg-primary text-primary-ink hover:bg-primary-hover" : "bg-soft text-muted",
          )}
          type="submit"
          aria-label="Send"
          disabled={!ready}
        >
          <ArrowUp size={18} weight="bold" />
        </button>
      </div>
      {error ? <p className="px-1.5 pt-1 text-[13px] text-danger">{error}</p> : null}
    </form>
  );
}

function ModelOption({ title, body, selected, onSelect }: { title: string; body: string; selected: boolean; onSelect: () => void }) {
  return (
    <button className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-soft" type="button" role="menuitemradio" aria-checked={selected} onClick={onSelect}>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px]">{title}</span>
        <span className="block text-[12px] text-muted">{body}</span>
      </span>
      {selected ? <Check size={16} className="mt-0.5" /> : null}
    </button>
  );
}

function PendingTurn({ text }: { text: string }) {
  return (
    <div className="space-y-6 pt-6">
      <div className="flex justify-end">
        <p className="max-w-[78%] whitespace-pre-wrap rounded-[22px] bg-bubble px-4 py-2.5 text-[15px] leading-6">{text}</p>
      </div>
      <p className="animate-pulse text-[15px] text-muted" role="status">
        Searching the library
      </p>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-6 pt-6" role="status" aria-label="Loading the chat">
      <div className="ml-auto h-11 w-1/2 animate-pulse rounded-[22px] bg-soft" />
      <div className="space-y-2.5">
        <div className="h-4 w-11/12 animate-pulse rounded bg-soft" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-soft" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-soft" />
      </div>
    </div>
  );
}

function ThreadBody({
  messages,
  onCite,
  onTicket,
  ticketDone,
}: {
  messages: ChatMessage[];
  onCite: (citation: Citation) => void;
  onTicket: () => void;
  ticketDone: boolean;
}) {
  return (
    <div className="space-y-8 pt-6">
      {messages.map((message) =>
        message.role === "user" ? (
          <article key={message.id} className="flex justify-end">
            <p className="max-w-[78%] whitespace-pre-wrap rounded-[22px] bg-bubble px-4 py-2.5 text-[15px] leading-6">{message.content}</p>
          </article>
        ) : (
          <AssistantTurn key={message.id} message={message} onCite={onCite} onTicket={onTicket} ticketDone={ticketDone} />
        ),
      )}
    </div>
  );
}

function AssistantTurn({
  message,
  onCite,
  onTicket,
  ticketDone,
}: {
  message: ChatMessage;
  onCite: (citation: Citation) => void;
  onTicket: () => void;
  ticketDone: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const citations = message.citations ?? [];
  const flag =
    message.kind === "conflict" ? "Sources disagree" : message.kind === "superseded" ? "This passage is superseded" : null;

  return (
    <article className="group">
      {flag ? (
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-warning">
          <Warning size={14} weight="fill" />
          {flag}
        </p>
      ) : null}
      <p className="text-[16px] leading-7">
        {message.segments?.length
          ? message.segments.map((segment, index) => {
              const citation = segment.cite ? citations[segment.cite - 1] : undefined;
              return (
                <span key={`${message.id}-${index}`}>
                  {segment.cite ? <mark className="rounded-sm bg-cite px-0.5 text-cite-ink">{segment.text}</mark> : segment.text}
                  {segment.cite && citation ? (
                    <button
                      className="relative mx-0.5 inline-flex h-[20px] min-w-[20px] -translate-y-px items-center justify-center rounded-full bg-primary px-1.5 align-middle text-[11px] font-semibold text-primary-ink after:absolute after:-inset-3 hover:bg-primary-hover"
                      type="button"
                      aria-label={`Source ${segment.cite}, ${citation.title}, page ${citation.page}`}
                      onClick={() => onCite(citation)}
                    >
                      {segment.cite}
                    </button>
                  ) : null}
                </span>
              );
            })
          : message.content}
      </p>
      {citations
        .filter((citation) => citation.status === "superseded" && citation.note)
        .map((citation) => (
          <p key={citation.id} className="mt-2 text-[14px] text-secondary">
            {citation.note}
          </p>
        ))}
      {citations.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {citations.map((citation) => (
            <button
              key={citation.id}
              className="w-[210px] max-w-full text-left"
              type="button"
              onClick={() => onCite(citation)}
            >
              <FileCard title={citation.title} detail={`Page ${citation.page}`} preview={citation.snippet} />
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1">
        <button
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink"
          type="button"
          aria-label={copied ? "Copied" : "Copy answer"}
          title={copied ? "Copied" : "Copy"}
          onClick={() => {
            void navigator.clipboard?.writeText(message.content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {message.kind === "decline" || message.kind === "search" ? (
          <button
            className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[13px] hover:bg-soft disabled:text-muted"
            type="button"
            disabled={ticketDone}
            onClick={onTicket}
          >
            {ticketDone ? "Reported to the registrar" : "Report missing document"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SourceRail({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlay = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(max-width: 1023px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false,
  );

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      className="fixed inset-0 z-30 flex flex-col bg-panel lg:static lg:w-[440px] lg:shrink-0 lg:border-l lg:border-line"
      data-mp-def="source-rail"
      data-mp-id={`source-${citation.id}`}
      role="dialog"
      aria-modal={overlay || undefined}
      aria-label="Source"
      onKeyDown={(event) => {
        if (overlay && event.key === "Tab") {
          event.preventDefault();
          closeRef.current?.focus();
        }
      }}
    >
      <div className="flex h-[52px] shrink-0 items-center justify-between pl-5 pr-2">
        <h2 className="text-[15px] font-medium">Sources</h2>
        <button ref={closeRef} className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Close sources" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="text-[15px] font-medium">{citation.title}</p>
        <p className="mt-0.5 text-[13px] text-muted">Page {citation.page}</p>
        {citation.note ? <p className="mt-3 text-[14px] leading-6 text-secondary">{citation.note}</p> : null}
        <article className="relative mt-5 min-h-[480px] rounded-lg bg-white px-7 py-8 text-[13px] leading-6 text-[#26251e] shadow-[0_1px_2px_rgb(38_37_30/8%),0_8px_24px_-12px_rgb(38_37_30/25%)] ring-1 ring-black/5">
          <p className="text-[11px] font-medium text-[#67665f]">Page {citation.page}</p>
          <p className="mt-6 font-medium">{citation.title}</p>
          <div className="mt-4 space-y-2" aria-hidden>
            <div className="h-2 w-full rounded bg-black/[0.06]" />
            <div className="h-2 w-11/12 rounded bg-black/[0.06]" />
            <div className="h-2 w-4/5 rounded bg-black/[0.06]" />
          </div>
          <mark className="block rounded-sm border border-cite-ink/30 bg-cite px-2 py-2 text-cite-ink" style={{ marginTop: citation.highlightTop }}>
            {citation.snippet}
          </mark>
          <div className="mt-4 space-y-2" aria-hidden>
            <div className="h-2 w-full rounded bg-black/[0.06]" />
            <div className="h-2 w-3/4 rounded bg-black/[0.06]" />
          </div>
        </article>
      </div>
    </aside>
  );
}
