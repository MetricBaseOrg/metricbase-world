import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundRemover } from "./BackgroundRemover";
import { encodeCanvas, png8Supported, type OutFormat } from "./pngEncode";
import "./tools.css";
import { usePageScroll } from "./usePageScroll";

/**
 * Hidden Image Maker at /tools — makes an X "hidden image": a transparent PNG
 * that looks ordinary in the timeline (composited over white) and reveals more
 * when tapped to enlarge (composited over black). Two modes:
 *   • Two pictures — a cover shows in the timeline, a secret shows when tapped.
 *   • Paint to hide — one photo; brushed areas hide until tapped, the rest stays
 *     visible. Both share the pixel math below.
 *
 * The trick is pure per-pixel alpha. For each pixel we solve for a colour v and
 * alpha a so the composite lands on the cover tone C over white and the secret
 * tone S over black (needs C >= S):
 *   over white: a*v + (1-a)*255 = C
 *   over black: a*v            = S
 *   => a = 1 - (C - S)/255 ,  v = S / a
 * One alpha per pixel, so the alpha is derived from luminances — but the
 * revealed pixel's COLOUR is preserved by scaling the secret's RGB to the
 * target tone (keepColor). Everything runs on-device.
 */

type Src = HTMLImageElement | HTMLCanvasElement;

const DISP_MAX = 360;
const WORK_MAX = 680; // internal resolution of the brush/paint surface

/** One-tap styles so nobody has to touch a slider to get a good result. */
const PRESETS = [
  { name: "Subtle", hide: 74, reveal: 44, contrast: 112, blurb: "Best hidden — almost invisible until tapped." },
  { name: "Balanced", hide: 62, reveal: 54, contrast: 118, blurb: "A clean flip — the everyday choice." },
  { name: "Bold", hide: 50, reveal: 72, contrast: 145, blurb: "Loudest reveal — the secret pops hard." },
] as const;

/** Draw an image/canvas cover-fit into a w×h context (center-crop). */
function drawCover(ctx: CanvasRenderingContext2D, img: Src, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** RGBA pixels for a source cover-fit into w×h (grey backdrop for any gaps). */
function rgbaOf(src: Src, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#808080"; x.fillRect(0, 0, w, h);
  drawCover(x, src, w, h);
  return x.getImageData(0, 0, w, h).data;
}

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

/**
 * The hidden-image pixel: given a cover luminance to show over white and a
 * secret pixel to show over black, return [r,g,b,alpha] (0..255). Keeps the
 * secret's hue when keepColor is set. Shared by both modes.
 */
function hiddenRGBA(
  coverLum: number, sr: number, sg: number, sb: number, secretLum: number,
  floor: number, ceil: number, k: number, keepColor: boolean,
): [number, number, number, number] {
  const C = floor + (coverLum / 255) * (255 - floor);
  const sl = clamp255((secretLum - 128) * k + 128);
  let S = (sl / 255) * ceil;
  if (S > C) S = C;
  let a = 1 - (C - S) / 255;
  if (a < 0.0039) a = 0.0039;
  if (a > 1) a = 1;
  if (keepColor && secretLum > 0.5) {
    const sc = (S / secretLum) / a;
    return [clamp255(sr * sc), clamp255(sg * sc), clamp255(sb * sc), a * 255];
  }
  const v = clamp255(S / a);
  return [v, v, v, a * 255];
}

/** A self-demonstrating default so the tool works before any upload. */
function demo(text: string, sub: string, fg: string, bg: string, emoji?: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 720;
  const x = c.getContext("2d")!;
  x.fillStyle = bg; x.fillRect(0, 0, 720, 720);
  x.textAlign = "center"; x.textBaseline = "middle";
  if (emoji) { x.font = "340px serif"; x.fillText(emoji, 360, 320); }
  x.fillStyle = fg;
  x.font = "700 130px 'Hiragino Mincho ProN', Georgia, serif";
  x.fillText(text, 360, emoji ? 560 : 330);
  if (sub) { x.font = "600 52px system-ui, sans-serif"; x.fillText(sub, 360, emoji ? 630 : 440); }
  return c;
}

export function ToolsPage() {
  const [hide, setHide] = useState(62);
  const [reveal, setReveal] = useState(54);
  const [contrast, setContrast] = useState(118);
  const [size, setSize] = useState(900);
  const [checker, setChecker] = useState(false);
  const [keepColor, setKeepColor] = useState(true);
  const [mode, setMode] = useState<"two" | "brush">("two");
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [brushSize, setBrushSize] = useState(46);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [activeTool, setActiveTool] = useState<"hidden" | "bg">("hidden");
  const [format, setFormat] = useState<OutFormat>("png8");
  const [coverName, setCoverName] = useState("Tap to upload");
  const [secretName, setSecretName] = useState("Tap to upload");
  const [dims, setDims] = useState("");
  const [status, setStatus] = useState("");
  const [rev, setRev] = useState(0); // bump to force a rebuild when images change

  const coverRef = useRef<Src | null>(null);
  const secretRef = useRef<Src | null>(null);
  const outRef = useRef<HTMLCanvasElement | null>(null);
  const cvLight = useRef<HTMLCanvasElement | null>(null);
  const cvDark = useRef<HTMLCanvasElement | null>(null);
  const thumbCover = useRef<HTMLSpanElement | null>(null);
  const thumbSecret = useRef<HTMLSpanElement | null>(null);

  // Brush mode: one photo + a paint mask (painted = hidden until tapped).
  const photoRef = useRef<Src | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);  // working-res mask (alpha)
  const editRef = useRef<HTMLCanvasElement | null>(null);  // visible paint surface
  const paintingRef = useRef(false);
  const workRef = useRef({ w: 0, h: 0 });

  // Seed the demo images once, and show them in the thumbnails so the starting
  // state is obvious (the tool works before any upload).
  useEffect(() => {
    const cov = demo("HELLO", "scroll on by", "#20242e", "#eef1f6");
    const sec = demo("BOO!", "you found me", "#ffe14d", "#c0267f", "👻");
    coverRef.current = cov;
    secretRef.current = sec;
    if (thumbCover.current) { thumbCover.current.style.backgroundImage = `url(${cov.toDataURL()})`; thumbCover.current.textContent = ""; }
    if (thumbSecret.current) { thumbSecret.current.style.backgroundImage = `url(${sec.toDataURL()})`; thumbSecret.current.textContent = ""; }
    setCoverName("Demo — tap to replace");
    setSecretName("Demo — tap to replace");
    setRev((r) => r + 1);
  }, []);

  usePageScroll();

  const paint = useCallback((W: number, H: number) => {
    const out = outRef.current;
    if (!out) return;
    const s = Math.min(1, DISP_MAX / Math.max(W, H));
    const dw = Math.round(W * s), dh = Math.round(H * s);
    for (const ref of [cvLight, cvDark]) {
      const cv = ref.current;
      if (!cv) continue;
      cv.width = dw; cv.height = dh;
      const cx = cv.getContext("2d")!;
      cx.clearRect(0, 0, dw, dh);
      cx.imageSmoothingQuality = "high";
      cx.drawImage(out, 0, 0, dw, dh);
    }
  }, []);

  // ---- Two-image build: cover shows over white, secret over black. ----
  const buildTwo = useCallback(() => {
    const cover = coverRef.current, secret = secretRef.current;
    if (!cover || !secret) return;

    const cw = (cover as HTMLImageElement).naturalWidth || cover.width;
    const ch = (cover as HTMLImageElement).naturalHeight || cover.height;
    const ratio = cw / ch;
    let W = size, H = Math.round(size / ratio);
    if (H > size) { H = size; W = Math.round(size * ratio); }

    const cd = rgbaOf(cover, W, H);
    const sd = rgbaOf(secret, W, H);
    const floor = (0.35 + 0.50 * (hide / 100)) * 255;
    const ceil = (0.28 + 0.55 * (reveal / 100)) * 255;
    const k = contrast / 100;

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(W, H);
    const o = img.data;
    for (let i = 0; i < o.length; i += 4) {
      const coverLum = 0.299 * cd[i] + 0.587 * cd[i + 1] + 0.114 * cd[i + 2];
      const sr = sd[i], sg = sd[i + 1], sb = sd[i + 2];
      const secretLum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
      const [r, g, b, al] = hiddenRGBA(coverLum, sr, sg, sb, secretLum, floor, ceil, k, keepColor);
      o[i] = Math.round(r); o[i + 1] = Math.round(g); o[i + 2] = Math.round(b); o[i + 3] = Math.round(al);
    }
    octx.putImageData(img, 0, 0);
    outRef.current = out;
    paint(W, H);
    setDims(`${W} × ${H} px`);
  }, [hide, reveal, contrast, size, keepColor, paint]);

  // ---- Brush build: one photo; PAINTED (masked) areas hide until tapped,
  // unpainted areas stay normally visible. Soft brush edges blend the two. ----
  const buildBrush = useCallback(() => {
    const photo = photoRef.current, mask = maskRef.current;
    if (!photo || !mask) return;

    const pw = (photo as HTMLImageElement).naturalWidth || photo.width;
    const ph = (photo as HTMLImageElement).naturalHeight || photo.height;
    const ratio = pw / ph;
    let W = size, H = Math.round(size / ratio);
    if (H > size) { H = size; W = Math.round(size * ratio); }

    const pd = rgbaOf(photo, W, H);
    // Scale the working-res mask up to output size.
    const mc = document.createElement("canvas"); mc.width = W; mc.height = H;
    const mx = mc.getContext("2d", { willReadFrequently: true })!;
    mx.imageSmoothingEnabled = true;
    mx.drawImage(mask, 0, 0, W, H);
    const md = mx.getImageData(0, 0, W, H).data;

    // Masked areas hide against a FLAT light field so the timeline gives nothing
    // away; the hide slider sets how blank that field is.
    const flatCover = 190 + (hide / 100) * 65;
    const floor = (0.35 + 0.50 * (hide / 100)) * 255;
    const ceil = (0.28 + 0.55 * (reveal / 100)) * 255;
    const k = contrast / 100;

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(W, H);
    const o = img.data;
    for (let i = 0; i < o.length; i += 4) {
      const pr = pd[i], pg = pd[i + 1], pb = pd[i + 2];
      const m = md[i + 3] / 255; // painted coverage 0..1
      if (m <= 0.001) { o[i] = pr; o[i + 1] = pg; o[i + 2] = pb; o[i + 3] = 255; continue; }
      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      const [hr, hg, hb, ha] = hiddenRGBA(flatCover, pr, pg, pb, lum, floor, ceil, k, keepColor);
      // Blend opaque photo (visible) with the hidden pixel by mask coverage.
      o[i] = Math.round(pr * (1 - m) + hr * m);
      o[i + 1] = Math.round(pg * (1 - m) + hg * m);
      o[i + 2] = Math.round(pb * (1 - m) + hb * m);
      o[i + 3] = Math.round(255 * (1 - m) + ha * m);
    }
    octx.putImageData(img, 0, 0);
    outRef.current = out;
    paint(W, H);
    setDims(`${W} × ${H} px`);
  }, [hide, reveal, contrast, size, keepColor, paint]);

  const build = useCallback(() => {
    if (mode === "brush") buildBrush(); else buildTwo();
  }, [mode, buildBrush, buildTwo]);

  // Rebuild on any control change, image swap, or mask edit.
  useEffect(() => { build(); }, [build, rev]);

  const loadFile = (
    file: File | undefined,
    ref: React.MutableRefObject<Src | null>,
    thumb: React.RefObject<HTMLSpanElement>,
    setName: (s: string) => void,
  ) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      ref.current = im;
      if (thumb.current) { thumb.current.style.backgroundImage = `url(${url})`; thumb.current.textContent = ""; }
      setName(file.name);
      setRev((r) => r + 1);
    };
    im.src = url;
  };

  const swap = () => {
    const tmp = coverRef.current; coverRef.current = secretRef.current; secretRef.current = tmp;
    const tc = thumbCover.current?.style.backgroundImage ?? "";
    const ts = thumbSecret.current?.style.backgroundImage ?? "";
    if (thumbCover.current) thumbCover.current.style.backgroundImage = ts;
    if (thumbSecret.current) thumbSecret.current.style.backgroundImage = tc;
    setCoverName((n) => { const s = secretName; setSecretName(n); return s; });
    setRev((r) => r + 1);
  };

  const download = async () => {
    const out = outRef.current;
    if (!out) return;
    setStatus("Saving…");
    try {
      const blob = await encodeCanvas(out, format);
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

  // ---- Brush mode: paint surface + strokes ----
  // Redraw the editable canvas: the photo with a translucent mark over painted
  // (soon-to-be-hidden) areas.
  const renderEdit = useCallback(() => {
    const ed = editRef.current, photo = photoRef.current, mask = maskRef.current;
    if (!ed || !photo || !mask) return;
    const { w, h } = workRef.current;
    const cx = ed.getContext("2d")!;
    cx.clearRect(0, 0, w, h);
    drawCover(cx, photo, w, h);
    const ov = document.createElement("canvas"); ov.width = w; ov.height = h;
    const ox = ov.getContext("2d")!;
    ox.drawImage(mask, 0, 0);
    ox.globalCompositeOperation = "source-in";
    ox.fillStyle = "#ff2e63"; ox.fillRect(0, 0, w, h);
    cx.globalAlpha = 0.5; cx.drawImage(ov, 0, 0); cx.globalAlpha = 1;
  }, []);

  const setupPhoto = useCallback((img: Src) => {
    const iw = (img as HTMLImageElement).naturalWidth || img.width;
    const ih = (img as HTMLImageElement).naturalHeight || img.height;
    const ratio = iw / ih;
    let w = WORK_MAX, h = Math.round(WORK_MAX / ratio);
    if (h > WORK_MAX) { h = WORK_MAX; w = Math.round(WORK_MAX * ratio); }
    workRef.current = { w, h };
    const m = document.createElement("canvas"); m.width = w; m.height = h;
    maskRef.current = m;
    photoRef.current = img;
    if (editRef.current) { editRef.current.width = w; editRef.current.height = h; }
    setHasPhoto(true);
    renderEdit();
    setRev((r) => r + 1);
  }, [renderEdit]);

  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const strokeAt = useCallback((clientX: number, clientY: number) => {
    const ed = editRef.current, mask = maskRef.current;
    if (!ed || !mask) return;
    const rect = ed.getBoundingClientRect();
    const { w, h } = workRef.current;
    const x = ((clientX - rect.left) / rect.width) * w;
    const y = ((clientY - rect.top) / rect.height) * h;
    const mx = mask.getContext("2d")!;
    mx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
    mx.strokeStyle = "rgba(255,255,255,1)";
    mx.fillStyle = "rgba(255,255,255,1)";
    mx.lineCap = "round"; mx.lineJoin = "round"; mx.lineWidth = brushSize;
    const last = lastPt.current;
    if (last) { mx.beginPath(); mx.moveTo(last.x, last.y); mx.lineTo(x, y); mx.stroke(); }
    else { mx.beginPath(); mx.arc(x, y, brushSize / 2, 0, Math.PI * 2); mx.fill(); }
    lastPt.current = { x, y };
    renderEdit();
  }, [tool, brushSize, renderEdit]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    paintingRef.current = true; lastPt.current = null;
    strokeAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current) return;
    strokeAt(e.clientX, e.clientY);
  };
  const endStroke = () => {
    if (!paintingRef.current) return;
    paintingRef.current = false; lastPt.current = null;
    setRev((r) => r + 1); // rebuild the output previews now the stroke is done
  };

  const clearMask = () => {
    const mask = maskRef.current;
    if (!mask) return;
    mask.getContext("2d")!.clearRect(0, 0, mask.width, mask.height);
    renderEdit();
    setRev((r) => r + 1);
  };

  const loadPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const im = new Image();
    im.onload = () => setupPhoto(im);
    im.src = URL.createObjectURL(file);
  };

  // Entering brush mode: make sure there's a photo to paint on (seed the demo)
  // and the paint surface is sized + drawn.
  useEffect(() => {
    if (mode !== "brush") return;
    if (!photoRef.current) { setupPhoto(demo("Selfie", "your photo here", "#2a2f3a", "#dfe7f5", "🙂")); return; }
    const { w, h } = workRef.current;
    if (editRef.current && (editRef.current.width !== w || editRef.current.height !== h)) {
      editRef.current.width = w; editRef.current.height = h;
    }
    renderEdit();
    setRev((r) => r + 1);
  }, [mode, setupPhoto, renderEdit]);

  const dragHandlers = (ref: React.RefObject<HTMLLabelElement>) => ({
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); ref.current?.classList.add("drag"); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); ref.current?.classList.add("drag"); },
    onDragLeave: () => ref.current?.classList.remove("drag"),
    onDrop: () => ref.current?.classList.remove("drag"),
  });
  const dropCover = useRef<HTMLLabelElement | null>(null);
  const dropSecret = useRef<HTMLLabelElement | null>(null);

  const activePreset = PRESETS.find((p) => p.hide === hide && p.reveal === reveal && p.contrast === contrast)?.name ?? "";

  return (
    <div className="kx">
      <div className="wrap">
        <nav className="topnav">
          <a href="/">← MetricBase World</a>
          <span className="spacer" />
          <a href="/dashboard">Dashboard</a>
          <a href="/play">Play</a>
        </nav>

        <header>
          <img className="mb-logo" src="/pwa-192x192.png" alt="MetricBase World" />
          <div>
            <h1>{activeTool === "bg" ? "Background Remover" : "Hidden Image Maker"}</h1>
            <p className="tagline">
              {activeTool === "bg"
                ? "Cut out a background with a colour pick and a brush — get a clean transparent PNG. Free, no sign-in; runs right here in your browser."
                : "Make one image that looks ordinary in the X timeline but reveals a hidden picture when someone taps to enlarge it. Free, no sign-in — everything runs right here in your browser."}
            </p>
          </div>
        </header>

        <div className="toolnav" role="group" aria-label="Choose a tool">
          <button type="button" className={activeTool === "hidden" ? "on" : ""} onClick={() => setActiveTool("hidden")}>🫥 Hidden Image</button>
          <button type="button" className={activeTool === "bg" ? "on" : ""} onClick={() => setActiveTool("bg")}>✂️ Remove Background</button>
        </div>

        {activeTool === "bg" && <BackgroundRemover />}

        {activeTool === "hidden" && (
        <div className="grid">
          {/* ---- Controls ---- */}
          <section className="chibi-panel panel-pad" aria-label="Image controls">
            <div className="field size0" style={{ marginBottom: 16 }}>
              <div className="seg seg-wide" role="group" aria-label="Mode">
                <button type="button" aria-pressed={mode === "two"} onClick={() => setMode("two")}>Two pictures</button>
                <button type="button" aria-pressed={mode === "brush"} onClick={() => setMode("brush")}>Paint to hide</button>
              </div>
            </div>

            {mode === "two" ? (
              <>
                <div className="eyebrow">Step 1 · Choose two pictures</div>
                <h2>Your images</h2>
                <div className="drops">
                  <label className="drop" ref={dropCover} {...dragHandlers(dropCover)}>
                    <input type="file" accept="image/*" aria-label="Visible image"
                      onChange={(e) => loadFile(e.target.files?.[0], coverRef, thumbCover, setCoverName)} />
                    <span className="thumb" ref={thumbCover} aria-hidden="true">📷</span>
                    <span className="lbl"><b>Visible picture</b><span>{coverName}</span></span>
                    <span className="role">Shown</span>
                  </label>
                  <label className="drop" ref={dropSecret} {...dragHandlers(dropSecret)}>
                    <input type="file" accept="image/*" aria-label="Hidden image"
                      onChange={(e) => loadFile(e.target.files?.[0], secretRef, thumbSecret, setSecretName)} />
                    <span className="thumb secret" ref={thumbSecret} aria-hidden="true">🙈</span>
                    <span className="lbl"><b>Hidden picture</b><span>{secretName}</span></span>
                    <span className="role dark">Hidden</span>
                  </label>
                </div>
                <button className="swap" type="button" onClick={swap}>⇅ Swap the two pictures</button>
              </>
            ) : (
              <>
                <div className="eyebrow">Step 1 · Your photo, then paint</div>
                <h2>Paint what to hide</h2>
                <label className="drop" style={{ marginBottom: 12 }}>
                  <input type="file" accept="image/*" aria-label="Photo"
                    onChange={(e) => loadPhoto(e.target.files?.[0])} />
                  <span className="thumb" aria-hidden="true">🖼️</span>
                  <span className="lbl"><b>{hasPhoto ? "Change photo" : "Upload a photo"}</b><span>Tap to choose an image</span></span>
                </label>
                <div className="brush-bar">
                  <div className="seg" role="group" aria-label="Tool">
                    <button type="button" aria-pressed={tool === "paint"} onClick={() => setTool("paint")}>🖌 Hide</button>
                    <button type="button" aria-pressed={tool === "erase"} onClick={() => setTool("erase")}>🩹 Erase</button>
                  </div>
                  <button className="chibi-btn chibi-btn--ghost brush-clear" type="button" onClick={clearMask}>Clear</button>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="kx-brush">Brush size <span className="val mono">{brushSize}px</span></label>
                  <input id="kx-brush" type="range" min={12} max={140} value={brushSize}
                    onChange={(e) => setBrushSize(+e.target.value)} />
                  <p className="hint">Paint over the parts of the photo you want hidden until someone taps it.</p>
                </div>
              </>
            )}

            <div className="controls">
              <div className="eyebrow">Step 2 · Pick a style</div>

              <div className="field size0">
                <div className="seg seg-wide" role="group" aria-label="Quick style">
                  {PRESETS.map((p) => (
                    <button key={p.name} type="button" aria-pressed={activePreset === p.name}
                      onClick={() => { setHide(p.hide); setReveal(p.reveal); setContrast(p.contrast); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="hint">{PRESETS.find((p) => p.name === activePreset)?.blurb ?? "Fine-tune it below if you like."}</p>
              </div>

              <div className="field size0">
                <label className="lbl-block">Reveal colours</label>
                <div className="seg seg-wide" role="group" aria-label="Reveal colours">
                  <button type="button" aria-pressed={keepColor} onClick={() => setKeepColor(true)}>🎨 Full colour</button>
                  <button type="button" aria-pressed={!keepColor} onClick={() => setKeepColor(false)}>◑ Black &amp; white</button>
                </div>
                <p className="hint">Keeps the hidden picture in colour when it&apos;s tapped open.</p>
              </div>

              <details className="advanced">
                <summary>Fine-tune (optional)</summary>

              <div className="field">
                <label htmlFor="kx-hide">Hide strength <span className="val mono">{hide}%</span></label>
                <input id="kx-hide" type="range" min={0} max={100} value={hide}
                  onChange={(e) => setHide(+e.target.value)} />
                <p className="hint">Higher makes the secret harder to spot in the timeline (cover washes lighter).</p>
              </div>

              <div className="field">
                <label htmlFor="kx-reveal">Reveal depth <span className="val mono">{reveal}%</span></label>
                <input id="kx-reveal" type="range" min={0} max={100} value={reveal}
                  onChange={(e) => setReveal(+e.target.value)} />
                <p className="hint">Higher makes the secret bolder and brighter once tapped open.</p>
              </div>

              <div className="field">
                <label htmlFor="kx-contrast">Secret contrast <span className="val mono">{(contrast / 100).toFixed(2)}×</span></label>
                <input id="kx-contrast" type="range" min={60} max={200} value={contrast}
                  onChange={(e) => setContrast(+e.target.value)} />
                <p className="hint">Punch up a flat secret so it reads clearly against black.</p>
              </div>
              </details>

              <div className="row">
                <div className="field size0">
                  <label className="lbl-block">Output size</label>
                  <div className="seg" role="group" aria-label="Output size">
                    {[700, 900, 1200].map((s) => (
                      <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="field size0">
                  <label className="lbl-block">Preview backing</label>
                  <div className="seg" role="group" aria-label="Preview backing">
                    <button type="button" aria-pressed={!checker} onClick={() => setChecker(false)}>Solid</button>
                    <button type="button" aria-pressed={checker} onClick={() => setChecker(true)}>Checker</button>
                  </div>
                </div>
              </div>

              <div className="field size0">
                <label className="lbl-block">File format</label>
                <div className="seg seg-wide" role="group" aria-label="File format">
                  <button type="button" aria-pressed={format === "png8"} onClick={() => setFormat("png8")} disabled={!png8Supported()}>PNG-8</button>
                  <button type="button" aria-pressed={format === "rgba"} onClick={() => setFormat("rgba")}>RGBA</button>
                </div>
                <p className="hint">
                  {format === "png8"
                    ? "Indexed PNG-8 — the most reliable hidden-image encoding on X."
                    : "Full-quality truecolour PNG. Larger, and X may re-compress it."}
                </p>
              </div>
            </div>
          </section>

          {/* ---- Preview ---- */}
          <section aria-label="Preview">
            {mode === "brush" && (
              <div className="chibi-panel panel-pad" style={{ marginBottom: 16 }}>
                <div className="stage-head">
                  <div>
                    <div className="eyebrow">Step 2 · Paint over what to hide</div>
                    <h2 style={{ marginBottom: 0 }}>Paint the photo</h2>
                  </div>
                  <span className="mono" style={{ fontSize: ".78rem", color: "var(--chibi-ink-soft)" }}>
                    {tool === "erase" ? "Erasing" : "Hiding"} · {brushSize}px
                  </span>
                </div>
                <div className="paint-hold">
                  <canvas
                    ref={editRef}
                    className="paint-canvas"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onPointerCancel={endStroke}
                  />
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  Drag across the photo to mark the areas that stay hidden until someone taps the image. Use <b>Erase</b> to fix mistakes.
                </p>
              </div>
            )}

            <div className="chibi-panel panel-pad">
              <div className="stage-head">
                <div>
                  <div className="eyebrow">{mode === "brush" ? "Step 3 · Preview & save" : "Step 3 · The same file, two ways"}</div>
                  <h2 style={{ marginBottom: 0 }}>Live preview</h2>
                </div>
                <span className="mono" style={{ fontSize: ".78rem", color: "var(--chibi-ink-soft)" }}>{dims}</span>
              </div>

              <div className="stage">
                <div className={`view light${checker ? " checker" : ""}`}>
                  <div className="cap"><span className="dot" style={{ background: "#8899a6" }} /> In the timeline <small>· over white</small></div>
                  <div className="canvas-hold"><canvas ref={cvLight} width={300} height={300} /></div>
                </div>
                <div className={`view dark${checker ? " checker" : ""}`}>
                  <div className="cap"><span className="dot" style={{ background: "var(--chibi-pink)" }} /> Tapped to reveal <small>· over black</small></div>
                  <div className="canvas-hold"><canvas ref={cvDark} width={300} height={300} /></div>
                </div>
              </div>

              <div className="actions">
                <button className="chibi-btn chibi-btn--primary" type="button" onClick={() => void download()}>↓ Download PNG</button>
                <button className="chibi-btn chibi-btn--secondary" type="button" onClick={build}>↻ Rebuild</button>
                <span className="mono" style={{ fontSize: ".8rem", color: "var(--chibi-ink-soft)" }}>{status}</span>
              </div>
            </div>

            <div className="chibi-panel panel-pad howto" style={{ marginTop: 16 }}>
              <div className="eyebrow">How to post it on X</div>
              <ol>
                <li><span>Tap <b>Download PNG</b>, then post the file from a <b>desktop browser</b> at x.com — the phone apps re-compress images and break the effect.</span></li>
                <li><span>In the timeline people see your <b>visible picture</b>. When they <b>tap to enlarge</b> it, the hidden picture appears.</span></li>
                <li><span>Works best for viewers on <b>light mode</b>. A busy visible picture and a bold hidden one give the cleanest surprise.</span></li>
              </ol>
              <p className="note"><b>How it works:</b> every pixel is given its own transparency so the image lands on your visible picture over a white background and your hidden picture over black — which keeps the hidden picture in <b>full colour</b> when it&apos;s revealed. It all runs on your device; nothing is uploaded.</p>
            </div>
          </section>
        </div>
        )}

        <footer>A free MetricBase World tool · runs 100% in your browser</footer>
      </div>
    </div>
  );
}
