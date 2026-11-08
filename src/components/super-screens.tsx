"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { call } from "@/api/client";
import { AuditScreen } from "@/components/admin-screens";
import { Panel, Shell } from "@/components/shell";
import type { AuditEvent, Health } from "@/lib/domain";

export function OverviewScreen() {
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: () =>
      call<{
        queue: number;
        roles: Record<string, number>;
        institutionDocs: number;
        personalDocs: number;
        audit: AuditEvent[];
        health: Health;
      }>("/api/harness/overview"),
  });
  const data = query.data;
  return (
    <Shell>
      <Panel title="Overview">
        {query.isLoading ? <p role="status">Loading the overview</p> : null}
        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Queue depth" value={String(data.queue)} />
              <Stat label="Faculty" value={String(data.roles.faculty)} />
              <Stat label="Institution docs" value={String(data.institutionDocs)} />
              <Stat label="Personal docs" value={String(data.personalDocs)} />
            </div>
            <section className="mt-4 rounded-panel border border-line bg-panel p-4">
              <h2 className="text-sm font-medium">Live audit</h2>
              <ul className="mt-3 space-y-2 text-sm text-secondary">
                {data.audit.map((event) => (
                  <li key={event.id}>
                    {event.actor} · {event.action} · {event.detail}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </Panel>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-panel border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
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
        <ul className="grid gap-3">
          {(query.data?.institutions ?? []).map((institution) => (
            <li key={institution.id} className="rounded-panel border border-line bg-panel p-4">
              <p className="text-sm font-medium">{institution.name}</p>
              <p className="text-xs text-muted">{institution.city}</p>
              <p className="mt-2 text-sm text-secondary">
                {institution.people} people · {institution.documents} institution docs · {institution.personal} personal docs · {institution.queue} waiting
              </p>
              {institution.documents === 0 ? <p className="mt-2 text-sm">No documents yet.</p> : null}
            </li>
          ))}
        </ul>
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
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-panel">
            {(
              [
                ["model", "Model"],
                ["ocr", "OCR"],
                ["index", "Index"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={health[key] === "up" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-danger"} aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted">{health[key] === "up" ? "Running" : "Offline"}</p>
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
          <p role="status">Loading health</p>
        )}
      </Panel>
    </Shell>
  );
}
