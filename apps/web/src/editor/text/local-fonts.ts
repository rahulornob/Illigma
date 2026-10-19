/**
 * Fonts on this computer (core-states.md: "the font picker lists fonts in
 * this file first, then fonts on this computer"), through the browser's
 * Local Font Access API (`queryLocalFonts`, Chromium). Nothing leaves the
 * computer: font files are read into the text engine only.
 *
 * The list is asked for on a click (the browser asks for permission then);
 * when permission was granted before, it is read on its own. A family's files
 * are read only when it is used (picked, or named by text in the file).
 */

import { useSyncExternalStore } from "react";
import type { TextEngine } from "@illigma/renderer";

/** What `queryLocalFonts` returns per font face. */
interface FontData {
  family: string;
  style: string;
  fullName: string;
  postscriptName: string;
  blob(): Promise<Blob>;
}

export type LocalFontsStatus = "unsupported" | "idle" | "loading" | "ready" | "denied";

export interface LocalFonts {
  status: LocalFontsStatus;
  /** Family → its faces, sorted by family name. */
  families: ReadonlyMap<string, readonly FontData[]>;
}

type QueryLocalFonts = () => Promise<FontData[]>;
const query = (): QueryLocalFonts | null => {
  const q = (globalThis as unknown as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts;
  return typeof q === "function" ? q.bind(globalThis) : null;
};

let state: LocalFonts = { status: query() ? "idle" : "unsupported", families: new Map() };
const listeners = new Set<() => void>();
const set = (next: LocalFonts) => {
  state = next;
  for (const l of [...listeners]) l();
};

export const localFonts = (): LocalFonts => state;
export function subscribeLocalFonts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The local fonts state, for React. */
export function useLocalFonts(): LocalFonts {
  return useSyncExternalStore(subscribeLocalFonts, localFonts, localFonts);
}

/** Ask for the fonts on this computer. Call it inside a click: the browser may ask for permission. */
export async function requestLocalFonts(): Promise<void> {
  const q = query();
  if (!q || state.status === "loading" || state.status === "ready") return;
  set({ ...state, status: "loading" });
  try {
    const faces = await q();
    const families = new Map<string, FontData[]>();
    for (const f of faces) {
      const list = families.get(f.family) ?? [];
      list.push(f);
      families.set(f.family, list);
    }
    set({ status: "ready", families: new Map([...families].sort(([a], [b]) => a.localeCompare(b))) });
  } catch {
    // Permission refused (or no user gesture): the picker offers the button again, with a note.
    set({ ...state, status: "denied" });
  }
}

/** Read the list without a click when permission was granted before. */
export async function loadLocalFontsIfGranted(): Promise<void> {
  if (state.status !== "idle") return;
  try {
    const p = await navigator.permissions?.query({ name: "local-fonts" as PermissionName });
    if (p?.state === "granted") await requestLocalFonts();
  } catch {
    // The permission isn't known to this browser: wait for a click.
  }
}

const loaded = new Map<string, Promise<boolean>>();

/**
 * Register `family`'s faces from this computer in the text engine. Resolves
 * true once it is there (now, if it already is), false if it isn't on this
 * computer or its files can't be read.
 */
export function ensureLocalFamily(engine: TextEngine, family: string): Promise<boolean> {
  if (engine.hasFamily(family)) return Promise.resolve(true);
  const faces = state.families.get(family);
  if (!faces?.length) return Promise.resolve(false);
  let p = loaded.get(family);
  if (!p) {
    p = Promise.all(
      faces.map(async (f) => {
        try {
          return { family, data: await (await f.blob()).arrayBuffer(), styles: [f.style] };
        } catch {
          return null;
        }
      }),
    ).then((fonts) => {
      const ok = fonts.filter((f): f is NonNullable<typeof f> => f !== null);
      engine.addFonts(ok);
      return ok.length > 0;
    });
    loaded.set(family, p);
  }
  return p;
}
