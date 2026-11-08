"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";
import { Panel, Shell, useMe } from "@/components/shell";

const schema = z.object({
  current: z.string().min(1, "Enter the current password."),
  next: z.string().min(6, "Use at least 6 characters."),
});

export function SettingsScreen() {
  const me = useMe();
  const { resolvedTheme, setTheme } = useTheme();
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { current: "", next: "" } });
  const save = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => call("/api/harness/settings/password", { method: "POST", body: values }),
  });
  const dark = ready && resolvedTheme === "dark";
  return (
    <Shell>
      <Panel title="Settings">
        <section className="max-w-lg rounded-panel border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Profile</h2>
          <p className="mt-2 text-sm">{me.data?.name}</p>
          <p className="text-sm text-secondary">{me.data?.username}</p>
          <p className="text-xs text-muted">{me.data?.role}</p>
        </section>
        <section className="mt-4 max-w-lg rounded-panel border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Theme</h2>
          <button className="mt-3 min-h-9 rounded-control border border-line px-3 text-sm" type="button" onClick={() => setTheme(dark ? "light" : "dark")}>
            {dark ? "Switch to light theme" : "Switch to dark theme"}
          </button>
        </section>
        <form
          className="mt-4 max-w-lg space-y-3 rounded-panel border border-line bg-panel p-4"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
        >
          <h2 className="text-sm font-medium">Password</h2>
          <label className="block text-sm">
            Current password
            <input className="mt-1 min-h-9 w-full rounded-control border border-line px-3" type="password" {...form.register("current")} />
          </label>
          <label className="block text-sm">
            New password
            <input className="mt-1 min-h-9 w-full rounded-control border border-line px-3" type="password" {...form.register("next")} />
          </label>
          {form.formState.errors.next ? <p className="text-sm text-danger">{form.formState.errors.next.message}</p> : null}
          {save.isError ? <p className="text-sm text-danger">{save.error.message}</p> : null}
          {save.isSuccess ? <p className="text-sm" role="status">Password updated.</p> : null}
          <button className="min-h-9 rounded-control bg-primary px-4 text-sm text-primary-ink" type="submit">
            Update password
          </button>
        </form>
      </Panel>
    </Shell>
  );
}
