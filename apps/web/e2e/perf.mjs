// Editing performance with a big page (QC round 6): the sample file grown to
// 12,289 layers inside one frame (select Hero, then ⌘A + ⌘D eleven times),
// then frame times while dragging Hero and while resizing Desktop by its
// edge. Checks the Layers panel only renders the rows in view, and that
// frame times stay inside a generous budget (scaled by E2E_TIMEOUT_SCALE).
//
// Usage (from the repo root):  node apps/web/e2e/perf.mjs [--headed] [--no-build]
// Prints the measured p50 and p95 frame times.

import { T, createFile, eventually, layerRow, layerRows, newContext, poll, runE2E, watchErrors } from "./lib.mjs";

await runE2E("perf", {}, async ({ browser, url, log, check, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  await createFile(page, url);
  /** Layers on the page: the Layers panel's row count (its tree knows it even when only some rows are drawn). */
  const total = () =>
    page.evaluate(() => {
      const list = document.querySelector(".layer-list");
      return Number(list?.getAttribute("data-rows") ?? document.querySelectorAll(".layer-list .layer-row").length);
    });

  log("grow the sample to 12,289 layers inside Desktop (⌘A + ⌘D × 11)");
  await layerRow(page, "Hero").click();
  let expected = await total();
  check(expected === 7, `the sample file should have 7 layers, found ${expected}`);
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+d");
    expected = 1 + (expected - 1) * 2;
    const want = expected;
    await poll(async () => (await total()) === want, `⌘D should double the layers inside Desktop to ${want}`, 30_000);
  }
  check(expected === 12_289, `expected 12,289 layers, got ${expected}`);
  const rendered = await layerRows(page).count();
  console.log(`  ${expected} layers, ${rendered} rows rendered in the Layers panel`);

  /** Frame times (ms between animation frames) while `fn` runs. */
  async function frameTimes(fn) {
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__frames = [];
      w.__recording = true;
      const tick = (t) => {
        if (!w.__recording) return;
        w.__frames.push(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await fn();
    const stamps = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__recording = false;
      return w.__frames;
    });
    const deltas = stamps.slice(1).map((t, i) => t - stamps[i]);
    deltas.sort((a, b) => a - b);
    const at = (q) => deltas[Math.min(deltas.length - 1, Math.floor(q * deltas.length))] ?? 0;
    return { frames: deltas.length, p50: at(0.5), p95: at(0.95), max: deltas.at(-1) ?? 0 };
  }

  /** Drag with the mouse in `steps` moves, one awaited move at a time. */
  async function slowDrag(x1, y1, x2, y2, steps = 60) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await page.mouse.up();
  }

  const selectionBox = async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(() => {
      const el = document.querySelector(".selection-box");
      const r = el?.getBoundingClientRect();
      return r && el.style.display !== "none" ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    });
  };

  log("drag Hero (one of 12,288 layers in Desktop)");
  await page.keyboard.press("Escape");
  await layerRow(page, "Hero").first().click();
  const hero = await selectionBox();
  check(hero, "selecting Hero should show the selection box");
  const cx = hero.x + hero.width / 2;
  const cy = hero.y + hero.height / 2;
  const move = await frameTimes(() => slowDrag(cx, cy, cx + 120, cy + 60));
  console.log(`  move Hero: ${move.frames} frames, p50 ${move.p50.toFixed(1)} ms, p95 ${move.p95.toFixed(1)} ms, max ${move.max.toFixed(1)} ms`);

  log("resize Desktop by its right edge");
  await page.locator(".layer-list").evaluate((el) => el.closest(".panel-grow")?.scrollTo(0, 0)); // the list followed Hero; Desktop is at the top
  await layerRow(page, "Desktop").click();
  const desk = await selectionBox();
  check(desk, "selecting Desktop should show the selection box");
  const ex = desk.x + desk.width;
  const ey = desk.y + desk.height / 2;
  const resize = await frameTimes(() => slowDrag(ex, ey, ex + 150, ey));
  console.log(`  resize Desktop: ${resize.frames} frames, p50 ${resize.p50.toFixed(1)} ms, p95 ${resize.p95.toFixed(1)} ms, max ${resize.max.toFixed(1)} ms`);

  check(rendered < 200, `the Layers panel should render only the rows in view, rendered ${rendered} of ${expected}`);
  // Generous budgets: the point is to catch a return to whole-panel re-renders and whole-frame recording
  // (p95 133–183 ms before QC round 6), not to measure the machine.
  check(move.p95 <= T(70), `moving Hero: p95 frame time ${move.p95.toFixed(1)} ms should be at most ${T(70)} ms`);
  check(resize.p95 <= T(100), `resizing Desktop: p95 frame time ${resize.p95.toFixed(1)} ms should be at most ${T(100)} ms`);

  log("the virtualised Layers panel: keyboard, ranges, scroll to the selection");
  const selected = () => page.locator('.layer-list .layer-row[aria-selected="true"]');
  /** Is the row on screen inside the Layers panel's scroll area? */
  const inView = (row) =>
    row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = el.closest(".panel-grow").getBoundingClientRect();
      return r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
    });
  const toTop = () => page.locator(".layer-list").evaluate((el) => el.closest(".panel-grow")?.scrollTo(0, 0));
  await page.keyboard.press("Escape");
  await toTop();
  await layerRow(page, "Desktop").click();
  check((await layerRow(page, "Desktop").getAttribute("tabindex")) === "0", "the clicked row takes Tab focus (roving tabindex)");
  await page.keyboard.press("ArrowDown");
  check(await eventually(async () => (await selected().count()) === 1 && (await selected().getAttribute("aria-level")) === "2"), "↓ selects the first layer inside Desktop");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  check(await eventually(async () => (await selected().count()) === 3), `Shift+↓ twice extends the selection to 3 rows, got ${await selected().count()}`);
  check(await page.evaluate(() => document.activeElement?.getAttribute("role") === "treeitem"), "focus stays on a row");

  await page.keyboard.press("End");
  const last = layerRows(page).last();
  check(await eventually(async () => (await last.getAttribute("aria-selected")) === "true" && (await inView(last))), "End selects the last of 12,289 rows and scrolls it into view");
  check((await last.getAttribute("aria-posinset")) === (await last.getAttribute("aria-setsize")), "the last row is the last of its siblings");
  const lastLabel = await last.getAttribute("aria-label");
  await page.keyboard.press("Home");
  check(await eventually(async () => (await selected().getAttribute("aria-label")) === "Desktop, frame"), "Home selects the first row");

  // Shift-click a range: a row, then another five below it.
  await layerRows(page).nth(3).click();
  await layerRows(page).nth(8).click({ modifiers: ["Shift"] });
  check(await eventually(async () => (await selected().count()) === 6), `Shift-click selects the 6 rows between, got ${await selected().count()}`);

  // QC round 7: a selection made in the list keeps the row the user is on in view (a range's last row is its
  // bottom one, which may be far away), and keyboard focus stays in the list.
  const focused = () => page.locator('.layer-list .layer-row:focus');
  const focusInTree = () => page.evaluate(() => document.activeElement?.getAttribute("role") === "treeitem");
  const scrollTop = () => page.locator(".layer-list").evaluate((el) => el.closest(".panel-grow").scrollTop);
  await page.keyboard.press("Home");
  for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 40; i++) await page.keyboard.press("Shift+ArrowUp");
  check(await eventually(async () => (await selected().count()) === 41), `Shift+↑ × 40 selects 41 rows, got ${await selected().count()}`);
  check((await focusInTree()) && (await inView(focused())), "after Shift+↑ × 40 the focused row is on screen and keeps focus");

  // Shift-click upward with the anchor off-screen: the clicked row stays where it is.
  for (let i = 0; i < 100; i++) await page.keyboard.press("ArrowDown");
  await toTop();
  await layerRow(page, "Desktop").click({ modifiers: ["Shift"] });
  // Only the rows in view (plus a margin) are in the DOM: here all of them are in the range.
  const allRendered = async () => (await selected().count()) === (await layerRows(page).count());
  check(await eventually(async () => (await allRendered()) && (await layerRow(page, "Desktop").getAttribute("aria-selected")) === "true"), `Shift-click upward selects the range, got ${await selected().count()} rendered rows selected`);
  check((await scrollTop()) === 0 && (await inView(layerRow(page, "Desktop"))), "Shift-click upward leaves the clicked row in view");
  // ⌘-click to deselect a row: the list doesn't jump to another selected row.
  const before = await selected().count();
  await layerRows(page).nth(2).click({ modifiers: ["ControlOrMeta"] });
  check(await eventually(async () => (await selected().count()) === before - 1), "⌘-click deselects the row");
  check((await scrollTop()) === 0, "⌘-click deselect doesn't scroll the list");

  // Shift+Home from far down: focus stays in the list, so the next ↓ moves in the list instead of nudging the canvas.
  await page.keyboard.press("Home");
  for (let i = 0; i < 20; i++) await page.keyboard.press("PageDown");
  const farIndex = await focused().evaluate((el) => Math.round(parseFloat(el.style.top) / el.offsetHeight));
  check(farIndex >= 300, `PageDown × 20 should reach row 300 or further, got ${farIndex}`);
  await page.keyboard.press("Shift+Home");
  check(await eventually(async () => (await allRendered()) && (await selected().count()) > 20), `Shift+Home selects every row up to the top, got ${await selected().count()} rendered rows selected`);
  check(await eventually(async () => (await focusInTree()) && (await focused().getAttribute("aria-label")) === "Desktop, frame" && (await inView(focused()))), "after Shift+Home the first row is focused and on screen");
  await page.keyboard.press("ArrowDown");
  check(
    await eventually(async () => (await focusInTree()) && (await selected().count()) === 1 && (await selected().getAttribute("aria-level")) === "2"),
    `after Shift+Home, ↓ moves in the list (got ${await selected().count()} selected, focus in list: ${await focusInTree()})`,
  );

  // A selection made elsewhere scrolls its row into view: delete the last layer, scroll to the top, undo (which reselects it).
  // Deleting the focused row moves focus to the row before it (it was the last), not to <body>.
  await page.keyboard.press("End");
  await page.keyboard.press("Delete");
  await poll(async () => (await total()) === 12_288, "Delete should remove the last layer", 10_000);
  check(await eventually(async () => (await focusInTree()) && (await inView(focused()))), "after Delete, focus moves to the previous row (the deleted one was last)");
  await toTop();
  await page.keyboard.press("ControlOrMeta+z");
  const back = selected();
  check(
    await eventually(async () => (await total()) === 12_289 && (await back.count()) === 1 && (await back.getAttribute("aria-label")) === lastLabel && (await inView(back))),
    "undo reselects the layer and the list scrolls to it",
  );
});
