// World stats shown on the in-world billboard: live $BASE holder count plus
// how many players are currently in the zone (a little community pulse).

export interface BillboardNode {
  id: string;
  tileX: number;
  tileY: number;
}

export interface WorldStatsPayload {
  baseHolders: number | null;
  online: number;
}
