// lib/tier/ops.ts
import type { TierContainers, ContainerId } from "./types";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Find which container currently holds the itemId.
 */
export function findContainerOfItem(
  containers: Record<string, string[]>,
  itemId: string
): string | null {
  for (const [cid, items] of Object.entries(containers)) {
    if (items.includes(itemId)) return cid;
  }
  return null;
}

/**
 * Move item between different containers (pool <-> tier, tier <-> tier).
 * This is "preview move" used in onDragOver.
 */
export function moveBetweenContainers(params: {
  containers: TierContainers;
  itemId: string;
  fromId: string;
  toId: string;
  toIndex?: number; // default: end
}): TierContainers {
  const { containers, itemId, fromId, toId, toIndex } = params;

  const next = structuredClone(containers) as TierContainers;

  const from = next[fromId as ContainerId] ?? [];
  const to = next[toId as ContainerId] ?? [];

  const fromIndex = from.indexOf(itemId);
  if (fromIndex === -1) return containers;

  from.splice(fromIndex, 1);

  const insertAt = typeof toIndex === "number" ? toIndex : to.length;
  to.splice(Math.max(0, Math.min(insertAt, to.length)), 0, itemId);

  next[fromId as ContainerId] = from;
  next[toId as ContainerId] = to;

  return next;
}

/**
 * Reorder within the same container.
 * This is used in onDragEnd.
 */
export function reorderWithinContainer(params: {
  containers: TierContainers;
  containerId: string;
  activeId: string;
  overId: string;
}): TierContainers {
  const { containers, containerId, activeId, overId } = params;

  const items = containers[containerId as ContainerId] ?? [];
  const oldIndex = items.indexOf(activeId);
  const newIndex = items.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return containers;

  const next = structuredClone(containers) as TierContainers;
  next[containerId as ContainerId] = arrayMove(items, oldIndex, newIndex);
  return next;
}
