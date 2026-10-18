// Crash recovery (save-states.md rule 2): edits that never reached the file
// come back from the recovery journal on the next launch.
//
// A "crash" here: package writes fail (failWritesInit), so autosave never
// lands, while the journal keeps recording; then the tab is closed. A new tab
// reopens the file and must offer "Recovered unsaved changes".
//
// Usage (from the repo root):  node apps/web/e2e/recovery.mjs [--headed] [--no-build]

import {
  T,
  canvasReady,
  createFile,
  drag,
  failWritesInit,
  field,
  layerRow,
  layerRows,
  newContext,
  poll,
  readJournal,
  runE2E,
  setField,
  waitSaved,
  watchErrors,
} from "./lib.mjs";

await runE2E("recovery", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const banner = (page) => page.locator(".banner", { hasText: "Recovered unsaved changes." });
  const rectangles = (page) => page.locator(".layer-list .layer-row", { hasText: /^Rectangle \d+$/ });

  /**
   * In a fresh profile: create a file, then with package writes failing draw
   * a rectangle and move Hero to X 77, and close the tab. Returns a new tab
   * on the reopened file and the file id.
   */
  async function crashWithEdits(context, label) {
    const page = await context.newPage();
    watchErrors(page, errors);
    await page.addInitScript(failWritesInit);
    const fileId = await createFile(page, url);
    check((await layerRows(page).count()) === 7, `${label}: the sample file should have 7 layers`);
    await page.evaluate(() => (globalThis.__e2eFail = "package"));

    await page.keyboard.press("r");
    const box = await page.locator("canvas.canvas").boundingBox();
    await drag(page, box.x + 60, box.y + box.height - 160, box.x + 160, box.y + box.height - 100);
    await rectangles(page).first().waitFor();
    await layerRow(page, "Hero").click();
    await setField(page, "X position", 77);
    await page.waitForSelector('.save-status[data-save-state="error"]', { timeout: T(10_000) });
    // Let the journal's 250 ms batch reach OPFS, then "crash".
    await poll(async () => {
      const text = await readJournal(page, fileId);
      return text.includes('"x"') && text.includes('"create"');
    }, `${label}: the journal should record both edits`);
    check((await page.evaluate(() => globalThis.__e2eFailedWrites ?? 0)) > 0, `${label}: package writes should have failed`);
    await page.close();

    const next = await context.newPage();
    watchErrors(next, errors);
    await next.goto(`${url}#/file/${fileId}`);
    await canvasReady(next);
    return { page: next, fileId };
  }

  async function heroX(page) {
    await layerRow(page, "Hero").click();
    return field(page, "X position");
  }

  // ---------- Keep ----------
  {
    const context = await newContext(browser);
    log("keep: crash with unsaved edits");
    const { page, fileId } = await crashWithEdits(context, "keep");

    log("keep: reopen shows the recovery banner");
    await banner(page).waitFor({ timeout: T(5_000) });
    const text = await banner(page).innerText();
    check(/\d+ edits? from your last session/.test(text), `the banner should count the recovered edits, got "${text}"`);
    check((await layerRows(page).count()) === 7, "before choosing, the file should show its saved state (7 layers)");
    check((await heroX(page)) === 120, "before choosing, Hero should still be at its saved X (120)");
    await page.screenshot({ path: `${outDir}/recovery-banner.png` });

    log("keep: Keep restores the edits and saves them");
    await banner(page).getByRole("button", { name: "Keep" }).click();
    await banner(page).waitFor({ state: "detached", timeout: T(5_000) });
    await canvasReady(page);
    check((await layerRows(page).count()) === 8, `Keep should restore the drawn rectangle (8 layers), found ${await layerRows(page).count()}`);
    check((await rectangles(page).count()) === 1, "Keep must not apply the rectangle twice");
    check((await heroX(page)) === 77, "Keep should restore Hero's X (77)");
    await waitSaved(page);
    await page.waitForTimeout(600); // a stray journal batch would land within 250 ms
    check((await readJournal(page, fileId)).trim() === "", "after Keep the recovery journal should be empty");

    log("keep: the edits are in the file and the banner is gone after reload");
    await page.reload();
    await canvasReady(page);
    await page.waitForTimeout(300);
    check((await banner(page).count()) === 0, "the recovery banner should not come back after Keep");
    check((await layerRows(page).count()) === 8, "the kept rectangle should be saved in the file");
    check((await rectangles(page).count()) === 1, "the file should hold exactly one drawn rectangle");
    check((await heroX(page)) === 77, "Hero's recovered X should be saved in the file");
    await context.close();
  }

  // ---------- Discard ----------
  {
    const context = await newContext(browser);
    log("discard: crash with unsaved edits");
    const { page, fileId } = await crashWithEdits(context, "discard");
    await banner(page).waitFor({ timeout: T(5_000) });

    log("discard: Discard drops the edits");
    await banner(page).getByRole("button", { name: "Discard" }).click();
    await banner(page).waitFor({ state: "detached", timeout: T(5_000) });
    check((await layerRows(page).count()) === 7, "Discard should leave the saved 7 layers");
    check((await rectangles(page).count()) === 0, "Discard should not apply the drawn rectangle");
    check((await heroX(page)) === 120, "Discard should leave Hero at its saved X (120)");
    check((await readJournal(page, fileId)).trim() === "", "after Discard the recovery journal should be empty");

    log("discard: the banner never returns (reload, Recents)");
    await page.reload();
    await canvasReady(page);
    await page.waitForTimeout(300);
    check((await banner(page).count()) === 0, "the recovery banner should not come back after Discard (reload)");
    check((await layerRows(page).count()) === 7, "the discarded rectangle should stay gone after reload");
    await page.getByRole("button", { name: "Back to files" }).click();
    await page.locator(".file-card").first().click();
    await canvasReady(page);
    await page.waitForTimeout(300);
    check((await banner(page).count()) === 0, "the recovery banner should not come back after Discard (Recents)");

    log("discard: new edits after Discard save normally");
    await layerRow(page, "Avatar").click();
    await setField(page, "Y position", 64);
    await waitSaved(page);
    await page.reload();
    await canvasReady(page);
    await layerRow(page, "Avatar").click();
    check((await field(page, "Y position")) === 64, "an edit made after Discard should be saved");
    check((await banner(page).count()) === 0, "no recovery banner after a clean save");
    await context.close();
  }

  // ---------- Editing before choosing ----------
  {
    const context = await newContext(browser);
    log("edit before choosing: recovered edits must not be lost");
    const { page } = await crashWithEdits(context, "edit-first");
    await banner(page).waitFor({ timeout: T(5_000) });
    // The person ignores the banner and keeps working; autosave runs.
    await layerRow(page, "Avatar").click();
    await setField(page, "Y position", 64);
    await waitSaved(page);
    await page.waitForTimeout(400);
    await page.reload();
    await canvasReady(page);
    await page.waitForTimeout(300);
    const offered = (await banner(page).count()) === 1;
    const inFile = (await layerRows(page).count()) === 8;
    check(offered || inFile, "recovered edits must survive editing (and an autosave) before choosing Keep/Discard");
    check(offered, "the recovery banner should come back after a reload while the person hasn't chosen");
    await context.close();
  }

  // ---------- Saved, but the journal couldn't be cleared ----------
  {
    const context = await newContext(browser);
    const page = await context.newPage();
    watchErrors(page, errors);
    await page.addInitScript(failWritesInit);
    log("stale journal: a save lands but clearing the journal fails");
    const fileId = await createFile(page, url);
    await page.evaluate(() => (globalThis.__e2eFail = "journal-clear"));
    await page.keyboard.press("o");
    const box = await page.locator("canvas.canvas").boundingBox();
    await drag(page, box.x + 60, box.y + box.height - 160, box.x + 160, box.y + box.height - 100);
    await page.locator(".layer-list .layer-row", { hasText: /^Ellipse \d+$/ }).first().waitFor();
    await waitSaved(page);
    await page.waitForTimeout(400);
    check((await readJournal(page, fileId)).includes('"create"'), "the journal should still hold the saved edit (its clear failed)");
    await page.close();

    const next = await context.newPage();
    watchErrors(next, errors);
    await next.goto(`${url}#/file/${fileId}`);
    await canvasReady(next);
    await next.waitForTimeout(300);
    const ellipses = () => next.locator(".layer-list .layer-row", { hasText: /^Ellipse \d+$/ });
    check((await ellipses().count()) === 1, "the saved ellipse should be in the file");
    const stale = (await banner(next).count()) === 1;
    check(!stale, "a save that landed must not be offered again as recovered when the journal couldn't be cleared");
    if (stale) {
      log("stale journal: Keep must not apply the saved edit twice");
      await banner(next).getByRole("button", { name: "Keep" }).click();
      await banner(next).waitFor({ state: "detached", timeout: T(5_000) });
      await canvasReady(next);
      check((await ellipses().count()) === 1, "Keep must not duplicate an edit that is already in the file");
      check((await layerRows(next).count()) === 8, "Keep must not change the layer count when the edits are already saved");
    }
    await context.close();
  }
  // ---------- Closed within 250 ms of the last edits ----------
  {
    const context = await newContext(browser);
    const page = await context.newPage();
    watchErrors(page, errors);
    await page.addInitScript(failWritesInit);
    log("last edits: 20 quick nudges, then reload while the journal's append can't finish");
    const fileId = await createFile(page, url);
    await layerRow(page, "Hero").click();
    await waitSaved(page);
    // Package writes fail and journal appends never commit: only the synchronous stash can keep these edits.
    await page.evaluate(() => (globalThis.__e2eFail = ({ journal }) => (journal ? "hold" : "fail")));
    await page.locator("canvas.canvas").focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
    await poll(async () => (await field(page, "X position")) === 100, "20 nudges should move Hero to X 100", 2_000);
    await page.reload();
    await canvasReady(page);
    await banner(page).waitFor({ timeout: T(5_000) });
    const text = await banner(page).innerText();
    check(/20 edits from your last session/.test(text), `the banner should offer the 20 nudges made just before the reload, got "${text}"`);
    check(!(await page.evaluate((id) => localStorage.getItem(`illigma.journal-stash.${id}`), fileId)), "the stash should be moved into the journal on load");
    await banner(page).getByRole("button", { name: "Keep" }).click();
    await banner(page).waitFor({ state: "detached", timeout: T(5_000) });
    await canvasReady(page);
    check((await heroX(page)) === 100, `Keep should restore all 20 nudges (X 100), got ${await heroX(page)}`);
    await waitSaved(page);

    log("last edits: the same with nothing failing never loses them");
    await layerRow(page, "Hero").click();
    await page.locator("canvas.canvas").focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
    await page.reload();
    await canvasReady(page);
    await page.waitForTimeout(300);
    let x = await heroX(page);
    if ((await banner(page).count()) === 1) {
      await banner(page).getByRole("button", { name: "Keep" }).click();
      await banner(page).waitFor({ state: "detached", timeout: T(5_000) });
      await canvasReady(page);
      x = await heroX(page);
    }
    check(x === 80, `after a reload right after 20 nudges, Hero should be at X 80 (saved, or offered for recovery), got ${x}`);
    await context.close();
  }
});
