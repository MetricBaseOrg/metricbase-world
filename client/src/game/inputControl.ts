import Phaser from "phaser";

let game: Phaser.Game | null = null;
let mobileAxis = { dx: 0, dy: 0 };
let pendingMobileInteract = false;
let pendingMobileAttack = false;

export function registerPhaserGame(instance: Phaser.Game) {
  game = instance;
}

export function unregisterPhaserGame() {
  game = null;
  resetMobileInput();
}

export function setUiTypingActive(active: boolean) {
  if (!game) return;

  const sceneKeyboard = game.scene.getScene("GameScene")?.input.keyboard;
  if (sceneKeyboard) {
    if (!active) {
      sceneKeyboard.resetKeys();
    }
    sceneKeyboard.enabled = !active;
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