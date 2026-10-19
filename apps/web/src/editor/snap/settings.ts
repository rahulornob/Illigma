/**
 * Snapping preferences (interactions.md §4: the toggles live in the View menu
 * and ⌘K). Until that menu is built, "Snap to objects" is read from this
 * browser's storage (`illigma.snapToObjects` = "off" turns it off); the pixel
 * grid always applies.
 */
const KEY = "illigma.snapToObjects";

export function snapToObjects(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSnapToObjects(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, "off");
  } catch {
    // storage blocked: the setting lasts until reload
  }
}
