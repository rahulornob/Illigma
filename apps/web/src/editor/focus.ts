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

/**
 * The control the last pointer press landed on. `:focus-visible` can't tell
 * here: Chrome starts matching it on the focused element as soon as a key is
 * pressed, which is exactly when this is asked.
 */
let pressed: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => (pressed = e.target instanceof Element ? e.target.closest(CONTROL) : null), true);
  // Focus moved by the keyboard (Tab, arrows in a group): from now on the focus is the keyboard's.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab" || e.key.startsWith("Arrow")) pressed = null;
  }, true);
}

/** True if `t` has focus from the keyboard (or a script), not from a click on it. */
export function keyboardFocused(t: EventTarget | null): boolean {
  return !(t instanceof Element && pressed !== null && pressed.contains(t));
}
