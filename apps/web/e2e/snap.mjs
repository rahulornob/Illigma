// Snapping, smart guides, drop onto a frame, ⌥-drag, ⌘D repeat, ⌥ measurements
// and zoom shortcuts (interactions.md §2, §4, §8).
//
// Three rectangles are placed below the Desktop frame: A (0, 1000, 100 × 100),
// B (300, 1000, 100 × 100) and C (600, 1200, 50 × 50). Screen ↔ world comes
// from the selection overlay, as in canvas.mjs.
//
// Usage (from the repo root):  node apps/web/e2e/snap.mjs [--headed] [--no-build]

import { createFile, eventually, field, layerRow, layerRows, newContext, runE2E, selectedRows, setField, watchErrors } from "./lib.mjs";

await runE2E("snap", {}, async ({ browser, url, log, check, errors }) => {
  const context = await newContext(browser, { snap: true });
  const page = await context.newPage();
  watchErrors(page, errors);
  const canvas = page.locator("canvas.canvas");
  const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const zoomText = async () => Number((await page.locator(".zoom-value").innerText()).replace("%", ""));
  const selectionRect = async () => {
    await frame();
    return page.evaluate(() => {
      const el = document.querySelector(".selection-box");
      if (!el || el.style.display === "none") return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
    });
  };
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");
  const xy = async () => ({ x: await field(page, "X position"), y: await field(page, "Y position") });
  const depth = async (name) => parseInt(((await layerRow(page, name).getAttribute("style")) ?? "").match(/padding-left:\s*(\d+)/)?.[1] ?? "8", 10);
  const undo = async () => {
    await canvas.focus();
    await page.keyboard.press("ControlOrMeta+z");
  };

  /** World ↔ screen from a layer whose world rect is known (selected through the Layers panel). */
  async function mapping(name, wx, wy, ww) {
    await layerRow(page, name).click();
    const r = await selectionRect();
    check(r, `selecting ${name} should show the selection box`);
    const z = r.width / ww;
    const ox = r.x - wx * z;
    const oy = r.y - wy * z;
    return { z, toScreen: (x, y) => ({ x: ox + x * z, y: oy + y * z }) };
  }

  log("open a new file and place three rectangles below Desktop");
  await createFile(page, url);
  const names = [];
  for (const [x, y, w, h] of [
    [0, 1000, 100, 100],
    [300, 1000, 100, 100],
    [600, 1200, 50, 50],
  ]) {
    await canvas.focus();
    await page.keyboard.press("r");
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width - 60, box.y + box.height - 60);
    names.push(await selectedName());
    await setField(page, "X position", x);
    await setField(page, "Y position", y);
    await setField(page, "Width", w);
    await setField(page, "Height", h);
  }
  const [A, B, C] = names;
  check(new Set(names).size === 3, `three new rectangles, got ${names.join(", ")}`);
  await canvas.focus();
  await page.keyboard.press("Shift+1");
  await frame();
  let m = await mapping(A, 0, 1000, 100);
  const thr = 4 / m.z; // the snap distance in page units

  /** Press on world (x1, y1), move to (x2, y2), then run `during` before letting go. */
  async function dragWorld(x1, y1, x2, y2, during, mods = [], held = []) {
    const p = m.toScreen(x1, y1);
    const q = m.toScreen(x2, y2);
    await page.mouse.move(p.x, p.y);
    for (const k of held) await page.keyboard.down(k);
    await page.mouse.down();
    await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 4 });
    for (const k of mods) await page.keyboard.down(k);
    await page.mouse.move(q.x, q.y, { steps: 6 });
    if (during) await during();
    await page.mouse.up();
    for (const k of [...mods, ...held]) await page.keyboard.up(k);
  }

  log("moving C near B's right edge snaps to it and shows a guide");
  await layerRow(page, C).click();
  let guide = false;
  // C's left edge to 400 + 0.6 thr (inside the snap distance); y level with B's top + a bit.
  await dragWorld(625, 1225, 625 + (400 + thr * 0.6 - 600), 1225 + (1000 + thr * 0.5 - 1200), async () => {
    guide = await eventually(() => page.locator(".snap-guides .snap-line").first().isVisible(), 2_000);
  });
  check(guide, "a smart guide shows while the edges line up");
  let p = await xy();
  check(near(p.x, 400) && near(p.y, 1000), `C should snap to (400, 1000), got (${p.x}, ${p.y})`);
  check(await eventually(async () => (await page.locator(".snap-guides > *").count()) === 0, 2_000), "guides go away on release");
  await undo();
  check(await eventually(async () => near((await xy()).x, 600), 2_000), "one undo puts C back");

  log("Ctrl suspends snapping");
  await dragWorld(625, 1225, 625 + (400 + thr * 0.6 - 600), 1225, null, ["Control"]);
  p = await xy();
  check(!near(p.x, 400) && Number.isInteger(p.x), `with Ctrl held C stays off the edge on whole pixels, got X ${p.x}`);
  await undo();
  await eventually(async () => near((await xy()).x, 600), 2_000);

  log("equal spacing: C centred between A and B, with gap pills");
  let pills = [];
  await dragWorld(625, 1225, 200 + thr * 0.5, 1025, async () => {
    await frame();
    pills = await page.locator(".snap-guides .snap-pill").allInnerTexts();
  });
  p = await xy();
  check(near(p.x, 175) && near(p.y, 1000), `C should centre between A and B at (175, 1000), got (${p.x}, ${p.y})`);
  check(pills.filter((t) => t === "75").length >= 2, `two gap pills of 75 should show, got [${pills.join(", ")}]`);
  await undo();
  await eventually(async () => near((await xy()).x, 600), 2_000);

  log("resizing A's right edge snaps to B's left edge");
  await layerRow(page, A).click();
  const e = m.toScreen(100, 1050);
  await page.mouse.move(e.x, e.y);
  await page.mouse.down();
  const to = m.toScreen(300 - thr * 0.6, 1050);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  check(await eventually(async () => near(await field(page, "Width"), 300), 2_000), `A should be 300 wide, got ${await field(page, "Width")}`);
  await undo();
  check(await eventually(async () => near(await field(page, "Width"), 100), 2_000), "one undo resizes A back");

  log("⌥ hover measures from the selection to another layer");
  await layerRow(page, A).click();
  const overB = m.toScreen(350, 1050);
  await page.mouse.move(overB.x, overB.y);
  await page.keyboard.down("Alt");
  await page.mouse.move(overB.x + 2, overB.y + 2);
  const measured = await eventually(async () => (await page.locator(".snap-guides .snap-pill").allInnerTexts()).includes("200"), 2_000);
  await page.keyboard.up("Alt");
  check(measured, "the distance between A and B (200) shows");
  check(await eventually(async () => (await page.locator(".snap-guides > *").count()) === 0, 2_000), "letting go of ⌥ hides it");

  log("dropping C onto Desktop reparents it, page position kept, one undo step");
  m = await mapping(C, 600, 1200, 50);
  await layerRow(page, C).click();
  let outlined = false;
  // Desktop: (0, 0) at least 1440 wide; drop C at about (1000, 600).
  await dragWorld(625, 1225, 1025, 625, async () => {
    outlined = await eventually(() => page.locator(".drop-target").isVisible(), 2_000);
  });
  check(outlined, "Desktop shows the drop-target outline");
  check(await eventually(async () => (await depth(C)) > 8, 2_000), "C is now inside Desktop in the Layers panel");
  p = await xy();
  check(Math.abs(p.x - 1000) <= 2 * thr && Math.abs(p.y - 600) <= 2 * thr, `C keeps its page position (about 1000, 600), got (${p.x}, ${p.y})`);
  await undo();
  check(await eventually(async () => (await depth(C)) === 8, 2_000), "one undo puts C back on the page");
  check(await eventually(async () => near((await xy()).x, 600) && near((await xy()).y, 1200), 2_000), "…where it was");

  log("a layer larger than the frame never drops into it");
  await layerRow(page, A).click();
  await setField(page, "Width", 2000);
  m = await mapping(A, 0, 1000, 2000);
  await dragWorld(50, 1050, 50, 500);
  check((await depth(A)) === 8, "A (2000 wide) stays on the page over Desktop");
  await undo();
  await undo();
  m = await mapping(C, 600, 1200, 50);

  log("Space keeps the current parent");
  await layerRow(page, C).click();
  await dragWorld(625, 1225, 1025, 625, null, ["Space"]);
  check((await depth(C)) === 8, "with Space held C stays on the page");
  await undo();
  await eventually(async () => near((await xy()).x, 600), 2_000);

  log("dragging a layer out of a frame puts it on the page");
  await layerRow(page, "Hero").click();
  const hero = await xy(); // Hero inside Desktop (Desktop at 0, 0)
  await dragWorld(hero.x + 20, hero.y + 20, 1480, 1150);
  check(await eventually(async () => (await depth("Hero")) === 8, 2_000), "Hero is on the page");
  await undo();
  check(await eventually(async () => (await depth("Hero")) > 8, 2_000), "one undo puts Hero back in Desktop");

  log("⌥-drag duplicates; ⌘D after it repeats the offset");
  await layerRow(page, C).click();
  const count = await layerRows(page).count();
  await dragWorld(625, 1225, 625 + 120, 1225, null, [], ["Alt"]);
  check(await eventually(async () => (await layerRows(page).count()) === count + 1, 2_000), "⌥-drag adds one layer");
  p = await xy();
  check(near(p.x, 720), `the copy is selected and moved 120 right, at X ${p.x}`);
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+d");
  check(await eventually(async () => (await layerRows(page).count()) === count + 2, 2_000), "⌘D adds another");
  check(await eventually(async () => near((await xy()).x, 840), 2_000), `⌘D repeats the 120 px step, got X ${(await xy()).x}`);
  await undo();
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === count, 2_000), "two undos remove both copies");
  await layerRow(page, C).click();
  check(near((await xy()).x, 600), "the original never moved");

  log("zoom shortcuts");
  await canvas.focus();
  await page.keyboard.press("Shift+0");
  check(await eventually(async () => (await zoomText()) === 100, 2_000), "Shift+0 zooms to 100%");
  await page.keyboard.press("ControlOrMeta+=");
  check(await eventually(async () => (await zoomText()) === 200, 2_000), "⌘+ steps to 200%");
  await page.keyboard.press("ControlOrMeta+-");
  await page.keyboard.press("ControlOrMeta+-");
  check(await eventually(async () => (await zoomText()) === 50, 2_000), "⌘− steps to 50%");
  await page.keyboard.press("ControlOrMeta+0");
  check(await eventually(async () => (await zoomText()) === 100, 2_000), "⌘0 zooms to 100%");
  await page.keyboard.press("Shift+1");
  const fitZoom = await zoomText();
  check(fitZoom < 100, `Shift+1 fits everything (zoom ${fitZoom}%)`);
  await layerRow(page, C).click();
  await canvas.focus();
  await page.keyboard.press("Shift+2");
  await eventually(async () => (await zoomText()) > fitZoom, 2_000);
  const sel = await selectionRect();
  const cb = await canvas.boundingBox();
  check(sel && near(sel.x + sel.width / 2, cb.x + cb.width / 2, 2) && near(sel.y + sel.height / 2, cb.y + cb.height / 2, 2), "Shift+2 centres the selection");
  check(sel && (sel.width >= cb.width - 140 || sel.height >= cb.height - 140), "…and fills the view");

  log("⌘/Ctrl + wheel zooms around the pointer; a plain wheel pans");
  const before = await selectionRect();
  const z0 = await zoomText();
  await page.mouse.move(cb.x + 200, cb.y + 200);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  check(await eventually(async () => (await zoomText()) < z0, 2_000), "Ctrl + wheel zooms out");
  const z1 = await zoomText();
  const s1 = await selectionRect();
  await page.mouse.wheel(0, 120);
  await frame();
  const s2 = await selectionRect();
  check((await zoomText()) === z1, "a plain wheel keeps the zoom");
  check(s1 && s2 && s2.y < s1.y - 20 && near(s2.x, s1.x, 1), `a plain wheel pans up the page, moved (${s2.x - s1.x}, ${s2.y - s1.y})`);
  check(before !== null, "the selection stayed");
});
