# Telegram Mini App

P2 distribution, track 1. The game runs **unchanged** inside Telegram — Telegram
simply loads `https://world.metricbase.org/play` in a chromeless webview. No
separate build, no separate deploy. Everything below is already shipped in the
client; the only outstanding work is the BotFather setup in §1, which needs
your Telegram account.

## Why not a "real" Telegram game?

Telegram's native `sendGame` API is a leaderboard wrapper for HTML5 games — no
wallet, no persistent identity we can bond to. A **Mini App** is just our web
app in a webview, so the entire existing stack (Colyseus rooms, wallet-bonded
characters, the Season engine) works as-is.

## 1. BotFather setup — YOUR STEP

In [@BotFather](https://t.me/BotFather):

1. `/newbot` → name `MetricBase World`, username e.g. `MetricBaseWorldBot`.
   Save the token somewhere safe (we don't need it in the client — only if you
   later want server-side bot commands).
2. `/newapp` → pick the bot →
   - **Title:** `MetricBase World`
   - **Description:** `A living player-run economy on Solana. Gather, craft, trade, and compete for the Season prize pool.`
   - **Photo:** `assets/metricbase-world.png` (640×360)
   - **Web App URL:** `https://world.metricbase.org/play`
   - **Short name:** `play` ← must match `TELEGRAM_APP_SHORT_NAME` in
     `client/src/telegram/telegramApp.ts`
3. `/setmenubutton` → point the chat menu button at the same URL, so the bot
   chat itself has a persistent Play button.

Then set the bot username as a **Vercel environment variable** and redeploy:

```
VITE_TELEGRAM_BOT=MetricBaseWorldBot
```

Until that variable is set, every Telegram-specific CTA stays hidden — nothing
renders a link that would 404. The Mini App itself still works if opened from
Telegram (detection is URL-based, not env-based); the variable only controls
outbound links *into* Telegram.

## 2. The wallet problem, and how we solve it

Telegram's webview injects **no Solana provider** — same as a plain mobile
browser. `connect()` can never succeed in-app, on mobile *or* Telegram Desktop.

So the token gate deep-links out: when no provider is found and we're inside
Telegram (or a mobile browser), `LoginOverlay` shows **Open in Phantom /
Solflare**, which reopens `/play` inside the wallet's in-app browser where
connecting works normally. This reuses the `mobileWallet.ts` pattern already
proven on `/dao` and `/brands`.

Two consequences worth remembering:

- **The wallet's browser is a separate context.** localStorage does not carry
  across the hop. Anything the destination needs must ride in the URL — which
  is why `walletDeepLinkTarget()` preserves `?invite=` and strips Telegram's
  `tgWebApp*` launch hash.
- **`window.open` / `target="_blank"` / `location.href` to universal links are
  swallowed by the webview.** Use `openExternalLink()` from
  `telegram/telegramApp.ts` for anything outbound (wallets, Jupiter, X). Any
  *new* external link in the client needs the same treatment.

Players who never leave Telegram can still **spectate** — the v0.170.2
converting demo runs fine without a wallet, and its "Unlock full play" overlay
is what triggers the deep link.

## 3. Referral attribution — the viral loop

The whole point of shipping on Telegram is that invites spread in chats.

```
t.me/<bot>/play?startapp=INV-1234-ABCD
        ↓  Telegram passes it as initData.start_param
applyTelegramStartParam()   (main.tsx, synchronous at boot)
        ↓  history.replaceState → /play?invite=INV-1234-ABCD&src=tg
LoginOverlay's existing ?invite= reader prefills the code
        ↓  survives the hop to Phantom (it's in the URL)
saveCharacterAppearance(..., code) → validateAndUseInviteCode()
        ↓
awardSeasonPointsDb(inviter, "referral")   — 50 pts, the top category
```

Nothing on the server changed: `?invite=` was already the referral channel.
Telegram just became a new mouth for it.

Share entry points added:
- **InvitationsModal** — an ✈️ button per unused code, opening Telegram's
  native forward-to-chat sheet with a Mini App link carrying that code.
- **SeasonShareModal** — "Share to Telegram" alongside the existing X share.
- **LandingPage** — a "Play on Telegram" CTA.

`applyTelegramStartParam()` only accepts values matching `INV-XXXX-XXXX`, so a
malformed or hostile `startapp` can't inject arbitrary query params.

## 4. Testing

Telegram detection is URL-based, so you can exercise most of it in a normal
browser:

```
# Referral fold: should rewrite to ?invite=INV-1234-ABCD&src=tg
https://world.metricbase.org/play#tgWebAppPlatform=android&tgWebAppStartParam=INV-1234-ABCD

# Deep-link fallback: same URL in a mobile browser with no wallet extension
# → "Open in Phantom / Solflare" buttons appear under Connect Wallet
```

For the real thing, open the Mini App on a phone and confirm:
- the app expands to full height and vertical swipe does **not** dismiss it
  while dragging the D-pad (`disableVerticalSwipes`, Bot API 7.7+)
- Connect Wallet shows the Phantom/Solflare buttons, and tapping one lands in
  Phantom's browser **with the invite code still in the URL**
- Spectate works with no wallet at all

## 5. Not done / deliberate omissions

- **No server-side bot.** No `/start` command handler, no bot-sent
  notifications. The bot exists purely to host the Mini App. Adding push
  ("your crops are ready") would need the bot token server-side and a
  chat-id ↔ wallet mapping — a separate piece of work.
- **No Telegram-native payments or TON.** $BASE stays the only currency;
  Telegram Stars would be a second, non-interoperable rail.
- **initData is not verified server-side.** We only read `start_param` for a
  referral prefill, which the invite system already validates independently
  (unknown code → rejected; self-invite → rejected). If we ever grant anything
  based on *Telegram identity* itself, the initData HMAC must be checked
  against the bot token on the server first.
