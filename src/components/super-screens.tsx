"use client";

import { Check } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { call } from "@/api/client";
import { AuditScreen, healthRows } from "@/components/admin-screens";
import { Bars } from "@/components/bars";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { AuditEvent, Health, PublicAccount } from "@/lib/domain";

export function OverviewScreen() {
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: () =>
      call<{
        queue: number;
        roles: Record<string, number>;
        institutionDocs: number;
        personalDocs: number;
        waiting: number;
        audit: AuditEvent[];
        health: Health;
      }>("/api/harness/overview"),
  });
  const words = useQuery({
    queryKey: ["activity"],
    queryFn: () => call<{ activity: { asked: { label: string; count: number }[] } }>("/api/harness/activity"),
  });
  const data = query.data;
  return (
    <Shell>
      <Panel title="Overview">
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading the overview</p> : null}
        {data ? (
          <div className="space-y-6">
            <section className="rounded-panel border border-line bg-panel p-5">
              <h2 className="mb-4 text-[13px] font-medium">Right now</h2>
              <Bars
                rows={[
                  { label: "Waiting for approval", value: data.waiting },
                  { label: "Queue", value: data.queue },
                  { label: "Faculty", value: data.roles.faculty ?? 0 },
                  { label: "Slides", value: data.institutionDocs },
                ]}
              />
              <Link className="mt-4 inline-flex text-[14px] font-medium text-ink underline underline-offset-4" href="/super-admin/accounts">
                Review accounts
              </Link>
            </section>
            <section className="rounded-panel border border-line bg-panel p-5">
              <h2 className="mb-4 text-[13px] font-medium">Health</h2>
              <Bars rows={healthRows(data.health)} />
            </section>
            {words.data ? (
              <section className="rounded-panel border border-line bg-panel p-5">
                <h2 className="mb-4 text-[13px] font-medium">Words people asked</h2>
                <Bars rows={words.data.activity.asked.map((item) => ({ label: item.label, value: item.count }))} />
              </section>
            ) : null}
            <section className="rounded-panel border border-line bg-panel">
              <h2 className="px-4 pb-1 pt-4 text-[13px] font-medium">Live audit</h2>
              <ul className="divide-y divide-line">
                {data.audit.map((event) => (
                  <li key={event.id} className="px-4 py-3.5 text-[14px] leading-6 text-secondary">
                    <span className="font-medium text-ink">{event.actor}</span> · {event.action} · {event.detail}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Panel>
    </Shell>
  );
}

export function AccountsScreen() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["accounts"],
    queryFn: () => call<{ accounts: PublicAccount[] }>("/api/harness/accounts"),
  });
  const approve = useMutation({
    mutationFn: (id: string) => call(`/api/harness/accounts/${id}/approve`, { method: "POST", body: {} }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["accounts"] }),
  });
  const accounts = query.data?.accounts ?? [];
  return (
    <Shell>
      <Panel title="Accounts">
        {query.isLoading ? <p className="text-[14px] text-muted" role="status">Loading accounts</p> : null}
        {!query.isLoading && accounts.length === 0 ? <StateMessage title="No one is waiting" body="New registrations show up here until you approve them." /> : null}
        {accounts.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-panel">
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{account.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{account.username} · {account.email}</p>
                </div>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-ink"
                  type="button"
                  onClick={() => approve.mutate(account.id)}
                >
                  <Check size={15} />
                  Approve
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Shell>
  );
}

export function InstitutionsScreen() {
  const query = useQuery({
    queryKey: ["institutions"],
    queryFn: () =>
      call<{ institutions: { id: string; name: string; city: string; people: number; documents: number; personal: number; queue: number }[] }>(
        "/api/harness/institutions",
      ),
  });
  return (
    <Shell>
      <Panel title="Institutions">
        {(query.data?.institutions.length ?? 0) === 0 && !query.isLoading ? <p className="text-[14px] text-muted">No schools yet.</p> : null}
        {(query.data?.institutions.length ?? 0) > 0 ? (
          <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
            {query.data?.institutions.map((institution) => (
              <li key={institution.id} className="px-4 py-4">
                <p className="text-[14px] font-medium">{institution.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">{institution.city}</p>
                <p className="mt-2 text-[14px] text-secondary">
                  {institution.people} people · {institution.documents} slides · {institution.personal} in My folder · {institution.queue} waiting
                </p>
                {institution.documents === 0 ? <p className="mt-2 text-[14px]">No documents yet.</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Shell>
  );
}

export function SuperAuditScreen() {
  return <AuditScreen scope="super" />;
}

export function HealthScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["health"], queryFn: () => call<{ health: Health }>("/api/harness/health") });
  const update = useMutation({
    mutationFn: (health: Partial<Health>) => call("/api/harness/health", { method: "PUT", body: health }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["health"] }),
  });
  const health = query.data?.health;
  return (
    <Shell>
      <Panel title="Health">
        {health ? (
          <section className="mb-6 rounded-panel border border-line bg-panel p-5">
            <h2 className="mb-4 text-[13px] font-medium">Services</h2>
            <Bars rows={healthRows(health)} />
          </section>
        ) : null}
        {health ? (
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-panel">
            {(
              [
                ["model", "Model"],
                ["ocr", "OCR"],
                ["index", "Index"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={health[key] === "up" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-danger"} aria-hidden />
                  <div>
                    <p className="text-[14px] font-medium">{label}</p>
                    <p className="text-[12px] text-muted">{health[key] === "up" ? "Running" : "Offline"}</p>
                  </div>
                </div>
                <button
                  className="h-8 rounded-lg px-3 text-[13px] text-secondary hover:bg-soft hover:text-ink"
                  type="button"
                  onClick={() => update.mutate({ [key]: health[key] === "up" ? "down" : "up" })}
                >
                  Mark {health[key] === "up" ? "offline" : "running"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted" role="status">Loading health</p>
        )}
      </Panel>
    </Shell>
  );
}
