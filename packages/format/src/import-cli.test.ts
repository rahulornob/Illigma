/** The `import:prototype` command: what it writes, what it refuses to touch, and its error messages. */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runImportCli } from "./import-cli.js";
import { readPackage } from "./package.js";
import { isZip, readZip } from "./zip.js";

const DOC = JSON.stringify({ version: 1, title: "Old", objects: [{ id: "r", type: "rect", x: 0, y: 0, w: 10, h: 10, fill: "#ff0000" }] });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "illigma-cli-"));
  writeFileSync(join(dir, "old.json"), DOC);
});
afterEach(() => {
  chmodSync(dir, 0o755);
  rmSync(dir, { recursive: true, force: true });
});

function run(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runImportCli(args, { cwd: dir, out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}
const p = (...parts: string[]) => join(dir, ...parts);
const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

/** A folder that looks like a web project or browser extension: it has a manifest.json, but not Illigma's. */
function victim(name = "victim") {
  mkdirSync(p(name, "src"), { recursive: true });
  writeFileSync(p(name, "manifest.json"), JSON.stringify({ manifest_version: 3 }));
  writeFileSync(p(name, "src", "code.js"), "console.log(1)");
}

describe("import:prototype command", () => {
  it("writes the package form, or the zip form with --zip, and leaves no temporary files", () => {
    expect(run("old.json", "new.illigma")).toMatchObject({ code: 0, err: "" });
    expect(JSON.parse(readFileSync(p("new.illigma", "manifest.json"), "utf8")).name).toBe("Old");
    expect(run("old.json", "new.zip.illigma", "--zip").code).toBe(0);
    const bytes = readFileSync(p("new.zip.illigma"));
    expect(isZip(bytes)).toBe(true);
    expect(readPackage(readZip(bytes)).manifest.name).toBe("Old");
    expect(readdirSync(dir).sort()).toEqual(["new.illigma", "new.zip.illigma", "old.json"]);
  });

  it("accepts input saved with a UTF-8 byte order mark", () => {
    writeFileSync(p("bom.json"), "﻿" + DOC);
    expect(run("bom.json", "out.illigma")).toMatchObject({ code: 0, err: "" });
  });

  it("replaces an existing Illigma file only with --force", () => {
    run("old.json", "new.illigma");
    expect(run("old.json", "new.illigma").err).toBe("new.illigma already exists. Choose another name, or add --force to replace it.");
    writeFileSync(p("new.illigma", "extra.txt"), "stale");
    expect(run("old.json", "new.illigma", "--force").code).toBe(0);
    expect(existsSync(p("new.illigma", "extra.txt"))).toBe(false);
    // A zip can replace a package folder, and the other way round.
    expect(run("old.json", "new.illigma", "--zip", "--force").code).toBe(0);
    expect(isZip(readFileSync(p("new.illigma")))).toBe(true);
    expect(run("old.json", "new.illigma", "--force").code).toBe(0);
    expect(existsSync(p("new.illigma", "manifest.json"))).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(["new.illigma", "old.json"]);
  });

  it("never replaces a folder whose manifest.json isn't Illigma's", () => {
    victim();
    expect(run("old.json", "victim", "--force")).toMatchObject({
      code: 1,
      err: "victim is a folder that isn't an Illigma file, so it won't be replaced. Choose another name.",
    });
    expect(readFileSync(p("victim", "src", "code.js"), "utf8")).toBe("console.log(1)");
    writeFileSync(p("victim", "manifest.json"), "{not json");
    expect(run("old.json", "victim", "--force").code).toBe(1);
    expect(existsSync(p("victim", "src", "code.js"))).toBe(true);
  });

  it("never replaces a file that isn't an Illigma zip", () => {
    writeFileSync(p("notes.md"), "# My notes");
    expect(run("old.json", "notes.md", "--force")).toMatchObject({
      code: 1,
      err: "notes.md is a file that isn't an Illigma file, so it won't be replaced. Choose another name.",
    });
    expect(run("old.json", "notes.md", "--zip", "--force").code).toBe(1);
    expect(readFileSync(p("notes.md"), "utf8")).toBe("# My notes");
  });

  it("never writes the folder it runs in, its parents, the input or a folder holding the input", () => {
    // Even when that folder is itself an Illigma package.
    writeFileSync(p("manifest.json"), JSON.stringify({ format: "illigma" }));
    for (const out of [".", "..", dir]) {
      expect(run("old.json", out, "--force").err).toMatch(/is the folder you're in \(or holds it\), so it won't be written/);
    }
    expect(run("old.json", "old.json", "--force", "--zip").err).toMatch(/is the input or holds it/);
    mkdirSync(p("pkg"));
    writeFileSync(p("pkg", "manifest.json"), JSON.stringify({ format: "illigma" }));
    writeFileSync(p("pkg", "old.json"), DOC);
    expect(run("pkg/old.json", "pkg", "--force").err).toMatch(/is the input or holds it/);
    expect(existsSync(p("pkg", "old.json"))).toBe(true);
    expect(existsSync(p("old.json"))).toBe(true);
  });

  it("refuses to write through a symbolic link, dangling or not, naming the output", () => {
    symlinkSync(p("nowhere.illigma"), p("link.illigma"));
    for (const extra of [[], ["--zip"], ["--force"], ["--zip", "--force"]]) {
      expect(run("old.json", "link.illigma", ...extra)).toMatchObject({
        code: 1,
        err: "link.illigma is a link, and Illigma doesn't write through links. Choose another name.",
      });
    }
    expect(existsSync(p("nowhere.illigma"))).toBe(false);
  });

  it("explains input problems in plain language", () => {
    expect(run("missing.json", "out.illigma").err).toBe("Can't find missing.json.");
    mkdirSync(p("folder.json"));
    expect(run("folder.json", "out.illigma").err).toBe("folder.json is a folder. Give the prototype document's .json file.");
    writeFileSync(p("bad.json"), "{nope");
    expect(run("bad.json", "out.illigma").err).toBe("This file is not valid JSON, so it can't be an Illigma prototype document.");
    expect(run("old.json").code).toBe(2);
    expect(run("old.json", "out.illigma", "--zipp").err).toMatch(/^Unknown option --zipp\./);
    expect(existsSync(p("out.illigma"))).toBe(false);
  });

  it("explains output problems in plain language, naming the output", () => {
    writeFileSync(p("afile"), "x");
    for (const extra of [[], ["--zip"]]) {
      expect(run("old.json", "afile/out.illigma", ...extra)).toMatchObject({
        code: 1,
        err: "Can't write afile/out.illigma: part of its path is a file, not a folder.",
      });
    }
  });

  it.skipIf(isRoot)("explains an unreadable input and a folder it may not write to", () => {
    writeFileSync(p("secret.json"), DOC);
    chmodSync(p("secret.json"), 0o000);
    expect(run("secret.json", "out.illigma").err).toBe("Can't read secret.json: permission denied.");
    mkdirSync(p("locked"));
    chmodSync(p("locked"), 0o555);
    for (const extra of [[], ["--zip"]]) {
      expect(run("old.json", "locked/out.illigma", ...extra).err).toBe("Can't write locked/out.illigma: permission denied.");
    }
    chmodSync(p("locked"), 0o755);
    expect(readdirSync(p("locked"))).toEqual([]);
  });
});
