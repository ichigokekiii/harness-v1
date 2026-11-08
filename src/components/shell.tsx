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
  NotePencil,
  Pulse,
  Queue,
  SidebarSimple,
  SignOut,
  SquaresFour,
  Sun,
  Timer,
  Users,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { call } from "@/api/client";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/domain";
import { navigation } from "@/lib/rbac";

type Me = { userId: string; role: Role; name: string; username: string };
type ThreadList = { threads: { id: string; title: string; updatedAt: string; preview: string }[] };

const icons: Record<string, React.ComponentType<{ size?: number; weight?: "regular" | "fill" }>> = {
  Chat: ChatCircle,
  Library: Books,
  Space: SquaresFour,
  Forms: ClipboardText,
  Eval: Timer,
  Queue: Queue,
  Documents: Files,
  People: Users,
  Tickets: ClipboardText,
  Activity: ChartBar,
  Audit: Pulse,
  Overview: SquaresFour,
  Institutions: Users,
  Health: Heartbeat,
};

const roleLabel: Record<Role, string> = {
  faculty: "Faculty",
  institution_admin: "Institution admin",
  super_admin: "Super admin",
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("/api/auth/me"),
  });
}

function useThreads(enabled: boolean) {
  return useQuery({
    queryKey: ["threads"],
    enabled,
    queryFn: () => call<ThreadList>("/api/harness/threads"),
  });
}

function setCollapsed(next: boolean) {
  window.localStorage.setItem("harness-sidebar", next ? "collapsed" : "open");
  window.dispatchEvent(new Event("harness-sidebar"));
}

export function Shell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
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
        setCollapsed(!collapsed);
      }
      if (key === "n" && me.data?.role === "faculty") {
        event.preventDefault();
        router.push("/chat");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, me.data?.role, router]);

  if (me.isLoading) {
    return <div className="min-h-dvh bg-root" role="status" aria-label="Loading Harness" />;
  }
  if (me.isError || !me.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-[15px]">Your session ended.</p>
          <Link className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-ink" href="/login">
            Sign in again
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
            "sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-sidebar transition-[width] duration-200 ease-out md:block",
            collapsed ? "w-[52px]" : "w-[260px]",
          )}
          data-mp-def="sidebar"
          data-mp-id="sidebar"
        >
          <SidebarBody me={me.data} collapsed={collapsed} onSearch={() => setPalette(true)} onSignedOut={() => router.push("/login")} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-1 bg-root/90 px-2 backdrop-blur md:hidden">
            <button className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-soft" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
              <List size={20} />
            </button>
            <p className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">Harness</p>
            {me.data.role === "faculty" ? (
              <Link className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-soft" href="/chat" aria-label="New chat">
                <NotePencil size={20} />
              </Link>
            ) : null}
          </header>
          <div id="content" className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="h-full w-[280px] bg-sidebar shadow-pop"
            onClick={(event) => {
              event.stopPropagation();
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
            role="dialog"
            aria-label="Menu"
          >
            <SidebarBody
              me={me.data}
              collapsed={false}
              onSearch={() => {
                setOpen(false);
                setPalette(true);
              }}
              onClose={() => setOpen(false)}
              onSignedOut={() => router.push("/login")}
            />
          </div>
        </div>
      ) : null}
      {palette ? <Palette role={me.data.role} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}

function SidebarBody({
  me,
  collapsed,
  onSearch,
  onClose,
  onSignedOut,
}: {
  me: Me;
  collapsed: boolean;
  onSearch: () => void;
  onClose?: () => void;
  onSignedOut: () => void;
}) {
  const pathname = usePathname();
  const faculty = me.role === "faculty";
  const threads = useThreads(faculty);
  const items = navigation[me.role].filter((item) => !(faculty && item.label === "Chat"));
  const row = (active: boolean) =>
    cn(
      "group flex h-9 items-center gap-2.5 rounded-lg px-2 text-[14px] transition-colors",
      collapsed && "justify-center px-0",
      active ? "bg-soft text-ink" : "text-ink/85 hover:bg-soft/70 hover:text-ink",
    );

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-[52px] shrink-0 items-center px-2", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? null : (
          <Link className="rounded-lg px-2 py-1 text-[15px] font-semibold tracking-[-0.01em] hover:bg-soft/70" href={navigation[me.role][0]?.href ?? "/"}>
            Harness
          </Link>
        )}
        <button
          className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft/70 hover:text-ink"
          type="button"
          aria-label={onClose ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={onClose ? undefined : "Toggle sidebar  ⌘B"}
          onClick={() => (onClose ? onClose() : setCollapsed(!collapsed))}
        >
          <SidebarSimple size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-px px-2" aria-label="Primary">
        {faculty ? (
          <Link className={row(false)} href="/chat" title="New chat" aria-current={pathname === "/chat" ? "page" : undefined}>
            <NotePencil size={18} />
            {collapsed ? <span className="sr-only">New chat</span> : <span className="flex-1">New chat</span>}
            {collapsed ? null : <Kbd>⌘N</Kbd>}
          </Link>
        ) : null}
        <button className={cn(row(false), "w-full text-left")} type="button" onClick={onSearch} title="Search">
          <MagnifyingGlass size={18} />
          {collapsed ? <span className="sr-only">Search</span> : <span className="flex-1">Search</span>}
          {collapsed ? null : <Kbd>⌘K</Kbd>}
        </button>
        {faculty ? <div className="my-2 h-px" aria-hidden /> : null}
        {items.map((item) => {
          const Icon = icons[item.label] ?? SquaresFour;
          const deeper = items.some((other) => other.href.length > item.href.length && other.href.startsWith(`${item.href}/`) && pathname.startsWith(other.href));
          const active = !deeper && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={item.label} className={row(active)}>
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {faculty && !collapsed && threads.data?.threads.length ? (
          <>
            <h2 className="px-2 pb-1 text-[12px] font-medium text-muted">Chats</h2>
            <ul className="flex flex-col gap-px">
              {threads.data.threads.map((thread) => {
                const active = pathname === `/chat/${thread.id}`;
                return (
                  <li key={thread.id}>
                    <Link className={cn(row(active), "block truncate leading-9")} href={`/chat/${thread.id}`} aria-current={active ? "page" : undefined}>
                      {thread.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>

      <AccountRow me={me} collapsed={collapsed} onSignedOut={onSignedOut} />
    </div>
  );
}

function AccountRow({ me, collapsed, onSignedOut }: { me: Me; collapsed: boolean; onSignedOut: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = ready && resolvedTheme === "dark";
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = me.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  useEffect(() => {
    if (!menu) return;
    function onDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setMenu(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function signOut() {
    await call("/api/auth/logout", { method: "POST", body: {} });
    onSignedOut();
  }

  const themeLabel = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div ref={ref} className={cn("relative shrink-0 border-t border-line p-2", collapsed ? "flex flex-col items-center gap-1" : "flex items-center gap-1")}>
      {menu ? (
        <div className="absolute bottom-[calc(100%+4px)] left-2 z-30 w-[236px] rounded-xl bg-elevated p-1.5 shadow-pop" role="menu">
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[14px] font-medium">{me.name}</p>
            <p className="truncate text-[12px] text-muted">{me.username}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] hover:bg-soft" href="/settings" role="menuitem" onClick={() => setMenu(false)}>
            <Gear size={18} />
            Settings
          </Link>
          <button className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] hover:bg-soft" type="button" role="menuitem" onClick={() => void signOut()}>
            <SignOut size={18} />
            Log out
          </button>
        </div>
      ) : null}
      <button
        className={cn("flex min-w-0 items-center gap-2.5 rounded-lg text-left hover:bg-soft/70", collapsed ? "size-9 justify-center" : "h-11 flex-1 px-1.5")}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-label={collapsed ? `Account, ${me.name}` : undefined}
        onClick={() => setMenu((value) => !value)}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-ink">{initials}</span>
        {collapsed ? null : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] leading-5">{me.name}</span>
            <span className="block truncate text-[12px] leading-4 text-muted">{roleLabel[me.role]}</span>
          </span>
        )}
      </button>
      <button
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-soft/70 hover:text-ink"
        type="button"
        aria-label={themeLabel}
        title={themeLabel}
        onClick={() => setTheme(dark ? "light" : "dark")}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-sans text-[12px] text-muted opacity-0 transition-opacity group-hover:opacity-100">{children}</kbd>;
}

function Palette({ role, onClose }: { role: Role; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const threads = useThreads(role === "faculty");
  const items = useMemo(() => {
    const pages = [...navigation[role], { href: "/settings", label: "Settings" }].map((item) => ({ ...item, group: "Go to" }));
    const chats = (threads.data?.threads ?? []).map((thread) => ({ href: `/chat/${thread.id}`, label: thread.title, group: "Chats" }));
    return [...pages, ...chats].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [query, role, threads.data?.threads]);
  const selected = Math.min(cursor, Math.max(items.length - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/25 px-4 pt-[14vh] dark:bg-black/50" onClick={onClose}>
      <div
        className="h-fit w-full max-w-[560px] overflow-hidden rounded-2xl bg-elevated shadow-pop"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 px-4">
          <MagnifyingGlass size={18} className="text-muted" />
          <input
            autoFocus
            className="h-[52px] w-full bg-transparent text-[15px]"
            placeholder="Search pages and chats"
            aria-label="Search pages and chats"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, items.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && items[selected]) {
                router.push(items[selected].href);
                onClose();
              }
            }}
          />
        </div>
        <ul className="max-h-[360px] overflow-auto border-t border-line p-1.5">
          {items.map((item, index) => (
            <li key={item.href}>
              {index === 0 || items[index - 1].group !== item.group ? (
                <p className="px-2.5 pb-1 pt-2 text-[12px] font-medium text-muted">{item.group}</p>
              ) : null}
              <Link
                className={cn("flex h-9 items-center rounded-lg px-2.5 text-[14px]", index === selected ? "bg-soft" : "hover:bg-soft/70")}
                href={item.href}
                onMouseEnter={() => setCursor(index)}
                onClick={onClose}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
          {items.length === 0 ? <li className="px-2.5 py-6 text-center text-[14px] text-muted">Nothing matches that.</li> : null}
        </ul>
      </div>
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-[1080px] px-5 pb-12 pt-8 md:px-10 md:pt-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StateMessage({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[14px] text-secondary">{body}</p>
      {onRetry ? (
        <button className="mt-4 h-9 rounded-full bg-primary px-4 text-[14px] font-medium text-primary-ink hover:bg-primary-hover" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
