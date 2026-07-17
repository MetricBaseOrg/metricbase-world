// Caravan runs — carry a sealed cargo satchel from one town's board to
// another's for a flat freight fee. Pure transport gameplay: the cargo is
// server-side state (not an inventory item), so it can't be vendored, traded,
// or duplicated. THE tunables table for the system.
//
// Economic rules (enforced in server/src/economy/townDemand.ts):
// - Freight fees are a GOLD FAUCET paid from the same per-town daily budget as
//   town orders (TOWN_ORDER_DAILY_GOLD_CAP) plus a per-player daily cap here.
// - HARD RULE: caravan types have NO $BASE field and never will — a $BASE-paid
//   hauling fee would be a laundered gold→$BASE conversion path.
// - Risk = reward: in red/black danger zones a hauler who dies DROPS the
//   cargo; whoever grabs the bag inherits the run (and the fee). Safe-zone
//   routes never drop cargo.

/** A fixed route between two towns. Fees are per completed run. */
export interface CaravanRoute {
  fromZone: string;
  toZone: string;
  /** Flat gold fee on delivery. Riskier/longer routes pay more. */
  feeGold: number;
}

/** Routes exist in both directions; fee reflects the DANGER along the way
 * (wilderness = yellow, grotto = red) and the number of portals crossed. */
export const CARAVAN_ROUTES: CaravanRoute[] = [
  { fromZone: "zone_hub", toZone: "zone_wilderness", feeGold: 90 },
  { fromZone: "zone_wilderness", toZone: "zone_hub", feeGold: 90 },
  { fromZone: "zone_wilderness", toZone: "zone_grotto", feeGold: 160 },
  { fromZone: "zone_grotto", toZone: "zone_wilderness", feeGold: 160 },
  { fromZone: "zone_hub", toZone: "zone_grotto", feeGold: 280 },
  { fromZone: "zone_grotto", toZone: "zone_hub", feeGold: 280 },
];

/** One cargo run at a time per player. */
export const CARAVAN_MAX_ACTIVE_PER_PLAYER = 1;
/** Gold a single player can earn from freight per UTC day. */
export const CARAVAN_PLAYER_DAILY_GOLD_CAP = 800;
/** Cooldown between completed runs (prevents alt relay trains). */
export const CARAVAN_COOLDOWN_MS = 90_000;
/** A run must be delivered within this window or the cargo spoils. */
export const CARAVAN_RUN_TTL_MS = 30 * 60_000;

/** Wire shape of a player's active run (or an offered route). */
export interface CaravanRunState {
  id: string;
  fromZone: string;
  fromLabel: string;
  toZone: string;
  toLabel: string;
  feeGold: number;
  /** When the cargo spoils (accepted runs only). */
  expiresAt: number;
}

export interface CaravanBoardPayload {
  /** Routes offered FROM the town the player is standing in (empty elsewhere). */
  offers: CaravanRunState[];
  /** The player's active run, if any. */
  active: CaravanRunState | null;
  /** Freight gold the player can still earn today. */
  playerDailyRemaining: number;
  /** Cooldown remaining before the player can accept another run (ms). */
  cooldownMs: number;
}

export interface CaravanResultPayload {
  ok: boolean;
  error?: string;
  /** Set on a successful delivery. */
  goldPaid?: number;
  /** Set when a run was accepted. */
  accepted?: CaravanRunState | null;
}
