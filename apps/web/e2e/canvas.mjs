// Canvas interaction: click-to-select (checked against the Layers panel),
// click on empty canvas to deselect, drawing Frame / Rectangle / Ellipse at
// several zoom levels (world coordinates read back from the Properties
// panel), Space-drag panning, and shortcuts staying quiet while typing.
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
  await context.close();
});
