// MetricBase DAO API (see shared/src/dao.ts for the governance design).
// Off-chain, gasless token-weighted polls: creation gated at 10M $BASE,
// voting at 1M; a vote's weight is the wallet's live balance when cast.

import {
  DAO_DESCRIPTION_MAX,
  DAO_MAX_DURATION_DAYS,
  DAO_MAX_OPEN_POLLS_PER_WALLET,
  DAO_MAX_OPTIONS,
  DAO_MIN_CREATE_BALANCE,
  DAO_MIN_DURATION_DAYS,
  DAO_MIN_OPTIONS,
  DAO_MIN_VOTE_BALANCE,
  DAO_MAX_DELEGATORS_COUNTED,
  DAO_OPTION_MAX,
  DAO_TITLE_MAX,
  type DaoActionResponse,
  type DaoDelegationStatus,
  type DaoPoll,
  type DaoPollsResponse,
} from "@metricbase/shared";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getWalletFromAuthHeader, requireAuth, type AuthenticatedRequest } from "../auth/requireAuth.js";
import { loadCharacterByWallet } from "../db/characters.js";
import { getPool } from "../db/pool.js";
import { getGuildForMember } from "../guild/guildRegistry.js";
import { getWalletTokenBalance } from "../solana/tokenBalance.js";

export const daoRouter = Router();

interface PollRow {
  id: string;
  creator_wallet: string;
  title: string;
  description: string;
  options: string[];
  created_at: Date;
  ends_at: Date;
}

const clean = (raw: string, max: number): string =>
  raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

async function buildPolls(rows: PollRow[], wallet: string | null): Promise<DaoPoll[]> {
  const pool = getPool();
  if (!pool || rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const votes = await pool.query(
    `SELECT poll_id, option_index, SUM(weight) weight, COUNT(*) voters FROM dao_votes
     WHERE poll_id = ANY($1) GROUP BY poll_id, option_index`,
    [ids],
  );
  const mine = wallet
    ? await pool.query(
        "SELECT poll_id, option_index, weight, via_delegation FROM dao_votes WHERE wallet = $1 AND poll_id = ANY($2)",
        [wallet, ids],
      )
    : null;
  const myByPoll = new Map<string, { option: number; weight: number; viaDelegation: boolean }>(
    (mine?.rows ?? []).map((r) => [
      r.poll_id as string,
      { option: Number(r.option_index), weight: Number(r.weight), viaDelegation: !!r.via_delegation },
    ]),
  );
  return rows.map((row) => {
    const options = Array.isArray(row.options) ? row.options.map(String) : [];
    const totals = options.map(() => 0);
    let voters = 0;
    for (const v of votes.rows.filter((v) => v.poll_id === row.id)) {
      const idx = Number(v.option_index);
      if (idx >= 0 && idx < totals.length) totals[idx] = Number(v.weight) || 0;
      voters += Number(v.voters) || 0;
    }
    const my = myByPoll.get(row.id);
    return {
      id: row.id,
      creatorWallet: row.creator_wallet,
      title: row.title,
      description: row.description,
      options,
      createdAt: row.created_at.getTime(),
      endsAt: row.ends_at.getTime(),
      totals,
      voters,
      ...(my ? { myVote: my.option, myWeight: my.weight, myViaDelegation: my.viaDelegation } : {}),
    };
  });
}

/** The wallet's character's guild (via the in-memory guild registry), if any. */
async function guildFor(wallet: string) {
  const character = await loadCharacterByWallet(wallet);
  if (!character) return null;
  const guild = getGuildForMember(character.name);
  return guild ? { guild, characterName: character.name } : null;
}

/** All polls (open first, newest first), with the caller's vote + live balance. */
daoRouter.get("/dao/polls", async (req, res) => {
  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: "Database unavailable" });
  const wallet = getWalletFromAuthHeader(req.headers.authorization);
  try {
    const rows = await pool.query<PollRow>(
      `SELECT id, creator_wallet, title, description, options, created_at, ends_at
       FROM dao_polls ORDER BY (ends_at > NOW()) DESC, created_at DESC LIMIT 100`,
    );
    const polls = await buildPolls(rows.rows, wallet);
    const payload: DaoPollsResponse = { polls };
    if (wallet) {
      try {
        payload.balance = await getWalletTokenBalance(wallet);
      } catch {
        /* RPC hiccup — the page just hides the balance chip */
      }
    }
    res.json(payload);
  } catch (error) {
    console.warn("[dao] poll list failed:", error);
    res.status(500).json({ error: "Failed to load polls." });
  }
});

/** Create a poll. Requires a signed-in wallet holding ≥ 10M $BASE. */
daoRouter.post("/dao/polls", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const pool = getPool();
  if (!pool) return void res.status(503).json({ ok: false, error: "Database unavailable" });

  const title = clean(String(req.body?.title ?? ""), DAO_TITLE_MAX);
  const description = clean(String(req.body?.description ?? ""), DAO_DESCRIPTION_MAX);
  const rawOptions = Array.isArray(req.body?.options) ? (req.body.options as unknown[]) : [];
  const options = rawOptions.map((o) => clean(String(o ?? ""), DAO_OPTION_MAX)).filter(Boolean);
  const days = Math.round(Number(req.body?.durationDays ?? 0));

  const fail = (status: number, error: string) =>
    void res.status(status).json({ ok: false, error } satisfies DaoActionResponse);
  if (!title) return fail(400, "A poll title is required.");
  if (options.length < DAO_MIN_OPTIONS || options.length > DAO_MAX_OPTIONS) {
    return fail(400, `Polls need ${DAO_MIN_OPTIONS}–${DAO_MAX_OPTIONS} options.`);
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return fail(400, "Poll options must be distinct.");
  }
  if (!Number.isFinite(days) || days < DAO_MIN_DURATION_DAYS || days > DAO_MAX_DURATION_DAYS) {
    return fail(400, `Poll duration must be ${DAO_MIN_DURATION_DAYS}–${DAO_MAX_DURATION_DAYS} days.`);
  }

  try {
    const open = await pool.query(
      "SELECT COUNT(*)::int n FROM dao_polls WHERE creator_wallet = $1 AND ends_at > NOW()",
      [wallet],
    );
    if (Number(open.rows[0]?.n ?? 0) >= DAO_MAX_OPEN_POLLS_PER_WALLET) {
      return fail(429, `You already have ${DAO_MAX_OPEN_POLLS_PER_WALLET} open polls — wait for one to close.`);
    }
    const balance = await getWalletTokenBalance(wallet);
    if (balance < DAO_MIN_CREATE_BALANCE) {
      return fail(403, `Creating a poll requires ${DAO_MIN_CREATE_BALANCE.toLocaleString()} $BASE (you hold ${Math.floor(balance).toLocaleString()}).`);
    }
    const id = randomUUID();
    const inserted = await pool.query<PollRow>(
      `INSERT INTO dao_polls (id, creator_wallet, title, description, options, ends_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(days => $6))
       RETURNING id, creator_wallet, title, description, options, created_at, ends_at`,
      [id, wallet, title, description, JSON.stringify(options), days],
    );
    const [poll] = await buildPolls(inserted.rows, wallet);
    res.json({ ok: true, poll } satisfies DaoActionResponse);
  } catch (error) {
    console.warn("[dao] poll create failed:", error);
    fail(500, "Failed to create the poll.");
  }
});

/** The signed-in wallet's guild-delegation state. */
daoRouter.get("/dao/delegation", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: "Database unavailable" });
  try {
    const membership = await guildFor(wallet);
    if (!membership) {
      return void res.json({ inGuild: false, delegated: false } satisfies DaoDelegationStatus);
    }
    const { guild, characterName } = membership;
    const isLeader = guild.leaderName === characterName;
    const mine = await pool.query("SELECT guild_id FROM dao_delegations WHERE wallet = $1", [wallet]);
    const status: DaoDelegationStatus = {
      inGuild: true,
      guildName: guild.name,
      guildTag: guild.tag,
      isLeader,
      delegated: mine.rows[0]?.guild_id === guild.id,
    };
    if (isLeader) {
      const count = await pool.query("SELECT COUNT(*)::int n FROM dao_delegations WHERE guild_id = $1", [guild.id]);
      status.delegators = Number(count.rows[0]?.n ?? 0);
    }
    res.json(status);
  } catch (error) {
    console.warn("[dao] delegation status failed:", error);
    res.status(500).json({ error: "Failed to load delegation." });
  }
});

/** Delegate (or revoke) the wallet's voting power to its guild. */
daoRouter.post("/dao/delegation", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const pool = getPool();
  if (!pool) return void res.status(503).json({ ok: false, error: "Database unavailable" });
  const delegate = !!req.body?.delegate;
  try {
    if (!delegate) {
      await pool.query("DELETE FROM dao_delegations WHERE wallet = $1", [wallet]);
      return void res.json({ ok: true } satisfies DaoActionResponse);
    }
    const membership = await guildFor(wallet);
    if (!membership) {
      return void res.status(400).json({ ok: false, error: "Join a guild in-game first — delegation hands your voting power to your guild." });
    }
    if (membership.guild.leaderName === membership.characterName) {
      return void res.status(400).json({ ok: false, error: "You lead this guild — your vote already speaks for it. Guildmates delegate to you." });
    }
    await pool.query(
      `INSERT INTO dao_delegations (wallet, guild_id) VALUES ($1, $2)
       ON CONFLICT (wallet) DO UPDATE SET guild_id = $2, created_at = NOW()`,
      [wallet, membership.guild.id],
    );
    res.json({ ok: true } satisfies DaoActionResponse);
  } catch (error) {
    console.warn("[dao] delegation change failed:", error);
    res.status(500).json({ ok: false, error: "Failed to update delegation." });
  }
});

/** Cast a vote. Requires ≥ 1M $BASE; weight = live balance; one vote, final. */
daoRouter.post("/dao/polls/:id/vote", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const pool = getPool();
  if (!pool) return void res.status(503).json({ ok: false, error: "Database unavailable" });
  const pollId = String(req.params.id ?? "");
  const optionIndex = Math.round(Number(req.body?.optionIndex ?? -1));
  const fail = (status: number, error: string) =>
    void res.status(status).json({ ok: false, error } satisfies DaoActionResponse);

  try {
    const found = await pool.query<PollRow>(
      `SELECT id, creator_wallet, title, description, options, created_at, ends_at
       FROM dao_polls WHERE id = $1`,
      [pollId],
    );
    const row = found.rows[0];
    if (!row) return fail(404, "Poll not found.");
    if (row.ends_at.getTime() <= Date.now()) return fail(400, "This poll has ended.");
    const optionCount = Array.isArray(row.options) ? row.options.length : 0;
    if (optionIndex < 0 || optionIndex >= optionCount) return fail(400, "Pick a valid option.");

    // A wallet that delegated to its guild votes through its leader, not
    // directly (stale delegations — left the guild — are cleaned up here).
    const membership = await guildFor(wallet);
    const myDelegation = await pool.query("SELECT guild_id FROM dao_delegations WHERE wallet = $1", [wallet]);
    const delegatedGuildId = myDelegation.rows[0]?.guild_id as string | undefined;
    if (delegatedGuildId) {
      if (membership && membership.guild.id === delegatedGuildId) {
        return fail(403, `You've delegated your voting power to ${membership.guild.name} — its leader votes for you. Revoke the delegation to vote yourself.`);
      }
      await pool.query("DELETE FROM dao_delegations WHERE wallet = $1", [wallet]);
    }

    const balance = await getWalletTokenBalance(wallet);
    if (balance < DAO_MIN_VOTE_BALANCE) {
      return fail(403, `Voting requires ${DAO_MIN_VOTE_BALANCE.toLocaleString()} $BASE (you hold ${Math.floor(balance).toLocaleString()}).`);
    }
    // One vote per wallet, final — ON CONFLICT DO NOTHING + rowCount tells us
    // whether this was a duplicate without a read-then-write race.
    const insert = await pool.query(
      `INSERT INTO dao_votes (poll_id, wallet, option_index, weight)
       VALUES ($1, $2, $3, $4) ON CONFLICT (poll_id, wallet) DO NOTHING`,
      [pollId, wallet, optionIndex, balance],
    );
    if ((insert.rowCount ?? 0) === 0) return fail(409, "You already voted on this poll — votes are final.");

    // Guild leader: also cast each delegator's live balance for the same
    // option, as that delegator's own vote row — voter counts stay honest and
    // the (poll, wallet) primary key makes double-counting impossible.
    let delegatesCounted = 0;
    if (membership && membership.guild.leaderName === membership.characterName) {
      const delegations = await pool.query(
        "SELECT wallet FROM dao_delegations WHERE guild_id = $1 AND wallet <> $2 LIMIT $3",
        [membership.guild.id, wallet, DAO_MAX_DELEGATORS_COUNTED],
      );
      const delegatorWallets = delegations.rows.map((r) => r.wallet as string);
      if (delegatorWallets.length > 0) {
        // Still-a-member check in one query: wallet -> character name.
        const chars = await pool.query(
          "SELECT wallet_address, name FROM characters WHERE wallet_address = ANY($1)",
          [delegatorWallets],
        );
        const memberNames = new Set(membership.guild.members);
        for (const c of chars.rows) {
          if (!memberNames.has(c.name as string)) continue;
          try {
            const w = c.wallet_address as string;
            const delegatorBalance = await getWalletTokenBalance(w);
            if (delegatorBalance <= 0) continue;
            const cast = await pool.query(
              `INSERT INTO dao_votes (poll_id, wallet, option_index, weight, via_delegation)
               VALUES ($1, $2, $3, $4, true) ON CONFLICT (poll_id, wallet) DO NOTHING`,
              [pollId, w, optionIndex, delegatorBalance],
            );
            if ((cast.rowCount ?? 0) > 0) delegatesCounted++;
          } catch {
            /* one delegator's RPC hiccup shouldn't sink the leader's vote */
          }
        }
      }
    }

    const [poll] = await buildPolls([row], wallet);
    res.json({ ok: true, poll, delegatesCounted } satisfies DaoActionResponse);
  } catch (error) {
    console.warn("[dao] vote failed:", error);
    fail(500, "Failed to record the vote.");
  }
});
