import type { WalletConnector } from "../wallet/discovery";

interface WalletPickerProps {
  wallets: WalletConnector[];
  onSelect: (wallet: WalletConnector) => void;
  onClose: () => void;
}

export function WalletPicker({ wallets, onSelect, onClose }: WalletPickerProps) {
  return (
    <div
      className="chibi-overlay"
      style={{ zIndex: 40, background: "rgba(61, 43, 31, 0.45)" }}
      onClick={onClose}
    >
      <div
        className="chibi-panel"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(360px, 100%)", padding: 20 }}
      >
        <h2 className="chibi-title chibi-title--sm" style={{ marginBottom: 8 }}>
          Choose Wallet
        </h2>
        <p className="chibi-subtitle" style={{ marginBottom: 16 }}>
          Pick the Solana wallet you want to connect.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              className="chibi-btn chibi-btn--secondary"
              onClick={() => onSelect(wallet)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
              }}
            >
              {wallet.icon ? (
                <img src={wallet.icon} alt="" width={28} height={28} style={{ borderRadius: 8 }} />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, var(--chibi-pink), var(--chibi-lavender))",
                  }}
                />
              )}
              <span style={{ fontWeight: 800 }}>{wallet.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          onClick={onClose}
          style={{ marginTop: 14, width: "100%", padding: "10px 12px", fontSize: "0.9rem" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}