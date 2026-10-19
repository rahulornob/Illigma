/**
 * Where keyboard focus is, for the editor's single-key shortcuts (Enter,
 * Space, tool letters): they are the canvas's and the Layers panel's, never
 * a focused control's. Enter and Space on a button press the button
 * (WCAG 2.1.1); keys inside a dialog, popover or menu stay there.
 */

/** Controls that Enter or Space activate themselves. */
const CONTROL =
  'button, a[href], summary, select, [role="button"], [role="link"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="slider"], [role="spinbutton"], [role="combobox"]';
/** Containers whose keys are their own. */
const LAYER = 'dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [popover]';

/** True if `t` is a control (or inside one) that Enter and Space activate. */
export function onControl(t: EventTarget | null): boolean {
  return t instanceof Element && t.closest(CONTROL) !== null;
}

/** True if `t` is inside a dialog, popover or menu. */
export function inLayer(t: EventTarget | null): boolean {
  return t instanceof Element && t.closest(LAYER) !== null;
}

/** True if `t` has focus from the keyboard (it shows the focus ring), not from a click. */
export function keyboardFocused(t: EventTarget | null): boolean {
  try {
    return t instanceof Element && t.matches(":focus-visible");
  } catch {
    return true; // a browser without :focus-visible: treat focus as the keyboard's
  }
}
