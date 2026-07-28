import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { pickWalletConnector } from "./discovery";

/**
 * A payment we refused to send, because we could see it would fail.
 *
 * Without this the wallet is the one that reports the problem, and what it says
 * is "Simulation failed. This transaction will likely fail even if submitted
 * on-chain." — which names no cause and offers no action. Since the game went
 * free-to-play (v0.172.0) most wallets hold no $BASE at all, so the commonest
 * reason to open a chest and fail is simply having none, and that deserves a
 * sentence a human wrote.
 */
export class TokenPaymentError extends Error {
  readonly kind: "no-tokens" | "insufficient-tokens" | "no-sol";
  /** UI amount the player holds, for the message. */
  readonly have: number;
  /** UI amount the payment needs. */
  readonly need: number;

  constructor(message: string, kind: TokenPaymentError["kind"], have = 0, need = 0) {
    super(message);
    this.name = "TokenPaymentError";
    this.kind = kind;
    this.have = have;
    this.need = need;
  }
}

export function isTokenPaymentError(error: unknown): error is TokenPaymentError {
  return error instanceof TokenPaymentError;
}

/** Where to send someone who needs $BASE. */
export function jupiterSwapUrl(mint: string): string {
  return `https://jup.ag/swap/So11111111111111111111111111111111111111112-${mint.trim()}`;
}

/** Lamports to keep for fees. A transfer costs ~5k; an ATA creation adds ~2.04M
 *  rent, so the floor depends on whether we're creating the recipient's. */
const FEE_FLOOR_LAMPORTS = 300_000;
const ATA_RENT_LAMPORTS = 2_100_000;

export async function sendMetricbaseTokenPayment(options: {
  payerWallet: string;
  recipientWallet: string;
  mint: string;
  uiAmount: number;
  decimals: number;
  rpcUrl: string;
}): Promise<string> {
  const wallet = pickWalletConnector();
  if (!wallet) {
    throw new Error("Connect your wallet to pay with tokens.");
  }

  const payer = new PublicKey(options.payerWallet);
  const recipient = new PublicKey(options.recipientWallet);
  const mint = new PublicKey(options.mint);
  const connection = new Connection(options.rpcUrl, "confirmed");

  // BASE is a Token-2022 mint, so the ATA derivation and every instruction must
  // use the program that actually owns the mint — not the default SPL Token
  // program (which fails with IncorrectProgramId). Detect it from the mint owner.
  let tokenProgramId = TOKEN_PROGRAM_ID;
  try {
    const mintAccount = await connection.getAccountInfo(mint);
    if (mintAccount?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      tokenProgramId = TOKEN_2022_PROGRAM_ID;
    }
  } catch {
    // Fall back to the standard token program if the lookup fails.
  }

  const payerAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgramId);
  const recipientAta = await getAssociatedTokenAddress(mint, recipient, false, tokenProgramId);

  // Use the mint's ACTUAL on-chain decimals as the source of truth. Trusting a
  // configured/cached decimals value caused transfers to be scaled by the wrong
  // power of ten (e.g. sending 100,000,000,000 instead of 100,000 tokens).
  let decimals = options.decimals;
  try {
    decimals = (await getMint(connection, mint, undefined, tokenProgramId)).decimals;
  } catch {
    // Fall back to the configured decimals if the mint lookup fails.
  }
  const rawAmount = BigInt(Math.round(options.uiAmount * 10 ** decimals));

  const transaction = new Transaction();
  // getAccountInfo returns null when the account truly doesn't exist and only
  // throws on RPC/network errors. On an RPC error we assume the account exists,
  // so we never add a redundant create-ATA instruction that fails on-chain with
  // "account already in use".
  let recipientAccountExists = true;
  try {
    recipientAccountExists = (await connection.getAccountInfo(recipientAta)) !== null;
  } catch {
    recipientAccountExists = true;
  }

  if (!recipientAccountExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        recipientAta,
        recipient,
        mint,
        tokenProgramId,
      ),
    );
  }

  // ── Pre-flight ────────────────────────────────────────────────────────────
  // Everything below FAILS OPEN: if a lookup errors we proceed and let the
  // wallet decide. A flaky RPC must never block a payment that would have
  // worked — we're only trying to catch the cases we can prove are doomed.
  const uiOf = (raw: bigint) => Number(raw) / 10 ** decimals;

  try {
    // Read the balance FIRST. On a missing account this throws, which is the
    // signal we want; asking getAccountInfo alone is riskier, because some RPCs
    // answer null for an account that really exists, and a false "you have no
    // $BASE" would turn a paying customer away. Blocking a real payment is
    // worse than the confusing wallet error we're replacing, so a refusal here
    // has to survive TWO independent checks agreeing.
    let held: bigint | null = null;
    try {
      const balance = await connection.getTokenAccountBalance(payerAta);
      held = BigInt(balance.value.amount);
    } catch {
      // Either the account doesn't exist or the RPC failed. Confirm which.
      const payerTokenAccount = await connection.getAccountInfo(payerAta);
      if (payerTokenAccount === null) {
        throw new TokenPaymentError(
          `You don't have any $BASE yet. This costs ${options.uiAmount.toLocaleString()} $BASE.`,
          "no-tokens",
          0,
          options.uiAmount,
        );
      }
      // The account exists but the balance read failed — don't guess, let the
      // wallet decide.
      held = null;
    }

    if (held !== null && held < rawAmount) {
      throw new TokenPaymentError(
        `Not enough $BASE. This costs ${options.uiAmount.toLocaleString()} and you have ` +
          `${uiOf(held).toLocaleString(undefined, { maximumFractionDigits: 2 })}.`,
        "insufficient-tokens",
        uiOf(held),
        options.uiAmount,
      );
    }
  } catch (error) {
    if (isTokenPaymentError(error)) throw error;
    // Lookup failed — carry on and let the wallet be the judge.
  }

  try {
    const lamports = await connection.getBalance(payer);
    const needed = FEE_FLOOR_LAMPORTS + (recipientAccountExists ? 0 : ATA_RENT_LAMPORTS);
    if (lamports < needed) {
      throw new TokenPaymentError(
        `You need a little SOL to pay the network fee — about ` +
          `${(needed / LAMPORTS_PER_SOL).toFixed(3)} SOL. Your wallet has ` +
          `${(lamports / LAMPORTS_PER_SOL).toFixed(4)}.`,
        "no-sol",
        lamports / LAMPORTS_PER_SOL,
        needed / LAMPORTS_PER_SOL,
      );
    }
  } catch (error) {
    if (isTokenPaymentError(error)) throw error;
    // Same: fail open.
  }

  // Checked transfer carries the mint + decimals so the wallet shows the real
  // token amount (e.g. "100,000 BASE") instead of the raw base-unit count, and
  // the chain rejects any decimals mismatch.
  transaction.add(
    createTransferCheckedInstruction(
      payerAta,
      mint,
      recipientAta,
      payer,
      rawAmount,
      decimals,
      [],
      tokenProgramId,
    ),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.signAndSendTransaction(transaction, connection);

  // Confirmation is best-effort ON PURPOSE. Once signAndSendTransaction returns,
  // the transaction is broadcast and the player's tokens are already committed —
  // so throwing here would lose the signature and with it any way to recover a
  // real payment. The SERVER is the authority anyway: it re-reads the
  // transaction from the chain (with retries) before crediting anything, and
  // rejects it properly if it truly failed. So we log and hand the signature
  // back either way, and let the caller stash it for retry.
  try {
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  } catch (error) {
    console.warn("[payment] confirmation did not complete; server will verify on-chain:", error);
  }
  return signature;
}