import { useEffect, useRef, useState } from "react";
import type { Document } from "@illigma/core";
import type { ImagePaint, ImageScaleMode } from "@illigma/format";
import { IMAGE_SCALE_MODES, sniffImageFormat } from "@illigma/format";
import { MenuButton } from "../../ui/Menu";
import type { Phase } from "./edits";
import { InlineField, pct } from "./fields";
import { PaintIcon } from "./icons";
import { addImageFile, IMAGE_ACCEPT } from "./image";
import { SCALE_MODE_LABEL } from "./paints";

const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;

/** A preview URL for an image the document holds (revoked when it changes). */
function useImageUrl(doc: Document, hash: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const bytes = hash ? doc.image(hash) : undefined;
    const format = bytes ? sniffImageFormat(bytes) : null;
    if (!bytes || !format) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[format] }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [doc, hash]);
  return url;
}

/**
 * An image paint in the colour picker: a preview, Choose image… (the file
 * picker), the scale mode (Fill, Fit, Crop, Tile) and, for Tile, its scale.
 */
export function ImageFill({
  doc,
  paint,
  readOnly,
  onPaint,
  onError,
}: {
  doc: Document;
  paint: ImagePaint;
  readOnly: boolean;
  onPaint(next: ImagePaint, phase: Phase, what: "image" | "image scale mode" | "tile scale"): void;
  onError(message: string): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const url = useImageUrl(doc, paint.imageHash);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      const added = await addImageFile(doc, file);
      onPaint({ ...paint, imageHash: added.hash }, "once", "image");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="image-fill">
      <div className="image-preview" data-scale={paint.scaleMode}>
        {url ? <img src={url} alt="" /> : <span className="muted">No image yet</span>}
      </div>
      <div className="picker-row">
        <MenuButton<ImageScaleMode>
          label={`Image scale mode: ${SCALE_MODE_LABEL[paint.scaleMode]}`}
          title="Scale mode"
          className="picker-select"
          disabled={readOnly}
          entries={IMAGE_SCALE_MODES.map((m) => ({ value: m, label: SCALE_MODE_LABEL[m], checked: m === paint.scaleMode }))}
          onSelect={(m) => {
            const next: ImagePaint = { ...paint, scaleMode: m };
            if (m !== "TILE") delete next.scalingFactor;
            if (m !== "CROP") delete next.imageTransform;
            onPaint(next, "once", "image scale mode");
          }}
        >
          <span className="picker-select-label">{SCALE_MODE_LABEL[paint.scaleMode]}</span>
          <PaintIcon name="chevron-down" size={12} />
        </MenuButton>
        {paint.scaleMode === "TILE" && (
          <InlineField
            label="Tile scale"
            className="picker-field narrow"
            value={pct(paint.scalingFactor ?? 1)}
            readOnly={readOnly}
            step={1}
            parse={(t) => {
              const n = Number.parseFloat(t.replace("%", "").replace(",", "."));
              return Number.isFinite(n) && n > 0 ? Math.min(100_000, n) / 100 : null;
            }}
            onCommit={(v) => onPaint({ ...paint, scalingFactor: v as number }, "once", "tile scale")}
          />
        )}
        <span className="picker-spacer" />
        <button type="button" className="btn btn-secondary" disabled={readOnly} onClick={() => input.current?.click()}>
          <PaintIcon name="image" />
          Choose image…
        </button>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
