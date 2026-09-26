import { test, expect } from "@playwright/test";

async function state(page) {
  return page.evaluate(() => {
    const matrix = document
      .getElementById("viewport")
      .transform.baseVal.consolidate().matrix;
    return {
      doc: JSON.parse(localStorage.getItem("illigma.document.v1")),
      selected: [...document.querySelectorAll(".layer-row[data-layer].selected")].map(
        (row) => row.dataset.layer,
      ),
      zoom: matrix.a,
      pan: { x: matrix.e, y: matrix.f },
    };
  });
}
async function at(page, x, y) {
  const s = await state(page),
    box = await page.locator("#canvas").boundingBox();
  return { x: box.x + s.pan.x + x * s.zoom, y: box.y + s.pan.y + y * s.zoom };
}
async function drag(page, from, to, options = {}) {
  const a = await at(page, ...from),
    b = await at(page, ...to);
  if (options.shift) await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  if (options.shift) await page.keyboard.up("Shift");
}
async function draw(
  page,
  tool = "Rectangle",
  from = [160, 150],
  to = [360, 300],
) {
  await page.getByRole("button", { name: `${tool} tool`, exact: true }).click();
  await drag(page, from, to);
}
async function blank(page) {
  await page
    .getByRole("button", { name: "Document menu", exact: true })
    .click();
  await page.getByRole("button", { name: "New document", exact: true }).click();
}
async function selectAll(page) {
  await page.locator("#canvas").focus();
  await page.keyboard.press("ControlOrMeta+a");
}
async function property(page, label, value) {
  const input = page.getByRole("spinbutton", { name: label, exact: true });
  await input.fill(String(value));
  await input.press("Tab");
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page._errors = errors;
  await page.goto("/");
  await expect(page.locator("#objects > g")).toHaveCount(13);
});
test.afterEach(async ({ page }) => expect(page._errors).toEqual([]));

test("shell uses exact design tokens and renders editable artwork", async ({
  page,
}) => {
  await expect(page.locator("#selection-name")).toHaveText("Blue orbit");
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return [
      "--canvas-void",
      "--panel-surface",
      "--hover-active",
      "--text-primary",
      "--text-muted",
      "--border",
      "--accent",
      "--panel-padding",
    ].map((t) => s.getPropertyValue(t));
  });
  expect(tokens).toEqual([
    "#090909",
    "#141414",
    "#1c1c1c",
    "#ffffff",
    "#999999",
    "#262626",
    "#0099ff",
    "15px",
  ]);
  await expect(page.locator("[data-handle]")).toHaveCount(4);
});

test("draw, move, edit geometry, recolor, undo and reload", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  await expect(page.locator("#objects > g")).toHaveCount(1);
  let o = (await state(page)).doc.objects[0];
  expect(o.w).toBeCloseTo(200);
  expect(o.h).toBeCloseTo(150);
  await drag(page, [230, 230], [270, 260]);
  await expect(
    page.getByRole("spinbutton", { name: "X position" }),
  ).toHaveValue("200");
  await expect(
    page.getByRole("spinbutton", { name: "Y position" }),
  ).toHaveValue("180");
  await property(page, "Width", 240);
  await property(page, "Opacity", 55);
  const fill = page.getByRole("textbox", { name: "Fill hex", exact: true });
  await fill.fill("FA633B");
  await fill.press("Tab");
  o = (await state(page)).doc.objects[0];
  expect(o.w).toBe(240);
  expect(o.opacity).toBe(0.55);
  expect(o.fill).toBe("#fa633b");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await state(page)).doc.objects[0].fill).toBe("#2353e8");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await expect(page.locator("#objects > g")).toHaveCount(1);
  expect((await state(page)).doc.objects[0].fill).toBe("#fa633b");
});

test("corner resize handles and rotation property change geometry", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  const handle = page.locator('[data-handle="se"]'),
    p = await handle.boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  const target = await at(page, 440, 350);
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  let o = (await state(page)).doc.objects[0];
  expect(o.w).toBeCloseTo(280, 0);
  expect(o.h).toBeCloseTo(200, 0);
  await expect(page.locator('[data-handle="rotate"]')).toHaveCount(0);
  await expect(page.locator("[data-size-badge]")).toContainText("280 × 200");
  await property(page, "Rotation", 90);
  o = (await state(page)).doc.objects[0];
  expect(o.rotation).toBeCloseTo(90, 0);
});

test("ellipse and multiselect alignment respect artboard and selection", async ({
  page,
}) => {
  await blank(page);
  await draw(page, "Ellipse", [180, 160], [330, 310]);
  await draw(page, "Rectangle", [400, 300], [540, 440]);
  await selectAll(page);
  await page.getByRole("button", { name: "Align top", exact: true }).click();
  const objects = (await state(page)).doc.objects;
  expect(objects[0].y).toBeCloseTo(objects[1].y);
  expect(objects[0].type).toBe("ellipse");
});

test("layers hide, lock, rename and reorder the SVG paint stack", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  await draw(page, "Ellipse", [390, 250], [530, 390]);
  await page.getByRole("button", { name: "Hide Ellipse", exact: true }).click();
  await expect(page.locator("#objects > g")).toHaveCount(1);
  await page.getByRole("button", { name: "Show Ellipse", exact: true }).click();
  await page.getByRole("button", { name: "Lock Ellipse", exact: true }).click();
  await selectAll(page);
  expect((await state(page)).selected).toHaveLength(1);
  await page
    .getByRole("button", { name: "Unlock Ellipse", exact: true })
    .click();
  const name = page
    .locator(".layer-row[data-layer]")
    .filter({ has: page.locator(".layer-name", { hasText: /^Ellipse$/ }) })
    .locator(".layer-name");
  await name.dblclick();
  await page.getByRole("textbox", { name: "Layer name" }).fill("Moon");
  await page.getByRole("textbox", { name: "Layer name" }).press("Enter");
  const rows = page.locator(".layer-row[data-layer]");
  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 80, y: 4 } });
  expect((await state(page)).doc.objects.map((o) => o.name)).toEqual([
    "Moon",
    "Rectangle",
  ]);
});

for (const [operation, area] of [
  ["unite", 70000],
  ["subtract", 30000],
  ["intersect", 10000],
  ["exclude", 60000],
]) {
  test(`pathfinder ${operation} computes real vector geometry`, async ({
    page,
  }) => {
    await blank(page);
    await draw(page, "Rectangle", [150, 150], [350, 350]);
    await draw(page, "Rectangle", [250, 250], [450, 450]);
    await selectAll(page);
    await page.locator(`[data-boolean="${operation}"]`).click();
    const s = await state(page);
    expect(s.doc.objects).toHaveLength(1);
    expect(s.doc.objects[0].type).toBe("path");
    const actual = await page.evaluate(async () => {
      const state = {
        doc: JSON.parse(localStorage.getItem("illigma.document.v1")),
      };
      const { worldPath } = await import("/src/geometry.js");
      const p = worldPath(state.doc.objects[0]);
      const a = Math.abs(p.area);
      p.remove();
      return a;
    });
    expect(actual).toBeCloseTo(area, 0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator("#objects > g")).toHaveCount(2);
  });
}

test("pen creates curved closed paths and direct selection moves anchors", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  const first = await at(page, 200, 180);
  await page.mouse.click(first.x, first.y);
  await drag(page, [400, 180], [440, 250]);
  const third = await at(page, 350, 400);
  await page.mouse.click(third.x, third.y);
  await page.mouse.click(first.x, first.y);
  let o = (await state(page)).doc.objects[0];
  expect(o.d).toMatch(/c/i);
  expect(o.d).toMatch(/z/i);
  await page
    .getByRole("button", { name: "Direct selection tool", exact: true })
    .click();
  const anchor = page.locator('[data-anchor$=":point"]').first();
  await expect(anchor).toBeVisible();
  const a = await anchor.boundingBox();
  const before = o.d;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x - 35, a.y - 30, { steps: 8 });
  await page.mouse.up();
  o = (await state(page)).doc.objects[0];
  expect(o.d).not.toBe(before);
  expect(o.x).toBeLessThan(200);
});

test("type tool creates and edits multiline text with contextual typography", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Type tool", exact: true }).click();
  const p = await at(page, 200, 180);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole("textbox", { name: "Edit canvas text" })
    .fill("Hello\nvector world");
  await page
    .getByRole("textbox", { name: "Edit canvas text" })
    .press("ControlOrMeta+Enter");
  expect((await state(page)).doc.objects[0].text).toBe("Hello\nvector world");
  await expect(page.locator("#text-properties")).toBeVisible();
  await property(page, "Font size", 64);
  expect((await state(page)).doc.objects[0].fontSize).toBe(64);
  await page
    .getByRole("button", { name: "Selection tool", exact: true })
    .click();
  const hit = page.locator("[data-text-hit]");
  await hit.dblclick();
  await page.getByRole("textbox", { name: "Edit canvas text" }).fill("Edited");
  await page
    .getByRole("textbox", { name: "Edit canvas text" })
    .press("ControlOrMeta+Enter");
  expect((await state(page)).doc.objects[0].text).toBe("Edited");
});

test("shape builder deletes only the overlap region", async ({ page }) => {
  await blank(page);
  await draw(page, "Rectangle", [150, 150], [350, 350]);
  await draw(page, "Rectangle", [250, 250], [450, 450]);
  await selectAll(page);
  await page
    .getByRole("button", { name: "Shape builder tool", exact: true })
    .click();
  const p = await at(page, 300, 300);
  await page.keyboard.down("Alt");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Alt");
  const result = await page.evaluate(async () => {
    const state = {
      doc: JSON.parse(localStorage.getItem("illigma.document.v1")),
    };
    const { worldPath, paper } = await import("/src/geometry.js");
    return state.doc.objects.map((o) => {
      const p = worldPath(o);
      return {
        area: Math.abs(p.area),
        overlap: p.contains(new paper.Point(300, 300)),
      };
    });
  });
  expect(result.every((r) => !r.overlap)).toBe(true);
  expect(result.reduce((sum, r) => sum + r.area, 0)).toBeCloseTo(60000, 0);
});

test("shape builder merges regions crossed by a drag", async ({ page }) => {
  await blank(page);
  await draw(page, "Rectangle", [150, 150], [350, 350]);
  await draw(page, "Rectangle", [250, 250], [450, 450]);
  await selectAll(page);
  await page
    .getByRole("button", { name: "Shape builder tool", exact: true })
    .click();
  await drag(page, [200, 200], [400, 400]);
  expect((await state(page)).doc.objects).toHaveLength(1);
  const area = await page.evaluate(async () => {
    const state = {
      doc: JSON.parse(localStorage.getItem("illigma.document.v1")),
    };
    const { worldPath } = await import("/src/geometry.js");
    return Math.abs(worldPath(state.doc.objects[0]).area);
  });
  expect(area).toBeCloseTo(70000, 0);
});

test("eyedropper preserves selection and applies sampled fill", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  const fill = page.getByRole("textbox", { name: "Fill hex", exact: true });
  await fill.fill("FA633B");
  await fill.press("Tab");
  await draw(page, "Ellipse", [450, 150], [600, 300]);
  await fill.fill("2353E8");
  await fill.press("Tab");
  await page
    .getByRole("button", { name: "Eyedropper tool", exact: true })
    .click();
  const p = await at(page, 250, 220);
  await page.mouse.click(p.x, p.y);
  const s = await state(page);
  expect(s.selected).toEqual([s.doc.objects[1].id]);
  expect(s.doc.objects[1].fill).toBe("#fa633b");
});

test("color picker RGB and stroke controls update selected objects", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  await page
    .getByRole("button", { name: "Select stroke", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Color hex", exact: true })
    .fill("#00ff00");
  await page
    .getByRole("textbox", { name: "Color hex", exact: true })
    .press("Tab");
  let o = (await state(page)).doc.objects[0];
  expect(o.stroke).toBe("#00ff00");
  expect(o.strokeWidth).toBe(1);
  await property(page, "Red", 128);
  o = (await state(page)).doc.objects[0];
  expect(o.stroke).toBe("#80ff00");
  const square = await page.locator("#color-square").boundingBox();
  await page.mouse.click(
    square.x + square.width * 0.5,
    square.y + square.height * 0.5,
  );
  expect((await state(page)).doc.objects[0].stroke).not.toBe("#80ff00");
});

test("zoom and pan preserve object positions; exported SVG is clean", async ({
  page,
}) => {
  const before = await state(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await state(page)).zoom).toBeGreaterThan(before.zoom);
  await page.getByRole("button", { name: "Hand tool", exact: true }).click();
  await drag(page, [300, 300], [340, 320]);
  const after = await state(page);
  expect(after.doc.objects).toEqual(before.doc.objects);
  expect(after.pan.x).not.toBe(before.pan.x);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Objects in motion.svg");
  const svg = await (
    await import("node:fs/promises")
  ).readFile(await download.path(), "utf8");
  expect(svg).toContain('viewBox="0 0 1000 720"');
  expect(svg).not.toContain("data-handle");
  expect(svg).not.toContain("data-object");
  expect(svg).toContain("Objects in motion");
});

test("zoom reaches 25600% maximum and 2% minimum limits", async ({ page }) => {
  for (let i = 0; i < 35; i++) {
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  }
  let s = await state(page);
  expect(s.zoom).toBe(256);
  await expect(page.locator("#zoom-value")).toHaveText("25600%");

  for (let i = 0; i < 60; i++) {
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  }
  s = await state(page);
  expect(s.zoom).toBeCloseTo(0.02, 4);
  await expect(page.locator("#zoom-value")).toHaveText("2%");
});

test("invalid imported files are rejected without changing the document", async ({
  page,
}) => {
  const before = (await state(page)).doc;
  await page.locator("#file-input").setInputFiles({
    name: "bad.illigma",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        title: "<script>bad</script>",
        objects: [],
      }),
    ),
  });
  await expect(page.getByRole("status")).toContainText("not a valid");
  expect((await state(page)).doc).toEqual(before);
});

test("editable file round-trip restores objects, text, and palette", async ({
  page,
}) => {
  const before = (await state(page)).doc;
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Document menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save editable file", exact: true })
    .click();
  const download = await downloadPromise;
  const buffer = await (
    await import("node:fs/promises")
  ).readFile(await download.path());
  await blank(page);
  expect((await state(page)).doc.objects).toHaveLength(0);
  await page.locator("#file-input").setInputFiles({
    name: "artwork.illigma",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.locator("#objects > g")).toHaveCount(13);
  expect((await state(page)).doc).toEqual(before);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#objects > g")).toHaveCount(0);
});

test("shape builder treats disconnected regions independently", async ({
  page,
}) => {
  await blank(page);
  await draw(page, "Rectangle", [200, 180], [500, 400]);
  await draw(page, "Rectangle", [320, 130], [380, 450]);
  await selectAll(page);
  await page
    .getByRole("button", { name: "Shape builder tool", exact: true })
    .click();
  const p = await at(page, 250, 280);
  await page.keyboard.down("Alt");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Alt");
  const hits = await page.evaluate(async () => {
    const doc = JSON.parse(localStorage.getItem("illigma.document.v1"));
    const { worldPath, paper } = await import("/src/geometry.js");
    const paths = doc.objects.map(worldPath);
    return {
      left: paths.some((p) => p.contains(new paper.Point(250, 280))),
      right: paths.some((p) => p.contains(new paper.Point(450, 280))),
      middle: paths.some((p) => p.contains(new paper.Point(350, 280))),
    };
  });
  expect(hits).toEqual({ left: false, right: true, middle: true });
});

test("marquee, keyboard nudge, duplicate, delete and gesture cancellation", async ({
  page,
}) => {
  await blank(page);
  await draw(page, "Rectangle", [150, 150], [250, 250]);
  await draw(page, "Ellipse", [400, 150], [500, 250]);
  await drag(page, [120, 120], [530, 280]);
  expect((await state(page)).selected).toHaveLength(2);
  await page.keyboard.press("Shift+ArrowRight");
  expect((await state(page)).doc.objects[0].x).toBeCloseTo(160, 0);
  await page.keyboard.press("ControlOrMeta+d");
  expect((await state(page)).doc.objects).toHaveLength(4);
  await page.keyboard.press("Backspace");
  expect((await state(page)).doc.objects).toHaveLength(2);
  const before = (await state(page)).doc;
  const a = await at(page, 200, 200),
    b = await at(page, 300, 300);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await state(page)).doc).toEqual(before);
});

test("pen keeps rapid clicks and native double clicks in one draft", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  const points = [
    [180, 180],
    [280, 190],
    [370, 260],
    [450, 180],
  ];
  for (const [index, point] of points.entries()) {
    const p = await at(page, ...point);
    await page.mouse.click(p.x, p.y, { clickCount: index === 1 ? 2 : 1 });
  }
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(4);
  expect((await state(page)).doc.objects).toHaveLength(0);
  await page.keyboard.press("Enter");
  expect((await state(page)).doc.objects).toHaveLength(1);
  const count = await page.evaluate(async () => {
    const doc = JSON.parse(localStorage.getItem("illigma.document.v1"));
    const { localPath } = await import("/src/geometry.js");
    const p = localPath(doc.objects[0]);
    return p.children[0].segments.length;
  });
  expect(count).toBe(4);
});

test("pen previews next curve and closure without adding anchors", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  await drag(page, [200, 200], [245, 245]);
  const p = await at(page, 400, 250);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator("[data-pen-preview]")).toHaveAttribute("d", /C/);
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(1);
  await page.mouse.click(p.x, p.y);
  const first = await at(page, 200, 200);
  await page.mouse.move(first.x, first.y);
  await expect(page.locator("[data-pen-close]")).toBeVisible();
  await page.mouse.click(first.x, first.y);
  const objects = (await state(page)).doc.objects;
  expect(objects).toHaveLength(1);
  expect(objects[0].d).toMatch(/z/i);
});

test("pen filters click jitter and supports draft undo redo and delete", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  const p = await at(page, 200, 200);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 1, p.y + 1);
  await page.mouse.up();
  const second = await at(page, 400, 250);
  await page.mouse.click(second.x, second.y);
  await expect(page.locator("[data-pen-draft]")).not.toHaveAttribute("d", /C/);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(2);
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("Enter");
  expect((await state(page)).doc.objects).toHaveLength(1);
});

test("pen Alt drag breaks the outgoing handle without changing the incoming curve", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  const start = await at(page, 180, 180);
  await page.mouse.click(start.x, start.y);
  await drag(page, [350, 250], [400, 300]);
  const original = await page.locator("[data-pen-draft]").getAttribute("d");
  await page.keyboard.down("Alt");
  await drag(page, [350, 250], [420, 220]);
  await page.keyboard.up("Alt");
  await expect(page.locator("[data-pen-anchor]")).toHaveCount(2);
  await expect(page.locator("[data-pen-draft]")).toHaveAttribute("d", original);
  const next = await at(page, 500, 350);
  await page.mouse.move(next.x, next.y);
  await expect(page.locator("[data-pen-preview]")).toHaveAttribute(
    "d",
    /C 420/,
  );
});

test("move tool selects and drags a thin open stroke with screen-space tolerance", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  for (const point of [
    [200, 200],
    [500, 200],
  ]) {
    const p = await at(page, ...point);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  const empty = await at(page, 650, 450);
  await page.mouse.click(empty.x, empty.y);
  const before = (await state(page)).doc.objects[0];
  const p = await at(page, 350, 200);
  await page.mouse.move(p.x, p.y + 4);
  await page.mouse.down();
  await page.mouse.move(p.x + 35, p.y + 24, { steps: 5 });
  await page.mouse.up();
  const after = await state(page);
  expect(after.selected).toEqual([before.id]);
  expect(after.doc.objects[0].x).toBeGreaterThan(before.x + 30);
  expect(after.doc.objects[0].y).toBeGreaterThan(before.y + 20);
});

test("layer selection exits pen drawing, commits draft, and enables moving the selected stroke", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  for (const point of [
    [200, 200],
    [500, 200],
  ]) {
    const p = await at(page, ...point);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press("Enter");
  const first = (await state(page)).doc.objects[0];
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  for (const point of [
    [200, 350],
    [500, 350],
  ]) {
    const p = await at(page, ...point);
    await page.mouse.click(p.x, p.y);
  }
  await page.locator(`[data-layer="${first.id}"] .layer-name`).click();
  await expect(page.locator("#canvas")).toHaveAttribute("data-tool", "select");
  await expect(page.locator("[data-pen-draft]")).toHaveCount(0);
  await expect(page.locator("[data-handle]")).toHaveCount(4);
  expect((await state(page)).selected).toEqual([first.id]);
  expect((await state(page)).doc.objects).toHaveLength(2);
  await page.keyboard.press("ArrowRight");
  expect((await state(page)).doc.objects[0].x).toBeCloseTo(first.x + 1);
});

test("text editing fits small styled text and preserves transformed text geometry", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Unlock Collection label", exact: true })
    .click();
  const doc = (await state(page)).doc;
  const label = doc.objects.find((o) => o.name === "Collection label");
  await page.locator(`[data-object="${label.id}"] [data-text-hit]`).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit canvas text" });
  await expect(editor).toBeVisible();
  const style = await editor.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      background: s.backgroundColor,
      resize: s.resize,
      fontSize: s.fontSize,
      spacing: s.letterSpacing,
      height: e.getBoundingClientRect().height,
    };
  });
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.resize).toBe("none");
  expect(style.fontSize).toBe("11px");
  expect(style.spacing).toBe("2.5px");
  expect(style.height).toBeLessThan(25);
  await expect(page.locator(`[data-object="${label.id}"]`)).toBeHidden();
  await expect(page.locator("[data-handle]")).toHaveCount(0);
  await editor.press("ControlOrMeta+Enter");
  expect(
    (await state(page)).doc.objects.find((o) => o.id === label.id),
  ).toEqual(label);
  await page.locator(`[data-layer="${label.id}"] .layer-name`).click();
  await property(page, "Width", label.w * 2);
  await property(page, "Rotation", 30);
  const transformed = (await state(page)).doc.objects.find(
    (o) => o.id === label.id,
  );
  await page.locator(`[data-object="${label.id}"] [data-text-hit]`).dblclick();
  await editor.press("ControlOrMeta+Enter");
  expect(
    (await state(page)).doc.objects.find((o) => o.id === label.id),
  ).toEqual(transformed);
});

for (const [operation, count, area] of [
  ["divide", 3, 70000],
  ["trim", 2, 70000],
  ["merge", 1, 70000],
  ["crop", 1, 10000],
  ["outline", 12, null],
  ["minus-back", 1, 30000],
]) {
  test(`additional Pathfinder ${operation} creates editable geometry and supports undo`, async ({
    page,
  }) => {
    await blank(page);
    await draw(page, "Rectangle", [150, 150], [350, 350]);
    await draw(page, "Rectangle", [250, 250], [450, 450]);
    await selectAll(page);
    await page.locator(`[data-boolean="${operation}"]`).click();
    const objects = (await state(page)).doc.objects;
    expect(objects).toHaveLength(count);
    expect(objects.every((o) => o.type === "path")).toBe(true);
    if (area !== null) {
      const total = await page.evaluate(async () => {
        const { worldPath } = await import("/src/geometry.js");
        return JSON.parse(
          localStorage.getItem("illigma.document.v1"),
        ).objects.reduce((sum, o) => {
          const p = worldPath(o);
          const a = Math.abs(p.area);
          p.remove();
          return sum + a;
        }, 0);
      });
      expect(total).toBeCloseTo(area, 0);
    } else {
      expect(
        objects.every((o) => o.fill === "none" && o.strokeWidth === 1),
      ).toBe(true);
      expect(objects.some((o) => o.h === 1)).toBe(true);
    }
    if (["trim", "merge", "crop"].includes(operation))
      expect(objects.every((o) => o.strokeWidth === 0)).toBe(true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await state(page)).doc.objects).toHaveLength(2);
  });
}

test("artboard label keeps constant screen size during zoom and selects artboard properties", async ({
  page,
}) => {
  const label = page.locator("#artboard-label");
  const before = await label.boundingBox();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  const after = await label.boundingBox();
  expect(after.height).toBeCloseTo(before.height, 1);
  expect(after.width).toBeCloseTo(before.width, 1);
  await label.click();
  await expect(page.locator("#selection-type")).toHaveText("Frame");
  await expect(page.locator("[data-artboard-selection]")).toHaveCount(1);
  await property(page, "Width", 1200);
  expect((await state(page)).doc.artboard.width).toBe(1200);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await state(page)).doc.artboard.width).toBe(1000);
});

test("artboard name can be renamed and selected from layers", async ({
  page,
}) => {
  await page.locator("#artboard-label").dblclick();
  const input = page.getByRole("textbox", {
    name: "Frame name",
    exact: true,
  });
  await expect(input).toBeVisible();
  await input.fill("Poster exploration");
  await input.press("Enter");
  await expect(page.locator("#artboard-label")).toContainText(
    "Poster exploration",
  );
  await expect(page.locator("#artboard-tree")).toContainText(
    "Poster exploration",
  );
  await page.locator("#artboard-tree span").first().click();
  await expect(page.locator("#selection-name")).toHaveText(
    "Poster exploration",
  );
  await page.reload();
  await expect(page.locator("#artboard-label")).toContainText(
    "Poster exploration",
  );
});

test("color picker combines swatches in a dismissible floating popout", async ({
  page,
}) => {
  const popup = page.getByRole("dialog", { name: "Color picker", exact: true });
  await expect(popup).toBeHidden();
  await page.getByRole("button", { name: "Select fill", exact: true }).click();
  await expect(popup).toBeVisible();
  await expect(popup.locator("#color-square")).toBeVisible();
  await expect(popup.locator("#swatches")).toBeVisible();
  await popup
    .getByRole("button", { name: "Apply #fa633b to fill", exact: true })
    .click();
  expect(
    (await state(page)).doc.objects.find((o) => o.name === "Blue orbit").fill,
  ).toBe("#fa633b");
  await page
    .getByRole("button", { name: "Close color picker", exact: true })
    .click();
  await expect(popup).toBeHidden();
  await page
    .getByRole("button", { name: "Select stroke", exact: true })
    .click();
  await expect(popup).toBeVisible();
  await page.getByRole("textbox", { name: "Color hex", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  expect((await state(page)).selected).toHaveLength(1);
});

test("local font imports, applies to text, and survives reload", async ({
  page,
}) => {
  await page
    .locator(".layer-row[data-layer]")
    .filter({ has: page.locator(".layer-name", { hasText: /^Title$/ }) })
    .click();
  await page.getByRole("button", { name: "Add fonts", exact: true }).click();
  await page.getByRole("button", { name: "Local files", exact: true }).click();
  await page.locator("#local-font-family").fill("Studio Local");
  await page
    .locator("#local-font-file")
    .setInputFiles(
      "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
    );
  await page
    .getByRole("button", { name: "Import local font", exact: true })
    .click();
  await expect(page.locator("#font-status")).toContainText(
    "Studio Local added and applied",
  );
  expect(
    (await state(page)).doc.objects.find(
      (o) => o.text === "Objects\nin motion.",
    ).fontFamily,
  ).toBe("Studio Local");
  await page
    .getByRole("button", { name: "Close font library", exact: true })
    .click();
  await expect(page.locator("#font-family")).toHaveValue("Studio Local");
  await page.reload();
  await expect(page.locator("#objects > g")).toHaveCount(13);
  expect(
    await page.evaluate(() => document.fonts.check('16px "Studio Local"')),
  ).toBe(true);
  expect(
    (await state(page)).doc.objects.find(
      (o) => o.text === "Objects\nin motion.",
    ).fontFamily,
  ).toBe("Studio Local");
});

test("Google font downloads, applies, and is cached for offline reload", async ({
  page,
}) => {
  const font = await (
    await import("node:fs/promises")
  ).readFile(
    "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
  );
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({
      contentType: "text/css",
      body: '@font-face { font-family: "Studio Google"; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/test-font.woff2) format("woff2"); unicode-range: U+0-10FFFF; }',
    }),
  );
  await page.route("https://fonts.gstatic.com/**", (route) =>
    route.fulfill({ contentType: "font/woff2", body: font }),
  );
  await page
    .locator(".layer-row[data-layer]")
    .filter({ has: page.locator(".layer-name", { hasText: /^Title$/ }) })
    .click();
  await page.getByRole("button", { name: "Add fonts", exact: true }).click();
  await page.locator("#google-font-name").fill("Studio Google");
  await page
    .getByRole("button", { name: "Add Google font", exact: true })
    .click();
  await expect(page.locator("#font-status")).toContainText(
    "Studio Google added and applied",
  );
  await page.unroute("https://fonts.googleapis.com/**");
  await page.unroute("https://fonts.gstatic.com/**");
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.reload();
  await expect(page.locator("#objects > g")).toHaveCount(13);
  expect(
    await page.evaluate(() => document.fonts.check('16px "Studio Google"')),
  ).toBe(true);
});

test("eyedropper shows a live color preview and custom cursor", async ({
  page,
}) => {
  await blank(page);
  await draw(page);
  await page
    .getByRole("button", { name: "Eyedropper tool", exact: true })
    .click();
  const point = await at(page, 230, 230);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator("#eyedropper-preview")).toBeVisible();
  await expect(page.locator("#eyedropper-value")).toHaveText("#2353E8");
  expect(
    await page.locator("#canvas").evaluate((e) => getComputedStyle(e).cursor),
  ).toContain("data:image/svg+xml");
  const empty = await at(page, 600, 400);
  await page.mouse.move(empty.x, empty.y);
  await expect(page.locator("#eyedropper-value")).toHaveText("#FFFFFF");
  await page
    .getByRole("button", { name: "Selection tool", exact: true })
    .click();
  await expect(page.locator("#eyedropper-preview")).toBeHidden();
});

test("pages keep separate artwork and survive reload, deletion, and undo", async ({
  page,
}) => {
  await expect(page.locator(".workspace-heading")).toHaveCount(0);
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(page.locator("#objects > g")).toHaveCount(0);
  await draw(page, "Rectangle", [200, 200], [350, 350]);
  await page
    .locator(".page-name")
    .filter({ hasText: /^Page 1$/ })
    .click();
  await expect(page.locator("#objects > g")).toHaveCount(13);
  await page
    .locator(".page-name")
    .filter({ hasText: /^Page 2$/ })
    .click();
  await expect(page.locator("#objects > g")).toHaveCount(1);
  await page
    .locator(".page-name")
    .filter({ hasText: /^Page 2$/ })
    .dblclick();
  await page
    .getByRole("textbox", { name: "Page name", exact: true })
    .fill("Explorations");
  await page
    .getByRole("textbox", { name: "Page name", exact: true })
    .press("Enter");
  await page.reload();
  await expect(page.locator("#objects > g")).toHaveCount(1);
  await expect(page.locator(".page-row.active .page-name")).toHaveText(
    "Explorations",
  );
  await page
    .getByRole("button", { name: "Delete Explorations", exact: true })
    .click();
  await expect(page.locator("#objects > g")).toHaveCount(13);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#objects > g")).toHaveCount(1);
  await expect(page.locator(".page-row.active .page-name")).toHaveText(
    "Explorations",
  );
  await page.getByRole("button", { name: "Search pages", exact: true }).click();
  await page.getByRole("textbox", { name: "Search page names" }).fill("Explor");
  await expect(page.locator(".page-row")).toHaveCount(1);
});

test('multiple frames persist per page and support geometry, rename, delete and undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(2);
  await expect(page.locator('#selection-name')).toHaveText('Frame 2');
  await page.locator('#prop-w').fill('600');
  await page.locator('#prop-w').press('Tab');
  await expect(page.locator('#artboard')).toHaveAttribute('width', '600');
  await page.locator('[data-frame-id]').last().dblclick();
  await page.getByRole('textbox', { name: 'Frame name', exact: true }).fill('Mobile');
  await page.getByRole('textbox', { name: 'Frame name', exact: true }).press('Enter');
  await page.reload();
  await expect(page.locator('[data-frame-id]')).toHaveCount(2);
  await expect(page.locator('[data-frame-id]').last()).toContainText('Mobile');
  await page.locator('[data-frame-id]').last().click();
  await page.locator('#prop-x').fill('1500');
  await page.locator('#prop-x').press('Tab');
  await expect(page.locator('#artboard')).toHaveAttribute('x', '1500');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Page 1', exact: true }).click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(2);
  await page.locator('[data-frame-id]').last().click();
  await page.locator('#canvas').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(2);
});

test("figma-like frame tool, canvas frame drawing, dragging selected frame, and object auto-nesting", async ({ page }) => {
  await page.goto('/');
  await draw(page, "Frame", [150, 100], [550, 450]);
  const s1 = await state(page);
  const newFrame = s1.doc.artboards.at(-1);
  expect(newFrame).toBeDefined();
  expect(newFrame.width).toBeCloseTo(400, 0);

  await draw(page, "Rectangle", [200, 150], [350, 300]);
  const s2 = await state(page);
  const drawnObj = s2.doc.objects.at(-1);
  expect(drawnObj.frameId).toBe(newFrame.id);

  await page.locator('[data-frame-id]').last().click();
  const beforeFramePos = { x: newFrame.x, y: newFrame.y };
  const beforeObjPos = { x: drawnObj.x, y: drawnObj.y };

  await drag(page, [250, 120], [300, 170]);
  const s3 = await state(page);
  const movedFrame = s3.doc.artboards.find((f) => f.id === newFrame.id);
  const movedObj = s3.doc.objects.find((o) => o.id === drawnObj.id);
  expect(movedFrame.x).toBeGreaterThan(beforeFramePos.x);
  expect(movedObj.x).toBeGreaterThan(beforeObjPos.x);
});

test("auto layout wraps selection with Shift+A, re-flows on direction, gap, padding, and alignment changes, and removes with Alt+Shift+A", async ({ page }) => {
  await blank(page);
  await draw(page, "Rectangle", [100, 100], [200, 180]);
  await draw(page, "Rectangle", [240, 100], [340, 180]);
  await selectAll(page);

  await page.keyboard.press("Shift+a");
  await expect(page.locator("#autolayout-controls")).toBeVisible();
  
  let s = await state(page);
  const alFrame = s.doc.artboards.find((f) => f.autoLayout?.enabled);
  expect(alFrame).toBeDefined();
  expect(alFrame.autoLayout.direction).toBe("horizontal");
  expect(alFrame.autoLayout.gap).toBe(16);
  expect(alFrame.autoLayout.paddingX).toBe(16);

  const children = s.doc.objects.filter((o) => o.frameId === alFrame.id);
  expect(children).toHaveLength(2);
  expect(children[1].x).toBeCloseTo(children[0].x + children[0].w + 16, 0);

  await page.locator("#al-dir-vertical").click();
  s = await state(page);
  const vFrame = s.doc.artboards.find((f) => f.id === alFrame.id);
  expect(vFrame.autoLayout.direction).toBe("vertical");
  const vChildren = s.doc.objects.filter((o) => o.frameId === alFrame.id);
  expect(vChildren[1].y).toBeCloseTo(vChildren[0].y + vChildren[0].h + 16, 0);

  await page.locator("#al-gap").fill("30");
  await page.locator("#al-gap").press("Tab");
  s = await state(page);
  const gChildren = s.doc.objects.filter((o) => o.frameId === alFrame.id);
  expect(gChildren[1].y).toBeCloseTo(gChildren[0].y + gChildren[0].h + 30, 0);

  await page.locator("#al-sizing-fixed").click();
  await page.locator("#prop-w").fill("600");
  await page.locator("#prop-w").press("Tab");
  await page.locator("#prop-h").fill("600");
  await page.locator("#prop-h").press("Tab");

  await page.locator('.al-dot[data-al-align="center"]').click();
  s = await state(page);
  const cFrame = s.doc.artboards.find((f) => f.id === alFrame.id);
  expect(cFrame.autoLayout.align).toBe("center");

  await page.keyboard.press("Alt+Shift+a");
  await expect(page.locator("#autolayout-controls")).toBeHidden();
  s = await state(page);
  const noAlFrame = s.doc.artboards.find((f) => f.id === alFrame.id);
  expect(noAlFrame.autoLayout.enabled).toBe(false);

  await page.locator("#add-autolayout").click();
  await expect(page.locator("#autolayout-controls")).toBeVisible();
  s = await state(page);
  const reAlFrame = s.doc.artboards.find((f) => f.id === alFrame.id);
  expect(reAlFrame.autoLayout.enabled).toBe(true);
});

test("canvas color change updates void background, persists in document and page, and supports undo", async ({
  page,
}) => {
  await blank(page);
  expect((await state(page)).selected).toHaveLength(0);
  await expect(page.locator("#fill-title")).toHaveText("Page background");
  await expect(page.locator("#stroke-hex")).toBeDisabled();
  await expect(page.locator("#fill-hex")).toHaveValue("090909");

  // Change canvas color via fill-hex input
  await page.locator("#fill-hex").fill("1e1e1e");
  await page.locator("#fill-hex").press("Enter");

  let s = await state(page);
  expect(s.doc.canvasColor).toBe("#1e1e1e");
  const activePage = s.doc.pages.find((p) => p.id === s.doc.activePageId);
  expect(activePage.canvasColor).toBe("#1e1e1e");

  const containerBg = await page
    .locator("#canvas-container")
    .evaluate((el) => el.style.backgroundColor);
  expect(containerBg).toBe("rgb(30, 30, 30)");

  // Change color via color picker popover swatches
  await page.locator("#fill-preview").click();
  const popup = page.getByRole("dialog", { name: "Color picker", exact: true });
  await expect(popup).toBeVisible();
  await popup
    .getByRole("button", { name: "Apply #2353e8 to fill", exact: true })
    .click();

  s = await state(page);
  expect(s.doc.canvasColor).toBe("#2353e8");

  // Undo restores previous canvas color
  await page.keyboard.press("ControlOrMeta+z");
  s = await state(page);
  expect(s.doc.canvasColor).toBe("#1e1e1e");

  // Reset button (#no-fill) restores default canvas color #090909
  await page.locator("#no-fill").click();
  s = await state(page);
  expect(s.doc.canvasColor).toBe("#090909");

  // Context menu on empty canvas has "Change canvas color..."
  await page.locator("#canvas").click({ button: "right", position: { x: 50, y: 50 } });
  const contextMenu = page.locator("#canvas-context-menu");
  await expect(contextMenu).toBeVisible();
  const changeColorItem = contextMenu.getByRole("menuitem", {
    name: "Change canvas color...",
  });
  await expect(changeColorItem).toBeVisible();
  await changeColorItem.click();
  await expect(popup).toBeVisible();
});

test("effects panel supports drop shadow, inner shadow, layer blur, background blur, settings popover, toggle, and undo", async ({
  page,
}) => {
  await blank(page);
  // Draw a rectangle
  await draw(page, "Rectangle", [120, 120], [300, 260]);
  expect((await state(page)).selected).toHaveLength(1);

  // Effects section should be visible
  const effectsSection = page.locator("#effects-section");
  await expect(effectsSection).toBeVisible();

  // Add an effect
  await page.locator("#add-effect").click();

  // Popover should open for the newly added Drop shadow
  const popover = page.locator("#effect-popover");
  await expect(popover).toBeVisible();
  await expect(page.locator("#effect-popover-title")).toHaveText("Drop shadow");

  // State should have 1 effect
  let s = await state(page);
  let obj = s.doc.objects[0];
  expect(obj.effects).toHaveLength(1);
  expect(obj.effects[0].type).toBe("drop-shadow");
  expect(obj.effects[0].visible).toBe(true);

  // SVG canvas should contain the filter definition
  const filter = page.locator(`#effect-filter-${obj.id}`);
  await expect(filter).toBeAttached();
  const feOffset = filter.locator("feOffset");
  await expect(feOffset).toBeAttached();

  // Modify shadow properties in popover
  await page.locator("#effect-y").fill("10");
  await page.locator("#effect-y").press("Tab");
  await page.locator("#effect-blur").fill("20");
  await page.locator("#effect-blur").press("Tab");

  s = await state(page);
  obj = s.doc.objects[0];
  expect(obj.effects[0].y).toBe(10);
  expect(obj.effects[0].blur).toBe(20);

  // Toggle visibility off
  const row = page.locator(".effect-row").first();
  await row.locator(".effect-toggle-btn").click();
  s = await state(page);
  expect(s.doc.objects[0].effects[0].visible).toBe(false);

  // Toggle visibility back on
  await row.locator(".effect-toggle-btn").click();
  s = await state(page);
  expect(s.doc.objects[0].effects[0].visible).toBe(true);

  // Switch type to Inner shadow
  await row.locator(".effect-type-select").selectOption("inner-shadow");
  await expect(page.locator("#effect-popover-title")).toHaveText("Inner shadow");
  s = await state(page);
  expect(s.doc.objects[0].effects[0].type).toBe("inner-shadow");

  // Switch type to Layer blur
  await row.locator(".effect-type-select").selectOption("layer-blur");
  await expect(page.locator("#effect-popover-title")).toHaveText("Layer blur");
  await expect(page.locator("#blur-fields")).toBeVisible();
  await expect(page.locator("#shadow-fields")).toBeHidden();

  // Test Undo
  await page.keyboard.press("ControlOrMeta+z");
  s = await state(page);
  expect(s.doc.objects[0].effects[0].type).toBe("inner-shadow");

  // Remove effect
  await row.locator(".effect-delete-btn").click();
  s = await state(page);
  expect(s.doc.objects[0].effects).toHaveLength(0);
  await expect(page.locator(".effect-row")).toHaveCount(0);
});

test("frame effects and svg export filter generation", async ({ page }) => {
  await blank(page);
  // Select artboard
  await page.locator("#artboard-label").click();
  await expect(page.locator("#selection-type")).toHaveText("Frame");

  // Add an effect to the artboard
  await page.locator("#add-effect").click();
  let s = await state(page);
  expect(s.doc.artboard.effects).toHaveLength(1);
  expect(s.doc.artboard.effects[0].type).toBe("drop-shadow");

  // Verify artboard element has filter attribute
  const artboard = page.locator("#artboard");
  await expect(artboard).toHaveAttribute(
    "filter",
    new RegExp(`url\\(#effect-filter-${s.doc.artboard.id}\\)`),
  );

  // Verify exported SVG contains the filter definition
  const svgContent = await page.evaluate(async () => {
    const { exportSvg } = await import("/src/main.js");
    return exportSvg();
  });
  expect(svgContent).toContain(`id="export-filter-${s.doc.artboard.id}"`);
  expect(svgContent).toContain("feGaussianBlur");
  expect(svgContent).toContain("feOffset");
});




test('nested frames move and duplicate descendants, and nested layouts size inside out', async ({page}) => {
  await blank(page);
  await draw(page, 'Rectangle', [150,150], [230,200]);
  await selectAll(page);
  await page.keyboard.press('Shift+a');
  let s = await state(page);
  const inner = s.doc.artboards.find(f=>f.autoLayout?.enabled);
  const outer = s.doc.artboards.find(f=>f.id===inner.parentId);
  expect(outer).toBeDefined();
  const outerRow = page.locator(`[data-frame-id="${outer.id}"]`);
  await expect(outerRow.locator('..').locator(`[data-frame-id="${inner.id}"]`)).toHaveCount(1);
  await outerRow.click();
  await expect(outerRow).toHaveClass(/selected/);
  await page.locator('#add-autolayout').click();
  s = await state(page);
  const parent = s.doc.artboards.find(f=>f.id===outer.id);
  expect(parent.width).toBeCloseTo(inner.width + 32, 0);
  await page.locator('#al-width-sizing').selectOption('fixed');
  await page.locator('#prop-w').fill('500'); await page.locator('#prop-w').press('Tab');
  s = await state(page);
  expect(s.doc.artboards.find(f=>f.id===outer.id).width).toBe(500);
  expect(s.doc.artboards.find(f=>f.id===outer.id).height).toBeCloseTo(inner.height+32,0);
  const before=s.doc.objects[0].x;
  await page.locator('#prop-x').fill('80');await page.locator('#prop-x').press('Tab');
  s=await state(page);expect(s.doc.objects[0].x).toBeCloseTo(before+80,0);
  await page.locator('#duplicate').click();
  s=await state(page);expect(s.doc.artboards).toHaveLength(4);expect(s.doc.objects).toHaveLength(2);
  await page.reload();await expect(page.locator('[data-frame-id]')).toHaveCount(4);
});

test('auto layout canvas drag reorders children, hidden children collapse, and layer order matches layout', async ({page}) => {
  await blank(page);
  await draw(page,'Rectangle',[100,100],[160,160]);
  await draw(page,'Rectangle',[180,100],[240,160]);
  await draw(page,'Rectangle',[260,100],[320,160]);
  await selectAll(page);await page.keyboard.press('Shift+a');
  let s=await state(page);
  const f=s.doc.artboards.find(f=>f.autoLayout?.enabled), children=s.doc.objects.filter(o=>o.frameId===f.id);
  const first=children[0], last=children[2];
  const row=page.locator(`[data-layer="${first.id}"]`);
  await row.click();
  await drag(page,[first.x+first.w/2, first.y+first.h/2],[last.x+last.w*.75, last.y+last.h/2]);
  s=await state(page);
  expect(s.doc.objects.filter(o=>o.frameId===f.id).at(-1).id).toBe(first.id);
  const treeOrder=await page.locator(`[data-frame-id="${f.id}"]`).locator('..').locator('[data-layer]').evaluateAll(rows=>rows.map(r=>r.dataset.layer));
  expect(treeOrder).toEqual(s.doc.objects.filter(o=>o.frameId===f.id).map(o=>o.id));
  const width=s.doc.artboards.find(frame=>frame.id===f.id).width;
  await row.locator('[data-visibility]').click();s=await state(page);
  expect(s.doc.artboards.find(frame=>frame.id===f.id).width).toBeCloseTo(width-first.w-16,0);
});

test('layer drag nests frames, rejects cycles, and persists hierarchy through undo and reload', async ({page}) => {
  await blank(page);
  await page.locator('#add-artboard').click();
  let s=await state(page);const [parent,child]=s.doc.artboards;
  const dragRow=async(source,target)=>{
    const data=await page.evaluateHandle(()=>new DataTransfer());
    await page.locator(`[data-frame-id="${source}"]`).dispatchEvent('dragstart',{dataTransfer:data});
    await page.locator(`[data-frame-id="${target}"]`).dispatchEvent('drop',{dataTransfer:data});
  };
  await dragRow(child.id,parent.id);
  s=await state(page);expect(s.doc.artboards.find(f=>f.id===child.id).parentId).toBe(parent.id);
  await dragRow(parent.id,child.id);
  s=await state(page);expect(s.doc.artboards.find(f=>f.id===parent.id).parentId).toBeFalsy();
  await page.locator('#undo').click();
  s=await state(page);expect(s.doc.artboards.find(f=>f.id===child.id).parentId).toBeFalsy();
  await page.locator('#redo').click();await page.reload();
  await expect(page.locator(`[data-frame-id="${parent.id}"]`).locator('..').locator(`[data-frame-id="${child.id}"]`)).toHaveCount(1);
});

test('fill container shares available space and updates after parent resize', async ({page}) => {
  await blank(page);
  await draw(page,'Rectangle',[100,100],[160,160]);
  await draw(page,'Rectangle',[180,100],[240,160]);
  await selectAll(page);await page.keyboard.press('Shift+a');
  let s=await state(page);const frame=s.doc.artboards.find(f=>f.autoLayout?.enabled);
  const children=s.doc.objects.filter(o=>o.frameId===frame.id);
  await page.locator('#al-width-sizing').selectOption('fixed');
  await page.locator('#prop-w').fill('400');await page.locator('#prop-w').press('Tab');
  for (const child of children) {
    await page.locator(`[data-layer="${child.id}"]`).click();
    await page.locator('#child-width-sizing').selectOption('fill');
  }
  s=await state(page);
  for (const child of s.doc.objects.filter(o=>o.frameId===frame.id)) expect(child.w).toBeCloseTo(176,0);
  await page.locator(`[data-frame-id="${frame.id}"]`).click();
  await page.locator('#prop-w').fill('500');await page.locator('#prop-w').press('Tab');
  s=await state(page);
  for (const child of s.doc.objects.filter(o=>o.frameId===frame.id)) expect(child.w).toBeCloseTo(226,0);
  await page.reload();
  const restored=await state(page);expect(restored.doc.objects.filter(o=>o.widthSizing==='fill')).toHaveLength(2);
});
