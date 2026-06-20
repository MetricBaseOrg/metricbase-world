import { loadCharacter, saveCharacter } from "../src/db/characters.js";
import { getPool, initDatabase } from "../src/db/pool.js";

const ready = await initDatabase();
console.log("Database ready:", ready);

await saveCharacter({
  name: "__healthcheck__",
  zoneId: "zone_hub",
  x: 0,
  y: 0,
  level: 1,
  xp: 0,
  questProgress: { active: [], objectiveIndex: {}, completed: [] },
  appearance: {
    bodyColor: 0xffc857,
    hairColor: 0x2d3436,
    outfitColor: 0x355070,
    hairStyle: "short",
    outfitStyle: "robe",
  },
});

const loaded = await loadCharacter("__healthcheck__");
console.log("Read/write OK:", loaded?.name === "__healthcheck__");

await getPool()?.query(`DELETE FROM characters WHERE name = '__healthcheck__'`);