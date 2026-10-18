// Auto layout and constraints in the Properties panel: add auto layout to a
// frame (+ and Shift+A), change direction, gap (number and Auto), padding and
// alignment (mouse and keyboard) and see the children move (X/Y read back in
// Properties), Fixed / Hug / Fill sizing menus (mouse and keyboard),
// absolute position, Shift+A wrapping several layers in one undo step,
// constraints following a typed frame size, and undo of each change.
//
// The sample file: Desktop (1440 × 900, plain) holds Hero (120, 160, 560 × 320),
// Avatar (1200, 40, 96 × 96, pinned right) and Card, a vertical auto layout
// frame (padding 24, gap 16) with Image 272 × 120, Title 200 × 24 and Button 120 × 40.
//
// Usage (from the repo root):  node apps/web/e2e/autolayout.mjs [--headed] [--no-build]

import { createFile, eventually, field, layerRow, layerRows, newContext, runE2E, selectedRows, setField, watchErrors } from "./lib.mjs";

await runE2E("autolayout", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });

  /** Select `name` in the Layers panel and read its box from Properties. */
  const boxOf = async (name) => {
    await layerRow(page, name).click();
    return { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
  };
  /** Wait until `name`'s box matches `want` (only the keys given); fails with what it saw. */
  const expectBox = async (name, want, why) => {
    let got;
    const ok = await eventually(async () => {
      got = await boxOf(name).catch((e) => ({ error: String(e?.message ?? e).split("\n")[0] }));
      return Object.entries(want).every(([k, v]) => Math.abs(got[k] - v) < 0.01);
    }, 3_000);
    check(ok, `${why}: ${name} should be ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  };
  const radio = (group, name) => props.getByRole("radiogroup", { name: group }).getByRole("radio", { name, exact: true });
  const checked = async (group, name) => (await radio(group, name).getAttribute("aria-checked")) === "true";
  const value = (label) => props.getByLabel(label, { exact: true }).inputValue();
  const undo = () => page.keyboard.press("ControlOrMeta+z");
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");

  log("open a new file; Desktop has no auto layout");
  await createFile(page, url);
  await layerRow(page, "Desktop").click();
  check(await props.getByRole("button", { name: "Add auto layout" }).isVisible(), "a plain frame should offer Add auto layout");
  check((await props.getByRole("radiogroup", { name: "Direction" }).count()) === 0, "no auto layout controls before it is added");

  log("+ adds auto layout: direction, gap and padding are guessed, the frame hugs");
  await props.getByRole("button", { name: "Add auto layout" }).click();
  check(await props.getByRole("button", { name: "Remove auto layout" }).isVisible(), "the card should offer Remove auto layout");
  check(await checked("Direction", "Vertical"), "Avatar, Hero and Card one under another should give a vertical stack");
  check(await eventually(async () => (await value("Gap between items")) === "52"), "the gap should be the average space between them (24 and 80)");
  check(await eventually(async () => (await props.locator(".field-unit").allInnerTexts()).join(",") === "Hug,Hug"), "W and H should show Hug");
  check(await eventually(async () => (await value("Left padding")) === "120"), "padding differs per side, so each side shows: left 120");
  check((await value("Right padding")) === "144" && (await value("Top padding")) === "40" && (await value("Bottom padding")) === "76", "right 144, top 40, bottom 76");
  await expectBox("Desktop", { w: 120 + 560 + 144, h: 900 }, "the frame hugs its children");
  await expectBox("Avatar", { x: 120, y: 40 }, "Avatar comes first in the stack");
  await expectBox("Hero", { x: 120, y: 40 + 96 + 52 }, "Hero follows after the gap");
  await page.locator(".canvas").focus();
  await undo();
  await expectBox("Hero", { x: 120, y: 160 }, "undo puts Hero back");
  await layerRow(page, "Desktop").click();
  check(await props.getByRole("button", { name: "Add auto layout" }).isVisible(), "undo removes auto layout");

  log("Card: an auto layout frame shows its settings");
  await layerRow(page, "Card").click();
  check(await checked("Direction", "Vertical"), "Card is vertical");
  check((await value("Gap between items")) === "16", "gap 16");
  check((await value("Horizontal padding")) === "24" && (await value("Vertical padding")) === "24", "equal sides show as pairs");
  check(await checked("Alignment", "Top left"), "aligned top left");
  await expectBox("Title", { x: 24, y: 24 + 120 + 16 }, "Title in the sample");

  log("direction: horizontal puts the children side by side");
  await layerRow(page, "Card").click();
  await radio("Direction", "Horizontal").click();
  await expectBox("Title", { x: 24 + 272 + 16, y: 24 }, "horizontal direction");
  await expectBox("Card", { w: 24 + 272 + 16 + 200 + 16 + 120 + 24, h: 24 + 120 + 24 }, "the hugging Card turns wide");

  log("direction by keyboard: arrows move between the direction buttons");
  await layerRow(page, "Card").click();
  await radio("Direction", "Horizontal").focus();
  await page.keyboard.press("ArrowRight");
  check(await checked("Direction", "Vertical"), "→ from Horizontal should pick Vertical");
  check((await selectedName()) === "Card", "the arrow key should not change the selection");
  await expectBox("Title", { x: 24, y: 160 }, "back to vertical");

  log("gap and padding");
  await layerRow(page, "Card").click();
  await setField(page, "Gap between items", 10);
  await expectBox("Button", { y: 24 + 120 + 10 + 24 + 10 }, "a 10 px gap");
  await layerRow(page, "Card").click();
  await setField(page, "Horizontal padding", 32);
  await expectBox("Image", { x: 32 }, "32 px horizontal padding");
  await expectBox("Card", { w: 32 + 272 + 32 }, "the hugging frame follows the padding");

  log("alignment grid: click, then arrow keys (which must not move or reorder the layer)");
  await layerRow(page, "Card").click();
  await radio("Alignment", "Top center").click();
  check(await checked("Alignment", "Top center"), "Top center should be checked");
  await expectBox("Button", { x: 32 + (272 - 120) / 2 }, "centred across a vertical stack");
  const cardBefore = await boxOf("Card");
  await radio("Alignment", "Top center").focus();
  await page.keyboard.press("ArrowRight");
  check(await checked("Alignment", "Top right"), "→ should move the alignment to Top right");
  check(await radio("Alignment", "Top right").evaluate((el) => el === document.activeElement), "focus should follow the checked cell");
  check((await selectedName()) === "Card", "the arrow key should not change the selection");
  const cardAfter = { x: await field(page, "X position"), y: await field(page, "Y position") };
  check(cardAfter.x === cardBefore.x && cardAfter.y === cardBefore.y, "the arrow key should not nudge the frame");
  await expectBox("Button", { x: 32 + 272 - 120 }, "right-aligned");
  await undo();
  await expectBox("Button", { x: 32 + (272 - 120) / 2 }, "undo returns to Top center in one step");

  log("Auto gap spreads the children over a fixed height");
  await layerRow(page, "Card").click();
  await setField(page, "Height", 400);
  check(await eventually(async () => (await props.locator(".field-unit").allInnerTexts()).join(",") === "Hug"), "typing a height should make it Fixed (only W still hugs)");
  await props.getByRole("button", { name: /^Gap mode/ }).click();
  await page.getByRole("menuitemradio", { name: "Auto (space between)" }).click();
  check(await eventually(async () => (await value("Gap between items")) === "Auto"), "the gap field should read Auto");
  await expectBox("Button", { y: 400 - 24 - 40 }, "Auto gap pushes Button to the bottom padding");
  await layerRow(page, "Card").click();
  await setField(page, "Gap between items", 16);
  await expectBox("Button", { y: 24 + 120 + 16 + 24 + 16 }, "typing a number leaves Auto");

  log("sizing menus: Fill for a child, Hug for the frame, only valid options");
  await layerRow(page, "Title").click();
  await props.getByRole("button", { name: /^Horizontal resizing/ }).click();
  const titleOptions = await page.getByRole("menu").getByRole("menuitemradio").allInnerTexts();
  check(titleOptions.join("|") === "Fixed width · 200|Fill container", `a rectangle in auto layout can be Fixed or Fill, not Hug; got ${titleOptions.join(" | ")}`);
  await page.getByRole("menuitemradio", { name: "Fill container" }).click();
  check((await page.getByRole("menu").count()) === 0, "picking an option closes the menu");
  await expectBox("Title", { w: 272 }, "Fill container: the frame's width minus padding");
  check((await props.getByRole("button", { name: /^Horizontal resizing/ }).getAttribute("aria-label")) === "Horizontal resizing: Fill container", "the W menu button should say Fill");
  await layerRow(page, "Card").click();
  check(
    (await props.getByRole("button", { name: /^Horizontal resizing/ }).getAttribute("aria-label")) === "Horizontal resizing: Fixed",
    "a child set to Fill makes its hugging parent Fixed",
  );
  await setField(page, "Width", 400);
  await expectBox("Title", { w: 400 - 64 }, "Title fills the wider frame");

  log("sizing menu by keyboard: Enter opens on the checked item, ↓ and Enter pick Hug");
  await layerRow(page, "Card").click();
  const wMenu = props.getByRole("button", { name: /^Horizontal resizing/ });
  await wMenu.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor();
  const cardOptions = await page.getByRole("menu").getByRole("menuitemradio").allInnerTexts();
  check(cardOptions.join("|") === "Fixed width · 400|Hug contents", `a frame in a plain frame can't fill; got ${cardOptions.join(" | ")}`);
  check((await page.evaluate(() => document.activeElement?.textContent)) === "Fixed width · 400", "focus should start on the checked option");
  await page.screenshot({ path: `${outDir}/autolayout-sizing-menu.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  check(await wMenu.evaluate((el) => el === document.activeElement), "focus returns to the menu button");
  check((await page.getByRole("menu").count()) === 0, "the menu closes");
  await expectBox("Title", { w: 336 }, "Hug on the frame makes its Fill child Fixed at its size");
  await expectBox("Card", { w: 400 }, "the frame hugs the 336 px Title plus padding");
  await layerRow(page, "Card").click();
  await wMenu.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor();
  await page.keyboard.press("Escape");
  check((await page.getByRole("menu").count()) === 0 && (await selectedName()) === "Card", "Escape closes the menu and keeps the selection");

  log("absolute position: the child leaves the flow and keeps a typed X");
  await layerRow(page, "Button").click();
  const abs = props.getByRole("button", { name: "Absolute position" });
  check((await abs.getAttribute("aria-pressed")) === "false", "Button starts in the flow");
  await abs.click();
  check((await abs.getAttribute("aria-pressed")) === "true", "Absolute position should be on");
  check(await props.getByLabel("Horizontal constraint").isVisible(), "an absolute child gets constraints");
  await setField(page, "X position", 10);
  await expectBox("Button", { x: 10 }, "an absolute child keeps its position");
  await layerRow(page, "Title").click();
  check((await props.getByRole("button", { name: "Absolute position" }).getAttribute("aria-pressed")) === "false", "Title is still in the flow");
  check((await props.getByLabel("Horizontal constraint").count()) === 0, "a child in the flow has no constraints");
  await page.screenshot({ path: `${outDir}/autolayout-panel.png` });

  log("remove auto layout");
  await layerRow(page, "Card").click();
  await props.getByRole("button", { name: "Remove auto layout" }).click();
  check(await props.getByRole("button", { name: "Add auto layout" }).isVisible(), "the card should offer Add auto layout again");
  await undo();
  check(await eventually(() => props.getByRole("button", { name: "Remove auto layout" }).isVisible()), "undo brings auto layout back");

  log("Shift+A wraps several layers in a new auto layout frame, one undo step");
  await createFile(page, url);
  const rowsBefore = await layerRows(page).count();
  await layerRow(page, "Hero").click();
  await layerRow(page, "Avatar").click({ modifiers: ["Shift"] });
  check((await selectedRows(page).count()) === 2, "Hero and Avatar should be selected");
  await page.keyboard.press("Shift+A");
  check(await eventually(async () => (await selectedName()) === "Frame"), `the new frame should be selected, got ${await selectedName()}`);
  check((await layerRows(page).count()) === rowsBefore + 1, "one new layer");
  const frame = { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
  check(frame.x === 120 && frame.y === 40 && frame.w === 1176 && frame.h === 320, `the frame should hug Hero and Avatar side by side at their top-left, got ${JSON.stringify(frame)}`);
  check(await checked("Direction", "Horizontal"), "a row of layers is a horizontal stack");
  await expectBox("Avatar", { x: 1080, y: 0 }, "Avatar sits after Hero with the guessed 520 px gap");
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === rowsBefore), "undo removes the frame");
  await expectBox("Hero", { x: 120, y: 160 }, "undo puts Hero back");
  await expectBox("Avatar", { x: 1200, y: 40 }, "undo puts Avatar back");

  log("Shift+A on a plain frame adds auto layout to it");
  await layerRow(page, "Desktop").click();
  await page.keyboard.press("Shift+A");
  check(await eventually(() => props.getByRole("button", { name: "Remove auto layout" }).isVisible()), "Shift+A should add auto layout to the selected frame");
  check((await selectedName()) === "Desktop", "the frame stays selected");
  await undo();
  check(await eventually(() => props.getByRole("button", { name: "Add auto layout" }).isVisible()), "undo removes it");

  log("constraints: Left & right stretches Hero with a typed frame width");
  await layerRow(page, "Hero").click();
  const h = props.getByLabel("Horizontal constraint");
  check((await h.inputValue()) === "MIN", "constraints default to Left");
  check((await props.getByLabel("Vertical constraint").inputValue()) === "MIN", "and Top");
  await h.selectOption({ label: "Left & right" });
  check((await h.inputValue()) === "STRETCH", "Left & right should be chosen");
  await layerRow(page, "Avatar").click();
  check((await props.getByLabel("Horizontal constraint").inputValue()) === "MAX", "Avatar is pinned right");
  await layerRow(page, "Desktop").click();
  await setField(page, "Width", 1540);
  await expectBox("Hero", { x: 120, w: 660 }, "Left & right keeps both margins");
  await expectBox("Avatar", { x: 1300 }, "Avatar (Right) moves with the right edge");
  await page.locator(".canvas").focus();
  await undo();
  await expectBox("Hero", { w: 560 }, "undo of the width undoes the stretch too");
  await expectBox("Desktop", { w: 1440 }, "and the width");

  await context.close();
});
