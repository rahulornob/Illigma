/**
 * The app's one text engine: CanvasKit and the fonts, shared by the canvas
 * (drawing), layout (auto width and auto height text) and text editing
 * (caret, selection, hit-testing), so text is measured exactly as it is drawn.
 *
 * Loads once, on first use. Until it is ready, layout keeps text boxes as
 * stored and the canvas shows "Loading canvas…".
 */

import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interExtUrl from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { TextEngine, type FontSource, type TextNode } from "@illigma/renderer";
import { setTextMeasure } from "../layout";

/** The bundled family: always available, and what text in a missing font is drawn with. */
export const BUNDLED_FAMILY = "Inter";
/** Inter's Latin Extended subset: a fallback for glyphs, never listed as a family of its own. */
export const HIDDEN_FAMILIES: ReadonlySet<string> = new Set(["Inter Latin Extended"]);
/** Inter is a variable font: every named weight is there (upright only). */
export const INTER_STYLES = ["Thin", "Extra Light", "Light", "Regular", "Medium", "Semi Bold", "Bold", "Extra Bold", "Black"] as const;

let canvasKit: Promise<CanvasKit> | undefined;
/** CanvasKit, loaded once for the whole app. */
export const loadCanvasKit = (): Promise<CanvasKit> => (canvasKit ??= CanvasKitInit({ locateFile: () => wasmUrl }));

let engine: TextEngine | null = null;
let loading: Promise<TextEngine> | undefined;

/** The bundled Inter (no font CDN), Latin and Latin Extended. A font that can't be fetched is left out. */
async function bundledFonts(): Promise<FontSource[]> {
  const font = (url: string, family: string, styles: readonly string[]) =>
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data): FontSource[] => [{ family, data, styles }])
      .catch((): FontSource[] => []);
  const sets = await Promise.all([font(interUrl, BUNDLED_FAMILY, INTER_STYLES), font(interExtUrl, "Inter Latin Extended", INTER_STYLES)]);
  return sets.flat();
}

/** The text engine, loading CanvasKit and the bundled fonts the first time. */
export function loadTextEngine(): Promise<TextEngine> {
  return (loading ??= Promise.all([loadCanvasKit(), bundledFonts()]).then(([ck, fonts]) => {
    engine = new TextEngine(ck, fonts);
    const e = engine;
    // From now on layout measures auto width and auto height text with the engine that draws it.
    setTextMeasure((n, width) => e.measure(n as TextNode, width));
    for (const l of [...readyListeners]) l(engine);
    readyListeners.clear();
    return engine;
  }));
}

/** The text engine if it has loaded, else null (layout then keeps text boxes as stored). */
export const currentTextEngine = (): TextEngine | null => engine;

const readyListeners = new Set<(e: TextEngine) => void>();
/** Call `fn` once the engine is ready (now, if it is). Returns an unsubscribe function. */
export function whenTextEngine(fn: (e: TextEngine) => void): () => void {
  if (engine) {
    fn(engine);
    return () => {};
  }
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}
