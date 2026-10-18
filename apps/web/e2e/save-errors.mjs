// Save failures are never silent (save-states.md rule 3): when OPFS writes
// fail, the title bar reads "Couldn't save · Retry", a non-dismissible error
// banner explains what is safe, edits stay in memory, and Illigma retries
// every 30 seconds. Playwright's clock skips the 30 s wait.
//
// Timing notes. page.clock.install() fakes the timers but lets time flow at
// the real pace, so the 1 s autosave can fire on its own before runFor().
// The status can also already read "error" from an earlier failure, so a
// wait for "error" alone may pass before the next save attempt has even
// started. Every save attempt is therefore awaited through the failed-write
// counter (__e2eFailedWrites) or a status change, never a fixed sleep.
//
// Usage (from the repo root):  node apps/web/e2e/save-errors.mjs [--headed] [--no-build]

import {
  T,
  canvasReady,
  createFile,
  drag,
  failWritesInit,
  failedWrites,
  field,
  layerRow,
  layerRows,
  newContext,
  poll,
  runE2E,
  saveState,
  setField,
  waitSaveState,
  waitSaved,
  watchErrors,
} from "./lib.mjs";

await runE2E("save-errors", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  await page.clock.install();
  await page.addInitScript(failWritesInit);
  const status = page.locator(".save-status");
  const errorBanner = page.locator(".banner-error");
  const failWrites = (on) => page.evaluate((v) => (globalThis.__e2eFail = v ? "package" : null), on);
  const waitError = () => waitSaveState(page, "error", T(10_000));
  /** Wait until a save attempt after `before` failed writes has failed and the status is back to "error". */
  const failedAgain = (before, what) => poll(async () => (await failedWrites(page)) > before && (await saveState(page)) === "error", what, 10_000);

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
  check(
    count(/Couldn't save/g) === 1 && count(/changes are safe/g) === 1 && count(/30 seconds/g) === 1,
    `the save-error banner should say each thing once ("Couldn't save" ×${count(/Couldn't save/g)}, "changes are safe" ×${count(/changes are safe/g)}, "30 seconds" ×${count(/30 seconds/g)})`,
  );
  const bannerButtons = await errorBanner.getByRole("button").allInnerTexts();
  check(!bannerButtons.some((b) => /dismiss|close|×/i.test(b)), `the error banner must not be dismissible, buttons: ${bannerButtons.join(", ")}`);
  check(bannerButtons.some((b) => /save a copy elsewhere/i.test(b)), `the save-error banner should offer "Save a copy elsewhere…" (save-states.md rule 3), buttons: ${bannerButtons.join(", ")}`);
  await page.screenshot({ path: `${outDir}/save-error.png` });

  log("edits stay in memory while saving fails");
  check((await layerRows(page).count()) === 4, "the drawn rectangle should stay in the document");
  await layerRow(page, "Hero").click();
  // Counted before the edit: its autosave can fire on real time before runFor() below.
  const failedBefore = await failedWrites(page);
  await setField(page, "X position", 300);
  check((await field(page, "X position")) === 300, "editing should keep working while saves fail");
  await page.clock.runFor(1500); // past the autosave delay
  const retried = await failedAgain(failedBefore, "autosave retry").catch(() => false);
  check(retried, "the next autosave should try again, fail, and keep the error state");

  log("Retry while the disk still fails keeps the error");
  // The status already reads "error": wait for this Retry's own failed write, or the
  // attempt could still be running (and succeed) once writes are turned back on below.
  const failedBeforeRetry = await failedWrites(page);
  await status.getByRole("button", { name: "Retry" }).click();
  await failedAgain(failedBeforeRetry, "Retry's save attempt should fail");
  check((await errorBanner.count()) === 1, "the banner should stay while writes fail");

  log("writes recover: the 30 s retry saves without a click");
  await failWrites(false);
  await page.clock.runFor(20_000);
  check((await saveState(page)) === "error", "nothing should retry before 30 seconds");
  await page.clock.runFor(10_500);
  await waitSaved(page, T(5_000));
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
  await waitError(); // the status read "saved" before, so this waits for the failed autosave
  await failWrites(false);
  await page.getByRole("button", { name: "Retry" }).first().click();
  await waitSaved(page, T(5_000));
  check((await errorBanner.count()) === 0, "Retry should clear the error banner after a good save");

  log("leaving while saving fails keeps the edits recoverable");
  await failWrites(true);
  await setField(page, "Y position", 333);
  await page.clock.runFor(1500);
  await waitError();
  await page.getByRole("button", { name: "Back to files" }).click();
  // Leaving with unsaved edits is never silent (rule 3): a warning asks first.
  const leave = page.getByRole("alertdialog", { name: "Unsaved edits" });
  await leave.waitFor({ timeout: T(5_000) });
  check((await leave.getByRole("button", { name: "Save a copy elsewhere…" }).count()) === 1, "the leave warning should offer Save a copy elsewhere…");
  await leave.getByRole("button", { name: "Leave anyway (edits stay recoverable)" }).click();
  await page.locator(".file-card").first().waitFor();
  // Writes keep failing until the recovery banner is up: leaving starts more save attempts
  // (Back to files, then the editor's unmount) that may still be in flight here, and one that
  // landed after writes came back would save the edit and leave nothing to recover.
  await page.locator(".file-card").first().click();
  await canvasReady(page);
  const recovered = page.locator(".banner", { hasText: "Recovered unsaved changes." });
  await recovered.waitFor({ timeout: T(5_000) });
  await failWrites(false);
  await recovered.getByRole("button", { name: "Keep" }).click();
  await recovered.waitFor({ state: "detached", timeout: T(5_000) });
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check((await field(page, "Y position")) === 333, "the edit made before leaving should come back through recovery");

  log("a save still running from the closed editor finishes before the file opens again");
  // Back to files flushes (that attempt fails); after "Leave anyway" the editor's unmount
  // starts one more save. Hold that save mid-write and reopen the file: opening must wait
  // for it (files.ts whileClosing), so the two sessions never write the file at once.
  await failWrites(true);
  await setField(page, "Y position", 444);
  await page.clock.runFor(1500);
  await waitError();
  await page.evaluate(() => {
    let first = true;
    globalThis.__e2eFail = ({ journal }) => {
      if (journal) return "ok";
      if (first) {
        first = false;
        return "fail"; // Back to files' own flush
      }
      return "hold"; // the unmount flush that follows it
    };
  });
  await page.getByRole("button", { name: "Back to files" }).click();
  await leave.getByRole("button", { name: "Leave anyway (edits stay recoverable)" }).click();
  await page.locator(".file-card").first().waitFor();
  await poll(() => page.evaluate(() => (globalThis.__e2eHeld ?? 0) > 0), "the editor's unmount should start another save");
  await page.evaluate(() => (globalThis.__e2eFail = null)); // the disk is back; the held write stays open
  await page.locator(".file-card").first().click();
  await page.waitForTimeout(T(500));
  check((await page.locator("canvas.canvas").count()) === 0, "the file should not open while its closed editor is still saving");
  await page.evaluate(() => globalThis.__e2eRelease?.());
  await canvasReady(page);
  // The held save holds the 444 edit, so there may be nothing left to recover; if there is, Keep must work.
  if (await recovered.isVisible().catch(() => false)) {
    await recovered.getByRole("button", { name: "Keep" }).click();
    const keepError = page.locator(".banner", { hasText: "Couldn't keep the recovered changes" });
    const kept = await Promise.race([
      recovered.waitFor({ state: "detached", timeout: T(5_000) }).then(() => true),
      keepError.waitFor({ timeout: T(5_000) }).then(() => false),
    ]).catch(() => false);
    const why = kept ? "" : `: ${((await keepError.innerText().catch(() => "")) || "Keep never finished").replace(/\s+/g, " ").trim()}`;
    check(kept, `Keep should work after the closed editor's save finished${why}`);
    await canvasReady(page);
  }
  check((await errorBanner.count()) === 0, "no save error should show after reopening");
  await layerRow(page, "Hero").click();
  check((await field(page, "Y position")) === 444, "the edit saved by the closed editor should be in the reopened file");
  await waitSaved(page, T(5_000));
  await page.reload();
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check((await field(page, "Y position")) === 444, "the edit should still be there after a reload");
  await context.close();
});
