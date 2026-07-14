// MetricBase DAO: $BASE-holder governance polls at /dao.
//
// Design (see the DAO research notes in the v0.137.0 release): linear
// token-weighted voting — one $BASE = one vote unit. Votes are off-chain and
// gasless (Snapshot-style): the wallet signs in via the existing challenge
// flow, and the server reads the wallet's LIVE on-chain balance at action
// time. A vote's weight is frozen when it's cast (moving tokens afterwards
// doesn't change a recorded vote), and each wallet votes once per poll with
// no re-votes — the pragmatic mitigations available without historical
// balance snapshots.

/** Minimum $BASE (UI amount) a wallet must hold to create a poll. */
export const DAO_MIN_CREATE_BALANCE = 10_000_000;
/** Minimum $BASE (UI amount) a wallet must hold to vote. */
export const DAO_MIN_VOTE_BALANCE = 1_000_000;

export const DAO_TITLE_MAX = 100;
export const DAO_DESCRIPTION_MAX = 1000;
export const DAO_OPTION_MAX = 60;
export const DAO_MIN_OPTIONS = 2;
export const DAO_MAX_OPTIONS = 6;
/** Poll duration bounds, in days. */
export const DAO_MIN_DURATION_DAYS = 1;
export const DAO_MAX_DURATION_DAYS = 14;
export const DAO_DEFAULT_DURATION_DAYS = 7;
/** Open polls one wallet may have at once (spam guard). */
export const DAO_MAX_OPEN_POLLS_PER_WALLET = 3;

export interface DaoPoll {
  id: string;
  creatorWallet: string;
  title: string;
  description: string;
  options: string[];
  createdAt: number;
  endsAt: number;
  /** Summed vote weight ($BASE UI amount) per option, aligned with options. */
  totals: number[];
  /** Number of wallets that voted. */
  voters: number;
  /** The requesting wallet's vote (option index), if it cast one. */
  myVote?: number;
  /** The weight the requesting wallet's vote was recorded with. */
  myWeight?: number;
  /** True when the wallet's vote was cast by its guild leader via delegation. */
  myViaDelegation?: boolean;
}

export interface DaoPollsResponse {
  polls: DaoPoll[];
  /** The requesting wallet's live $BASE balance (present when signed in). */
  balance?: number;
}

export interface DaoActionResponse {
  ok: boolean;
  error?: string;
  poll?: DaoPoll;
  /** On a guild leader's vote: how many delegators' power was cast alongside. */
  delegatesCounted?: number;
}

/** Most delegators counted per leader vote (bounds the per-vote RPC fan-out). */
export const DAO_MAX_DELEGATORS_COUNTED = 50;

/** GET /api/dao/delegation — the signed-in wallet's guild-delegation state. */
export interface DaoDelegationStatus {
  /** Wallet has a character that's currently in a guild. */
  inGuild: boolean;
  guildName?: string;
  guildTag?: string;
  /** The wallet's character leads that guild (leaders vote FOR the guild). */
  isLeader?: boolean;
  /** This wallet has delegated its voting power to its guild. */
  delegated: boolean;
  /** For leaders: how many wallets currently delegate to their guild. */
  delegators?: number;
}

export function isDaoPollOpen(poll: Pick<DaoPoll, "endsAt">, now: number): boolean {
  return now < poll.endsAt;
}
