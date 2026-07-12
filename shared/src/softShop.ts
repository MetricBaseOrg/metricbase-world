// The Quartermaster — spends soft currencies (Honor / Guild Coin / Gems) on
// goods. The earn side lives in softCurrencies.ts; this is the sink.

import type { SoftCurrencyId } from "./softCurrencies.js";

export interface SoftShopOffer {
  id: string;
  currency: SoftCurrencyId;
  cost: number;
  itemId: string;
  quantity: number;
  /** Short pitch shown under the item name. */
  blurb: string;
}

export const SOFT_SHOP_OFFERS: SoftShopOffer[] = [
  // Honor — the PvP staple supplies.
  { id: "honor_potion", currency: "honor", cost: 60, itemId: "item_health_potion", quantity: 5, blurb: "Battle medkit." },
  { id: "honor_salmon", currency: "honor", cost: 50, itemId: "item_grilled_salmon", quantity: 3, blurb: "Hearty field rations." },
  { id: "honor_gemstone", currency: "honor", cost: 150, itemId: "item_gemstone", quantity: 1, blurb: "A spoil of war." },

  // Guild Coin — bulk crafting stock for guild members.
  { id: "guild_steel", currency: "guildCoin", cost: 60, itemId: "item_steel_bar", quantity: 3, blurb: "Guild forge surplus." },
  { id: "guild_plank", currency: "guildCoin", cost: 40, itemId: "item_hardwood_plank", quantity: 5, blurb: "Seasoned timber." },

  // Gems — premium, hard-to-get rewards.
  { id: "gem_gemstone", currency: "gems", cost: 8, itemId: "item_gemstone", quantity: 3, blurb: "Cut and polished." },
  { id: "gem_blade", currency: "gems", cost: 20, itemId: "item_gem_blade", quantity: 1, blurb: "Gemforged steel blade." },
  { id: "gem_steed", currency: "gems", cost: 15, itemId: "item_steed", quantity: 1, blurb: "A swift warhorse." },
  { id: "gem_wolf", currency: "gems", cost: 35, itemId: "item_dire_wolf", quantity: 1, blurb: "The fastest mount alive." },

  // Pets — cosmetic companions.
  { id: "gem_pet_slime", currency: "gems", cost: 8, itemId: "item_pet_slime", quantity: 1, blurb: "A bouncy companion." },
  { id: "gem_pet_cat", currency: "gems", cost: 12, itemId: "item_pet_cat", quantity: 1, blurb: "A cosy lodge kitten." },
  { id: "gem_pet_owl", currency: "gems", cost: 18, itemId: "item_pet_owl", quantity: 1, blurb: "A wise spirit owl." },
  { id: "gem_pet_penguin", currency: "gems", cost: 15, itemId: "item_pet_penguin", quantity: 1, blurb: "Bun, the waddling wonder." },
];

export function getSoftOffer(id: string): SoftShopOffer | undefined {
  return SOFT_SHOP_OFFERS.find((offer) => offer.id === id);
}

export interface SoftShopResultPayload {
  ok: boolean;
  error?: string;
}
