import { FormEvent, useState } from "react";
import { useGameStore } from "../store/gameStore";

interface LoginOverlayProps {
  onJoin: (name: string) => void;
}

export function LoginOverlay({ onJoin }: LoginOverlayProps) {
  const playerName = useGameStore((state) => state.playerName);
  const [name, setName] = useState(playerName);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim() || "Traveler";
    onJoin(trimmed);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(5, 8, 18, 0.72)",
        backdropFilter: "blur(4px)",
        zIndex: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          padding: 24,
          borderRadius: 14,
          background: "rgba(12, 18, 34, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#f4f7ff",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Enter the World</h1>
        <p style={{ margin: "8px 0 20px", opacity: 0.75, fontSize: 14 }}>
          Milestone 1 prototype — multiplayer movement, zone chat, and portals.
        </p>
        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Character name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={16}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#fff",
            marginBottom: 16,
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "11px 12px",
            border: "none",
            borderRadius: 8,
            background: "linear-gradient(135deg, #4f8cff, #6c5ce7)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Join Zone
        </button>
      </form>
    </div>
  );
}