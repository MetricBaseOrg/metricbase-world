# Find the bugs and fix them.

## ✅ FIXED (v0.162.3) — Slimes bug inside players world

 The Slime Brute and Wild Slime placed in players owned world do not appear immediately if players log in directly to their world, slimes only appear after traveling My World → Hub → My World (one gate round trip). If players log in to the Hub, they only appear after traveling Hub → My World → Hub → My World (two gate round trips).

 **Root cause:** On a direct join to a World, the client renders the scene using an empty placeholder config (the real layout hasn't arrived yet). When the server pushes `playerZoneConfig`, `GameScene.refreshZoneContent()` re-rendered scenery, resources, farm/land plots and portals — but **never re-rendered NPCs**. So the mob dens (Wild Slime / Slime Brute) stayed missing until a gate trip re-cached the config and `renderZone` rebuilt the NPC layer. A Hub login needs two trips because the World's config is only fetched the first time you enter it.

 **Fix:** `refreshZoneContent()` now also calls `clearNpcs()` + `renderNpcs(zoneId)`, so config-driven NPCs appear as soon as the server pushes the World layout. See [GameScene.ts](../client/src/game/GameScene.ts#L2280).

## ✅ FIXED (v0.162.4) — Slime dens invisible in Build Mode + placeholder palette icons

 In Build Mode the Slime Den / Brute Den palette icons showed placeholder emoji (🟢 green circle, 🐸 frog), and dropping a den onto the World appeared to do nothing — it couldn't be "dropped in."

 **Root cause:** Mob dens are `virtual` assets — the server derives a live combat NPC from each den scenery node (but leaves the node in `scenery`). Placement worked (the den *was* added to `draft.scenery`), but the live-edit render path (`applyDraftLive` → `renderScenery`) hits `if (asset?.virtual) continue;` and drew nothing, and `renderNpcs` isn't in the edit path — so a placed den was invisible until Save. Separately, the palette entries had `file: ""`, so they fell back to the emoji placeholder.

 **Fix:**

- `renderScenery` now draws a static preview sprite for virtual mob dens (via the baked `mob-slime` / `mob-slime-brute` textures) so a dropped den is visible while editing. See [GameScene.ts](../client/src/game/GameScene.ts#L2089).
- The den palette entries now carry `file` → the real mob art (and a non-zero `worldWidth`), so the palette icon, detail card, and drag ghost show the actual slime. See [zoneAssets.ts](../client/src/game/zoneAssets.ts#L267).

## ✅ FIXED (v0.162.5) — Dens rendered a duplicate slime + couldn't be attacked (regression from v0.162.4)

 After v0.162.4, each placed den showed **two slimes stacked** on the same spot, and the slimes couldn't be attacked — no damage registered.

 **Root cause:** The server derives a live NPC from each den but **leaves the den node in `scenery`** (only `RESOURCE_PROPS` are filtered out, not `MOB_DENS`). So at play time `config.scenery` still holds the den *and* `config.npcs` holds its live NPC. The v0.162.4 preview then drew a static slime on top of the real, wandering NPC. Clicks that landed on the static decoy (which is not a combat target) selected nothing, so attacks registered no damage — especially once the real Wild Slime wandered off its spawn tile.

 **Fix:** The `renderScenery` den-preview now only draws when there is **no** live NPC derived from that node (`pzmob_<prop>_<id>` absent from `config.npcs`) — i.e. only for a freshly-placed, unsaved den during editing. Saved dens (play mode and re-editing) are drawn solely by `renderNpcs` as the real combat slime, so no duplicate and clicks always hit the real target. See [GameScene.ts](../client/src/game/GameScene.ts#L2089).
