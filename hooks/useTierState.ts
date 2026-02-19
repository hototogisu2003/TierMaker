"use client";

import * as React from "react";
import type { TierId, TierState } from "@/lib/tier/types";
import { buildInitialTierState, type MinimalCharacter } from "@/lib/tier/initialState";
import {
  findContainerOfItem,
  moveBetweenContainers,
  reorderWithinContainer,
} from "@/lib/tier/ops";

/**
 * Tier状態（pool + tiers + tierMeta）を管理するフック。
 * 共有URLなし・保存なし前提（毎回初期化して使う）でも、stateロジックを分離しておくと後が楽。
 */
export function useTierState(params: {
  characters: MinimalCharacter[];
  initialTiers: TierId[]; // ["S","A","B","C"]
}) {
  const { characters, initialTiers } = params;

  const [state, setState] = React.useState<TierState>(() =>
    buildInitialTierState(characters, initialTiers)
  );

  // characters/tiersが変わったら初期化（ページ再訪・データ変更時の安全策）
  React.useEffect(() => {
    setState(buildInitialTierState(characters, initialTiers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(characters.map((c) => c.id)), JSON.stringify(initialTiers)]);

  const containerIds = React.useMemo(() => {
    return ["pool", ...state.tierMeta.map((t) => t.id)];
  }, [state.tierMeta]);

  const actions = React.useMemo(() => {
    return {
      reset() {
        setState(buildInitialTierState(characters, initialTiers));
      },

      renameTier(tierId: TierId, nextName: string) {
        setState((prev) => ({
          ...prev,
          tierMeta: prev.tierMeta.map((t) =>
            t.id === tierId ? { ...t, name: nextName } : t
          ),
        }));
      },

      /**
       * onDragOver向け：別コンテナへ移動（プレビュー反映）
       */
      moveOnOver(activeId: string, overIdOrContainer: string) {
        setState((prev) => {
          const activeContainer = findContainerOfItem(prev.containers, activeId);
          if (!activeContainer) return prev;

          const overIsContainer = containerIds.includes(overIdOrContainer);
          const overContainer = overIsContainer
            ? overIdOrContainer
            : findContainerOfItem(prev.containers, overIdOrContainer);

          if (!overContainer) return prev;
          if (activeContainer === overContainer) return prev;

          // insert position
          let toIndex: number | undefined = undefined;
          if (!overIsContainer) {
            const overIndex = (prev.containers[overContainer] ?? []).indexOf(overIdOrContainer);
            if (overIndex >= 0) toIndex = overIndex;
          }

          const nextContainers = moveBetweenContainers({
            containers: prev.containers,
            itemId: activeId,
            fromId: activeContainer,
            toId: overContainer,
            toIndex,
          });

          return { ...prev, containers: nextContainers };
        });
      },

      /**
       * onDragEnd向け：同一コンテナ内の並び替え
       */
      reorderOnEnd(activeId: string, overId: string) {
        setState((prev) => {
          const containerId = findContainerOfItem(prev.containers, activeId);
          if (!containerId) return prev;

          // overId が同じコンテナ内にある場合のみ reorder
          const overContainer = findContainerOfItem(prev.containers, overId);
          if (!overContainer || overContainer !== containerId) return prev;

          const nextContainers = reorderWithinContainer({
            containers: prev.containers,
            containerId,
            activeId,
            overId,
          });

          return { ...prev, containers: nextContainers };
        });
      },
    };
  }, [characters, initialTiers, containerIds]);

  return { state, actions };
}
