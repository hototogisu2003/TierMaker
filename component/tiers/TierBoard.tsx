"use client";

import React from "react";
import type { CharacterForUI } from "@/app/page";
import TierRow from "./TierRow";
import PoolRow from "./PoolRow";
import DragOverlayPreview from "./DragOverlayPreview";

import { DragOverlay } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

type TierMeta = { id: string; name: string };
type Props = {
  tierMeta: TierMeta[];
  containers: Record<string, string[]>; // { pool: [...], S: [...], ... }
  charactersById: Map<string, CharacterForUI>;
  onRenameTier: (tierId: string, nextName: string) => void;
  activeCharacter: CharacterForUI | null;
};

const TierBoard = React.forwardRef<HTMLDivElement, Props>(function TierBoard(
  { tierMeta, containers, charactersById, onRenameTier, activeCharacter },
  ref
) {
  return (
    <div ref={ref} className="panel">
      <div className="panelInner stack">
        {tierMeta.map((tier) => (
          <SortableContext
            key={tier.id}
            id={tier.id}
            items={containers[tier.id] ?? []}
            strategy={rectSortingStrategy}
          >
            <TierRow
              tierId={tier.id}
              tierName={tier.name}
              itemIds={containers[tier.id] ?? []}
              charactersById={charactersById}
              onRename={(next) => onRenameTier(tier.id, next)}
            />
          </SortableContext>
        ))}

        <div style={{ height: 6 }} />

        <SortableContext
          id="pool"
          items={containers.pool ?? []}
          strategy={rectSortingStrategy}
        >
          <PoolRow itemIds={containers.pool ?? []} charactersById={charactersById} />
        </SortableContext>
      </div>

      <DragOverlay>
        {activeCharacter ? <DragOverlayPreview character={activeCharacter} /> : null}
      </DragOverlay>
    </div>
  );
});

export default TierBoard;
