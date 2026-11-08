"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { call } from "@/api/client";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { LibraryDocument } from "@/lib/domain";

export function LibraryScreen() {
  const [scope, setScope] = useState<"institution" | "personal">("institution");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["library", scope],
    queryFn: () => call<{ documents: LibraryDocument[] }>(`/api/harness/library?scope=${scope}`),
  });
  const upload = useMutation({
    mutationFn: (file: File) => call<{ message: string }>("/api/harness/library/upload", { method: "POST", body: { name: file.name, mime: file.type } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["library"] });
    },
  });
  const share = useMutation({
    mutationFn: (id: string) => call(`/api/harness/library/${id}/share`, { method: "POST", body: {} }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["library"] });
    },
  });
  const retire = useMutation({
    mutationFn: (id: string) => call(`/api/harness/library/${id}/retire`, { method: "POST", body: {} }),
  });
  const docs = query.data?.documents ?? [];
  return (
    <Shell>
      <Panel
        title="Library"
        action={
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-control bg-primary px-4 text-sm text-primary-ink">
            Upload
            <input
              className="sr-only"
              aria-label="Upload"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
          </label>
        }
      >
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Library folders">
          {(["institution", "personal"] as const).map((item) => (
            <button
              key={item}
              className={`min-h-11 rounded-control px-3 text-sm ${scope === item ? "bg-panel font-medium shadow-sm" : "text-secondary"}`}
              type="button"
              role="tab"
              aria-selected={scope === item}
              onClick={() => setScope(item)}
            >
              {item === "institution" ? "Institution" : "My folder"}
            </button>
          ))}
        </div>
        {upload.isError ? <p className="mb-3 text-sm text-danger" role="alert">{upload.error.message}</p> : null}
        {upload.data ? <p className="mb-3 text-sm text-secondary" role="status">{upload.data.message}</p> : null}
        {retire.isSuccess ? <p className="mb-3 text-sm text-secondary" role="status">Retirement request sent.</p> : null}
        {query.isLoading ? <p role="status">Loading the library</p> : null}
        {query.isError ? <StateMessage title="Library unavailable" body="Try the folder again." onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && docs.length === 0 ? <StateMessage title="Nothing in this folder" body="Upload a PDF, JPEG, or PNG. A DOCX file can be a slide source." /> : null}
        <ul className="divide-y divide-line rounded-panel border border-line bg-panel">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-muted">
                  {doc.kind} · {doc.pageCount} pages · {doc.status}
                  {doc.shareStatus ? ` · share ${doc.shareStatus}` : ""}
                </p>
                <details className="mt-1 text-xs text-secondary">
                  <summary className="min-h-11 cursor-pointer py-2">Version history</summary>
                  <ul>
                    {doc.versions.map((version) => (
                      <li key={`${doc.id}-${version.version}`}>
                        v{version.version}: {version.note}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <div className="flex gap-2">
                {doc.scope === "personal" ? (
                  <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => share.mutate(doc.id)}>
                    Share to institution library
                  </button>
                ) : (
                  <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => retire.mutate(doc.id)}>
                    Request retirement
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Shell>
  );
}
