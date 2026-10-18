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

  // A selection made elsewhere scrolls its row into view: delete the last layer, scroll to the top, undo (which reselects it).
  await page.keyboard.press("End");
  await page.keyboard.press("Delete");
  await poll(async () => (await total()) === 12_288, "Delete should remove the last layer", 10_000);
  await toTop();
  await page.keyboard.press("ControlOrMeta+z");
  const back = selected();
  check(
    await eventually(async () => (await total()) === 12_289 && (await back.count()) === 1 && (await back.getAttribute("aria-label")) === lastLabel && (await inView(back))),
    "undo reselects the layer and the list scrolls to it",
  );
});
