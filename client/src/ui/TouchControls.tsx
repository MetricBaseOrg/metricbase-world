import { useCallback, useEffect, useRef } from "react";
import {
  queueMobileAttack,
  queueMobileInteract,
  resetMobileInput,
  setMobileAxis,
} from "../game/inputControl";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

type Direction = "up" | "down" | "left" | "right";

function axisFromDirections(active: Set<Direction>): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (active.has("left")) dx -= 1;
  if (active.has("right")) dx += 1;
  if (active.has("up")) dy -= 1;
  if (active.has("down")) dy += 1;
  return { dx, dy };
}

export function TouchControls() {
  const mobileLayout = useMobileLayout();
  const panelOpen = useGameStore(isAnyPanelOpen);
  const knockedOut = useGameStore((state) => state.knockedOut);
  const worldEditing = useGameStore((state) => state.worldEditing);
  const toggleInventoryOpen = useGameStore((state) => state.toggleInventoryOpen);
  const toggleCraftOpen = useGameStore((state) => state.toggleCraftOpen);
  const activeDirections = useRef(new Set<Direction>());

  const syncAxis = useCallback(() => {
    const { dx, dy } = axisFromDirections(activeDirections.current);
    setMobileAxis(dx, dy);
  }, []);

  const pressDirection = useCallback(
    (direction: Direction) => {
      activeDirections.current.add(direction);
      syncAxis();
    },
    [syncAxis],
  );

  const releaseDirection = useCallback(
    (direction: Direction) => {
      activeDirections.current.delete(direction);
      syncAxis();
    },
    [syncAxis],
  );

  const releaseAll = useCallback(() => {
    activeDirections.current.clear();
    syncAxis();
  }, [syncAxis]);

  useEffect(() => {
    if (!mobileLayout) resetMobileInput();
    return () => resetMobileInput();
  }, [mobileLayout]);

  useEffect(() => {
    const stopMovement = () => releaseAll();
    window.addEventListener("blur", stopMovement);
    document.addEventListener("visibilitychange", stopMovement);
    return () => {
      window.removeEventListener("blur", stopMovement);
      document.removeEventListener("visibilitychange", stopMovement);
    };
  }, [releaseAll]);

  if (!mobileLayout || knockedOut || panelOpen) return null;

  const bindDirection = (direction: Direction) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pressDirection(direction);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      releaseDirection(direction);
    },
    onPointerCancel: () => releaseDirection(direction),
    onLostPointerCapture: () => releaseDirection(direction),
  });

  return (
    <div className="chibi-touch-layer">
      <div className="chibi-dpad" aria-label="Movement controls">
        <button type="button" className="chibi-dpad__btn chibi-dpad__btn--up" aria-label="Move up" {...bindDirection("up")}>
          ▲
        </button>
        <button type="button" className="chibi-dpad__btn chibi-dpad__btn--left" aria-label="Move left" {...bindDirection("left")}>
          ◀
        </button>
        <button type="button" className="chibi-dpad__btn chibi-dpad__btn--center" aria-hidden tabIndex={-1} disabled />
        <button type="button" className="chibi-dpad__btn chibi-dpad__btn--right" aria-label="Move right" {...bindDirection("right")}>
          ▶
        </button>
        <button type="button" className="chibi-dpad__btn chibi-dpad__btn--down" aria-label="Move down" {...bindDirection("down")}>
          ▼
        </button>
      </div>

      {/* Combat/action buttons are hidden while building (keep movement only). */}
      {!worldEditing && (
      <div className="chibi-action-pad" aria-label="Action controls">
        <button
          type="button"
          className="chibi-btn chibi-btn--mint chibi-action-btn chibi-action-btn--icon"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => queueMobileAttack()}
          aria-label="Attack"
        >
          ⚔️
        </button>
        <button
          type="button"
          className="chibi-btn chibi-btn--primary chibi-action-btn chibi-action-btn--icon"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => queueMobileInteract()}
          aria-label="Interact"
        >
          ✨
        </button>
        <button
          type="button"
          className="chibi-btn chibi-btn--secondary chibi-action-btn chibi-action-btn--icon"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => toggleInventoryOpen()}
          aria-label="Inventory"
        >
          🎒
        </button>
        <button
          type="button"
          className="chibi-btn chibi-btn--gold chibi-action-btn chibi-action-btn--icon"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => toggleCraftOpen()}
          aria-label="Crafting"
        >
          🔨
        </button>
      </div>
      )}
    </div>
  );
}