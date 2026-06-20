import {
  addItemToInventory,
  buildInventoryPayload,
  getTokenShopProduct,
  METRICBASE_TOKEN_MINT,
  normalizeInventory,
  STARTING_GOLD,
  type InventoryEntry,
  type TokenShopResultPayload,
} from "@metricbase/shared";
import { isPurchaseRedeemed, recordTokenPurchase } from "../db/tokenPurchases.js";
import { getWalletTokenBalance } from "../solana/tokenBalance.js";
import { getTreasuryWallet, verifyMetricbaseTokenTransfer } from "../solana/verifyTokenTransfer.js";

export interface TokenShopGrantState {
  gold: number;
  inventory: InventoryEntry[];
}

export async function redeemTokenShopPurchase(
  wallet: string,
  productId: string,
  signature: string,
  state: TokenShopGrantState,
): Promise<TokenShopResultPayload> {
  const treasury = getTreasuryWallet();
  if (!treasury) {
    return { ok: false, error: "Token shop is not configured yet." };
  }

  if (!wallet || !productId || !signature) {
    return { ok: false, error: "Missing purchase details." };
  }

  let product;
  try {
    product = getTokenShopProduct(productId);
  } catch {
    return { ok: false, error: "Unknown product." };
  }

  if (await isPurchaseRedeemed(signature)) {
    return { ok: false, error: "This transaction was already redeemed." };
  }

  const verification = await verifyMetricbaseTokenTransfer(signature, {
    payerWallet: wallet,
    treasuryWallet: treasury,
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    minUiAmount: product.tokenPrice,
  });

  if (!verification.ok) {
    return { ok: false, error: verification.error ?? "Token payment verification failed." };
  }

  let gold = state.gold;
  let inventory = normalizeInventory(state.inventory);

  if (product.grants.gold) {
    gold += product.grants.gold;
  }

  if (product.grants.items) {
    for (const grant of product.grants.items) {
      const result = addItemToInventory(inventory, grant.itemId, grant.quantity);
      inventory = result.inventory;
      if (result.added < grant.quantity) {
        return { ok: false, error: "Inventory full — make space and contact support if charged." };
      }
    }
  }

  await recordTokenPurchase(signature, wallet, productId, product.tokenPrice);

  let tokenBalance: number | null = null;
  try {
    tokenBalance = await getWalletTokenBalance(wallet);
  } catch {
    tokenBalance = null;
  }

  return {
    ok: true,
    gold,
    inventory: buildInventoryPayload(inventory),
    tokenBalance,
  };
}

export function defaultGrantState(savedGold?: number, savedInventory?: InventoryEntry[]): TokenShopGrantState {
  return {
    gold: savedGold ?? STARTING_GOLD,
    inventory: normalizeInventory(savedInventory),
  };
}