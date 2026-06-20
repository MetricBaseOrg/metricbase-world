import { useEffect } from "react";
import { setUiTypingActive } from "../game/inputControl";
import { useGameStore } from "../store/gameStore";

export function InventoryHotkey() {
  const toggleInventoryOpen = useGameStore((state) => state.toggleInventoryOpen);
  const inventoryOpen = useGameStore((state) => state.inventoryOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "i") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      toggleInventoryOpen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleInventoryOpen]);

  useEffect(() => {
    setUiTypingActive(inventoryOpen);
  }, [inventoryOpen]);

  return null;
}