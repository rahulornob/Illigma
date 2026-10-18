/**
 * The `import:prototype` command (`bin/import-prototype.mjs`): convert an old
 * prototype document into a `.illigma` file on disk. Node only, so it is not
 * exported from the package index (which also runs in browsers).
 *
 * Safety rules for the output:
 * - An existing output is only replaced with `--force`, and only when it is an
 *   Illigma file: a package folder whose manifest.json says "format": "illigma",
 *   or a zip holding such a manifest. Any other file or folder is left alone.
 * - Never the folder the command runs in or one of its parents, never the
 *   input or a folder holding it, never through a symbolic link.
 * - The new file is written next to the output under a temporary name and
 *   renamed into place, so a failed import leaves the old file as it was.
 */

import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { importPrototypeJson } from "./import-prototype.js";
import { fileText, FormatError, writePackage, type FileTree } from "./package.js";
import { isZip, readZip, writeZip } from "./zip.js";

export const IMPORT_CLI_USAGE = "Usage: npm run import:prototype -- <prototype.json> <out.illigma> [--zip] [--force]";
const MAX_INPUT_BYTES = 64 * 1024 * 1024;

export interface ImportCliIo {
  /** Where relative paths are resolved from: the folder the command was typed in. */
  cwd: string;
  out(line: string): void;
  err(line: string): void;
}

/** Runs the command; returns the process exit code (0 done, 1 failed, 2 usage). */
export function runImportCli(args: readonly string[], io: ImportCliIo): number {
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const [input, output, extra] = args.filter((a) => !a.startsWith("--"));
  const unknownFlag = [...flags].find((f) => f !== "--zip" && f !== "--force");
  if (!input || !output || extra !== undefined || unknownFlag) {
    if (unknownFlag) io.err(`Unknown option ${unknownFlag}.`);
    io.err(IMPORT_CLI_USAGE);
    return 2;
  }
  try {
    const inPath = resolve(io.cwd, input);
    const outPath = resolve(io.cwd, output);
    const { file, warnings } = importPrototypeJson(readInput(inPath, input));
    const tree = writePackage(file);
    const zip = flags.has("--zip");
    writeOutput(zip ? writeZip(tree) : tree, outPath, output, inPath, io.cwd, flags.has("--force"));
    const layers = file.nodes.filter((n) => n.type !== "PAGE").length;
    io.out(`Imported "${file.manifest.name}": ${file.manifest.pages.length} page(s), ${layers} layer(s) → ${outPath}`);
    for (const w of warnings) io.out(`  · ${w}`);
    return 0;
  } catch (e) {
    if (!(e instanceof FormatError)) throw e;
    io.err(e.message);
    return 1;
  }
}

function code(e: unknown): string {
  return e && typeof e === "object" && "code" in e && typeof e.code === "string" ? e.code : "";
}

function readInput(path: string, name: string): string {
  try {
    const st = statSync(path);
    if (st.isDirectory()) throw new FormatError(`${name} is a folder. Give the prototype document's .json file.`);
    if (st.size > MAX_INPUT_BYTES) throw new FormatError("The input file is too large to import (more than 64 MB).");
    return readFileSync(path, "utf8");
  } catch (e) {
    if (e instanceof FormatError) throw e;
    switch (code(e)) {
      case "ENOENT":
      case "ENOTDIR":
        throw new FormatError(`Can't find ${name}.`);
      case "EISDIR":
        throw new FormatError(`${name} is a folder. Give the prototype document's .json file.`);
      case "EACCES":
      case "EPERM":
        throw new FormatError(`Can't read ${name}: permission denied.`);
      default:
        throw new FormatError(`Can't read ${name}${code(e) ? ` (${code(e)})` : ""}.`);
    }
  }
}

/** A plain message for a failure while writing `name`. */
function writeError(e: unknown, name: string): FormatError {
  if (e instanceof FormatError) return e;
  switch (code(e)) {
    case "EACCES":
    case "EPERM":
    case "EROFS":
      return new FormatError(`Can't write ${name}: permission denied.`);
    case "ENOTDIR":
    case "EEXIST":
      return new FormatError(`Can't write ${name}: part of its path is a file, not a folder.`);
    case "ENOSPC":
      return new FormatError(`Can't write ${name}: the disk is full.`);
    default:
      return new FormatError(`Can't write ${name}${code(e) ? ` (${code(e)})` : ""}.`);
  }
}

/** True when `inner` is `outer` or inside it. */
function within(inner: string, outer: string): boolean {
  const rel = relative(outer, inner);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** True when the manifest text is an Illigma manifest. */
function illigmaManifest(text: string | undefined): boolean {
  try {
    const m = text === undefined ? undefined : (JSON.parse(text) as unknown);
    return !!m && typeof m === "object" && (m as Record<string, unknown>).format === "illigma";
  } catch {
    return false;
  }
}

/** True when `path` (which exists and is not a link) is an Illigma package folder or zip file. */
function isIlligmaFile(path: string, isDirectory: boolean): boolean {
  try {
    if (isDirectory) return illigmaManifest(readFileSync(join(path, "manifest.json"), "utf8"));
    const bytes = readFileSync(path);
    return isZip(bytes) && illigmaManifest(fileText(readZip(bytes).get("manifest.json")));
  } catch {
    return false;
  }
}

function writeOutput(data: Uint8Array | FileTree, outPath: string, name: string, inPath: string, cwd: string, force: boolean): void {
  if (within(cwd, outPath)) throw new FormatError(`${name} is the folder you're in (or holds it), so it won't be written. Choose another name.`);
  if (within(inPath, outPath)) throw new FormatError(`${name} is the input or holds it, so it won't be written. Choose another name.`);

  let existing: { isDirectory: boolean } | null = null;
  try {
    const st = lstatSync(outPath);
    if (st.isSymbolicLink()) throw new FormatError(`${name} is a link, and Illigma doesn't write through links. Choose another name.`);
    existing = { isDirectory: st.isDirectory() };
  } catch (e) {
    if (code(e) !== "ENOENT") throw writeError(e, name);
  }
  if (existing) {
    if (!force) throw new FormatError(`${name} already exists. Choose another name, or add --force to replace it.`);
    if (!isIlligmaFile(outPath, existing.isDirectory)) {
      throw new FormatError(`${name} is a ${existing.isDirectory ? "folder" : "file"} that isn't an Illigma file, so it won't be replaced. Choose another name.`);
    }
  }

  const parent = dirname(outPath);
  const stamp = `${process.pid}-${Date.now().toString(36)}`;
  const temp = join(parent, `.${basename(outPath)}.importing-${stamp}`);
  const old = join(parent, `.${basename(outPath)}.replaced-${stamp}`);
  try {
    mkdirSync(parent, { recursive: true });
    if (data instanceof Uint8Array) writeFileSync(temp, data, { flag: "wx" });
    else {
      mkdirSync(temp);
      for (const [path, text] of data) {
        const target = join(temp, ...path.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, { flag: "wx" });
      }
    }
    if (existing) {
      renameSync(outPath, old);
      try {
        renameSync(temp, outPath);
      } catch (e) {
        renameSync(old, outPath); // put the old file back
        throw e;
      }
      rmSync(old, { recursive: true, force: true });
    } else renameSync(temp, outPath);
  } catch (e) {
    throw writeError(e, name);
  } finally {
    try {
      rmSync(temp, { recursive: true, force: true }); // left over only after a failure
    } catch {
      // nothing was written there
    }
  }
}
