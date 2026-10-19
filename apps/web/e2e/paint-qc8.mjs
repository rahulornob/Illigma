// QC round 8, paint panel fixes, end to end: a gradient back to Solid has no hidden alpha (the opacity shows
// and edits all of it); a click on a gradient stop only selects it (no move, no undo step); a stop moved
// past another by keyboard keeps focus; Escape mid-drag in a shadow's colour picker keeps the drag as one
// undo step and ⌘Z works; typed #rrggbbaa and #rgba set the opacity; Alt+↓ reorders with a description and
// an announcement; an open picker follows its paint when its swatch is dragged; several images dropped on
// the Fill card are one undo step; files dropped on a panel never leave the editor and are placed, with one
// message for those refused.
//
// The sample file: Desktop (1440 × 900, white) holds Hero (120, 160, 560 × 320, #D9D9D9) and Avatar (orange ellipse).
//
// Usage (from the repo root):  node apps/web/e2e/paint-qc8.mjs [--headed] [--no-build]

import { createFile, eventually, layerRow, newContext, runE2E, setField, watchErrors } from "./lib.mjs";

await runE2E("paint-qc8", {}, async ({ browser, url, log, check, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const props = page.getByRole("complementary", { name: "Properties" });
  const undo = async () => {
    await page.locator(".canvas").focus();
    await page.keyboard.press("ControlOrMeta+z");
  };

  /** Every node on disk, read from OPFS; a read that lands mid-save is retried. */
  const nodes = async (fileId) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await page.evaluate(async (id) => {
          const root = await navigator.storage.getDirectory();
          const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
          const read = async (d, name) => (await (await d.getFileHandle(name)).getFile()).text();
          const manifest = JSON.parse(await read(dir, "manifest.json"));
          const pages = await dir.getDirectoryHandle("pages");
          const out = [];
          for (const p of manifest.pages) out.push(...JSON.parse(await read(pages, `${p.id}.json`)));
          return out;
        }, fileId);
      } catch (e) {
        if (attempt >= 20) throw e;
        await page.waitForTimeout(100);
      }
    }
  };
  const saved = async (fileId, name, test, why) => {
    let last;
    const ok = await eventually(async () => {
      last = (await nodes(fileId)).find((n) => n.name === name);
      return last && test(last);
    }, 10_000);
    check(ok, `${why}: ${name} on disk is ${JSON.stringify(last)}`);
    return last;
  };
  /** Drop files (name → [width, height] PNG, or null for a file that isn't an image) on `selector`; returns whether the drop was cancelled (handled). */
  const dropFiles = (selector, files, at) =>
    page.evaluate(
      async ({ selector, files, at }) => {
        const dt = new DataTransfer();
        for (const [name, size] of files) {
          if (!size) {
            dt.items.add(new File(["not an image"], name, { type: "image/png" }));
            continue;
          }
          const c = new OffscreenCanvas(size[0], size[1]);
          const g = c.getContext("2d");
          g.fillStyle = "#00aaff";
          g.fillRect(0, 0, size[0], size[1]);
          dt.items.add(new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" }));
        }
        const target = document.querySelector(selector);
        const r = target.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: at?.x ?? r.x + r.width / 2, clientY: at?.y ?? r.y + Math.min(20, r.height / 2) };
        const over = !target.dispatchEvent(new DragEvent("dragover", opts));
        const drop = !target.dispatchEvent(new DragEvent("drop", opts));
        return { over, drop };
      },
      { selector, files, at },
    );

  log("open a new file, select Hero");
  const fileId = await createFile(page, url);
  const editorUrl = page.url();
  await layerRow(page, "Hero").click();
  await saved(fileId, "Hero", () => true, "Hero is saved");

  log("item 1: Linear, flipped, back to Solid: the colour is opaque and the opacity shows 0 %");
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  const picker = page.getByRole("dialog", { name: "Fill 1 colour" });
  await picker.waitFor();
  await picker.getByRole("button", { name: /^Paint type/ }).click();
  await page.getByRole("menuitemradio", { name: "Linear" }).click();
  await picker.getByRole("button", { name: "Flip gradient" }).click();
  await saved(fileId, "Hero", (n) => n.fills[0].type === "GRADIENT_LINEAR" && n.fills[0].gradientStops[0].color.a === 0, "the flipped gradient starts transparent");
  await picker.getByRole("button", { name: /^Paint type/ }).click();
  await page.getByRole("menuitemradio", { name: "Solid" }).click();
  await saved(fileId, "Hero", (n) => n.fills[0].type === "SOLID" && n.fills[0].color.a === 1 && n.fills[0].opacity === 0, "back to Solid: colour opaque, opacity 0");
  check((await picker.getByLabel("Opacity percent").inputValue()) === "0%", "the picker's opacity says 0 %");
  check((await props.getByLabel("Fill 1 opacity").inputValue()) === "0%", "the row's opacity says 0 %");
  await picker.getByRole("button", { name: "Close colour picker" }).click();
  await setField(page, "Fill 1 opacity", 100);
  await saved(fileId, "Hero", (n) => n.fills[0].color.a === 1 && !("opacity" in n.fills[0]), "100 % in the row leaves no hidden alpha");

  log("item 2: a click on a gradient stop only selects it");
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  await picker.waitFor();
  await picker.getByRole("button", { name: /^Paint type/ }).click();
  await page.getByRole("menuitemradio", { name: "Linear" }).click();
  const linear = await saved(fileId, "Hero", (n) => n.fills[0].type === "GRADIENT_LINEAR", "Linear again");
  const end = picker.getByRole("slider", { name: "Gradient stop 2 of 2" });
  const eb = await end.boundingBox();
  await page.mouse.click(eb.x + 2, eb.y + eb.height / 2); // off centre, no movement
  await page.mouse.move(eb.x + 3, eb.y + eb.height / 2); // a 1 px wobble while pressed is still a click
  await page.mouse.down();
  await page.mouse.move(eb.x + 4, eb.y + eb.height / 2);
  await page.mouse.up();
  check((await end.getAttribute("aria-valuetext")).startsWith("100%"), `the stop stays at 100 %, got ${await end.getAttribute("aria-valuetext")}`);
  await page.waitForTimeout(600);
  const afterClick = (await nodes(fileId)).find((n) => n.name === "Hero");
  check(JSON.stringify(afterClick.fills) === JSON.stringify(linear.fills), "the stops on disk are unchanged");
  await page.keyboard.press("Escape");
  await undo(); // the last step is the change to Linear, not a stop "move"
  await saved(fileId, "Hero", (n) => n.fills[0].type === "SOLID", "one undo goes back to Solid: the clicks added no undo step");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await saved(fileId, "Hero", (n) => n.fills[0].type === "GRADIENT_LINEAR", "redo: Linear");

  log("item 2: dragging a stop moves it from where it was grabbed, as one undo step");
  await layerRow(page, "Hero").click();
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  await picker.waitFor();
  const bar = await picker.locator(".stop-bar").boundingBox();
  const sb = await end.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2 + 3, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 3 - bar.width / 4, sb.y + sb.height / 2, { steps: 6 });
  await page.mouse.up();
  const dragged = await saved(fileId, "Hero", (n) => n.fills[0].gradientStops[1].position < 0.9, "the stop moved left");
  check(Math.abs(dragged.fills[0].gradientStops[1].position - 0.75) < 0.03, `it moved by the pointer's travel (a quarter of the bar), to ${dragged.fills[0].gradientStops[1].position}`);

  log("item 5: a stop moved past another by keyboard keeps focus");
  await page.mouse.click(bar.x + bar.width / 2, bar.y + 4); // a third stop at 50 %
  await saved(fileId, "Hero", (n) => n.fills[0].gradientStops.length === 3, "a third stop");
  await picker.getByRole("slider", { name: "Gradient stop 1 of 3" }).focus();
  const seen = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Shift+ArrowRight");
    seen.push(await page.evaluate(() => Number.parseInt(document.activeElement?.getAttribute("aria-valuetext") ?? "", 10)));
  }
  check(JSON.stringify(seen) === JSON.stringify([10, 20, 30, 40, 50, 60, 70, 80, 90]), `focus follows the moved stop past the others, got ${seen.join(", ")}`);
  check(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Gradient stop 3 of 3"), "it is now stop 3 of 3");
  await page.keyboard.press("Escape");

  log("item 3: Escape mid-drag in the shadow's colour picker");
  await props.getByRole("button", { name: "Add effect" }).click();
  const shadow0 = await saved(fileId, "Hero", (n) => n.effects?.length === 1, "a drop shadow");
  await props.getByRole("button", { name: "Effect 1 settings" }).click();
  const settings = page.getByRole("dialog", { name: "Effect 1: Drop shadow settings" });
  await settings.waitFor();
  await settings.getByRole("button", { name: /^Shadow colour:/ }).click();
  const sp = page.getByRole("dialog", { name: "Shadow colour" });
  await sp.waitFor();
  const area = await sp.locator(".sv-area").boundingBox();
  await page.mouse.move(area.x + 5, area.y + 5);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width - 5, area.y + 10, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  check(await eventually(async () => (await sp.count()) === 0, 2_000), "Escape closes the colour picker");
  check((await settings.count()) === 1, "the settings stay open");
  await saved(fileId, "Hero", (n) => n.effects[0].color.r > 0.5, "the drag is kept and saved (autosave isn't held)");
  await page.keyboard.press("ControlOrMeta+z");
  await saved(fileId, "Hero", (n) => JSON.stringify(n.effects) === JSON.stringify(shadow0.effects), "⌘Z undoes the whole drag");
  await setField(page, "Shadow X offset", 10);
  await saved(fileId, "Hero", (n) => n.effects[0].offset.x === 10 && n.effects[0].color.r === 0, "X is its own change; the drag stays undone");
  await page.keyboard.press("Escape");
  await undo();
  await saved(fileId, "Hero", (n) => JSON.stringify(n.effects) === JSON.stringify(shadow0.effects), "one undo takes back only the X change");

  log("item 11: typed #rrggbbaa in the row, #rgba in the picker, set the opacity");
  await layerRow(page, "Avatar").click();
  await props.getByRole("button", { name: "Add fill" }).click();
  await setField(page, "Fill 1 hex", "00FF0080");
  await saved(fileId, "Avatar", (n) => n.fills.length === 2 && n.fills[1].color.g === 1 && n.fills[1].color.a === 1 && Math.abs(n.fills[1].opacity - 128 / 255) < 1e-9, "the row's 8-digit hex: green, opacity 50 %");
  check((await props.getByLabel("Fill 1 opacity").inputValue()) === "50.2%", `the row shows 50.2 %, got ${await props.getByLabel("Fill 1 opacity").inputValue()}`);
  await props.getByRole("button", { name: /^Fill 1:/ }).click();
  const avatarPicker = page.getByRole("dialog", { name: "Fill 1 colour" });
  await avatarPicker.waitFor();
  await setField(page, "Hex colour", "F008");
  await saved(fileId, "Avatar", (n) => n.fills[1].color.r === 1 && n.fills[1].color.g === 0 && Math.abs(n.fills[1].opacity - 0x88 / 255) < 1e-9, "the picker's 4-digit hex: red, opacity 53 %");
  check((await avatarPicker.getByLabel("Opacity percent").inputValue()) === "53.33%", `the picker shows 53.33 %, got ${await avatarPicker.getByLabel("Opacity percent").inputValue()}`);
  await page.keyboard.press("Escape");

  log("item 10: Alt+↓ reorders, described and announced");
  const top = props.getByRole("button", { name: /^Fill 1:/ });
  check((await top.getAttribute("aria-description"))?.includes("Alt+Up and Alt+Down"), "the swatch describes Alt+↑ / Alt+↓");
  await top.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await saved(fileId, "Avatar", (n) => n.fills[0].color.r === 1 && n.fills[0].color.g === 0, "the red fill is now at the bottom");
  check(await eventually(async () => (await props.locator('.paint-card[aria-labelledby="fills-heading"] [role=status]').innerText()) === "Fill moved to position 2 of 2, now Fill 2"), "the move is announced");
  check(await eventually(async () => (await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")).startsWith("Fill 2: FF0000")), "focus stays on the moved swatch");

  log("item 9: the open picker follows its paint when its swatch is dragged");
  const red = props.getByRole("button", { name: /^Fill 2:/ });
  await red.click();
  const fill2 = page.getByRole("dialog", { name: "Fill 2 colour" });
  await fill2.waitFor();
  const rb = await red.boundingBox();
  const tb = await props.getByRole("button", { name: /^Fill 1:/ }).boundingBox();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 6 });
  await page.mouse.up();
  await saved(fileId, "Avatar", (n) => n.fills[1].color.r === 1 && n.fills[1].color.g === 0, "dragging the swatch put red on top");
  check(await eventually(async () => (await page.getByRole("dialog", { name: "Fill 1 colour" }).count()) === 1), "the picker now edits Fill 1, its paint");
  await setField(page, "Hex colour", "0000FF");
  const avatar = await saved(fileId, "Avatar", (n) => n.fills[1].color.b === 1, "the picker changed the paint it was opened for");
  check(avatar.fills[0].color.r > 0.5 && avatar.fills[0].color.b < 0.5, "and left the other paint alone");
  await page.keyboard.press("Escape");

  log("item 7: several images dropped on the Fill card: one paint each, one undo step");
  await layerRow(page, "Hero").click();
  const heroBefore = (await nodes(fileId)).find((n) => n.name === "Hero");
  const onCard = await dropFiles('.paint-card[aria-labelledby="fills-heading"] .card-head', [["One.png", [8, 8]], ["Two.png", [9, 9]]]);
  check(onCard.drop, "the card takes the drop");
  await saved(fileId, "Hero", (n) => n.fills.length === heroBefore.fills.length + 2 && n.fills.slice(-2).every((p) => p.type === "IMAGE"), "two image fills on top");
  await undo();
  await saved(fileId, "Hero", (n) => JSON.stringify(n.fills) === JSON.stringify(heroBefore.fills), "one undo takes both away");

  log("items 4 and 8: files dropped on the Layers panel stay in the editor, placed, with one message for those refused");
  const before = (await nodes(fileId)).length;
  const onPanel = await dropFiles(".panel-left", [["Good1.png", [30, 20]], ["Bad.png", null], ["Good2.png", [40, 20]]]);
  check(onPanel.over && onPanel.drop, "the window takes dragover and drop for files (the browser won't open them)");
  check(page.url() === editorUrl, "the editor is still open");
  check(await eventually(async () => (await layerRow(page, "Good1").count()) === 1 && (await layerRow(page, "Good2").count()) === 1), "both images are placed");
  const banner = page.locator(".banner-error", { hasText: "Bad.png" });
  await banner.waitFor({ timeout: 5_000 });
  check(/“Bad\.png” can't be used: it is not a PNG, JPEG, WebP or GIF image\./.test(await banner.innerText()), `one message names the refused file and why, got "${await banner.innerText()}"`);
  await banner.getByRole("button", { name: "OK" }).click();
  check(await eventually(async () => (await nodes(fileId)).length === before + 2, 10_000), "two layers saved");
  const onTitle = await dropFiles(".title-bar", [["Notes.png", null]]);
  check(onTitle.drop && page.url() === editorUrl, "a refused file dropped on the title bar doesn't leave the editor either");
  await page.locator(".banner-error").getByRole("button", { name: "OK" }).click();

  log("tester A: a PNG with a good header but damaged data is refused, not stored");
  const count = (await nodes(fileId)).length;
  await page.evaluate(() => {
    // Signature and an IHDR for 200 × 100, then garbage: the header checks pass, decoding fails.
    const b = new Uint8Array(33 + 256);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const v = new DataView(b.buffer);
    v.setUint32(8, 13);
    b.set([0x49, 0x48, 0x44, 0x52], 12);
    v.setUint32(16, 200);
    v.setUint32(20, 100);
    b.set([8, 6, 0, 0, 0], 24);
    for (let i = 33; i < b.length; i++) b[i] = (i * 37) & 0xff;
    const dt = new DataTransfer();
    dt.items.add(new File([b], "Corrupt.png", { type: "image/png" }));
    const target = document.querySelector(".canvas-area");
    const r = target.getBoundingClientRect();
    for (const type of ["dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
  });
  const corrupt = page.locator(".banner-error", { hasText: "Corrupt.png" });
  await corrupt.waitFor({ timeout: 5_000 });
  check((await corrupt.innerText()).includes("“Corrupt.png” can't be used: it isn't a readable image"), `the banner says the image isn't readable, got "${await corrupt.innerText()}"`);
  check((await layerRow(page, "Corrupt").count()) === 0, "no layer is added");
  await page.waitForTimeout(600);
  check((await nodes(fileId)).length === count, "nothing new is saved");
  await corrupt.getByRole("button", { name: "OK" }).click();
  await context.close();
});
