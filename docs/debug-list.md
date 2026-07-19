# Find the bugs and fix them.

## ✅ FIXED (v0.162.3) — Slimes bug inside players world

 The Slime Brute and Wild Slime placed in players owned world do not appear immediately if players log in directly to their world, slimes only appear after traveling My World → Hub → My World (one gate round trip). If players log in to the Hub, they only appear after traveling Hub → My World → Hub → My World (two gate round trips).

 **Root cause:** On a direct join to a World, the client renders the scene using an empty placeholder config (the real layout hasn't arrived yet). When the server pushes `playerZoneConfig`, `GameScene.refreshZoneContent()` re-rendered scenery, resources, farm/land plots and portals — but **never re-rendered NPCs**. So the mob dens (Wild Slime / Slime Brute) stayed missing until a gate trip re-cached the config and `renderZone` rebuilt the NPC layer. A Hub login needs two trips because the World's config is only fetched the first time you enter it.

 **Fix:** `refreshZoneContent()` now also calls `clearNpcs()` + `renderNpcs(zoneId)`, so config-driven NPCs appear as soon as the server pushes the World layout. See [GameScene.ts](../client/src/game/GameScene.ts#L2280).
