"use client";

import { Check, Eye, Flag, Prohibit, TextT, UploadSimple, UserPlus, X } from "@phosphor-icons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";
import { Bars } from "@/components/bars";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { AuditEvent, Health, LibraryDocument, PublicAccount, QueueItem, Ticket } from "@/lib/domain";

function Frame({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

const field = "mt-1.5 h-10 w-full rounded-lg border border-line bg-root px-3 text-[14px]";
const labelClass = "block text-[13px] font-medium text-secondary";
const quietButton = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary hover:bg-soft hover:text-ink";

export function QueueScreen() {
  const query = useQuery({ queryKey: ["queue"], queryFn: () => call<{ items: QueueItem[] }>("/api/harness/queue") });
  const upload = useMutation({
    mutationFn: (file: File) => call("/api/harness/queue/upload", { method: "POST", body: { name: file.name, mime: file.type } }),
    onSuccess: () => void query.refetch(),
  });
  const items = query.data?.items ?? [];
  return (
    <Frame>
      <Panel
        title="Queue"
        action={
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink">
            <UploadSimple size={16} />
            Upload document
            <input className="sr-only" aria-label="Upload document" type="file" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} />
          </label>
        }
      >
        {upload.isError ? <p className="mb-4 text-[14px] text-danger" role="alert">{upload.error.message}</p> : null}
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading the queue</p> : null}
        {query.isError ? <StateMessage title="Queue unavailable" body="Try again." onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && items.length === 0 ? <StateMessage title="Queue is clear" body="New scans and faculty shares land here." /> : null}
        {items.length > 0 ? (
          <section className="mb-6 rounded-panel border border-line bg-panel p-5">
            <h2 className="mb-4 text-[13px] font-medium">Read confidence</h2>
            <Bars rows={items.map((item) => ({ label: item.title, value: item.confidence, max: 100, suffix: `${item.confidence}%` }))} />
          </section>
        ) : null}
        {items.length > 0 ? (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel md:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3.5">
                <Link className="text-[14px] font-medium" href={`/admin/queue/${item.id}`}>{item.title}</Link>
                <p className="mt-1 text-[13px] text-muted">
                  {item.confidence}% · {item.handwritten ? "Handwritten" : "Typed"} · {item.status.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {items.length > 0 ? (
          <div className="mt-6 hidden overflow-x-auto rounded-panel border border-line bg-panel md:block">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Handwritten</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3.5">
                      <Link className="font-medium hover:underline" href={`/admin/queue/${item.id}`}>
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">
                      <span className="mr-2">{item.confidence}%</span>
                      <span className="inline-block h-1 w-16 rounded-full bg-soft align-middle">
                        <span className="block h-1 rounded-full bg-ink" style={{ width: `${item.confidence}%` }} />
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{item.handwritten ? "Handwritten" : "Typed"}</td>
                    <td className="px-4 py-3.5">{item.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3.5 text-secondary">{item.source === "faculty_share" ? "Faculty share" : "Upload"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </Frame>
  );
}

const reviewSchema = z.object({
  subject: z.string().min(1),
  grade: z.string().min(1),
  type: z.string().min(1),
  department: z.string().min(1),
  visibility: z.enum(["department", "institution"]),
  ocrText: z.string(),
});

export function ReviewScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["queue", id], queryFn: () => call<{ item: QueueItem }>(`/api/harness/queue/${id}`) });
  const item = query.data?.item;
  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    values: item
      ? { ...item.metadata, ocrText: item.ocrText }
      : { subject: "", grade: "", type: "", department: "", visibility: "department", ocrText: "" },
  });
  const review = useMutation({
    mutationFn: (action: "approve" | "reject" | "needs_transcription") =>
      call(`/api/harness/queue/${id}/review`, {
        method: "POST",
        body: { action, ocrText: form.getValues("ocrText"), metadata: form.getValues() },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["queue"] });
      await query.refetch();
    },
  });
  return (
    <Frame>
      <Panel title={item?.title ?? "Review"}>
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading the scan</p> : null}
        {query.isError ? <StateMessage title="Scan missing" body="It may have moved." /> : null}
        {item ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <article className="min-h-[480px] rounded-lg bg-white px-7 py-8 text-[14px] leading-7 text-[#26251e] shadow-[0_1px_2px_rgb(38_37_30/8%),0_8px_24px_-12px_rgb(38_37_30/25%)] ring-1 ring-black/5">
              <p className="text-[12px] text-[#67665f]">Page {item.page}</p>
              <div className="mt-8 space-y-4">
                {item.scanLines.map((line) => (
                  <p key={line} className={item.handwritten ? "italic" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            </article>
            <form className="space-y-4 rounded-panel border border-line bg-panel p-5" onSubmit={(event) => event.preventDefault()}>
              <label className={labelClass}>
                Editable text
                <textarea className="mt-1.5 min-h-40 w-full rounded-lg border border-line bg-root px-3 py-2.5 text-[14px] leading-6" {...form.register("ocrText")} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["subject", "grade", "type", "department"] as const).map((name) => (
                  <label key={name} className={`${labelClass} capitalize`}>
                    {name}
                    <input className={field} {...form.register(name)} />
                  </label>
                ))}
              </div>
              <label className={labelClass}>
                Visibility
                <select className={field} {...form.register("visibility")}>
                  <option value="department">Department</option>
                  <option value="institution">Institution</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink" type="button" onClick={() => review.mutate("approve")}>
                  <Check size={16} />
                  Approve
                </button>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-sm" type="button" onClick={() => review.mutate("needs_transcription")}>
                  <TextT size={16} />
                  Needs transcription
                </button>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-danger px-4 text-sm font-medium text-danger-ink" type="button" onClick={() => review.mutate("reject")}>
                  <X size={16} />
                  Reject
                </button>
              </div>
              {review.isSuccess ? <p className="mt-3 text-sm" role="status">Status is now {query.data?.item.status.replaceAll("_", " ")}.</p> : null}
              {review.isError ? <p className="mt-3 text-sm text-danger">{review.error.message}</p> : null}
            </form>
          </div>
        ) : null}
      </Panel>
    </Frame>
  );
}

export function DocumentsScreen() {
  const query = useQuery({ queryKey: ["documents"], queryFn: () => call<{ documents: LibraryDocument[] }>("/api/harness/documents") });
  const update = useMutation({
    mutationFn: (body: { id: string; status?: string; visibility?: string }) =>
      call(`/api/harness/documents/${body.id}`, { method: "POST", body }),
    onSuccess: () => void query.refetch(),
  });
  const docs = query.data?.documents ?? [];
  return (
    <Frame>
      <Panel title="Documents">
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading documents</p> : null}
        {!query.isLoading && docs.length === 0 ? <StateMessage title="No documents" body="Approved scans appear here." /> : null}
        {docs.length > 0 ? (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
            {docs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{doc.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {doc.scope} · {doc.visibility} · {doc.status} · v{doc.version}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button className={quietButton} type="button" onClick={() => update.mutate({ id: doc.id, visibility: doc.visibility === "institution" ? "department" : "institution" })}>
                    <Eye size={15} />
                    Toggle visibility
                  </button>
                  <button className={quietButton} type="button" onClick={() => update.mutate({ id: doc.id, status: "superseded" })}>
                    <Flag size={15} />
                    Supersede
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Frame>
  );
}

const inviteSchema = z.object({
  name: z.string().min(1, "Enter a name."),
  email: z.string().email("Enter an email."),
  role: z.enum(["faculty", "institution_admin"]),
  department: z.string().min(1, "Enter a department."),
});

export function PeopleScreen() {
  const query = useQuery({ queryKey: ["people"], queryFn: () => call<{ people: PublicAccount[] }>("/api/harness/people") });
  const client = useQueryClient();
  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: "", email: "", role: "faculty", department: "Science" },
  });
  const invite = useMutation({
    mutationFn: (values: z.infer<typeof inviteSchema>) => call("/api/harness/people", { method: "POST", body: values }),
    onSuccess: async () => {
      form.reset();
      await client.invalidateQueries({ queryKey: ["people"] });
    },
  });
  const status = useMutation({
    mutationFn: (body: { id: string; status: "active" | "disabled" }) => call(`/api/harness/people/${body.id}/status`, { method: "POST", body }),
    onSuccess: () => void query.refetch(),
  });
  return (
    <Frame>
      <Panel title="People">
        <form className="mb-6 grid gap-4 rounded-panel border border-line bg-panel p-5 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => invite.mutate(values))}>
          <label className={labelClass}>Name<input className={field} {...form.register("name")} /></label>
          <label className={labelClass}>Email<input className={field} {...form.register("email")} /></label>
          <label className={labelClass}>Department<input className={field} {...form.register("department")} /></label>
          <label className={labelClass}>
            Role
            <select className={field} {...form.register("role")}>
              <option value="faculty">Faculty</option>
              <option value="institution_admin">Institution admin</option>
            </select>
          </label>
          {form.formState.errors.email ? <p className="text-[13px] text-danger sm:col-span-2">{form.formState.errors.email.message}</p> : null}
          <button className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-medium text-primary-ink sm:col-span-2" type="submit">
            <UserPlus size={16} />
            Invite
          </button>
        </form>
        <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
          {(query.data?.people ?? []).map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{person.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">{person.role} · {person.department} · {person.status}</p>
              </div>
              {person.status === "pending" ? (
                <p className="text-[13px] text-muted">Waiting for approval</p>
              ) : (
                <button
                  className={quietButton}
                  type="button"
                  onClick={() => status.mutate({ id: person.id, status: person.status === "active" ? "disabled" : "active" })}
                >
                  {person.status === "active" ? <Prohibit size={16} /> : <Check size={16} />}
                  {person.status === "active" ? "Disable" : "Enable"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </Frame>
  );
}

export function TicketsScreen() {
  const query = useQuery({ queryKey: ["tickets"], queryFn: () => call<{ tickets: Ticket[] }>("/api/harness/tickets") });
  const resolve = useMutation({
    mutationFn: (body: { id: string; action: "approve" | "dismiss" }) => call(`/api/harness/tickets/${body.id}/resolve`, { method: "POST", body }),
    onSuccess: () => void query.refetch(),
  });
  const tickets = query.data?.tickets ?? [];
  return (
    <Frame>
      <Panel title="Tickets">
        {tickets.length === 0 ? <StateMessage title="No tickets" body="Missing-document reports and retirement requests show up here." /> : null}
        {tickets.length > 0 ? (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="px-4 py-4">
                <p className="text-[14px] font-medium">{ticket.title}</p>
                <p className="mt-1 text-[14px] leading-6 text-secondary">{ticket.detail}</p>
                <p className="mt-1 text-[12px] text-muted">{ticket.kind.replaceAll("_", " ")} · {ticket.status}</p>
                {ticket.status === "open" ? (
                  <div className="mt-3 flex gap-2">
                    <button className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-ink" type="button" onClick={() => resolve.mutate({ id: ticket.id, action: "approve" })}>
                      <Check size={15} />
                      Approve
                    </button>
                    <button className={quietButton} type="button" onClick={() => resolve.mutate({ id: ticket.id, action: "dismiss" })}>
                      <X size={15} />
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Frame>
  );
}

export function ActivityScreen() {
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => call<{ activity: { asked: { label: string; count: number }[]; opened: { title: string; count: number }[] }; recent: AuditEvent[] }>("/api/harness/activity"),
  });
  const health = useQuery({ queryKey: ["health"], queryFn: () => call<{ health: Health }>("/api/harness/health") });
  const data = query.data;
  return (
    <Frame>
      <Panel title="Activity">
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading activity</p> : null}
        {health.data ? (
          <section className="mb-6 rounded-panel border border-line bg-panel p-5">
            <h2 className="mb-4 text-[13px] font-medium">Health</h2>
            <Bars rows={healthRows(health.data.health)} />
          </section>
        ) : null}
        {data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-panel border border-line bg-panel p-5">
              <h2 className="mb-4 text-[13px] font-medium">Words people asked</h2>
              <Bars rows={data.activity.asked.map((item) => ({ label: item.label, value: item.count }))} />
            </section>
            <section className="rounded-panel border border-line bg-panel p-5">
              <h2 className="mb-4 text-[13px] font-medium">Pages opened</h2>
              <Bars rows={data.activity.opened.map((item) => ({ label: item.title, value: item.count }))} />
            </section>
          </div>
        ) : null}
        {data && data.recent.length > 0 ? (
          <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-panel">
            {data.recent.map((item) => (
              <li key={item.id} className="px-4 py-3.5 text-[14px] text-secondary">
                <span className="font-medium text-ink">{item.actor}</span> {item.action}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Frame>
  );
}

export function healthRows(health: Health) {
  return (["model", "ocr", "index"] as const).map((key) => ({
    label: key === "model" ? "Model" : key === "ocr" ? "OCR" : "Index",
    value: health[key] === "up" ? 100 : 0,
    max: 100,
    suffix: health[key] === "up" ? "100%" : "0%",
  }));
}

export function AuditScreen({ scope }: { scope: "admin" | "super" }) {
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["audit", scope, q],
    queryFn: () => call<{ events: AuditEvent[] }>(`/api/harness/audit?q=${encodeURIComponent(q)}`),
  });
  return (
    <Frame>
      <Panel title="Audit">
        <label className={`${labelClass} mb-6 max-w-md`}>
          Filter
          <input className={field} value={q} onChange={(event) => setQ(event.target.value)} />
        </label>
        {(query.data?.events.length ?? 0) === 0 && !query.isLoading ? <StateMessage title="No events" body="Try a different filter." /> : null}
        {(query.data?.events.length ?? 0) > 0 ? (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
            {query.data?.events.map((event) => (
              <li key={event.id} className="px-4 py-3.5">
                <p className="text-[14px] font-medium">{event.actor} · {event.action}</p>
                <p className="mt-0.5 text-[14px] text-secondary">{event.detail}</p>
                <p className="mt-1 text-[12px] text-muted">{event.institutionId}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Frame>
  );
}
