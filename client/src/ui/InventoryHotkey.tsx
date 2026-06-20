import { useEffect } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

export function InventoryHotkey() {
  const toggleInventoryOpen = useGameStore((state) => state.toggleInventoryOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "i") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      const opening = !useGameStore.getState().inventoryOpen;
      playSfx(opening ? "ui_open" : "ui_close");
      toggleInventoryOpen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleInventoryOpen]);

  return null;
}