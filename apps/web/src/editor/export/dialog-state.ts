/** Whether the Export dialog (⇧⌘E) is open: the editor's shortcut and the card's link open it, the host shows it. */

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function openExportDialog(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeExportDialog(): void {
  if (!open) return;
  open = false;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useExportDialogOpen = (): boolean => useSyncExternalStore(subscribe, () => open);
