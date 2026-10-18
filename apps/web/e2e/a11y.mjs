// Accessibility: every control has an accessible name (axe-core plus our own
// pass over buttons and inputs), keyboard Tab order reaches the title bar,
// Layers panel, canvas, tool dock and Properties panel in that order, and
// every element reached by Tab shows a visible focus indicator.
//
// Usage (from the repo root):  node apps/web/e2e/a11y.mjs [--headed] [--no-build]

import { createRequire } from "node:module";
import { createFile, layerRow, newContext, runE2E, watchErrors } from "./lib.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** axe rules that are about names, roles and labels: always hard failures. */
const NAME_RULES = new Set([
  "button-name",
  "input-button-name",
  "label",
  "aria-input-field-name",
  "aria-toggle-field-name",
  "aria-command-name",
  "link-name",
  "image-alt",
  "svg-img-alt",
  "aria-allowed-attr",
  "aria-required-attr",
  "aria-valid-attr",
  "aria-valid-attr-value",
  "aria-roles",
  "nested-interactive",
  "duplicate-id-aria",
]);

await runE2E("a11y", {}, async ({ browser, url, log, check, knownBug, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);

  async function axe(where) {
    if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // canvas overlay is drawn

    const result = await page.evaluate(() =>
      window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }),
    );
    const fmt = (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}${v.nodes.length > 4 ? ` +${v.nodes.length - 4}` : ""}`;
    const naming = result.violations.filter((v) => NAME_RULES.has(v.id));
    check(naming.length === 0, `${where}: controls without proper names/roles:\n  ${naming.map(fmt).join("\n  ")}`);
    return result.violations.filter((v) => !NAME_RULES.has(v.id));
  }

  /** Our own pass: every button, input and widget role has a non-empty accessible name. */
  async function namesPass(where) {
    const snapshot = await page.locator("body").ariaSnapshot();
    const unnamed = snapshot
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^- (button|textbox|checkbox|radio|slider|spinbutton|combobox|switch|tab|menuitem|application)\b/.test(l))
      .filter((l) => !/^- \w+ "[^"]+"/.test(l));
    check(unnamed.length === 0, `${where}: unnamed controls in the accessibility tree:\n  ${unnamed.join("\n  ")}`);
    return snapshot;
  }

  /** Tab from the top of the page; returns what got focus, in order, with its focus style. */
  async function tabWalk(max = 60) {
    await page.evaluate(() => {
      document.activeElement instanceof HTMLElement && document.activeElement.blur();
      window.getSelection()?.removeAllRanges();
    });
    await page.locator("body").focus().catch(() => undefined);
    const seen = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const region =
          el.closest(".title-bar") ? "title" :
          el.closest(".panel-left") ? "layers" :
          el.closest(".tool-dock") ? "dock" :
          el.closest(".banners") ? "banner" :
          el.matches("canvas") ? "canvas" :
          el.closest(".panel-right") ? "properties" :
          el.closest(".home") ? "home" : "other";
        const visible = (e) => {
          const s = getComputedStyle(e);
          const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && !/rgba\(.*,\s*0\)$/.test(s.outlineColor);
          const shadow = s.boxShadow && s.boxShadow !== "none";
          return outline || shadow;
        };
        const ring = visible(el) || (el.closest(".field") ? visible(el.closest(".field")) : false);
        const name = el.getAttribute("aria-label") || el.textContent?.trim() || el.id || el.tagName;
        return { key: `${el.tagName}#${el.id}|${name}`, region, ring, name, focusVisible: el.matches(":focus-visible") };
      });
      if (!info) continue;
      if (seen.length && info.key === seen[0].key) break; // wrapped around
      seen.push(info);
    }
    return seen;
  }

  log("home: names and axe");
  await page.goto(url);
  await page.getByRole("button", { name: "New design file" }).waitFor();
  await namesPass("home");
  const homeOther = await axe("home");

  log("home: Tab reaches New design file with a focus ring");
  const homeTabs = await tabWalk(10);
  const newBtn = homeTabs.find((t) => t.name.includes("New design file"));
  check(newBtn, `Tab should reach "New design file", reached: ${homeTabs.map((t) => t.name).join(", ")}`);
  check(newBtn.ring && newBtn.focusVisible, "the focused New design file button should show a focus ring");

  log("editor: names and axe (nothing selected, then a layer selected)");
  await createFile(page, url);
  await namesPass("editor");
  const editorOther = await axe("editor");
  await layerRow(page, "Hero").click();
  const snap = await namesPass("editor with a selection");
  check(/textbox "X position"/.test(snap) || /textbox "X X position"/.test(snap), "the X field should be named after its label");
  const selectedOther = await axe("editor with a selection");

  log("editor: Tab order reaches title bar, layers, canvas, tool dock and properties");
  const walked = await tabWalk();
  // Tab starts from the last clicked element and wraps; read the cycle from the title bar.
  const start = Math.max(0, walked.findIndex((t) => t.region === "title"));
  const tabs = [...walked.slice(start), ...walked.slice(0, start)];
  const order = tabs.map((t) => t.region).filter((r, i, a) => r !== a[i - 1]);
  console.log(`  Tab order by region: ${order.join(" → ")} (${tabs.length} stops)`);
  for (const r of ["title", "layers", "canvas", "dock", "properties"]) check(order.includes(r), `Tab should reach the ${r} region; order: ${order.join(" → ")}`);
  const first = (r) => order.indexOf(r);
  check(
    first("title") < first("layers") && first("layers") < first("canvas") && first("canvas") < first("dock") && first("dock") < first("properties"),
    `Tab order should follow the layout (title → layers → canvas → dock → properties), got ${order.join(" → ")}`,
  );
  check(tabs.some((t) => t.region === "dock" && /Rectangle \(R\)/.test(t.name)), "Tab should reach each tool in the dock");
  check(tabs.some((t) => t.region === "properties" && /prop-x/.test(t.key)), "Tab should reach the X field in Properties");

  log("editor: every Tab stop shows a visible focus indicator");
  const noRing = tabs.filter((t) => !t.ring);
  check(noRing.length === 0, `elements without a visible focus indicator: ${noRing.map((t) => `${t.region}: ${t.name}`).join(", ")}`);
  check(tabs.every((t) => t.focusVisible), "keyboard focus should match :focus-visible everywhere");

  // Take a focused screenshot of the dock for the record.
  await page.getByRole("button", { name: "Rectangle (R)" }).focus();
  await page.screenshot({ path: `${outDir}/a11y-focus.png` });

  log("editor: auto layout card, sizing menu and constraints (names and axe)");
  await layerRow(page, "Desktop").click();
  await page.getByRole("button", { name: "Add auto layout" }).click();
  await page.getByRole("radiogroup", { name: "Direction" }).waitFor();
  await namesPass("auto layout card");
  const autoOther = await axe("auto layout card");
  await page.getByRole("button", { name: "Individual padding" }).click();
  await namesPass("auto layout card, individual padding");
  const sidesOther = await axe("auto layout card, individual padding");
  await layerRow(page, "Hero").click();
  await page.getByRole("button", { name: /^Horizontal resizing/ }).click();
  await page.getByRole("menu").waitFor();
  await namesPass("sizing menu open");
  const menuOther = await axe("sizing menu open");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Absolute position" }).click();
  await page.getByLabel("Horizontal constraint").waitFor();
  await namesPass("constraints card");
  const constraintsOther = await axe("constraints card");

  log("other axe findings (contrast, landmarks, …)");
  const others = new Map();
  for (const v of [...homeOther, ...editorOther, ...selectedOther, ...autoOther, ...sidesOther, ...menuOther, ...constraintsOther]) {
    const k = v.id;
    const prev = others.get(k);
    const targets = v.nodes.map((n) => n.target.join(" "));
    others.set(k, { v, targets: [...new Set([...(prev?.targets ?? []), ...targets])] });
  }
  for (const [id, { v, targets }] of others) {
    knownBug(false, `axe ${id} (${v.impact}): ${v.help}${v.nodes[0]?.any?.[0]?.message ? ` [${v.nodes[0].any[0].message}]` : ""} — ${targets.slice(0, 5).join(" | ")}${targets.length > 5 ? ` +${targets.length - 5}` : ""}`);
  }
  await context.close();
});
