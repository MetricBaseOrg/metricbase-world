import Phaser from "phaser";
import type { PlayerZoneBuild } from "@metricbase/shared";

/** A build-editor tool: place a prop, paint a ground tile, or erase. */
export interface EditTool {
  type: "prop" | "ground" | "erase";
  value: string;
}

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

/**
 * Fire the player's basic attack from outside the Phaser scene (e.g. the
 * combat hotbar). Routes through the same queue the mobile attack button uses,
 * so GameScene.tryAttack() picks the nearest hostile and runs the swing.
 */
export function triggerPrimaryAttack() {
  pendingMobileAttack = true;
}

type AbilityScene = Phaser.Scene & { useAbility?: (abilityId: string) => boolean };

/**
 * Fire a weapon ability at the current target. Returns true if the scene found
 * a target and sent the ability (so the hotbar only starts a cooldown on a hit).
 */
export function triggerAbility(abilityId: string): boolean {
  if (!game) return false;
  const scene = game.scene.getScene("GameScene") as AbilityScene | undefined;
  return scene?.useAbility?.(abilityId) ?? false;
}

type EditScene = Phaser.Scene & {
  beginWorldEdit?: (zoneId: string) => void;
  endWorldEdit?: () => void;
  setWorldEditTool?: (tool: EditTool | null) => void;
  getWorldEditDraft?: () => PlayerZoneBuild;
  placeToolAtClient?: (clientX: number, clientY: number) => void;
};

function editScene(): EditScene | undefined {
  return game?.scene.getScene("GameScene") as EditScene | undefined;
}

/** Enter the in-canvas build editor for a player-owned zone. */
export function beginWorldEdit(zoneId: string) {
  editScene()?.beginWorldEdit?.(zoneId);
}
export function endWorldEdit() {
  editScene()?.endWorldEdit?.();
}
export function setWorldEditTool(tool: EditTool | null) {
  editScene()?.setWorldEditTool?.(tool);
}
export function getWorldEditDraft(): PlayerZoneBuild | undefined {
  return editScene()?.getWorldEditDraft?.();
}
/** Drop the current build tool at a browser client coordinate over the canvas. */
export function placeWorldEditAt(clientX: number, clientY: number) {
  editScene()?.placeToolAtClient?.(clientX, clientY);
}
/** The Phaser canvas element, so the DOM drag layer can hit-test drops. */
export function getGameCanvas(): HTMLCanvasElement | null {
  return game?.canvas ?? null;
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