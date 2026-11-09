"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";
import { Mark } from "@/components/mark";

const schema = z.object({
  username: z.string().min(1, "Enter a username."),
  password: z.string().min(1, "Enter a password."),
});

type FormValues = z.infer<typeof schema>;

const field =
  "mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-3 text-[15px] transition-colors hover:border-ink/25 focus:border-ink/40 focus-visible:outline-none";

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const failed = params.get("error") === "google";
  const [error, setError] = useState<string | null>(failed ? "Google sign-in is not set up on this server." : null);
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

  return (
    <main className="flex min-h-dvh flex-col bg-root">
      <header className="flex h-16 shrink-0 items-center px-6">
        <Mark />
      </header>
      <section className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-[400px]" data-mp-def="login-form" data-mp-id="login-form">
          <h1 className="text-[22px] font-medium leading-7 tracking-[-0.02em]">
            Sign in to Tabi
            <span className="block text-muted">Your school library, on this machine.</span>
          </h1>

          <a
            className="mt-8 flex h-10 items-center justify-center gap-2.5 rounded-control border border-line bg-panel text-[15px] font-medium transition-colors hover:bg-soft"
            href="/api/auth/google"
          >
                <GoogleMark />
                Continue with Google
              </a>
              <div className="my-6 flex items-center gap-3 text-[12px] text-muted" aria-hidden>
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <label className="block text-[13px] font-medium text-secondary">
                  Username
                  <input className={field} autoComplete="username" autoCapitalize="none" spellCheck={false} {...form.register("username")} />
                  {form.formState.errors.username ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.username.message}</span> : null}
                </label>
                <label className="block text-[13px] font-medium text-secondary">
                  Password
                  <input className={field} type="password" autoComplete="current-password" {...form.register("password")} />
                  {form.formState.errors.password ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.password.message}</span> : null}
                </label>
                {error ? <p className="text-[14px] text-danger" role="alert">{error}</p> : null}
                <button
                  className="h-10 w-full rounded-control bg-primary text-[15px] font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:opacity-60"
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Signing in" : "Log in"}
                </button>
                <p className="text-[14px] text-secondary">
                  New here?{" "}
                  <Link className="font-medium text-ink underline underline-offset-4" href="/register">
                    Create an account
                  </Link>
                </p>
              </form>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
