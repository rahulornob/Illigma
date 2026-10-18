/**
 * A baseline JPEG encoder (JFIF, 8-bit YCbCr, no chroma subsampling, the
 * standard Huffman tables of ITU T.81 Annex K). CanvasKit's default build
 * has no JPEG encoder, only its "full" build does, so JPG export falls back
 * to this. Full-resolution colour keeps the edges of coloured UI and text
 * sharp. Deterministic: the same pixels and quality give the same bytes.
 */

/** Standard quantisation tables (Annex K.1), in natural (row-major) order. */
const LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78,
  87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_Q = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, ...new Array<number>(32).fill(99),
];

/** Zigzag position k → natural index. */
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39,
  46, 53, 60, 61, 54, 47, 55, 62, 63,
];

/** Standard Huffman tables (Annex K.3): code counts per length 1–16, then values. */
const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VALUES = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33,
  0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
  0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96,
  0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4,
  0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VALUES = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62,
  0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54,
  0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
  0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2,
  0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

interface Huffman {
  /** Code and length by symbol. */
  code: Uint16Array;
  size: Uint8Array;
}

/** Codes from counts per length (Annex C). */
function huffman(bits: readonly number[], values: readonly number[]): Huffman {
  const code = new Uint16Array(256);
  const size = new Uint8Array(256);
  let c = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < (bits[len - 1] as number); i++) {
      const v = values[k++] as number;
      code[v] = c++;
      size[v] = len;
    }
    c <<= 1;
  }
  return { code, size };
}

/** Quantisation table for a quality of 1–100 (the IJG scaling). */
function scaleTable(base: readonly number[], quality: number): Uint8Array {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return Uint8Array.from(base, (v) => Math.min(255, Math.max(1, Math.floor((v * s + 50) / 100))));
}

/** DCT basis: COS[u * 8 + x] = ½ · C(u) · cos((2x + 1)uπ / 16). */
const COS = new Float64Array(64);
for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) COS[u * 8 + x] = 0.5 * (u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16);

class BitWriter {
  private bytes = new Uint8Array(1 << 16);
  length = 0;
  private acc = 0;
  private count = 0;

  byte(b: number): void {
    if (this.length === this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.length++] = b;
  }

  raw(data: readonly number[]): void {
    for (const b of data) this.byte(b);
  }

  /** Entropy-coded bits, with 0xFF bytes stuffed with a 0x00. */
  bits(value: number, size: number): void {
    for (let i = size - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((value >> i) & 1);
      if (++this.count === 8) {
        this.byte(this.acc);
        if (this.acc === 0xff) this.byte(0);
        this.acc = 0;
        this.count = 0;
      }
    }
  }

  /** Pad the last byte with 1 bits. */
  flush(): void {
    if (this.count) this.bits((1 << (8 - this.count)) - 1, 8 - this.count);
  }

  result(): Uint8Array {
    return this.bytes.slice(0, this.length);
  }
}

const u16 = (v: number) => [(v >> 8) & 0xff, v & 0xff];

/**
 * Encode RGBA pixels (row by row from the top; alpha ignored, so draw over
 * a background first) as a baseline JPEG at `quality` 0–100.
 */
export function encodeJpeg(rgba: Uint8Array, width: number, height: number, quality: number): Uint8Array {
  const qY = scaleTable(LUMA_Q, quality);
  const qC = scaleTable(CHROMA_Q, quality);
  const dcY = huffman(DC_LUMA_BITS, DC_VALUES);
  const dcC = huffman(DC_CHROMA_BITS, DC_VALUES);
  const acY = huffman(AC_LUMA_BITS, AC_LUMA_VALUES);
  const acC = huffman(AC_CHROMA_BITS, AC_CHROMA_VALUES);
  const out = new BitWriter();

  out.raw([0xff, 0xd8]); // SOI
  out.raw([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]); // APP0 JFIF 1.1, aspect 1:1
  for (const [id, table] of [[0, qY], [1, qC]] as const) {
    out.raw([0xff, 0xdb, 0, 67, id]);
    for (let k = 0; k < 64; k++) out.byte(table[ZIGZAG[k] as number] as number);
  }
  // SOF0: 8-bit, three components at full resolution.
  out.raw([0xff, 0xc0, 0, 17, 8, ...u16(height), ...u16(width), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const tables: [number, readonly number[], readonly number[]][] = [
    [0x00, DC_LUMA_BITS, DC_VALUES],
    [0x10, AC_LUMA_BITS, AC_LUMA_VALUES],
    [0x01, DC_CHROMA_BITS, DC_VALUES],
    [0x11, AC_CHROMA_BITS, AC_CHROMA_VALUES],
  ];
  for (const [cls, bits, values] of tables) {
    out.raw([0xff, 0xc4, ...u16(3 + 16 + values.length), cls, ...bits, ...values]);
  }
  out.raw([0xff, 0xda, 0, 12, 3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]); // SOS

  const blockY = new Float64Array(64);
  const blockCb = new Float64Array(64);
  const blockCr = new Float64Array(64);
  const tmp = new Float64Array(64);
  const coef = new Int32Array(64);
  const pred = [0, 0, 0];

  const encodeBlock = (block: Float64Array, q: Uint8Array, dc: Huffman, ac: Huffman, comp: number) => {
    // Separable 2D DCT: rows, then columns.
    for (let y = 0; y < 8; y++) {
      for (let u = 0; u < 8; u++) {
        let s = 0;
        for (let x = 0; x < 8; x++) s += (COS[u * 8 + x] as number) * (block[y * 8 + x] as number);
        tmp[y * 8 + u] = s;
      }
    }
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        let s = 0;
        for (let y = 0; y < 8; y++) s += (COS[v * 8 + y] as number) * (tmp[y * 8 + u] as number);
        coef[v * 8 + u] = Math.round(s / (q[v * 8 + u] as number));
      }
    }
    // DC: difference from the previous block of this component.
    const d = (coef[0] as number) - (pred[comp] as number);
    pred[comp] = coef[0] as number;
    writeValue(d, dc, 0);
    // AC: zero runs and values in zigzag order.
    let run = 0;
    for (let k = 1; k < 64; k++) {
      const v = coef[ZIGZAG[k] as number] as number;
      if (v === 0) {
        run++;
        continue;
      }
      while (run > 15) {
        out.bits(ac.code[0xf0] as number, ac.size[0xf0] as number);
        run -= 16;
      }
      writeValue(v, ac, run << 4);
      run = 0;
    }
    if (run) out.bits(ac.code[0] as number, ac.size[0] as number); // EOB
  };

  const writeValue = (v: number, table: Huffman, prefix: number) => {
    const mag = Math.abs(v);
    const cat = mag ? 32 - Math.clz32(mag) : 0;
    const sym = prefix | cat;
    out.bits(table.code[sym] as number, table.size[sym] as number);
    if (cat) out.bits(v < 0 ? v + (1 << cat) - 1 : v, cat);
  };

  for (let by = 0; by < height; by += 8) {
    for (let bx = 0; bx < width; bx += 8) {
      for (let y = 0; y < 8; y++) {
        // Blocks past the edge repeat the last row and column.
        const row = Math.min(by + y, height - 1) * width;
        for (let x = 0; x < 8; x++) {
          const i = (row + Math.min(bx + x, width - 1)) * 4;
          const r = rgba[i] as number, g = rgba[i + 1] as number, b = rgba[i + 2] as number;
          const k = y * 8 + x;
          blockY[k] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          blockCb[k] = -0.168736 * r - 0.331264 * g + 0.5 * b;
          blockCr[k] = 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
      encodeBlock(blockY, qY, dcY, acY, 0);
      encodeBlock(blockCb, qC, dcC, acC, 1);
      encodeBlock(blockCr, qC, dcC, acC, 2);
    }
  }
  out.flush();
  out.raw([0xff, 0xd9]); // EOI
  return out.result();
}
