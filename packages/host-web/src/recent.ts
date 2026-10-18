import { opfsRoot, readText } from "./fs.js";

export interface RecentFile {
  fileId: string;
  name: string;
  /** When manifest.json was last written (ms since epoch). */
  updatedAt: number;
}

/** Files kept in OPFS ("files/<fileId>/manifest.json"), newest first. Folders without a readable manifest are skipped. */
export async function listRecentFiles(root?: FileSystemDirectoryHandle): Promise<RecentFile[]> {
  let files: FileSystemDirectoryHandle;
  try {
    files = await (await opfsRoot(root)).getDirectoryHandle("files");
  } catch (err) {
    if ((err as { name?: unknown })?.name === "NotFoundError") return [];
    throw err;
  }
  const out: RecentFile[] = [];
  for await (const [fileId, handle] of files.entries()) {
    if (handle.kind !== "directory") continue;
    try {
      const manifest = await (handle as FileSystemDirectoryHandle).getFileHandle("manifest.json");
      const file = await manifest.getFile();
      const parsed = JSON.parse(await readText(manifest)) as { name?: unknown };
      out.push({ fileId, name: typeof parsed.name === "string" ? parsed.name : "Untitled", updatedAt: file.lastModified });
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt || (a.name < b.name ? -1 : 1));
}
