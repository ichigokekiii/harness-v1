"use client";

import { PawPrint } from "@phosphor-icons/react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Mark({ href, compact = false }: { href?: string; compact?: boolean }) {
  const className = cn(
    "inline-flex items-center rounded-lg font-semibold tracking-[-0.01em] text-ink",
    compact ? "size-9 justify-center" : "gap-2 px-2 py-1 text-[15px]",
    href && "hover:bg-soft/70",
  );
  const inner = (
    <>
      <PawPrint size={compact ? 20 : 18} weight="fill" aria-hidden />
      {compact ? <span className="sr-only">Tabi</span> : <span>Tabi</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={compact ? "Tabi home" : undefined}>
        {inner}
      </Link>
    );
  }
  return <p className={className}>{inner}</p>;
}
