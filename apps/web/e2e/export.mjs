// Export (docs/design/export.md): the Export card in Properties (+ adds rows
// 1x, 2x, 3x; size field "2x" / "512w" / "512h"; suffix; format menu; SVG
// options popover; remove; preview), exporting a frame as PNG, SVG and PDF as
// downloads (a browser without folder access), several files as one .zip,
// the ⇧⌘E dialog with three layers (file names and pixel sizes), a failure
// (too big a scale) listed with Retry, settings kept after a reload, export
// into a chosen folder (numbered names instead of replacing files), a
// 50-file export that leaves the page responsive, keyboard-only use, and axe.
//
// Usage (from the repo root):  node apps/web/e2e/export.mjs [--headed] [--no-build]

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { unzipSync } from "fflate";
import { createFile, eventually, layerRow, newContext, poll, runE2E, waitSaved, watchErrors } from "./lib.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

await runE2E("export", {}, async ({ browser, url, log, check, outDir, errors }) => {
  // ---- a browser without folder access: exports download ----
  const context = await newContext(browser);
  await context.addInitScript(() => {
    delete window.showDirectoryPicker;
  });
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });
  const card = props.locator("section.export-card");
  const rows = card.locator(".export-row");
  const size = (n) => card.getByLabel(`Setting ${n} size`, { exact: true });
  const suffix = (n) => card.getByLabel(`Setting ${n} suffix`, { exact: true });
  const formatButton = (n) => card.getByRole("button", { name: new RegExp(`^Setting ${n} format: `) });
  const setFormat = async (n, f) => {
    await formatButton(n).click();
    await page.getByRole("menuitemradio", { name: f, exact: true }).click();
  };
  const exportButton = () => card.getByRole("button", { name: /^Export / });
  const download = async (click) => {
    const [d] = await Promise.all([page.waitForEvent("download"), click()]);
    const path = await d.path();
    return { name: d.suggestedFilename(), bytes: new Uint8Array(await readFile(path)) };
  };
  async function axe(where) {
    if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }));
    const fmt = (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`;
    check(result.violations.length === 0, `${where}: axe found:\n  ${result.violations.map(fmt).join("\n  ")}`);
  }

  log("open a new file; Hero has no export settings");
  await createFile(page, url);
  await layerRow(page, "Hero").click();
  check(await card.isVisible(), "the Export card should show for a selected layer");
  check((await rows.count()) === 0, "no rows before + is clicked");
  check((await exportButton().count()) === 0, "no Export button without settings");

  log("+ adds 1x PNG, then 2x @2x and 3x @3x, as in Figma; − removes a row");
  const add = card.getByRole("button", { name: "Add export setting" });
  await add.click();
  check((await size(1).inputValue()) === "1x" && (await suffix(1).inputValue()) === "" && (await formatButton(1).innerText()).includes("PNG"), "the first row is 1x PNG with no suffix");
  await add.click();
  await add.click();
  check((await rows.count()) === 3, "three rows");
  check((await size(2).inputValue()) === "2x" && (await suffix(2).inputValue()) === "@2x", "the second row is 2x @2x");
  check((await size(3).inputValue()) === "3x" && (await suffix(3).inputValue()) === "@3x", "the third row is 3x @3x");
  await card.getByRole("button", { name: "Remove setting 3" }).click();
  check((await rows.count()) === 2, "− removes the row");
  await page.locator(".canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  check(await eventually(async () => (await rows.count()) === 3), "undo brings the removed row back (one undo step)");
  await card.getByRole("button", { name: "Remove setting 3" }).click();

  log("size field: 2x, 512w and 512h; anything else says how to write it");
  await size(1).fill("512w");
  await size(1).press("Enter");
  check(await eventually(async () => (await size(1).inputValue()) === "512w"), "512w is a fixed width");
  await size(1).fill("300H");
  await size(1).press("Enter");
  check(await eventually(async () => (await size(1).inputValue()) === "300h"), "300H is a fixed height, shown as 300h");
  await size(1).fill("lots");
  await size(1).press("Enter");
  check(await card.getByRole("alert").filter({ hasText: "512w" }).isVisible(), "a size it can't read explains the forms it takes");
  await size(1).press("Escape");
  check((await size(1).inputValue()) === "300h" && (await card.getByRole("alert").count()) === 0, "Escape puts the value back");
  await size(1).fill("1");
  await size(1).press("Enter");
  check(await eventually(async () => (await size(1).inputValue()) === "1x"), "a bare number is a scale");

  log("the preview draws Hero");
  const preview = card.getByRole("img", { name: "Preview of Hero" });
  await preview.waitFor();
  check(await eventually(() => preview.evaluate((img) => img.complete && img.naturalWidth > 0)), "the preview image loads");

  log("two settings export as one .zip with both files");
  check((await exportButton().innerText()).includes("Export Hero · 2 files"), `the button names the layer and the file count, got "${await exportButton().innerText()}"`);
  const zip = await download(() => exportButton().click());
  check(zip.name === "Hero.zip", `several files download as Hero.zip, got ${zip.name}`);
  const entries = unzipSync(zip.bytes);
  check(Object.keys(entries).sort().join(",") === "Hero.png,Hero@2x.png", `the zip holds Hero.png and Hero@2x.png, got ${Object.keys(entries)}`);
  check(JSON.stringify(pngSize(entries["Hero@2x.png"])) === JSON.stringify({ width: 1120, height: 640 }), `Hero@2x.png is 1120 × 640, got ${JSON.stringify(pngSize(entries["Hero@2x.png"]))}`);
  check(await page.getByRole("status").filter({ hasText: "Downloaded 2 files as “Hero.zip”" }).isVisible(), "the toast says what downloaded");

  log("one PNG downloads as it is, at its pixel size");
  await card.getByRole("button", { name: "Remove setting 1" }).click();
  check((await size(1).inputValue()) === "2x", "the 2x row is left");
  const png = await download(() => exportButton().click());
  check(png.name === "Hero@2x.png", `one file downloads by its name, got ${png.name}`);
  check(JSON.stringify(pngSize(png.bytes)) === JSON.stringify({ width: 1120, height: 640 }), `the PNG is 1120 × 640, got ${JSON.stringify(pngSize(png.bytes))}`);

  log("SVG, with the options popover");
  await setFormat(1, "SVG");
  check(await eventually(async () => (await formatButton(1).innerText()).includes("SVG")), "the row is SVG now");
  check(await size(1).isDisabled(), "SVG has no size (always 1x)");
  await card.getByRole("button", { name: "Setting 1 options" }).click();
  const pop = page.getByRole("dialog", { name: "SVG options" });
  await pop.waitFor();
  check(await pop.getByRole("checkbox", { name: /Outline text/ }).isDisabled(), "outline text isn't available yet, and says so");
  await axe("the SVG options popover");
  await pop.getByRole("checkbox", { name: "Include “id” attribute" }).check();
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await pop.count()) === 0), "Escape closes the popover");
  const svg = await download(() => exportButton().click());
  const svgText = new TextDecoder().decode(svg.bytes);
  check(svg.name === "Hero@2x.svg" && svgText.includes("<svg") && svgText.includes('id="Hero"'), `an SVG with the layer name as id, got ${svg.name}: ${svgText.slice(0, 120)}`);

  log("PDF");
  await setFormat(1, "PDF");
  const pdf = await download(() => exportButton().click());
  check(pdf.name === "Hero@2x.pdf" && new TextDecoder().decode(pdf.bytes.slice(0, 5)) === "%PDF-", `a PDF, got ${pdf.name}`);
  await setFormat(1, "PNG");
  check(await eventually(async () => (await size(1).inputValue()) === "1x"), "back to PNG at 1x");

  log("three layers with settings: Avatar (2x) and Card (SVG)");
  await layerRow(page, "Avatar").click();
  await add.click();
  await size(1).fill("2x");
  await size(1).press("Enter");
  await layerRow(page, "Card").click();
  await add.click();
  await setFormat(1, "SVG");

  log("settings are kept after a reload");
  await waitSaved(page);
  await page.reload();
  await page.locator(".title-bar").waitFor();
  await layerRow(page, "Avatar").click();
  check(await eventually(async () => (await size(1).inputValue()) === "2x"), "Avatar keeps 2x after a reload");
  await layerRow(page, "Hero").click();
  check((await rows.count()) === 1 && (await size(1).inputValue()) === "1x" && (await suffix(1).inputValue()) === "@2x", "Hero keeps its row after a reload");

  log("⇧⌘E: the Export dialog lists the three layers, their files and sizes");
  await page.locator(".canvas").focus();
  await page.keyboard.press("ControlOrMeta+Shift+e");
  const dialog = page.getByRole("dialog", { name: "Export" });
  await dialog.waitFor();
  const dialogRows = dialog.locator(".export-list-row");
  check((await dialogRows.count()) === 3, `three layers, got ${await dialogRows.count()}`);
  const listText = await dialog.locator(".export-list").innerText();
  for (const want of ["Hero@2x.png", "560 × 320 px", "Avatar.png", "192 × 192 px", "Card.svg", "320 × 264"]) check(listText.includes(want), `the dialog lists ${want}:\n${listText}`);
  check((await dialog.getByRole("button", { name: "Export 3 files" }).count()) === 1, "Export 3 files");
  await axe("the Export dialog");
  await dialog.getByRole("checkbox", { name: "Export Card" }).uncheck();
  check(await dialog.getByRole("button", { name: "Export 2 files" }).isVisible(), "unchecking a layer leaves 2 files");
  check(await dialog.getByRole("checkbox", { name: "All layers with export settings" }).evaluate((el) => el.indeterminate), "the header checkbox shows some are checked");
  await page.screenshot({ path: `${outDir}/export-dialog.png` });
  const both = await download(() => dialog.getByRole("button", { name: "Export 2 files" }).click());
  const bothEntries = Object.keys(unzipSync(both.bytes)).sort();
  check(bothEntries.join(",") === "Avatar.png,Hero@2x.png", `the dialog's zip holds the checked layers' files, got ${bothEntries}`);
  check(await eventually(async () => (await dialog.count()) === 0), "a clean export closes the dialog");
  check(await page.getByRole("status").filter({ hasText: "Downloaded 2 files" }).isVisible(), "and the toast says so");

  log("a failure: Hero at 50x is too big; listed with Retry, the rest still exports");
  await layerRow(page, "Hero").click();
  await size(1).fill("50x");
  await size(1).press("Enter");
  await page.locator(".canvas").focus();
  await page.keyboard.press("ControlOrMeta+Shift+e");
  await dialog.waitFor();
  await dialog.getByRole("checkbox", { name: "Export Card" }).check();
  check((await dialog.locator(".export-file[data-problem]").innerText()).includes("too big"), "the dialog warns before exporting");
  const partial = await download(() => dialog.getByRole("button", { name: "Export 3 files" }).click());
  check(Object.keys(unzipSync(partial.bytes)).sort().join(",") === "Avatar.png,Card.svg", "the other two files still export");
  const banner = dialog.getByRole("alert");
  await banner.waitFor();
  const bannerText = await banner.innerText();
  check(bannerText.includes("2 of 3 files exported") && bannerText.includes("Hero@2x.png") && bannerText.includes("too big"), `the banner says what failed and why:\n${bannerText}`);
  check((await dialog.locator(".export-status.tone-danger").innerText()) === "1 failed", "Hero's row says 1 failed");
  const retry = dialog.getByRole("button", { name: "Retry 1 file" });
  check(await retry.isVisible(), "Retry 1 file");
  await page.screenshot({ path: `${outDir}/export-failure.png` });
  await retry.click();
  check(await eventually(async () => (await dialog.getByRole("alert").innerText()).includes("The file wasn't exported")), "Retry runs only the failed file (still too big)");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  check(await eventually(async () => (await dialog.count()) === 0), "Close closes the dialog");
  const toast = page.locator(".export-toast-error");
  check(await toast.isVisible(), "the failure stays in a toast after the dialog closes");
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await layerRow(page, "Hero").click();
  await size(1).fill("1x");
  await size(1).press("Enter");

  log("keyboard only: add a row, set its size and format, export from the dialog");
  await layerRow(page, "Avatar").click();
  await add.focus();
  await page.keyboard.press("Enter");
  check(await eventually(async () => (await rows.count()) === 2), "Enter on + adds a row");
  await size(2).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("3x");
  await page.keyboard.press("Tab");
  check(await eventually(async () => (await size(2).inputValue()) === "3x"), "typing 3x and Tab commits it");
  await page.keyboard.press("Tab"); // size presets → suffix
  await page.keyboard.press("Tab"); // suffix → format
  check(await formatButton(2).evaluate((el) => el === document.activeElement), "Tab reaches the format menu");
  await page.keyboard.press("Enter");
  // The menu opens on the checked format (PNG): ↓ JPG, ↓ SVG, ↓ PDF.
  await page.getByRole("menuitemradio", { name: "PNG", exact: true }).waitFor();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  check(await eventually(async () => (await formatButton(2).innerText()).includes("PDF")), "↓↓↓ Enter picks PDF");
  await page.locator(".canvas").focus();
  await page.keyboard.press("ControlOrMeta+Shift+e");
  await dialog.waitFor();
  check(await eventually(() => dialog.evaluate((d) => d.contains(document.activeElement))), "focus moves into the dialog");
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await dialog.count()) === 0), "Escape closes the dialog");
  check((await layerRow(page, "Avatar").getAttribute("aria-selected")) === "true", "Escape in the dialog doesn't clear the selection");
  await page.keyboard.press("ControlOrMeta+Shift+e");
  await dialog.waitFor();
  const exportAll = dialog.getByRole("button", { name: /^Export \d+ files$/ });
  for (let i = 0; i < 40 && !(await exportAll.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  check(await exportAll.evaluate((el) => el === document.activeElement), "Tab reaches Export in the dialog");
  const viaKeys = await download(() => page.keyboard.press("Enter"));
  const keyFiles = Object.keys(unzipSync(viaKeys.bytes)).sort();
  check(viaKeys.name.endsWith(".zip") && keyFiles.join(",") === "Avatar.png,Avatar@3x.pdf,Card.svg,Hero@2x.png", `Enter exports from the dialog, got ${keyFiles}`);
  await axe("the editor with the Export card");
  await context.close();

  // ---- folder access (Chromium): the picked folder is an OPFS folder here ----
  const fsContext = await newContext(browser);
  await fsContext.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      window.__pickerCalls = (window.__pickerCalls ?? 0) + 1;
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("my-exports", { create: true });
    };
  });
  const fsPage = await fsContext.newPage();
  watchErrors(fsPage, errors);
  const fsCard = fsPage.getByRole("complementary", { name: "Properties" }).locator("section.export-card");
  const listFolder = () =>
    fsPage.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("my-exports", { create: true });
      const out = [];
      const walk = async (d, prefix) => {
        for await (const [name, h] of d.entries()) {
          if (h.kind === "directory") await walk(h, `${prefix}${name}/`);
          else out.push(`${prefix}${name}:${(await h.getFile()).size}`);
        }
      };
      await walk(dir, "");
      return out.sort();
    });

  log("folder: the first export asks for a folder and writes into it");
  await createFile(fsPage, url);
  await layerRow(fsPage, "Avatar").click();
  await fsCard.getByRole("button", { name: "Add export setting" }).click();
  await fsCard.getByRole("button", { name: "Export Avatar" }).click();
  const first = await poll(async () => (await listFolder()).find((f) => f.startsWith("Avatar.png:")), "Avatar.png should be written to the folder", 15_000);
  check(Number(first.split(":")[1]) > 0, "Avatar.png has bytes");
  check(await fsPage.getByRole("status").filter({ hasText: "Exported 1 file to “my-exports”" }).isVisible(), "the toast names the folder");
  check(!(await fsPage.getByRole("button", { name: "Open folder" }).count()), "no Open folder in a browser (it can't open one)");

  log("folder: the second export numbers the file instead of replacing it, without asking again");
  await fsCard.getByRole("button", { name: "Export Avatar" }).click();
  await poll(async () => (await listFolder()).some((f) => f.startsWith("Avatar-1.png:")), "Avatar-1.png should be written next to Avatar.png", 15_000);
  check((await fsPage.evaluate(() => window.__pickerCalls)) === 1, "the folder is remembered: the picker opened once");

  log("folder: 50 files export in the background; the page stays responsive");
  for (let i = 1; i < 50; i++) await fsCard.getByRole("button", { name: "Add export setting" }).click();
  await fsCard.getByLabel("Setting 50 suffix", { exact: true }).waitFor();
  await fsPage.evaluate(() => {
    window.__longest = 0;
    window.__observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longest = Math.max(window.__longest, e.duration);
    });
    window.__observer.observe({ type: "longtask", buffered: false });
  });
  await fsCard.getByRole("button", { name: /^Export Avatar · 50 files$/ }).click();
  // While it runs, the editor still answers: a frame of the main thread every so often.
  await poll(async () => (await listFolder()).length >= 52, "all 50 files should be written", 120_000, 200);
  const longest = await fsPage.evaluate(() => window.__longest);
  check(longest < 400, `no main-thread task over 400 ms during a 50-file export, longest ${Math.round(longest)} ms`);
  console.log(`  · longest main-thread task during the 50-file export: ${Math.round(longest)} ms`);
  check(await fsPage.evaluate(() => performance.getEntriesByType("resource").some((e) => /export\.worker/.test(e.name))), "the export ran in its worker");
  check(await fsPage.getByRole("status").filter({ hasText: "Exported 50 files to “my-exports”" }).isVisible(), "the toast counts 50 files");
  await fsContext.close();
});
