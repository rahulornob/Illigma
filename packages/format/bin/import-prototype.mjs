#!/usr/bin/env node
// Converts a document saved by the old browser prototype into a .illigma file.
// Usage: npm run import:prototype -- <in.json> <out.illigma> [--zip] [--force]
//   (or, after `npm run build`: node packages/format/bin/import-prototype.mjs …)
// Writes the package form (a folder) unless --zip is given, which writes the
// single-file form. Refuses to overwrite an existing output unless --force,
// and even then only replaces an Illigma file (see src/import-cli.ts).
// Runs offline: it only reads and writes the two paths you give it.
import { runImportCli } from "../dist/import-cli.js";

// `npm run` changes into the repo root; resolve paths from where the command was typed.
process.exitCode = runImportCli(process.argv.slice(2), {
  cwd: process.env.INIT_CWD ?? process.cwd(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
