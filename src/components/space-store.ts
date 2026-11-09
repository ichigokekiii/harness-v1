"use client";

import { create } from "zustand";
import type { AgentEntry, Board, Shape, Tool } from "@/lib/domain";

type Snap = { shapes: Shape[]; log: AgentEntry[] };

type SpaceState = {
  board: Board | null;
  past: Snap[];
  future: Snap[];
  selectedId: string | null;
  tool: Tool;
  load: (board: Board) => void;
  setTool: (tool: Tool) => void;
  select: (id: string | null) => void;
  patch: (id: string, partial: Partial<Shape>) => void;
  remember: (before: Snap) => void;
  addShape: (shape: Shape) => void;
  removeSelected: () => void;
  reorder: (id: string, direction: -1 | 1) => void;
  updateBoard: (partial: Partial<Pick<Board, "title" | "mode" | "log">>) => void;
  undo: () => void;
  redo: () => void;
};

export const useSpace = create<SpaceState>((set) => ({
  board: null,
  past: [],
  future: [],
  selectedId: null,
  tool: "select",
  load: (board) => {
    const shapes = nestParts(structuredClone(board.shapes));
    set({ board: { ...structuredClone(board), shapes }, past: [], future: [], selectedId: shapes[0]?.id ?? null });
  },
  setTool: (tool) => set({ tool }),
  select: (selectedId) => set({ selectedId }),
  patch: (id, partial) =>
    set((state) => ({
      board: state.board
        ? { ...state.board, shapes: state.board.shapes.map((shape) => (shape.id === id ? { ...shape, ...partial } : shape)) }
        : null,
    })),
  remember: (before) => set((state) => ({ past: [...state.past, before].slice(-50), future: [] })),
  addShape: (shape) =>
    set((state) => {
      if (!state.board) return state;
      const before = { shapes: structuredClone(state.board.shapes), log: structuredClone(state.board.log) };
      const pieces = splitFrame(shape);
      return {
        past: [...state.past, before].slice(-50),
        future: [],
        selectedId: shape.id,
        board: { ...state.board, shapes: [...state.board.shapes, ...pieces] },
      };
    }),
  removeSelected: () =>
    set((state) => {
      if (!state.board || !state.selectedId) return state;
      const before = { shapes: structuredClone(state.board.shapes), log: structuredClone(state.board.log) };
      return {
        past: [...state.past, before].slice(-50),
        future: [],
        selectedId: null,
        board: { ...state.board, shapes: dropIds(state.board.shapes, state.selectedId) },
      };
    }),
  reorder: (id, direction) =>
    set((state) => {
      if (!state.board) return state;
      const index = state.board.shapes.findIndex((shape) => shape.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= state.board.shapes.length) return state;
      const shapes = [...state.board.shapes];
      const [item] = shapes.splice(index, 1);
      if (!item) return state;
      shapes.splice(next, 0, item);
      const before = { shapes: structuredClone(state.board.shapes), log: structuredClone(state.board.log) };
      return { past: [...state.past, before].slice(-50), future: [], board: { ...state.board, shapes } };
    }),
  updateBoard: (partial) => set((state) => ({ board: state.board ? { ...state.board, ...partial } : null })),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous || !state.board) return state;
      const current = { shapes: structuredClone(state.board.shapes), log: structuredClone(state.board.log) };
      return {
        past: state.past.slice(0, -1),
        future: [current, ...state.future],
        board: { ...state.board, shapes: previous.shapes, log: previous.log },
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next || !state.board) return state;
      const current = { shapes: structuredClone(state.board.shapes), log: structuredClone(state.board.log) };
      return {
        past: [...state.past, current],
        future: state.future.slice(1),
        board: { ...state.board, shapes: next.shapes, log: next.log },
      };
    }),
}));

export function snapshot(board: Board): Snap {
  return { shapes: structuredClone(board.shapes), log: structuredClone(board.log) };
}

function splitFrame(shape: Shape): Shape[] {
  if (shape.kind !== "frame" || shape.parentId || (!shape.text && !shape.image)) return [shape];
  const parent: Shape = { ...shape, text: "", image: undefined };
  const parts: Shape[] = [parent];
  if (shape.text) {
    parts.push({
      ...shape,
      id: `${shape.id}-text`,
      parentId: shape.id,
      kind: "text",
      x: 24,
      y: 28,
      w: shape.image ? Math.round(shape.w * 0.52) : shape.w - 48,
      h: shape.h - 56,
      fill: "transparent",
      stroke: "transparent",
      image: undefined,
      slide: false,
      radius: 0,
    });
  }
  if (shape.image) {
    parts.push({
      ...shape,
      id: `${shape.id}-image`,
      parentId: shape.id,
      kind: "rect",
      x: Math.round(shape.w * 0.58),
      y: 0,
      w: Math.round(shape.w * 0.42),
      h: shape.h,
      text: "",
      fill: "transparent",
      stroke: "transparent",
      slide: false,
      radius: 0,
    });
  }
  return parts;
}

export function nestParts(shapes: Shape[]): Shape[] {
  const parents = new Set(shapes.map((shape) => shape.parentId).filter((id): id is string => Boolean(id)));
  return shapes.flatMap((shape) => {
    if (shape.parentId) return [shape];
    if (shape.kind === "frame" && !parents.has(shape.id)) return splitFrame(shape);
    return [shape];
  });
}

function dropIds(shapes: Shape[], selectedId: string) {
  const drop = new Set([selectedId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const shape of shapes) {
      if (shape.parentId && drop.has(shape.parentId) && !drop.has(shape.id)) {
        drop.add(shape.id);
        grew = true;
      }
    }
  }
  return shapes.filter((shape) => !drop.has(shape.id));
}
