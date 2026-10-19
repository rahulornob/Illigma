// Layers and pages essentials (Figma parity): the Pages list (add, rename,
// switch with the camera and selection kept per page, duplicate, delete with
// a confirmation, reorder by keyboard and drag), groups (⌘G, ⇧⌘G, ⌥⌘G,
// Escape to the parent, Enter to the children, double-click to enter), the
// Layers panel (inline rename by double-click and ⌘R, hide and lock toggles
// and ⇧⌘H ⇧⌘L, collapse with aria-expanded, drag to reorder and into a frame,
// ⌘] ⌘[ ⌥⌘] ⌥⌘[), the clipboard (⌘C ⌘X ⌘V ⇧⌘V, and to another tab), and the
// context menus on the canvas and on layer rows, by mouse and keyboard.
//
// The sample file: Desktop (1440 × 900) holds Hero, Avatar and Card (an auto
// layout frame with Image, Title and Button).
//
// Usage (from the repo root):  node apps/web/e2e/layers.mjs [--headed] [--no-build]

import { createFile, eventually, layerRow, layerRows, newContext, runE2E, selectedRows, waitSaved, watchErrors } from "./lib.mjs";

await runE2E("layers", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url });
  const page = await context.newPage();
  watchErrors(page, errors);

  const names = async () => (await layerRows(page).allInnerTexts()).map((t) => t.trim());
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");
  const pageRows = () => page.locator(".page-list .page-row");
  const pageNames = async () => (await pageRows().allInnerTexts()).map((t) => t.trim());
  const currentPage = async () => (await page.locator('.page-list .page-row[aria-current="page"]').innerText()).trim();
  const undo = () => page.keyboard.press("ControlOrMeta+z");
  const press = (k) => page.keyboard.press(k);
  const canvas = page.locator(".canvas");
  /** The document's state, read through the rows: name → { depth (aria-level), expanded, hidden, locked }. */
  const rowInfo = (name) =>
    layerRow(page, name).evaluate((el) => ({
      level: Number(el.getAttribute("aria-level")),
      expanded: el.getAttribute("aria-expanded"),
      label: el.getAttribute("aria-label"),
    }));

  await createFile(page, url);
  const startNames = await names();
  log(`sample layers: ${startNames.join(", ")}`);

  // ---- groups ----
  log("⌘G groups the selection in one undo step; the group is selected and sized to the layers");
  await layerRow(page, "Hero").click();
  await layerRow(page, "Avatar").click({ modifiers: ["ControlOrMeta"] });
  await canvas.focus();
  await press("ControlOrMeta+g");
  check(await eventually(async () => (await selectedName()) === "Group 1"), `the new group should be selected, got ${await selectedName()}`);
  check((await rowInfo("Hero")).level === 3 && (await rowInfo("Avatar")).level === 3, "Hero and Avatar should sit inside the group (level 3)");
  check((await rowInfo("Group 1")).expanded === "true", "the group row has aria-expanded=true");
  check(Number(await page.getByLabel("Width").inputValue()) > 0, "the group has a size");

  log("Enter selects the children, Escape selects the parent");
  await press("Enter");
  check(await eventually(async () => (await selectedName()).split(",").sort().join(",") === "Avatar,Hero"), `Enter should select the group's layers, got ${await selectedName()}`);
  await press("Escape");
  check(await eventually(async () => (await selectedName()) === "Group 1"), `Escape should select the parent group, got ${await selectedName()}`);

  log("⇧⌘G ungroups; undo brings the group back");
  await press("Shift+ControlOrMeta+g");
  check(await eventually(async () => (await layerRow(page, "Group 1").count()) === 0), "ungroup removes the group row");
  check((await rowInfo("Hero")).level === 2, "Hero is back in Desktop");
  await undo();
  check(await eventually(async () => (await layerRow(page, "Group 1").count()) === 1), "undo brings the group back");
  await undo();
  check(await eventually(async () => (await layerRow(page, "Group 1").count()) === 0), "undoing ⌘G removes the group in one step");

  log("⌥⌘G frames the selection");
  await layerRow(page, "Hero").click();
  await canvas.focus();
  await press("Alt+ControlOrMeta+g");
  check(await eventually(async () => (await selectedName()) === "Frame 1"), `⌥⌘G should select a new frame, got ${await selectedName()}`);
  check((await rowInfo("Frame 1")).label.endsWith("frame"), "it is a frame");
  await undo();

  // ---- layers panel ----
  log("collapse and expand with the chevron and ← →");
  await layerRow(page, "Card").locator(".row-chevron").click();
  check(await eventually(async () => (await rowInfo("Card")).expanded === "false"), "Card collapses");
  check((await layerRow(page, "Title").count()) === 0, "its rows are hidden");
  await layerRow(page, "Card").click();
  await press("ArrowRight");
  check(await eventually(async () => (await rowInfo("Card")).expanded === "true"), "→ expands");
  await press("ArrowLeft");
  check(await eventually(async () => (await rowInfo("Card")).expanded === "false"), "← collapses");
  await press("ArrowRight");

  log("rename inline by double-click (Enter keeps, Escape cancels) and by ⌘R");
  await layerRow(page, "Hero").dblclick();
  const input = page.getByLabel("Layer name");
  await input.fill("Hero banner");
  await input.press("Enter");
  check(await eventually(async () => (await layerRow(page, "Hero banner").count()) === 1), "Enter renames");
  await layerRow(page, "Hero banner").dblclick();
  await page.getByLabel("Layer name").fill("Nope");
  await page.getByLabel("Layer name").press("Escape");
  check(await eventually(async () => (await layerRow(page, "Hero banner").count()) === 1 && (await layerRow(page, "Nope").count()) === 0), "Escape keeps the old name");
  await layerRow(page, "Hero banner").click();
  await press("ControlOrMeta+r");
  check(await eventually(async () => (await page.getByLabel("Layer name").count()) === 1), "⌘R starts renaming");
  await page.getByLabel("Layer name").fill("Hero");
  await page.getByLabel("Layer name").press("Enter");
  check(await eventually(async () => (await layerRow(page, "Hero").count()) === 1), "⌘R renames");

  log("hide and lock: row buttons and ⇧⌘H ⇧⌘L");
  await layerRow(page, "Hero").hover();
  await page.getByRole("button", { name: "Hide Hero" }).click();
  check(await eventually(async () => (await rowInfo("Hero")).label.includes("hidden")), "the eye hides Hero");
  await layerRow(page, "Hero").click();
  await press("Shift+ControlOrMeta+h");
  check(await eventually(async () => !(await rowInfo("Hero")).label.includes("hidden")), "⇧⌘H shows it again");
  await press("Shift+ControlOrMeta+l");
  check(await eventually(async () => (await rowInfo("Hero")).label.includes("locked")), "⇧⌘L locks");
  await page.getByRole("button", { name: "Unlock Hero" }).click();
  check(await eventually(async () => !(await rowInfo("Hero")).label.includes("locked")), "the lock button unlocks");

  log("⌘] ⌘[ ⌥⌘] ⌥⌘[ change the order");
  const order = async () => (await names()).filter((n) => ["Hero", "Avatar", "Card"].includes(n));
  const before = await order();
  await layerRow(page, "Hero").click();
  await press("Alt+ControlOrMeta+BracketRight");
  check(await eventually(async () => (await order())[0] === "Hero"), `⌥⌘] brings Hero to the front, got ${await order()}`);
  await press("Alt+ControlOrMeta+BracketLeft");
  check(await eventually(async () => (await order()).at(-1) === "Hero"), `⌥⌘[ sends Hero to the back, got ${await order()}`);
  await press("ControlOrMeta+BracketRight");
  check(await eventually(async () => (await order()).at(-2) === "Hero"), `⌘] brings it forward one step, got ${await order()}`);
  await press("ControlOrMeta+BracketLeft");
  check(await eventually(async () => (await order()).at(-1) === "Hero"), `⌘[ sends it back one step, got ${await order()}`);
  for (let i = 0; i < 4; i++) await undo();
  check(await eventually(async () => (await order()).join() === before.join()), `four undos restore the order, got ${await order()}`);

  log("drag a row into a frame and back out");
  const heroBox = await layerRow(page, "Hero").boundingBox();
  const cardBox = await layerRow(page, "Card").boundingBox();
  await page.mouse.move(heroBox.x + 60, heroBox.y + heroBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + 60, cardBox.y + cardBox.height / 2, { steps: 6 });
  check(await eventually(async () => (await layerRow(page, "Card").getAttribute("class")).includes("drop-into")), "dragging over Card highlights it as the target");
  await page.mouse.up();
  check(await eventually(async () => (await rowInfo("Hero")).level === 3), "Hero dropped into Card (level 3)");
  await undo();
  check(await eventually(async () => (await rowInfo("Hero")).level === 2), "undo takes it back out");

  // ---- context menus ----
  log("context menu on a layer row: opens, keyboard works, actions run");
  await layerRow(page, "Avatar").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Layer actions" });
  await menu.waitFor();
  check(await eventually(async () => (await page.evaluate(() => document.activeElement?.getAttribute("role"))) === "menuitem"), "focus goes into the menu");
  await press("Escape");
  check(await eventually(async () => (await menu.count()) === 0), "Escape closes it");
  await layerRow(page, "Avatar").click();
  await press("Shift+F10");
  await menu.waitFor();
  await menu.getByRole("menuitem", { name: /^Group selection/ }).click();
  check(await eventually(async () => (await selectedName()) === "Group 1"), "Group selection from the menu groups Avatar");
  await undo();

  log("context menu on the canvas");
  const cbox = await canvas.boundingBox();
  await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + 20, { button: "right" });
  const cmenu = page.getByRole("menu", { name: "Canvas actions" });
  await cmenu.waitFor();
  check((await cmenu.getByRole("menuitem").count()) >= 15, "the canvas menu lists the layer actions");
  await press("Escape");

  // ---- clipboard ----
  log("⌘C ⌘V pastes a copy; ⌘X cuts");
  await layerRow(page, "Avatar").click();
  await canvas.focus();
  const count0 = await layerRows(page).count();
  await press("ControlOrMeta+c");
  await press("ControlOrMeta+v");
  check(await eventually(async () => (await layerRows(page).count()) === count0 + 1), `⌘V should paste one layer (rows ${await layerRows(page).count()} vs ${count0})`);
  check(await eventually(async () => (await selectedName()) === "Avatar"), "the pasted copy is selected");
  await press("Shift+ControlOrMeta+v");
  check(await eventually(async () => (await layerRows(page).count()) === count0 + 2), "⇧⌘V pastes in place");
  await press("ControlOrMeta+x");
  check(await eventually(async () => (await layerRows(page).count()) === count0 + 1), "⌘X removes the layer");
  await undo();
  await undo();
  await undo();
  check(await eventually(async () => (await layerRows(page).count()) === count0), "undo removes the pastes");

  log("paste into another tab (another file)");
  await layerRow(page, "Card").click();
  await canvas.focus();
  await press("ControlOrMeta+c");
  await waitSaved(page);
  const other = await context.newPage();
  watchErrors(other, errors);
  await createFile(other, url);
  const otherCount = await other.locator(".layer-list .layer-row").count();
  await other.locator(".canvas").focus();
  await other.keyboard.press("ControlOrMeta+v");
  check(
    await eventually(async () => (await other.locator(".layer-list .layer-row").count()) === otherCount + 4),
    `Card and its 3 layers should paste into the other file (${await other.locator(".layer-list .layer-row").count()} vs ${otherCount})`,
  );
  await other.close();

  // ---- pages ----
  log("pages: add (+) starts renaming; Enter names it; it becomes current");
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByLabel("Page name").fill("Mobile");
  await page.getByLabel("Page name").press("Enter");
  check(await eventually(async () => (await pageNames()).includes("Mobile") && (await currentPage()) === "Mobile"), `the new page is named and current: ${await pageNames()}`);
  check((await layerRows(page).count()) === 0, "the new page is empty");

  log("switching pages keeps each page's selection and camera");
  await pageRows().filter({ hasText: /^Page 1$/ }).click();
  check(await eventually(async () => (await layerRows(page).count()) > 0), "back on Page 1");
  await layerRow(page, "Hero").click();
  await page.getByRole("button", { name: /^Zoom in/ }).click();
  const zoomP1 = await page.locator(".zoom-value").innerText();
  await pageRows().filter({ hasText: /^Mobile$/ }).click();
  await pageRows().filter({ hasText: /^Page 1$/ }).click();
  check(await eventually(async () => (await selectedName()) === "Hero"), `Page 1 keeps its selection, got ${await selectedName()}`);
  check(await eventually(async () => (await page.locator(".zoom-value").innerText()) === zoomP1), `Page 1 keeps its zoom ${zoomP1}`);

  log("rename a page by double-click; duplicate and delete from its menu");
  await pageRows().filter({ hasText: /^Mobile$/ }).dblclick();
  await page.getByLabel("Page name").fill("Phone");
  await page.getByLabel("Page name").press("Enter");
  check(await eventually(async () => (await pageNames()).includes("Phone")), "double-click renames the page");
  await pageRows().filter({ hasText: /^Page 1$/ }).click({ button: "right" });
  await page.getByRole("menu", { name: "Page actions" }).getByRole("menuitem", { name: "Duplicate page" }).click();
  check(await eventually(async () => (await currentPage()) === "Page 1 copy"), "the copy opens");
  check(await eventually(async () => (await layerRows(page).count()) === (await layerRows(page).count()) && (await layerRow(page, "Hero").count()) === 1), "the copy holds the layers");
  await pageRows().filter({ hasText: /^Page 1 copy$/ }).click({ button: "right" });
  await page.getByRole("menu", { name: "Page actions" }).getByRole("menuitem", { name: "Delete page" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  check((await pageNames()).includes("Page 1 copy"), "Cancel keeps the page");
  await pageRows().filter({ hasText: /^Page 1 copy$/ }).focus();
  await press("Delete");
  await dialog.getByRole("button", { name: "Delete page" }).click();
  check(await eventually(async () => !(await pageNames()).includes("Page 1 copy")), "Delete page removes it");

  log("reorder pages with ⌥↑ and by drag");
  await pageRows().filter({ hasText: /^Phone$/ }).focus();
  await press("Alt+ArrowUp");
  check(await eventually(async () => (await pageNames())[0] === "Phone"), `⌥↑ moves Phone first: ${await pageNames()}`);
  await pageRows().filter({ hasText: /^Phone$/ }).dragTo(pageRows().filter({ hasText: /^Page 1$/ }), { targetPosition: { x: 40, y: 28 } });
  check(await eventually(async () => (await pageNames()).join() === "Page 1,Phone"), `dragging Phone below Page 1: ${await pageNames()}`);

  log("the last page can't be deleted");
  await pageRows().filter({ hasText: /^Phone$/ }).click({ button: "right" });
  await page.getByRole("menu", { name: "Page actions" }).getByRole("menuitem", { name: "Delete page" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete page" }).click();
  check(await eventually(async () => (await pageNames()).length === 1), "one page left");
  await pageRows().first().click({ button: "right" });
  check((await page.getByRole("menuitem", { name: "Delete page" }).getAttribute("aria-disabled")) === "true", "Delete page is disabled on the last page");
  await press("Escape");

  await page.screenshot({ path: `${outDir}/layers.png` });
  await waitSaved(page);
  await context.close();
});
