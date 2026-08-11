import { useEffect } from "react";

/**
 * Let an ordinary page scroll inside the game shell.
 *
 * `index.html` pins `html`, `body` and `#root` to `height: 100%` with
 * `overflow: hidden`, because /play is a fixed-viewport canvas. Every
 * standalone page — the landing page, /dashboard, /dao, /brands, /tools,
 * /board — has to undo that while it is mounted, and restore it on the way out
 * so returning to the game doesn't leave the shell scrollable.
 *
 * This existed as five identical copy-pasted `useEffect`s, which is precisely
 * why /board shipped without one and couldn't be scrolled on a phone. Any new
 * standalone page should call this instead of writing a sixth.
 */
export function usePageScroll(): void {
  useEffect(() => {
    const root = document.getElementById("root");
    const targets = [document.documentElement, document.body, root].filter(Boolean) as HTMLElement[];
    const prev = targets.map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
    for (const el of targets) {
      el.style.height = "auto";
      el.style.overflow = "visible";
    }
    const prevBodyOverflowY = document.body.style.overflowY;
    document.body.style.overflowY = "auto";
    return () => {
      for (const p of prev) {
        p.el.style.height = p.height;
        p.el.style.overflow = p.overflow;
      }
      document.body.style.overflowY = prevBodyOverflowY;
    };
  }, []);
}
