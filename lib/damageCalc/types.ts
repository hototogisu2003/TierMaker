export type AttackMode = "direct" | "friend";
export type ToolTab = "calc" | "verify" | "manual" | "contact";
export type ThemeMode = "light" | "dark";
export type StageType = "advantage" | "none" | "disadvantage";
export type SpotBonus = "none" | "main" | "sub";

export type FruitGroupId =
  | "sameAttack"
  | "sameAttackSpeed"
  | "sameAttackHp"
  | "typeAttack"
  | "typeAttackSpeed"
  | "typeAttackHp"
  | "battleAttack"
  | "battleAttackSpeed"
  | "battleAttackHp"
  | "kodakaAttack";

export type FruitSelection = Record<FruitGroupId, number | null>;

export type BreakdownItem = {
  name: string;
  val: string;
};

export type DamageCalcState = {
  attackMode: AttackMode;
  baseAttack: string;
  attackBonus: string;
  friendYuugeki: string;
  spotBonus: SpotBonus;
  selectedFruits: FruitSelection;
  gauge: boolean;
  friendHalf: boolean;
  superAdw: boolean;
  warpEnabled: boolean;
  warpCount: string;
  mineSweeperEnabled: boolean;
  mineSweeperGrade: string;
  friendBoostEnabled: boolean;
  friendBoostGrade: string;
  sokoEnabled: boolean;
  sokoGrade: string;
  friendSokoEnabled: boolean;
  friendSokoGrade: string;
  auraEnabled: boolean;
  auraGrade: string;
  wallBoostEnabled: boolean;
  wallBoostGrade: string;
  wallBoostWalls: string;
  hiyoko: boolean;
  magicCircleBoostEnabled: boolean;
  magicCircleBoostGrade: string;
  konshin: boolean;
  critical: boolean;
  friendCritical: boolean;
  superPower: boolean;
  powerFieldEnabled: boolean;
  powerFieldGrade: string;
  friendField: boolean;
  sleep: boolean;
  weakKillerEnabled: boolean;
  weakKillerRate: string;
  killerEnabled: boolean;
  killerRate: string;
  buffEnabled: boolean;
  buffRate: string;
  friendBuffEnabled: boolean;
  friendBuffRate: string;
  guardianEnabled: boolean;
  guardianRate: string;
  assistSkillEnabled: boolean;
  assistSkillRate: string;
  ss1Enabled: boolean;
  ss1Rate: string;
  ss2Enabled: boolean;
  ss2Rate: string;
  otherEnabled: boolean;
  otherRate: string;
  crestVsAttribute: boolean;
  crestVsWeak: boolean;
  crestVsBoss: boolean;
  crestGuardianAssist: boolean;
  multiMode: boolean;
  weakHitCount: string;
  weakJudgeCount: string;
  weakEnabled: boolean;
  weakRate: string;
  weakPointEnabled: boolean;
  weakPointRate: string;
  bodyEnabled: boolean;
  bodyRate: string;
  directEnemyRateEnabled: boolean;
  directEnemyRate: string;
  friendEnemyRateEnabled: boolean;
  friendEnemyRate: string;
  defDownEnabled: boolean;
  defDownRate: string;
  angryEnabled: boolean;
  angryRate: string;
  mineEnabled: boolean;
  mineRate: string;
  specialEnabled: boolean;
  specialRate: string;
  stageType: StageType;
  stageMagnitude: string;
  customStageRate: string;
  superBalance: boolean;
  gimmickEnabled: boolean;
  gimmickRate: string;
  enemyHp: string;
  reduceAbEnabled: boolean;
  reduceAbGrade: string;
  reduceTenPercent: boolean;
};

export type DamageCalcResult = {
  actualAttack: number;
  finalDamage: number;
  breakdown: BreakdownItem[];
  stageRealRate: number;
};

export type OneShotResult = {
  realHp: number | null;
  success: boolean | null;
  message: string;
};
