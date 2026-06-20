import type { WalletConnector } from "../wallet/discovery";

interface WalletPickerProps {
  wallets: WalletConnector[];
  onSelect: (wallet: WalletConnector) => void;
  onClose: () => void;
}

export function WalletPicker({ wallets, onSelect, onClose }: WalletPickerProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 40,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(360px, 100%)",
          padding: 20,
          borderRadius: 14,
          background: "rgba(12, 18, 34, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#f4f7ff",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Choose Wallet</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
          Select the Solana wallet you want to connect.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              onClick={() => onSelect(wallet)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {wallet.icon ? (
                <img
                  src={wallet.icon}
                  alt=""
                  width={28}
                  height={28}
                  style={{ borderRadius: 8 }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #4f8cff, #6c5ce7)",
                  }}
                />
              )}
              <span style={{ fontWeight: 600 }}>{wallet.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 8,
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}