import crypto from "node:crypto";
import { Router } from "express";
import { isTelegramLoginConfigured } from "../auth/telegramAuth.js";

/**
 * The Telegram bot itself — the front door for anyone who finds
 * @MetricBaseWorldBot rather than a direct Mini App link.
 *
 * Until now the bot had no backend at all: /start did nothing and there was no
 * menu button, so a player who opened the bot chat saw a description and had no
 * way to reach the game. The Mini App only worked if you already had the
 * t.me/<bot>/play URL — which defeats the point of being discoverable.
 *
 * Everything here is set up by the server on boot (menu button, commands,
 * webhook), so there is no manual BotFather step to forget or get wrong.
 */

const PLAY_URL = "https://world.metricbase.org/play";
const INVITE_CODE_RE = /^INV-[0-9A-Z]{4}-[0-9A-Z]{4}$/i;

export const telegramBotRouter = Router();

function api(method: string): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function callBotApi(method: string, body: unknown): Promise<unknown> {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!data.ok) console.warn(`[telegram-bot] ${method} failed:`, data.description ?? res.status);
  return data;
}

/**
 * Shared secret proving an update really came from Telegram. Derived from the
 * bot token so it needs no extra configuration, and hashed so the token itself
 * is never sent in a header.
 */
function webhookSecret(): string {
  return crypto
    .createHash("sha256")
    .update(`mb-webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`)
    .digest("hex")
    .slice(0, 48);
}

interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { first_name?: string };
  };
}

telegramBotRouter.post("/telegram/webhook", async (req, res) => {
  // Reject anything that can't prove it came from Telegram. Answer 200 anyway:
  // a non-2xx makes Telegram retry, and we don't want to retry forgeries.
  if (req.header("X-Telegram-Bot-Api-Secret-Token") !== webhookSecret()) {
    res.status(200).json({ ok: true });
    return;
  }
  res.status(200).json({ ok: true }); // ack immediately; Telegram retries on delay

  try {
    const update = req.body as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    const text = String(update.message?.text ?? "").trim();
    if (!chatId || !text.startsWith("/start")) return;

    // `/start INV-1234-ABCD` — a referral link. Carry the code into the game so
    // the invite survives, exactly like the Mini App's `startapp` payload.
    const payload = text.split(/\s+/)[1] ?? "";
    const invite = INVITE_CODE_RE.test(payload) ? payload.toUpperCase() : null;
    const url = invite ? `${PLAY_URL}?invite=${encodeURIComponent(invite)}&src=tg` : PLAY_URL;

    const name = update.message?.from?.first_name?.trim();
    await callBotApi("sendMessage", {
      chat_id: chatId,
      text:
        `${name ? `Welcome, ${name}! ` : "Welcome! "}🌍\n\n` +
        "MetricBase World is a living, player-run economy on Solana — gather, craft, farm, " +
        "trade and fight alongside everyone else.\n\n" +
        "🎮 *Free to play.* No wallet and no tokens needed to start.\n" +
        "🏆 Compete in the Season for a share of the $BASE prize pool.\n" +
        (invite ? "\n🎟️ Your invite code is attached — your friend gets credit once you reach level 3.\n" : "") +
        "\nTap below to jump in.",
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🎮 Play MetricBase World", web_app: { url } }]] },
    });
  } catch (error) {
    console.warn("[telegram-bot] update handling failed:", error);
  }
});

/**
 * Configure the bot on boot: a permanent Play button beside the message box,
 * the /start command, and the webhook pointing back here. Idempotent — Telegram
 * treats each as "set to this value", so repeated deploys are harmless.
 */
export async function setupTelegramBot(): Promise<void> {
  if (!isTelegramLoginConfigured()) return;

  const host = process.env.RAILWAY_PUBLIC_DOMAIN ?? process.env.PUBLIC_SERVER_HOST;
  if (!host) {
    console.warn("[telegram-bot] no public host known — skipping webhook registration.");
    return;
  }

  try {
    // The menu button is what the screenshot was missing: without it the bot
    // chat offers no route into the game at all.
    await callBotApi("setChatMenuButton", {
      menu_button: { type: "web_app", text: "🎮 Play", web_app: { url: PLAY_URL } },
    });
    await callBotApi("setMyCommands", {
      commands: [{ command: "start", description: "Play MetricBase World" }],
    });
    await callBotApi("setWebhook", {
      url: `https://${host}/api/telegram/webhook`,
      secret_token: webhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    console.log(`[telegram-bot] configured — menu button, /start, webhook → ${host}`);
  } catch (error) {
    console.warn("[telegram-bot] setup failed:", error);
  }
}
