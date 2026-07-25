import { useCallback, useEffect, useRef, useState } from "react";
import { encodeCanvas, png8Supported, type OutFormat } from "./pngEncode";

/**
 * Background Remover at /tools — cut out a background entirely client-side.
 *
 * Two ways to select, combined:
 *   • Pick a colour: click the background; every nearby colour is knocked out
 *     (globally, or just the connected region under the click).
 *   • Brush: erase or restore by hand to clean up edges the colour pick misses.
 *
 * There's no ML model (the CSP blocks one anyway) — it's colour-key + scribble,
 * which is fast, private, and good enough for flat / evenly-lit backgrounds.
 */

type Src = HTMLImageElement | HTMLCanvasElement;
const WORK_MAX = 1000;

export function BackgroundRemover() {
  const [tool, setTool] = useState<"key" | "erase" | "restore">("key");
  const [tolerance, setTolerance] = useState(28);
  const [contiguous, setContiguous] = useState(true);
  const [brushSize, setBrushSize] = useState(46);
  const [format, setFormat] = useState<OutFormat>("rgba");
  const [hasImg, setHasImg] = useState(false);
  const [status, setStatus] = useState("");

  const baseRef = useRef<Uint8ClampedArray | null>(null); // original RGBA at work size
  const alphaRef = useRef<Uint8Array | null>(null);       // current cut-out alpha
  const dims = useRef({ w: 0, h: 0 });
  const cvRef = useRef<HTMLCanvasElement | null>(null);   // visible result / surface
  const painting = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const render = useCallback(() => {
    const cv = cvRef.current, base = baseRef.current, alpha = alphaRef.current;
    if (!cv || !base || !alpha) return;
    const { w, h } = dims.current;
    const cx = cv.getContext("2d")!;
    const img = cx.createImageData(w, h);
    const o = img.data;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      o[i] = base[i]; o[i + 1] = base[i + 1]; o[i + 2] = base[i + 2]; o[i + 3] = alpha[p];
    }
    cx.putImageData(img, 0, 0);
  }, []);

  const setupImage = useCallback((im: Src) => {
    const iw = (im as HTMLImageElement).naturalWidth || im.width;
    const ih = (im as HTMLImageElement).naturalHeight || im.height;
    const s = Math.min(1, WORK_MAX / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
    dims.current = { w, h };
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
    const tx = tmp.getContext("2d", { willReadFrequently: true })!;
    tx.drawImage(im, 0, 0, w, h);
    baseRef.current = tx.getImageData(0, 0, w, h).data;
    alphaRef.current = new Uint8Array(w * h).fill(255);
    if (cvRef.current) { cvRef.current.width = w; cvRef.current.height = h; }
    setHasImg(true);
    render();
  }, [render]);

  const loadFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const im = new Image();
    im.onload = () => setupImage(im);
    im.src = URL.createObjectURL(file);
  };

  // Seed a demo so the tool isn't empty.
  useEffect(() => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 600;
    const x = c.getContext("2d")!;
    x.fillStyle = "#4aa3df"; x.fillRect(0, 0, 600, 600);            // flat blue "background"
    x.fillStyle = "#ffcf5c"; x.beginPath(); x.arc(300, 320, 150, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#2a2f3a"; x.font = "600 44px system-ui"; x.textAlign = "center";
    x.fillText("pick the blue →", 300, 110);
    setupImage(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toXY = (clientX: number, clientY: number) => {
    const cv = cvRef.current!;
    const rect = cv.getBoundingClientRect();
    const { w, h } = dims.current;
    return {
      x: Math.floor(((clientX - rect.left) / rect.width) * w),
      y: Math.floor(((clientY - rect.top) / rect.height) * h),
    };
  };

  // Colour-key removal from a seed pixel: global (all matching) or contiguous.
  const keyAt = (sx: number, sy: number) => {
    const base = baseRef.current, alpha = alphaRef.current;
    if (!base || !alpha) return;
    const { w, h } = dims.current;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    const si = (sy * w + sx) * 4;
    const sr = base[si], sg = base[si + 1], sb = base[si + 2];
    const thr = (tolerance / 100) * 200;
    const thr2 = thr * thr;
    const near = (p: number) => {
      const i = p * 4;
      const dr = base[i] - sr, dg = base[i + 1] - sg, db = base[i + 2] - sb;
      return dr * dr + dg * dg + db * db <= thr2;
    };
    if (contiguous) {
      const stack = [sy * w + sx];
      const seen = new Uint8Array(w * h);
      while (stack.length) {
        const p = stack.pop()!;
        if (seen[p]) continue; seen[p] = 1;
        if (!near(p)) continue;
        alpha[p] = 0;
        const x = p % w, y = (p / w) | 0;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
    } else {
      for (let p = 0; p < w * h; p++) if (near(p)) alpha[p] = 0;
    }
    render();
  };

  const strokeAt = (clientX: number, clientY: number) => {
    const alpha = alphaRef.current;
    if (!alpha) return;
    const { w, h } = dims.current;
    const { x, y } = toXY(clientX, clientY);
    const val = tool === "restore" ? 255 : 0;
    const r = brushSize / 2;
    const last = lastPt.current ?? { x, y };
    // Stamp discs along the segment from the last point for a continuous stroke.
    const steps = Math.max(1, Math.round(Math.hypot(x - last.x, y - last.y) / (r / 2)));
    for (let s = 0; s <= steps; s++) {
      const cx = last.x + ((x - last.x) * s) / steps;
      const cy = last.y + ((y - last.y) * s) / steps;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy <= r * r) alpha[yy * w + xx] = val;
      }
    }
    lastPt.current = { x, y };
    render();
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    painting.current = true; lastPt.current = null;
    if (tool === "key") { const { x, y } = toXY(e.clientX, e.clientY); keyAt(x, y); }
    else strokeAt(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current || tool === "key") return;
    strokeAt(e.clientX, e.clientY);
  };
  const onUp = () => { painting.current = false; lastPt.current = null; };

  const reset = () => {
    if (!alphaRef.current) return;
    alphaRef.current.fill(255);
    render();
  };

  const download = async () => {
    const cv = cvRef.current;
    if (!cv) return;
    setStatus("Saving…");
    try {
      const blob = await encodeCanvas(cv, format);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "MetricBase.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus(`Saved MetricBase.png (${format === "png8" ? "PNG-8" : "RGBA"}) ✓`);
      setTimeout(() => setStatus(""), 3500);
    } catch {
      setStatus("Couldn't save — try again.");
    }
  };

  return (
    <div className="grid">
      <section className="chibi-panel panel-pad" aria-label="Background controls">
        <div className="eyebrow">Step 1 · Your image</div>
        <h2>Upload &amp; select</h2>
        <label className="drop" style={{ marginBottom: 14 }}>
          <input type="file" accept="image/*" aria-label="Image"
            onChange={(e) => loadFile(e.target.files?.[0])} />
          <span className="thumb" aria-hidden="true">🖼️</span>
          <span className="lbl"><b>{hasImg ? "Change image" : "Upload an image"}</b><span>Tap to choose a photo</span></span>
        </label>

        <div className="controls" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
          <div className="eyebrow">Step 2 · Remove &amp; refine</div>

          <div className="field size0">
            <label className="lbl-block">Tool</label>
            <div className="seg seg-wide" role="group" aria-label="Tool">
              <button type="button" aria-pressed={tool === "key"} onClick={() => setTool("key")}>🎯 Pick colour</button>
              <button type="button" aria-pressed={tool === "erase"} onClick={() => setTool("erase")}>🩹 Erase</button>
              <button type="button" aria-pressed={tool === "restore"} onClick={() => setTool("restore")}>↩︎ Restore</button>
            </div>
            <p className="hint">
              {tool === "key"
                ? "Click the background colour to knock it out. Adjust tolerance if it takes too much or too little."
                : tool === "erase"
                  ? "Paint over anything still left to remove it."
                  : "Paint to bring back parts that were removed by mistake."}
            </p>
          </div>

          {tool === "key" ? (
            <>
              <div className="field">
                <label htmlFor="bg-tol">Tolerance <span className="val mono">{tolerance}%</span></label>
                <input id="bg-tol" type="range" min={2} max={80} value={tolerance}
                  onChange={(e) => setTolerance(+e.target.value)} />
                <p className="hint">How close a colour must be to what you clicked to be removed.</p>
              </div>
              <div className="field size0">
                <label className="lbl-block">Reach</label>
                <div className="seg seg-wide" role="group" aria-label="Reach">
                  <button type="button" aria-pressed={contiguous} onClick={() => setContiguous(true)}>Connected area</button>
                  <button type="button" aria-pressed={!contiguous} onClick={() => setContiguous(false)}>Whole image</button>
                </div>
                <p className="hint">Connected only clears the region you click; whole image clears that colour everywhere.</p>
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="bg-brush">Brush size <span className="val mono">{brushSize}px</span></label>
              <input id="bg-brush" type="range" min={10} max={140} value={brushSize}
                onChange={(e) => setBrushSize(+e.target.value)} />
            </div>
          )}

          <div className="field size0">
            <label className="lbl-block">File format</label>
            <div className="seg seg-wide" role="group" aria-label="File format">
              <button type="button" aria-pressed={format === "rgba"} onClick={() => setFormat("rgba")}>RGBA</button>
              <button type="button" aria-pressed={format === "png8"} onClick={() => setFormat("png8")} disabled={!png8Supported()}>PNG-8</button>
            </div>
            <p className="hint">{format === "rgba" ? "Full-quality transparent PNG." : "Smaller indexed PNG-8 (up to 256 colours)."}</p>
          </div>
        </div>
      </section>

      <section aria-label="Preview">
        <div className="chibi-panel panel-pad">
          <div className="stage-head">
            <div>
              <div className="eyebrow">Step 3 · Cut it out</div>
              <h2 style={{ marginBottom: 0 }}>{tool === "key" ? "Click the background" : "Paint to refine"}</h2>
            </div>
            <button className="chibi-btn chibi-btn--ghost" type="button" style={{ padding: "8px 14px" }} onClick={reset}>Reset</button>
          </div>
          <div className="view checker" style={{ borderColor: "var(--chibi-outline)" }}>
            <div className="canvas-hold" style={{ padding: 12 }}>
              <canvas
                ref={cvRef}
                className="paint-canvas"
                style={{ cursor: tool === "key" ? "crosshair" : "cell" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                onPointerCancel={onUp}
              />
            </div>
          </div>
          <div className="actions">
            <button className="chibi-btn chibi-btn--primary" type="button" onClick={() => void download()}>↓ Download PNG</button>
            <span className="mono" style={{ fontSize: ".8rem", color: "var(--chibi-ink-soft)" }}>{status}</span>
          </div>
        </div>

        <div className="chibi-panel panel-pad howto" style={{ marginTop: 16 }}>
          <div className="eyebrow">Tips</div>
          <ol>
            <li><span>Start with <b>Pick colour</b> on a flat background, then nudge <b>Tolerance</b> until the edges look right.</span></li>
            <li><span>Switch to <b>Erase</b> to remove leftover bits, and <b>Restore</b> to paint back anything you lost.</span></li>
            <li><span>Even lighting and a plain background give the cleanest cut — busy backgrounds need more brushing.</span></li>
          </ol>
          <p className="note">Runs entirely on your device — the image is never uploaded.</p>
        </div>
      </section>
    </div>
  );
}
