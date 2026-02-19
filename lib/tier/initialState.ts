// lib/tier/initialState.ts
import type { TierId, TierMeta, TierContainers, TierState } from "./types";

export type MinimalCharacter = { id: string };

/**
 * Create initial tier board state:
 * - tiers: S/A/B/C etc. (empty)
 * - pool: contains all character ids
 */
export function buildInitialTierState(
  characters: MinimalCharacter[],
  initialTiers: TierId[]
): TierState {
  const tierMeta: TierMeta[] = initialTiers.map((t) => ({ id: t, name: t }));
  const pool = characters.map((c) => c.id);

  const tierEntries = initialTiers.map((t) => [t, [] as string[]] as const);
  const containers: TierContainers = {
    pool,
    ...(Object.fromEntries(tierEntries) as Record<TierId, string[]>),
  };

  return { tierMeta, containers };
}
