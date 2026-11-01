import type { CharacterItem, SlotStatus } from "./types";

type HpSupportMember = { id: string; formType?: CharacterItem["formType"] } | null;

export function normalizeUsageHp(raw: unknown, legacyMax = false): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 1000 ? raw : legacyMax ? 1000 : 0;
}

// Apply once, after all per-character additions. Magia takes priority for the whole team.
export function teamHpSupportMultiplier(slotIndex: number, members: readonly HpSupportMember[]): number {
  const target = members[slotIndex];
  if (!target || target.formType === "真獣神化") return 1;
  const supportId = members.some((member) => member?.id === "15") ? "15" : "155";
  const hasOtherSupport = members.some((member, index) => index !== slotIndex && member?.id === supportId);
  if (!hasOtherSupport) return 1;
  return supportId === "15" ? 1.5 : 1.25;
}

export function applyTeamHpSupport(hp: number, slotIndex: number, members: readonly HpSupportMember[]): number {
  const multiplier = teamHpSupportMultiplier(slotIndex, members);
  return multiplier === 1 ? hp : Math.floor(hp * multiplier);
}

export function normalizeSlotStatus(raw: unknown): SlotStatus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const keys = ["hp", "attack", "speed", "assistHp", "assistAttack"] as const;
  if (!keys.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0)) return undefined;
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as SlotStatus;
}
