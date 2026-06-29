// House-side payout signer for casino withdrawals. Loads the treasury keypair
// from HOUSE_WALLET_SECRET (bs58 string or a JSON byte array) and sends a signed
// SOL or SPL-token transfer to the player's wallet. Withdrawals are DISABLED
// unless the secret is set — the rest of the casino still works without it.

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import { getCurrency } from "@metricbase/shared";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

let cachedKeypair: Keypair | null | undefined;

/** Parse HOUSE_WALLET_SECRET (bs58 or JSON array) into a Keypair, cached. */
function getHouseKeypair(): Keypair | null {
  if (cachedKeypair !== undefined) return cachedKeypair;
  const raw = process.env.HOUSE_WALLET_SECRET?.trim();
  if (!raw) {
    cachedKeypair = null;
    return null;
  }
  try {
    let bytes: Uint8Array;
    if (raw.startsWith("[")) {
      bytes = Uint8Array.from(JSON.parse(raw) as number[]);
    } else {
      bytes = bs58.decode(raw);
    }
    cachedKeypair = Keypair.fromSecretKey(bytes);
  } catch (error) {
    console.error("[casino] Failed to parse HOUSE_WALLET_SECRET:", error);
    cachedKeypair = null;
  }
  return cachedKeypair;
}

/** The house public address, if the signer is configured. */
export function getHouseWalletAddress(): string | null {
  return getHouseKeypair()?.publicKey.toBase58() ?? null;
}

export function isWithdrawEnabled(): boolean {
  return getHouseKeypair() !== null;
}

export interface PayoutResult {
  ok: boolean;
  signature?: string;
  error?: string;
}

/**
 * Send `baseUnits` of `currencyId` from the house wallet to `toWallet`.
 * Confirms the transaction before returning success.
 */
export async function sendPayout(
  toWallet: string,
  currencyId: string,
  baseUnits: number,
): Promise<PayoutResult> {
  const house = getHouseKeypair();
  if (!house) return { ok: false, error: "Withdrawals are not available right now." };
  if (!Number.isInteger(baseUnits) || baseUnits <= 0) return { ok: false, error: "Invalid amount." };

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(toWallet);
  } catch {
    return { ok: false, error: "Invalid destination wallet." };
  }

  const currency = getCurrency(currencyId);
  const connection = new Connection(getRpcUrl(), "confirmed");

  try {
    const tx = new Transaction();

    if (currency.native) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: house.publicKey,
          toPubkey: recipient,
          lamports: baseUnits,
        }),
      );
    } else {
      if (!currency.mint) return { ok: false, error: "Currency is misconfigured." };
      const mint = new PublicKey(currency.mint);
      const fromAta = await getAssociatedTokenAddress(mint, house.publicKey);
      const toAta = await getAssociatedTokenAddress(mint, recipient);

      // Create the recipient's token account if they don't have one yet (house pays rent).
      const toAccount = await connection.getAccountInfo(toAta);
      if (!toAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(house.publicKey, toAta, recipient, mint),
        );
      }
      tx.add(createTransferInstruction(fromAta, toAta, house.publicKey, baseUnits));
    }

    const signature = await sendAndConfirmTransaction(connection, tx, [house], {
      commitment: "confirmed",
    });
    return { ok: true, signature };
  } catch (error) {
    console.error("[casino] Payout failed:", error);
    return { ok: false, error: "The payout transaction failed. Your balance was not changed." };
  }
}
