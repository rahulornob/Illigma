// Canvas interaction: click-to-select (checked against the Layers panel),
// click on empty canvas to deselect, drawing Frame / Rectangle / Ellipse at
// several zoom levels (world coordinates read back from the Properties
// panel), Space-drag panning, and shortcuts staying quiet while typing.
// Direct manipulation: drag-move (live Properties, one undo step, Escape
// cancels, Shift keeps an axis), handle resize (Shift ratio, Alt from the
// centre, flip past the opposite edge), marquee, Shift-click, multi-select
// move and resize, Delete, ⌘D, arrow-key nudges and the hover outline.
//
// Screen ↔ world mapping comes from the selection overlay: selecting the
// "Desktop" frame (a known world rect) shows where world points land.
//
// Usage (from the repo root):  node apps/web/e2e/canvas.mjs [--headed] [--no-build]

import { createFile, drag, eventually, field, layerRow, layerRows, newContext, poll, runE2E, selectedRows, setField, watchErrors } from "./lib.mjs";

await runE2E("canvas", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const canvas = page.locator("canvas.canvas");
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const selectedName = async () => {
    const rows = await selectedRows(page).allInnerTexts();
    return rows.length ? rows.map((r) => r.trim()).join(",") : null;
  };
  const toolPressed = (label) => page.getByRole("button", { name: label }).getAttribute("aria-pressed");
  /** The selection overlay's top-left (CSS px, page coordinates) and its size on screen. */
  const selectionRect = async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // the overlay updates on the next frame
    return page.evaluate(() => {
      const el = document.querySelector(".selection-box");
      if (!el || el.style.display === "none") return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
    });
  };

  /** Map world ↔ screen from the Desktop frame's selection box. */
  async function mapping() {
    await layerRow(page, "Desktop").click();
    const dx = await field(page, "X position");
    const dy = await field(page, "Y position");
    const dw = await field(page, "Width");
    const r = await selectionRect();
    check(r, "selecting Desktop should show the selection box");
    const z = r.width / dw;
    const ox = r.x - dx * z;
    const oy = r.y - dy * z;
    return {
      z,
      desktop: { x: dx, y: dy, w: dw, h: await field(page, "Height") },
      toScreen: (wx, wy) => ({ x: ox + wx * z, y: oy + wy * z }),
      toWorld: (sx, sy) => ({ x: (sx - ox) / z, y: (sy - oy) / z }),
    };
  }

  log("open a new file");
  await createFile(page, url);
  const cbox = await canvas.boundingBox();

  log("click-to-select picks the layer under the pointer");
  let m = await mapping();
  check(near(m.z, Number((await page.locator(".zoom-value").innerText()).replace("%", "")) / 100, 0.01), "the overlay scale should match the zoom readout");
  const clickWorld = async (wx, wy) => {
    const p = m.toScreen(wx, wy);
    await page.mouse.click(p.x, p.y);
  };
  const clickSelects = async (wx, wy, name, why) => {
    await clickWorld(wx, wy);
    const got = await selectedName();
    check(got === name, `clicking world (${wx}, ${wy}) ${why} should select ${name}, the Layers panel highlights ${got}`);
    if (name) check((await page.locator(".card-head .muted").innerText()) === name, `the Properties panel should show ${name}`);
    else check(await page.getByText("Select a layer to see its position and size.").isVisible(), "the Properties panel should show the empty state");
  };
  await clickSelects(1000, 700, "Desktop", "(empty part of the Desktop frame)");

  // Figma: children of a top-level frame are picked directly on the first click
  // (only groups and nested frames need a second click / ⌘-click).
  const directPicks = [];
  for (const [name, wx, wy] of [
    ["Hero", 400, 320],
    ["Avatar", 1248, 88],
  ]) {
    await clickWorld(wx, wy);
    directPicks.push(`${name} → ${await selectedName()}`);
  }
  check(
    directPicks.every((p) => p.split(" → ")[0] === p.split(" → ")[1]),
    `clicking a layer inside a top-level frame should select that layer, as in Figma (${directPicks.join(", ")})`,
  );

  log("clicking empty canvas deselects");
  await clickSelects(1300, 1000, null, "(empty canvas)");
  check((await selectionRect()) === null, "the selection box should hide");

  log("hit-testing follows the shape: a top-level ellipse below Desktop");
  const e1 = m.toScreen(260, 935);
  const e2 = m.toScreen(420, 1095);
  check(e2.y < cbox.y + cbox.height - 20, "the area below Desktop should be on screen at fit zoom");
  await drawAndCheck("ellipse on page @fit", "o", "Ellipse", e1, e2);
  const ellipse = { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
  const ellipseName = (await selectedName()) ?? "";
  m = await mapping();
  await clickSelects(1300, 1000, null, "(empty canvas)");
  await clickSelects(ellipse.x + ellipse.w / 2, ellipse.y + ellipse.h / 2, ellipseName, "(ellipse centre)");
  await clickSelects(ellipse.x + 6, ellipse.y + 6, null, "(ellipse bounding-box corner, outside the curve)");
  await clickSelects(ellipse.x + ellipse.w / 2, ellipse.y + 4, ellipseName, "(just inside the ellipse's top)");
  await clickSelects(400, 320, "Hero", "(Hero, inside Desktop)");
  await clickSelects(ellipse.x + ellipse.w / 2, ellipse.y + ellipse.h + 10, null, "(just below the ellipse)");

  log("move Desktop off the origin so parent-relative coordinates are tested");
  await layerRow(page, "Desktop").click();
  await setField(page, "X position", 100);
  await setField(page, "Y position", 50);

  /** Draw with `key` from screen p1 to p2 and check the new layer against the expected world rect. */
  async function drawAndCheck(label, key, type, p1, p2) {
    m = await mapping();
    await canvas.focus();
    await page.keyboard.press(key);
    const before = await layerRows(page).count();
    const w1 = m.toWorld(p1.x, p1.y);
    const w2 = m.toWorld(p2.x, p2.y);
    const d = m.desktop;
    const inside = w1.x >= d.x && w1.y >= d.y && w1.x <= d.x + d.w && w1.y <= d.y + d.h;
    const ox = inside ? d.x : 0;
    const oy = inside ? d.y : 0;
    const clicked = Math.hypot(p2.x - p1.x, p2.y - p1.y) <= 3;
    if (clicked) await page.mouse.click(p1.x, p1.y);
    else await drag(page, p1.x, p1.y, p2.x, p2.y);
    const expected = clicked
      ? { x: w1.x - 50 - ox, y: w1.y - 50 - oy, w: 100, h: 100 }
      : { x: Math.min(w1.x, w2.x) - ox, y: Math.min(w1.y, w2.y) - oy, w: Math.abs(w2.x - w1.x), h: Math.abs(w2.y - w1.y) };
    check((await layerRows(page).count()) === before + 1, `${label}: drawing should add one layer`);
    const row = selectedRows(page);
    const aria = await row.getAttribute("aria-label");
    check(new RegExp(`^${type} \\d+, ${type.toLowerCase()}$`).test(aria ?? ""), `${label}: the new ${type.toLowerCase()} should be selected, got "${aria}"`);
    const depth = parseInt((await row.getAttribute("style")).match(/padding-left:\s*(\d+)/)?.[1] ?? "8", 10);
    check(depth === (inside ? 24 : 8), `${label}: the layer should be ${inside ? "inside Desktop" : "on the page"} (indent ${depth})`);
    const got = { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
    const tol = Math.max(1, 1.5 / m.z); // one CSS pixel of mouse rounding, in world units
    for (const k of ["x", "y", "w", "h"]) {
      check(near(got[k], Math.round(expected[k]), tol), `${label}: ${k} should be ≈${Math.round(expected[k])} at zoom ${m.z.toFixed(3)}, Properties shows ${got[k]}`);
    }
    check((await toolPressed("Move (V)")) === "true", `${label}: the tool should return to Move`);
    return got;
  }

  const at = (fx, fy) => ({ x: cbox.x + cbox.width * fx, y: cbox.y + cbox.height * fy });

  log("draw a Frame at fit zoom");
  await canvas.focus();
  await page.keyboard.press("Shift+Digit1");
  await drawAndCheck("frame @fit", "f", "Frame", at(0.42, 0.45), at(0.55, 0.6));

  log("draw a Rectangle outside any frame at fit zoom");
  m = await mapping();
  const outside = m.toScreen(m.desktop.x + 1000, m.desktop.y + m.desktop.h + 20);
  check(outside.y + 40 < cbox.y + cbox.height - 10, "the point below Desktop should be on screen at fit zoom");
  await drawAndCheck("rectangle on page @fit", "r", "Rectangle", outside, { x: outside.x + 45, y: outside.y + 35 });

  log("draw a Rectangle at 100%");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+Digit0");
  check((await page.locator(".zoom-value").innerText()) === "100%", "⌘0 should zoom to 100%");
  await drawAndCheck("rectangle @100%", "r", "Rectangle", at(0.3, 0.3), at(0.45, 0.38));

  log("click with Ellipse at 100% makes a 100 × 100 ellipse centred on the click");
  await drawAndCheck("ellipse click @100%", "o", "Ellipse", at(0.6, 0.6), at(0.6, 0.6));

  log("draw an Ellipse at 200%");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+Equal");
  check((await page.locator(".zoom-value").innerText()) === "200%", "⌘+ should zoom to 200%");
  await drawAndCheck("ellipse @200%", "o", "Ellipse", at(0.62, 0.3), at(0.5, 0.42)); // dragged up-left to down-right reversed

  log("draw a Frame at 25%");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+Digit0");
  await page.keyboard.press("ControlOrMeta+Minus");
  await page.keyboard.press("ControlOrMeta+Minus");
  check((await page.locator(".zoom-value").innerText()) === "25%", "⌘− twice from 100% should read 25%");
  await drawAndCheck("frame @25%", "f", "Frame", at(0.2, 0.75), at(0.28, 0.85));
  await page.screenshot({ path: `${outDir}/canvas-drawn.png` });

  log("Space-drag pans with any tool and draws nothing");
  await canvas.focus();
  await page.keyboard.press("Shift+Digit1");
  await layerRow(page, "Hero").click();
  const before = await selectionRect();
  const count = await layerRows(page).count();
  await canvas.focus();
  await page.keyboard.press("r");
  await page.keyboard.down("Space");
  check((await canvas.evaluate((c) => c.style.cursor)) === "grab", "holding Space should show the grab cursor");
  await drag(page, cbox.x + 300, cbox.y + 300, cbox.x + 420, cbox.y + 370);
  await page.keyboard.up("Space");
  const after = await selectionRect();
  check(near(after.x - before.x, 120) && near(after.y - before.y, 70), `Space-drag should pan by (120, 70), moved (${after.x - before.x}, ${after.y - before.y})`);
  check((await layerRows(page).count()) === count, "Space-drag must not draw");
  check((await selectedName()) === "Hero", "Space-drag must not change the selection");
  check((await toolPressed("Rectangle (R)")) === "true", "the Rectangle tool should stay picked after panning");

  log("Space-drag right after clicking a tool in the dock");
  await page.getByRole("button", { name: "Rectangle (R)" }).click(); // focus stays on the dock button
  const before2 = await selectionRect();
  await page.keyboard.down("Space");
  await drag(page, cbox.x + 300, cbox.y + 300, cbox.x + 360, cbox.y + 340);
  await page.keyboard.up("Space");
  const after2 = await selectionRect();
  const panned = after2 && near(after2.x - before2.x, 60) && near(after2.y - before2.y, 40);
  const drew = (await layerRows(page).count()) !== count;
  check(panned && !drew, `Space-drag should pan, not draw, when a button (tool dock, layer row) has focus (drew a layer: ${drew})`);
  if (drew) {
    await canvas.focus();
    await page.keyboard.press("ControlOrMeta+z");
  }
  await canvas.focus();
  await page.keyboard.press("Escape");

  log("shortcuts don't fire while typing in a field");
  await layerRow(page, "Hero").click();
  await setField(page, "X position", 400); // the field keeps focus
  const x = page.getByLabel("X position");
  const layers = await layerRows(page).count();
  await x.focus();
  await page.keyboard.type("rvfo");
  check((await x.inputValue()) === "rvfo", "letters typed in a field should go into the field");
  check((await toolPressed("Move (V)")) === "true", "R/V/F/O typed in a field must not switch tools");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  check((await layerRows(page).count()) === layers, "Backspace/Delete in a field must not delete the layer");
  await page.keyboard.down("Space");
  check((await canvas.evaluate((c) => c.style.cursor)) !== "grab", "Space in a field must not start panning");
  await page.keyboard.up("Space");
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("Escape"); // reverts the draft to the document's value and leaves the field
  check((await field(page, "X position")) === 400, "⌘Z in a field must not undo the document");
  check((await selectedName()) === "Hero", "Escape in a field must not clear the selection");
  check((await layerRows(page).count()) === layers, "no layer should change while typing");

  log("the same shortcuts work once focus leaves the field");
  await canvas.focus();
  await page.keyboard.press("o");
  check((await toolPressed("Ellipse (O)")) === "true", "O should pick Ellipse on the canvas");
  await page.keyboard.press("Escape");
  check((await toolPressed("Move (V)")) === "true", "Escape should return to Move");
  await page.keyboard.press("ControlOrMeta+z");
  const undone = await poll(async () => (await field(page, "X position")) !== 400, "undo", 2_000).catch(() => false);
  check(undone, "⌘Z on the canvas should undo the X edit");
  await page.keyboard.press("Delete");
  check((await layerRows(page).count()) === layers - 1, "Delete on the canvas should delete the selected layer");

  log("Escape in a field reverts a typed number");
  await layerRow(page, "Avatar").click();
  const ax = page.getByLabel("X position");
  const original = Number(await ax.inputValue());
  await ax.focus();
  await page.keyboard.type("123");
  await page.keyboard.press("Escape");
  const reverted = await eventually(async () => Number(await ax.inputValue()) === original, 2_000);
  const afterEscape = Number(await ax.inputValue());
  check(reverted, `Escape in a Properties field should revert the typed value (X ${original} → ${afterEscape})`);

  // ---- direct manipulation: move, resize, marquee, multi-select, delete, duplicate, nudge ----

  log("direct manipulation: a fresh file");
  await createFile(page, url);
  m = await mapping(); // Desktop at (0, 0); Hero 120, 160, 560 × 320; Avatar 1200, 40, 96 × 96
  const box4 = async (name) => {
    await layerRow(page, name).click();
    return { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
  };
  const fieldIs = (label, want, tol = 0.01) => eventually(async () => near(await field(page, label), want, tol), 2_000);
  const announced = () => page.locator(".selection-announcer").textContent();
  const undo = async () => {
    await canvas.focus();
    await page.keyboard.press("ControlOrMeta+z");
  };
  const tol = Math.max(1, 1.5 / m.z);

  log("click-drag an unselected layer selects it and moves it; Properties follow live");
  await page.keyboard.press("Escape");
  const heroAt = m.toScreen(400, 320);
  await page.mouse.move(heroAt.x, heroAt.y);
  await page.mouse.down();
  await page.mouse.move(heroAt.x + 50, heroAt.y + 25, { steps: 6 });
  check((await selectedName()) === "Hero", `pressing on Hero should select it, got ${await selectedName()}`);
  check(await eventually(async () => (await field(page, "X position")) > 120, 2_000), "X should update while dragging, before the mouse is released");
  await page.mouse.move(heroAt.x + 100, heroAt.y + 50, { steps: 6 });
  await page.mouse.up();
  const moved = { x: await field(page, "X position"), y: await field(page, "Y position") };
  check(near(moved.x, 120 + 100 / m.z, tol) && near(moved.y, 160 + 50 / m.z, tol), `drag-move should move Hero by (${100 / m.z}, ${50 / m.z}), now at (${moved.x}, ${moved.y})`);
  check(Number.isInteger(moved.x) && Number.isInteger(moved.y), `a drag keeps whole-pixel positions, got (${moved.x}, ${moved.y})`);
  check((await field(page, "Width")) === 560, "moving must not resize");
  check((await announced()) === "Hero selected", `the screen-reader announcement should say "Hero selected", got "${await announced()}"`);

  log("one undo puts the whole drag back");
  await undo();
  check(await fieldIs("X position", 120), `one ⌘Z should restore X 120, got ${await field(page, "X position")}`);
  check(await fieldIs("Y position", 160), `one ⌘Z should restore Y 160, got ${await field(page, "Y position")}`);

  log("Escape during a drag cancels it");
  await page.mouse.move(heroAt.x, heroAt.y);
  await page.mouse.down();
  await page.mouse.move(heroAt.x + 80, heroAt.y + 80, { steps: 6 });
  check(await eventually(async () => (await field(page, "X position")) !== 120, 2_000), "the layer should be moving");
  await page.keyboard.press("Escape");
  check(await fieldIs("X position", 120), "Escape should put the layer back at once");
  await page.mouse.move(heroAt.x + 120, heroAt.y + 100, { steps: 3 });
  await page.mouse.up();
  check((await field(page, "X position")) === 120 && (await field(page, "Y position")) === 160, "the cancelled drag must not move the layer after Escape");
  check((await selectedName()) === "Hero", "Escape during a drag keeps the selection");

  log("Shift-drag keeps to one axis");
  await page.keyboard.down("Shift");
  await drag(page, heroAt.x, heroAt.y, heroAt.x + 90, heroAt.y + 20);
  await page.keyboard.up("Shift");
  check((await selectedName()) === "Hero", "Shift-drag on the selected layer keeps it selected");
  check(near(await field(page, "X position"), 120 + 90 / m.z, tol) && (await field(page, "Y position")) === 160, `Shift-drag should move along X only, got (${await field(page, "X position")}, ${await field(page, "Y position")})`);
  await undo();
  check(await fieldIs("X position", 120), "undo the Shift-drag");

  /** The selection box's handle on screen ("se", "e", …), in page CSS pixels. */
  const handlePoint = async (h) => {
    const r = await selectionRect();
    const fx = h.includes("w") ? 0 : h.includes("e") ? 1 : 0.5;
    const fy = h.includes("n") ? 0 : h.includes("s") ? 1 : 0.5;
    return { x: r.x + r.width * fx, y: r.y + r.height * fy };
  };

  log("dragging a handle resizes; the size label follows");
  await layerRow(page, "Hero").click();
  let hp = await handlePoint("se");
  await page.mouse.move(hp.x, hp.y);
  check(await eventually(async () => (await canvas.evaluate((c) => c.style.cursor)) === "nwse-resize", 2_000), "a corner handle should show a resize cursor");
  await drag(page, hp.x, hp.y, hp.x + 60, hp.y + 30);
  let hero = { x: await field(page, "X position"), y: await field(page, "Y position"), w: await field(page, "Width"), h: await field(page, "Height") };
  check(hero.x === 120 && hero.y === 160, `the SE handle keeps the top-left, got (${hero.x}, ${hero.y})`);
  check(near(hero.w, 560 + 60 / m.z, tol) && near(hero.h, 320 + 30 / m.z, tol), `the SE handle should resize by (${60 / m.z}, ${30 / m.z}), got ${hero.w} × ${hero.h}`);
  check(await eventually(async () => (await page.locator(".size-pill").innerText()) === `${hero.w} × ${hero.h}`, 2_000), "the size label should show the new size");
  await undo();
  check(await fieldIs("Width", 560), "one undo restores the width");
  check(await fieldIs("Height", 320), "one undo restores the height");

  log("Shift keeps the aspect ratio");
  hp = await handlePoint("se");
  await page.keyboard.down("Shift");
  await drag(page, hp.x, hp.y, hp.x + 140, hp.y + 10);
  await page.keyboard.up("Shift");
  hero = { w: await field(page, "Width"), h: await field(page, "Height") };
  check(hero.w > 560 && near(hero.w / hero.h, 560 / 320, 0.02), `Shift-resize should keep 560:320, got ${hero.w} × ${hero.h}`);
  await undo();
  check(await fieldIs("Width", 560), "undo the Shift-resize");

  log("Alt resizes from the centre");
  hp = await handlePoint("e");
  await page.keyboard.down("Alt");
  await drag(page, hp.x, hp.y, hp.x + 40, hp.y);
  await page.keyboard.up("Alt");
  hero = { x: await field(page, "X position"), w: await field(page, "Width") };
  check(near(hero.w, 560 + 80 / m.z, 2 * tol) && near(hero.x, 120 - 40 / m.z, tol), `Alt-resize should grow both sides, got X ${hero.x}, W ${hero.w}`);
  await undo();
  check(await fieldIs("X position", 120), "undo the Alt-resize");

  log("dragging an edge past the opposite one flips the box");
  hp = await handlePoint("e");
  const left = (await handlePoint("w")).x;
  await drag(page, hp.x, hp.y, left - 50, hp.y);
  hero = { x: await field(page, "X position"), w: await field(page, "Width") };
  check(near(hero.w, 50 / m.z, tol) && near(hero.x, 120 - 50 / m.z, tol), `a flipped resize should land left of the old left edge, got X ${hero.x}, W ${hero.w}`);
  await undo();
  check(await fieldIs("Width", 560), "undo the flip");

  log("a marquee from a frame's empty area selects the children it touches");
  const mq1 = m.toScreen(60, 100);
  const mq2 = m.toScreen(1250, 200);
  await page.mouse.move(mq1.x, mq1.y);
  await page.mouse.down();
  await page.mouse.move((mq1.x + mq2.x) / 2, (mq1.y + mq2.y) / 2, { steps: 6 });
  check(await eventually(() => page.locator(".marquee-box").isVisible(), 2_000), "the marquee should show while dragging");
  await page.mouse.move(mq2.x, mq2.y, { steps: 6 });
  await page.mouse.up();
  check((await selectedName()) === "Avatar,Hero", `the marquee should select Hero and Avatar, got ${await selectedName()}`);
  check((await page.locator(".card-head .muted").innerText()) === "2 layers", "Properties should say 2 layers");
  check((await page.getByLabel("X position").getAttribute("placeholder")) === "Mixed", "X differs between them: Mixed");
  check((await announced()) === "2 layers selected", `announce "2 layers selected", got "${await announced()}"`);
  check(await eventually(async () => (await page.locator(".layer-outline:visible").count()) >= 2, 2_000), "each member of a multi-selection gets an outline");

  log("moving a multi-selection moves all of it in one undo step");
  await drag(page, heroAt.x, heroAt.y, heroAt.x + 40, heroAt.y);
  const dx = 40 / m.z;
  check(near((await box4("Hero")).x, 120 + dx, tol) && near((await box4("Avatar")).x, 1200 + dx, tol), "both layers should move by the same amount");
  await page.keyboard.press("Escape");
  await undo();
  await poll(async () => (await box4("Hero")).x === 120, "undo the group move (Hero)", 2_000);
  check((await box4("Avatar")).x === 1200, "one undo should put Avatar back too");

  log("Shift-click adds and removes; the Layers panel follows");
  await clickWorld(400, 320);
  await page.keyboard.down("Shift");
  await clickWorld(1248, 88);
  check((await selectedName()) === "Avatar,Hero", `Shift-click should add Avatar, got ${await selectedName()}`);
  await clickWorld(400, 320);
  await page.keyboard.up("Shift");
  check((await selectedName()) === "Avatar", `Shift-click on a selected layer should remove it, got ${await selectedName()}`);
  await layerRow(page, "Hero").click({ modifiers: ["Shift"] });
  check((await selectedName()) === "Avatar,Hero", `Shift-click in the Layers panel should add, got ${await selectedName()}`);

  log("resizing a multi-selection scales every member");
  hp = await handlePoint("se");
  await drag(page, hp.x, hp.y, hp.x + 100, hp.y);
  check((await box4("Hero")).w > 560, "Hero should get wider with the group");
  check((await box4("Avatar")).x > 1200, "Avatar should move right with the group's right edge");
  await page.keyboard.press("Escape");
  await undo();
  check(await eventually(async () => (await box4("Hero")).w === 560 && (await box4("Avatar")).x === 1200, 2_000), "one undo should restore the group resize");

  log("Delete removes the selection; undo brings it back");
  const before5 = await layerRows(page).count();
  await clickWorld(400, 320);
  await page.keyboard.down("Shift");
  await clickWorld(1248, 88);
  await page.keyboard.up("Shift");
  await page.keyboard.press("Delete");
  check((await layerRows(page).count()) === before5 - 2, "Delete should remove both selected layers");
  check((await selectedRows(page).count()) === 0, "nothing stays selected after Delete");
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === before5, 2_000), "one undo should bring both back");

  log("⌘D duplicates in place, above the original");
  await clickWorld(400, 320);
  await page.keyboard.press("ControlOrMeta+d");
  check((await layerRows(page).count()) === before5 + 1, "⌘D should add one layer");
  check((await selectedRows(page).count()) === 1 && (await selectedName()) === "Hero", "the copy (named Hero) should be selected");
  check((await field(page, "X position")) === 120 && (await field(page, "Y position")) === 160, "the copy should sit in place");
  const rowNames = (await layerRows(page).allInnerTexts()).map((t) => t.trim());
  const selIndex = await page.evaluate(() => [...document.querySelectorAll(".layer-list .layer-row")].findIndex((r) => r.getAttribute("aria-pressed") === "true"));
  check(rowNames[selIndex] === "Hero" && rowNames[selIndex + 1] === "Hero", `the copy should be just above the original in the Layers panel (${rowNames.join(", ")}, selected #${selIndex})`);
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === before5, 2_000), "undo removes the copy");

  log("arrow keys nudge 1 px, Shift+arrow 10 px");
  await clickWorld(400, 320);
  await page.keyboard.press("ArrowRight");
  check(await fieldIs("X position", 121), "→ should nudge 1 px");
  await page.keyboard.press("Shift+ArrowDown");
  check(await fieldIs("Y position", 170), "Shift+↓ should nudge 10 px");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  check(await fieldIs("X position", 119), "← twice should nudge 2 px back");
  await undo();
  await undo();
  check(await fieldIs("X position", 121), "each nudge is one undo step: two undos leave the first nudge");
  check(await fieldIs("Y position", 170), "the Shift nudge is still applied after two undos");
  await undo();
  await undo();
  check(await fieldIs("X position", 120), "four undos restore X");
  check(await fieldIs("Y position", 160), "four undos restore Y");

  log("hover outlines the layer a click would select");
  await clickWorld(400, 320);
  const avatarAt = m.toScreen(1248, 88);
  await page.mouse.move(avatarAt.x, avatarAt.y, { steps: 3 });
  check(await eventually(async () => (await page.locator(".layer-outline:visible").count()) === 1, 2_000), "hovering Avatar should show one hover outline");
  await page.screenshot({ path: `${outDir}/canvas-manipulation.png` });
  await context.close();
});
