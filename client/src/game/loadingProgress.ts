// Boot progress channel: Phaser -> React.
//
// The entry wait is invisible today. Once a player joins, PhaserGame mounts and
// BootScene downloads the world art while the canvas sits blank dark blue —
// several seconds on a phone, with nothing to say it's working. The overlay in
// ui/GameLoadingOverlay.tsx listens here and draws a real bar.
//
// A module-level emitter rather than the game store, because BootScene runs
// outside React and this must be readable before any component subscribes —
// hence the retained `current` snapshot for late subscribers.

export interface LoadingState {
  /** 0..1 across the whole entry sequence. */
  progress: number;
  /** What's happening right now, shown under the bar. */
  label: string;
  /** True once the world is on screen and the overlay should lift. */
  done: boolean;
}

type Listener = (state: LoadingState) => void;

const listeners = new Set<Listener>();

let current: LoadingState = { progress: 0, label: "Waking up the world…", done: false };

/** Asset loading is the bulk of the wait but not all of it — reserve the last
 * slice for building the scene, so the bar doesn't sit at 100% while the world
 * is still being drawn. */
const ASSET_SHARE = 0.9;

export function getLoadingState(): LoadingState {
  return current;
}

export function onLoadingProgress(listener: Listener): () => void {
  listeners.add(listener);
  listener(current); // late subscribers get the current value immediately
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: LoadingState) {
  current = next;
  for (const l of listeners) l(next);
}

/** BootScene: raw Phaser loader progress (0..1). */
export function setAssetProgress(value: number, label = "Loading world art…") {
  if (current.done) return;
  const clamped = Math.max(0, Math.min(1, value));
  emit({
    // Never let the bar go backwards — Phaser's loader can re-report a lower
    // value when a second batch is queued mid-load, which reads as a stall.
    progress: Math.max(current.progress, clamped * ASSET_SHARE),
    label,
    done: false,
  });
}

/** BootScene -> GameScene handoff: assets in, world not yet drawn. */
export function setBuildingWorld(label = "Building the world…") {
  if (current.done) return;
  emit({ progress: Math.max(current.progress, ASSET_SHARE), label, done: false });
}

/** GameScene: the world is on screen. */
export function setLoadingComplete() {
  emit({ progress: 1, label: "Ready!", done: true });
}

/** New session (re-login after leaving) — put the bar back to the start. */
export function resetLoadingProgress() {
  emit({ progress: 0, label: "Waking up the world…", done: false });
}
