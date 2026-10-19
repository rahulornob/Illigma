// Masks (⌃⌘M), layout grids (Properties card, ⌃G) and rulers with guides (⇧R).
//
// Usage (from the repo root):  node apps/web/e2e/masks.mjs [--headed] [--no-build]

import { createFile, eventually, layerRow, layerRows, newContext, runE2E, selectedRows, watchErrors } from "./lib.mjs";

await runE2E("masks", {}, async ({ browser, url, log, check, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const canvas = page.locator("canvas.canvas");
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");
  const mac = await page.evaluate(() => /Mac/.test(navigator.platform));

  log("open a new file and draw two rectangles");
  await createFile(page, url);
  const names = [];
  for (const dx of [80, 140]) {
    await canvas.focus();
    await page.keyboard.press("r");
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width - dx - 100, box.y + box.height - 160);
    names.push(await selectedName());
  }
  const [A, B] = names;
  check(A && B && A !== B, `two rectangles, got ${names.join(", ")}`);

  log("⌃⌘M: use the bottom one as a mask");
  await layerRow(page, A).click();
  await layerRow(page, B).click({ modifiers: ["Shift"] });
  await canvas.focus();
  await page.keyboard.press("Control+Meta+m");
  check(await eventually(async () => (await selectedName()) === "Mask group"), `the selection should be the new Mask group, got ${await selectedName()}`);
  const maskRow = layerRow(page, A);
  check(await eventually(async () => (await maskRow.locator(".row-icon svg path").count()) === 3), "the mask layer should show the mask icon");
  log("the mask card shows for the mask");
  await maskRow.click();
  check(await eventually(() => page.getByLabel("Mask type").isVisible()), "the Mask card should show for a mask");
  await page.getByLabel("Mask type").selectOption("VECTOR");
  check((await page.getByLabel("Mask type").inputValue()) === "VECTOR", "the mask type should change to Vector");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  check(await eventually(async () => (await layerRows(page).allInnerTexts()).every((t) => t.trim() !== "Mask group")), "undo should remove the mask group");

  log("layout grid on the Desktop frame");
  await layerRow(page, "Desktop").click();
  await page.getByRole("button", { name: "Add layout grid" }).click();
  check(await eventually(() => page.getByLabel("Grid 1 type").isVisible()), "a layout grid row should appear");
  await page.getByLabel("Grid 1 type").selectOption("COLUMNS");
  check(await eventually(async () => (await page.getByLabel("Grid 1 count").inputValue()) === "5"), "columns default to 5");
  await frame();
  const painted = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas.grid-overlay");
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return 0;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++;
      return n;
    });
  check((await painted()) > 0, "the grid overlay should draw the columns");
  await canvas.focus();
  await page.keyboard.press(mac ? "Control+g" : "Control+Shift+4");
  await frame();
  check((await painted()) === 0, "⌃G should hide layout grids");
  check((await selectedName()) === "Desktop", "⌃G must not group the selection");
  await page.keyboard.press(mac ? "Control+g" : "Control+Shift+4");
  await frame();
  check((await painted()) > 0, "⌃G again should show them");

  log("⇧R rulers, drag a guide out and back");
  await page.keyboard.press("Escape");
  await canvas.focus();
  await page.keyboard.press("Shift+R");
  check(await eventually(() => page.locator('.canvas-host[data-rulers="on"]').isVisible()), "⇧R should show rulers");
  const top = await page.locator(".ruler-top").boundingBox();
  check(top && top.height === 20, "the top ruler should be 20 px high");
  const sx = top.x + top.width / 2;
  await page.mouse.move(sx, top.y + 10);
  await page.mouse.down();
  await page.mouse.move(sx, top.y + 120, { steps: 6 });
  await page.mouse.up();
  const guides = page.locator(".ruler-guide.h");
  check(await eventually(async () => (await guides.count()) === 1), "dragging from the top ruler should add a horizontal guide");
  const g = await guides.first().boundingBox();
  await page.mouse.move(sx + 40, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(sx + 40, top.y + 200, { steps: 6 });
  await page.mouse.up();
  const moved = await guides.first().boundingBox();
  check(Math.abs(moved.y - g.y - 80) < 3, `the guide should move with the pointer (${g.y} → ${moved.y})`);
  await page.mouse.move(sx + 40, moved.y + moved.height / 2);
  await page.mouse.down();
  await page.mouse.move(sx + 40, top.y + 5, { steps: 6 });
  await page.mouse.up();
  check(await eventually(async () => (await guides.count()) === 0), "dropping a guide on the ruler should remove it");
  await canvas.focus();
  await page.keyboard.press("ControlOrMeta+z");
  check(await eventually(async () => (await guides.count()) === 1), "undo should bring the guide back");
  await page.keyboard.press("Shift+R");
  check(await eventually(() => page.locator('.canvas-host[data-rulers="off"]').count().then((n) => n === 1)), "⇧R again should hide rulers");
  await context.close();
});
