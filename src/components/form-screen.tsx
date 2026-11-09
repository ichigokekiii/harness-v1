"use client";

import { Eraser, FilePdf, FloppyDisk, UploadSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { call } from "@/api/client";
import { FileCard } from "@/components/file-card";
import { Panel, Shell, StateMessage } from "@/components/shell";
import type { FormDraft } from "@/lib/domain";

export function FormsHome() {
  const query = useQuery({ queryKey: ["forms"], queryFn: () => call<{ forms: FormDraft[] }>("/api/harness/forms") });
  return (
    <Shell>
      <Panel title="Forms">
        {query.isLoading ? <p role="status">Loading forms</p> : null}
        {(query.data?.forms.length ?? 0) === 0 ? <StateMessage title="No forms" body="A scanned form will show up here." /> : null}
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {(query.data?.forms ?? []).map((form) => (
            <li key={form.id} className="min-w-0">
              <Link href={`/forms/${form.id}`}>
                <FileCard title={form.title} detail={form.sourceLabel} preview={form.title} image={form.sourcePreview} fit="contain" />
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
  const { resolvedTheme } = useTheme();
  const pen = resolvedTheme === "dark" ? "#edecec" : "#26251e";
  const signatureUrl = form?.signature ?? null;
  const formId = form?.id;
  useEffect(() => {
    if (!canvas.current) return;
    const signature = new SignaturePad(canvas.current, { penColor: pen });
    pad.current = signature;
    if (signatureUrl) void signature.fromDataURL(signatureUrl);
    return () => signature.off();
  }, [formId, signatureUrl, pen]);
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
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgb(38_37_30/8%),0_8px_24px_-12px_rgb(38_37_30/25%)] ring-1 ring-black/5">
              <p className="px-4 pb-2 pt-3 text-[12px] text-[#67665f]">{form.sourceLabel}</p>
              {form.sourcePreview && form.sourceFile ? (
                <a href={form.sourceFile} target="_blank" rel="noreferrer" aria-label={`Open ${form.sourceLabel}`}>
                  <Image src={form.sourcePreview} alt="" width={540} height={700} className="h-auto w-full" />
                </a>
              ) : null}
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
                <canvas ref={canvas} width={480} height={160} className="mt-1 w-full rounded-control border border-line bg-panel" aria-label="Signature pad" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm" type="button" onClick={() => pad.current?.clear()}>
                    <Eraser size={16} />
                    Clear signature
                  </button>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm">
                    <UploadSimple size={16} />
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
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink" type="submit">
                  <FloppyDisk size={16} />
                  Save draft
                </button>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-sm" type="button" onClick={() => window.print()}>
                  <FilePdf size={16} />
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
