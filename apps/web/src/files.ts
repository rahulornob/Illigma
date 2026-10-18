/**
 * Opening and creating files. Everything here is local: files live in this
 * browser's private storage (OPFS) or in a folder the person picks.
 */
import { Document, type Operation } from "@illigma/core";
import { readPackage, writePackage, type FileTree } from "@illigma/format";
import { opfsBackend, pickFolderBackend, RecoveryJournal, type Backend } from "@illigma/host-web";

/** An open file: the document, where it is saved, and any recovered edits. */
export interface Session {
  doc: Document;
  backend: Backend;
  journal: RecoveryJournal;
  /** Edits found in the recovery journal that never reached the file. */
  recovered: Operation[];
}

const solid = (r: number, g: number, b: number) => ({ type: "SOLID" as const, visible: true, color: { r, g, b, a: 1 } });

/** A new document with one page and a sample frame. Its undo history starts empty. */
export function sampleDocument(name = "Untitled"): Document {
  const draft = new Document(name);
  draft.transact("Create file", (tx) => {
    const page = tx.addPage("Page 1");
    const frame = tx.create("FRAME", page, { name: "Desktop", x: 0, y: 0, width: 1440, height: 900, fills: [solid(1, 1, 1)] });
    tx.create("RECTANGLE", frame, { name: "Hero", x: 120, y: 160, width: 560, height: 320, cornerRadius: 16, fills: [solid(0.85, 0.85, 0.85)] });
    tx.create("ELLIPSE", frame, { name: "Avatar", x: 1200, y: 40, width: 96, height: 96, fills: [solid(1, 0.357, 0.18)] });
  });
  // Re-reading the file drops the "Create file" step, so undo can't remove the only page.
  return Document.fromFile(draft.toFile());
}

function isEmpty(tree: FileTree): boolean {
  return !tree.has("manifest.json");
}

async function withJournal(doc: Document, backend: Backend): Promise<Session> {
  const journal = new RecoveryJournal(doc.fileId);
  let recovered: Operation[] = [];
  try {
    recovered = await journal.pending();
  } catch {
    recovered = [];
  }
  return { doc, backend, journal, recovered };
}

/** Create a new file in this browser's storage. */
export async function createFile(): Promise<Session> {
  const doc = sampleDocument();
  const backend = opfsBackend(doc.fileId, doc.name);
  await backend.write(writePackage(doc.toFile()));
  return withJournal(doc, backend);
}

/** Open a file from this browser's storage. */
export async function openStoredFile(fileId: string, name: string): Promise<Session> {
  const tree = await opfsBackend(fileId, name).read();
  if (isEmpty(tree)) throw new Error(`"${name}" is empty or was removed from this browser's storage.`);
  const doc = Document.fromFile(readPackage(tree));
  return withJournal(doc, opfsBackend(doc.fileId, doc.name));
}

/** Ask for a folder, then open the `.illigma` package in it, or start a new file there if it's empty. */
export async function openFolder(): Promise<Session | null> {
  const backend = await pickFolderBackend();
  if (!backend) return null;
  const tree = await backend.read();
  if (isEmpty(tree)) {
    const doc = sampleDocument(backend.label);
    await backend.write(writePackage(doc.toFile()));
    return withJournal(doc, backend);
  }
  return withJournal(Document.fromFile(readPackage(tree)), backend);
}

/**
 * Apply recovered edits on top of the file, save, and return a fresh document
 * (so the editor and renderer see every change).
 */
export async function keepRecovered(session: Session): Promise<Session> {
  for (const op of session.recovered) {
    try {
      session.doc.apply(op);
    } catch {
      // An edit that no longer fits (e.g. its node is gone) is skipped; the rest still apply.
    }
  }
  const doc = Document.fromFile(session.doc.toFile());
  await session.backend.write(writePackage(doc.toFile()));
  await session.journal.clear();
  return { ...session, doc, recovered: [] };
}

export async function discardRecovered(session: Session): Promise<Session> {
  await session.journal.clear();
  return { ...session, recovered: [] };
}
