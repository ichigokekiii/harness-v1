"use client";

import { Archive, ShareNetwork, UploadSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { call } from "@/api/client";
import { FileCard, lessonCover } from "@/components/file-card";
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
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink">
            <UploadSimple size={16} />
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
              className={`min-h-9 rounded-control px-3 text-sm ${scope === item ? "bg-panel font-medium shadow-sm" : "text-secondary"}`}
              type="button"
              role="tab"
              aria-selected={scope === item}
              onClick={() => setScope(item)}
            >
              {item === "institution" ? "Slides" : "My folder"}
            </button>
          ))}
        </div>
        {upload.isError ? <p className="mb-3 text-sm text-danger" role="alert">{upload.error.message}</p> : null}
        {upload.data ? <p className="mb-3 text-sm text-secondary" role="status">{upload.data.message}</p> : null}
        {retire.isSuccess ? <p className="mb-3 text-sm text-secondary" role="status">Retirement request sent.</p> : null}
        {query.isLoading ? <p role="status">Loading the library</p> : null}
        {query.isError ? <StateMessage title="Library unavailable" body="Try the folder again." onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && docs.length === 0 ? <StateMessage title="Nothing in this folder" body="Upload a PDF, JPEG, or PNG. A DOCX file can be a slide source." /> : null}
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc, index) => (
            <li key={doc.id} className="min-w-0">
              <FileCard
                title={doc.title}
                detail={`${doc.kind} · ${doc.pageCount} pages · ${doc.status}${doc.shareStatus ? ` · share ${doc.shareStatus}` : ""}`}
                preview={doc.versions.at(-1)?.note || doc.title}
                image={lessonCover(index)}
                slide={index % 2 === 0 ? { kicker: "Grade 7 English", title: "Show, don't tell" } : undefined}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 px-0.5">
                {doc.scope === "personal" ? (
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={() => share.mutate(doc.id)}>
                    <ShareNetwork size={15} />
                    Share to institution library
                  </button>
                ) : (
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={() => retire.mutate(doc.id)}>
                    <Archive size={15} />
                    Request retirement
                  </button>
                )}
                <details className="text-[12px] text-secondary">
                  <summary className="cursor-pointer rounded-lg px-2 py-1 hover:bg-soft">Version history</summary>
                  <ul className="mt-1 space-y-1 px-2">
                    {doc.versions.map((version) => (
                      <li key={`${doc.id}-${version.version}`}>
                        v{version.version}: {version.note}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Shell>
  );
}
