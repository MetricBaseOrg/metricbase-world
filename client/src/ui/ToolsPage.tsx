import { useCallback, useEffect, useRef, useState } from "react";
import "./tools.css";

/**
 * Kakushie Maker at /tools — makes an X "hidden image" (隠し絵): one transparent
 * PNG that shows a COVER picture in the timeline (composited over white) and a
 * SECRET picture when tapped to enlarge (composited over black).
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

  // The game shell locks page scrolling (fixed height + overflow hidden on
  // html/body/#root); this is an ordinary scrolling page, so unlock it while
  // mounted and restore on leave — otherwise mobile can't scroll past the fold.
  useEffect(() => {
    const rootEl = document.getElementById("root");
    const targets = [document.documentElement, document.body, rootEl].filter(Boolean) as HTMLElement[];
    const prev = targets.map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
    for (const el of targets) { el.style.height = "auto"; el.style.overflow = "visible"; }
    document.body.style.overflowY = "auto";
    return () => { for (const p of prev) { p.el.style.height = p.height; p.el.style.overflow = p.overflow; } };
  }, []);

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

  const build = useCallback(() => {
    const cover = coverRef.current, secret = secretRef.current;
    if (!cover || !secret) return;

    const cw = (cover as HTMLImageElement).naturalWidth || cover.width;
    const ch = (cover as HTMLImageElement).naturalHeight || cover.height;
    const ratio = cw / ch;
    let W = size, H = Math.round(size / ratio);
    if (H > size) { H = size; W = Math.round(size * ratio); }

    const cd = rgbaOf(cover, W, H);   // cover pixels (used for its luminance)
    const sd = rgbaOf(secret, W, H);  // secret pixels (its COLOUR is preserved)

    const floor = (0.35 + 0.50 * (hide / 100)) * 255;
    const ceil = (0.28 + 0.55 * (reveal / 100)) * 255;
    const k = contrast / 100;
    const clamp = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(W, H);
    const o = img.data;

    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const coverLum = 0.299 * cd[i] + 0.587 * cd[i + 1] + 0.114 * cd[i + 2];
      const sr = sd[i], sg = sd[i + 1], sb = sd[i + 2];
      const secretLum = 0.299 * sr + 0.587 * sg + 0.114 * sb;

      // Cover mapped into a light band [floor,255]; secret luminance contrast-
      // adjusted then mapped into [0,ceil]. alpha is shared per pixel (one alpha
      // channel), so it's derived from luminances; C >= S is guaranteed.
      const C = floor + (coverLum / 255) * (255 - floor);
      let sl = (secretLum - 128) * k + 128;
      sl = clamp(sl);
      let S = (sl / 255) * ceil;
      if (S > C) S = C;
      let a = 1 - (C - S) / 255;
      if (a < 0.0039) a = 0.0039;
      if (a > 1) a = 1;
      o[i + 3] = Math.round(a * 255);

      if (keepColor && secretLum > 0.5) {
        // Preserve the revealed image's HUE: scale its RGB to target luminance S,
        // then predivide by alpha so a*colour reproduces the secret colour over
        // black. Grayscale highlights (secretLum~0) fall through to the gray path.
        const scale = (S / secretLum) / a;
        o[i] = Math.round(clamp(sr * scale));
        o[i + 1] = Math.round(clamp(sg * scale));
        o[i + 2] = Math.round(clamp(sb * scale));
      } else {
        const v = Math.round(clamp(S / a));
        o[i] = o[i + 1] = o[i + 2] = v;
      }
    }
    octx.putImageData(img, 0, 0);
    outRef.current = out;
    paint(W, H);
    setDims(`${W} × ${H} px`);
  }, [hide, reveal, contrast, size, keepColor, paint]);

  // Rebuild on any control change or when images swap in.
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

  const download = () => {
    const out = outRef.current;
    if (!out) return;
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "MetricBase.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus("Saved MetricBase.png ✓");
      setTimeout(() => setStatus(""), 3000);
    }, "image/png");
  };

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
            <h1>Hidden Image Maker</h1>
            <p className="tagline">
              Make one image that looks ordinary in the X timeline but reveals a <b>hidden picture</b> when
              someone taps to enlarge it. Free, no sign-in — everything runs right here in your browser.
            </p>
          </div>
        </header>

        <div className="grid">
          {/* ---- Controls ---- */}
          <section className="chibi-panel panel-pad" aria-label="Image controls">
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
            </div>
          </section>

          {/* ---- Preview ---- */}
          <section aria-label="Preview">
            <div className="chibi-panel panel-pad">
              <div className="stage-head">
                <div>
                  <div className="eyebrow">Step 3 · The same file, two ways</div>
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
                <button className="chibi-btn chibi-btn--primary" type="button" onClick={download}>↓ Download PNG</button>
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

        <footer>A free MetricBase World tool · runs 100% in your browser</footer>
      </div>
    </div>
  );
}
