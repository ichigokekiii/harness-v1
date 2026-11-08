"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";

const schema = z.object({
  username: z.string().min(1, "Enter a username."),
  password: z.string().min(1, "Enter a password."),
});

type FormValues = z.infer<typeof schema>;

const accounts = [
  ["faculty", "Demo Teacher", "teacher@sampleacademy.test"],
  ["admin", "Demo Registrar", "registrar@sampleacademy.test"],
  ["superadmin", "Demo Operator", "operator@sampleacademy.test"],
] as const;

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const mock = params.get("google") === "mock";
  const failed = params.get("error") === "google";
  const [error, setError] = useState<string | null>(failed ? "The account chooser could not finish." : null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const result = await call<{ home: string }>("/api/auth/login", { method: "POST", body: values });
      router.push(result.home);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    }
  }

  async function choose(email: string) {
    setError(null);
    try {
      const result = await call<{ home: string }>("/api/auth/google/mock", { method: "POST", body: { email } });
      router.push(result.home);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-navy px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm font-medium tracking-tight">Harness</p>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight">Find a page. Make the lesson. Admit the scan.</h1>
          <p className="mt-4 text-sm leading-6 text-white/80">Sample Academy. One local model. Answers stay next to the page they came from.</p>
        </div>
        <p className="text-xs text-white/70">Draft-AI stays labeled until a teacher edits it.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm" data-mp-def="login-form" data-mp-id="login-form">
          <p className="text-sm font-semibold lg:hidden">Harness</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-secondary">Password for every sample account is 123456.</p>
          <ul className="mt-4 space-y-1 text-sm text-secondary">
            {accounts.map(([username, name]) => (
              <li key={username}>
                {name}: <span className="font-mono text-ink">{username}</span>
              </li>
            ))}
          </ul>
          <form className="mt-6 space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <label className="block text-sm">
              Username
              <input className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-3" {...form.register("username")} />
              {form.formState.errors.username ? <span className="mt-1 block text-sm text-danger">{form.formState.errors.username.message}</span> : null}
            </label>
            <label className="block text-sm">
              Password
              <input className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-3" type="password" {...form.register("password")} />
              {form.formState.errors.password ? <span className="mt-1 block text-sm text-danger">{form.formState.errors.password.message}</span> : null}
            </label>
            {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
            <button className="min-h-11 w-full rounded-control bg-primary text-sm font-medium text-primary-ink" type="submit" disabled={form.formState.isSubmitting}>
              Log in
            </button>
          </form>
          <a className="mt-3 flex min-h-11 items-center justify-center rounded-control border border-line text-sm" href="/api/auth/google">
            Continue with Google
          </a>
          {mock ? (
            <div className="mt-4 rounded-panel border border-line bg-panel p-3">
              <p className="text-sm font-medium">Choose a sample account</p>
              <div className="mt-2 flex flex-col gap-2">
                {accounts.map(([username, name, email]) => (
                  <button key={email} className="min-h-11 rounded-control border border-line px-3 text-left text-sm" type="button" onClick={() => void choose(email)}>
                    {name}
                    <span className="mt-0.5 block text-xs text-muted">{username}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
