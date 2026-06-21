let readyResolve: (() => void) | null = null;
let readyPromise: Promise<void> | null = null;

export function resetGameSceneReady() {
  readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
}

export function notifyGameSceneReady() {
  readyResolve?.();
  readyResolve = null;
  readyPromise = null;
}

export function waitForGameSceneReady(): Promise<void> {
  if (!readyPromise) {
    resetGameSceneReady();
  }
  return readyPromise!;
}