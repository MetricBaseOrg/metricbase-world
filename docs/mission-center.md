# Mission Center

The private operator console at **`/mission`**. One page that answers three
questions: did my ship land and is prod healthy, what is the game doing, and
what should I post next and did the last post work.

Server-rendered by the Railway backend (not the Vercel client), on purpose: it
has to work when the client build is the thing that's broken.

## Access

Email + password, deliberately separate from the game's wallet identity —
moderating shouldn't require being logged into the game with the treasury
wallet. One account: `axdermawan@gmail.com`.

The bootstrap password is **never committed** (this repo has a public remote; a
known default in git means whoever tries it first owns the console). On first
boot the server reads `MISSION_BOOTSTRAP_PASSWORD`, seeds the account with a
scrypt hash of it, and flags `must_change_password`. Nothing but the change
screen loads until a new password is set, and every other session is signed out
when it is. After that the env var can be deleted.

Guards: scrypt (`node:crypto`, no new dependency), row-backed session cookie
(HttpOnly, SameSite=Lax, 7 days), login rate limit of 5 attempts per 15 minutes
per IP *and* per email, a constant-time failure path so a wrong email and a wrong
password are indistinguishable, and a `mission_audit` row for every mutating
action.

## Environment

| Variable | Needed for | Without it |
|---|---|---|
| `MISSION_BOOTSTRAP_PASSWORD` | Seeding the account, once | `/mission` stays locked |
| `RAILWAY_API_TOKEN` | Server deploy history + log tail | Panel shows a hint; health and in-process logs still work |
| `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` | Client deploy history | Panel shows a hint |
| `MISSION_ADMIN_EMAIL` | Overriding the seeded email | Defaults to `axdermawan@gmail.com` |
| `MISSION_INSECURE_COOKIE=true` | Local HTTP testing only | Cookie is `Secure`, so localhost logins silently fail |

`RAILWAY_PROJECT_ID` / `SERVICE_ID` / `ENVIRONMENT_ID` / `DEPLOYMENT_ID` are
injected by Railway automatically — nothing to set in prod.

## Tabs

**🚀 Ops** — running version, uptime, DB latency, players online, p50/p95 and
5xx rate over a rolling 15-minute window, error count, memory. Then Railway and
Vercel deploy history, and a log viewer (in-process ring buffer, or a Railway
tail when the token is set).

The banner that matters: **the newest deploy FAILED and an older build is still
serving.** `railway.toml` documents a real incident where exactly that happened
— every deploy failing while the last good build served happily and `/health`
stayed green. Nothing surfaced it. Now something does.

**🎮 Game** — the same numbers `/stats` shows, laid out for an operator. It calls
the *shared* cached stats build (`getStatsCached`), never its own: an
uncached build is 54 queries, and duplicating that is what caused a
previous Neon compute bill.

**𝕏 Growth** — see below.

**🛡️ Admin** — bans (by character name or wallet; kicks live sessions via
`presence.kickPlayer`), season payout, X earn-task campaigns, and the audit log.
Executing a payout requires typing `PAY SEASON <n>` — a stray `execute: true`
must not be able to pay a season out.

## The X growth system

Neon is the source of truth. The planning markdown in `D:\OneDrive\metricbase-x`
was single-machine and unreachable from the server; it is now an archive.

**Import (run once, re-runnable):**

```bash
DATABASE_URL=… node scripts/import-x-content.mjs           # writes
node scripts/import-x-content.mjs --dry                    # parse only, no DB needed
```

Idempotent on the post ref (`#7`), and it never knocks a post you've already
marked posted back to "drafted". Point it at a Neon **branch** first — the parse
is heuristic by nature, since it reads prose written for a human.

Known quirks it handles: CRLF line endings, refs like `#4b`/`#4c` inserted
between numbered slots, `POSTED ✅` markers, `(SHIP POST · v0.205.2)` version
tags, and the six sections that are prose placeholders with no fenced block
(their prose is imported rather than dropped).

**Cadence.** Slots are `mon_economy` / `wed_build` / `fri_game` / `extra`. The
weekday *word* in a heading wins over the weekday computed from the date,
because the two disagree in the source: week 1 is labelled "Mon 28 Jul" but
2026-07-28 is a Tuesday. `slot_kind` describes intent; `slot_date` keeps the
literal date.

**Capture.** On every boot, any `DASHBOARD_UPDATES` version without a post gets
an `idea` row. The "you shipped this and never posted it" queue maintains itself
instead of depending on anyone remembering while the detail is still fresh.

**Metrics.** Impressions and engagement are hand-entered — X gives nothing away
free beyond oEmbed, and the alternatives are a $200/mo API tier or a
ToS-violating scraper. Paste a tab-separated row from X analytics and the fields
fill themselves. A tweet URL can be verified through the free
`publish.twitter.com/oembed` path (the same one the in-game X tasks use), which
confirms the author handle and returns the live text so drift from the planned
copy is visible.

**Evaluation.** The headline is **impressions → signups**, joined from
`x_posts.posted_at` to `characters.created_at` over a 48-hour window. The account
converts ~4,500 followers into ~54 players, so reach is not the scoreboard and a
post with 40k impressions and zero signups is the finding. Breakdowns by format,
slot and weekday are suppressed as "thin" under 6 measured posts rather than
implying a ranking exists.

**Copy guard.** Runs on drafts before they ship. Every rule exists because the
mistake actually reached players or the timeline:

- `gamble`/`gambling` — blocked; say roll, chance, odds, upside.
- `refundable` without `5%` — blocked; the season deposit stopped being fully
  refundable and the old promise survived in six places. A stale claim about
  money reads as a broken promise, not as history.
- "N players online now" — warned; post cumulative flow metrics, not
  point-in-time counts.
- Over 280 characters with no paragraph break — warned; split it into a thread.

## Deploying

Server-only — no `shared/` edit, so no `GAME_VERSION` bump and no restart that
drops players mid-session. `vercel.json` proxies `/mission`, `/mission/*` and
`/api/mission/*` to Railway; without those rewrites they fall through to the SPA,
which is the trap that silently broke the X OAuth callback once.
