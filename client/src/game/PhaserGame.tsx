import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BootScene } from "./BootScene";
import { GameScene } from "./GameScene";
import { registerPhaserGame, unregisterPhaserGame } from "./inputControl";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const instance = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#0b1020",
      scene: [BootScene, GameScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: true,
        antialias: false,
      },
    });

    gameRef.current = instance;
    registerPhaserGame(instance);

    return () => {
      unregisterPhaserGame();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}