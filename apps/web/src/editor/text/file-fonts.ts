/**
 * The file's own fonts on this computer, loaded as the file opens.
 *
 * When local font permission was granted before, every family the file's
 * text names that is on this computer is read into the text engine as soon
 * as the engine and the font list are ready, not only when a text layer is
 * selected (the Typography card does that too). The canvas then draws the
 * text in its font. Sizes stay as stored: text in a font that wasn't loaded
 * is never measured (`layoutMeasure` in `engine.ts`), and loading the font
 * doesn't rewrite the file; the next edit that reaches the text measures it.
 */

import { useEffect } from "react";
import type { Document } from "@illigma/core";
import type { TextEngine } from "@illigma/renderer";
import { whenTextEngine } from "./engine";
import { ensureLocalFamily, loadLocalFontsIfGranted, localFonts, subscribeLocalFonts } from "./local-fonts";
import { familiesInFile } from "./props";

/** Load the families `doc`'s text uses that `engine` lacks and this computer has. Resolves with the families loaded. */
export async function loadFileFamilies(engine: TextEngine, doc: Document): Promise<string[]> {
  if (localFonts().status !== "ready") return [];
  const wanted = familiesInFile(doc).filter((f) => !engine.hasFamily(f) && localFonts().families.has(f));
  const ok = await Promise.all(wanted.map((f) => ensureLocalFamily(engine, f)));
  return wanted.filter((_, i) => ok[i]);
}

/** As the file opens (and when the font list arrives later), load its fonts from this computer. */
export function useFileFonts(doc: Document): void {
  useEffect(() => {
    let alive = true;
    let engine: TextEngine | null = null;
    const load = () => {
      if (alive && engine) void loadFileFamilies(engine, doc);
    };
    const offEngine = whenTextEngine((e) => {
      engine = e;
      // Reads the list on its own only when permission was granted before; never prompts.
      void loadLocalFontsIfGranted().then(load);
      load();
    });
    const offLocal = subscribeLocalFonts(load);
    return () => {
      alive = false;
      offEngine();
      offLocal();
    };
  }, [doc]);
}
