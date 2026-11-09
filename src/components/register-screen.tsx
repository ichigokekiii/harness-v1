"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { call } from "@/api/client";
import { Mark } from "@/components/mark";

const schema = z.object({
  name: z.string().min(1, "Enter your name."),
  username: z.string().min(1, "Choose a username."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(6, "Use at least 6 characters."),
});

type FormValues = z.infer<typeof schema>;

const field =
  "mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-3 text-[15px] transition-colors hover:border-ink/25 focus:border-ink/40 focus-visible:outline-none";

export function RegisterScreen() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", username: "", email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await call("/api/auth/register", { method: "POST", body: values });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account.");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-root">
      <header className="flex h-16 shrink-0 items-center px-6">
        <Mark />
      </header>
      <section className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[22px] font-medium leading-7 tracking-[-0.02em]">
            Create an account
            <span className="block text-muted">A super admin approves it before you can sign in.</span>
          </h1>
          {done ? (
            <div className="mt-8 space-y-4">
              <p className="text-[15px] leading-6" role="status">
                Your account is waiting. You can sign in after a super admin approves it.
              </p>
              <Link className="inline-flex h-10 items-center text-[15px] font-medium text-ink underline underline-offset-4" href="/login">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <label className="block text-[13px] font-medium text-secondary">
                Name
                <input className={field} autoComplete="name" {...form.register("name")} />
                {form.formState.errors.name ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.name.message}</span> : null}
              </label>
              <label className="block text-[13px] font-medium text-secondary">
                Username
                <input className={field} autoComplete="username" autoCapitalize="none" spellCheck={false} {...form.register("username")} />
                {form.formState.errors.username ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.username.message}</span> : null}
              </label>
              <label className="block text-[13px] font-medium text-secondary">
                Email
                <input className={field} type="email" autoComplete="email" {...form.register("email")} />
                {form.formState.errors.email ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.email.message}</span> : null}
              </label>
              <label className="block text-[13px] font-medium text-secondary">
                Password
                <input className={field} type="password" autoComplete="new-password" {...form.register("password")} />
                {form.formState.errors.password ? <span className="mt-1.5 block text-[13px] font-normal text-danger">{form.formState.errors.password.message}</span> : null}
              </label>
              {error ? <p className="text-[14px] text-danger" role="alert">{error}</p> : null}
              <button
                className="h-10 w-full rounded-control bg-primary text-[15px] font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:opacity-60"
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Creating account" : "Create account"}
              </button>
              <p className="text-[14px] text-secondary">
                Already have an account?{" "}
                <Link className="font-medium text-ink underline underline-offset-4" href="/login">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
