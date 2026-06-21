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
        autoCenter: Phaser.Scale.NO_CENTER,
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
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth > 0 && clientHeight > 0) {
        gameRef.current.scale.resize(clientWidth, clientHeight);
      }
    };

    resizeGame();
    window.addEventListener("resize", resizeGame);
    // A ResizeObserver catches container size changes that don't fire a window
    // resize (initial layout settling, sidebars, devtools), keeping the Phaser
    // canvas — and therefore the camera viewport — in sync with what's shown.
    const observer = new ResizeObserver(resizeGame);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
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