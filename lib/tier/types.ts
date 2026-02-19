// lib/tier/types.ts
export type TierId = string;
export type ContainerId = "pool" | TierId;

export type TierMeta = {
  id: TierId;
  name: string; // renameable
};

export type TierContainers = Record<ContainerId, string[]>;

export type TierState = {
  tierMeta: TierMeta[];
  containers: TierContainers;
};
