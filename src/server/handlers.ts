import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  Account,
  AnswerKind,
  Board,
  ChatMessage,
  DB,
  LibraryDocument,
  Role,
  Session,
  Shape,
} from "@/lib/domain";
import { publicAccount } from "@/lib/domain";
import { readSessionToken, tokenFromCookieHeader } from "@/lib/session";
import { addAudit, loadDb, resetDb, updateDb } from "@/server/db";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter a username."),
  password: z.string().min(1, "Enter a password."),
});

const askSchema = z.object({
  text: z.string().trim().min(1, "Enter a question."),
});

const uploadSchema = z.object({
  name: z.string().trim().min(1),
  mime: z.string(),
});

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "needs_transcription"]),
  ocrText: z.string(),
  metadata: z.object({
    subject: z.string().min(1),
    grade: z.string().min(1),
    type: z.string().min(1),
    department: z.string().min(1),
    visibility: z.enum(["department", "institution"]),
  }),
});

const inviteSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["faculty", "institution_admin"]),
  department: z.string().trim().min(1),
});

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(6, "Use at least 6 characters."),
});

const healthSchema = z.object({
  model: z.enum(["up", "down"]).optional(),
  ocr: z.enum(["up", "down"]).optional(),
  index: z.enum(["up", "down"]).optional(),
});

const boardSchema = z.object({
  title: z.string().optional(),
  mode: z.enum(["freeform", "slides"]).optional(),
  shapes: z.array(z.custom<Shape>()).optional(),
  log: z.array(z.custom<{ id: string }>()).optional(),
});

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function fail(error: string, status: number) {
  return json({ error }, status);
}

function nid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function sessionFrom(request: Request) {
  return readSessionToken(tokenFromCookieHeader(request.headers.get("cookie") ?? ""));
}

function deny(session: Session | null, roles: Role[]) {
  if (!session) return fail("Sign in again.", 401);
  if (!roles.includes(session.role)) return fail("That action is for a different role.", 403);
  return undefined;
}

function userOf(db: DB, session: Session) {
  return db.users.find((user) => user.id === session.userId) ?? null;
}

function classify(name: string, mime: string) {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf" as const;
  if (mime === "image/jpeg" || mime === "image/png" || /\.(jpe?g|png)$/.test(lower)) return "image" as const;
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx" as const;
  return null;
}

function routeQuestion(text: string) {
  const value = text.toLowerCase();
  if (value.includes("ecosystem") || value.includes("food web") || value.includes("decomposer")) {
    return "thread-ecosystems";
  }
  if (value.includes("lab hour") || value.includes("disagree")) return "thread-conflict";
  if (value.includes("attendance") || value.includes("superseded")) return "thread-superseded";
  return null;
}

function searchCopy(message: ChatMessage): ChatMessage {
  const snippets = (message.citations ?? []).map((citation, index) => `[${index + 1}] ${citation.snippet}`).join(" ");
  return {
    ...message,
    id: nid("msg"),
    kind: "search",
    content: snippets || "Search only. The model is offline, and no page matched.",
    createdAt: new Date().toISOString(),
  };
}

async function maybeLiveAnswer(session: Session, text: string): Promise<ChatMessage | null> {
  if (process.env.NEXT_PUBLIC_HARNESS_API !== "fastapi" || !session.apiToken) return null;
  const base = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.apiToken}`,
      },
      body: JSON.stringify({ query: text }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      declined?: boolean;
      answer?: string;
      citations?: { id: string; docId: string; page: number; snippet: string; title: string }[];
    };
    const citations = (data.citations ?? []).map((citation) => ({
      id: citation.id,
      docId: citation.docId,
      title: citation.title,
      page: citation.page,
      snippet: citation.snippet,
      highlightTop: 30,
      highlightHeight: 16,
      status: "current" as const,
    }));
    return {
      id: nid("msg"),
      role: "assistant",
      kind: data.declined ? "decline" : "grounded",
      content: data.answer || "No answer returned.",
      createdAt: new Date().toISOString(),
      citations,
      source: "live",
    };
  } catch {
    return null;
  }
}

function visibleDocs(db: DB, session: Session) {
  return db.documents.filter((doc) => {
    if (doc.scope === "personal") return doc.ownerId === session.userId;
    return doc.status !== "rejected";
  });
}

export async function loginLocal(username: string, password: string) {
  const parsed = loginSchema.safeParse({ username, password });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", status: 400 };
  const db = loadDb();
  const account = db.users.find(
    (user) => user.username === parsed.data.username && user.password === parsed.data.password,
  );
  if (!account || account.status === "disabled") {
    return { error: "That username and password did not match.", status: 401 };
  }
  if (account.status === "pending") {
    return { error: "A super admin still needs to approve this account.", status: 403 };
  }
  updateDb((next) => {
    addAudit(next, {
      actor: account.name,
      action: "login",
      detail: `Signed in as ${account.role}.`,
      institutionId: account.institutionId,
    });
  });
  return { account };
}

const registerSchema = z.object({
  name: z.string().min(1, "Enter your name."),
  username: z.string().min(1, "Choose a username."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(6, "Use at least 6 characters."),
});

export async function registerLocal(input: unknown) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", status: 400 };
  const db = loadDb();
  const username = parsed.data.username.trim();
  const email = parsed.data.email.trim().toLowerCase();
  if (db.users.some((user) => user.username.toLowerCase() === username.toLowerCase() || user.email.toLowerCase() === email)) {
    return { error: "That username or email is already in use.", status: 409 };
  }
  updateDb((next) => {
    const account: Account = {
      id: nid("user"),
      username,
      password: parsed.data.password,
      name: parsed.data.name.trim(),
      email,
      role: "faculty",
      department: "General",
      institutionId: next.institutions[0]?.id ?? "inst-sample",
      status: "pending",
    };
    next.users.push(account);
    addAudit(next, {
      actor: account.name,
      action: "register",
      detail: `${account.name} asked to join.`,
      institutionId: account.institutionId,
    });
  });
  return { ok: true as const };
}

export async function loginFastApi(email: string, password: string) {
  if (process.env.NEXT_PUBLIC_HARNESS_API !== "fastapi") return null;
  const base = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, role: "faculty" }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string; role?: string; name?: string; email?: string };
    if (!data.token) return null;
    const role: Role = data.role === "admin" ? "institution_admin" : "faculty";
    return {
      token: data.token,
      role,
      name: data.name || email,
      email: data.email || email,
    };
  } catch {
    return null;
  }
}

export async function handle(method: string, parts: string[], request: Request) {
  if (method === "POST" && parts[0] === "reset") {
    if (process.env.NODE_ENV === "production") return fail("Not found.", 404);
    resetDb();
    return json({ ok: true });
  }

  const session = await sessionFrom(request);
  const db = loadDb();

  if (method === "GET" && parts[0] === "meta") {
    return json({ mode: process.env.NEXT_PUBLIC_HARNESS_API === "fastapi" ? "fastapi" : "mock" });
  }

  if (parts[0] === "threads") {
    const denied = deny(session, ["faculty"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET" && parts.length === 1) {
      return json({
        threads: db.threads
          .filter((thread) => thread.ownerId === session.userId)
          .map(({ messages, ...thread }) => ({ ...thread, preview: messages.at(-1)?.content ?? "" })),
      });
    }
    if (method === "GET" && parts[1]) {
      const thread = db.threads.find((item) => item.id === parts[1] && item.ownerId === session.userId);
      if (!thread) return fail("Thread not found.", 404);
      return json({ thread, health: db.health });
    }
    if (method === "POST" && parts[1] === "ask") {
      const body = askSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail(body.error.issues[0]?.message ?? "Enter a question.", 400);
      const text = body.data.text;
      const live = await maybeLiveAnswer(session, text);
      const knownId = routeQuestion(text);
      let threadId = knownId;
      updateDb((next) => {
        const owner = userOf(next, session);
        const known = knownId ? next.threads.find((thread) => thread.id === knownId) : undefined;
        const userMessage: ChatMessage = {
          id: nid("msg"),
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        };
        if (live) {
          const created = {
            id: nid("thread"),
            title: text.slice(0, 64),
            ownerId: session.userId,
            institutionId: owner?.institutionId ?? "inst-sample",
            updatedAt: new Date().toISOString(),
            messages: [userMessage, live],
          };
          next.threads.unshift(created);
          threadId = created.id;
        } else if (known && next.health.model === "down") {
          const assistant = known.messages.find((message) => message.role === "assistant");
          known.messages.push(userMessage);
          if (assistant) known.messages.push(searchCopy(assistant));
          known.updatedAt = new Date().toISOString();
        } else if (!known) {
          const created = {
            id: nid("thread"),
            title: text.slice(0, 64),
            ownerId: session.userId,
            institutionId: owner?.institutionId ?? "inst-sample",
            updatedAt: new Date().toISOString(),
            messages: [
              userMessage,
              {
                id: nid("msg"),
                role: "assistant" as const,
                kind: (next.health.model === "down" ? "search" : "decline") as AnswerKind,
                content:
                  next.health.model === "down"
                    ? "Search only. The model is offline, and no approved page matched."
                    : "No reliable passage in the approved library matches that question.",
                createdAt: new Date().toISOString(),
                citations: [],
                source: "sample" as const,
              },
            ],
          };
          next.threads.unshift(created);
          threadId = created.id;
        }
        const asked = next.activity.asked.find((item) => item.label === (known?.title ?? text.slice(0, 48)));
        if (asked) asked.count += 1;
        else next.activity.asked.unshift({ label: text.slice(0, 48), count: 1 });
        addAudit(next, {
          actor: session.name,
          action: "ask",
          detail: text.slice(0, 120),
          institutionId: owner?.institutionId ?? "inst-sample",
        });
      });
      return json({ threadId });
    }
    if (method === "POST" && parts[2] === "ticket") {
      updateDb((next) => {
        const thread = next.threads.find((item) => item.id === parts[1]);
        next.tickets.unshift({
          id: nid("ticket"),
          kind: "missing_document",
          status: "open",
          title: thread?.title ?? "Missing document",
          detail: `${session.name} reported a missing document from ${thread?.title ?? "a chat"}.`,
          openedBy: session.name,
          institutionId: userOf(next, session)?.institutionId ?? "inst-sample",
          createdAt: new Date().toISOString(),
        });
        addAudit(next, {
          actor: session.name,
          action: "ticket",
          detail: "Reported a missing document.",
          institutionId: userOf(next, session)?.institutionId ?? "inst-sample",
        });
      });
      return json({ ok: true });
    }
  }

  if (parts[0] === "library") {
    const denied = deny(session, ["faculty"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET") {
      const scope = new URL(request.url).searchParams.get("scope");
      const docs = visibleDocs(db, session).filter((doc) => (scope === "personal" ? doc.scope === "personal" : scope === "institution" ? doc.scope === "institution" : true));
      return json({ documents: docs });
    }
    if (method === "POST" && parts[1] === "upload") {
      const body = uploadSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Choose a file.", 400);
      const kind = classify(body.data.name, body.data.mime);
      if (!kind) {
        return fail("Use a PDF, JPEG, or PNG. A DOCX file is only a slide source.", 400);
      }
      let documentId = "";
      updateDb((next) => {
        const owner = userOf(next, session);
        const doc: LibraryDocument = {
          id: nid("doc"),
          title: body.data.name.replace(/\.[^.]+$/, ""),
          scope: "personal",
          ownerId: session.userId,
          institutionId: owner?.institutionId ?? "inst-sample",
          department: owner?.department ?? "Science",
          subject: "General",
          grade: "Grade 7",
          kind,
          visibility: "private",
          status: "approved",
          retrieval: kind !== "docx",
          version: 1,
          pageCount: 1,
          updatedAt: new Date().toISOString(),
          versions: [{ version: 1, updatedAt: new Date().toISOString(), note: "Uploaded to My folder." }],
        };
        documentId = doc.id;
        next.documents.unshift(doc);
        addAudit(next, {
          actor: session.name,
          action: "upload",
          detail: `Uploaded ${doc.title}.`,
          institutionId: doc.institutionId,
        });
      });
      return json({
        documentId,
        message: kind === "docx" ? "Saved as a slide source. It is not added to chat retrieval." : "Saved to My folder.",
      });
    }
    if (method === "POST" && parts[2] === "share") {
      let missing = false;
      updateDb((next) => {
        const doc = next.documents.find((item) => item.id === parts[1] && item.ownerId === session.userId);
        if (!doc) {
          missing = true;
          return;
        }
        doc.shareStatus = "pending";
        next.queue.unshift({
          id: nid("queue"),
          documentId: doc.id,
          title: doc.title,
          page: 1,
          pageCount: doc.pageCount,
          confidence: 90,
          handwritten: false,
          status: "needs_review",
          source: "faculty_share",
          uploadedBy: session.name,
          institutionId: doc.institutionId,
          scanLines: [doc.title, "Shared from My folder."],
          ocrText: doc.title,
          metadata: {
            subject: doc.subject,
            grade: doc.grade,
            type: doc.kind,
            department: doc.department,
            visibility: "institution",
          },
          createdAt: new Date().toISOString(),
        });
      });
      if (missing) return fail("Document not found.", 404);
      return json({ status: "pending" });
    }
    if (method === "POST" && parts[2] === "retire") {
      updateDb((next) => {
        const doc = next.documents.find((item) => item.id === parts[1]);
        next.tickets.unshift({
          id: nid("ticket"),
          kind: "retirement",
          status: "open",
          title: `Retire ${doc?.title ?? "document"}`,
          detail: `${session.name} asked to retire ${doc?.title ?? "a document"}.`,
          documentId: doc?.id,
          openedBy: session.name,
          institutionId: doc?.institutionId ?? "inst-sample",
          createdAt: new Date().toISOString(),
        });
      });
      return json({ ok: true });
    }
  }

  if (parts[0] === "queue") {
    const denied = deny(session, ["institution_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET" && !parts[1]) return json({ items: db.queue });
    if (method === "GET" && parts[1]) {
      const item = db.queue.find((entry) => entry.id === parts[1]);
      if (!item) return fail("Queue item not found.", 404);
      return json({ item });
    }
    if (method === "POST" && parts[1] === "upload") {
      const body = uploadSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Choose a file.", 400);
      const kind = classify(body.data.name, body.data.mime);
      if (!kind || kind === "docx") return fail("Upload a PDF, JPEG, or PNG.", 400);
      updateDb((next) => {
        next.queue.unshift({
          id: nid("queue"),
          title: body.data.name.replace(/\.[^.]+$/, ""),
          page: 1,
          pageCount: 1,
          confidence: 70,
          handwritten: false,
          status: "needs_review",
          source: "upload",
          uploadedBy: session.name,
          institutionId: userOf(next, session)?.institutionId ?? "inst-sample",
          scanLines: [body.data.name, "Waiting for transcription."],
          ocrText: "",
          metadata: {
            subject: "General",
            grade: "Grade 7",
            type: kind,
            department: userOf(next, session)?.department ?? "Records",
            visibility: "department",
          },
          createdAt: new Date().toISOString(),
        });
      });
      return json({ ok: true });
    }
    if (method === "POST" && parts[2] === "review") {
      const body = reviewSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Check the metadata.", 400);
      let missing = false;
      updateDb((next) => {
        const item = next.queue.find((entry) => entry.id === parts[1]);
        if (!item) {
          missing = true;
          return;
        }
        item.ocrText = body.data.ocrText;
        item.metadata = body.data.metadata;
        item.status = body.data.action === "approve" ? "approved" : body.data.action === "reject" ? "rejected" : "needs_transcription";
        if (item.documentId) {
          const doc = next.documents.find((entry) => entry.id === item.documentId);
          if (doc && body.data.action === "approve") {
            doc.scope = "institution";
            doc.visibility = body.data.metadata.visibility;
            doc.status = "approved";
            doc.shareStatus = "approved";
            doc.subject = body.data.metadata.subject;
            doc.grade = body.data.metadata.grade;
            doc.department = body.data.metadata.department;
          }
          if (doc && body.data.action === "reject") {
            doc.shareStatus = "rejected";
            doc.status = "rejected";
          }
        } else if (body.data.action === "approve") {
          next.documents.unshift({
            id: nid("doc"),
            title: item.title,
            scope: "institution",
            ownerId: session.userId,
            institutionId: item.institutionId,
            department: body.data.metadata.department,
            subject: body.data.metadata.subject,
            grade: body.data.metadata.grade,
            kind: "pdf",
            visibility: body.data.metadata.visibility,
            status: "approved",
            retrieval: true,
            version: 1,
            pageCount: 1,
            updatedAt: new Date().toISOString(),
            versions: [{ version: 1, updatedAt: new Date().toISOString(), note: "Approved from the queue." }],
          });
        }
        addAudit(next, {
          actor: session.name,
          action: body.data.action,
          detail: `${body.data.action} ${item.title}.`,
          institutionId: item.institutionId,
        });
      });
      if (missing) return fail("Queue item not found.", 404);
      return json({ ok: true });
    }
  }

  if (parts[0] === "documents") {
    const denied = deny(session, ["institution_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET") return json({ documents: db.documents });
    if (method === "POST" && parts[1]) {
      const body = z
        .object({
          visibility: z.enum(["department", "institution", "private", "rejected"]).optional(),
          status: z.enum(["approved", "pending", "rejected", "superseded"]).optional(),
        })
        .safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Check the document.", 400);
      updateDb((next) => {
        const doc = next.documents.find((item) => item.id === parts[1]);
        if (!doc) return;
        if (body.data.visibility) doc.visibility = body.data.visibility;
        if (body.data.status) {
          doc.status = body.data.status;
          doc.version += 1;
          doc.versions.push({
            version: doc.version,
            updatedAt: new Date().toISOString(),
            note: `Marked ${body.data.status}.`,
          });
        }
      });
      return json({ ok: true });
    }
  }

  if (parts[0] === "people") {
    const denied = deny(session, ["institution_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET") return json({ people: db.users.map(publicAccount) });
    if (method === "POST" && !parts[1]) {
      const body = inviteSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail(body.error.issues[0]?.message ?? "Check the person.", 400);
      updateDb((next) => {
        const account: Account = {
          id: nid("user"),
          username: body.data.email.split("@")[0] || nid("user"),
          password: "123456",
          name: body.data.name,
          email: body.data.email,
          role: body.data.role,
          department: body.data.department,
          institutionId: userOf(next, session)?.institutionId ?? "inst-sample",
          status: "active",
        };
        next.users.push(account);
        addAudit(next, {
          actor: session.name,
          action: "invite",
          detail: `Invited ${account.name}.`,
          institutionId: account.institutionId,
        });
      });
      return json({ ok: true });
    }
    if (method === "POST" && parts[2] === "status") {
      const body = z.object({ status: z.enum(["active", "disabled"]) }).safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Choose a status.", 400);
      updateDb((next) => {
        const person = next.users.find((item) => item.id === parts[1]);
        if (!person || person.status === "pending") return;
        person.status = body.data.status;
      });
      return json({ ok: true });
    }
  }

  if (parts[0] === "tickets") {
    const denied = deny(session, ["institution_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET") return json({ tickets: db.tickets });
    if (method === "POST" && parts[2] === "resolve") {
      const body = z.object({ action: z.enum(["approve", "dismiss"]) }).safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Choose an action.", 400);
      updateDb((next) => {
        const ticket = next.tickets.find((item) => item.id === parts[1]);
        if (!ticket) return;
        ticket.status = "done";
        if (ticket.kind === "retirement" && ticket.documentId && body.data.action === "approve") {
          next.documents = next.documents.filter((doc) => doc.id !== ticket.documentId);
        }
        addAudit(next, {
          actor: session.name,
          action: body.data.action === "approve" ? "retire" : "dismiss",
          detail: `${body.data.action} ${ticket.title}.`,
          institutionId: ticket.institutionId,
        });
      });
      return json({ ok: true });
    }
  }

  if (method === "GET" && parts[0] === "activity") {
    const denied = deny(session, ["institution_admin", "super_admin"]);
    if (denied) return denied;
    return json({ activity: db.activity, recent: db.audit.slice(0, 8) });
  }

  if (parts[0] === "audit" && method === "GET") {
    const denied = deny(session, ["institution_admin", "super_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
    const institution = new URL(request.url).searchParams.get("institution") ?? "";
    const events = db.audit.filter((event) => {
      if (session.role === "institution_admin" && event.institutionId !== (userOf(db, session)?.institutionId ?? "")) {
        return false;
      }
      if (institution && event.institutionId !== institution) return false;
      if (!q) return true;
      return `${event.actor} ${event.action} ${event.detail}`.toLowerCase().includes(q);
    });
    return json({ events });
  }

  if (parts[0] === "boards") {
    const denied = deny(session, ["faculty"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET" && !parts[1]) {
      return json({ boards: db.boards.filter((board) => board.ownerId === session.userId) });
    }
    if (method === "GET" && parts[1]) {
      const board = db.boards.find((item) => item.id === parts[1] && item.ownerId === session.userId);
      if (!board) return fail("Board not found.", 404);
      return json({ board, documents: visibleDocs(db, session) });
    }
    if (method === "POST" && !parts[1]) {
      const body = z.object({ title: z.string().min(1), prompt: z.string().min(1) }).safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Add a prompt.", 400);
      const id = nid("board");
      updateDb((next) => {
        const board: Board = {
          id,
          title: body.data.title,
          ownerId: session.userId,
          institutionId: userOf(next, session)?.institutionId ?? "inst-sample",
          mode: "freeform",
          prompt: body.data.prompt,
          updatedAt: new Date().toISOString(),
          log: [
            { id: nid("log"), kind: "user", text: body.data.prompt, at: new Date().toISOString() },
            { id: nid("log"), kind: "step", label: "Read source", state: "done" },
            { id: nid("log"), kind: "step", label: "Draft section", state: "done" },
            { id: nid("log"), kind: "step", label: "Cite page", state: "done" },
            { id: nid("log"), kind: "step", label: "Check gaps", state: "done" },
            { id: nid("log"), kind: "note", text: "Draft-AI, teacher edit required." },
          ],
          shapes: [
            {
              id: nid("shape"),
              kind: "frame",
              x: 96,
              y: 96,
              w: 640,
              h: 360,
              text: body.data.title,
              fill: "#ffffff",
              color: "#1a1a18",
              fontSize: 28,
              fontWeight: 600,
              align: "left",
              opacity: 1,
              radius: 12,
              stroke: "#e6e4de",
              slide: true,
            },
          ],
        };
        next.boards.unshift(board);
      });
      return json({ boardId: id });
    }
    if (method === "PUT" && parts[1]) {
      const body = boardSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Could not save the board.", 400);
      let missing = false;
      updateDb((next) => {
        const board = next.boards.find((item) => item.id === parts[1] && item.ownerId === session.userId);
        if (!board) {
          missing = true;
          return;
        }
        if (body.data.title) board.title = body.data.title;
        if (body.data.mode) board.mode = body.data.mode;
        if (body.data.shapes) board.shapes = body.data.shapes as Shape[];
        if (body.data.log) board.log = body.data.log as Board["log"];
        board.updatedAt = new Date().toISOString();
      });
      if (missing) return fail("Board not found.", 404);
      return json({ ok: true });
    }
  }

  if (parts[0] === "forms") {
    const denied = deny(session, ["faculty"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET" && !parts[1]) return json({ forms: db.forms.filter((form) => form.ownerId === session.userId) });
    if (method === "GET" && parts[1]) {
      const form = db.forms.find((item) => item.id === parts[1] && item.ownerId === session.userId);
      if (!form) return fail("Form not found.", 404);
      return json({ form });
    }
    if (method === "PUT" && parts[1]) {
      const body = z
        .object({
          fields: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              kind: z.enum(["text", "date", "yesno", "long"]),
              required: z.boolean(),
              value: z.string(),
            }),
          ),
          signature: z.string().nullable(),
        })
        .safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Could not save the form.", 400);
      updateDb((next) => {
        const form = next.forms.find((item) => item.id === parts[1] && item.ownerId === session.userId);
        if (!form) return;
        form.fields = body.data.fields;
        form.signature = body.data.signature;
        form.updatedAt = new Date().toISOString();
      });
      return json({ ok: true });
    }
  }

  if (parts[0] === "eval") {
    const denied = deny(session, ["institution_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET" && parts[1] === "export") {
      const header = "taskId,pair,arm,outcome,score,ms,notes,participantId";
      const lines = db.evalAttempts.map((attempt) => {
        const task = db.evalTasks.find((item) => item.id === attempt.taskId);
        const notes = `"${attempt.notes.replaceAll('"', "'")}"`;
        return [attempt.taskId, task?.pair ?? "", task?.arm ?? "", attempt.outcome, attempt.score ?? "", attempt.ms ?? "", notes, attempt.participantId].join(",");
      });
      return new NextResponse([header, ...lines].join("\n"), {
        headers: { "content-type": "text/csv; charset=utf-8" },
      });
    }
    if (method === "GET") return json({ tasks: db.evalTasks, attempts: db.evalAttempts });
    if (method === "PUT") {
      const body = z
        .object({
          participantId: z.string(),
          attempts: z.array(
            z.object({
              taskId: z.string(),
              outcome: z.enum(["success", "skip", "timeout", "pending"]),
              score: z.number().nullable(),
              ms: z.number().nullable(),
              notes: z.string(),
              participantId: z.string(),
            }),
          ),
        })
        .safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Could not save the eval log.", 400);
      updateDb((next) => {
        next.evalAttempts = body.data.attempts.map((attempt) => ({
          ...attempt,
          participantId: body.data.participantId,
          score: attempt.outcome === "skip" || attempt.outcome === "timeout" ? null : attempt.score,
          ms: attempt.outcome === "skip" || attempt.outcome === "timeout" ? null : attempt.ms,
        }));
      });
      return json({ ok: true });
    }
  }

  if (method === "GET" && parts[0] === "institutions") {
    const denied = deny(session, ["super_admin"]);
    if (denied) return denied;
    const rows = db.institutions.map((institution) => ({
      ...institution,
      people: db.users.filter((user) => user.institutionId === institution.id).length,
      documents: db.documents.filter((doc) => doc.institutionId === institution.id && doc.scope === "institution").length,
      personal: db.documents.filter((doc) => doc.institutionId === institution.id && doc.scope === "personal").length,
      queue: db.queue.filter((item) => item.institutionId === institution.id && item.status === "needs_review").length,
    }));
    return json({ institutions: rows });
  }

  if (parts[0] === "health") {
    if (method === "GET") {
      const denied = deny(session, ["faculty", "institution_admin", "super_admin"]);
      if (denied) return denied;
      return json({ health: db.health });
    }
    if (method === "PUT") {
      const denied = deny(session, ["faculty", "super_admin"]);
      if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
      const body = healthSchema.safeParse(await request.json().catch(() => ({})));
      if (!body.success) return fail("Check the service status.", 400);
      updateDb((next) => {
        if (body.data.model) next.health.model = body.data.model;
        if (session.role === "super_admin") {
          if (body.data.ocr) next.health.ocr = body.data.ocr;
          if (body.data.index) next.health.index = body.data.index;
        }
      });
      return json({ health: loadDb().health });
    }
  }

  if (parts[0] === "accounts") {
    const denied = deny(session, ["super_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    if (method === "GET") {
      return json({ accounts: db.users.filter((user) => user.status === "pending").map(publicAccount) });
    }
    if (method === "POST" && parts[2] === "approve") {
      let missing = false;
      updateDb((next) => {
        const person = next.users.find((item) => item.id === parts[1] && item.status === "pending");
        if (!person) {
          missing = true;
          return;
        }
        person.status = "active";
        addAudit(next, {
          actor: session.name,
          action: "approve",
          detail: `Approved ${person.name}.`,
          institutionId: person.institutionId,
        });
      });
      if (missing) return fail("That account is not waiting.", 404);
      return json({ ok: true });
    }
  }

  if (method === "GET" && parts[0] === "overview") {
    const denied = deny(session, ["super_admin"]);
    if (denied) return denied;
    return json({
      queue: db.queue.filter((item) => item.status === "needs_review").length,
      roles: {
        faculty: db.users.filter((user) => user.role === "faculty").length,
        institution_admin: db.users.filter((user) => user.role === "institution_admin").length,
        super_admin: db.users.filter((user) => user.role === "super_admin").length,
      },
      institutionDocs: db.documents.filter((doc) => doc.scope === "institution").length,
      personalDocs: db.documents.filter((doc) => doc.scope === "personal").length,
      waiting: db.users.filter((user) => user.status === "pending").length,
      audit: db.audit.slice(0, 6),
      health: db.health,
    });
  }

  if (method === "POST" && parts[0] === "settings" && parts[1] === "password") {
    const denied = deny(session, ["faculty", "institution_admin", "super_admin"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    const body = passwordSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) return fail(body.error.issues[0]?.message ?? "Check the password.", 400);
    let ok = false;
    updateDb((next) => {
      const account = next.users.find((user) => user.id === session.userId);
      if (!account || account.password !== body.data.current) return;
      account.password = body.data.next;
      ok = true;
    });
    if (!ok) return fail("The current password is wrong.", 400);
    return json({ ok: true });
  }

  if (method === "POST" && parts[0] === "activity" && parts[1] === "open") {
    const denied = deny(session, ["faculty"]);
    if (denied) return denied;
    if (!session) return fail("Sign in again.", 401);
    const body = z.object({ title: z.string().min(1) }).safeParse(await request.json().catch(() => ({})));
    if (!body.success) return fail("Missing title.", 400);
    updateDb((next) => {
      const opened = next.activity.opened.find((item) => item.title === body.data.title);
      if (opened) opened.count += 1;
      else next.activity.opened.unshift({ title: body.data.title, count: 1 });
    });
    return json({ ok: true });
  }

  return fail("Not found.", 404);
}
