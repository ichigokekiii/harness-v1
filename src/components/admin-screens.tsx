"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { AuditEvent, LibraryDocument, PublicAccount, QueueItem, Ticket } from "@/lib/domain";

function Frame({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

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
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded-control bg-primary px-4 text-sm text-primary-ink">
            Upload document
            <input className="sr-only" aria-label="Upload document" type="file" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} />
          </label>
        }
      >
        {upload.isError ? <p className="mb-3 text-sm text-danger" role="alert">{upload.error.message}</p> : null}
        {query.isLoading ? <p role="status">Loading the queue</p> : null}
        {query.isError ? <StateMessage title="Queue unavailable" body="Try again." onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && items.length === 0 ? <StateMessage title="Queue is clear" body="New scans and faculty shares land here." /> : null}
        <div className="overflow-x-auto rounded-panel border border-line bg-panel">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Document</th>
                <th className="px-3 py-3 font-medium">Confidence</th>
                <th className="px-3 py-3 font-medium">Handwritten</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Link className="inline-flex min-h-9 items-center font-medium" href={`/admin/queue/${item.id}`}>
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="mr-2">{item.confidence}%</span>
                    <span className="inline-block h-1.5 w-16 rounded bg-soft align-middle">
                      <span className="block h-1.5 rounded bg-primary" style={{ width: `${item.confidence}%` }} />
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.handwritten ? "Handwritten" : "Typed"}</td>
                  <td className="px-3 py-2">{item.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">{item.source === "faculty_share" ? "Faculty share" : "Upload"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        {query.isLoading ? <p role="status">Loading the scan</p> : null}
        {query.isError ? <StateMessage title="Scan missing" body="It may have moved." /> : null}
        {item ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="min-h-[420px] rounded-panel border border-line bg-panel p-6">
              <p className="text-xs text-muted">Scan · page {item.page}</p>
              <div className="mt-6 space-y-3 font-mono text-sm leading-7">
                {item.scanLines.map((line) => (
                  <p key={line} className={item.handwritten ? "italic" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            </article>
            <form className="rounded-panel border border-line bg-panel p-4" onSubmit={(event) => event.preventDefault()}>
              <label className="block text-sm">
                Editable text
                <textarea className="mt-1 min-h-40 w-full rounded-control border border-line bg-root px-3 py-2" {...form.register("ocrText")} />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["subject", "grade", "type", "department"] as const).map((field) => (
                  <label key={field} className="block text-sm capitalize">
                    {field}
                    <input className="mt-1 min-h-9 w-full rounded-control border border-line bg-root px-3" {...form.register(field)} />
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-sm">
                Visibility
                <select className="mt-1 min-h-9 w-full rounded-control border border-line bg-root px-3" {...form.register("visibility")}>
                  <option value="department">Department</option>
                  <option value="institution">Institution</option>
                </select>
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="min-h-9 rounded-control bg-primary px-4 text-sm text-primary-ink" type="button" onClick={() => review.mutate("approve")}>
                  Approve
                </button>
                <button className="min-h-9 rounded-control border border-line px-4 text-sm" type="button" onClick={() => review.mutate("needs_transcription")}>
                  Needs transcription
                </button>
                <button className="min-h-9 rounded-control bg-danger px-4 text-sm text-danger-ink" type="button" onClick={() => review.mutate("reject")}>
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
        {query.isLoading ? <p role="status">Loading documents</p> : null}
        {docs.length === 0 ? <StateMessage title="No documents" body="Approved scans appear here." /> : null}
        <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
          {docs.map((doc) => (
            <li key={doc.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-muted">
                  {doc.scope} · {doc.visibility} · {doc.status} · v{doc.version}
                </p>
              </div>
              <button className="min-h-9 rounded-control border border-line px-3 text-sm" type="button" onClick={() => update.mutate({ id: doc.id, visibility: doc.visibility === "institution" ? "department" : "institution" })}>
                Toggle visibility
              </button>
              <button className="min-h-9 rounded-control border border-line px-3 text-sm" type="button" onClick={() => update.mutate({ id: doc.id, status: "superseded" })}>
                Supersede
              </button>
            </li>
          ))}
        </ul>
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
        <form className="mb-4 grid gap-3 rounded-panel border border-line bg-panel p-4 md:grid-cols-4" onSubmit={form.handleSubmit((values) => invite.mutate(values))}>
          <label className="text-sm">Name<input className="mt-1 min-h-9 w-full rounded-control border border-line px-3" {...form.register("name")} /></label>
          <label className="text-sm">Email<input className="mt-1 min-h-9 w-full rounded-control border border-line px-3" {...form.register("email")} /></label>
          <label className="text-sm">Department<input className="mt-1 min-h-9 w-full rounded-control border border-line px-3" {...form.register("department")} /></label>
          <label className="text-sm">
            Role
            <select className="mt-1 min-h-9 w-full rounded-control border border-line px-3" {...form.register("role")}>
              <option value="faculty">Faculty</option>
              <option value="institution_admin">Institution admin</option>
            </select>
          </label>
          <button className="min-h-9 rounded-control bg-primary px-4 text-sm text-primary-ink md:col-span-4 md:justify-self-start" type="submit">
            Invite
          </button>
          {form.formState.errors.email ? <p className="text-sm text-danger md:col-span-4">{form.formState.errors.email.message}</p> : null}
        </form>
        <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
          {(query.data?.people ?? []).map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{person.name}</p>
                <p className="text-xs text-muted">{person.role} · {person.department} · {person.status}</p>
              </div>
              <button
                className="min-h-9 rounded-control border border-line px-3 text-sm"
                type="button"
                onClick={() => status.mutate({ id: person.id, status: person.status === "active" ? "disabled" : "active" })}
              >
                {person.status === "active" ? "Disable" : "Enable"}
              </button>
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
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-panel border border-line bg-panel p-4">
              <p className="text-sm font-medium">{ticket.title}</p>
              <p className="mt-1 text-sm text-secondary">{ticket.detail}</p>
              <p className="mt-1 text-xs text-muted">{ticket.kind.replaceAll("_", " ")} · {ticket.status}</p>
              {ticket.status === "open" ? (
                <div className="mt-3 flex gap-2">
                  <button className="min-h-9 rounded-control bg-primary px-3 text-sm text-primary-ink" type="button" onClick={() => resolve.mutate({ id: ticket.id, action: "approve" })}>
                    Approve
                  </button>
                  <button className="min-h-9 rounded-control border border-line px-3 text-sm" type="button" onClick={() => resolve.mutate({ id: ticket.id, action: "dismiss" })}>
                    Dismiss
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </Frame>
  );
}

export function ActivityScreen() {
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => call<{ activity: { asked: { label: string; count: number }[]; opened: { title: string; count: number }[] }; recent: AuditEvent[] }>("/api/harness/activity"),
  });
  const data = query.data;
  return (
    <Frame>
      <Panel title="Activity">
        {query.isLoading ? <p role="status">Loading activity</p> : null}
        {data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title="Most asked" rows={data.activity.asked.map((item) => `${item.label} · ${item.count}`)} />
            <ListCard title="Most opened" rows={data.activity.opened.map((item) => `${item.title} · ${item.count}`)} />
            <ListCard title="Recent" rows={data.recent.map((item) => `${item.actor} ${item.action}`)} />
          </div>
        ) : null}
      </Panel>
    </Frame>
  );
}

function ListCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="rounded-panel border border-line bg-panel p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-secondary">
        {rows.length === 0 ? <li>Nothing yet</li> : rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </section>
  );
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
        <label className="mb-3 block text-sm">
          Filter
          <input className="mt-1 min-h-9 w-full max-w-md rounded-control border border-line bg-panel px-3" value={q} onChange={(event) => setQ(event.target.value)} />
        </label>
        {(query.data?.events.length ?? 0) === 0 ? <StateMessage title="No events" body="Try a different filter." /> : null}
        <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
          {(query.data?.events ?? []).map((event) => (
            <li key={event.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{event.actor} · {event.action}</p>
              <p className="text-secondary">{event.detail}</p>
              <p className="text-xs text-muted">{event.institutionId}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </Frame>
  );
}
