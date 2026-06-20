import { useEffect } from "react";
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
      toggleInventoryOpen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleInventoryOpen]);

  return null;
}