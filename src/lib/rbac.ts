import type { Role } from "@/lib/domain";

export type NavItem = {
  href: string;
  label: string;
};

const rules: { prefix: string; roles: Role[] }[] = [
  { prefix: "/chat", roles: ["faculty"] },
  { prefix: "/library", roles: ["faculty"] },
  { prefix: "/space", roles: ["faculty"] },
  { prefix: "/forms", roles: ["faculty"] },
  { prefix: "/eval", roles: ["institution_admin"] },
  { prefix: "/admin", roles: ["institution_admin"] },
  { prefix: "/super-admin", roles: ["super_admin"] },
  { prefix: "/settings", roles: ["faculty", "institution_admin", "super_admin"] },
];

export const navigation: Record<Role, NavItem[]> = {
  faculty: [
    { href: "/chat", label: "Chat" },
    { href: "/library", label: "Library" },
    { href: "/space", label: "Space" },
    { href: "/forms", label: "Forms" },
  ],
  institution_admin: [
    { href: "/admin/queue", label: "Queue" },
    { href: "/admin/documents", label: "Documents" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/tickets", label: "Tickets" },
    { href: "/admin/activity", label: "Activity" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/eval", label: "Eval" },
  ],
  super_admin: [
    { href: "/super-admin", label: "Overview" },
    { href: "/super-admin/accounts", label: "Accounts" },
    { href: "/super-admin/institutions", label: "Institutions" },
    { href: "/super-admin/audit", label: "Audit" },
    { href: "/super-admin/health", label: "Health" },
  ],
};

export function ruleFor(pathname: string) {
  return rules.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
}

export function canVisit(role: Role, pathname: string) {
  const rule = ruleFor(pathname);
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function homeFor(role: Role) {
  if (role === "institution_admin") return "/admin/queue";
  if (role === "super_admin") return "/super-admin";
  return "/chat";
}
