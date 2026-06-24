import Phaser from "phaser";

let game: Phaser.Game | null = null;
let uiTypingActive = false;
let mobileAxis = { dx: 0, dy: 0 };
let pendingMobileInteract = false;
let pendingMobileAttack = false;

type PhaserKeyboardPlugin = Phaser.Input.Keyboard.KeyboardPlugin & {
  disableGlobalCapture: () => unknown;
  enableGlobalCapture: () => unknown;
  resetKeys: () => void;
};

export function registerPhaserGame(instance: Phaser.Game) {
  game = instance;
}

export function unregisterPhaserGame() {
  game = null;
  resetMobileInput();
}

export function isUiTypingActive(): boolean {
  return uiTypingActive;
}

export function setUiTypingActive(active: boolean) {
  uiTypingActive = active;
  if (!game) return;

  const sceneKeyboard = game.scene.getScene("GameScene")?.input
    ?.keyboard as PhaserKeyboardPlugin | undefined;
  if (!sceneKeyboard) return;

  if (active) {
    sceneKeyboard.resetKeys();
    sceneKeyboard.disableGlobalCapture();
    sceneKeyboard.enabled = false;
    resetMobileInput();
    return;
  }

  sceneKeyboard.enabled = true;
  sceneKeyboard.enableGlobalCapture();
}

function isTextInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function bindUiTypingFocusGuard() {
  const onFocusIn = (event: FocusEvent) => {
    if (isTextInputTarget(event.target)) {
      setUiTypingActive(true);
    }
  };

  const onFocusOut = (event: FocusEvent) => {
    if (!isTextInputTarget(event.target)) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!isTextInputTarget(active)) {
        setUiTypingActive(false);
      }
    }, 0);
  };

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);

  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
  };
}

type ZoomableScene = Phaser.Scene & {
  setZoomLevel?: (zoom: number) => void;
  getZoomLevel?: () => number;
};

/** Step the GameScene camera zoom (used by the HUD zoom buttons). */
export function nudgeZoom(delta: number) {
  if (!game) return;
  const scene = game.scene.getScene("GameScene") as ZoomableScene | undefined;
  if (scene?.getZoomLevel && scene.setZoomLevel) {
    scene.setZoomLevel(scene.getZoomLevel() + delta);
  }
}

export function setMobileAxis(dx: number, dy: number) {
  mobileAxis = { dx, dy };
}

export function getMobileAxis(): { dx: number; dy: number } {
  return mobileAxis;
}

export function resetMobileInput() {
  mobileAxis = { dx: 0, dy: 0 };
  pendingMobileInteract = false;
  pendingMobileAttack = false;
}

export function queueMobileInteract() {
  pendingMobileInteract = true;
}

export function queueMobileAttack() {
  pendingMobileAttack = true;
}

export function consumeMobileInteract(): boolean {
  if (!pendingMobileInteract) return false;
  pendingMobileInteract = false;
  return true;
}

export function consumeMobileAttack(): boolean {
  if (!pendingMobileAttack) return false;
  pendingMobileAttack = false;
  return true;
}