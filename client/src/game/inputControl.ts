import Phaser from "phaser";

let game: Phaser.Game | null = null;

export function registerPhaserGame(instance: Phaser.Game) {
  game = instance;
}

export function unregisterPhaserGame() {
  game = null;
}

export function setUiTypingActive(active: boolean) {
  const keyboard = game?.input.keyboard;
  if (!keyboard) return;

  keyboard.enabled = !active;
}