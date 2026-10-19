/**
 * Components, variants and instances (Figma's model, in one file).
 *
 * - A COMPONENT is a main component. A COMPONENT_SET holds COMPONENT variants,
 *   each named "Prop=Value, Prop2=Value".
 * - An INSTANCE names its main component in `componentId`. Its children are
 *   stored, expanded: a copy of the main component's subtree in which every
 *   node carries `mainId`, the id of the node it copies. The editor keeps them
 *   in sync (see `@illigma/core` components), so renderers, layout and export
 *   read an instance like any frame.
 * - `overrides` on the outermost instance holds what was changed in it, keyed
 *   by `mainId` ("" for the instance itself), so edits to the main component
 *   reach every instance without losing them.
 * - Component properties are defined on a COMPONENT or COMPONENT_SET
 *   (`componentPropertyDefinitions`), bound to fields of nodes inside it
 *   (`componentPropertyReferences`), and set on an instance
 *   (`componentProperties`).
 */

import type { NodeId } from "./schema.js";

export type ComponentPropertyType = "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "VARIANT";
export const COMPONENT_PROPERTY_TYPES: readonly ComponentPropertyType[] = ["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"];

export interface ComponentPropertyDefinition {
  type: ComponentPropertyType;
  /** BOOLEAN: true/false. TEXT: the text. INSTANCE_SWAP: a component id. VARIANT: one of `variantOptions`. */
  defaultValue: boolean | string;
  /** VARIANT only: the values, in order. */
  variantOptions?: readonly string[];
}

/** Which component property drives a field of a node inside a component. */
export interface ComponentPropertyReferences {
  /** A BOOLEAN property: shows or hides the layer. */
  visible?: string;
  /** A TEXT property: the layer's text. */
  characters?: string;
  /** An INSTANCE_SWAP property: the main component of a nested instance. */
  mainComponent?: string;
}

/** Changed fields of one node in an instance: node field name → value. */
export type OverrideFields = Record<string, unknown>;

export const COMPONENT_LIMITS = {
  maxProperties: 200,
  maxOverrides: 10_000,
  maxNameLength: 200,
  maxVariantOptions: 200,
} as const;

/** Instance-only and component-only node fields: never copied into or overridden on instance sublayers. */
export const COMPONENT_KEYS = ["componentId", "overrides", "componentProperties", "componentPropertyDefinitions", "componentPropertyReferences", "mainId"] as const;

export interface ComponentFields {
  /** INSTANCE: its main component (a COMPONENT). */
  componentId?: NodeId;
  /** INSTANCE: changed fields, keyed by the `mainId` of the sublayer ("" for the instance itself). */
  overrides?: Record<string, OverrideFields>;
  /** INSTANCE: component property values by property name. Unset means the default. */
  componentProperties?: Record<string, boolean | string>;
  /** COMPONENT or COMPONENT_SET: the properties it offers, by name. */
  componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>;
  /** Any node inside a component: which property drives which field. */
  componentPropertyReferences?: ComponentPropertyReferences;
  /** A sublayer of an instance: the node in the main component it copies. */
  mainId?: NodeId;
}

/** "Size=Large, State=Hover" → { Size: "Large", State: "Hover" }. Names that aren't in that form give {}. */
export function parseVariantName(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of name.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return {};
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

/** { Size: "Large" } → "Size=Large". */
export function variantName(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}
