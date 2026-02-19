"use client";

import React from "react";
import type { CharacterForUI } from "@/app/page";
import TierBoard from "./TierBoard";
import BoardControls from "./controls/BoardControls";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

type TierId = string;
type ContainerId = "pool" | TierId;

type TierMeta = { id: TierId; name: string };

type Props = {
  characters: CharacterForUI[];
  initialTiers: TierId[]; // ["S","A","B","C"]
};

function buildInitialState(characters: CharacterForUI[], initialTiers: TierId[]) {
  const tierMeta: TierMeta[] = initialTiers.map((t) => ({ id: t, name: t }));
  const pool = characters.map((c) => c.id);

  const containers: Record<ContainerId, string[]> = {
    pool,
    ...(Object.fromEntries(initialTiers.map((t) => [t, []])) as Record<TierId, string[]>),
  };

  return { tierMeta, containers };
}

function findContainerOfItem(containers: Record<string, string[]>, itemId: string): string | null {
  for (const [cid, items] of Object.entries(containers)) {
    if (items.includes(itemId)) return cid;
  }
  return null;
}

export default function TierMaker({ characters, initialTiers }: Props) {
  const boardRef = React.useRef<HTMLDivElement | null>(null);

  const [{ tierMeta, containers }, setState] = React.useState(() =>
    buildInitialState(characters, initialTiers)
  );

  // Active dragging item id
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const characterById = React.useMemo(() => {
    const m = new Map<string, CharacterForUI>();
    for (const c of characters) m.set(c.id, c);
    return m;
  }, [characters]);

  const containerIds: ContainerId[] = React.useMemo(() => {
    return ["pool", ...tierMeta.map((t) => t.id)];
  }, [tierMeta]);

  function resetBoard() {
    setActiveId(null);
    setState(buildInitialState(characters, initialTiers));
  }

  function renameTier(tierId: TierId, nextName: string) {
    setState((prev) => ({
      ...prev,
      tierMeta: prev.tierMeta.map((t) => (t.id === tierId ? { ...t, name: nextName } : t)),
    }));
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
  }

  function handleDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;

    setState((prev) => {
      const next = structuredClone(prev);

      const activeContainer = findContainerOfItem(next.containers, active);
      if (!activeContainer) return prev;

      // over can be a container id (e.g., "S") or an item id (e.g., "123")
      const overIsContainer = containerIds.includes(over as ContainerId);
      const overContainer = overIsContainer ? over : findContainerOfItem(next.containers, over);

      if (!overContainer) return prev;
      if (activeContainer === overContainer) return prev;

      // remove from old container
      const fromItems = next.containers[activeContainer];
      const fromIndex = fromItems.indexOf(active);
      if (fromIndex === -1) return prev;
      fromItems.splice(fromIndex, 1);

      // insert into new container near hovered item, or at end if hovering container
      const toItems = next.containers[overContainer];
      let insertIndex = toItems.length;

      if (!overIsContainer) {
        const overIndex = toItems.indexOf(over);
        insertIndex = overIndex >= 0 ? overIndex : toItems.length;
      }

      toItems.splice(insertIndex, 0, active);

      return next;
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;

    setActiveId(null);
    if (!over) return;

    setState((prev) => {
      const next = structuredClone(prev);

      const activeContainer = findContainerOfItem(next.containers, active);
      if (!activeContainer) return prev;

      const overIsContainer = containerIds.includes(over as ContainerId);
      const overContainer = overIsContainer ? over : findContainerOfItem(next.containers, over);
      if (!overContainer) return prev;

      // reorder within same container
      if (activeContainer === overContainer && !overIsContainer) {
        const items = next.containers[activeContainer];
        const oldIndex = items.indexOf(active);
        const newIndex = items.indexOf(over);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          next.containers[activeContainer] = arrayMove(items, oldIndex, newIndex);
        }
      }

      return next;
    });
  }

  const activeCharacter = activeId ? characterById.get(activeId) ?? null : null;

  return (
    <div className="stack">
      <BoardControls onReset={resetBoard} exportTargetRef={boardRef} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* SortableContext is applied per container inside TierBoard */}
        <TierBoard
          ref={boardRef}
          tierMeta={tierMeta}
          containers={containers}
          charactersById={characterById}
          onRenameTier={renameTier}
          activeCharacter={activeCharacter}
        />
      </DndContext>
    </div>
  );
}
