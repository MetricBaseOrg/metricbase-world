import { useEffect } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

export function InventoryHotkey() {
  const toggleInventoryOpen = useGameStore((state) => state.toggleInventoryOpen);
  const toggleCraftOpen = useGameStore((state) => state.toggleCraftOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "i" && key !== "c") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      if (key === "i") {
        const opening = !useGameStore.getState().inventoryOpen;
        playSfx(opening ? "ui_open" : "ui_close");
        toggleInventoryOpen();
      } else {
        const opening = !useGameStore.getState().craftOpen;
        playSfx(opening ? "ui_open" : "ui_close");
        toggleCraftOpen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleInventoryOpen, toggleCraftOpen]);

  return null;
}