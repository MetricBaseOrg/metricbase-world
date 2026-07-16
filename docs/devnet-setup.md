# Devnet Setup — Windows Runbook

One-time setup (~5 minutes, costs nothing) so the Company Coin / token-bridge
features can be built and verified end-to-end on Solana's free practice network
before any real SOL or $BASE is involved. See `docs/company-coin.md` and
`docs/token-bridge.md` for what gets built on top of this.

**Golden rules**

- The keypair file is a WALLET SECRET. Never commit it (`.gitignore` already
  blocks `*-authority.json` / `*-keypair.json` / `devnet-*.json`), never paste
  it into chat, never reuse it on mainnet.
- **Never point the PRODUCTION Railway service at devnet.** Devnet testing runs
  on a LOCAL server (or a separate Railway environment). Prod keeps its
  mainnet `SOLANA_RPC_URL` untouched.

## 1. Install the Solana CLI (Windows)

Open **PowerShell as Administrator** and run the official Anza installer:

```powershell
cmd /c "curl https://release.anza.xyz/stable/agave-install-init-x86_64-pc-windows-msvc.exe --output C:\agave-install-tmp\agave-install-init.exe --create-dirs"
C:\agave-install-tmp\agave-install-init.exe
```

Close and reopen the terminal, then verify:

```powershell
solana --version
```

(If `solana` isn't found, add `%USERPROFILE%\.local\share\solana\install\active_release\bin`
to your PATH.)

## 2. Create the devnet keypair

In a normal (non-admin) terminal, from a folder OUTSIDE the repo or the repo
root (the ignore rules cover it either way):

```powershell
solana-keygen new -o devnet-authority.json
```

- It will ask for an optional BIP39 passphrase — fine to leave empty for a
  devnet-only key.
- It prints the wallet's **pubkey** (the address) and a seed phrase. For a
  devnet key the seed phrase doesn't need ceremony, but don't lose the file.

## 3. Point the CLI at devnet + get free SOL

```powershell
solana config set --url https://api.devnet.solana.com
solana airdrop 2 (solana address -k devnet-authority.json)
solana balance (solana address -k devnet-authority.json)
```

Expect `2 SOL`. The airdrop faucet is rate-limited; if it fails, wait a minute
and retry, or use https://faucet.solana.com with the pubkey.

## 4. Wire it into a LOCAL test server

The keypair file's contents are a JSON byte array — exactly the format the
server's existing secret parser accepts (same as `HOUSE_WALLET_SECRET`, see
`server/src/solana/housePayout.ts`).

```powershell
# from the repo root
$env:MINT_AUTHORITY_SECRET = Get-Content devnet-authority.json -Raw
$env:SOLANA_RPC_URL        = "https://api.devnet.solana.com"
$env:COMPANY_COIN_ENABLED  = "true"      # feature flag (off = feature dark)
$env:TOKEN_GATE_DISABLED   = "true"      # local test convenience
$env:INVITATION_SYSTEM_DISABLED = "true"
$env:PORT                  = "2599"
node server/dist/index.js
```

Nothing on-chain exists in the code yet — this is the environment the build
phases (company-coin A→D / token-bridge A→C) will be developed and verified
against. A devnet stand-in for $BASE (a test Token-2022 mint) gets created by a
script in phase A, since the real $BASE only exists on mainnet.

## 5. Tell the agent

Once steps 1–3 succeed, say so (just "devnet key ready" + the PUBKEY — never
the file contents). The build starts at company-coin phase A / token-bridge
phase A, each phase verified on devnet Explorer
(https://explorer.solana.com/?cluster=devnet) before the next.

## 6. Mainnet promotion (much later, after legal review)

- Generate a SEPARATE mainnet keypair the same way (never reuse the devnet one),
  fund it with real SOL (~0.2 SOL covers many launches).
- Set `MINT_AUTHORITY_SECRET` on the production Railway service via
  `railway variables` (same handling as `HOUSE_WALLET_SECRET`).
- Keep `COMPANY_COIN_ENABLED` unset until you flip it deliberately.
- Consider moving the authority to a multisig (e.g. Squads) once volume matters.
