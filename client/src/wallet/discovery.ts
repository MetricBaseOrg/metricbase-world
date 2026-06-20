import {
  SolanaSignAndSendTransaction,
  SolanaSignMessage,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";
import { Transaction, type VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect } from "@wallet-standard/features";

export type SignableTransaction = Transaction | VersionedTransaction;

export interface WalletConnector {
  id: string;
  name: string;
  icon?: string;
  connect: () => Promise<string>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransaction: (
    transaction: SignableTransaction,
    connection: import("@solana/web3.js").Connection,
  ) => Promise<string>;
}

interface LegacyProvider {
  isPhantom?: boolean;
  isJupiter?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toString(): string };
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (
    message: Uint8Array,
    display?: string,
  ) => Promise<{ signature: Uint8Array }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (
    transaction: Transaction,
    options?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string }>;
}

type WindowWithWallets = Window & {
  solana?: LegacyProvider;
  phantom?: { solana?: LegacyProvider };
  solflare?: LegacyProvider;
  backpack?: LegacyProvider;
  jupiter?: LegacyProvider;
  Jupiter?: { solana?: LegacyProvider };
};

const SELECTED_WALLET_KEY = "metricbase_wallet_id";

export function getSelectedWalletId(): string | null {
  return sessionStorage.getItem(SELECTED_WALLET_KEY);
}

export function setSelectedWalletId(walletId: string): void {
  sessionStorage.setItem(SELECTED_WALLET_KEY, walletId);
}

export function clearSelectedWalletId(): void {
  sessionStorage.removeItem(SELECTED_WALLET_KEY);
}

export function discoverWallets(): WalletConnector[] {
  const found = new Map<string, WalletConnector>();

  for (const wallet of getWallets().get()) {
    const connector = fromWalletStandard(wallet);
    if (connector) {
      found.set(connector.id, connector);
    }
  }

  for (const connector of discoverLegacyWallets()) {
    if (!found.has(connector.id)) {
      found.set(connector.id, connector);
    }
  }

  return Array.from(found.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function pickWalletConnector(preferredId?: string | null): WalletConnector | null {
  const wallets = discoverWallets();
  if (wallets.length === 0) return null;

  const targetId = preferredId ?? getSelectedWalletId();
  if (targetId) {
    const selected = wallets.find((wallet) => wallet.id === targetId);
    if (selected) return selected;
  }

  return wallets.length === 1 ? wallets[0] : null;
}

type WalletStandardFeatures = {
  [StandardConnect]?: {
    connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>;
  };
  [SolanaSignMessage]?: {
    signMessage: (
      input: { account: WalletAccount; message: Uint8Array },
    ) => Promise<readonly { signature: Uint8Array }[]>;
  };
  [SolanaSignTransaction]?: {
    signTransaction: (input: {
      account: WalletAccount;
      transaction: Uint8Array;
      chain: string;
    }) => Promise<readonly { signedTransaction: Uint8Array }[]>;
  };
  [SolanaSignAndSendTransaction]?: {
    signAndSendTransaction: (input: {
      account: WalletAccount;
      transaction: Uint8Array;
      chain: string;
    }) => Promise<readonly { signature: Uint8Array }[]>;
  };
};

function fromWalletStandard(wallet: Wallet): WalletConnector | null {
  const features = wallet.features as WalletStandardFeatures;
  const connectFeature = features[StandardConnect];
  const signMessageFeature = features[SolanaSignMessage];
  const signTransactionFeature = features[SolanaSignTransaction];
  const signAndSendFeature = features[SolanaSignAndSendTransaction];
  if (!connectFeature || !signMessageFeature) return null;
  if (!signTransactionFeature && !signAndSendFeature) return null;

  let connectedAccount: WalletAccount | null = null;

  return {
    id: `standard:${wallet.name}`,
    name: wallet.name,
    icon: wallet.icon,
    async connect() {
      const { accounts } = await connectFeature.connect();
      if (!accounts.length) {
        throw new Error("Wallet connection rejected.");
      }
      const account = accounts[0];
      connectedAccount = account;
      return account.address;
    },
    async signMessage(message) {
      if (!connectedAccount) {
        const { accounts } = await connectFeature.connect({ silent: true });
        connectedAccount = accounts[0] ?? null;
      }
      if (!connectedAccount) {
        throw new Error("No wallet account available.");
      }

      const [signed] = await signMessageFeature.signMessage({
        account: connectedAccount,
        message,
      });
      return new Uint8Array(signed.signature);
    },
    async signAndSendTransaction(transaction, connection) {
      if (!connectedAccount) {
        const { accounts } = await connectFeature.connect({ silent: true });
        connectedAccount = accounts[0] ?? null;
      }
      if (!connectedAccount) {
        throw new Error("No wallet account available.");
      }

      const serialized = serializeTransaction(transaction);
      const chain = "solana:mainnet";

      if (signAndSendFeature) {
        const [sent] = await signAndSendFeature.signAndSendTransaction({
          account: connectedAccount,
          transaction: serialized,
          chain,
        });
        return bs58.encode(sent.signature);
      }

      if (!signTransactionFeature) {
        throw new Error("Wallet cannot sign token transfers.");
      }

      const [signed] = await signTransactionFeature.signTransaction({
        account: connectedAccount,
        transaction: serialized,
        chain,
      });
      const signature = await connection.sendRawTransaction(signed.signedTransaction, {
        skipPreflight: false,
      });
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
  };
}

function discoverLegacyWallets(): WalletConnector[] {
  if (typeof window === "undefined") return [];

  const browserWindow = window as WindowWithWallets;
  const candidates: Array<{ id: string; name: string; provider?: LegacyProvider }> = [
    { id: "legacy:phantom", name: "Phantom", provider: browserWindow.phantom?.solana },
    { id: "legacy:jupiter", name: "Jupiter", provider: browserWindow.jupiter ?? browserWindow.Jupiter?.solana },
    { id: "legacy:solflare", name: "Solflare", provider: browserWindow.solflare },
    { id: "legacy:backpack", name: "Backpack", provider: browserWindow.backpack },
  ];

  if (browserWindow.solana) {
    candidates.push({
      id: `legacy:${legacyProviderKey(browserWindow.solana)}`,
      name: legacyProviderName(browserWindow.solana),
      provider: browserWindow.solana,
    });
  }

  const connectors: WalletConnector[] = [];
  const seenProviders = new Set<LegacyProvider>();

  for (const candidate of candidates) {
    if (!candidate.provider || seenProviders.has(candidate.provider)) continue;
    seenProviders.add(candidate.provider);
    connectors.push(fromLegacyProvider(candidate.id, candidate.name, candidate.provider));
  }

  return connectors;
}

function fromLegacyProvider(
  id: string,
  name: string,
  provider: LegacyProvider,
): WalletConnector {
  return {
    id,
    name,
    async connect() {
      const connection = await provider.connect();
      return connection.publicKey.toString();
    },
    async signMessage(message) {
      const signed = await provider.signMessage(message, "utf8");
      return signed.signature;
    },
    async signAndSendTransaction(transaction, connection) {
      if (provider.signAndSendTransaction && transaction instanceof Transaction) {
        const sent = await provider.signAndSendTransaction(transaction);
        return sent.signature;
      }

      if (!provider.signTransaction || !(transaction instanceof Transaction)) {
        throw new Error("Wallet cannot sign token transfers.");
      }

      const signed = await provider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
  };
}

function legacyProviderName(provider: LegacyProvider): string {
  if (provider.isJupiter) return "Jupiter";
  if (provider.isPhantom) return "Phantom";
  if (provider.isSolflare) return "Solflare";
  if (provider.isBackpack) return "Backpack";
  return "Solana Wallet";
}

function serializeTransaction(transaction: SignableTransaction): Uint8Array {
  if ("version" in transaction) {
    return transaction.serialize();
  }
  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
}

function legacyProviderKey(provider: LegacyProvider): string {
  if (provider.isJupiter) return "jupiter";
  if (provider.isPhantom) return "phantom";
  if (provider.isSolflare) return "solflare";
  if (provider.isBackpack) return "backpack";
  return "solana";
}