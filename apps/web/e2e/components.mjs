// Components, variants and instances (Figma parity): ⌥⌘K turns a frame into
// a component, the Assets tab lists it (with search) and places instances (by
// keyboard and by dragging to the canvas), edits to the main component reach
// instances while their overrides stay, Reset all changes, Detach (⌥⌘B),
// combine as variants and the instance's variant picker, all undoable.
//
// The sample file: Desktop (1440 × 900) holds Hero, Avatar and Card.
//
// Usage (from the repo root):  node apps/web/e2e/components.mjs [--headed] [--no-build]

import { createFile, eventually, field, layerRow, newContext, runE2E, selectedRows, setField, waitSaved, watchErrors } from "./lib.mjs";

await runE2E("components", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const press = (k) => page.keyboard.press(k);
  const canvas = page.locator(".canvas");
  const label = (name, i = 0) => layerRow(page, name).nth(i).getAttribute("aria-label");
  const selectedName = async () => (await selectedRows(page).allInnerTexts()).map((r) => r.trim()).join(",");

  await createFile(page, url);

  log("⌥⌘K turns the selected frame into a component (same layer, one undo step)");
  await layerRow(page, "Card").click();
  await canvas.focus();
  await press("Alt+ControlOrMeta+k");
  check(await eventually(async () => (await label("Card"))?.includes("component")), `Card should be a component, got ${await label("Card")}`);
  check(await eventually(async () => (await page.locator(".component-card").count()) === 1), "the Component card shows");
  await press("ControlOrMeta+z");
  check(await eventually(async () => (await label("Card"))?.includes("frame")), "undo turns it back");
  await press("Shift+ControlOrMeta+z");
  check(await eventually(async () => (await label("Card"))?.includes("component")), "redo makes it a component again");

  log("Assets lists local components, with search");
  await page.getByRole("tab", { name: "Assets" }).click();
  const item = page.locator(".asset-item", { hasText: "Card" });
  check(await eventually(async () => (await item.count()) === 1), "Card is listed in Assets");
  await page.getByLabel("Search assets").fill("zzz");
  check(await eventually(async () => (await item.count()) === 0), "search filters it out");
  await page.getByLabel("Search assets").fill("car");
  check(await eventually(async () => (await item.count()) === 1), "search finds it");

  log("Enter on an asset places an instance; dragging one to the canvas places another");
  await item.focus();
  await press("Enter");
  const box = await canvas.boundingBox();
  await item.dragTo(canvas, { targetPosition: { x: box.width * 0.8, y: box.height * 0.8 } });
  await page.getByRole("tab", { name: "Layers" }).click();
  check(await eventually(async () => (await layerRow(page, "Card").count()) === 3), `two instances should be added, rows: ${await layerRow(page, "Card").count()}`);
  check((await label("Card", 0))?.includes("instance"), `the front-most Card is an instance, got ${await label("Card", 0)}`);

  log("Instance card: main component name, Go to main component");
  await layerRow(page, "Card").nth(0).click();
  const card = page.locator(".component-card");
  check(await eventually(async () => (await card.innerText()).includes("Instance")), "the Instance card shows");
  check(await card.getByRole("button", { name: "Detach" }).isVisible(), "Detach is offered");

  log("Editing the main component reaches the instances; an override stays");
  const mainIndex = 2; // rows: instance (drag), instance (Enter), main inside Desktop
  await layerRow(page, "Card").nth(mainIndex).click();
  check(await eventually(async () => (await label("Card", mainIndex))?.includes("component")), "the third row is the main component");
  await setField(page, "Width", 150);
  await layerRow(page, "Card").nth(0).click();
  check(await eventually(async () => (await field(page, "Width")) === 150), `instance width should follow the main, got ${await field(page, "Width")}`);
  await setField(page, "Width", 90);
  await layerRow(page, "Card").nth(mainIndex).click();
  await setField(page, "Width", 170);
  await layerRow(page, "Card").nth(1).click();
  check(await eventually(async () => (await field(page, "Width")) === 170), "the untouched instance follows");
  await layerRow(page, "Card").nth(0).click();
  check(await eventually(async () => (await field(page, "Width")) === 90), `the overridden instance keeps its width, got ${await field(page, "Width")}`);

  log("Reset all changes brings the instance back to the main component");
  await card.getByRole("button", { name: "Reset all changes" }).click();
  check(await eventually(async () => (await field(page, "Width")) === 170), `reset should restore 170, got ${await field(page, "Width")}`);

  log("⌥⌘B detaches into a frame; undo brings the instance back");
  await canvas.focus();
  await press("Alt+ControlOrMeta+b");
  check(await eventually(async () => (await label("Card", 0))?.includes("frame")), `detached Card is a frame, got ${await label("Card", 0)}`);
  await press("ControlOrMeta+z");
  check(await eventually(async () => (await label("Card", 0))?.includes("instance")), "undo makes it an instance again");

  log("Go to main component selects the main");
  await layerRow(page, "Card").nth(0).click();
  await card.getByRole("button", { name: "Go to main component" }).click();
  check(await eventually(async () => (await selectedRows(page).first().getAttribute("aria-label"))?.includes("component")), `the main component is selected, got ${await selectedName()}`);

  log("Combine as variants, then switch an instance's variant");
  await layerRow(page, "Hero").click();
  await canvas.focus();
  await press("Alt+ControlOrMeta+k");
  // A shape is wrapped in a new component ("Component 1"), as frames are turned into one.
  check(await eventually(async () => (await label("Component 1"))?.includes("component")), "Hero is wrapped in Component 1");
  await layerRow(page, "Card").nth(mainIndex).click({ modifiers: ["ControlOrMeta"] });
  await layerRow(page, "Component 1").click({ button: "right" });
  const combine = page.getByRole("menuitem", { name: /Combine as variants/ });
  check(await eventually(async () => (await combine.count()) === 1), "the context menu offers Combine as variants");
  await combine.click();
  check(await eventually(async () => (await label("Component 1"))?.includes("component_set")), `Component 1 should be a component set, got ${await label("Component 1")}`);
  check(await eventually(async () => (await layerRow(page, "Property 1=Variant2").count()) === 1), "the variants are named Property 1=…");
  await layerRow(page, "Card").nth(0).click();
  const picker = page.getByLabel("Property 1", { exact: true });
  check(await eventually(async () => (await picker.count()) === 1), "the instance shows a variant picker");
  check((await picker.inputValue()) === "Variant2", `the instance is Variant2, got ${await picker.inputValue()}`);
  await picker.selectOption("Default");
  check(await eventually(async () => (await picker.inputValue()) === "Default"), "the variant switches to Default");
  await canvas.focus();
  await press("ControlOrMeta+z");
  await layerRow(page, "Card").nth(0).click();
  check(await eventually(async () => (await picker.inputValue()) === "Variant2"), "undo switches it back");

  await page.screenshot({ path: `${outDir}/components.png` });
  await waitSaved(page);
  await context.close();
});
