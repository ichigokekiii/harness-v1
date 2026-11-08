"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useMemo, useState } from "react";

type ToastValue = { text: string | null; push: (text: string) => void };

const ToastContext = createContext<ToastValue>({ text: null, push: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [text, setText] = useState<string | null>(null);
  const toast = useMemo<ToastValue>(
    () => ({
      text,
      push(next) {
        setText(next);
        window.setTimeout(() => setText((current) => (current === next ? null : current)), 2800);
      },
    }),
    [text],
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={client}>
        <ToastContext.Provider value={toast}>
          {children}
          <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            {text ? <p className="rounded-control bg-navy px-3 py-2 text-sm text-white shadow">{text}</p> : null}
          </div>
        </ToastContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
