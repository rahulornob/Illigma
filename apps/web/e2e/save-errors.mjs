// Save failures are never silent (save-states.md rule 3): when OPFS writes
// fail, the title bar reads "Couldn't save · Retry", a non-dismissible error
// banner explains what is safe, edits stay in memory, and Illigma retries
// every 30 seconds. Playwright's clock skips the 30 s wait.
//
// Usage (from the repo root):  node apps/web/e2e/save-errors.mjs [--headed] [--no-build]

import { canvasReady, createFile, drag, failWritesInit, field, layerRow, layerRows, newContext, poll, runE2E, saveState, setField, waitSaved, watchErrors } from "./lib.mjs";

await runE2E("save-errors", { port: 5194 }, async ({ browser, url, log, check, knownBug, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  await page.clock.install();
  await page.addInitScript(failWritesInit);
  const status = page.locator(".save-status");
  const errorBanner = page.locator(".banner-error");
  const failWrites = (on) => page.evaluate((v) => (globalThis.__e2eFail = v ? "package" : null), on);
  const waitError = () => page.waitForSelector('.save-status[data-save-state="error"]', { timeout: 10_000 });

  log("create a file");
  await createFile(page, url);
  await waitSaved(page);

  log("writes fail: the title bar and banner say so");
  await failWrites(true);
  await page.keyboard.press("r");
  const box = await page.locator("canvas.canvas").boundingBox();
  await drag(page, box.x + 60, box.y + box.height - 160, box.x + 180, box.y + box.height - 90);
  await page.locator(".layer-list .layer-row", { hasText: /^Rectangle \d+$/ }).first().waitFor();
  await waitError();
  const statusText = (await status.innerText()).replace(/\s+/g, " ").trim();
  check(statusText === "Couldn't save · Retry", `the title bar should read "Couldn't save · Retry", got "${statusText}"`);
  check(await status.getByRole("button", { name: "Retry" }).isVisible(), "the title bar should offer Retry");
  check((await errorBanner.count()) === 1, "an error banner should appear");
  check((await errorBanner.getAttribute("role")) === "alert", "the error banner should be announced (role=alert)");
  const bannerText = await errorBanner.innerText();
  check(bannerText.includes("Couldn't save to Browser storage."), `the banner should say where the save failed, got "${bannerText}"`);
  check(bannerText.includes("there isn't enough storage space left."), `the banner should say why (quota), got "${bannerText}"`);
  check(bannerText.includes("Your changes are safe"), "the banner should say what is safe");
  const count = (re) => (bannerText.match(re) ?? []).length;
  knownBug(
    count(/Couldn't save/g) === 1 && count(/changes are safe/g) === 1 && count(/30 seconds/g) === 1,
    `the save-error banner repeats itself ("Couldn't save" ×${count(/Couldn't save/g)}, "changes are safe" ×${count(/changes are safe/g)}, "30 seconds" ×${count(/30 seconds/g)}): ` +
      "Editor.tsx wraps describeSaveError()'s full sentence, which already says it, in its own copy",
  );
  const bannerButtons = await errorBanner.getByRole("button").allInnerTexts();
  check(!bannerButtons.some((b) => /dismiss|close|×/i.test(b)), `the error banner must not be dismissible, buttons: ${bannerButtons.join(", ")}`);
  knownBug(
    bannerButtons.some((b) => /save a copy/i.test(b)),
    'the save-error banner has no "Save a copy elsewhere…" action (save-states.md rule 3); its only action is Retry',
  );
  await page.screenshot({ path: `${outDir}/save-error.png` });

  log("edits stay in memory while saving fails");
  check((await layerRows(page).count()) === 4, "the drawn rectangle should stay in the document");
  await layerRow(page, "Hero").click();
  await setField(page, "X position", 300);
  check((await field(page, "X position")) === 300, "editing should keep working while saves fail");
  const failed = () => page.evaluate(() => globalThis.__e2eFailedWrites ?? 0);
  const failedBefore = await failed();
  await page.clock.runFor(1500); // past the autosave delay
  const retried = await poll(async () => (await failed()) > failedBefore && (await saveState(page)) === "error", "autosave retry", 5_000).catch(() => false);
  check(retried, "the next autosave should try again, fail, and keep the error state");

  log("Retry while the disk still fails keeps the error");
  await status.getByRole("button", { name: "Retry" }).click();
  await page.clock.runFor(200);
  await waitError();
  check((await errorBanner.count()) === 1, "the banner should stay while writes fail");

  log("writes recover: the 30 s retry saves without a click");
  await failWrites(false);
  await page.clock.runFor(20_000);
  check((await saveState(page)) === "error", "nothing should retry before 30 seconds");
  await page.clock.runFor(10_500);
  await waitSaved(page, 5_000);
  const savedText = (await status.innerText()).trim();
  check(savedText === "Saved · Browser storage", `the title bar should return to "Saved · Browser storage", got "${savedText}"`);
  check((await errorBanner.count()) === 0, "the error banner should go away once a save works");

  log("the recovered save holds every edit");
  await page.reload();
  await canvasReady(page);
  check((await layerRows(page).count()) === 4, "the rectangle drawn while saving failed should be in the file");
  await layerRow(page, "Hero").click();
  check((await field(page, "X position")) === 300, "the X edit made while saving failed should be in the file");

  log("Retry button saves at once when the disk is back");
  await failWrites(true);
  await setField(page, "Y position", 222);
  await page.clock.runFor(1500);
  await waitError();
  await failWrites(false);
  await page.getByRole("button", { name: "Retry" }).first().click();
  await waitSaved(page, 5_000);
  check((await errorBanner.count()) === 0, "Retry should clear the error banner after a good save");

  log("leaving while saving fails keeps the edits recoverable");
  await failWrites(true);
  await setField(page, "Y position", 333);
  await page.clock.runFor(1500);
  await waitError();
  await page.getByRole("button", { name: "Back to files" }).click();
  await page.locator(".file-card").first().waitFor();
  await failWrites(false);
  await page.locator(".file-card").first().click();
  await canvasReady(page);
  const recovered = page.locator(".banner", { hasText: "Recovered unsaved changes." });
  await recovered.waitFor({ timeout: 5_000 });
  await recovered.getByRole("button", { name: "Keep" }).click();
  await recovered.waitFor({ state: "detached" });
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check((await field(page, "Y position")) === 333, "the edit made before leaving should come back through recovery");
  await context.close();
});
