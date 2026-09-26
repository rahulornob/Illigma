// Font binaries stay on this device in IndexedDB, separate from document autosave.
const records = new Map();
const builtin = ["Inter", "Georgia", "monospace"];
let dbPromise;
function database() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("illigma-fonts", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("fonts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Font storage is unavailable in this browser."));
  }));
}
async function persist(record) {
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("fonts", "readwrite");
    tx.objectStore("fonts").put(record);
    tx.oncomplete = resolve;
    tx.onerror = () =>
      reject(new Error("Could not save this font on your device."));
  });
}
async function activate(record) {
  const faces = await Promise.all(
    record.faces.map(async (descriptor) => {
      const { data, ...options } = descriptor;
      return new FontFace(record.family, data, options).load();
    }),
  );
  const previous = records.get(record.id);
  previous?.loaded.forEach((face) => document.fonts.delete(face));
  faces.forEach((face) => document.fonts.add(face));
  records.set(record.id, { ...record, loaded: faces });
}
export function fontFamilies() {
  return [
    ...new Set([...builtin, ...[...records.values()].map((r) => r.family)]),
  ];
}
export async function restoreFonts() {
  const db = await database();
  const saved = await new Promise((resolve, reject) => {
    const request = db.transaction("fonts").objectStore("fonts").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const results = await Promise.allSettled(saved.map(activate));
  return results.filter((r) => r.status === "rejected").length;
}
function cleanFamily(family) {
  const name = family.trim();
  if (!name || name.length > 100 || !/^[\p{L}\p{N} ._-]+$/u.test(name))
    throw new Error(
      "Use a font family name with letters, numbers, spaces, or hyphens.",
    );
  if (builtin.some((n) => n.toLowerCase() === name.toLowerCase()))
    throw new Error("Choose a different name; that font is already built in.");
  return name;
}
export async function importLocalFont(file, family, weight = "400") {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name))
    throw new Error("Choose a TTF, OTF, WOFF, or WOFF2 font.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a font smaller than 20 MB.");
  family = cleanFamily(
    family || file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
  );
  const record = {
    id: `local:${family}:${weight}`,
    family,
    source: "local",
    faces: [{ data: await file.arrayBuffer(), weight, style: "normal" }],
  };
  // Validate the binary before persisting it.
  await new FontFace(family, record.faces[0].data, { weight }).load();
  await persist(record);
  await activate(record);
  return family;
}
export async function importGoogleFont(name) {
  const family = cleanFamily(name);
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`;
  const fetchOptions = { signal: AbortSignal.timeout(15000) };
  let response = await fetch(
    `${base}:wght@400;500;600;700&display=swap`,
    fetchOptions,
  );
  if (!response.ok)
    response = await fetch(`${base}&display=swap`, {
      signal: AbortSignal.timeout(15000),
    });
  if (!response.ok)
    throw new Error(
      "Font not found. Check the exact Google Fonts family name.",
    );
  const css = await response.text();
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];
  if (!blocks.length)
    throw new Error("Google Fonts did not return a usable font.");
  const binaries = new Map();
  const faces = await Promise.all(
    blocks.map(async ([, block]) => {
      const raw = block
        .match(/src:\s*url\(([^)]+)\)/)?.[1]
        ?.replace(/["']/g, "");
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname !== "fonts.gstatic.com")
        throw new Error("Unexpected font source.");
      if (!binaries.has(url.href))
        binaries.set(
          url.href,
          fetch(url.href, { signal: AbortSignal.timeout(15000) }).then(
            async (r) => {
              if (!r.ok)
                throw new Error("Could not download the font. Try again.");
              return r.arrayBuffer();
            },
          ),
        );
      return {
        data: await binaries.get(url.href),
        weight: block.match(/font-weight:\s*([^;]+)/)?.[1] || "400",
        style: "normal",
        unicodeRange:
          block.match(/unicode-range:\s*([^;]+)/)?.[1] || "U+0-10FFFF",
      };
    }),
  );
  const record = { id: `google:${family}`, family, source: "google", faces };
  await Promise.all(
    faces.map(({ data, ...options }) =>
      new FontFace(family, data, options).load(),
    ),
  );
  await persist(record);
  await activate(record);
  return family;
}
