export const roles = ["faculty", "institution_admin", "super_admin"] as const;

export type Role = (typeof roles)[number];

export type Provider = "credentials" | "google" | "google-mock";

export type Session = {
  userId: string;
  role: Role;
  name: string;
  username: string;
  provider: Provider;
  apiToken?: string;
  exp: number;
};

export type Account = {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  institutionId: string;
  status: "active" | "disabled" | "pending";
};

export type PublicAccount = Omit<Account, "password">;

export type CitationStatus = "current" | "superseded" | "conflict";

export type Citation = {
  id: string;
  docId: string;
  title: string;
  page: number;
  snippet: string;
  highlightTop: number;
  highlightHeight: number;
  status: CitationStatus;
  note?: string;
};

export type AnswerKind = "grounded" | "decline" | "search" | "conflict" | "superseded";

export type Segment = {
  text: string;
  cite?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  kind?: AnswerKind;
  citations?: Citation[];
  segments?: Segment[];
  source?: "sample" | "live";
};

export type Thread = {
  id: string;
  title: string;
  ownerId: string;
  institutionId: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type DocScope = "institution" | "personal";
export type DocStatus = "approved" | "pending" | "rejected" | "superseded";
export type DocKind = "pdf" | "image" | "docx" | "policy";

export type LibraryDocument = {
  id: string;
  title: string;
  scope: DocScope;
  ownerId: string;
  institutionId: string;
  department: string;
  subject: string;
  grade: string;
  kind: DocKind;
  visibility: "department" | "institution" | "private" | "rejected";
  status: DocStatus;
  retrieval: boolean;
  version: number;
  pageCount: number;
  updatedAt: string;
  shareStatus?: "pending" | "approved" | "rejected";
  versions: { version: number; updatedAt: string; note: string }[];
};

export type QueueStatus = "needs_review" | "approved" | "rejected" | "needs_transcription";

export type QueueItem = {
  id: string;
  documentId?: string;
  title: string;
  page: number;
  pageCount: number;
  confidence: number;
  handwritten: boolean;
  status: QueueStatus;
  source: "upload" | "faculty_share";
  uploadedBy: string;
  institutionId: string;
  scanLines: string[];
  ocrText: string;
  metadata: {
    subject: string;
    grade: string;
    type: string;
    department: string;
    visibility: "department" | "institution";
  };
  createdAt: string;
};

export type TicketKind = "missing_document" | "retirement";
export type TicketStatus = "open" | "done";

export type Ticket = {
  id: string;
  kind: TicketKind;
  status: TicketStatus;
  title: string;
  detail: string;
  documentId?: string;
  openedBy: string;
  institutionId: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  institutionId: string;
};

export type Align = "left" | "center" | "right";
export type Tool = "select" | "frame" | "rect" | "text" | "draw" | "comment";
export type ShapeKind = "frame" | "rect" | "text" | "draw" | "comment";

export type Shape = {
  id: string;
  parentId?: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  color: string;
  fontSize: number;
  fontWeight: 400 | 600 | 700;
  align: Align;
  opacity: number;
  radius: number;
  stroke: string;
  points?: { x: number; y: number }[];
  slide: boolean;
  image?: string;
};

export type AgentEntry =
  | { id: string; kind: "user"; text: string; at: string }
  | { id: string; kind: "step"; label: string; state: "done" | "active" }
  | { id: string; kind: "note"; text: string };

export type Board = {
  id: string;
  title: string;
  ownerId: string;
  institutionId: string;
  mode: "freeform" | "slides";
  prompt: string;
  shapes: Shape[];
  log: AgentEntry[];
  updatedAt: string;
};

export type FormField = {
  id: string;
  label: string;
  kind: "text" | "date" | "yesno" | "long";
  required: boolean;
  value: string;
};

export type FormDraft = {
  id: string;
  title: string;
  sourceLabel: string;
  sourceFile?: string;
  sourcePreview?: string;
  ownerId: string;
  fields: FormField[];
  signature: string | null;
  updatedAt: string;
};

export type EvalArm = "baseline" | "harness";
export type EvalOutcome = "success" | "skip" | "timeout" | "pending";

export type EvalTask = {
  id: string;
  pair: number;
  arm: EvalArm;
  title: string;
  prompt: string;
};

export type EvalAttempt = {
  taskId: string;
  outcome: EvalOutcome;
  score: number | null;
  ms: number | null;
  notes: string;
  participantId: string;
};

export type Institution = {
  id: string;
  name: string;
  city: string;
};

export type ServiceState = "up" | "down";

export type Health = {
  model: ServiceState;
  ocr: ServiceState;
  index: ServiceState;
};

export type Activity = {
  asked: { label: string; count: number }[];
  opened: { title: string; count: number }[];
};

export type DB = {
  users: Account[];
  threads: Thread[];
  documents: LibraryDocument[];
  queue: QueueItem[];
  tickets: Ticket[];
  audit: AuditEvent[];
  boards: Board[];
  forms: FormDraft[];
  evalTasks: EvalTask[];
  evalAttempts: EvalAttempt[];
  institutions: Institution[];
  health: Health;
  activity: Activity;
};

export function publicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    role: account.role,
    department: account.department,
    institutionId: account.institutionId,
    status: account.status,
  };
}
