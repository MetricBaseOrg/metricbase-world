# Find the bugs and fix them.

## ✅ FIXED (v0.162.3) — Slimes bug inside players world

 The Slime Brute and Wild Slime placed in players owned world do not appear immediately if players log in directly to their world, slimes only appear after traveling My World → Hub → My World (one gate round trip). If players log in to the Hub, they only appear after traveling Hub → My World → Hub → My World (two gate round trips).

 **Root cause:** On a direct join to a World, the client renders the scene using an empty placeholder config (the real layout hasn't arrived yet). When the server pushes `playerZoneConfig`, `GameScene.refreshZoneContent()` re-rendered scenery, resources, farm/land plots and portals — but **never re-rendered NPCs**. So the mob dens (Wild Slime / Slime Brute) stayed missing until a gate trip re-cached the config and `renderZone` rebuilt the NPC layer. A Hub login needs two trips because the World's config is only fetched the first time you enter it.

 **Fix:** `refreshZoneContent()` now also calls `clearNpcs()` + `renderNpcs(zoneId)`, so config-driven NPCs appear as soon as the server pushes the World layout. See [GameScene.ts](../client/src/game/GameScene.ts#L2280).

## ✅ FIXED (v0.162.4) — Slime dens invisible in Build Mode + placeholder palette icons

 In Build Mode the Slime Den / Brute Den palette icons showed placeholder emoji (🟢 green circle, 🐸 frog), and dropping a den onto the World appeared to do nothing — it couldn't be "dropped in."

 **Root cause:** Mob dens are `virtual` assets — the server turns them into live NPCs at play time by moving them from `scenery` → `npcs`. Placement worked (the den *was* added to `draft.scenery`), but the live-edit render path (`applyDraftLive` → `renderScenery`) hits `if (asset?.virtual) continue;` and drew nothing, and `renderNpcs` isn't in the edit path — so a placed den was invisible until Save. Separately, the palette entries had `file: ""`, so they fell back to the emoji placeholder.

 **Fix:**

- `renderScenery` now draws a static preview sprite for virtual mob dens (via the baked `mob-slime` / `mob-slime-brute` textures) so a dropped den is visible while editing. See [GameScene.ts](../client/src/game/GameScene.ts#L2089).
- The den palette entries now carry `file` → the real mob art (and a non-zero `worldWidth`), so the palette icon, detail card, and drag ghost show the actual slime. See [zoneAssets.ts](../client/src/game/zoneAssets.ts#L267).
