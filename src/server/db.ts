import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AuditEvent, DB } from "@/lib/domain";
import { createSeed } from "@/server/seed";

function dbFile() {
  if (process.env.VERCEL) return path.join("/tmp", "harness-db.json");
  return path.join(process.cwd(), ".data", "db.json");
}

let memory: DB | null = null;

function clone(db: DB): DB {
  return structuredClone(db);
}

export function loadDb(): DB {
  if (memory) return memory;
  const file = dbFile();
  try {
    memory = JSON.parse(readFileSync(file, "utf8")) as DB;
  } catch {
    memory = createSeed();
    saveDb(memory);
  }
  return memory;
}

export function saveDb(db: DB) {
  memory = db;
  const file = dbFile();
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(db));
  } catch {
    // Demo on Vercel still runs in memory when the filesystem refuses a write.
  }
}

export function resetDb() {
  const next = createSeed();
  saveDb(next);
  return next;
}

export function updateDb(change: (db: DB) => void) {
  const db = loadDb();
  change(db);
  saveDb(db);
  return db;
}

export function addAudit(db: DB, event: Omit<AuditEvent, "id" | "at">) {
  db.audit.unshift({
    id: `audit-${crypto.randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    ...event,
  });
}

export function freshDb(): DB {
  return clone(createSeed());
}
