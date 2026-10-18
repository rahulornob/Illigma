// Canvas interaction: click-to-select (checked against the Layers panel),
// click on empty canvas to deselect, drawing Frame / Rectangle / Ellipse at
// several zoom levels (world coordinates read back from the Properties
// panel), Space-drag panning, and shortcuts staying quiet while typing.
// Direct manipulation: drag-move (live Properties, one undo step, Escape
// cancels, Shift keeps an axis), handle resize (Shift ratio, Alt from the
// centre, flip past the opposite edge), marquee, Shift-click, multi-select
// move and resize, Delete, ⌘D, arrow-key nudges and the hover outline.
// QC round 5: small layers move, drags never get stuck (missed release,
// blur, a second pointer), handle clicks keep the selection, Escape before a
// drag starts, handles on the movable layers only, ⌘D in a field, undo of
// Delete reselects, Shift-click ranges in the Layers panel.
// QC round 6: on macOS only ⌘ skips constraints (Ctrl doesn't); dragging an
// auto layout child far outside its frame shows no line and drops nothing.
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
  // Deselect first: on the selected ellipse this corner is its resize handle, and clicking a handle keeps the selection.
  await clickSelects(1300, 1000, null, "(empty canvas)");
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
  check((await x.inputValue()) === "rvfo", `letters typed in a field should go into the field, got ${await x.inputValue()}`);
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
  await layerRow(page, "Hero").click({ modifiers: ["ControlOrMeta"] });
  check((await selectedName()) === "Avatar,Hero", `⌘-click in the Layers panel should add, got ${await selectedName()}`);

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
  check(await eventually(async () => (await selectedName()) === "Avatar,Hero", 2_000), `undoing Delete should select the restored layers again, got ${await selectedName()}`);

  log("Delete with a layer row focused moves focus to the next row (QC round 7)");
  const namesBefore = (await layerRows(page).allInnerTexts()).map((t) => t.trim());
  const heroRow = namesBefore.indexOf("Hero");
  const heir = namesBefore[heroRow + 1] ?? namesBefore[heroRow - 1];
  await layerRow(page, "Hero").click();
  check(await page.evaluate(() => document.activeElement?.getAttribute("role") === "treeitem"), "clicking a layer row focuses it");
  await page.keyboard.press("Delete");
  check((await layerRows(page).count()) === before5 - 1, "Delete from the Layers panel should remove Hero");
  const focusedLabel = () => page.evaluate(() => (document.activeElement?.getAttribute("role") === "treeitem" ? document.activeElement.getAttribute("aria-label") : document.activeElement?.tagName));
  check(await eventually(async () => (await focusedLabel())?.startsWith(`${heir},`), 2_000), `focus should move to the next row (${heir}), not <body>; got ${await focusedLabel()}`);
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === before5, 2_000), "undo should bring Hero back");

  log("⌘D duplicates in place, above the original");
  await clickWorld(400, 320);
  await page.keyboard.press("ControlOrMeta+d");
  check((await layerRows(page).count()) === before5 + 1, "⌘D should add one layer");
  check((await selectedRows(page).count()) === 1 && (await selectedName()) === "Hero", "the copy (named Hero) should be selected");
  check((await field(page, "X position")) === 120 && (await field(page, "Y position")) === 160, "the copy should sit in place");
  const rowNames = (await layerRows(page).allInnerTexts()).map((t) => t.trim());
  const selIndex = await page.evaluate(() => [...document.querySelectorAll(".layer-list .layer-row")].findIndex((r) => r.getAttribute("aria-selected") === "true"));
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

  // ---- QC round 5 ----

  /** The live state of a drag: true while the document has a drag open (Delete/undo would be swallowed). */
  const pointerEvent = (type, x, y, init = {}) =>
    canvas.evaluate((c, [type, x, y, init]) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "mouse", ...init })), [type, x, y, init]);

  log("a tiny selected layer moves when dragged from its middle (8 × 8 at fit zoom)");
  await page.keyboard.press("Escape");
  await layerRow(page, "Avatar").click();
  await setField(page, "Width", 8);
  await setField(page, "Height", 8);
  await canvas.focus();
  const tiny = m.toScreen(1204, 44);
  check(await eventually(async () => (await page.locator(".selection-box").getAttribute("data-small")) === "on", 2_000), "a tiny selection shows its corner handles only");
  await page.mouse.move(tiny.x, tiny.y);
  check(await eventually(async () => (await canvas.evaluate((c) => c.style.cursor)) === "default", 2_000), "the middle of a tiny selection shows the move cursor, not a resize one");
  await drag(page, tiny.x, tiny.y, tiny.x + 60, tiny.y + 30);
  let av = await box4("Avatar");
  check(av.w === 8 && av.h === 8, `dragging the middle of a tiny layer must not resize it, got ${av.w} × ${av.h}`);
  check(near(av.x, 1200 + 60 / m.z, tol) && near(av.y, 40 + 30 / m.z, tol), `dragging the middle of a tiny layer should move it by (${60 / m.z}, ${30 / m.z}), got (${av.x}, ${av.y})`);
  await undo();
  check(await fieldIs("X position", 1200), "undo the tiny move");
  // Its corner is still reachable from outside.
  const tinyBox = await selectionRect();
  const seOut = { x: tinyBox.x + tinyBox.width + 4, y: tinyBox.y + tinyBox.height + 4 };
  await drag(page, seOut.x, seOut.y, seOut.x + 40, seOut.y + 40);
  av = await box4("Avatar");
  check(av.x === 1200 && av.w > 8 && av.h > 8, `the SE corner of a tiny layer resizes it from just outside, got X ${av.x}, ${av.w} × ${av.h}`);
  await undo();
  check(await fieldIs("Width", 8), "undo the tiny resize");
  await undo();
  await undo();
  check(await fieldIs("Width", 96) && (await fieldIs("Height", 96)), "undo the size edits");

  log("a missed release (button already up) ends the drag; nothing stays stuck");
  await clickWorld(400, 320);
  await page.mouse.move(heroAt.x, heroAt.y);
  await page.mouse.down();
  await page.mouse.move(heroAt.x + 40, heroAt.y, { steps: 5 });
  check(await eventually(async () => (await field(page, "X position")) > 120, 2_000), "Hero should be moving");
  // The browser lost the pointer-up (released over a system dialog): the next move comes with no button down.
  await pointerEvent("pointermove", heroAt.x + 40, heroAt.y, { pointerId: 1, buttons: 0 });
  const kept = await field(page, "X position");
  check(near(kept, 120 + 40 / m.z, tol), `the drag should end where it was, got X ${kept}`);
  await page.mouse.move(heroAt.x + 200, heroAt.y + 100, { steps: 3 });
  check((await field(page, "X position")) === kept, "moving on after the missed release must not move the layer");
  await page.mouse.up();
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  check(await fieldIs("X position", kept + 1), "nudges work again after a missed release (no drag left open)");
  await undo();
  await undo();
  check(await fieldIs("X position", 120), "the drag and the nudge are each one undo step");

  log("leaving the window mid-drag cancels it");
  await page.mouse.move(heroAt.x, heroAt.y);
  await page.mouse.down();
  await page.mouse.move(heroAt.x + 50, heroAt.y + 50, { steps: 5 });
  check(await eventually(async () => (await field(page, "X position")) !== 120, 2_000), "Hero should be moving");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  check(await fieldIs("X position", 120), "blur should put the layer back");
  await page.mouse.move(heroAt.x + 90, heroAt.y + 60, { steps: 3 });
  await page.mouse.up();
  check((await field(page, "X position")) === 120 && (await field(page, "Y position")) === 160, "the cancelled drag must not move the layer afterwards");
  await page.keyboard.press("ArrowDown");
  check(await fieldIs("Y position", 161), "nudges work again after a blur");
  await undo();
  check(await fieldIs("Y position", 160), "undo the nudge");
  const menuOpened = await canvas.evaluate((c) => c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })));
  check(menuOpened === false, "right-click on the canvas must not open the browser's menu");

  log("a second pointer can't take over a drag");
  await page.mouse.move(heroAt.x, heroAt.y);
  await page.mouse.down();
  await page.mouse.move(heroAt.x + 30, heroAt.y, { steps: 4 });
  await pointerEvent("pointerdown", heroAt.x + 400, heroAt.y + 200, { pointerId: 7, pointerType: "touch", buttons: 1, isPrimary: false });
  await pointerEvent("pointermove", heroAt.x + 500, heroAt.y + 300, { pointerId: 7, pointerType: "touch", buttons: 1, isPrimary: false });
  await pointerEvent("pointerup", heroAt.x + 500, heroAt.y + 300, { pointerId: 7, pointerType: "touch", buttons: 0, isPrimary: false });
  await page.mouse.move(heroAt.x + 60, heroAt.y, { steps: 4 });
  await page.mouse.up();
  const heroNow = { x: await field(page, "X position"), y: await field(page, "Y position") };
  check(near(heroNow.x, 120 + 60 / m.z, tol) && heroNow.y === 160, `only the first pointer drives the drag, got (${heroNow.x}, ${heroNow.y})`);
  await undo();
  check(await fieldIs("X position", 120), "the drag is one undo step");

  log("clicking a handle without dragging keeps the selection");
  await clickWorld(400, 320);
  const eh = await handlePoint("e");
  await page.mouse.click(eh.x + 4, eh.y); // just outside Hero's right edge, over Desktop
  check((await selectedName()) === "Hero", `a click on a handle should keep Hero selected, got ${await selectedName()}`);

  log("Escape between the press and the drag drops the press");
  await page.keyboard.press("Escape");
  const avatarCentre = m.toScreen(1248, 88);
  await page.mouse.move(avatarCentre.x, avatarCentre.y);
  await page.mouse.down();
  check((await selectedName()) === "Avatar", "pressing on Avatar selects it");
  await page.keyboard.press("Escape");
  await page.mouse.move(avatarCentre.x + 60, avatarCentre.y, { steps: 6 });
  await page.mouse.up();
  check((await selectedName()) === null, `Escape should clear the selection, got ${await selectedName()}`);
  check((await box4("Avatar")).x === 1200, `Avatar must not move after Escape, got X ${await field(page, "X position")}`);

  log("handles sit on the layers a resize changes (a parent and its child both selected)");
  await layerRow(page, "Hero").click();
  await setField(page, "X position", 1200); // Hero now sticks out of Desktop on the right
  await layerRow(page, "Desktop").click();
  await layerRow(page, "Hero").click({ modifiers: ["ControlOrMeta"] });
  check((await selectedName()) === "Desktop,Hero", `Desktop and Hero should both be selected, got ${await selectedName()}`);
  const dRect = await selectionRect();
  check(near(dRect.width, 1440 * m.z, 1), `the handle box should be Desktop's (the layer a resize changes), ${dRect.width} px wide vs ${1440 * m.z}`);
  const seH = await handlePoint("se");
  await drag(page, seH.x, seH.y, seH.x + 50, seH.y);
  const after7 = await selectionRect();
  check(near(after7.x + after7.width, seH.x + 50, 2), `the box edge should follow the pointer, edge ${after7.x + after7.width} vs pointer ${seH.x + 50}`);
  check(near((await box4("Desktop")).w, 1440 + 50 / m.z, tol), `Desktop should grow by ${50 / m.z}`);
  await undo();
  check(await fieldIs("Width", 1440), "undo the resize");
  await layerRow(page, "Hero").click();
  await undo();
  check(await fieldIs("X position", 120), "undo the X edit");

  log("⌘D in a Properties field never reaches the browser (bookmark dialog) and duplicates nothing");
  await page.evaluate(() => {
    globalThis.__dPrevented = null;
    window.addEventListener("keydown", (e) => e.key.toLowerCase() === "d" && (globalThis.__dPrevented = e.defaultPrevented));
  });
  const layersBefore = await layerRows(page).count();
  await page.getByLabel("X position").focus();
  await page.keyboard.press("ControlOrMeta+d");
  check((await page.evaluate(() => globalThis.__dPrevented)) === true, "⌘D in a field should be prevented");
  check((await layerRows(page).count()) === layersBefore, "⌘D in a field must not duplicate");
  await page.keyboard.press("Escape");

  log("Shift-click in the Layers panel selects a range; ⌘-click toggles");
  await layerRow(page, "Desktop").click();
  await layerRow(page, "Hero").click({ modifiers: ["Shift"] });
  check((await selectedName()) === "Desktop,Avatar,Hero", `Shift-click should select Desktop through Hero, got ${await selectedName()}`);
  await layerRow(page, "Avatar").click({ modifiers: ["ControlOrMeta"] });
  check((await selectedName()) === "Desktop,Hero", `⌘-click should remove Avatar, got ${await selectedName()}`);
  await page.keyboard.press("Escape");

  // ---- layout wired into editing: constraints, auto layout reorder, ⌘D, delete ----

  log("layout: a fresh file with an auto layout card");
  await createFile(page, url);
  m = await mapping(); // Desktop at (0, 0); Card (vertical auto layout) at 120, 560: Image 24, Title 160, Button 200
  const card = await box4("Card");
  check(card.x === 120 && card.y === 560 && card.w === 320 && card.h === 264, `the sample card should be laid out at 120, 560, 320 × 264, got ${JSON.stringify(card)}`);
  check((await box4("Title")).y === 160 && (await box4("Button")).y === 200, "the card's children should be stacked by auto layout");
  const lt = Math.max(1, 1.5 / m.z);

  log("resizing a frame: a child pinned right follows; ⌘/Ctrl-resize leaves it");
  await layerRow(page, "Desktop").click();
  let eh2 = await handlePoint("e");
  await drag(page, eh2.x, eh2.y, eh2.x + 80, eh2.y);
  const grown = await field(page, "Width");
  check(near(grown, 1440 + 80 / m.z, lt), `Desktop should grow by ${80 / m.z}, got W ${grown}`);
  check(near((await box4("Avatar")).x, 1200 + (grown - 1440), 0.01), `Avatar (pinned right) should move with the right edge to ${1200 + (grown - 1440)}, got ${await field(page, "X position")}`);
  check((await box4("Hero")).x === 120, "Hero (pinned left) stays");
  await undo();
  check(await eventually(async () => (await box4("Avatar")).x === 1200, 2_000), "one undo puts Avatar back with the frame");
  check((await box4("Desktop")).w === 1440, "…and Desktop's width");
  eh2 = await handlePoint("e");
  await page.keyboard.down("ControlOrMeta");
  await drag(page, eh2.x, eh2.y, eh2.x + 80, eh2.y);
  await page.keyboard.up("ControlOrMeta");
  check(near(await field(page, "Width"), 1440 + 80 / m.z, lt), "⌘-resize still resizes the frame");
  check((await box4("Avatar")).x === 1200, `⌘-resize ignores constraints: Avatar stays at 1200, got ${await field(page, "X position")}`);
  await undo();
  check(await eventually(async () => (await box4("Desktop")).w === 1440, 2_000), "undo the ⌘-resize");
  if (process.platform === "darwin") {
    // macOS: only ⌘ skips constraints; Ctrl is kept for suspending snapping.
    eh2 = await handlePoint("e");
    await page.keyboard.down("Control");
    await drag(page, eh2.x, eh2.y, eh2.x + 80, eh2.y);
    await page.keyboard.up("Control");
    const w = await field(page, "Width");
    check(near(w, 1440 + 80 / m.z, lt), `Ctrl-resize resizes, got W ${w}`);
    check(near((await box4("Avatar")).x, 1200 + (w - 1440), 0.01), `on macOS Ctrl-resize keeps constraints: Avatar follows to ${1200 + (w - 1440)}, got ${await field(page, "X position")}`);
    await undo();
    check(await eventually(async () => (await box4("Desktop")).w === 1440, 2_000), "undo the Ctrl-resize");
  }

  log("dragging a child of the auto layout card reorders it, with an insertion line");
  await layerRow(page, "Title").click();
  const titleAt = m.toScreen(244, 732);
  const dropAt = m.toScreen(244, 820); // below the Button's centre (780)
  await page.mouse.move(titleAt.x, titleAt.y);
  await page.mouse.down();
  await page.mouse.move((titleAt.x + dropAt.x) / 2, (titleAt.y + dropAt.y) / 2, { steps: 6 });
  await page.mouse.move(dropAt.x, dropAt.y, { steps: 6 });
  check(await eventually(() => page.locator(".insert-line").isVisible(), 2_000), "an insertion line should show while dragging");
  await page.screenshot({ path: `${outDir}/canvas-reorder.png` });
  check((await field(page, "Y position")) === 160, "nothing moves in the document until the drop");
  await page.mouse.up();
  check(await eventually(async () => (await field(page, "Y position")) === 216, 2_000), `Title should land after Button (Y 216), got ${await field(page, "Y position")}`);
  check(await eventually(async () => !(await page.locator(".insert-line").isVisible()), 2_000), "the insertion line hides after the drop");
  const cardRows = async () => {
    const all = (await layerRows(page).allInnerTexts()).map((t) => t.trim());
    return all.slice(all.indexOf("Card") + 1, all.indexOf("Card") + 4).join(",");
  };
  check((await cardRows()) === "Title,Button,Image", `the Layers panel should show the new order (top = last), got ${await cardRows()}`);
  check((await box4("Button")).y === 160, "Button moves up into Title's place");
  check((await box4("Title")).x === 24, "Title keeps the card's padding: it was reordered, not moved freely");
  await undo();
  check(await eventually(async () => (await box4("Title")).y === 160, 2_000), "one undo restores the order");
  check((await cardRows()) === "Button,Title,Image", `…and the Layers panel order, got ${await cardRows()}`);

  log("Escape during a reorder drag cancels it");
  await layerRow(page, "Title").click();
  await page.mouse.move(titleAt.x, titleAt.y);
  await page.mouse.down();
  await page.mouse.move(dropAt.x, dropAt.y, { steps: 8 });
  check(await eventually(() => page.locator(".insert-line").isVisible(), 2_000), "the insertion line shows");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  check((await cardRows()) === "Button,Title,Image", `Escape keeps the order, got ${await cardRows()}`);
  check(await eventually(async () => !(await page.locator(".insert-line").isVisible()), 2_000), "the insertion line hides on Escape");

  log("dragging a child far outside its auto layout frame shows no line, and dropping changes nothing");
  await layerRow(page, "Title").click();
  const farAt = m.toScreen(900, 700); // well right of the card (120–440)
  await page.mouse.move(titleAt.x, titleAt.y);
  await page.mouse.down();
  await page.mouse.move(dropAt.x, dropAt.y, { steps: 6 });
  check(await eventually(() => page.locator(".insert-line").isVisible(), 2_000), "inside the card the line shows");
  await page.mouse.move(farAt.x, farAt.y, { steps: 8 });
  check(await eventually(async () => !(await page.locator(".insert-line").isVisible()), 2_000), "far outside the card the line hides");
  await page.mouse.up();
  check((await cardRows()) === "Button,Title,Image", `dropping outside keeps the order, got ${await cardRows()}`);
  check((await box4("Title")).y === 160, "Title stays in its slot");

  log("⌘D inside auto layout puts the copy right after the original");
  await layerRow(page, "Title").click();
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+d");
  check(await eventually(async () => (await field(page, "Y position")) === 200, 2_000), `the copy should sit right after Title (Y 200), got ${await field(page, "Y position")}`);
  check((await box4("Button")).y === 240, "Button moves down to make room");
  check((await box4("Card")).h === 304, "the card grows (Hug)");
  await undo();
  check(await eventually(async () => (await box4("Card")).h === 264, 2_000), "one undo removes the copy and shrinks the card");

  log("resizing a child's edge in auto layout reflows the card");
  await layerRow(page, "Image").click();
  const sh = await handlePoint("s");
  await drag(page, sh.x, sh.y, sh.x, sh.y + 40);
  const imageH = await field(page, "Height");
  check(near(imageH, 120 + 40 / m.z, lt), `Image should get taller by ${40 / m.z}, got ${imageH}`);
  check((await box4("Title")).y === 160 + (imageH - 120), `Title moves down with it, got ${await field(page, "Y position")}`);
  check((await box4("Card")).h === 264 + (imageH - 120), "the card grows with it");
  await undo();
  check(await eventually(async () => (await box4("Card")).h === 264, 2_000), "one undo restores the card");

  log("Delete inside auto layout closes the gap");
  await layerRow(page, "Title").click();
  await canvas.focus();
  await page.keyboard.press("Delete");
  check(await eventually(async () => (await box4("Button")).y === 160, 2_000), `Button should move up to Y 160, got ${await field(page, "Y position")}`);
  await undo();
  check(await eventually(async () => (await box4("Button")).y === 200, 2_000), "undo brings Title back and the layout with it");
  await page.screenshot({ path: `${outDir}/canvas-layout.png` });

  log("arrow keys reorder a child of the auto layout card");
  await layerRow(page, "Image").click();
  await canvas.focus();
  await page.keyboard.press("ArrowDown");
  check(await eventually(async () => (await field(page, "Y position")) === 64, 2_000), `↓ should move Image after Title (Y 64), got ${await field(page, "Y position")}`);
  check((await field(page, "X position")) === 24, "the arrow reorders instead of nudging");
  await undo();
  check(await eventually(async () => (await field(page, "Y position")) === 24, 2_000), "undo the reorder");
  await context.close();
});
