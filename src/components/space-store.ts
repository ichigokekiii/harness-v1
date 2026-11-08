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
  load: (board) => set({ board: structuredClone(board), past: [], future: [], selectedId: board.shapes[0]?.id ?? null }),
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
      return {
        past: [...state.past, before].slice(-50),
        future: [],
        selectedId: shape.id,
        board: { ...state.board, shapes: [...state.board.shapes, shape] },
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
        board: { ...state.board, shapes: state.board.shapes.filter((shape) => shape.id !== state.selectedId) },
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
