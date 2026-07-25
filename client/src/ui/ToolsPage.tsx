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
 * Grayscale by nature (one alpha per pixel). Everything runs on-device.
 */

type Src = HTMLImageElement | HTMLCanvasElement;

const DISP_MAX = 360;

/** Draw an image/canvas cover-fit into a w×h context (center-crop). */
function drawCover(ctx: CanvasRenderingContext2D, img: Src, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Grayscale luminance buffer for a source cover-fit into w×h. */
function luma(src: Src, w: number, h: number): Float32Array {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#808080"; x.fillRect(0, 0, w, h);
  drawCover(x, src, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    out[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return out;
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
  const [reveal, setReveal] = useState(52);
  const [contrast, setContrast] = useState(115);
  const [size, setSize] = useState(900);
  const [checker, setChecker] = useState(false);
  const [theme, setTheme] = useState<"" | "light" | "dark">("");
  const [coverName, setCoverName] = useState("what everyone sees");
  const [secretName, setSecretName] = useState("revealed on tap");
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

  // Seed the demo images once.
  useEffect(() => {
    coverRef.current = demo("HELLO", "scroll on by", "#20242e", "#eef1f6");
    secretRef.current = demo("BOO!", "you found me", "#ffffff", "#0b0b0b", "👀");
    setRev((r) => r + 1);
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

    const coverL = luma(cover, W, H);
    const secretL = luma(secret, W, H);

    const floor = (0.35 + 0.50 * (hide / 100)) * 255;
    const ceil = (0.28 + 0.55 * (reveal / 100)) * 255;
    const k = contrast / 100;

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(W, H);
    const o = img.data;

    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const C = floor + (coverL[p] / 255) * (255 - floor);
      let sl = (secretL[p] - 128) * k + 128;
      sl = sl < 0 ? 0 : sl > 255 ? 255 : sl;
      let S = (sl / 255) * ceil;
      if (S > C) S = C;
      let a = 1 - (C - S) / 255;
      if (a < 0.0039) a = 0.0039;
      if (a > 1) a = 1;
      let v = S / a;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      o[i] = o[i + 1] = o[i + 2] = Math.round(v);
      o[i + 3] = Math.round(a * 255);
    }
    octx.putImageData(img, 0, 0);
    outRef.current = out;
    paint(W, H);
    setDims(`${W} × ${H} px`);
  }, [hide, reveal, contrast, size, paint]);

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
      a.download = "kakushie.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus("Saved kakushie.png ✓");
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

  return (
    <div className="kx" data-kx-theme={theme || undefined}>
      <div className="wrap">
        <nav className="topnav">
          <a href="/">← MetricBase World</a>
          <span className="spacer" />
          <a href="/dashboard">Dashboard</a>
          <a href="/play">Play</a>
        </nav>

        <header>
          <div className="brand">
            <div className="seal serif">隠</div>
            <div>
              <h1 className="serif">Kakushie Maker <span className="jp">隠し絵</span></h1>
              <p className="tagline">
                Make one image that hides in the X timeline and reveals a <b>secret</b> only when
                someone taps to enlarge it. No account, no upload — everything runs in your browser.
              </p>
            </div>
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-label="Toggle light or dark theme"
            onClick={() => setTheme((t) => {
              const cur = t || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
              return cur === "dark" ? "light" : "dark";
            })}
          >
            ◐ Theme
          </button>
        </header>

        <div className="grid">
          {/* ---- Controls ---- */}
          <section className="panel panel-pad" aria-label="Image controls">
            <div className="eyebrow">Step 1 · Pick two pictures</div>
            <h2>Your images</h2>

            <div className="drops">
              <label className="drop" ref={dropCover} {...dragHandlers(dropCover)}>
                <input type="file" accept="image/*" aria-label="Cover image"
                  onChange={(e) => loadFile(e.target.files?.[0], coverRef, thumbCover, setCoverName)} />
                <span className="thumb" ref={thumbCover} aria-hidden="true" />
                <span className="lbl"><b>Cover</b><span>{coverName}</span></span>
                <span className="role">Shown</span>
              </label>

              <label className="drop" ref={dropSecret} {...dragHandlers(dropSecret)}>
                <input type="file" accept="image/*" aria-label="Secret image"
                  onChange={(e) => loadFile(e.target.files?.[0], secretRef, thumbSecret, setSecretName)} />
                <span className="thumb secret" ref={thumbSecret} aria-hidden="true" />
                <span className="lbl"><b>Secret</b><span>{secretName}</span></span>
                <span className="role dark">Hidden</span>
              </label>
            </div>
            <button className="swap" type="button" onClick={swap}>⇅ Swap cover &amp; secret</button>

            <div className="controls">
              <div className="eyebrow">Step 2 · Tune the illusion</div>

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
            <div className="panel panel-pad">
              <div className="stage-head">
                <div>
                  <div className="eyebrow">Step 3 · The same file, two ways</div>
                  <h2 style={{ marginBottom: 0 }}>Live preview</h2>
                </div>
                <span className="mono" style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>{dims}</span>
              </div>

              <div className="stage">
                <div className={`view light${checker ? " checker" : ""}`}>
                  <div className="cap"><span className="dot" style={{ background: "#8899a6" }} /> In the timeline <small>· over white</small></div>
                  <div className="canvas-hold"><canvas ref={cvLight} width={300} height={300} /></div>
                </div>
                <div className={`view dark${checker ? " checker" : ""}`}>
                  <div className="cap"><span className="dot" style={{ background: "var(--shu)" }} /> Tapped to reveal <small>· over black</small></div>
                  <div className="canvas-hold"><canvas ref={cvDark} width={300} height={300} /></div>
                </div>
              </div>

              <div className="actions">
                <button className="btn primary" type="button" onClick={download}>↓ Download PNG</button>
                <button className="btn" type="button" onClick={build}>↻ Rebuild</button>
                <span className="mono" style={{ fontSize: ".8rem", color: "var(--ink-soft)", alignSelf: "center" }}>{status}</span>
              </div>
            </div>

            <div className="panel panel-pad howto">
              <div className="eyebrow">Posting it on X</div>
              <ol>
                <li><span>Download the PNG and post it from a <b>desktop browser</b> at x.com — the mobile apps re-encode images and break the effect.</span></li>
                <li><span>In the timeline it shows your <b>cover</b>. When a viewer <b>taps to enlarge</b>, the dark viewer background reveals the <b>secret</b>.</span></li>
                <li><span>It reads best for people in <b>light mode</b> timelines. Keep the cover busy and the secret high-contrast for the cleanest flip.</span></li>
              </ol>
              <p className="note"><b>How it works:</b> every pixel gets a custom transparency so it lands on your cover tone over white and your secret tone over black — the classic 隠し絵 alpha trick, computed live on your device. Grayscale by nature; nothing leaves your browser.</p>
            </div>
          </section>
        </div>

        <footer>Made for hiding pictures in plain sight · <span className="mono">隠し絵</span> · runs 100% client-side</footer>
      </div>
    </div>
  );
}
