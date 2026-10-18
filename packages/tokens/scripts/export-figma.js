// Read-only export of Illigma's design tokens from the Figma file "Illigma"
// (key K9mCPjBElVGiPOHJvZ4CWY). Run it in the Figma plugin context, for
// example with the figma-console MCP tool `figma_execute` (pass the fileKey),
// and save the returned JSON string as packages/tokens/figma-export.json.
//
// It reads every local variable collection (names, types, the raw alias per
// mode and the value resolved through aliases), the local text styles and the
// local effect styles. It never changes the file.
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const vars = await figma.variables.getLocalVariablesAsync();
const byId = new Map(vars.map((v) => [v.id, v]));
const colById = new Map(cols.map((c) => [c.id, c]));
function resolve(val, modeId) {
  if (val && typeof val === "object" && val.type === "VARIABLE_ALIAS") {
    const t = byId.get(val.id);
    if (!t) return { missing: val.id };
    const tc = colById.get(t.variableCollectionId);
    const m = tc.modes.find((x) => x.modeId === modeId) ? modeId : tc.defaultModeId;
    return resolve(t.valuesByMode[m], m);
  }
  return val;
}
const out = { file: figma.root.name, fileKey: "K9mCPjBElVGiPOHJvZ4CWY", collections: [] };
for (const c of cols) {
  const cv = c.variableIds.map((id) => byId.get(id)).filter(Boolean);
  out.collections.push({
    id: c.id, name: c.name, defaultModeId: c.defaultModeId, modes: c.modes,
    variables: cv.map((v) => {
      const values = {};
      for (const m of c.modes) {
        const raw = v.valuesByMode[m.modeId];
        const e = {};
        if (raw && typeof raw === "object" && raw.type === "VARIABLE_ALIAS") {
          const t = byId.get(raw.id);
          e.alias = t ? t.name : null; e.aliasId = raw.id;
          e.aliasCollection = t ? colById.get(t.variableCollectionId).name : null;
        }
        e.value = resolve(raw, m.modeId);
        values[m.name] = e;
      }
      return { id: v.id, name: v.name, type: v.resolvedType, description: v.description || undefined, scopes: v.scopes, hiddenFromPublishing: v.hiddenFromPublishing || undefined, values };
    }),
  });
}
const ts = await figma.getLocalTextStylesAsync();
out.textStyles = ts.map((s) => ({ id: s.id, name: s.name, description: s.description || undefined, fontName: s.fontName, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, paragraphSpacing: s.paragraphSpacing, textCase: s.textCase, textDecoration: s.textDecoration, boundVariables: Object.keys(s.boundVariables || {}).length ? Object.fromEntries(Object.entries(s.boundVariables).map(([k, a]) => [k, byId.get(a.id)?.name])) : undefined }));
const es = await figma.getLocalEffectStylesAsync();
out.effectStyles = es.map((s) => ({ id: s.id, name: s.name, description: s.description || undefined, effects: s.effects.map((e) => { const o = { ...e }; if (e.boundVariables && Object.keys(e.boundVariables).length) o.boundVariables = Object.fromEntries(Object.entries(e.boundVariables).map(([k, a]) => [k, byId.get(a.id)?.name])); else delete o.boundVariables; return o; }) }));
const ps = await figma.getLocalPaintStylesAsync();
out.paintStylesCount = ps.length;
return JSON.stringify(out);
