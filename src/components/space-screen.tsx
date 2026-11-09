"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowUp,
  ChatCircle,
  Check,
  Cursor,
  Export,
  FilePdf,
  FloppyDisk,
  PencilSimple,
  Plus,
  Square,
  Stack,
  TextT,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { call } from "@/api/client";
import { FileCard, lessonCover } from "@/components/file-card";
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
  const [prompt, setPrompt] = useState("");
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
            <button className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-medium text-primary-ink hover:bg-primary-hover disabled:bg-soft disabled:text-muted" type="submit" disabled={!prompt.trim() || create.isPending}>
              <Plus size={16} />
              Make a board
            </button>
          </div>
        </form>
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
  const updateBoard = useSpace((state) => state.updateBoard);
  const [tab, setTab] = useState<"agent" | "library" | "layers">("agent");
  const [compact, setCompact] = useState(false);
  const [phone, setPhone] = useState(false);
  const [mobilePane, setMobilePane] = useState<"agent" | "canvas" | "inspector">("canvas");
  const [cam, setCam] = useState({ x: 48, y: 48, z: 1 });
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const selected = board.shapes.find((shape) => shape.id === selectedId) ?? null;
  const stageRef = useRef<HTMLElement>(null);
  const camRef = useRef(cam);
  useEffect(() => {
    camRef.current = cam;
  }, [cam]);

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
    const stage = stageRef.current;
    if (!stage) return;
    function zoomAbout(clientX: number, clientY: number, nextZ: number) {
      const rect = stage!.getBoundingClientRect();
      const current = camRef.current;
      const z = Math.min(2, Math.max(0.25, nextZ));
      const ox = clientX - rect.left;
      const oy = clientY - rect.top;
      const ratio = z / current.z;
      const next = { z, x: ox - (ox - current.x) * ratio, y: oy - (oy - current.y) * ratio };
      camRef.current = next;
      setCam(next);
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const current = camRef.current;
      if (event.ctrlKey) {
        zoomAbout(event.clientX, event.clientY, current.z * Math.exp(-event.deltaY * 0.01));
        return;
      }
      const next = { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY };
      camRef.current = next;
      setCam(next);
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  function zoomBy(delta: number) {
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    const current = camRef.current;
    const z = Math.min(2, Math.max(0.25, Math.round((current.z + delta) * 10) / 10));
    if (!rect) {
      setCam({ ...current, z });
      return;
    }
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const ox = clientX - rect.left;
    const oy = clientY - rect.top;
    const ratio = z / current.z;
    const next = { z, x: ox - (ox - current.x) * ratio, y: oy - (oy - current.y) * ratio };
    camRef.current = next;
    setCam(next);
  }

  useEffect(() => {
    const compactMedia = window.matchMedia("(max-width: 1023px)");
    const phoneMedia = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setCompact(compactMedia.matches);
      setPhone(phoneMedia.matches);
    };
    apply();
    compactMedia.addEventListener("change", apply);
    phoneMedia.addEventListener("change", apply);
    return () => {
      compactMedia.removeEventListener("change", apply);
      phoneMedia.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const z = key === "z" || event.code === "KeyZ";
      const y = key === "y" || event.code === "KeyY";
      if (mod && !event.altKey && (z || y)) {
        if (typing) return;
        event.preventDefault();
        if ((z && event.shiftKey) || y) redo();
        else undo();
        return;
      }
      if (typing || phone) return;
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
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [board, phone, patch, redo, remember, removeSelected, selected, undo]);

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
      const target = selected.kind === "frame" ? board.shapes.find((item) => item.parentId === selected.id && item.kind === "text") ?? selected : selected;
      patch(target.id, { text: `${target.text} Revised from the library page.` });
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
    const frames = board.shapes.filter((shape) => shape.kind === "frame" && !shape.parentId);
    for (const shape of frames) {
      const slide = pptx.addSlide();
      slide.background = { color: "F7F7F5" };
      const copy = board.shapes.find((item) => item.parentId === shape.id && item.kind === "text")?.text || shape.text;
      slide.addText(copy, { x: 0.5, y: 1.4, w: 9, h: 2, fontSize: 28, color: "002D62", fontFace: "Arial" });
    }
    await pptx.writeFile({ fileName: `${board.title}.pptx` });
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] min-h-0 flex-col md:h-dvh md:min-h-[600px]">
      <header className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-3 py-1.5">
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
        <button className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary hover:bg-soft hover:text-ink sm:h-8" type="button" onClick={() => setSaved(true)}>
          <FloppyDisk size={16} /> <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
        </button>
        <button className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary hover:bg-soft hover:text-ink sm:h-8" type="button" onClick={() => window.print()}>
          <FilePdf size={16} /> <span className="hidden sm:inline">PDF</span>
        </button>
        <button className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-ink hover:bg-primary-hover sm:h-8" type="button" onClick={() => void exportPptx()}>
          <Export size={16} /> <span className="hidden sm:inline">PPTX</span>
        </button>
      </header>
      {saved ? <p className="sr-only" role="status">Saved</p> : null}
      {compact ? (
        <div className="flex gap-0.5 border-b border-line p-1.5">
          {(["agent", "canvas", "inspector"] as const).map((pane) => (
            <button
              key={pane}
              className={cn("h-11 flex-1 rounded-md text-[13px] capitalize", mobilePane === pane ? "bg-soft font-medium text-ink" : "text-secondary")}
              type="button"
              aria-pressed={mobilePane === pane}
              onClick={() => setMobilePane(pane)}
            >
              {pane}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_264px]">
        <section className={cn("flex min-h-0 flex-col border-r border-line bg-sidebar", compact && mobilePane !== "agent" && "hidden")}>
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
                  void generate(false);
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
                    >
                      <ArrowUp size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : null}
          {tab === "library" ? (
            <ul className="space-y-3 overflow-auto p-3">
              {documents.map((doc, index) => (
                <li key={doc.id}>
                  <button
                    className="w-full cursor-grab text-left active:cursor-grabbing"
                    type="button"
                    draggable={!phone}
                    title="Drag onto the canvas or click to add"
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", doc.title)}
                    onClick={() => addAt("frame", 140, 160, doc.title)}
                  >
                    <FileCard title={doc.title} preview={doc.title} image={lessonCover(index)} compact />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "layers" ? <LayerTree shapes={board.shapes} selectedId={selectedId} onSelect={select} /> : null}
        </section>
        <section ref={stageRef} className={cn("relative min-h-[480px] overflow-hidden bg-root", compact && mobilePane !== "canvas" && "hidden")} aria-label="Canvas">
          <div
            className="dots absolute inset-0"
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (phone) return;
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
              if (phone) return;
              const rect = event.currentTarget.getBoundingClientRect();
              addAt("frame", (event.clientX - rect.left - cam.x) / cam.z, (event.clientY - rect.top - cam.y) / cam.z, event.dataTransfer.getData("text/plain") || "Source");
            }}
          >
            <div style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`, transformOrigin: "0 0" }}>
              {(board.mode === "slides" ? board.shapes.filter((shape) => shape.kind === "frame" && !shape.parentId) : board.shapes.filter((shape) => !shape.parentId)).map((shape, index) => (
                <ShapeView key={shape.id} zoom={cam.z} shape={board.mode === "slides" ? { ...shape, x: 40 + index * 700, y: 40, w: 640, h: 360 } : shape} locked={phone} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-5 right-4 flex items-center gap-0.5 rounded-lg bg-elevated p-0.5 shadow-pop">
            <button className="inline-flex size-7 items-center justify-center rounded-md text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Zoom out" onClick={() => zoomBy(-0.1)}>
              −
            </button>
            <button className="h-7 rounded-md px-1.5 text-[11px] tabular-nums text-muted hover:bg-soft hover:text-ink" type="button" aria-label="Reset zoom" onClick={() => zoomBy(1 - cam.z)}>
              {Math.round(cam.z * 100)}%
            </button>
            <button className="inline-flex size-7 items-center justify-center rounded-md text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Zoom in" onClick={() => zoomBy(0.1)}>
              +
            </button>
          </div>
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
            <button className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Undo" title="Undo  ⌘Z or Ctrl+Z" onClick={undo}>
              <ArrowCounterClockwise size={18} />
            </button>
            <button className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-soft hover:text-ink" type="button" aria-label="Redo" title="Redo  ⇧⌘Z or Ctrl+Y" onClick={redo}>
              <ArrowClockwise size={18} />
            </button>
          </div>
        </section>
        <aside className={cn("overflow-y-auto border-l border-line bg-sidebar", compact && mobilePane !== "inspector" && "hidden")}>
          <h2 className="px-4 pb-1 pt-4 text-[13px] font-medium">Inspector</h2>
          {selected ? (
            <div className="text-[12px] text-muted">
              <p className="px-4 pt-3 text-[13px] font-medium text-ink">{layerName(selected)}</p>
              {selected.kind === "text" || selected.kind === "comment" ? (
                <>
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
                    <ColorField label="Color" value={selected.color.startsWith("#") ? selected.color : "#26251e"} onChange={(value) => patch(selected.id, { color: value })} />
                  </InspectorGroup>
                </>
              ) : null}
              {selected.image && !selected.text ? (
                <InspectorGroup title="Picture">
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-panel px-2.5 text-[13px] text-ink hover:bg-soft">
                    Replace picture
                    <input
                      className="sr-only"
                      aria-label="Replace picture"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const before = snapshot(board);
                        const reader = new FileReader();
                        reader.onload = () => {
                          patch(selected.id, { image: String(reader.result) });
                          remember(before);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </InspectorGroup>
              ) : null}
              {selected.kind === "frame" || (selected.kind === "rect" && !selected.image) ? (
                <InspectorGroup title="Fill">
                  <ColorField label="Fill" value={selected.fill.startsWith("#") ? selected.fill : "#ffffff"} onChange={(value) => patch(selected.id, { fill: value })} />
                </InspectorGroup>
              ) : null}
              <InspectorGroup title="Effects">
                <label className="block">
                  <span className="flex justify-between">
                    Opacity <span className="tabular-nums text-ink">{Math.round(selected.opacity * 100)}%</span>
                  </span>
                  <input className="mt-1.5 w-full accent-[var(--text-primary)]" type="range" min={0.2} max={1} step={0.05} value={selected.opacity} onChange={(event) => patch(selected.id, { opacity: Number(event.target.value) })} />
                </label>
              </InspectorGroup>
              {selected.kind === "text" || selected.kind === "frame" ? (
                <div className="p-4">
                  <button className="h-11 w-full rounded-lg border border-line bg-panel text-[13px] text-ink hover:bg-soft sm:h-8" type="button" onClick={() => void generate(true)}>
                    Revise this section
                  </button>
                </div>
              ) : null}
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
              <h1 className="text-3xl text-[#002d62]">{board.shapes.find((item) => item.parentId === shape.id && item.kind === "text")?.text || shape.text}</h1>
            </article>
          ))}
      </div>
    </div>
  );
}

function ShapeView({ shape, locked, zoom }: { shape: Shape; locked: boolean; zoom: number }) {
  const select = useSpace((state) => state.select);
  const patch = useSpace((state) => state.patch);
  const remember = useSpace((state) => state.remember);
  const board = useSpace((state) => state.board);
  const selected = useSpace((state) => state.selectedId) === shape.id;
  const children = board?.shapes.filter((item) => item.parentId === shape.id) ?? [];
  const textLike = shape.kind === "text" || shape.kind === "comment";
  const picture = Boolean(shape.image) && !shape.text;
  const [editing, setEditing] = useState(false);
  const beforeEdit = useRef<ReturnType<typeof snapshot> | null>(null);
  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const scale = zoom || 1;

  function startTextEdit() {
    if (shape.kind === "draw") return;
    if (board) beforeEdit.current = snapshot(board);
    setEditing(true);
  }

  function finishTextEdit(next: string) {
    setEditing(false);
    const before = beforeEdit.current;
    beforeEdit.current = null;
    const prior = before?.shapes.find((item) => item.id === shape.id);
    if (before && prior && prior.text !== next) remember(before);
  }

  return (
    <div
      role={editing ? "group" : "button"}
      tabIndex={editing ? -1 : 0}
      aria-label={picture ? "Picture" : (shape.text || (shape.kind === "frame" ? "Frame" : shape.kind)).split("\n")[0]}
      aria-pressed={selected}
      className={cn(
        "absolute border text-left",
        shape.kind === "frame" ? "overflow-visible shadow-[0_1px_2px_rgb(38_37_30/6%),0_6px_20px_-10px_rgb(38_37_30/18%)]" : selected ? "overflow-visible" : "overflow-hidden",
        selected && "outline outline-2 outline-[#3b82f6]",
        !selected && over && shape.kind !== "frame" && "outline outline-1 outline-[#3b82f6]",
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
        zIndex: selected ? 2 : 1,
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (picture) fileRef.current?.click();
        else if (textLike) startTextEdit();
      }}
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => setOver(false)}
      onPointerDown={(event) => {
        if (editing) return;
        event.stopPropagation();
        select(shape.id);
        if (locked || !board) return;
        const before = snapshot(board);
        const start = { x: event.clientX, y: event.clientY, sx: shape.x, sy: shape.y };
        let moved = false;
        function move(ev: PointerEvent) {
          moved = true;
          patch(shape.id, { x: start.sx + (ev.clientX - start.x) / scale, y: start.sy + (ev.clientY - start.y) / scale });
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
      {shape.kind === "frame" ? children.map((child) => <ShapeView key={child.id} zoom={zoom} shape={child} locked={locked} />) : null}
      {picture ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${shape.image})` }} aria-hidden /> : null}
      {picture ? (
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Replace picture"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !board) return;
            const before = snapshot(board);
            const reader = new FileReader();
            reader.onload = () => {
              patch(shape.id, { image: String(reader.result) });
              remember(before);
            };
            reader.readAsDataURL(file);
          }}
        />
      ) : null}
      {textLike && editing ? (
        <textarea
          autoFocus
          aria-label={`Edit ${(shape.text || "Text").split("\n")[0]}`}
          className="h-full w-full resize-none bg-transparent p-0 focus-visible:outline-none"
          value={shape.text}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => patch(shape.id, { text: event.target.value })}
          onBlur={(event) => finishTextEdit(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") event.currentTarget.blur();
          }}
        />
      ) : null}
      {textLike && !editing ? <div className="pointer-events-none whitespace-pre-wrap">{shape.text}</div> : null}
      {shape.kind === "draw" ? <div className="pointer-events-none">Drawing</div> : null}
      {selected && !locked && !editing
        ? (["nw", "ne", "sw", "se"] as const).map((corner) => (
            <span
              key={corner}
              className={cn(
                "absolute z-10 size-3 rounded-[2px] border-2 border-[#3b82f6] bg-white",
                corner === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                corner === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                corner === "sw" && "-left-1.5 -bottom-1.5 cursor-nesw-resize",
                corner === "se" && "-right-1.5 -bottom-1.5 cursor-nwse-resize",
              )}
              aria-label={`Resize ${layerName(shape)}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!board) return;
                const before = snapshot(board);
                const start = { x: event.clientX, y: event.clientY, sx: shape.x, sy: shape.y, w: shape.w, h: shape.h };
                function move(ev: PointerEvent) {
                  const dx = (ev.clientX - start.x) / scale;
                  const dy = (ev.clientY - start.y) / scale;
                  const next = { x: start.sx, y: start.sy, w: start.w, h: start.h };
                  if (corner === "ne" || corner === "se") next.w = Math.max(48, start.w + dx);
                  if (corner === "sw" || corner === "se") next.h = Math.max(32, start.h + dy);
                  if (corner === "nw" || corner === "sw") {
                    next.w = Math.max(48, start.w - dx);
                    next.x = start.sx + start.w - next.w;
                  }
                  if (corner === "nw" || corner === "ne") {
                    next.h = Math.max(32, start.h - dy);
                    next.y = start.sy + start.h - next.h;
                  }
                  patch(shape.id, next);
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
          ))
        : null}
    </div>
  );
}

function layerName(shape: Shape) {
  if (shape.image && !shape.text) return "Picture";
  if (shape.kind === "frame") return "Frame";
  if (shape.kind === "text" || shape.kind === "comment") return shape.text.split("\n")[0] || "Text";
  if (shape.kind === "draw") return "Drawing";
  return shape.kind;
}

function layerTool(shape: Shape): Tool {
  if (shape.image && !shape.text) return "rect";
  if (shape.kind === "text") return "text";
  if (shape.kind === "comment") return "comment";
  if (shape.kind === "draw") return "draw";
  if (shape.kind === "rect") return "rect";
  return "frame";
}

function LayerTree({ shapes, selectedId, onSelect }: { shapes: Shape[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const roots = shapes.filter((shape) => !shape.parentId);
  function render(shape: Shape, depth: number) {
    const kids = shapes.filter((item) => item.parentId === shape.id);
    const name = layerName(shape);
    return (
      <li key={shape.id}>
        <button
          type="button"
          aria-label={`Layer ${name}`}
          aria-pressed={shape.id === selectedId}
          className={cn("flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-2 text-left text-[13px] text-ink hover:bg-soft/70", shape.id === selectedId && "bg-soft")}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onSelect(shape.id)}
        >
          <ToolIcon tool={layerTool(shape)} size={14} />
          <span className="truncate">{name}</span>
        </button>
        {kids.length ? <ul>{kids.map((child) => render(child, depth + 1))}</ul> : null}
      </li>
    );
  }
  return <ul className="m-0 list-none overflow-auto p-1">{roots.map((shape) => render(shape, 0))}</ul>;
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
