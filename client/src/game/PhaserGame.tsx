import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BootScene } from "./BootScene";
import { GameScene } from "./GameScene";
import { resetGameSceneReady } from "./gameSceneReady";
import { registerPhaserGame, unregisterPhaserGame } from "./inputControl";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    resetGameSceneReady();

    const { clientWidth, clientHeight } = containerRef.current;

    const instance = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: clientWidth,
      height: clientHeight,
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

    const resizeGame = () => {
      if (!containerRef.current || !gameRef.current) return;
      gameRef.current.scale.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
      );
    };

    resizeGame();
    window.addEventListener("resize", resizeGame);

    return () => {
      window.removeEventListener("resize", resizeGame);
      unregisterPhaserGame();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}