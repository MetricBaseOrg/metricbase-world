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

## ✅ FIXED (v0.162.6) — Dens built while inside your World couldn't be attacked (the real cause)

 The **actual** reason dens took no damage: purely server-side, independent of any rendering.

 **Root cause:** `mobHp` (per-mob HP) is initialized in `onCreate`, iterating `zoneConfig.npcs` once at room start. But when a World is **saved / expanded / tier-changed while the room is live**, all three handlers do `room.zoneConfig = cfg` (swapping in the new NPC list) **without re-initializing `mobHp`**. A den you place and Save gets a brand-new NPC id (`pzmob_<prop>_<sceneryId>`) that has **no `mobHp` entry**, so `handleAttack` hits `if (currentHp === undefined ...) return;` and every swing silently no-ops. It only "worked" after fully leaving until the room disposed and `onCreate` re-ran. (This is also why the earlier gate-round-trip masked it.)

 **Fix:** Added `syncMobStateToConfig()` — initializes HP + spawn position for any new combat NPC, preserves HP for mobs that still exist (a save won't heal mid-fight), and prunes state for removed dens. It's called from `onCreate` and after **every** live `zoneConfig` swap (build save, expand, tier change). Dens are now attackable the instant you Save. See [ZoneRoom.ts](../server/src/rooms/ZoneRoom.ts#L2596).

## ✅ FIXED (v0.163.1) — /stats "Share the numbers" X post errored out

 The Share button on `/stats` opened an X (Twitter) intent that hard-errored ("Something went wrong… privacy related extensions"), so the share appeared broken.

 **Root cause:** The composed post (title + 5 stat lines + footer + URL) hit **287 X-counted characters** once the ad-revenue stat line was active (emoji count as 2). `x.com/intent/post` now rejects any over-280 prefill outright instead of truncating.

 **Fix:** The composer adds stat lines in priority order only while the whole post still fits a **272-char budget**; `xLen` mirrors X's counting (astral chars = 2; the raw URL counted at 34 vs t.co's 23, i.e. over-counting in the safe direction). Worst-case big-number simulation: old 287 → new 239. See [statsPage.ts](../server/src/api/statsPage.ts).

## ✅ FIXED (v0.163.2) — Jewelry lost its +N on unequip + mail bell rang late

 Two player-reported bugs:

 **1. Enhanced rings/necklaces lost their +N when unequipped** (and a swapped-in piece silently inherited the old slot's +N).

 - **Root cause:** The v0.158.1 stash/restore fix only ran for `WEARABLE_SLOTS` (durability gear) in the equip path, but jewelry is enhanceable without being wearable — so unequip stashed the +N and re-equip never restored it.
 - **Fix:** `handleEquipItem` now runs stash/restore for **every** gear slot; each helper already no-ops the wear/enhance part that doesn't apply. Self-healing: previously "lost" +N still sits in `enhanceStash` and returns on the next re-equip. See [ZoneRoom.ts](../server/src/rooms/ZoneRoom.ts).

 **2. The mail bell only rang when the recipient next opened the mail panel.**

 - **Root cause:** New-mail nudges used `clientForName` (same room only) and job-completion mail never nudged at all.
 - **Fix:** New `pushMailToRecipient` delivers a fresh `mailState` + chat notice through the cross-room presence registry the moment mail is inserted (player mail and Job Board reports alike), so the bell rings on arrival in any zone. See [ZoneRoom.ts](../server/src/rooms/ZoneRoom.ts).
