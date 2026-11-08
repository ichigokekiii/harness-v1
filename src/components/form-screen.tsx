"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { call } from "@/api/client";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { FormDraft } from "@/lib/domain";

export function FormsHome() {
  const query = useQuery({ queryKey: ["forms"], queryFn: () => call<{ forms: FormDraft[] }>("/api/harness/forms") });
  return (
    <Shell>
      <Panel title="Forms">
        {query.isLoading ? <p role="status">Loading forms</p> : null}
        {(query.data?.forms.length ?? 0) === 0 ? <StateMessage title="No forms" body="A scanned form will show up here." /> : null}
        <ul className="grid gap-3">
          {(query.data?.forms ?? []).map((form) => (
            <li key={form.id}>
              <Link className="block min-h-20 rounded-panel border border-line bg-panel p-4" href={`/forms/${form.id}`}>
                <p className="text-sm font-medium">{form.title}</p>
                <p className="text-xs text-muted">{form.sourceLabel}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Shell>
  );
}

export function FormEditor({ id }: { id: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["form", id], queryFn: () => call<{ form: FormDraft }>(`/api/harness/forms/${id}`) });
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const form = draft ?? query.data?.form ?? null;
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);
  const signatureUrl = form?.signature ?? null;
  const formId = form?.id;
  useEffect(() => {
    if (!canvas.current) return;
    const signature = new SignaturePad(canvas.current, { penColor: "#002d62" });
    pad.current = signature;
    if (signatureUrl) void signature.fromDataURL(signatureUrl);
    return () => signature.off();
  }, [formId, signatureUrl]);
  const save = useMutation({
    mutationFn: () =>
      call(`/api/harness/forms/${id}`, {
        method: "PUT",
        body: { fields: form?.fields ?? [], signature: pad.current && !pad.current.isEmpty() ? pad.current.toDataURL() : form?.signature ?? null },
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["form", id] }),
  });
  return (
    <Shell>
      <Panel title={form?.title ?? "Form"}>
        {query.isLoading ? <p role="status">Loading the form</p> : null}
        {query.isError ? <StateMessage title="Form missing" body="Open the form list." /> : null}
        {form ? (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-panel border border-dashed border-line bg-panel p-6">
              <p className="text-xs text-muted">{form.sourceLabel}</p>
              <p className="mt-8 font-mono text-sm leading-7">Leave form</p>
              <p className="font-mono text-sm">Employee name ________</p>
              <p className="font-mono text-sm">Dates ________</p>
            </article>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              {form.fields.map((field) => (
                <label key={field.id} className="block text-sm">
                  {field.label}
                  {field.required ? " *" : ""}
                  {field.kind === "long" ? (
                    <textarea
                      className="mt-1 min-h-24 w-full rounded-control border border-line bg-panel px-3 py-2"
                      value={field.value}
                      onChange={(event) =>
                        setDraft({ ...form, fields: form.fields.map((item) => (item.id === field.id ? { ...item, value: event.target.value } : item)) })
                      }
                    />
                  ) : field.kind === "yesno" ? (
                    <select
                      className="mt-1 min-h-9 w-full rounded-control border border-line bg-panel px-3"
                      value={field.value}
                      onChange={(event) =>
                        setDraft({ ...form, fields: form.fields.map((item) => (item.id === field.id ? { ...item, value: event.target.value } : item)) })
                      }
                    >
                      <option value="">Choose</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : (
                    <input
                      className="mt-1 min-h-9 w-full rounded-control border border-line bg-panel px-3"
                      type={field.kind === "date" ? "date" : "text"}
                      value={field.value}
                      onChange={(event) =>
                        setDraft({ ...form, fields: form.fields.map((item) => (item.id === field.id ? { ...item, value: event.target.value } : item)) })
                      }
                    />
                  )}
                </label>
              ))}
              <div>
                <p className="text-sm">Signature</p>
                <canvas ref={canvas} width={480} height={160} className="mt-1 w-full rounded-control border border-line bg-white" aria-label="Signature pad" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="min-h-9 rounded-control border border-line px-3 text-sm" type="button" onClick={() => pad.current?.clear()}>
                    Clear signature
                  </button>
                  <label className="inline-flex min-h-9 cursor-pointer items-center rounded-control border border-line px-3 text-sm">
                    Upload signature
                    <input
                      className="sr-only"
                      aria-label="Upload signature"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = String(reader.result);
                          setDraft({ ...form, signature: url });
                          void pad.current?.fromDataURL(url);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="min-h-9 rounded-control bg-primary px-4 text-sm text-primary-ink" type="submit">
                  Save draft
                </button>
                <button className="min-h-9 rounded-control border border-line px-4 text-sm" type="button" onClick={() => window.print()}>
                  Export PDF
                </button>
              </div>
              {save.isSuccess ? <p role="status" className="text-sm">Draft saved.</p> : null}
            </form>
          </div>
        ) : null}
      </Panel>
    </Shell>
  );
}
