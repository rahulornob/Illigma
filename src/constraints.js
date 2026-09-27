// Freeform frame constraints. All geometry is in document/world coordinates.
export const constraintModes = ['start', 'end', 'stretch', 'center', 'scale'];

export function constraintAxis(position, size, oldStart, oldSize, newStart, newSize, mode = 'start') {
  const offset = position - oldStart;
  const delta = newSize - oldSize;
  if (mode === 'end') return [newStart + offset + delta, size];
  if (mode === 'center') return [newStart + offset + delta / 2, size];
  if (mode === 'stretch') return [newStart + offset, Math.max(1, size + delta)];
  if (mode === 'scale') {
    const ratio = newSize / Math.max(1, oldSize);
    return [newStart + offset * ratio, Math.max(1, size * ratio)];
  }
  return [newStart + offset, size];
}

export function resizeSnapshot(frames, objects) {
  return structuredClone({frames, objects});
}

// Apply against the original snapshot, never the previous pointermove result.
// This also makes modifier toggles and shrinking below minimum reversible.
export function resizeFrameTree(frame, bounds, frames, objects, snapshot, ignore = false) {
  const originalFrames = new Map(snapshot.frames.map(item => [item.id, item]));
  const liveFrames = new Map(frames.map(item => [item.id, item]));
  const liveObjects = new Map(objects.map(item => [item.id, item]));
  const children = new Map();
  for (const item of [...snapshot.frames, ...snapshot.objects]) {
    const parentId = item.width !== undefined ? item.parentId : item.frameId;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(item);
  }
  const seen = new Set();
  function apply(current, next) {
    if (seen.has(current.id)) return;
    seen.add(current.id);
    const before = originalFrames.get(current.id);
    Object.assign(current, next);
    if (!before) return;
    for (const child of children.get(current.id) || []) {
      const isFrame = child.width !== undefined;
      const live = (isFrame ? liveFrames : liveObjects).get(child.id);
      if (!live) continue;
      const width = isFrame ? child.width : child.w;
      const height = isFrame ? child.height : child.h;
      const rules = before.autoLayout?.enabled ? {} : child.constraints || {};
      const [x, w] = ignore ? [child.x, width] : constraintAxis(child.x, width, before.x, before.width, current.x, current.width, rules.horizontal);
      const [y, h] = ignore ? [child.y, height] : constraintAxis(child.y, height, before.y, before.height, current.y, current.height, rules.vertical);
      if (isFrame) apply(live, {x, y, width:w, height:h});
      else {
        Object.assign(live, {x, y, w, h});
        if (child.type === 'text') {
          live.baseW = child.baseW;
          live.baseH = child.baseH;
          // Both-edge text is a wrapping box, while Scale retains object scaling.
          if (!ignore && rules.horizontal === 'stretch' && w !== width) {
            live.constraintTextWrap = true;
            live.baseW = w;
            live.baseH = h;
          }
          else if (child.constraintTextWrap) live.constraintTextWrap = true;
          else delete live.constraintTextWrap;
          if (!ignore && live.constraintTextWrap && rules.vertical === 'stretch') live.baseH = h;
        }
      }
    }
  }
  apply(frame, bounds);
}
