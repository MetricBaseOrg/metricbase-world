const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengeEntry {
  wallet: string;
  message: string;
  expiresAt: number;
}

const challenges = new Map<string, ChallengeEntry>();

export function createChallenge(wallet: string): ChallengeEntry {
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const message = [
    "MetricBase World Login",
    `Wallet: ${wallet}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    `Nonce: ${crypto.randomUUID()}`,
  ].join("\n");

  const entry = { wallet, message, expiresAt };
  challenges.set(wallet, entry);
  return entry;
}

export function consumeChallenge(wallet: string, message: string): boolean {
  const entry = challenges.get(wallet);
  if (!entry) return false;
  challenges.delete(wallet);

  if (entry.message !== message) return false;
  if (Date.now() > entry.expiresAt) return false;

  return true;
}