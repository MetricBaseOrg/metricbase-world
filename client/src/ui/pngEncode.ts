// Self-contained PNG export for the /tools image tools.
//
//  • "rgba" — the browser's native truecolour+alpha PNG (canvas.toBlob).
//  • "png8" — an INDEXED PNG (colour type 3) with per-palette alpha (tRNS),
//    the encoding the hidden-image trick relies on for X. Built here from
//    scratch: median-cut quantisation to <=256 colours, then chunk assembly
//    with the IDAT deflated by the platform CompressionStream (zlib output).
//
// No external dependencies (the Artifact/app CSP blocks CDNs anyway).

export type OutFormat = "rgba" | "png8";

export function png8Supported(): boolean {
  return typeof CompressionStream !== "undefined";
}

export async function encodeCanvas(canvas: HTMLCanvasElement, format: OutFormat): Promise<Blob> {
  if (format === "rgba" || !png8Supported()) {
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
    );
  }
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const bytes = await encodePng8(data, width, height);
  return new Blob([bytes], { type: "image/png" });
}

// ---- Median-cut quantisation (RGBA) --------------------------------------
// Partition every pixel into <=256 boxes; each box becomes one palette entry
// and every pixel in it takes that index — so there's no nearest-neighbour
// search afterwards.
function quantize(data: Uint8ClampedArray, n: number) {
  const px = data.length / 4;
  const idx = new Int32Array(px);
  for (let i = 0; i < px; i++) idx[i] = i;

  interface Box { s: number; e: number; }
  const boxes: Box[] = [{ s: 0, e: px }];

  const rangeChan = (b: Box) => {
    let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0, amin = 255, amax = 0;
    for (let i = b.s; i < b.e; i++) {
      const p = idx[i] * 4;
      const r = data[p], g = data[p + 1], bl = data[p + 2], a = data[p + 3];
      if (r < rmin) rmin = r; if (r > rmax) rmax = r;
      if (g < gmin) gmin = g; if (g > gmax) gmax = g;
      if (bl < bmin) bmin = bl; if (bl > bmax) bmax = bl;
      if (a < amin) amin = a; if (a > amax) amax = a;
    }
    // Weight alpha a touch higher — the hidden-image effect lives in alpha.
    const dr = rmax - rmin, dg = gmax - gmin, db = bmax - bmin, da = (amax - amin) * 1.3;
    const m = Math.max(dr, dg, db, da);
    const chan = m === da ? 3 : m === dg ? 1 : m === dr ? 0 : 2;
    return { chan, spread: m };
  };

  while (boxes.length < n) {
    // Split the box with the greatest colour spread.
    let bi = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.e - b.s < 2) continue;
      const { spread } = rangeChan(b);
      const score = spread * (b.e - b.s);
      if (score > best) { best = score; bi = i; }
    }
    if (bi < 0) break;
    const b = boxes[bi];
    const { chan } = rangeChan(b);
    const slice = Array.from(idx.subarray(b.s, b.e)).sort(
      (p, q) => data[p * 4 + chan] - data[q * 4 + chan],
    );
    idx.set(slice, b.s);
    const mid = b.s + (slice.length >> 1);
    boxes[bi] = { s: b.s, e: mid };
    boxes.push({ s: mid, e: b.e });
  }

  const palette: number[][] = [];        // [r,g,b,a] per entry
  const indexOf = new Uint8Array(px);
  boxes.forEach((b, bi) => {
    let r = 0, g = 0, bl = 0, a = 0;
    for (let i = b.s; i < b.e; i++) {
      const p = idx[i] * 4;
      r += data[p]; g += data[p + 1]; bl += data[p + 2]; a += data[p + 3];
      indexOf[idx[i]] = bi;
    }
    const c = Math.max(1, b.e - b.s);
    palette.push([Math.round(r / c), Math.round(g / c), Math.round(bl / c), Math.round(a / c)]);
  });
  return { palette, indexOf };
}

// ---- PNG chunk assembly ---------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cs = new CompressionStream("deflate"); // zlib-wrapped, exactly what IDAT wants
  const writer = cs.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let len = 0; for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function encodePng8(data: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array<ArrayBuffer>> {
  const { palette, indexOf } = quantize(data, 256);

  // Raw scanlines: filter byte (0 = none) + one index byte per pixel.
  const raw = new Uint8Array(h * (w + 1));
  for (let y = 0; y < h; y++) {
    const row = y * (w + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) raw[row + 1 + x] = indexOf[y * w + x];
  }
  const idat = await deflate(raw);

  const parts: Uint8Array[] = [];
  parts.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  const chunk = (type: string, body: Uint8Array) => {
    const t = new Uint8Array(4);
    for (let i = 0; i < 4; i++) t[i] = type.charCodeAt(i);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, body.length);
    const crcIn = new Uint8Array(t.length + body.length);
    crcIn.set(t, 0); crcIn.set(body, t.length);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(crcIn));
    parts.push(len, t, body, crc);
  };

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 3;   // colour type: indexed
  chunk("IHDR", ihdr);

  const plte = new Uint8Array(palette.length * 3);
  const trns = new Uint8Array(palette.length);
  palette.forEach((c, i) => {
    plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2];
    trns[i] = c[3];
  });
  chunk("PLTE", plte);
  chunk("tRNS", trns);
  chunk("IDAT", idat);
  chunk("IEND", new Uint8Array(0));

  let total = 0; for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
