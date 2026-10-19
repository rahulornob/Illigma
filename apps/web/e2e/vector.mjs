// Vector tools (interactions.md §7): the pen (corners, a dragged curve,
// closing on the first point, Enter to finish an open path, ⌫ removing the
// last point), Line (L) and Arrow (⇧L), Polygon and Star from the shapes
// flyout with their count and ratio, vector edit mode on a rectangle (Enter
// converts it; dragging a point re-fits the box; Escape leaves; one undo
// step per drag), Subtract from the Properties panel, Flatten (⌘E) and
// Outline stroke (⌥⌘O). What was made is checked on disk.
//
// Usage (from the repo root):  node apps/web/e2e/vector.mjs [--headed] [--no-build]

import { createFile, eventually, field, layerRow, newContext, runE2E, selectedRows, setField, watchErrors } from "./lib.mjs";

await runE2E("vector", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  page.on("console", (m) => m.text().startsWith("V") && console.log("PAGE", m.text()));
  const props = page.getByRole("complementary", { name: "Properties" });
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");
  const mode = async () => {
    await frame();
    return page.evaluate(() => document.querySelector(".vector-overlay")?.getAttribute("data-mode") ?? null);
  };

  const disk = (fileId) =>
    page.evaluate(async (id) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
      const read = async (d, name) => (await (await d.getFileHandle(name)).getFile()).text();
      const manifest = JSON.parse(await read(dir, "manifest.json"));
      const pages = await dir.getDirectoryHandle("pages");
      const nodes = [];
      for (const p of manifest.pages) nodes.push(...JSON.parse(await read(pages, `${p.id}.json`)));
      return nodes;
    }, fileId);
  const saved = async (fileId, test, why) => {
    let last = [];
    const ok = await eventually(async () => {
      try {
        last = await disk(fileId);
      } catch {
        return false;
      }
      return test(last);
    }, 15_000);
    check(ok, `${why}; on disk: ${JSON.stringify(last.filter((n) => !["PAGE", "FRAME", "TEXT"].includes(n.type)).map((n) => [n.name, n.type]))}`);
    return last;
  };

  log("open a new file; map world to screen from the Desktop frame");
  const fileId = await createFile(page, url);
  await layerRow(page, "Desktop").click();
  await frame();
  const desk = await page.evaluate(() => {
    const r = document.querySelector(".selection-box").getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width };
  });
  const z = desk.w / 1440;
  const at = (wx, wy) => ({ x: desk.x + wx * z, y: desk.y + wy * z });
  const click = async (wx, wy) => {
    const p = at(wx, wy);
    await page.mouse.click(p.x, p.y);
  };
  const dragW = async (a, b, steps = 6) => {
    const p = at(...a);
    const q = at(...b);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps });
    await page.mouse.move(q.x, q.y, { steps });
    await page.mouse.up();
  };
  const canvas = page.locator("canvas.canvas");

  log("P, three corners, then the first point again: a closed path");
  await canvas.focus();
  await page.keyboard.press("p");
  check((await page.getByRole("button", { name: "Pen (P)" }).getAttribute("aria-pressed")) === "true", "P should pick the Pen");
  await click(800, 300);
  await click(1000, 300);
  await click(900, 450);
  check((await mode()) === "pen", `the overlay should show the path being drawn, got ${await mode()} ${await page.evaluate(() => document.querySelectorAll(".vector-overlay").length)}`);
  await click(800, 300);
  check(await eventually(async () => (await selectedName()).startsWith("Vector")), `closing the path should select the new vector, got "${await selectedName()}"`);
  check((await page.getByRole("button", { name: "Move (V)" }).getAttribute("aria-pressed")) === "true", "the Move tool should be back");
  check(Math.round(await field(page, "Width")) === 200 && Math.round(await field(page, "Height")) === 150, "the vector's box should fit its points (200 × 150)");
  const triangle = await selectedName();

  log("pen: a dragged curve, ⌫ removes the last point, Enter finishes an open path");
  await page.keyboard.press("p");
  await click(800, 600);
  await dragW([950, 650], [1000, 600]);
  await click(1100, 700);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  check(await eventually(async () => (await selectedName()).startsWith("Vector") && (await selectedName()) !== triangle), "Enter should finish the open path as a new vector");
  const curve = await selectedName();

  log("L draws a line, ⇧L an arrow");
  await canvas.focus();
  await page.keyboard.press("l");
  await dragW([800, 780], [1000, 780]);
  check(await eventually(async () => (await selectedName()) === "Line 1"), `L then a drag should make Line 1, got "${await selectedName()}"`);
  check(Math.round(await field(page, "Width")) === 200, "the line should be 200 long");
  await page.keyboard.press("Shift+L");
  await dragW([800, 830], [1000, 830]);
  check(await eventually(async () => (await selectedName()) === "Arrow 1"), `⇧L then a drag should make Arrow 1, got "${await selectedName()}"`);

  log("Polygon and Star from the shapes flyout; count and ratio in Properties");
  await page.getByRole("button", { name: "Shape tools" }).click();
  await page.getByRole("menuitemradio", { name: /Polygon/ }).click();
  await dragW([1150, 300], [1250, 400]);
  check(await eventually(async () => (await selectedName()) === "Polygon 1"), `a drag with Polygon should make Polygon 1, got "${await selectedName()}"`);
  await setField(page, "Count", 6);
  await page.getByRole("button", { name: "Shape tools" }).click();
  await page.getByRole("menuitemradio", { name: /Star/ }).click();
  await dragW([1150, 450], [1250, 550]);
  check(await eventually(async () => (await selectedName()) === "Star 1"), "a drag with Star should make Star 1");
  await setField(page, "Points", 7);
  await setField(page, "Ratio (percent)", 50);

  log("vector edit mode: Enter on a rectangle converts it; dragging a point re-fits the box");
  await canvas.focus();
  await page.keyboard.press("r");
  await dragW([1150, 620], [1250, 700]);
  check(await eventually(async () => /^Rectangle \d+$/.test(await selectedName())), "R then a drag should make a rectangle");
  const rect = await selectedName();
  await canvas.focus();
  await page.keyboard.press("Enter");
  check(await eventually(async () => (await mode()) === "edit"), "Enter on a rectangle should start vector edit mode");
  await dragW([1150, 620], [1130, 600]);
  await frame();
  check(Math.round(await field(page, "Width")) === 120 && Math.round(await field(page, "Height")) === 100, `dragging the top-left point out should grow the box to 120 × 100, got ${await field(page, "Width")} × ${await field(page, "Height")}`);
  check((await props.getByText("1 point").count()) === 1, "the Vector points card should count the selected point");
  await page.keyboard.press("ControlOrMeta+z");
  check(await eventually(async () => Math.round(await field(page, "Width")) === 100), "one undo should put the point back");
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await mode()) === ""), "Escape should leave vector edit mode");
  check((await selectedName()) === rect, "the converted vector should stay selected");

  log("Subtract: the polygon minus the star, from the Properties panel");
  await layerRow(page, "Polygon 1").click();
  await layerRow(page, "Star 1").click({ modifiers: ["Shift"] });
  await props.getByRole("button", { name: "Subtract selection" }).click();
  check(await eventually(async () => (await selectedName()) === "Subtract"), `Subtract should select the new boolean, got "${await selectedName()}"`);

  log("⌘E flattens the boolean; ⌥⌘O outlines the line's stroke");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+e");
  check(await eventually(async () => (await selectedName()) === "Subtract" && (await props.getByRole("button", { name: /Union selection/ }).count()) === 0), "⌘E should leave one flattened vector");
  await layerRow(page, "Line 1").click();
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+Alt+o");
  await page.waitForTimeout(500);

  log("everything is on disk");
  await saved(
    fileId,
    (nodes) => {
      const by = (name) => nodes.find((n) => n.name === name);
      return (
        by(triangle)?.type === "VECTOR" &&
        by(triangle)?.vectorNetwork?.regions?.length === 1 &&
        by(curve)?.vectorNetwork?.segments?.some((s) => s.tangentStart.x !== 0 || s.tangentEnd.x !== 0) &&
        by(curve)?.vectorNetwork?.segments?.length === 1 &&
        by("Arrow 1")?.vectorNetwork?.vertices?.[1]?.strokeCap === "ARROW_LINES" &&
        by(rect)?.type === "VECTOR" &&
        by("Subtract")?.type === "VECTOR" &&
        !nodes.some((n) => n.type === "BOOLEAN_OPERATION") &&
        by("Line 1")?.type === "VECTOR" &&
        by("Line 1")?.fills?.length === 1
      );
    },
    "the pen paths, arrow, converted rectangle, flattened boolean and outlined line should be saved",
  );
  await page.screenshot({ path: `${outDir}/vector.png` });
});
