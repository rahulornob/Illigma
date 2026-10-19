// Canvas text (Phase 1): the Text tool (T) makes an auto width layer on a
// click and a fixed-size box on a drag; typing, word selection by
// double-click and by ⌥⇧← (Ctrl+Shift+← elsewhere), Backspace, undo and
// redo (one step per typing burst), Enter making new lines that wrap in a
// fixed width, auto width growing, Escape leaving editing (the layer stays
// selected), Enter editing again, empty text removed on exit, font size and
// alignment from the Typography card, Hug text inside the Card auto layout
// reflowing the card, reload keeping it all, IME composition (CDP), the
// font picker, and axe on the text input, the Typography card and the
// picker (no violations).
//
// The caret and selection are DOM overlays (.text-caret, .text-range), so
// their screen boxes say where the caret is. The hidden input (.text-input)
// holds the text being edited.
//
// Usage (from the repo root):  node apps/web/e2e/text.mjs [--headed] [--no-build]

import { createRequire } from "node:module";
import { createFile, drag, eventually, field, layerRow, layerRows, newContext, poll, runE2E, selectedRows, setField, waitSaved, watchErrors } from "./lib.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const MAC = process.platform === "darwin";
const WORD = MAC ? "Alt" : "Control";

await runE2E("text", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");
  const editing = () => page.evaluate(() => document.activeElement?.classList.contains("text-input") ?? false);
  const typed = () => page.evaluate(() => document.querySelector(".text-input")?.value ?? null);
  const undo = () => page.keyboard.press("ControlOrMeta+z");
  const redo = () => page.keyboard.press("ControlOrMeta+Shift+z");
  /** The caret's box on screen (CSS px), or null when it isn't shown. */
  const caret = async () => {
    await frame();
    return page.evaluate(() => {
      const el = document.querySelector(".text-caret");
      if (!el || el.style.display === "none" || el.closest(".text-edit")?.style.display === "none") return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y, h: r.height };
    });
  };
  const rangeCount = async () => {
    await frame();
    return page.evaluate(() => (document.querySelector(".text-edit")?.style.display === "none" ? 0 : document.querySelectorAll(".text-range").length));
  };
  const radioChecked = async (group, name) => (await props.getByRole("radiogroup", { name: group }).getByRole("radio", { name, exact: true }).getAttribute("aria-checked")) === "true";
  const waitTyped = async (want, why) => check(await eventually(async () => (await typed()) === want), `${why}: the text should be ${JSON.stringify(want)}, got ${JSON.stringify(await typed())}`);
  /** Wait out a typing burst (1 s), so the next keys start a new undo step. */
  const pause = () => page.waitForTimeout(1_200);

  async function axe(where) {
    if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath });
    await frame();
    const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }));
    const fmt = (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`;
    check(result.violations.length === 0, `${where}: axe found violations:\n  ${result.violations.map(fmt).join("\n  ")}`);
  }

  log("open a new file; map world to screen from the Desktop frame");
  await createFile(page, url);
  await layerRow(page, "Desktop").click();
  await frame();
  const desk = await page.evaluate(() => {
    const r = document.querySelector(".selection-box").getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width };
  });
  const z = desk.w / 1440;
  const toScreen = (wx, wy) => ({ x: desk.x + wx * z, y: desk.y + wy * z });

  log("T, then click: an auto width text layer, editing at once");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("t");
  check((await page.getByRole("button", { name: "Text (T)" }).getAttribute("aria-pressed")) === "true", "T should pick the Text tool");
  const at = toScreen(800, 60);
  await page.mouse.click(at.x, at.y);
  check(await eventually(editing), "a click with the Text tool should start editing (focus in the text input)");
  check((await page.locator(".text-input").getAttribute("aria-label"))?.startsWith("Edit text"), "the text input should have an accessible name");
  check((await page.getByRole("button", { name: "Move (V)" }).getAttribute("aria-pressed")) === "true", "the tool goes back to Move");
  await axe("editing text");
  await page.keyboard.type("Hello");
  await waitTyped("Hello", "typing");
  check(await eventually(async () => (await layerRows(page).allInnerTexts()).some((t) => t.trim() === "Hello")), "the layer is named after its text");
  const c1 = await caret();
  check(c1 && Math.abs(c1.x - at.x) > 10 * z, "the caret should move right as text is typed");

  log("Escape leaves editing; the layer stays selected; auto width");
  await page.keyboard.press("Escape");
  check(await eventually(async () => !(await editing())), "Escape should leave editing");
  check((await selectedName()) === "Hello", `the text layer should stay selected, got ${await selectedName()}`);
  check(await radioChecked("Resizing", "Grow horizontally"), "a click makes an auto width layer");
  const w1 = await field(page, "Width");
  check(w1 > 20 && w1 < 60, `"Hello" at 12 px should be about 30 px wide, got ${w1}`);
  check((await field(page, "Height")) >= 14, "one line high");

  log("Enter edits again with all text selected; typing replaces it; auto width grows");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Enter");
  check(await eventually(editing), "Enter on a selected text layer should edit it");
  check((await rangeCount()) > 0, "Enter selects all the text");
  await page.keyboard.press("End");
  await page.keyboard.type(" world");
  await waitTyped("Hello world", "typing at the end");
  await page.keyboard.press("Escape");
  const w2 = await field(page, "Width");
  check(w2 > w1 + 20, `auto width should grow with the text: ${w1} → ${w2}`);

  log("undo and redo: one step per typing burst");
  await undo();
  check(await eventually(async () => (await field(page, "Width")) === w1), "one undo removes \" world\" (one burst)");
  await redo();
  check(await eventually(async () => (await field(page, "Width")) === w2), "redo puts it back");

  log("select a word with ⌥⇧← and delete it; undo brings it back in one step");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await page.keyboard.press(`${WORD}+Shift+ArrowLeft`);
  check((await rangeCount()) > 0, "⌥⇧← should select the word before the caret");
  await page.keyboard.press("Backspace");
  await waitTyped("Hello ", "deleting the selected word");
  await undo();
  await waitTyped("Hello world", "undo while editing");
  await redo();
  await waitTyped("Hello ", "redo while editing");
  await undo();
  await waitTyped("Hello world", "undo again");

  log("double-click selects a word; typing replaces it");
  await page.keyboard.press("End");
  const end = await caret();
  await page.keyboard.press(`${WORD}+ArrowLeft`);
  const wordStart = await caret();
  check(end && wordStart && wordStart.x < end.x, "⌥← should move to the start of the word");
  await page.mouse.dblclick((end.x + wordStart.x) / 2, wordStart.y + wordStart.h / 2);
  check(await eventually(async () => (await rangeCount()) > 0), "double-click should select the word");
  await page.keyboard.type("there");
  await waitTyped("Hello there", "typing over a double-clicked word");
  await pause();

  log("Shift+arrows extend the selection; Backspace deletes it");
  await page.keyboard.press("End");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Backspace");
  await waitTyped("Hello ", "Shift+← five times then Backspace");
  await page.keyboard.type("you");
  await waitTyped("Hello you", "typing after deleting");
  await page.keyboard.press("Escape");
  check((await selectedName()) === "Hello you", `the layer name follows its text, got ${await selectedName()}`);

  log("triple-click selects the paragraph; clipboard copy and paste (plain text)");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  const tail = await caret();
  await page.mouse.click(tail.x - 4 * z, tail.y + tail.h / 2, { clickCount: 1 });
  await page.mouse.click(tail.x - 4 * z, tail.y + tail.h / 2, { clickCount: 2 });
  await page.mouse.click(tail.x - 4 * z, tail.y + tail.h / 2, { clickCount: 3 });
  check(await eventually(async () => (await page.evaluate(() => { const t = document.querySelector(".text-input"); return t.selectionEnd - t.selectionStart; })) === "Hello you".length), "triple-click should select the whole line");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+v");
  await waitTyped("Hello you\nHello you", "paste after a new line");
  await undo();
  await waitTyped("Hello you\n", "undo removes the paste (a step of its own)");
  await page.keyboard.press("Backspace");
  await waitTyped("Hello you", "Backspace removes the new line");
  await page.keyboard.press("Escape");

  log("empty text is removed when editing ends, with no undo step");
  const before = await layerRows(page).count();
  await page.keyboard.press("t");
  const empty = toScreen(800, 300);
  await page.mouse.click(empty.x, empty.y);
  check(await eventually(editing), "editing a new text layer");
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await layerRows(page).count()) === before), "the empty layer should be gone");
  await page.locator("canvas.canvas").focus();
  await undo();
  check(await eventually(async () => (await layerRows(page).allInnerTexts()).some((t) => t.trim() === "Hello you")), "undo after the empty layer still finds the earlier text edit");
  await redo();

  log("T, then drag: a fixed-size box; Enter makes a new line; long lines wrap");
  await page.keyboard.press("t");
  const a = toScreen(760, 200);
  const b = toScreen(880, 260);
  await drag(page, a.x, a.y, b.x, b.y);
  check(await eventually(editing), "a drag with the Text tool should start editing");
  await page.keyboard.type("one two three four five six seven");
  await waitTyped("one two three four five six seven", "typing in the box");
  const last = await caret();
  await page.keyboard.press("ControlOrMeta+Home");
  const top = await caret();
  check(last && top && last.y > top.y + top.h * 0.5, "the long line should wrap at the box's width");
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("x");
  const next = await caret();
  check(next && next.y > last.y + last.h * 0.5, "Enter starts a line under the last one");
  await page.keyboard.press("Escape");
  check(await radioChecked("Resizing", "Fixed size"), "a dragged box is a fixed size");
  check((await field(page, "Width")) === 120 && (await field(page, "Height")) === 60, "the box keeps its dragged size");

  log("Typography card: font size and alignment");
  await layerRow(page, "Hello you").click();
  await setField(page, "Font size", 24);
  check(await eventually(async () => (await field(page, "Width")) > w1 * 1.8), "a bigger font makes auto width text wider");
  check((await field(page, "Height")) >= 28, "and taller");
  await props.getByRole("radiogroup", { name: "Text align" }).getByRole("radio", { name: "Align center" }).click();
  check(await radioChecked("Text align", "Align center"), "Align center should be checked");
  await props.getByRole("radiogroup", { name: "Resizing" }).getByRole("radio", { name: "Fixed size" }).click();
  await setField(page, "Width", 300);
  check(await radioChecked("Resizing", "Fixed size"), "a typed width keeps it fixed");
  await axe("Typography card");
  await page.locator("canvas.canvas").focus();
  await undo();
  await undo();
  check(await eventually(() => radioChecked("Resizing", "Grow horizontally")), "undo the width and the resize mode");

  log("font picker: search, keyboard, the bundled font");
  await props.getByRole("button", { name: /^Font: / }).click();
  const picker = page.getByRole("dialog", { name: "Fonts" });
  await picker.waitFor();
  await axe("font picker");
  await page.keyboard.type("int");
  check((await picker.getByRole("option").count()) >= 1, "searching \"int\" should list Inter");
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await picker.count()) === 0), "Escape closes the picker");

  log("Hug text in the Card auto layout reflows the card");
  await layerRow(page, "Card").click();
  const cardW = await field(page, "Width");
  const cardH = await field(page, "Height");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("t");
  const inCard = toScreen(120 + 300, 560 + 252);
  await page.mouse.click(inCard.x, inCard.y);
  check(await eventually(editing), "editing a new text layer in the card");
  await page.keyboard.type("A long caption that is a good deal wider than the whole card");
  await page.keyboard.press("Escape");
  const textW = await field(page, "Width");
  check(textW > 272, `the caption hugs its text, got ${textW}`);
  check(await eventually(async () => (await layerRow(page, "A long caption that is a good deal wider than the whole card").count()) === 1), "the caption is in the layers");
  await layerRow(page, "Card").click();
  const cardW2 = await field(page, "Width");
  const cardH2 = await field(page, "Height");
  check(cardH2 > cardH + 10, `the hugging card should grow taller for the caption: ${cardH} → ${cardH2}`);
  check(cardW2 >= Math.max(cardW, textW + 48) - 0.01, `the hugging card should widen to the caption: ${cardW} → ${cardW2} (caption ${textW})`);

  log("IME composition (CDP): shown while composing, kept as one step when committed");
  await layerRow(page, "Hello you").click();
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
  await waitTyped("Hello youに", "the composition shows in the text while composing");
  await cdp.send("Input.imeSetComposition", { text: "にほ", selectionStart: 2, selectionEnd: 2 });
  await cdp.send("Input.insertText", { text: "日本" });
  await waitTyped("Hello you日本", "the committed composition replaces it");
  await page.keyboard.insertText("!");
  await waitTyped("Hello you日本!", "insertText after the composition");
  await undo();
  await waitTyped("Hello you日本", "undo removes the typing after the composition");
  await undo();
  await waitTyped("Hello you", "the composition is one undo step");
  await redo();
  await waitTyped("Hello you日本", "redo brings it back");
  await page.keyboard.press("Escape");
  check((await selectedName()) === "Hello you日本", `the layer is named after its text, got ${await selectedName()}`);

  log("reload keeps the text, its size, alignment and the caption in the card");
  await waitSaved(page);
  await page.reload();
  await page.locator(".title-bar").waitFor();
  await page.waitForSelector(".canvas-status", { state: "detached" });
  await layerRow(page, "Hello you日本").click();
  check(await radioChecked("Text align", "Align center"), "alignment persists");
  check((await field(page, "Font size")) === 24, "font size persists");
  check(await radioChecked("Resizing", "Grow horizontally"), "resize mode persists");
  check((await layerRow(page, "A long caption that is a good deal wider than the whole card").count()) === 1, "the caption persists");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Enter");
  await waitTyped("Hello you日本", "editing after reload shows the saved text");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${outDir}/text.png` });
  await context.close();
});
