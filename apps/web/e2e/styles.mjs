// Styles and variables: create a fill style from Hero, apply it to Avatar,
// detach it, see it in the Local styles list (folder from the "/" name) and
// rename it; open the Variables manager, make a collection with two modes and
// a colour variable, bind Hero's fill to it from the colour picker's
// Variables tab, switch the Desktop frame to the second mode (Hero turns
// blue), undo, and find everything again after a reload.
//
// Usage (from the repo root):  node apps/web/e2e/styles.mjs [--headed] [--no-build]

import { canvasReady, createFile, eventually, layerRow, newContext, runE2E, watchErrors } from "./lib.mjs";

await runE2E("styles", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });
  const undo = () => page.keyboard.press("ControlOrMeta+z");

  const readDisk = (fileId) =>
    page.evaluate(async (id) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
      const read = async (d, name) => (await (await d.getFileHandle(name)).getFile()).text();
      const manifest = JSON.parse(await read(dir, "manifest.json"));
      const pages = await dir.getDirectoryHandle("pages");
      const nodes = [];
      for (const p of manifest.pages) nodes.push(...JSON.parse(await read(pages, `${p.id}.json`)));
      return { manifest, nodes };
    }, fileId);
  const disk = async (fileId) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await readDisk(fileId);
      } catch (e) {
        if (attempt >= 20) throw e;
        await page.waitForTimeout(100);
      }
    }
  };
  const saved = async (fileId, test, why) => {
    let last;
    const ok = await eventually(async () => test((last = await disk(fileId))), 10_000);
    check(ok, `${why}: on disk ${JSON.stringify(last?.manifest).slice(0, 400)}`);
    return last;
  };
  const node = (d, name) => d.nodes.find((n) => n.name === name);
  const clearSelection = async () => {
    await page.locator(".canvas").focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  };

  log("create a fill style from Hero");
  const fileId = await createFile(page, url);
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: "Fill styles" }).click();
  const popover = page.getByRole("dialog", { name: "Fill styles" });
  await popover.getByLabel("New style name").fill("Brand/Grey");
  await popover.getByRole("button", { name: "Create style" }).click();
  check(await eventually(async () => (await props.getByRole("button", { name: /^Fill style: Brand\/Grey/ }).count()) === 1), "Hero's Fill card shows the linked style");
  let d = await saved(fileId, (d) => d.manifest.styles?.length === 1 && node(d, "Hero")?.fillStyleId === d.manifest.styles[0].id, "the style and Hero's link are saved");
  const styleId = d.manifest.styles[0].id;
  await page.keyboard.press("Escape");

  log("apply it to Avatar, then detach");
  await layerRow(page, "Avatar").click();
  await props.getByRole("button", { name: "Fill styles" }).click();
  await page.getByRole("dialog", { name: "Fill styles" }).getByRole("listitem").filter({ hasText: "Grey" }).click();
  await saved(fileId, (d) => node(d, "Avatar")?.fillStyleId === styleId && node(d, "Avatar").fills[0].color.r < 0.9, "Avatar uses the style and its grey");
  await page.getByRole("dialog", { name: "Fill styles" }).getByRole("button", { name: "Detach style" }).click();
  await saved(fileId, (d) => node(d, "Avatar")?.fillStyleId === undefined && node(d, "Avatar").fills[0].color.r < 0.9, "Avatar is detached and keeps the grey");
  await page.keyboard.press("Escape");

  log("local styles list when nothing is selected: folder, rename");
  await clearSelection();
  const local = props.getByRole("region", { name: "Local styles" }).or(props.locator("section", { has: page.getByRole("heading", { name: "Local styles" }) }));
  check(await eventually(async () => (await local.getByText("Brand", { exact: true }).count()) === 1), "the Brand folder shows");
  await local.getByRole("button", { name: "Grey", exact: true }).dblclick();
  const rename = local.getByLabel("Rename Brand/Grey");
  await rename.fill("Brand/Stone");
  await rename.press("Enter");
  await saved(fileId, (d) => d.manifest.styles?.[0]?.name === "Brand/Stone", "the style is renamed on disk");

  log("Variables manager: collection, a second mode, a colour variable");
  await local.getByRole("button", { name: /^Variables/ }).click();
  const vm = page.getByRole("dialog", { name: "Variables" });
  await vm.getByRole("button", { name: "Create collection" }).click();
  await vm.getByRole("button", { name: "Add mode" }).click();
  await vm.getByRole("button", { name: "Create variable" }).click();
  await page.getByRole("menuitem", { name: "Colour" }).click();
  const m1 = vm.getByLabel("colour-1 in Mode 1");
  await m1.fill("#00FF00");
  await m1.press("Enter");
  const m2 = vm.getByLabel("colour-1 in Mode 2");
  await m2.fill("#0000FF");
  await m2.press("Enter");
  d = await saved(fileId, (d) => d.manifest.variables?.variables?.[0]?.name === "colour-1" && d.manifest.variables.collections[0].modes.length === 2, "the collection and variable are saved");
  const vars = d.manifest.variables;
  const [mode1, mode2] = vars.collections[0].modes.map((m) => m.modeId);
  check(vars.variables[0].valuesByMode[mode2].b === 1, "Mode 2's value is blue");
  await page.screenshot({ path: `${outDir}/styles-variables-manager.png` });
  await vm.getByRole("button", { name: "Back to canvas" }).click();

  log("bind Hero's fill from the picker's Variables tab");
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  const picker = page.getByRole("dialog", { name: "Fill 1 colour" });
  await picker.getByRole("tab", { name: "Variables" }).click();
  await picker.getByRole("option", { name: "colour-1" }).click();
  d = await saved(fileId, (d) => node(d, "Hero")?.boundVariables?.["fills.0"]?.id === vars.variables[0].id && node(d, "Hero").fills[0].color.g === 1, "Hero is bound and green");
  check(node(d, "Hero").fillStyleId === undefined, "binding the colour detached the paint style");
  await page.keyboard.press("Escape");

  log("Desktop set to Mode 2: Hero turns blue; undo turns it back");
  await layerRow(page, "Desktop").click();
  await props.getByLabel("Collection").selectOption({ label: "Mode 2" });
  await saved(fileId, (d) => node(d, "Desktop")?.explicitVariableModes?.[vars.collections[0].id] === mode2 && node(d, "Hero").fills[0].color.b === 1, "Hero is blue in Mode 2");
  await page.screenshot({ path: `${outDir}/styles-mode2.png` });
  await page.locator(".canvas").focus();
  await undo();
  await saved(fileId, (d) => node(d, "Desktop")?.explicitVariableModes === undefined && node(d, "Hero").fills[0].color.g === 1, "undo brings back Auto and green");
  check(mode1 !== mode2, "two modes");

  log("reload: styles, variables and the binding come back");
  await page.reload();
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check(await eventually(async () => (await props.getByText("colour-1").count()) > 0), "Hero's bound fill shows the variable name");
  await clearSelection();
  check(await eventually(async () => (await props.getByRole("button", { name: "Stone", exact: true }).count()) === 1), "the renamed style is listed after a reload");
});
