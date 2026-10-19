/**
 * Vector edit mode, shared between the canvas (which runs it) and the
 * panels and shortcuts (which read the selected points and start or stop
 * it). One editor per window.
 */

import { useSyncExternalStore } from "react";
import type { NodeId } from "@illigma/format";

export interface VectorEditState {
  /** The vector being edited. */
  nodeId: NodeId;
  /** Selected points (vertex indices). */
  points: readonly number[];
}

export interface VectorControl {
  /** Enters vector edit mode on layer `id` (a shape converts to a vector). Returns false if it can't be edited. */
  edit(id: NodeId): boolean;
  /** Leaves vector edit mode (or finishes the path being drawn with the pen). */
  exit(): void;
}

let state: VectorEditState | null = null;
let control: VectorControl | null = null;
const listeners = new Set<() => void>();

export const vectorEdit = {
  get: (): VectorEditState | null => state,
  set(next: VectorEditState | null): void {
    if (next === state) return;
    state = next;
    for (const l of listeners) l();
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  control: (): VectorControl | null => control,
  register(c: VectorControl | null): void {
    control = c;
  },
};

/** The vector edit state, re-rendering when it changes. */
export function useVectorEdit(): VectorEditState | null {
  return useSyncExternalStore(vectorEdit.subscribe, vectorEdit.get, vectorEdit.get);
}
