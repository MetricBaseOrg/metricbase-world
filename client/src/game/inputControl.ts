import Phaser from "phaser";

let game: Phaser.Game | null = null;

export function registerPhaserGame(instance: Phaser.Game) {
  game = instance;
}

export function unregisterPhaserGame() {
  game = null;
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