// Paints and effects in the Properties panel: change a fill's hex and see the
// canvas change, a linear gradient with an added stop, a stroke (inside by
// default) and its weight, a drop shadow added, edited and removed, layer
// opacity and blend mode, undo and redo back to the exact same layer and
// forward again, the colour picker by keyboard only (focus trapped, Escape
// returns focus), images by file chooser, by drop on the canvas and by
// paste, an image that is too big (its reason shown, nothing added), and
// everything still there after a reload (images too). axe finds nothing in
// the picker, the effect settings or the cards.
//
// The sample file: Desktop (1440 × 900, white) holds Hero (120, 160, 560 × 320, #D9D9D9) and Avatar (orange ellipse).
//
// Usage (from the repo root):  node apps/web/e2e/paint.mjs [--headed] [--no-build]

import { createRequire } from "node:module";
import { canvasReady, createFile, eventually, field, layerRow, newContext, runE2E, setField, watchErrors } from "./lib.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** A PNG header declaring `w` × `h` pixels and nothing else: the size check refuses it before anything decodes it. */
function pngHeader(w, h) {
  const b = Buffer.alloc(8 + 25);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  Buffer.from([8, 6, 0, 0, 0]).copy(b, 24);
  return b;
}

await runE2E("paint", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });
  const undo = () => page.keyboard.press("ControlOrMeta+z");
  const redo = () => page.keyboard.press("ControlOrMeta+Shift+z");

  /** Every node on disk (all pages) and the image files saved, read straight from OPFS. */
  const disk = (fileId) =>
    page.evaluate(async (id) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
      const read = async (d, name) => (await (await d.getFileHandle(name)).getFile()).text();
      const manifest = JSON.parse(await read(dir, "manifest.json"));
      const pages = await dir.getDirectoryHandle("pages");
      const nodes = [];
      for (const p of manifest.pages) nodes.push(...JSON.parse(await read(pages, `${p.id}.json`)));
      const images = [];
      try {
        for await (const [name] of (await dir.getDirectoryHandle("images")).entries()) images.push(name);
      } catch {
        // no images folder yet
      }
      return { nodes, images };
    }, fileId);
  /** Wait until the saved layer `name` passes `test`; returns it (fails with what was saved). */
  const saved = async (fileId, name, test, why) => {
    let last;
    const ok = await eventually(async () => {
      last = (await disk(fileId)).nodes.find((n) => n.name === name);
      return last && test(last);
    }, 10_000);
    check(ok, `${why}: ${name} on disk is ${JSON.stringify(last)}`);
    return last;
  };

  /** The average colour of a 4 × 4 CSS-pixel patch of the page at (x, y). */
  const pixel = async (x, y) => {
    const shot = (await page.screenshot({ clip: { x: x - 2, y: y - 2, width: 4, height: 4 } })).toString("base64");
    return page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
      return sum.map((s) => Math.round(s / (d.length / 4)));
    }, shot);
  };
  const near = (a, b, tol = 24) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  /** Wait until the pixel at (x, y) passes `test`. */
  const expectPixel = async (x, y, test, why) => {
    let got;
    const ok = await eventually(async () => test((got = await pixel(x, y))), 5_000);
    check(ok, `${why}: the canvas at (${Math.round(x)}, ${Math.round(y)}) is rgb(${got})`);
  };
  /** Clear the selection (so no handles or outlines cover the canvas), then run `fn`, then select `name` again. */
  const unselected = async (name, fn) => {
    await page.locator(".canvas").focus();
    await page.keyboard.press("Escape");
    await fn();
    await layerRow(page, name).click();
  };
  async function axe(where, selector) {
    if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath });
    const result = await page.evaluate((sel) => window.axe.run(sel, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }), selector);
    const v = result.violations.filter((x) => x.id !== "region"); // the popovers float over the canvas, outside any landmark by design
    check(v.length === 0, `${where}: axe found ${v.map((x) => `${x.id}: ${x.help} — ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`).join("\n  ")}`);
  }

  log("open a new file and select Hero: Appearance, Fill, Stroke and Effects cards");
  const fileId = await createFile(page, url);
  await layerRow(page, "Hero").click();
  for (const name of ["Appearance", "Fill", "Stroke", "Effects"]) check(await props.getByRole("heading", { name, exact: true }).isVisible(), `the ${name} card should show`);
  check((await props.getByLabel("Fill 1 hex").inputValue()) === "D9D9D9", "Hero's fill is D9D9D9");
  const base = await saved(fileId, "Hero", () => true, "Hero is saved");
  const box = await page.locator(".selection-box").boundingBox();
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await unselected("Hero", () => expectPixel(mid.x, mid.y, (p) => near(p, [217, 217, 217]), "Hero is drawn #D9D9D9"));

  log("change the fill's hex: the canvas turns red");
  await setField(page, "Fill 1 hex", "FF0000");
  await saved(fileId, "Hero", (n) => n.fills[0].color.r === 1 && n.fills[0].color.g === 0, "the fill is red");
  await unselected("Hero", () => expectPixel(mid.x, mid.y, (p) => near(p, [255, 0, 0]), "Hero is drawn red"));

  log("a linear gradient, and a stop added on the bar");
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  const picker = page.getByRole("dialog", { name: "Fill 1 colour" });
  await picker.waitFor();
  await picker.getByRole("button", { name: /^Paint type/ }).click();
  await page.getByRole("menuitemradio", { name: "Linear" }).click();
  await saved(fileId, "Hero", (n) => n.fills[0].type === "GRADIENT_LINEAR" && n.fills[0].gradientStops.length === 2, "the fill is a linear gradient");
  const bar = await picker.locator(".stop-bar").boundingBox();
  await page.mouse.click(bar.x + bar.width / 2, bar.y + 4);
  await saved(fileId, "Hero", (n) => n.fills[0].gradientStops.length === 3, "clicking the bar adds a stop");
  check(await picker.getByRole("slider", { name: "Gradient stop 2 of 3" }).isVisible(), "the new stop shows on the bar");
  await page.screenshot({ path: `${outDir}/paint-gradient.png` });
  await axe("colour picker (gradient)", ".color-picker");
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await picker.count()) === 0, 2_000), "Escape closes the picker");
  check(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Fill 1:")), "focus returns to the swatch");
  await unselected("Hero", async () => {
    // Top to bottom: red at the top, red fading out (to the white frame) at the bottom.
    await expectPixel(mid.x, box.y + 6, (p) => p[0] > 200 && p[1] < 60, "the gradient starts red at the top");
    await expectPixel(mid.x, box.y + box.height - 6, (p) => p[1] > 180, "and is almost transparent at the bottom");
  });

  log("a stroke: inside by default, 20 px");
  await props.getByRole("button", { name: "Add stroke" }).click();
  await saved(fileId, "Hero", (n) => n.strokes.length === 1 && n.strokeAlign === "INSIDE", "the first stroke on a rectangle goes inside");
  check((await props.getByRole("button", { name: /^Stroke position/ }).getAttribute("aria-label")) === "Stroke position: Inside", "the card says Inside");
  await setField(page, "Stroke weight", 20);
  await saved(fileId, "Hero", (n) => n.strokeWeight === 20, "the stroke weight is 20");
  const zoom = box.width / 560;
  await unselected("Hero", async () => {
    await expectPixel(box.x + 10 * zoom, box.y + box.height * 0.3, (p) => p.every((v) => v < 60), "the inside stroke is black just inside the edge");
    await expectPixel(box.x - 10 * zoom, box.y + box.height * 0.3, (p) => p.every((v) => v > 230), "and nothing is drawn outside it");
  });

  log("a drop shadow: added, moved 40 px down with no blur");
  await props.getByRole("button", { name: "Add effect" }).click();
  await saved(fileId, "Hero", (n) => n.effects?.[0]?.type === "DROP_SHADOW" && n.effects[0].offset.y === 4, "+ adds Figma's default drop shadow");
  await props.getByRole("button", { name: "Effect 1 settings" }).click();
  const settings = page.getByRole("dialog", { name: "Effect 1: Drop shadow settings" });
  await settings.waitFor();
  await axe("effect settings", ".effect-settings");
  await setField(page, "Shadow Y offset", 40);
  await setField(page, "Shadow blur", 0);
  await saved(fileId, "Hero", (n) => n.effects[0].offset.y === 40 && n.effects[0].radius === 0, "the shadow is 40 px down, sharp");
  await page.screenshot({ path: `${outDir}/paint-shadow.png` });
  await page.keyboard.press("Escape");
  const below = { x: mid.x, y: box.y + box.height + 20 * zoom };
  await unselected("Hero", () => expectPixel(below.x, below.y, (p) => p.every((v) => v < 230), "the shadow shows under Hero"));

  log("layer opacity and blend mode");
  await setField(page, "Layer opacity", 50);
  await props.getByRole("button", { name: /^Layer blend mode/ }).click();
  await page.getByRole("menuitemradio", { name: "Multiply" }).click();
  const all = await saved(fileId, "Hero", (n) => n.opacity === 0.5 && n.blendMode === "MULTIPLY", "opacity 50 % and Multiply");
  check((await props.getByRole("button", { name: /^Layer blend mode/ }).getAttribute("aria-label")) === "Layer blend mode: Multiply", "the menu button says Multiply");
  await axe("paint cards", ".panel-right .card");

  log("undo ten times: Hero exactly as it was; redo ten times: exactly as it became");
  await page.locator(".canvas").focus();
  for (let i = 0; i < 10; i++) await undo();
  await saved(fileId, "Hero", (n) => JSON.stringify(n) === JSON.stringify(base), "ten undos give back the original layer");
  for (let i = 0; i < 10; i++) await redo();
  await saved(fileId, "Hero", (n) => JSON.stringify(n) === JSON.stringify(all), "ten redos give back every change");

  log("remove the shadow (and undo that)");
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: "Remove effect 1" }).click();
  await saved(fileId, "Hero", (n) => n.effects === undefined, "no effects left means no effects field");
  await page.locator(".canvas").focus();
  await undo();
  await saved(fileId, "Hero", (n) => n.effects?.length === 1, "undo brings the shadow back");
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: "Remove effect 1" }).click();
  await saved(fileId, "Hero", (n) => n.effects === undefined, "removed again");

  log("the colour picker by keyboard only");
  await layerRow(page, "Avatar").click();
  await props.getByRole("button", { name: /^Fill 1:/ }).focus();
  await page.keyboard.press("Enter");
  const avatarPicker = page.getByRole("dialog", { name: "Fill 1 colour" });
  await avatarPicker.waitFor();
  check(await page.evaluate(() => !!document.activeElement?.closest(".color-picker")), "focus moves into the picker");
  const tabTo = async (name) => {
    for (let i = 0; i < 30; i++) {
      if ((await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === name) return true;
      await page.keyboard.press("Tab");
      check(await page.evaluate(() => !!document.activeElement?.closest(".color-picker")), "Tab stays inside the picker");
    }
    return false;
  };
  check(await tabTo("Saturation and brightness"), "Tab reaches the colour area");
  await page.keyboard.press("Home"); // saturation 0: a grey at the colour's brightness
  check(await eventually(async () => (await avatarPicker.getByLabel("Hex colour").inputValue()) === "FFFFFF"), "Home on the colour area takes the saturation to 0 (white at full brightness)");
  await page.keyboard.press("End"); // saturation 100
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowDown"); // brightness 100 → 50
  check(await tabTo("Hue"), "Tab reaches the hue slider");
  await page.keyboard.press("Home");
  check(await eventually(async () => (await avatarPicker.getByLabel("Hex colour").inputValue()) === "800000"), `saturation 100, brightness 50, hue 0 give #800000, got ${await avatarPicker.getByLabel("Hex colour").inputValue()}`);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Shift+ArrowRight"); // hue 0 → 120
  check(await eventually(async () => (await avatarPicker.getByLabel("Hex colour").inputValue()) === "008000"), "hue 120 gives #008000");
  check(await tabTo("Opacity"), "Tab reaches the opacity slider");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowLeft");
  check(await eventually(async () => (await avatarPicker.getByLabel("Opacity percent").inputValue()) === "70%"), "Shift+← ×3 gives 70 %");
  check(await tabTo("Hex colour"), "Tab reaches the hex field");
  await page.keyboard.type("3B82F6");
  await page.keyboard.press("Enter");
  await saved(fileId, "Avatar", (n) => Math.round(n.fills[0].color.b * 255) === 0xf6 && n.fills[0].opacity === 0.7, "the typed hex and the opacity are saved");
  await axe("colour picker (solid, keyboard)", ".color-picker");
  await page.screenshot({ path: `${outDir}/paint-picker-keyboard.png` });
  // Each key press is one undo step, as in Figma's fields: ⌘Z inside the picker steps back.
  await page.keyboard.press("Escape");
  check(await eventually(async () => (await avatarPicker.count()) === 0, 2_000), "Escape closes it");
  check(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Fill 1:")), "and returns focus to the swatch");

  log("an image fill from the file chooser");
  const magenta = Buffer.from(
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(64, 64);
      const g = c.getContext("2d");
      g.fillStyle = "#ff00ff";
      g.fillRect(0, 0, 64, 64);
      return [...new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer())];
    }),
  );
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  await picker.getByRole("button", { name: /^Paint type/ }).click();
  await page.getByRole("menuitemradio", { name: "Image" }).click();
  const chooser = page.waitForEvent("filechooser");
  await picker.getByRole("button", { name: "Choose image…" }).click();
  await (await chooser).setFiles({ name: "Magenta.png", mimeType: "image/png", buffer: magenta });
  await saved(fileId, "Hero", (n) => n.fills[0].type === "IMAGE" && /^[0-9a-f]{64}$/.test(n.fills[0].imageHash), "the fill is the chosen image");
  check(await eventually(async () => (await picker.locator(".image-preview img").count()) === 1), "the picker previews the image");
  await picker.getByRole("button", { name: /^Image scale mode/ }).click();
  await page.getByRole("menuitemradio", { name: "Tile" }).click();
  await setField(page, "Tile scale", 50);
  await saved(fileId, "Hero", (n) => n.fills[0].scaleMode === "TILE" && n.fills[0].scalingFactor === 0.5, "Tile at 50 %");
  await page.keyboard.press("Escape");
  // Hero is at 50 % opacity and Multiply over white: magenta stays magenta-ish.
  await unselected("Hero", () => expectPixel(mid.x, mid.y, (p) => p[1] < p[0] - 60 && p[1] < p[2] - 60, "the image shows on the canvas"));

  log("an image dropped on the canvas: a rectangle at its natural size, selected");
  const dropAt = { x: mid.x + 360 * zoom, y: mid.y + 280 * zoom };
  await page.evaluate(async ({ x, y }) => {
    const c = new OffscreenCanvas(120, 80);
    const g = c.getContext("2d");
    g.fillStyle = "#00ff00";
    g.fillRect(0, 0, 120, 80);
    const file = new File([await c.convertToBlob({ type: "image/png" })], "Green.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const target = document.querySelector(".canvas-area");
    for (const type of ["dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  }, dropAt);
  check(await eventually(async () => (await layerRow(page, "Green").count()) === 1), "the drop adds a layer named after the file");
  check(await eventually(async () => (await field(page, "Width")) === 120), "the new layer is selected, 120 wide");
  check((await field(page, "Height")) === 80, "and 80 high");
  await unselected("Green", () => expectPixel(dropAt.x, dropAt.y, (p) => near(p, [0, 255, 0], 40), "the dropped image is drawn where it was dropped"));

  log("an image pasted: placed in the middle of the view");
  await page.locator(".canvas").focus();
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(40, 40);
    c.getContext("2d").fillRect(0, 0, 40, 40);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: "image/png" })], "Pasted.png", { type: "image/png" }));
    document.querySelector(".canvas").dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
  });
  check(await eventually(async () => (await layerRow(page, "Pasted").count()) === 1), "a pasted image becomes a layer");

  log("an image too big to use: its reason shown, nothing added");
  const layersBefore = await page.locator(".layer-list .layer-row").count();
  await page.evaluate(
    ({ bytes, x, y }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "Huge.png", { type: "image/png" }));
      const target = document.querySelector(".canvas-area");
      for (const type of ["dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    },
    { bytes: [...pngHeader(20_000, 100)], ...dropAt },
  );
  const banner = page.locator(".banner-error", { hasText: "Huge.png" });
  await banner.waitFor({ timeout: 5_000 });
  check(/too big \(20,000 × 100 pixels/.test(await banner.innerText()), `the banner gives the reason, got "${await banner.innerText()}"`);
  check((await page.locator(".layer-list .layer-row").count()) === layersBefore, "nothing is added");
  await banner.getByRole("button", { name: "OK" }).click();

  log("reload: every change is still there, images too");
  let images = [];
  check(await eventually(async () => (images = (await disk(fileId)).images).length === 3, 10_000), `the three images in use are saved in the package, got ${images.join(", ")}`);
  await page.reload();
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check(await eventually(async () => (await props.getByRole("button", { name: /^Fill 1:/ }).getAttribute("aria-label")) === "Fill 1: Image. Open colour picker"), "Hero's image fill came back");
  check((await props.getByLabel("Layer opacity").inputValue()) === "50", "opacity 50 % came back");
  check((await props.getByRole("button", { name: /^Stroke position/ }).getAttribute("aria-label")) === "Stroke position: Inside", "the inside stroke came back");
  await layerRow(page, "Green").click();
  let green;
  // The selection box moves to Green on the next frame.
  await eventually(async () => {
    green = await page.locator(".selection-box").boundingBox();
    return green && Math.abs(green.width / green.height - 1.5) < 0.05;
  });
  await unselected("Green", () => expectPixel(green.x + green.width / 2, green.y + green.height / 2, (p) => near(p, [0, 255, 0], 40), "the dropped image draws again after a reload"));
  await page.screenshot({ path: `${outDir}/paint-reloaded.png` });
  await context.close();
});
