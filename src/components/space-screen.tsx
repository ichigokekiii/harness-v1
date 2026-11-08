"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowUp,
  CaretDown,
  CaretUp,
  ChatCircle,
  Check,
  Cursor,
  Export,
  FileText,
  FloppyDisk,
  PencilSimple,
  Square,
  Stack,
  TextT,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { call } from "@/api/client";
import { Panel, Shell, StateMessage } from "@/components/shell";
import { snapshot, useSpace } from "@/components/space-store";
import type { Board, LibraryDocument, Shape, Tool } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { LOCAL_MODEL } from "@/lib/model";

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
          className="rounded-composer bg-panel px-3 pb-2.5 pt-3.5 shadow-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (prompt.trim()) create.mutate();
          }}
        >
          <label className="sr-only" htmlFor="space-prompt">
            What should the board hold?
          </label>
          <textarea
            id="space-prompt"
            rows={2}
            className="block w-full resize-none bg-transparent px-1.5 text-[16px] leading-7 [field-sizing:content] focus-visible:outline-none"
            placeholder="What should the board hold?"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="mt-2 flex items-center">
            <span className="px-1.5 text-[13px] text-muted">{LOCAL_MODEL}</span>
            <button className="ml-auto h-9 rounded-full bg-primary px-4 text-[14px] font-medium text-primary-ink hover:bg-primary-hover" type="submit">
              Make a board
            </button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Turn the ecosystems page into slides", "Draft a lab safety frame"].map((item) => (
            <button key={item} className="h-9 rounded-full border border-line px-3.5 text-[14px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>
        <h2 className="mb-3 mt-10 text-[13px] font-medium text-muted">Boards</h2>
        {boards.isLoading ? <p className="text-[14px] text-muted" role="status">Loading boards</p> : null}
        {boards.isError ? <StateMessage title="Boards unavailable" body="Try again." onRetry={() => void boards.refetch()} /> : null}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(boards.data?.boards ?? []).map((board) => (
            <li key={board.id}>
              <Link className="group block overflow-hidden rounded-panel border border-line bg-panel transition-colors hover:border-ink/20" href={`/space/${board.id}`}>
                <div className="dots aspect-[16/9] border-b border-line bg-root" aria-hidden>
                  <div className="mx-auto mt-[12%] h-1/2 w-2/3 rounded-md border border-line bg-panel" />
                </div>
                <div className="px-3.5 py-3">
                  <p className="truncate text-[14px] font-medium">{board.title}</p>
                  <p className="mt-0.5 text-[12px] capitalize text-muted">
                    {board.shapes.length} objects, {board.mode}
                  </p>
                </div>
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
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let fitted = false;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (fitted || width === 0) return;
      fitted = true;
      const current = useSpace.getState().board;
      if (!current) return;
      const shapes = current.mode === "slides" ? current.shapes.filter((shape) => shape.kind === "frame").slice(0, 1).map(() => ({ x: 40, y: 40, w: 640, h: 360 })) : current.shapes;
      if (!shapes.length) return;
      const minX = Math.min(...shapes.map((shape) => shape.x));
      const minY = Math.min(...shapes.map((shape) => shape.y));
      const maxX = Math.max(...shapes.map((shape) => shape.x + shape.w));
      const maxY = Math.max(...shapes.map((shape) => shape.y + shape.h));
      const z = Math.min(1, Math.max(0.4, Math.min((width - 96) / (maxX - minX), (height - 180) / (maxY - minY))));
      setCam({ x: (width - (maxX - minX) * z) / 2 - minX * z, y: Math.max(56, (height - 80 - (maxY - minY) * z) / 2) - minY * z, z });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

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
    <div className="flex h-[calc(100dvh-48px)] min-h-[600px] flex-col md:h-dvh">
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line px-3">
        <input
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[14px] font-medium hover:bg-soft/70 focus:bg-soft/70 focus-visible:outline-none"
          aria-label="Board title"
          value={board.title}
          onChange={(event) => updateBoard({ title: event.target.value })}
        />
        <div className="hidden items-center rounded-lg bg-soft p-0.5 sm:flex" role="group" aria-label="Board mode">
          {(["freeform", "slides"] as const).map((mode) => (
            <button
              key={mode}
              className={cn("h-7 rounded-md px-2.5 text-[13px] capitalize", board.mode === mode ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/8%)]" : "text-secondary hover:text-ink")}
              type="button"
              aria-pressed={board.mode === mode}
              onClick={() => updateBoard({ mode })}
            >
              {mode}
            </button>
          ))}
        </div>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={() => setSaved(true)}>
          <FloppyDisk size={16} /> {saved ? "Saved" : "Save"}
        </button>
        <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] text-secondary hover:bg-soft hover:text-ink" type="button" onClick={() => window.print()}>
          PDF
        </button>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-ink hover:bg-primary-hover" type="button" onClick={() => void exportPptx()}>
          <Export size={16} /> PPTX
        </button>
      </header>
      {saved ? <p className="sr-only" role="status">Saved</p> : null}
      {narrow ? (
        <div className="flex gap-0.5 border-b border-line p-1.5">
          {(["agent", "canvas", "inspector"] as const).map((pane) => (
            <button
              key={pane}
              className={cn("h-8 flex-1 rounded-md text-[13px] capitalize", mobilePane === pane ? "bg-soft font-medium text-ink" : "text-secondary")}
              type="button"
              aria-pressed={mobilePane === pane}
              onClick={() => setMobilePane(pane)}
            >
              {pane}
            </button>
          ))}
        </div>
      ) : null}
      {narrow ? <p className="px-4 py-2 text-[12px] text-muted">View only on a small screen. Editing stays on a wider window.</p> : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_264px]">
        <section className={cn("flex min-h-0 flex-col border-r border-line bg-sidebar", narrow && mobilePane !== "agent" && "hidden")}>
          <div className="flex gap-0.5 px-2 pt-2" role="tablist" aria-label="Side panel">
            {(
              [
                ["agent", "Agent"],
                ["library", "Library"],
                ["layers", "Layers"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={cn("h-8 rounded-md px-2.5 text-[13px]", tab === id ? "bg-soft font-medium text-ink" : "text-secondary hover:text-ink")}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "agent" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ol className="flex-1 space-y-2.5 overflow-auto px-3 py-3">
                {board.log.map((entry) =>
                  entry.kind === "user" ? (
                    <li key={entry.id} className="rounded-lg border border-line bg-root px-3 py-2 text-[13px] leading-5">
                      {entry.text}
                    </li>
                  ) : entry.kind === "step" ? (
                    <li key={entry.id} className="flex items-center gap-2 px-1 text-[13px] text-muted">
                      <Check size={13} />
                      {entry.label}
                    </li>
                  ) : (
                    <li key={entry.id} className="px-1 text-[13px] leading-5">
                      {entry.text}
                    </li>
                  ),
                )}
              </ol>
              <form
                className="p-2.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!narrow) void generate(false);
                }}
              >
                <div className="rounded-xl border border-line bg-panel px-2.5 pb-2 pt-2.5 focus-within:border-ink/25">
                  <label className="sr-only" htmlFor="agent-prompt">Agent prompt</label>
                  <textarea
                    id="agent-prompt"
                    rows={2}
                    className="block max-h-40 w-full resize-none bg-transparent text-[13px] leading-5 [field-sizing:content] focus-visible:outline-none"
                    placeholder="Plan, draft, or revise a section"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-secondary">Agent</span>
                    <span className="text-[11px] text-muted">{LOCAL_MODEL}</span>
                    <button
                      className="ml-auto inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-ink hover:bg-primary-hover disabled:bg-soft disabled:text-muted"
                      type="submit"
                      aria-label="Draft section"
                      disabled={narrow}
                    >
                      <ArrowUp size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : null}
          {tab === "library" ? (
            <ul className="space-y-px overflow-auto p-2">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    className="flex h-9 w-full cursor-grab items-center gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-soft active:cursor-grabbing"
                    type="button"
                    draggable={!narrow}
                    title="Drag onto the canvas or click to add"
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", doc.title)}
                    onClick={() => !narrow && addAt("frame", 140, 160, doc.title)}
                  >
                    <FileText size={16} className="shrink-0 text-muted" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "layers" ? (
            <ul className="space-y-px overflow-auto p-2">
              {board.shapes.map((shape) => (
                <li key={shape.id} className="group flex items-center rounded-lg hover:bg-soft/70">
                  <button className={cn("flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px]", shape.id === selectedId && "bg-soft font-medium")} type="button" aria-label={`Layer ${shape.text || shape.kind}`} onClick={() => select(shape.id)}>
                    <ToolIcon tool={shape.kind === "rect" ? "rect" : shape.kind === "text" ? "text" : shape.kind === "comment" ? "comment" : shape.kind === "draw" ? "draw" : "frame"} size={14} />
                    <span className="truncate">{shape.text.slice(0, 32) || shape.kind}</span>
                  </button>
                  <button className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-ink" type="button" aria-label={`Move ${shape.text} up`} onClick={() => reorder(shape.id, -1)}>
                    <CaretUp size={12} />
                  </button>
                  <button className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-ink" type="button" aria-label={`Move ${shape.text} down`} onClick={() => reorder(shape.id, 1)}>
                    <CaretDown size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section ref={stageRef} className={cn("relative min-h-[480px] overflow-hidden bg-root", narrow && mobilePane !== "canvas" && "hidden")} aria-label="Canvas">
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
          <p className="pointer-events-none absolute left-4 top-3 text-[12px] text-muted">Draft-AI, teacher edit required</p>
          <p className="pointer-events-none absolute bottom-5 right-4 rounded-md bg-panel/80 px-1.5 py-0.5 text-[11px] tabular-nums text-muted">{Math.round(cam.z * 100)}%</p>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-elevated p-1 shadow-pop" role="toolbar" aria-label="Canvas tools">
            {tools.map((item) => (
              <button
                key={item.id}
                className={cn("inline-flex size-9 items-center justify-center rounded-lg transition-colors", tool === item.id ? "bg-primary text-primary-ink" : "text-secondary hover:bg-soft hover:text-ink")}
                type="button"
                aria-label={item.label}
                title={item.label}
                aria-pressed={tool === item.id}
                onClick={() => setTool(item.id)}
              >
                <ToolIcon tool={item.id} />
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <button className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Undo" title="Undo  ⌘Z" onClick={undo}>
              <ArrowCounterClockwise size={18} />
            </button>
            <button className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Redo" title="Redo  ⇧⌘Z" onClick={redo}>
              <ArrowClockwise size={18} />
            </button>
          </div>
        </section>
        <aside className={cn("overflow-y-auto border-l border-line bg-sidebar", narrow && mobilePane !== "inspector" && "hidden")}>
          <h2 className="px-4 pb-1 pt-4 text-[13px] font-medium">Inspector</h2>
          {selected ? (
            <div className="text-[12px] text-muted">
              <InspectorGroup title="Text">
                <label className="block">
                  <span className="sr-only">Text</span>
                  <textarea aria-label="Text" className={cn(inspectorField, "min-h-16 py-1.5 leading-5")} value={selected.text} onChange={(event) => patch(selected.id, { text: event.target.value })} />
                </label>
              </InspectorGroup>
              <InspectorGroup title="Typography">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    Size
                    <input className={cn(inspectorField, "mt-1 tabular-nums")} type="number" value={selected.fontSize} onChange={(event) => patch(selected.id, { fontSize: Number(event.target.value) })} />
                  </label>
                  <label className="block">
                    Weight
                    <select className={cn(inspectorField, "mt-1")} value={selected.fontWeight} onChange={(event) => patch(selected.id, { fontWeight: Number(event.target.value) as 400 | 600 | 700 })}>
                      <option value={400}>Regular</option>
                      <option value={600}>Semibold</option>
                      <option value={700}>Bold</option>
                    </select>
                  </label>
                </div>
                <label className="mt-2 block">
                  Align
                  <select className={cn(inspectorField, "mt-1")} value={selected.align} onChange={(event) => patch(selected.id, { align: event.target.value as Shape["align"] })}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </InspectorGroup>
              <InspectorGroup title="Fill">
                <ColorField label="Text color" value={selected.color} onChange={(value) => patch(selected.id, { color: value })} />
                <ColorField label="Fill" value={selected.fill} onChange={(value) => patch(selected.id, { fill: value })} />
                <label className="mt-2 block">
                  <span className="flex justify-between">
                    Opacity <span className="tabular-nums text-ink">{Math.round(selected.opacity * 100)}%</span>
                  </span>
                  <input className="mt-1.5 w-full accent-[var(--text-primary)]" type="range" min={0.2} max={1} step={0.05} value={selected.opacity} onChange={(event) => patch(selected.id, { opacity: Number(event.target.value) })} />
                </label>
              </InspectorGroup>
              <div className="p-4">
                <button className="h-8 w-full rounded-lg border border-line bg-panel text-[13px] text-ink hover:bg-soft disabled:text-muted" type="button" onClick={() => void generate(true)} disabled={!selected || narrow}>
                  Revise this section
                </button>
              </div>
            </div>
          ) : (
            <p className="px-4 pt-2 text-[13px] text-muted">Select an object on the canvas to edit it.</p>
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
      className={cn(
        "absolute overflow-hidden border p-3 text-left",
        shape.kind === "frame" && "shadow-[0_1px_2px_rgb(38_37_30/6%),0_6px_20px_-10px_rgb(38_37_30/18%)]",
        selected && "outline outline-2 outline-offset-2 outline-[#3b82f6]",
      )}
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

function ToolIcon({ tool, size = 18 }: { tool: Tool; size?: number }) {
  if (tool === "select") return <Cursor size={size} />;
  if (tool === "frame") return <Stack size={size} />;
  if (tool === "rect") return <Square size={size} />;
  if (tool === "text") return <TextT size={size} />;
  if (tool === "draw") return <PencilSimple size={size} />;
  return <ChatCircle size={size} />;
}

const inspectorField =
  "h-8 w-full rounded-md border border-transparent bg-soft px-2 text-[13px] text-ink hover:border-line focus:border-ink/30 focus-visible:outline-none";

function InspectorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3">
      <h3 className="mb-2 text-[12px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-2 flex items-center gap-2 first:mt-0">
      <span className="w-16 shrink-0">{label}</span>
      <span className={cn(inspectorField, "flex items-center gap-2")}>
        <input className="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
        <span className="font-mono text-[12px] uppercase">{value.replace("#", "")}</span>
      </span>
    </label>
  );
}
