"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ChatCircle,
  Cursor,
  Export,
  FloppyDisk,
  PencilSimple,
  Square,
  Stack,
  TextT,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { call } from "@/api/client";
import { Panel, Shell, StateMessage } from "@/components/shell";
import { snapshot, useSpace } from "@/components/space-store";
import type { Board, LibraryDocument, Shape, Tool } from "@/lib/domain";
import { cn } from "@/lib/cn";

const tools: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "frame", label: "Frame" },
  { id: "rect", label: "Rectangle" },
  { id: "text", label: "Text" },
  { id: "draw", label: "Draw" },
  { id: "comment", label: "Comment" },
];

export function SpaceHome() {
  const router = useRouter();
  const boards = useQuery({ queryKey: ["boards"], queryFn: () => call<{ boards: Board[] }>("/api/harness/boards") });
  const [prompt, setPrompt] = useState("Make a short lesson on ecosystems.");
  const create = useMutation({
    mutationFn: () => call<{ boardId: string }>("/api/harness/boards", { method: "POST", body: { title: prompt.slice(0, 48), prompt } }),
    onSuccess: (result) => router.push(`/space/${result.boardId}`),
  });
  return (
    <Shell>
      <Panel title="Space">
        <form
          className="rounded-composer border border-line bg-panel p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (prompt.trim()) create.mutate();
          }}
        >
          <label className="block text-sm">
            What should the board hold?
            <textarea className="mt-2 min-h-20 w-full bg-transparent text-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <button className="mt-2 min-h-11 rounded-control bg-primary px-4 text-sm text-primary-ink" type="submit">
            Make a board
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Turn the ecosystems page into slides", "Draft a lab safety frame"].map((item) => (
            <button key={item} className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>
        {boards.isLoading ? <p className="mt-6 text-sm" role="status">Loading boards</p> : null}
        {boards.isError ? <StateMessage title="Boards unavailable" body="Try again." onRetry={() => void boards.refetch()} /> : null}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {(boards.data?.boards ?? []).map((board) => (
            <li key={board.id}>
              <Link className="block min-h-24 rounded-panel border border-line bg-panel p-4" href={`/space/${board.id}`}>
                <p className="text-sm font-medium">{board.title}</p>
                <p className="mt-1 text-xs text-muted">{board.shapes.length} objects · {board.mode}</p>
              </Link>
            </li>
          ))}
        </ul>
        {(boards.data?.boards.length ?? 0) === 0 && !boards.isLoading ? <StateMessage title="No boards yet" body="Start with a prompt." /> : null}
      </Panel>
    </Shell>
  );
}

export function SpaceBoard({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["board", id],
    queryFn: () => call<{ board: Board; documents: LibraryDocument[] }>(`/api/harness/boards/${id}`),
  });
  const load = useSpace((state) => state.load);
  const board = useSpace((state) => state.board);
  useEffect(() => {
    if (query.data?.board) load(query.data.board);
  }, [load, query.data?.board]);
  useEffect(() => {
    if (!board || board.id !== id) return;
    const timer = window.setTimeout(() => {
      void call(`/api/harness/boards/${board.id}`, {
        method: "PUT",
        body: { title: board.title, mode: board.mode, shapes: board.shapes, log: board.log },
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [board, id]);
  return (
    <Shell>
      {query.isLoading || !board ? <p className="p-8 text-sm" role="status">Loading the board</p> : null}
      {query.isError ? <StateMessage title="Board missing" body="It may have been removed." /> : null}
      {board && board.id === id ? <Canvas documents={query.data?.documents ?? []} /> : null}
    </Shell>
  );
}

function Canvas({ documents }: { documents: LibraryDocument[] }) {
  const board = useSpace((state) => state.board)!;
  const tool = useSpace((state) => state.tool);
  const setTool = useSpace((state) => state.setTool);
  const selectedId = useSpace((state) => state.selectedId);
  const select = useSpace((state) => state.select);
  const patch = useSpace((state) => state.patch);
  const remember = useSpace((state) => state.remember);
  const addShape = useSpace((state) => state.addShape);
  const removeSelected = useSpace((state) => state.removeSelected);
  const undo = useSpace((state) => state.undo);
  const redo = useSpace((state) => state.redo);
  const reorder = useSpace((state) => state.reorder);
  const updateBoard = useSpace((state) => state.updateBoard);
  const [tab, setTab] = useState<"agent" | "library" | "layers">("agent");
  const [narrow, setNarrow] = useState(false);
  const [mobilePane, setMobilePane] = useState<"agent" | "canvas" | "inspector">("canvas");
  const [cam, setCam] = useState({ x: 48, y: 48, z: 1 });
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const selected = board.shapes.find((shape) => shape.id === selectedId) ?? null;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (typing || narrow) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      }
      if (selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 20 : 4;
        const before = snapshot(board);
        const partial =
          event.key === "ArrowUp" ? { y: selected.y - step } : event.key === "ArrowDown" ? { y: selected.y + step } : event.key === "ArrowLeft" ? { x: selected.x - step } : { x: selected.x + step };
        patch(selected.id, partial);
        remember(before);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board, narrow, patch, redo, remember, removeSelected, selected, undo]);

  function addAt(kind: Shape["kind"], x: number, y: number, text = "New frame") {
    addShape({
      id: `shape-${crypto.randomUUID().slice(0, 8)}`,
      kind,
      x,
      y,
      w: kind === "text" || kind === "comment" ? 220 : 320,
      h: kind === "text" || kind === "comment" ? 80 : 180,
      text: kind === "comment" ? "Note" : text,
      fill: kind === "rect" ? "#fdcc01" : "#ffffff",
      color: "#1a1a18",
      fontSize: kind === "frame" ? 24 : 16,
      fontWeight: kind === "frame" ? 600 : 400,
      align: "left",
      opacity: 1,
      radius: 12,
      stroke: "#e6e4de",
      slide: kind === "frame",
      points: kind === "draw" ? [{ x: 0, y: 0 }] : undefined,
    });
  }

  async function generate(revise = false) {
    const before = snapshot(board);
    const steps = ["Read source", "Draft section", "Cite page", "Check gaps"];
    const entries = [
      ...board.log,
      { id: `log-${crypto.randomUUID().slice(0, 8)}`, kind: "user" as const, text: prompt || "Revise this section", at: new Date().toISOString() },
    ];
    for (const label of steps) {
      entries.push({ id: `log-${crypto.randomUUID().slice(0, 8)}`, kind: "step", label, state: "done" });
    }
    entries.push({ id: `log-${crypto.randomUUID().slice(0, 8)}`, kind: "note", text: "Draft-AI, teacher edit required." });
    if (revise && selected) {
      patch(selected.id, { text: `${selected.text} Revised from the sample page.` });
      updateBoard({ log: entries });
    } else {
      addShape({
        id: `shape-${crypto.randomUUID().slice(0, 8)}`,
        kind: "frame",
        x: 120 + board.shapes.length * 24,
        y: 140,
        w: 480,
        h: 240,
        text: prompt || "Draft section",
        fill: "#ffffff",
        color: "#1a1a18",
        fontSize: 22,
        fontWeight: 600,
        align: "left",
        opacity: 1,
        radius: 12,
        stroke: "#e6e4de",
        slide: true,
      });
      updateBoard({ log: entries });
    }
    remember(before);
    setPrompt("");
  }

  async function exportPptx() {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    const frames = board.shapes.filter((shape) => shape.kind === "frame");
    for (const shape of frames) {
      const slide = pptx.addSlide();
      slide.background = { color: "F7F7F5" };
      slide.addText(shape.text, { x: 0.5, y: 1.4, w: 9, h: 2, fontSize: 28, color: "002D62", fontFace: "Arial" });
    }
    await pptx.writeFile({ fileName: `${board.title}.pptx` });
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-[640px] flex-col md:h-dvh">
      <header className="flex h-14 items-center gap-2 border-b border-line px-3">
        <input
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-medium"
          aria-label="Board title"
          value={board.title}
          onChange={(event) => updateBoard({ title: event.target.value })}
        />
        <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => updateBoard({ mode: board.mode === "slides" ? "freeform" : "slides" })}>
          {board.mode === "slides" ? "Freeform" : "Slides"}
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-1 rounded-control border border-line px-3 text-sm"
          type="button"
          onClick={() => {
            setSaved(true);
          }}
        >
          <FloppyDisk size={16} /> Save
        </button>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-control bg-primary px-3 text-sm text-primary-ink" type="button" onClick={() => void exportPptx()}>
          <Export size={16} /> PPTX
        </button>
        <button className="min-h-11 rounded-control border border-line px-3 text-sm" type="button" onClick={() => window.print()}>
          PDF
        </button>
      </header>
      {saved ? <p className="sr-only" role="status">Saved</p> : null}
      {narrow ? (
        <div className="flex border-b border-line">
          {(["agent", "canvas", "inspector"] as const).map((pane) => (
            <button key={pane} className="min-h-11 flex-1 text-sm capitalize" type="button" onClick={() => setMobilePane(pane)}>
              {pane}
            </button>
          ))}
        </div>
      ) : null}
      {narrow ? <p className="bg-soft px-3 py-2 text-xs text-secondary">View only on a small screen. Editing stays on a wider window.</p> : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        <section className={cn("border-r border-line bg-sidebar", narrow && mobilePane !== "agent" && "hidden")}>
          <div className="flex border-b border-line">
            {(
              [
                ["agent", "Agent"],
                ["library", "Library"],
                ["layers", "Layers"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={cn("min-h-11 flex-1 text-sm", tab === id && "border-b-2 border-primary font-medium")} type="button" onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === "agent" ? (
            <div className="flex h-[calc(100%-44px)] flex-col">
              <ol className="flex-1 space-y-2 overflow-auto p-3 text-sm">
                {board.log.map((entry) => (
                  <li key={entry.id} className="rounded-control bg-panel px-2 py-2">
                    {entry.kind === "step" ? entry.label : entry.kind === "user" ? entry.text : entry.text}
                  </li>
                ))}
              </ol>
              <form
                className="border-t border-line p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!narrow) void generate(false);
                }}
              >
                <label className="sr-only" htmlFor="agent-prompt">Agent prompt</label>
                <textarea id="agent-prompt" className="min-h-16 w-full rounded-control border border-line bg-panel px-2 py-2 text-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                <button className="mt-2 min-h-11 w-full rounded-control bg-primary text-sm text-primary-ink" type="submit" disabled={narrow}>
                  Draft section
                </button>
              </form>
            </div>
          ) : null}
          {tab === "library" ? (
            <ul className="space-y-2 p-3">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    className="min-h-11 w-full rounded-control border border-line bg-panel px-2 text-left text-sm"
                    type="button"
                    draggable={!narrow}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", doc.title)}
                    onClick={() => !narrow && addAt("frame", 140, 160, doc.title)}
                  >
                    {doc.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "layers" ? (
            <ul className="space-y-1 p-2">
              {board.shapes.map((shape) => (
                <li key={shape.id} className="flex items-center gap-1">
                  <button className={cn("min-h-11 flex-1 rounded-control px-2 text-left text-sm", shape.id === selectedId && "bg-panel")} type="button" aria-label={`Layer ${shape.text || shape.kind}`} onClick={() => select(shape.id)}>
                    {shape.text.slice(0, 32) || shape.kind}
                  </button>
                  <button className="size-11" type="button" aria-label={`Move ${shape.text} up`} onClick={() => reorder(shape.id, -1)}>
                    Up
                  </button>
                  <button className="size-11" type="button" aria-label={`Move ${shape.text} down`} onClick={() => reorder(shape.id, 1)}>
                    Down
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className={cn("relative min-h-[480px] overflow-hidden bg-root", narrow && mobilePane !== "canvas" && "hidden")} aria-label="Canvas">
          <div
            className="dots absolute inset-0"
            onWheel={(event) => {
              event.preventDefault();
              setCam((current) => ({ ...current, z: Math.min(2, Math.max(0.4, current.z + (event.deltaY > 0 ? -0.05 : 0.05))) }));
            }}
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (narrow) return;
              if (tool !== "select" && tool !== "draw") {
                const rect = event.currentTarget.getBoundingClientRect();
                addAt(tool === "rect" ? "rect" : tool === "text" ? "text" : tool === "comment" ? "comment" : "frame", (event.clientX - rect.left - cam.x) / cam.z, (event.clientY - rect.top - cam.y) / cam.z);
                setTool("select");
                return;
              }
              const start = { x: event.clientX, y: event.clientY, cx: cam.x, cy: cam.y };
              function move(ev: PointerEvent) {
                setCam((current) => ({ ...current, x: start.cx + ev.clientX - start.x, y: start.cy + ev.clientY - start.y }));
              }
              function up() {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              }
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (narrow) return;
              const rect = event.currentTarget.getBoundingClientRect();
              addAt("frame", (event.clientX - rect.left - cam.x) / cam.z, (event.clientY - rect.top - cam.y) / cam.z, event.dataTransfer.getData("text/plain") || "Source");
            }}
          >
            <div style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`, transformOrigin: "0 0" }}>
              {(board.mode === "slides" ? board.shapes.filter((shape) => shape.kind === "frame") : board.shapes).map((shape, index) => (
                <ShapeView key={shape.id} shape={board.mode === "slides" ? { ...shape, x: 40 + index * 700, y: 40, w: 640, h: 360 } : shape} locked={narrow} />
              ))}
            </div>
          </div>
          <p className="pointer-events-none absolute bottom-16 left-4 text-xs text-muted">Draft-AI, teacher edit required</p>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-panel bg-navy p-1 text-white">
            {tools.map((item) => (
              <button
                key={item.id}
                className={cn("inline-flex size-11 items-center justify-center rounded-control", tool === item.id && "text-gold")}
                type="button"
                aria-label={item.label}
                aria-pressed={tool === item.id}
                onClick={() => setTool(item.id)}
              >
                <ToolIcon tool={item.id} />
              </button>
            ))}
            <button className="inline-flex size-11 items-center justify-center" type="button" aria-label="Undo" onClick={undo}>
              <ArrowCounterClockwise size={18} />
            </button>
            <button className="inline-flex size-11 items-center justify-center" type="button" aria-label="Redo" onClick={redo}>
              <ArrowClockwise size={18} />
            </button>
          </div>
        </section>
        <aside className={cn("border-l border-line bg-sidebar p-3", narrow && mobilePane !== "inspector" && "hidden")}>
          <h2 className="text-sm font-medium">Inspector</h2>
          {selected ? (
            <div className="mt-3 space-y-3 text-sm">
              <label className="block">
                Text
                <textarea className="mt-1 min-h-20 w-full rounded-control border border-line bg-panel px-2 py-2" value={selected.text} onChange={(event) => patch(selected.id, { text: event.target.value })} />
              </label>
              <label className="block">
                Size
                <input className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-2" type="number" value={selected.fontSize} onChange={(event) => patch(selected.id, { fontSize: Number(event.target.value) })} />
              </label>
              <label className="block">
                Weight
                <select className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-2" value={selected.fontWeight} onChange={(event) => patch(selected.id, { fontWeight: Number(event.target.value) as 400 | 600 | 700 })}>
                  <option value={400}>Regular</option>
                  <option value={600}>Semibold</option>
                  <option value={700}>Bold</option>
                </select>
              </label>
              <label className="block">
                Align
                <select className="mt-1 min-h-11 w-full rounded-control border border-line bg-panel px-2" value={selected.align} onChange={(event) => patch(selected.id, { align: event.target.value as Shape["align"] })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="block">
                Text color
                <input className="mt-1 h-11 w-full" type="color" value={selected.color} onChange={(event) => patch(selected.id, { color: event.target.value })} />
              </label>
              <label className="block">
                Fill
                <input className="mt-1 h-11 w-full" type="color" value={selected.fill} onChange={(event) => patch(selected.id, { fill: event.target.value })} />
              </label>
              <label className="block">
                Opacity
                <input className="mt-1 w-full" type="range" min={0.2} max={1} step={0.05} value={selected.opacity} onChange={(event) => patch(selected.id, { opacity: Number(event.target.value) })} />
              </label>
              <button className="min-h-11 w-full rounded-control border border-line bg-panel" type="button" onClick={() => void generate(true)} disabled={!selected || narrow}>
                Revise this section
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Select an object.</p>
          )}
        </aside>
      </div>
      <div className="print-root">
        {board.shapes
          .filter((shape) => shape.kind === "frame")
          .map((shape) => (
            <article key={shape.id} className="mb-6 p-8">
              <h1 className="text-3xl text-[#002d62]">{shape.text}</h1>
            </article>
          ))}
      </div>
    </div>
  );
}

function ShapeView({ shape, locked }: { shape: Shape; locked: boolean }) {
  const select = useSpace((state) => state.select);
  const patch = useSpace((state) => state.patch);
  const remember = useSpace((state) => state.remember);
  const board = useSpace((state) => state.board);
  const selected = useSpace((state) => state.selectedId) === shape.id;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={shape.text || shape.kind}
      aria-pressed={selected}
      className={cn("absolute overflow-hidden border p-3 text-left", selected && "ring-2 ring-primary")}
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.w,
        height: shape.h,
        background: shape.fill,
        color: shape.color,
        fontSize: shape.fontSize,
        fontWeight: shape.fontWeight,
        textAlign: shape.align,
        opacity: shape.opacity,
        borderRadius: shape.radius,
        borderColor: shape.stroke,
        pointerEvents: locked ? "none" : "auto",
      }}
      onPointerDown={(event) => {
        if (locked) return;
        event.stopPropagation();
        select(shape.id);
        if (!board) return;
        const before = snapshot(board);
        const start = { x: event.clientX, y: event.clientY, sx: shape.x, sy: shape.y };
        let moved = false;
        function move(ev: PointerEvent) {
          moved = true;
          patch(shape.id, { x: start.sx + ev.clientX - start.x, y: start.sy + ev.clientY - start.y });
        }
        function up() {
          if (moved) remember(before);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      {shape.kind === "draw" ? <span className="text-xs">Drawing</span> : shape.text}
      {selected && !locked ? (
        <span
          className="absolute bottom-0 right-0 size-11 cursor-se-resize"
          aria-label={`Resize ${shape.text}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!board) return;
            const before = snapshot(board);
            const start = { x: event.clientX, y: event.clientY, w: shape.w, h: shape.h };
            function move(ev: PointerEvent) {
              patch(shape.id, { w: Math.max(80, start.w + ev.clientX - start.x), h: Math.max(48, start.h + ev.clientY - start.y) });
            }
            function up() {
              remember(before);
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            }
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
      ) : null}
    </div>
  );
}

function ToolIcon({ tool }: { tool: Tool }) {
  if (tool === "select") return <Cursor size={18} />;
  if (tool === "frame") return <Stack size={18} />;
  if (tool === "rect") return <Square size={18} />;
  if (tool === "text") return <TextT size={18} />;
  if (tool === "draw") return <PencilSimple size={18} />;
  return <ChatCircle size={18} />;
}
