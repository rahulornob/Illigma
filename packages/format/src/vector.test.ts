/**
 * Vector networks and shape fields: validation, file round trip, SVG path
 * data in and out, and fuzzing of the path reader.
 */

import { describe, expect, it } from "vitest";
import { FormatError, readPackage, writePackage } from "./package.js";
import { sampleFile } from "./sample.fixture.js";
import { defaultNode, VECTOR_LIMITS, type Node, type VectorNetwork } from "./schema.js";
import { validateFile, validateNode, validateNodeField } from "./validate.js";
import {
  arcToCubics,
  PATH_CLOSE,
  PATH_CUBIC,
  PATH_LINE,
  PATH_MOVE,
  svgPathFromVectorNetwork,
  vectorNetworkFromSvgPath,
  vectorNetworkPaths,
  vectorNetworkProblem,
  vectorStrokeChains,
  walkVectorLoop,
} from "./vector.js";

const Z = { x: 0, y: 0 };
const line = (start: number, end: number) => ({ start, end, tangentStart: Z, tangentEnd: Z });

/** A 100 × 100 square with a 50 × 50 square hole, even-odd. */
const SQUARE_WITH_HOLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 75, y: 75 }, { x: 25, y: 75, cornerRadius: 4 },
  ],
  segments: [line(0, 1), line(1, 2), line(2, 3), line(3, 0), line(4, 5), line(5, 6), line(6, 7), line(7, 4)],
  regions: [{ windingRule: "EVENODD", loops: [[0, 1, 2, 3], [4, 5, 6, 7]] }],
};

/** One curved, open path: a quarter circle. */
const CURVE: VectorNetwork = {
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
  segments: [{ start: 0, end: 1, tangentStart: { x: 55.23, y: 0 }, tangentEnd: { x: 0, y: -55.23 } }],
  regions: [],
};

const SHAPES: Partial<Node>[] = [
  { vectorNetwork: SQUARE_WITH_HOLE, strokeCap: "ROUND", strokeJoin: "BEVEL" },
  { pointCount: 5, innerRadius: 0.5 },
  { pointCount: 6 },
];

function shapeFile() {
  const file = sampleFile();
  const nodes = file.nodes as Node[];
  nodes.push(
    { ...defaultNode("VECTOR", "vec1", "frame1", "a1"), ...SHAPES[0] },
    { ...defaultNode("STAR", "star1", "frame1", "a2"), ...SHAPES[1] },
    { ...defaultNode("POLYGON", "poly1", "frame1", "a3"), ...SHAPES[2] },
  );
  return file;
}

/** Every point (vertex) of a network, rounded, for comparing two networks' geometry. */
const points = (net: VectorNetwork) => net.vertices.map((v) => [Math.round(v.x * 1e4) / 1e4, Math.round(v.y * 1e4) / 1e4]);

describe("shape fields in the file", () => {
  it("round-trip with nothing lost", () => {
    const file = shapeFile();
    expect(validateFile(file)).toEqual([]);
    const back = readPackage(writePackage(file));
    expect(back.nodes.find((n) => n.id === "vec1")).toMatchObject(SHAPES[0] as object);
    expect(back.nodes.find((n) => n.id === "star1")).toMatchObject(SHAPES[1] as object);
    expect(back.nodes.find((n) => n.id === "poly1")).toMatchObject(SHAPES[2] as object);
    expect([...writePackage(back).entries()]).toEqual([...writePackage(file).entries()]);
  });

  it("are optional: new nodes don't have them, so files without them save as before", () => {
    for (const type of ["VECTOR", "STAR", "POLYGON", "LINE"] as const) {
      const n = defaultNode(type, "n", "p", "a0");
      for (const key of ["vectorNetwork", "pointCount", "innerRadius", "strokeCap", "strokeJoin"]) expect(n).not.toHaveProperty(key);
    }
    // The pinned bytes of the sample file are checked in layout-fields.test.ts.
    expect(writePackage(sampleFile()).get("pages/page1.json")).not.toMatch(/vectorNetwork|pointCount|innerRadius|strokeCap|strokeJoin/);
  });

  it("accept valid values and undefined", () => {
    for (const shape of SHAPES) for (const [k, v] of Object.entries(shape)) expect(validateNodeField(k, v), k).toBeNull();
    for (const k of ["vectorNetwork", "pointCount", "innerRadius", "strokeCap", "strokeJoin"]) expect(validateNodeField(k, undefined)).toBeNull();
    expect(validateNodeField("vectorNetwork", CURVE)).toBeNull();
    expect(validateNodeField("vectorNetwork", { vertices: [], segments: [], regions: [] })).toBeNull();
    for (const v of [3, 60, 1000]) expect(validateNodeField("pointCount", v)).toBeNull();
    for (const v of [0, 0.382, 1]) expect(validateNodeField("innerRadius", v)).toBeNull();
    for (const v of ["NONE", "ROUND", "SQUARE"]) expect(validateNodeField("strokeCap", v)).toBeNull();
    for (const v of ["MITER", "BEVEL", "ROUND"]) expect(validateNodeField("strokeJoin", v)).toBeNull();
  });

  it("refuse bad scalar values", () => {
    const bad: [string, unknown][] = [
      ["pointCount", 2], ["pointCount", 5.5], ["pointCount", 1001], ["pointCount", "5"], ["pointCount", NaN],
      ["innerRadius", -0.1], ["innerRadius", 1.5], ["innerRadius", Infinity], ["innerRadius", null],
      ["strokeCap", "BUTT"], ["strokeCap", "round"], ["strokeJoin", "SHARP"], ["strokeJoin", 1],
    ];
    for (const [key, value] of bad) {
      expect(validateNodeField(key, value), `${key} = ${String(value)}`).toMatch(new RegExp(`^"${key}"`));
      expect(validateNode({ ...defaultNode("STAR", "s", "p", "a0"), [key]: value }).length).toBe(1);
    }
  });

  it("refuse malformed vector networks, in plain language", () => {
    const net = (patch: Partial<Record<keyof VectorNetwork, unknown>>) => ({ ...SQUARE_WITH_HOLE, ...patch });
    const cases: [unknown, RegExp][] = [
      [null, /must be \{ vertices, segments, regions \}/],
      [[], /must be \{ vertices, segments, regions \}/],
      [{ vertices: [], segments: [] }, /must be \{ vertices/],
      [{ ...SQUARE_WITH_HOLE, extra: 1 }, /must be \{ vertices/],
      [JSON.parse('{"vertices":[],"segments":[],"regions":[],"__proto__":{}}'), /must be \{ vertices/],
      [net({ vertices: {} }), /lists of vertices/],
      [net({ vertices: [{ x: 0, y: NaN }] }), /vertex 0 must be/],
      [net({ vertices: [{ x: 0 }] }), /vertex 0 must be/],
      [net({ vertices: [{ x: 0, y: 0, z: 1 }] }), /vertex 0 must be/],
      [net({ vertices: [{ x: 0, y: 0, cornerRadius: -1 }] }), /vertex 0 has a corner radius/],
      [net({ vertices: [undefined] }), /vertex 0 must be/],
      [net({ segments: [line(0, 8)] }), /segment 0 must join two of the 8 vertices/],
      [net({ segments: [line(0, 1.5)] }), /segment 0 must join/],
      [net({ segments: [line(-1, 1)] }), /segment 0 must join/],
      [net({ segments: [{ start: 0, end: 1, tangentStart: Z }] }), /segment 0 must be \{ start, end/],
      [net({ segments: [{ start: 0, end: 1, tangentStart: Z, tangentEnd: { x: 1, y: Infinity } }] }), /segment 0 must have tangents/],
      [net({ segments: [{ start: 0, end: 1, tangentStart: Z, tangentEnd: { x: 1, y: 1, z: 0 } }] }), /segment 0 must have tangents/],
      [net({ regions: [{ windingRule: "ODD", loops: [[0, 1, 2, 3]] }] }), /winding rule of "NONZERO" or "EVENODD"/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [] }] }), /region 0 has no loops/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[]] }] }), /region 0 loop 0 must be a list/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[0, 1, 99]] }] }), /must list segments by index, from 0 to 7/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[0, 1, 2]] }] }), /loop 0 isn't closed/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[0, 4, 1, 2]] }] }), /loop 0 isn't closed/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[0]] }] }), /loop 0 isn't closed/],
      [net({ regions: [{ windingRule: "EVENODD", loops: [[0, 1, 2, 3]], fills: [] }] }), /region 0 must be/],
    ];
    for (const [value, message] of cases) {
      const problem = validateNodeField("vectorNetwork", value);
      expect(problem, JSON.stringify(value)?.slice(0, 120)).toMatch(/^"vectorNetwork" /);
      expect(problem).toMatch(message);
    }
  });

  it("refuse networks over the size limits", () => {
    const many = Array.from({ length: VECTOR_LIMITS.maxVertices + 1 }, () => ({ x: 0, y: 0 }));
    expect(vectorNetworkProblem({ vertices: many, segments: [], regions: [] })).toMatch(/100,001 vertices; the most a vector can hold is 100,000/);
    const segs = Array.from({ length: VECTOR_LIMITS.maxSegments + 1 }, () => line(0, 0));
    expect(vectorNetworkProblem({ vertices: [{ x: 0, y: 0 }], segments: segs, regions: [] })).toMatch(/segments; the most/);
    // A self-loop at one vertex is a valid one-segment loop; 200,001 references to it is too many.
    const loops = Array.from({ length: 3 }, () => Array.from({ length: 70_000 }, () => 0));
    expect(vectorNetworkProblem({ vertices: [{ x: 0, y: 0 }], segments: [line(0, 0)], regions: [{ windingRule: "NONZERO", loops }] })).toMatch(/more than 200,000 segments in its region loops/);
  });

  it("accepts branching networks and one-segment closed curves", () => {
    const branch: VectorNetwork = {
      vertices: [{ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      segments: [line(0, 1), line(0, 2), line(0, 3)],
      regions: [],
    };
    expect(vectorNetworkProblem(branch)).toBeNull();
    const drop: VectorNetwork = {
      vertices: [{ x: 50, y: 0 }],
      segments: [{ start: 0, end: 0, tangentStart: { x: 80, y: 120 }, tangentEnd: { x: -80, y: 120 } }],
      regions: [{ windingRule: "NONZERO", loops: [[0]] }],
    };
    expect(vectorNetworkProblem(drop)).toBeNull();
    // Loops may list their segments against their direction.
    expect(vectorNetworkProblem({ ...SQUARE_WITH_HOLE, regions: [{ windingRule: "NONZERO", loops: [[3, 2, 1, 0]] }] })).toBeNull();
  });

  it("damaged networks in a saved file are refused on open", () => {
    const tree = writePackage(shapeFile());
    tree.set("pages/page1.json", (tree.get("pages/page1.json") as string).replace('"end":1,', '"end":42,'));
    expect(() => readPackage(tree)).toThrow(/vectorNetwork.*segment 0 must join/);
  });
});

describe("walking a network", () => {
  it("walks loops in either direction", () => {
    expect(walkVectorLoop(SQUARE_WITH_HOLE, [0, 1, 2, 3])).toEqual({ start: 0, steps: [0, 2, 4, 6] });
    expect(walkVectorLoop(SQUARE_WITH_HOLE, [3, 2, 1, 0])).toEqual({ start: 0, steps: [7, 5, 3, 1] });
    expect(walkVectorLoop(SQUARE_WITH_HOLE, [0, 1, 2])).toBeNull();
  });

  it("splits strokes into chains that join through two-segment vertices", () => {
    const closed = vectorStrokeChains(SQUARE_WITH_HOLE);
    expect(closed.map((c) => [c.steps.length, c.closed])).toEqual([[4, true], [4, true]]);
    const branch: VectorNetwork = {
      vertices: [{ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }, { x: 50, y: 150 }],
      segments: [line(0, 1), line(0, 2), line(0, 3), line(3, 4)],
      regions: [],
    };
    const chains = vectorStrokeChains(branch);
    // Three arms from the branch point; the third runs through vertex 3 without a break.
    expect(chains.map((c) => c.steps.map((s) => s >> 1))).toEqual([[0], [1], [2, 3]]);
    expect(chains.every((c) => !c.closed)).toBe(true);
    const all = chains.flatMap((c) => c.steps.map((s) => s >> 1)).sort();
    expect(all).toEqual([0, 1, 2, 3]);
  });

  it("gives path commands for regions and strokes", () => {
    const { regions, stroke } = vectorNetworkPaths(SQUARE_WITH_HOLE);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.windingRule).toBe("EVENODD");
    expect(regions[0]?.commands.slice(0, 6)).toEqual([PATH_MOVE, 0, 0, PATH_LINE, 100, 0]);
    expect(regions[0]?.commands.filter((c) => c === PATH_CLOSE)).toHaveLength(2);
    expect(vectorNetworkPaths(CURVE).stroke).toEqual([PATH_MOVE, 0, 0, PATH_CUBIC, 55.23, 0, 100, 44.77, 100, 100]);
    expect(stroke.length).toBeGreaterThan(0);
  });
});

describe("SVG path data", () => {
  it("reads absolute and relative commands to the same network", () => {
    const abs = "M10 20 L30 20 H50 V40 C50 60 30 60 30 40 S10 20 10 40 Q20 60 30 50 T50 50 A10 10 0 0 1 70 50 Z";
    const rel = "m10 20 l20 0 h20 v20 c0 20 -20 20 -20 0 s-20 -20 -20 0 q10 20 20 10 t20 0 a10 10 0 0 1 20 0 z";
    const a = vectorNetworkFromSvgPath(abs);
    const b = vectorNetworkFromSvgPath(rel);
    expect(points(b)).toEqual(points(a));
    expect(b.segments.map((s) => [s.start, s.end])).toEqual(a.segments.map((s) => [s.start, s.end]));
    for (let i = 0; i < a.segments.length; i++) {
      const sa = a.segments[i]!, sb = b.segments[i]!;
      for (const k of ["tangentStart", "tangentEnd"] as const) {
        expect(sb[k].x).toBeCloseTo(sa[k].x, 9);
        expect(sb[k].y).toBeCloseTo(sa[k].y, 9);
      }
    }
    expect(a.regions).toEqual([{ windingRule: "NONZERO", loops: [a.segments.map((_, i) => i)] }]);
    expect(vectorNetworkProblem(a)).toBeNull();
  });

  it("reflects control points for S and T, and raises quadratics to cubics", () => {
    const n = vectorNetworkFromSvgPath("M0 0 C10 0 20 10 20 20 S30 40 40 40");
    // S's first handle mirrors C's second (20,10) about (20,20): (20,30).
    expect(n.segments[1]?.tangentStart).toEqual({ x: 0, y: 10 });
    const q = vectorNetworkFromSvgPath("M0 0 Q30 0 30 30 T60 60");
    // Quadratic control (30,0) → cubic handles at 2/3 of the way: (20,0) and (30,10).
    expect(q.segments[0]?.tangentStart).toEqual({ x: 20, y: 0 });
    expect(q.segments[0]?.tangentEnd).toEqual({ x: 0, y: -20 });
    // T mirrors (30,0) about (30,30): control (30,60).
    expect(q.segments[1]?.tangentStart).toEqual({ x: 0, y: 20 });
    // S and T after something else use the current point as the first control.
    expect(vectorNetworkFromSvgPath("M0 0 L10 0 S20 10 20 20").segments[1]?.tangentStart).toEqual({ x: 0, y: 0 });
  });

  it("splits arcs into cubics that stay on the ellipse", () => {
    // The prototype's sample: a near-full ellipse with an even-odd hole.
    const d = "M 214.5 0 A 214.5 117.5 0 1 1 214.499 0 Z M 214.5 39 A 175.5 78.5 0 1 0 214.501 39 Z";
    const n = vectorNetworkFromSvgPath(d, { windingRule: "EVENODD" });
    expect(n.regions).toEqual([{ windingRule: "EVENODD", loops: [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]] }]);
    expect(vectorNetworkProblem(n)).toBeNull();
    // Points along each outer cubic lie on the outer ellipse (centre 214.5,117.5).
    const cmds = vectorNetworkPaths(n).regions[0]!.commands;
    let px = 0, py = 0, checked = 0;
    for (let i = 0; i < cmds.length; ) {
      const verb = cmds[i++];
      if (verb === PATH_MOVE || verb === PATH_LINE) {
        px = cmds[i++]!;
        py = cmds[i++]!;
      } else if (verb === PATH_CUBIC) {
        const [x1, y1, x2, y2, x, y] = cmds.slice(i, i + 6) as number[];
        i += 6;
        if (checked < 4) {
          for (const t of [0.25, 0.5, 0.75]) {
            const u = 1 - t;
            const bx = u * u * u * px + 3 * u * u * t * x1! + 3 * u * t * t * x2! + t * t * t * x!;
            const by = u * u * u * py + 3 * u * u * t * y1! + 3 * u * t * t * y2! + t * t * t * y!;
            const e = ((bx - 214.5) / 214.5) ** 2 + ((by - 117.5) / 117.5) ** 2;
            expect(Math.abs(e - 1)).toBeLessThan(0.002);
          }
        }
        checked++;
        px = x!;
        py = y!;
      }
    }
    expect(checked).toBe(8); // 4 quarter arcs per ellipse
  });

  it("handles arc edge cases: zero radius, same endpoints, small radii, rotation", () => {
    expect(arcToCubics(0, 0, 0, 10, 0, false, true, 10, 10)).toEqual([[10, 10]]);
    expect(arcToCubics(5, 5, 10, 10, 0, false, true, 5, 5)).toEqual([]);
    // Radii too small are scaled up: a half circle of radius 5 from (0,0) to (10,0).
    const half = arcToCubics(0, 0, 1, 1, 0, false, true, 10, 0);
    expect(half).toHaveLength(2);
    expect(half[0]![4]).toBeCloseTo(5, 9);
    expect(Math.abs(half[0]![5]!)).toBeCloseTo(5, 9);
    // A rotated arc still ends exactly at its endpoint.
    const rot = arcToCubics(0, 0, 30, 10, 45, true, false, 20, 20);
    expect(rot.at(-1)!.slice(4)).toEqual([20, 20]);
  });

  it("reads compact syntax: implicit commands, packed flags and numbers, exponents", () => {
    expect(svgPathFromVectorNetwork(vectorNetworkFromSvgPath("M0,0 10,10 20,0"))).toBe("M0 0 L10 10 L20 0");
    expect(svgPathFromVectorNetwork(vectorNetworkFromSvgPath("m1 1 2 2"))).toBe("M1 1 L3 3");
    expect(svgPathFromVectorNetwork(vectorNetworkFromSvgPath("M-.5.5.5-.5"))).toBe("M-0.5 0.5 L0.5 -0.5");
    expect(svgPathFromVectorNetwork(vectorNetworkFromSvgPath("M1e1 2E-1L+3e+1,0"))).toBe("M10 0.2 L30 0");
    expect(vectorNetworkFromSvgPath("M0 0a5 5 0 0110 0").segments).toHaveLength(2);
    expect(vectorNetworkFromSvgPath("  \n\tM 0 0 \r\n L 1 1  ").segments).toHaveLength(1);
    expect(vectorNetworkFromSvgPath("").vertices).toEqual([]);
  });

  it("closes subpaths: joins a final point that is the start, adds a closing edge otherwise", () => {
    const joined = vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 L0 0 Z");
    expect(joined.vertices).toHaveLength(3);
    expect(joined.regions[0]?.loops).toEqual([[0, 1, 2]]);
    const added = vectorNetworkFromSvgPath("M0 0 L10 0 L10 10 Z");
    expect(added.vertices).toHaveLength(3);
    expect(added.segments).toHaveLength(3);
    // A drawing command after Z starts a new subpath at the closed one's start.
    const after = vectorNetworkFromSvgPath("M5 5 L10 5 L10 10 Z l5 0");
    expect(after.vertices.at(-1)).toEqual({ x: 10, y: 5 });
    // Lone moves and empty closes leave nothing behind.
    expect(vectorNetworkFromSvgPath("M0 0 M5 5 Z M1 1").vertices).toEqual([]);
    // Open subpaths have no region.
    expect(vectorNetworkFromSvgPath("M0 0 L10 10").regions).toEqual([]);
  });

  it("round-trips through SVG path data", () => {
    for (const d of [
      "M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z",
      "M0 0 C10 20 30 40 50 60 L70 0",
      "M 214.5 0 A 214.5 117.5 0 1 1 214.499 0 Z",
    ]) {
      const a = vectorNetworkFromSvgPath(d);
      const b = vectorNetworkFromSvgPath(svgPathFromVectorNetwork(a));
      expect(points(b)).toEqual(points(a));
      expect(b.segments.length).toBe(a.segments.length);
      expect(svgPathFromVectorNetwork(b)).toBe(svgPathFromVectorNetwork(a));
    }
    expect(svgPathFromVectorNetwork(SQUARE_WITH_HOLE)).toBe("M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z");
    expect(svgPathFromVectorNetwork(CURVE)).toBe("M0 0 C55.23 0 100 44.77 100 100");
  });

  it("refuses unreadable data with a FormatError that says where", () => {
    const bad: [unknown, RegExp][] = [
      ["L0 0", /character 1: path data must start with a move/],
      ["10 10", /character 1: path data must start with a move/],
      ["M0 0 L 1", /character 9: expected a number/],
      ["M0 0 Z 1", /expected a command letter/],
      ["M0 0 X1", /"X" is not a path command/],
      ["M1e400 0", /too large/],
      ["M0 0 A1 1 0 2 0 5 5", /arc flag/],
      ["M0 0 L1e308 0 l1e308 0", /too large/],
      ["M 1e 2", /expected a number/],
      [42, /must be text/],
      [null, /must be text/],
    ];
    for (const [d, message] of bad) {
      expect(() => vectorNetworkFromSvgPath(d as string), String(d)).toThrow(FormatError);
      expect(() => vectorNetworkFromSvgPath(d as string)).toThrow(message);
    }
    expect(() => vectorNetworkFromSvgPath("M0 0", { windingRule: "ODD" as never })).toThrow(FormatError);
    expect(() => svgPathFromVectorNetwork({ vertices: [], segments: [line(0, 1)], regions: [] })).toThrow(FormatError);
    expect(() => svgPathFromVectorNetwork(null as never)).toThrow(FormatError);
  });

  it("refuses paths over the size limits", () => {
    const d = "M0 0" + " l1 1".repeat(VECTOR_LIMITS.maxVertices);
    expect(() => vectorNetworkFromSvgPath(d)).toThrow(/more than 100,000 points/);
    expect(() => vectorNetworkFromSvgPath("M0 0" + " ".repeat(10_000_001))).toThrow(/longer than/);
  });

  it("never throws anything but a FormatError on random input (fuzz)", () => {
    let seed = 0x5eed;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    const atoms = ["M", "m", "L", "l", "H", "h", "V", "v", "C", "c", "S", "s", "Q", "q", "T", "t", "A", "a", "Z", "z", " ", ",", "-", ".", "e", "+", "0", "1", "5", "9", "1e308", "NaN", " ", "😀", "x"];
    const valid = "M10 20 L30 20 H50 V40 C50 60 30 60 30 40 S10 20 10 40 Q20 60 30 50 T50 50 A10 10 0 0 1 70 50 Z";
    for (let k = 0; k < 3000; k++) {
      let d: string;
      if (k % 2) d = Array.from({ length: Math.floor(rand() * 40) }, () => pick(atoms)).join("");
      else {
        const at = Math.floor(rand() * valid.length);
        d = valid.slice(0, at) + pick(atoms) + valid.slice(at + Math.floor(rand() * 3));
      }
      try {
        const net = vectorNetworkFromSvgPath(d, { windingRule: k % 3 ? "NONZERO" : "EVENODD" });
        expect(vectorNetworkProblem(net), d).toBeNull();
        svgPathFromVectorNetwork(net);
      } catch (e) {
        if (!(e instanceof FormatError)) throw new Error(`case ${k} ${JSON.stringify(d)} threw ${String(e)}`);
      }
    }
  });
});
