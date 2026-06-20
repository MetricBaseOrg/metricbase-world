export { discoverWallets, pickWalletConnector, type WalletConnector } from "./discovery";

export function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}