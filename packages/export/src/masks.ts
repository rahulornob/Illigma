/**
 * Masks (Figma's `isMask`) for the vector writers: a visible mask hides
 * itself and clips the siblings above it. SVG writes alpha and luminance
 * masks as `<mask>` and vector masks as `<clipPath>`; PDF clips by the
 * mask's outline (an alpha mask is drawn by the renderer when it can be).
 */
import type { ReadonlyNode } from "@illigma/core";
import { transformCommands } from "@illigma/renderer";
import { draws, type ExportSource } from "./scene.js";
import { ellipseCommands, outlineOf, rectCommands } from "./vector-common.js";

export interface MaskPath {
  commands: readonly number[];
  evenOdd: boolean;
}

/** Mask `m`'s outline in its parent's space: its own shape, or for groups the shapes inside it (text: its box). */
export function maskOutline(m: ReadonlyNode, source: Pick<ExportSource, "children">): MaskPath[] {
  const local: MaskPath[] = [];
  const o = outlineOf(m, source);
  if (o.kind === "paths") for (const f of o.fills) local.push({ commands: f.commands, evenOdd: f.evenOdd });
  else if (o.kind === "rect") local.push({ commands: rectCommands(o.width, o.height, o.radius), evenOdd: false });
  else if (o.kind === "ellipse") local.push({ commands: ellipseCommands(o.width, o.height), evenOdd: false });
  else if (o.kind === "text") local.push({ commands: rectCommands(m.width, m.height, 0), evenOdd: false });
  else for (const k of source.children(m.id)) if (draws(k)) local.push(...maskOutline(k, source));
  return local.map((p) => ({ commands: transformCommands(p.commands, m.x, m.y, m.rotation), evenOdd: p.evenOdd }));
}

/** True if a visible child of `n` is a mask with pixels (alpha or luminance), which only the renderer draws exactly. */
export function hasPixelMask(n: ReadonlyNode, source: Pick<ExportSource, "children">): boolean {
  return source.children(n.id).some((k) => !!k.isMask && draws(k) && k.maskType !== "VECTOR");
}
