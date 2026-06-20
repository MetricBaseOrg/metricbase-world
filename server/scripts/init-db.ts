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
});

const loaded = await loadCharacter("__healthcheck__");
console.log("Read/write OK:", loaded?.name === "__healthcheck__");

await getPool()?.query(`DELETE FROM characters WHERE name = '__healthcheck__'`);