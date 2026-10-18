#!/usr/bin/env node
// Converts a document saved by the old browser prototype into a .illigma file.
// Usage: npm run import:prototype -- <in.json> <out.illigma> [--zip] [--force]
//   (or, after `npm run build`: node packages/format/bin/import-prototype.mjs …)
// Writes the package form (a folder) unless --zip is given, which writes the
// single-file form. Refuses to overwrite an existing output unless --force.
// Runs offline: it only reads and writes the two paths you give it.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FormatError, importPrototypeJson, writePackage, writeZip } from "../dist/index.js";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [input, output] = args.filter((a) => !a.startsWith("--"));
const unknownFlag = [...flags].find((f) => f !== "--zip" && f !== "--force");

if (!input || !output || unknownFlag) {
  if (unknownFlag) console.error(`Unknown option ${unknownFlag}.`);
  console.error("Usage: npm run import:prototype -- <prototype.json> <out.illigma> [--zip] [--force]");
  process.exit(2);
}

// `npm run` changes into the repo root; resolve paths from where the command was typed.
const cwd = process.env.INIT_CWD ?? process.cwd();
const inPath = resolve(cwd, input);
const outPath = resolve(cwd, output);

try {
  if (statSync(inPath).size > 64 * 1024 * 1024) throw new FormatError("The input file is too large to import (more than 64 MB).");
  const { file, warnings } = importPrototypeJson(readFileSync(inPath, "utf8"));
  const tree = writePackage(file);

  if (existsSync(outPath)) {
    if (!flags.has("--force")) throw new FormatError(`${output} already exists. Choose another name, or add --force to replace it.`);
    // Only ever replace a file or an Illigma package folder, never some other folder by mistake.
    if (statSync(outPath).isDirectory() && !existsSync(join(outPath, "manifest.json"))) {
      throw new FormatError(`${output} is a folder that isn't an Illigma file, so it won't be replaced. Choose another name.`);
    }
    rmSync(outPath, { recursive: true, force: true });
  }
  if (flags.has("--zip")) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, writeZip(tree));
  } else {
    for (const [path, text] of tree) {
      const target = join(outPath, ...path.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
  }

  const layers = file.nodes.filter((n) => n.type !== "PAGE").length;
  console.log(`Imported "${file.manifest.name}": ${file.manifest.pages.length} page(s), ${layers} layer(s) → ${outPath}`);
  for (const w of warnings) console.log(`  · ${w}`);
} catch (e) {
  if (e instanceof FormatError) console.error(e.message);
  else if (e && e.code === "ENOENT") console.error(`Can't find ${input}.`);
  else throw e;
  process.exit(1);
}
