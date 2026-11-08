"use client";

import {
  Books,
  ChartBar,
  ChatCircle,
  ClipboardText,
  Files,
  Gear,
  Heartbeat,
  List,
  MagnifyingGlass,
  Moon,
  Pulse,
  Queue,
  SidebarSimple,
  SignOut,
  SquaresFour,
  Sun,
  Timer,
  Users,
  X,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { call } from "@/api/client";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/domain";
import { navigation } from "@/lib/rbac";

type Me = { userId: string; role: Role; name: string; username: string };

const icons: Record<string, React.ReactNode> = {
  Chat: <ChatCircle size={18} />,
  Library: <Books size={18} />,
  Space: <SquaresFour size={18} />,
  Forms: <ClipboardText size={18} />,
  Eval: <Timer size={18} />,
  Queue: <Queue size={18} />,
  Documents: <Files size={18} />,
  People: <Users size={18} />,
  Tickets: <ClipboardText size={18} />,
  Activity: <ChartBar size={18} />,
  Audit: <Pulse size={18} />,
  Overview: <SquaresFour size={18} />,
  Institutions: <Users size={18} />,
  Health: <Heartbeat size={18} />,
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("/api/auth/me"),
  });
}

export function Shell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const collapsed = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("harness-sidebar", onStoreChange);
      return () => window.removeEventListener("harness-sidebar", onStoreChange);
    },
    () => window.localStorage.getItem("harness-sidebar") === "collapsed",
    () => false,
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPalette(true);
      }
      if (key === "b") {
        event.preventDefault();
        const next = !collapsed;
        window.localStorage.setItem("harness-sidebar", next ? "collapsed" : "open");
        window.dispatchEvent(new Event("harness-sidebar"));
      }
      if (key === "n" && me.data?.role === "faculty") {
        event.preventDefault();
        router.push("/chat");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, me.data?.role, router]);

  const items = me.data ? navigation[me.data.role] : [];
  const dark = ready && resolvedTheme === "dark";

  async function signOut() {
    await call("/api/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  }

  if (me.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-secondary" role="status">
        Loading Harness
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-sm">Your session ended.</p>
          <Link className="mt-3 inline-flex min-h-11 items-center text-sm text-primary" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-root text-ink">
      <a className="skip-link sr-only" href="#content">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-sidebar md:flex",
            collapsed ? "w-16" : "w-[248px]",
          )}
          data-mp-def="sidebar"
          data-mp-id="sidebar"
        >
          <div className="flex h-14 items-center gap-2 px-3">
            <Link className="truncate text-sm font-semibold tracking-tight" href={items[0]?.href ?? "/"}>
              {collapsed ? "H" : "Harness"}
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Primary">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-control px-2 text-[13px]",
                    active ? "bg-panel font-medium text-ink shadow-sm" : "text-secondary hover:bg-soft",
                  )}
                >
                  {icons[item.label]}
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-1 border-t border-line p-2">
            <button
              className="flex min-h-11 items-center gap-2 rounded-control px-2 text-left text-[13px] text-secondary"
              type="button"
              onClick={() => setPalette(true)}
            >
              <MagnifyingGlass size={18} />
              {collapsed ? <span className="sr-only">Search</span> : "Search"}
            </button>
            <Link className="flex min-h-11 items-center gap-2 rounded-control px-2 text-[13px] text-secondary" href="/settings">
              <Gear size={18} />
              {collapsed ? <span className="sr-only">Settings</span> : me.data.name}
            </Link>
            <button
              className="flex min-h-11 items-center gap-2 rounded-control px-2 text-left text-[13px] text-secondary"
              type="button"
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {collapsed ? <span className="sr-only">{dark ? "Switch to light theme" : "Switch to dark theme"}</span> : dark ? "Light" : "Dark"}
              <span className="sr-only">{dark ? "Switch to light theme" : "Switch to dark theme"}</span>
            </button>
            <button className="flex min-h-11 items-center gap-2 rounded-control px-2 text-left text-[13px] text-secondary" type="button" onClick={() => void signOut()}>
              <SignOut size={18} />
              {collapsed ? <span className="sr-only">Sign out</span> : "Sign out"}
            </button>
            <button
              className="flex min-h-11 items-center justify-center rounded-control text-secondary"
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => {
                const next = !collapsed;
                window.localStorage.setItem("harness-sidebar", next ? "collapsed" : "open");
                window.dispatchEvent(new Event("harness-sidebar"));
              }}
            >
              <SidebarSimple size={18} />
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-line px-3 md:hidden">
            <button className="inline-flex size-11 items-center justify-center rounded-control" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
              <List size={18} />
            </button>
            <p className="text-sm font-semibold">Harness</p>
          </header>
          <div id="content" className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[280px] bg-sidebar p-3" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Harness</p>
              <button className="inline-flex size-11 items-center justify-center" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className="flex min-h-11 items-center rounded-control px-2 text-sm" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <Link href="/settings" className="flex min-h-11 items-center rounded-control px-2 text-sm" onClick={() => setOpen(false)}>
                Settings
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
      {palette ? <Palette role={me.data.role} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}

function Palette({ role, onClose }: { role: Role; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const threads = useQuery({
    queryKey: ["threads"],
    enabled: role === "faculty",
    queryFn: () => call<{ threads: { id: string; title: string }[] }>("/api/harness/threads"),
  });
  const items = useMemo(() => {
    const pages = [...navigation[role], { href: "/settings", label: "Settings" }];
    const chats = (threads.data?.threads ?? []).map((thread) => ({ href: `/chat/${thread.id}`, label: thread.title }));
    return [...pages, ...chats].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [query, role, threads.data?.threads]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/30 px-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-panel border border-line bg-panel shadow" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          autoFocus
          className="min-h-11 w-full bg-transparent px-4 text-sm"
          placeholder="Jump to a page"
          aria-label="Jump to a page"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
        <ul className="max-h-80 overflow-auto border-t border-line p-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link className="flex min-h-11 items-center rounded-control px-2 text-sm hover:bg-soft" href={item.href} onClick={onClose}>
                {item.label}
              </Link>
            </li>
          ))}
          {items.length === 0 ? <li className="px-2 py-3 text-sm text-muted">No matches</li> : null}
        </ul>
      </div>
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StateMessage({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rounded-panel border border-line bg-panel px-4 py-8 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{body}</p>
      {onRetry ? (
        <button className="mt-4 min-h-11 rounded-control bg-primary px-4 text-sm text-primary-ink" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
