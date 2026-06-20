export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack: number;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface InventoryStatePayload {
  items: InventoryEntry[];
  capacity: number;
}

export const INVENTORY_CAPACITY = 16;

export const ITEMS: Record<string, ItemDefinition> = {
  item_health_potion: {
    id: "item_health_potion",
    name: "Health Potion",
    description: "Restores vitality. Consumables coming soon.",
    stackable: true,
    maxStack: 20,
  },
  item_training_scrap: {
    id: "item_training_scrap",
    name: "Training Scrap",
    description: "Fibers from a battered dummy. Useful for crafting.",
    stackable: true,
    maxStack: 99,
  },
  item_rusty_blade: {
    id: "item_rusty_blade",
    name: "Rusty Blade",
    description: "A worn practice sword. Better than bare hands.",
    stackable: false,
    maxStack: 1,
  },
};

export const EMPTY_INVENTORY: InventoryEntry[] = [];

export function getItemDefinition(itemId: string): ItemDefinition {
  const item = ITEMS[itemId];
  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }
  return item;
}

export function normalizeInventory(raw: InventoryEntry[] | null | undefined): InventoryEntry[] {
  if (!Array.isArray(raw)) return [];

  const merged = new Map<string, number>();

  for (const entry of raw) {
    if (!entry || typeof entry.itemId !== "string" || typeof entry.quantity !== "number") {
      continue;
    }
    if (!ITEMS[entry.itemId] || entry.quantity <= 0) continue;
    merged.set(entry.itemId, (merged.get(entry.itemId) ?? 0) + Math.floor(entry.quantity));
  }

  const items: InventoryEntry[] = [];
  for (const [itemId, quantity] of merged) {
    const definition = ITEMS[itemId];
    items.push({
      itemId,
      quantity: definition.stackable ? Math.min(quantity, definition.maxStack) : 1,
    });
  }

  return items.slice(0, INVENTORY_CAPACITY);
}

export function addItemToInventory(
  inventory: InventoryEntry[],
  itemId: string,
  quantity = 1,
): { inventory: InventoryEntry[]; added: number } {
  const definition = ITEMS[itemId];
  if (!definition || quantity <= 0) {
    return { inventory: normalizeInventory(inventory), added: 0 };
  }

  const next = normalizeInventory(inventory);
  const existing = next.find((entry) => entry.itemId === itemId);

  if (existing) {
    const remaining = definition.maxStack - existing.quantity;
    const added = Math.min(quantity, remaining);
    existing.quantity += added;
    return { inventory: next, added };
  }

  if (next.length >= INVENTORY_CAPACITY) {
    return { inventory: next, added: 0 };
  }

  const added = definition.stackable ? Math.min(quantity, definition.maxStack) : 1;
  next.push({ itemId, quantity: added });
  return { inventory: next, added };
}

export function buildInventoryPayload(inventory: InventoryEntry[]): InventoryStatePayload {
  return {
    items: normalizeInventory(inventory),
    capacity: INVENTORY_CAPACITY,
  };
}