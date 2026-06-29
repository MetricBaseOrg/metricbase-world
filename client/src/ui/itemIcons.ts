// Procedural item icons drawn on a canvas — no binary assets. Each item maps to
// a recognizable shape archetype tinted by a material palette, so the whole
// catalogue shares one clean, consistent look (like the character art).

interface Pal {
  base: string;
  light: string;
  dark: string;
}

const MATS: Record<string, Pal> = {
  copper: { base: "#cf8350", light: "#edab74", dark: "#9a5a30" },
  iron: { base: "#b9c2cb", light: "#e4ebf0", dark: "#828d98" },
  steel: { base: "#9fb8cc", light: "#d4e4f1", dark: "#6d8499" },
  gold: { base: "#f3c64a", light: "#ffe49a", dark: "#bf8d1e" },
  gem: { base: "#41d6bf", light: "#9bf0e3", dark: "#1f9d8a" },
  amber: { base: "#f0a73a", light: "#ffd182", dark: "#c47813" },
  wood: { base: "#b67e46", light: "#d6a062", dark: "#7c5128" },
  hardwood: { base: "#7d5430", light: "#a0734a", dark: "#4f3115" },
  stone: { base: "#9aa0a6", light: "#c6cbd0", dark: "#6c7176" },
  cloth: { base: "#b5743f", light: "#d59a64", dark: "#7e4d26" },
  green: { base: "#76c14b", light: "#a8e07f", dark: "#4f9128" },
  red: { base: "#e3584f", light: "#f5908a", dark: "#b03127" },
  purple: { base: "#9a6bd6", light: "#c3a0ef", dark: "#6a3fa0" },
  white: { base: "#eef3f6", light: "#ffffff", dark: "#c2ccd2" },
  pink: { base: "#f08aa0", light: "#ffc1ce", dark: "#c45a73" },
  blue: { base: "#5aa7e0", light: "#9bcdf2", dark: "#2f74ad" },
  gray: { base: "#9aa0a6", light: "#c6cbd0", dark: "#6c7176" },
};

type Shape = (c: CanvasRenderingContext2D, p: Pal) => void;

const OUTLINE = "#2c1f14";

function fs(c: CanvasRenderingContext2D, color: string) {
  c.fillStyle = color;
  c.fill();
  c.stroke();
}

/** Material palette inferred from an item id. */
function matFor(itemId: string, fallback: keyof typeof MATS = "iron"): Pal {
  if (itemId.includes("copper")) return MATS.copper;
  if (itemId.includes("steel")) return MATS.steel;
  if (itemId.includes("iron")) return MATS.iron;
  if (itemId.includes("gem")) return MATS.gem;
  if (itemId.includes("hardwood")) return MATS.hardwood;
  return MATS[fallback];
}

// ---- Shape primitives (drawn in a 0..100 logical box) ----

const sword: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(50, 8);
  c.lineTo(58, 52);
  c.lineTo(50, 64);
  c.lineTo(42, 52);
  c.closePath();
  fs(c, p.light);
  c.beginPath(); // crossguard
  rr(c, 34, 62, 32, 8, 3);
  fs(c, p.dark);
  c.beginPath();
  rr(c, 46, 68, 8, 18, 3);
  fs(c, "#6b4a2c");
  c.beginPath();
  c.arc(50, 88, 5, 0, Math.PI * 2);
  fs(c, p.dark);
};

const dagger: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(50, 16);
  c.lineTo(57, 46);
  c.lineTo(50, 56);
  c.lineTo(43, 46);
  c.closePath();
  fs(c, p.light);
  c.beginPath();
  rr(c, 40, 56, 20, 6, 2);
  fs(c, p.dark);
  c.beginPath();
  rr(c, 47, 62, 6, 18, 2);
  fs(c, "#6b4a2c");
  c.beginPath();
  c.arc(50, 82, 4, 0, Math.PI * 2);
  fs(c, p.dark);
};

const axe: Shape = (c, p) => {
  c.save();
  c.lineCap = "round";
  c.strokeStyle = MATS.wood.dark;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(40, 90);
  c.lineTo(58, 24);
  c.stroke();
  c.restore();
  c.beginPath();
  c.moveTo(48, 18);
  c.lineTo(84, 26);
  c.quadraticCurveTo(90, 42, 80, 54);
  c.lineTo(52, 44);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  c.moveTo(84, 26);
  c.quadraticCurveTo(90, 42, 80, 54);
  c.strokeStyle = p.light;
  c.lineWidth = 4;
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
};

const pickaxe: Shape = (c, p) => {
  c.save();
  c.lineCap = "round";
  c.strokeStyle = MATS.wood.dark;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(50, 90);
  c.lineTo(50, 34);
  c.stroke();
  c.restore();
  c.beginPath();
  c.moveTo(16, 46);
  c.quadraticCurveTo(50, 18, 84, 46);
  c.quadraticCurveTo(50, 32, 16, 46);
  c.closePath();
  fs(c, p.base);
};

const rod: Shape = (c) => {
  c.save();
  c.lineCap = "round";
  c.strokeStyle = MATS.wood.base;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(22, 86);
  c.lineTo(74, 22);
  c.stroke();
  c.strokeStyle = MATS.stone.dark;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(74, 22);
  c.lineTo(66, 54);
  c.stroke();
  c.restore();
  c.beginPath();
  c.arc(40, 60, 7, 0, Math.PI * 2);
  fs(c, MATS.gray.base);
  c.beginPath();
  c.arc(66, 56, 3, 0, Math.PI * 2);
  fs(c, MATS.gray.light);
};

const net: Shape = (c, p) => {
  c.save();
  c.lineCap = "round";
  c.strokeStyle = MATS.wood.base;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(24, 88);
  c.lineTo(42, 60);
  c.stroke();
  c.restore();
  c.beginPath();
  c.moveTo(42, 56);
  c.lineTo(82, 36);
  c.lineTo(88, 60);
  c.lineTo(54, 78);
  c.closePath();
  c.fillStyle = "rgba(159,184,204,0.35)";
  c.fill();
  c.stroke();
  c.save();
  c.strokeStyle = p.dark;
  c.lineWidth = 1.6;
  for (let i = 1; i <= 3; i++) {
    c.beginPath();
    c.moveTo(42 + i * 12, 54 + i * 4);
    c.lineTo(50 + i * 11, 74 - i * 2);
    c.stroke();
  }
  c.restore();
};

const helmet: Shape = (c, p) => {
  c.beginPath();
  c.arc(50, 50, 26, Math.PI, 0);
  c.lineTo(76, 66);
  c.lineTo(24, 66);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  rr(c, 30, 42, 40, 10, 3);
  fs(c, p.dark);
  c.beginPath();
  c.moveTo(50, 24);
  c.lineTo(50, 66);
  c.strokeStyle = p.light;
  c.lineWidth = 3;
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
};

const chest: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(26, 34);
  c.lineTo(74, 34);
  c.lineTo(80, 48);
  c.lineTo(70, 82);
  c.lineTo(30, 82);
  c.lineTo(20, 48);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  c.moveTo(50, 38);
  c.lineTo(50, 80);
  c.strokeStyle = p.dark;
  c.lineWidth = 4;
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
};

const gloves: Shape = (c, p) => {
  c.beginPath();
  rr(c, 32, 36, 36, 40, 12);
  fs(c, p.base);
  c.beginPath();
  rr(c, 26, 70, 48, 16, 6);
  fs(c, p.dark);
  c.beginPath();
  c.arc(30, 50, 8, 0, Math.PI * 2); // thumb
  fs(c, p.base);
};

const boots: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(38, 22);
  c.lineTo(58, 22);
  c.lineTo(58, 64);
  c.lineTo(82, 64);
  c.lineTo(82, 80);
  c.lineTo(38, 80);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  rr(c, 36, 80, 48, 8, 3);
  fs(c, p.dark);
};

const ring: Shape = (c, p) => {
  c.save();
  c.lineWidth = 11;
  c.strokeStyle = p.base;
  c.beginPath();
  c.arc(50, 60, 22, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = p.light;
  c.beginPath();
  c.arc(50, 60, 22, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  diamond(c, 50, 26, 12, MATS.gem);
};

const amulet: Shape = (c, p) => {
  c.save();
  c.lineWidth = 4;
  c.strokeStyle = p.base;
  c.beginPath();
  c.arc(50, 40, 26, Math.PI * 0.85, Math.PI * 0.15, true);
  c.stroke();
  c.restore();
  c.beginPath();
  c.arc(50, 66, 13, 0, Math.PI * 2);
  fs(c, MATS.white.base);
  c.beginPath();
  c.arc(46, 62, 4, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fill();
};

const cape: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(32, 22);
  c.lineTo(68, 22);
  c.lineTo(78, 82);
  c.quadraticCurveTo(64, 74, 50, 82);
  c.quadraticCurveTo(36, 90, 22, 82);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  rr(c, 36, 18, 28, 9, 3);
  fs(c, p.dark);
};

const bread: Shape = (c) => {
  c.beginPath();
  c.moveTo(20, 66);
  c.quadraticCurveTo(18, 34, 50, 34);
  c.quadraticCurveTo(82, 34, 80, 66);
  c.closePath();
  fs(c, "#d8a866");
  c.save();
  c.strokeStyle = "#9a6a32";
  c.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(34 + i * 12, 44);
    c.lineTo(42 + i * 12, 56);
    c.stroke();
  }
  c.restore();
};

function fishShape(c: CanvasRenderingContext2D, p: Pal) {
  c.beginPath();
  c.ellipse(46, 52, 28, 16, 0, 0, Math.PI * 2);
  fs(c, p.base);
  c.beginPath();
  c.moveTo(70, 52);
  c.lineTo(88, 40);
  c.lineTo(88, 64);
  c.closePath();
  fs(c, p.dark);
  c.beginPath();
  c.arc(28, 48, 3, 0, Math.PI * 2);
  c.fillStyle = OUTLINE;
  c.fill();
}

const fish: Shape = (c, p) => fishShape(c, p);
const fishCooked: Shape = (c, p) => {
  fishShape(c, p);
  c.beginPath();
  c.ellipse(48, 50, 18, 8, 0, 0, Math.PI); // grill sheen
  c.strokeStyle = "rgba(120,70,30,0.7)";
  c.lineWidth = 2;
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
};

const potion: Shape = (c, p) => {
  c.beginPath();
  rr(c, 44, 22, 12, 14, 2);
  fs(c, "#cfe6ee");
  c.beginPath();
  rr(c, 43, 16, 14, 8, 2);
  fs(c, "#7a4e22");
  c.beginPath();
  c.arc(50, 60, 23, 0, Math.PI * 2);
  fs(c, "#e8f4f8");
  c.save();
  c.beginPath();
  c.arc(50, 60, 20, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = p.base;
  c.fillRect(28, 56, 44, 28);
  c.restore();
  c.beginPath();
  c.arc(50, 60, 23, 0, Math.PI * 2);
  c.stroke();
};

const bottle: Shape = (c, p) => {
  c.beginPath();
  rr(c, 40, 28, 20, 56, 8);
  fs(c, p.base);
  c.beginPath();
  rr(c, 45, 18, 10, 12, 2);
  fs(c, p.dark);
  c.beginPath();
  rr(c, 44, 14, 12, 6, 2);
  fs(c, "#7a4e22");
};

const log: Shape = (c, p) => {
  c.beginPath();
  rr(c, 16, 42, 68, 22, 11);
  fs(c, p.base);
  c.beginPath();
  c.ellipse(22, 53, 7, 11, 0, 0, Math.PI * 2);
  fs(c, p.light);
  c.beginPath();
  c.ellipse(22, 53, 3, 5, 0, 0, Math.PI * 2);
  c.strokeStyle = p.dark;
  c.lineWidth = 2;
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
};

const plank: Shape = (c, p) => {
  c.beginPath();
  rr(c, 14, 40, 72, 20, 5);
  fs(c, p.base);
  c.save();
  c.strokeStyle = p.dark;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(20, 47);
  c.lineTo(80, 47);
  c.moveTo(20, 53);
  c.lineTo(80, 53);
  c.stroke();
  c.restore();
};

const ore: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(28, 68);
  c.lineTo(20, 48);
  c.lineTo(38, 32);
  c.lineTo(62, 30);
  c.lineTo(78, 48);
  c.lineTo(70, 70);
  c.closePath();
  fs(c, MATS.stone.base);
  c.beginPath();
  c.arc(42, 50, 5, 0, Math.PI * 2);
  c.fillStyle = p.light;
  c.fill();
  c.beginPath();
  c.arc(58, 56, 4, 0, Math.PI * 2);
  c.fillStyle = p.base;
  c.fill();
};

const bar: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(26, 54);
  c.lineTo(74, 54);
  c.lineTo(82, 72);
  c.lineTo(18, 72);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  c.moveTo(26, 54);
  c.lineTo(74, 54);
  c.lineTo(66, 42);
  c.lineTo(34, 42);
  c.closePath();
  fs(c, p.light);
};

const gem: Shape = (c, p) => diamond(c, 50, 52, 26, p);

const pearl: Shape = (c) => {
  c.beginPath();
  c.arc(50, 54, 24, 0, Math.PI * 2);
  fs(c, MATS.white.base);
  c.beginPath();
  c.arc(42, 46, 7, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.95)";
  c.fill();
};

const gel: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(50, 22);
  c.quadraticCurveTo(80, 60, 50, 80);
  c.quadraticCurveTo(20, 60, 50, 22);
  c.closePath();
  c.fillStyle = p.base;
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(44, 44, 5, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fill();
};

const core: Shape = (c, p) => {
  c.beginPath();
  c.arc(50, 52, 22, 0, Math.PI * 2);
  fs(c, p.base);
  diamond(c, 50, 52, 11, { base: p.light, light: "#fff", dark: p.dark });
};

const scrap: Shape = (c, p) => {
  c.beginPath();
  c.moveTo(30, 64);
  c.lineTo(36, 38);
  c.lineTo(54, 44);
  c.lineTo(48, 58);
  c.lineTo(66, 56);
  c.lineTo(60, 76);
  c.closePath();
  fs(c, p.base);
};

const wheat: Shape = (c) => {
  c.save();
  c.strokeStyle = MATS.green.dark;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(50, 88);
  c.lineTo(50, 44);
  c.stroke();
  c.restore();
  for (let i = 0; i < 4; i++) {
    const y = 30 + i * 12;
    grain(c, 50, y, -1);
    grain(c, 50, y, 1);
  }
  grain(c, 50, 24, 0);
};

const seed: Shape = (c) => {
  const pts = [
    [42, 56],
    [56, 52],
    [50, 64],
    [62, 62],
    [46, 46],
  ];
  for (const [x, y] of pts) {
    c.beginPath();
    c.ellipse(x, y, 6, 4, Math.PI / 4, 0, Math.PI * 2);
    fs(c, "#9a6a36");
  }
};

const mount: Shape = (c, p) => {
  // simple side-profile quadruped
  c.beginPath();
  c.ellipse(48, 56, 26, 14, 0, 0, Math.PI * 2);
  fs(c, p.base);
  c.beginPath();
  c.moveTo(66, 50);
  c.quadraticCurveTo(82, 44, 80, 30);
  c.lineTo(72, 28);
  c.quadraticCurveTo(70, 42, 58, 48);
  c.closePath();
  fs(c, p.base);
  c.beginPath(); // ear
  c.moveTo(76, 30);
  c.lineTo(80, 20);
  c.lineTo(84, 30);
  c.closePath();
  fs(c, p.dark);
  c.save(); // legs
  c.strokeStyle = p.dark;
  c.lineWidth = 6;
  c.lineCap = "round";
  for (const x of [34, 46, 58]) {
    c.beginPath();
    c.moveTo(x, 66);
    c.lineTo(x, 84);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.arc(76, 34, 2.4, 0, Math.PI * 2);
  c.fillStyle = OUTLINE;
  c.fill();
};

const critter: Shape = (c, p) => {
  // rounded body
  c.beginPath();
  c.ellipse(50, 60, 24, 22, 0, 0, Math.PI * 2);
  fs(c, p.base);
  // ears
  c.beginPath();
  c.moveTo(34, 42);
  c.lineTo(28, 24);
  c.lineTo(46, 36);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  c.moveTo(66, 42);
  c.lineTo(72, 24);
  c.lineTo(54, 36);
  c.closePath();
  fs(c, p.base);
  // eyes
  c.beginPath();
  c.arc(42, 56, 3.4, 0, Math.PI * 2);
  c.fillStyle = OUTLINE;
  c.fill();
  c.beginPath();
  c.arc(58, 56, 3.4, 0, Math.PI * 2);
  c.fill();
  // muzzle
  c.beginPath();
  c.arc(50, 66, 3, 0, Math.PI * 2);
  c.fillStyle = p.dark;
  c.fill();
};

// ---- shared helpers ----
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function diamond(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, p: Pal) {
  c.beginPath();
  c.moveTo(cx - r, cy - r * 0.4);
  c.lineTo(cx, cy - r);
  c.lineTo(cx + r, cy - r * 0.4);
  c.lineTo(cx, cy + r);
  c.closePath();
  fs(c, p.base);
  c.beginPath();
  c.moveTo(cx - r, cy - r * 0.4);
  c.lineTo(cx, cy - r);
  c.lineTo(cx + r, cy - r * 0.4);
  c.closePath();
  c.fillStyle = p.light;
  c.fill();
}

function grain(c: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  c.beginPath();
  c.ellipse(x + dir * 7, y, 5, 3, (dir * Math.PI) / 4, 0, Math.PI * 2);
  fs(c, MATS.gold.base);
}

// ---- item registry: itemId -> [shape, palette key | "auto"] ----
const ITEM_ART: Record<string, [Shape, keyof typeof MATS | "auto"]> = {
  // food / consumables
  item_health_potion: [potion, "red"],
  item_bread: [bread, "amber"],
  item_cooked_fish: [fishCooked, "blue"],
  item_grilled_salmon: [fishCooked, "pink"],
  item_lamp_oil: [bottle, "amber"],
  // raw resources
  item_wood: [log, "wood"],
  item_hardwood: [log, "hardwood"],
  item_ore: [ore, "copper"],
  item_iron_ore: [ore, "iron"],
  item_fish: [fish, "blue"],
  item_salmon: [fish, "pink"],
  item_wheat: [wheat, "gold"],
  item_wheat_seed: [seed, "wood"],
  item_slime_gel: [gel, "green"],
  item_slime_core: [core, "purple"],
  item_training_scrap: [scrap, "gray"],
  // refined
  item_plank: [plank, "wood"],
  item_hardwood_plank: [plank, "hardwood"],
  item_copper_bar: [bar, "copper"],
  item_iron_bar: [bar, "iron"],
  item_steel_bar: [bar, "steel"],
  item_amber: [gem, "amber"],
  item_gemstone: [gem, "gem"],
  item_pearl: [pearl, "white"],
  item_harvest_net: [net, "steel"],
  // weapons
  item_rusty_blade: [sword, "iron"],
  item_gel_knife: [dagger, "green"],
  item_copper_dagger: [dagger, "copper"],
  item_gem_blade: [sword, "gem"],
  // tools
  item_copper_axe: [axe, "copper"],
  item_iron_axe: [axe, "iron"],
  item_steel_axe: [axe, "steel"],
  item_copper_pickaxe: [pickaxe, "copper"],
  item_iron_pickaxe: [pickaxe, "iron"],
  item_steel_pickaxe: [pickaxe, "steel"],
  item_fishing_rod: [rod, "wood"],
  item_pro_rod: [rod, "hardwood"],
  // armor
  item_copper_helm: [helmet, "copper"],
  item_iron_helm: [helmet, "iron"],
  item_steel_helm: [helmet, "steel"],
  item_copper_chest: [chest, "copper"],
  item_iron_chest: [chest, "iron"],
  item_steel_chest: [chest, "steel"],
  item_copper_gloves: [gloves, "copper"],
  item_iron_gloves: [gloves, "iron"],
  item_steel_gloves: [gloves, "steel"],
  item_copper_boots: [boots, "copper"],
  item_iron_boots: [boots, "iron"],
  item_steel_boots: [boots, "steel"],
  item_gem_ring: [ring, "gold"],
  item_pearl_amulet: [amulet, "gold"],
  item_traveler_cape: [cape, "cloth"],
  // mounts
  item_pony: [mount, "wood"],
  item_steed: [mount, "amber"],
  item_dire_wolf: [mount, "gray"],
  // pets
  item_pet_cat: [critter, "amber"],
  item_pet_owl: [critter, "hardwood"],
  item_pet_slime: [gel, "green"],
};

/** True when we have a drawn icon for this item (otherwise callers fall back). */
export function hasItemIcon(itemId: string): boolean {
  return itemId in ITEM_ART;
}

/** Draw an item's icon into the given 2D context at the given pixel size. */
export function drawItemIcon(c: CanvasRenderingContext2D, itemId: string, size: number) {
  const art = ITEM_ART[itemId];
  c.save();
  c.scale(size / 100, size / 100);
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
  if (!art) {
    c.beginPath();
    rr(c, 28, 28, 44, 44, 8);
    fs(c, MATS.wood.base);
  } else {
    const [shape, palKey] = art;
    const pal = palKey === "auto" ? matFor(itemId) : MATS[palKey];
    shape(c, pal);
  }
  c.restore();
}
