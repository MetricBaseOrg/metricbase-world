export interface SolanaWalletProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(
    message: Uint8Array,
    display?: string,
  ): Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
  }
}

export function getSolanaProvider(): SolanaWalletProvider | null {
  if (typeof window === "undefined") return null;
  return window.solana ?? null;
}

export function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}