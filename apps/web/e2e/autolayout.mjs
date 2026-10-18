// Auto layout and constraints in the Properties panel: add auto layout to a
// frame (+ and Shift+A), change direction, gap (number and Auto), padding and
// alignment (mouse and keyboard) and see the children move (X/Y read back in
// Properties), Fixed / Hug / Fill sizing menus (mouse and keyboard),
// absolute position, Shift+A wrapping several layers in one undo step,
// constraints following a typed frame size, and undo of each change.
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
  check(await checked("Direction", "Horizontal"), "Hero and Avatar side by side should give a horizontal stack");
  check(await eventually(async () => (await props.getByLabel("Gap between items").inputValue()) === "520"), "the gap should be the space between Hero and Avatar");
  check(await eventually(async () => Number(await props.getByLabel("Height").inputValue()) === 780), "the frame should hug its children (40 + 320 + 420)");
  check(await eventually(async () => (await props.locator(".field-unit").allInnerTexts()).join(",") === "Hug,Hug"), "W and H should show Hug");
  check(await eventually(async () => (await props.getByLabel("Left padding").inputValue()) === "120"), "padding differs per side, so each side shows: left 120");
  check((await props.getByLabel("Right padding").inputValue()) === "144", "right padding 144");
  await expectBox("Hero", { x: 120, y: 40 }, "auto layout keeps Hero's left padding and lines it up at the top");
  await expectBox("Avatar", { x: 1200, y: 40 }, "Avatar keeps its place along the stack");

  log("direction: vertical stacks Avatar under Hero");
  await layerRow(page, "Desktop").click();
  await radio("Direction", "Vertical").click();
  await expectBox("Avatar", { x: 120, y: 880 }, "vertical direction");

  log("gap and padding");
  await layerRow(page, "Desktop").click();
  await setField(page, "Gap between items", 10);
  await expectBox("Avatar", { y: 370 }, "a 10 px gap");
  await layerRow(page, "Desktop").click();
  await props.getByRole("button", { name: "Individual padding" }).click();
  await setField(page, "Horizontal padding", 24);
  await expectBox("Hero", { x: 24 }, "24 px horizontal padding");
  await expectBox("Desktop", { w: 608 }, "the hugging frame shrinks to 24 + 560 + 24");

  log("alignment grid: click, then arrow keys (which must not nudge the layer)");
  await layerRow(page, "Desktop").click();
  await radio("Alignment", "Top center").click();
  check(await checked("Alignment", "Top center"), "Top center should be checked");
  await expectBox("Avatar", { x: 24 + (560 - 96) / 2 }, "centred across a vertical stack");
  await layerRow(page, "Desktop").click();
  const desktopBefore = await boxOf("Desktop");
  await radio("Alignment", "Top center").focus();
  await page.keyboard.press("ArrowRight");
  check(await checked("Alignment", "Top right"), "→ should move the alignment to Top right");
  check(await radio("Alignment", "Top right").evaluate((el) => el === document.activeElement), "focus should follow the checked cell");
  check((await selectedName()) === "Desktop", "the arrow key should not change the selection");
  const desktopAfter = { x: await field(page, "X position"), y: await field(page, "Y position") };
  check(desktopAfter.x === desktopBefore.x && desktopAfter.y === desktopBefore.y, "the arrow key should not nudge the frame");
  await expectBox("Avatar", { x: 24 + 560 - 96 }, "right-aligned");
  await undo();
  await expectBox("Avatar", { x: 24 + (560 - 96) / 2 }, "undo returns to Top center in one step");

  log("direction by keyboard: arrows move between the direction buttons");
  await layerRow(page, "Desktop").click();
  await radio("Direction", "Vertical").focus();
  await page.keyboard.press("ArrowLeft");
  check(await checked("Direction", "Horizontal"), "← from Vertical should pick Horizontal");
  await page.keyboard.press("ArrowRight");
  check(await checked("Direction", "Vertical"), "→ should pick Vertical again");

  log("Auto gap spreads the children over a fixed height");
  await layerRow(page, "Desktop").click();
  await setField(page, "Height", 1000);
  check(await eventually(async () => (await props.locator(".field-unit").allInnerTexts()).join(",") === "Hug"), "typing a height should make it Fixed (only W still hugs)");
  await props.getByRole("button", { name: /^Gap mode/ }).click();
  await page.getByRole("menuitemradio", { name: "Auto (space between)" }).click();
  check(await eventually(async () => (await props.getByLabel("Gap between items").inputValue()) === "Auto"), "the gap field should read Auto");
  await expectBox("Avatar", { y: 1000 - 420 - 96 }, "Auto gap pushes Avatar to the bottom padding");
  await layerRow(page, "Desktop").click();
  await setField(page, "Gap between items", 16);
  await expectBox("Avatar", { y: 40 + 320 + 16 }, "typing a number leaves Auto");

  log("sizing menus: Fill for a child, Hug for the frame, only valid options");
  await layerRow(page, "Avatar").click();
  await props.getByRole("button", { name: /^Horizontal resizing/ }).click();
  const avatarOptions = await page.getByRole("menu").getByRole("menuitemradio").allInnerTexts();
  check(avatarOptions.join("|") === "Fixed width · 96|Fill container", `an ellipse in auto layout can be Fixed or Fill, not Hug; got ${avatarOptions.join(" | ")}`);
  await page.getByRole("menuitemradio", { name: "Fill container" }).click();
  check((await page.getByRole("menu").count()) === 0, "picking an option closes the menu");
  await expectBox("Avatar", { w: 560 }, "Fill container: the frame's width minus padding");
  check((await props.getByRole("button", { name: /^Horizontal resizing/ }).getAttribute("aria-label")) === "Horizontal resizing: Fill container", "the W menu button should say Fill");
  await layerRow(page, "Desktop").click();
  check(
    (await props.getByRole("button", { name: /^Horizontal resizing/ }).getAttribute("aria-label")) === "Horizontal resizing: Fixed",
    "a child set to Fill makes its hugging parent Fixed",
  );
  await setField(page, "Width", 800);
  await expectBox("Avatar", { w: 752 }, "Avatar fills the wider frame");

  log("sizing menu by keyboard: Enter opens on the checked item, ↓ and Enter pick Hug");
  await layerRow(page, "Desktop").click();
  const wMenu = props.getByRole("button", { name: /^Horizontal resizing/ });
  await wMenu.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor();
  const desktopOptions = await page.getByRole("menu").getByRole("menuitemradio").allInnerTexts();
  check(desktopOptions.join("|") === "Fixed width · 800|Hug contents", `a top-level frame can't fill; got ${desktopOptions.join(" | ")}`);
  check((await page.evaluate(() => document.activeElement?.textContent)) === "Fixed width · 800", "focus should start on the checked option");
  await page.screenshot({ path: `${outDir}/autolayout-sizing-menu.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  check(await wMenu.evaluate((el) => el === document.activeElement), "focus returns to the menu button");
  check((await page.getByRole("menu").count()) === 0, "the menu closes");
  await expectBox("Avatar", { w: 752 }, "Hug on the frame makes its Fill child Fixed at its size");
  await expectBox("Desktop", { w: 800 }, "the frame hugs the 752 px Avatar plus padding");
  await layerRow(page, "Desktop").click();
  await wMenu.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor();
  await page.keyboard.press("Escape");
  check((await page.getByRole("menu").count()) === 0 && (await selectedName()) === "Desktop", "Escape closes the menu and keeps the selection");

  log("absolute position: the child leaves the flow and keeps a typed X");
  await layerRow(page, "Avatar").click();
  const abs = props.getByRole("button", { name: "Absolute position" });
  check((await abs.getAttribute("aria-pressed")) === "false", "Avatar starts in the flow");
  await abs.click();
  check((await abs.getAttribute("aria-pressed")) === "true", "Absolute position should be on");
  check(await props.getByLabel("Horizontal constraint").isVisible(), "an absolute child gets constraints");
  await setField(page, "X position", 10);
  await expectBox("Avatar", { x: 10 }, "an absolute child keeps its position");
  await layerRow(page, "Hero").click();
  check((await props.getByRole("button", { name: "Absolute position" }).getAttribute("aria-pressed")) === "false", "Hero is still in the flow");
  check((await props.getByLabel("Horizontal constraint").count()) === 0, "a child in the flow has no constraints");
  await page.screenshot({ path: `${outDir}/autolayout-panel.png` });

  log("remove auto layout");
  await layerRow(page, "Desktop").click();
  await props.getByRole("button", { name: "Remove auto layout" }).click();
  check(await props.getByRole("button", { name: "Add auto layout" }).isVisible(), "the card should offer Add auto layout again");
  await undo();
  check(await props.getByRole("button", { name: "Remove auto layout" }).isVisible(), "undo brings auto layout back");

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
  await layerRow(page, "Desktop").click();
  await setField(page, "Width", 1540);
  await expectBox("Hero", { x: 120, w: 660 }, "Left & right keeps both margins");
  await expectBox("Avatar", { x: 1200 }, "Avatar (Left) stays put");
  await page.locator(".canvas").focus();
  await undo();
  await expectBox("Hero", { w: 560 }, "undo of the width undoes the stretch too");
  await expectBox("Desktop", { w: 1440 }, "and the width");

  await context.close();
});
