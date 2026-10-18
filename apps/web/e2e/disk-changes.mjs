// Changes on disk (save-states.md rule 4): when another writer changed the
// file since this tab last read it, saving stops instead of overwriting it,
// the title bar reads "Changed on disk" and a banner offers Compare… and
// Keep mine. Compare opens the disk version read-only in a new tab; Keep mine
// first writes this tab's version as a conflict copy (its own file id), then
// asks before replacing the disk version.
//
// Usage (from the repo root):  node apps/web/e2e/disk-changes.mjs [--headed] [--no-build]

import { T, canvasReady, createFile, layerRow, newContext, poll, runE2E, saveState, setField, waitSaved, watchErrors } from "./lib.mjs";

await runE2E("disk-changes", {}, async ({ browser, url, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const status = page.locator(".save-status");

  log("create a file");
  const fileId = await createFile(page, url);
  await waitSaved(page);

  log("another writer saves the package (its save id changes)");
  await page.evaluate(async (id) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
    const w = await (await dir.getFileHandle(".illigma-rev")).createWritable();
    await w.write(JSON.stringify({ save: "someone-else" }) + "\n");
    await w.close();
  }, fileId);

  log("an edit then doesn't overwrite it: Changed on disk");
  await layerRow(page, "Hero").click();
  await setField(page, "X position", 321);
  await poll(async () => (await saveState(page)) === "changed-on-disk", "the save should stop with changed-on-disk", 10_000);
  check((await status.innerText()).trim() === "Changed on disk", `the title bar should read "Changed on disk", got "${await status.innerText()}"`);
  const banner = page.locator(".banner", { hasText: "Changed on disk." });
  check((await banner.count()) === 1, "a Changed on disk banner should appear");
  check((await banner.getAttribute("role")) === "alert", "the banner should be announced");
  const rev = await page.evaluate(async (id) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle("files")).getDirectoryHandle(id);
    return (await (await dir.getFileHandle(".illigma-rev")).getFile()).text();
  }, fileId);
  check(rev.includes("someone-else"), "the other writer's save must stay on disk");
  await page.screenshot({ path: `${outDir}/disk-changed.png` });

  log("Compare… opens the disk version read-only in a new tab");
  const [view] = await Promise.all([context.waitForEvent("page"), banner.getByRole("button", { name: "Compare…" }).click()]);
  watchErrors(view, errors);
  await view.waitForURL(/#\/compare\/[\w-]+$/, { timeout: T(10_000) });
  await canvasReady(view);
  await view.locator(".banner", { hasText: "The version on disk — read-only." }).waitFor({ timeout: T(5_000) });
  check((await view.locator(".save-status").innerText()).includes("read-only"), "the compare tab should say it is read-only");
  await view.close();

  log("Keep mine: a conflict copy first, then replace after confirming");
  await banner.getByRole("button", { name: "Keep mine" }).click();
  const confirm = page.locator(".banner", { hasText: "Your version is saved as" });
  await confirm.waitFor({ timeout: T(5_000) });
  check(/\(conflict \d{4}-\d\d-\d\d \d\d\.\d\d\) in browser storage/.test(await confirm.innerText()), `the banner should name the conflict copy, got "${await confirm.innerText()}"`);
  const files = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const out = [];
    for await (const [id, h] of (await root.getDirectoryHandle("files")).entries()) {
      const m = JSON.parse(await (await (await h.getFileHandle("manifest.json")).getFile()).text());
      out.push({ id, fileId: m.fileId, name: m.name });
    }
    return out;
  });
  const copy = files.find((f) => f.id !== fileId);
  check(files.length === 2 && copy && copy.fileId === copy.id && copy.name.includes("(conflict"), `a conflict copy with its own id should exist, got ${JSON.stringify(files)}`);
  await confirm.getByRole("button", { name: "Replace disk version" }).click();
  await waitSaved(page);
  check((await page.locator(".banner", { hasText: "Changed on disk." }).count()) === 0, "the banner should go once the disk version is replaced");

  log("the replaced file holds the edit");
  await page.reload();
  await canvasReady(page);
  await layerRow(page, "Hero").click();
  check(Number(await page.getByLabel("X position").inputValue()) === 321, "the kept edit should be in the file");
  await context.close();
});
