import {
  ANGRY_OPTIONS,
  AURA_OPTIONS,
  FRIEND_YUUGEKI_OPTIONS,
  GRADE_3_OPTIONS,
  GRADE_4_OPTIONS,
  PFIELD_OPTIONS,
  STAGE_ATTR_DATA,
  WALL_BOOST_DATA,
  WBOOST_GRADE_OPTIONS,
} from "./constants";
import type { SelectOption } from "./constants";
import type { BreakdownItem, DamageCalcResult, DamageCalcState, OneShotResult } from "./types";

function parseNumber(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

function getOptionLabel(options: SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "";
}

function getGradeSuffixFromLabel(label: string): string {
  const grade = label.split(" ")[0] ?? "";
  if (!grade || grade.includes("無印") || grade.includes("なし") || grade.includes("主友情")) {
    return "";
  }
  return ` ${grade}`;
}

function getStageLabel(stageType: DamageCalcState["stageType"], stageMagnitude: string, customStageRate: string): { name: string; multiplier: number } {
  if (stageType === "none") {
    return { name: "属性倍率(なし)", multiplier: 1.0 };
  }

  if (stageMagnitude === "custom") {
    return { name: "エレメント系", multiplier: parseNumber(customStageRate, 1.0) };
  }

  const stageData = STAGE_ATTR_DATA[stageType];
  const typeText = stageData.label;
  const magnitudeLabel = getOptionLabel(stageData.options, stageMagnitude);
  const magnitudeName = magnitudeLabel.split(" ")[0] ?? "";
  return {
    name: `属性倍率(${typeText}・${magnitudeName})`,
    multiplier: parseNumber(stageMagnitude, 1.0),
  };
}

export function computeDamage(state: DamageCalcState): DamageCalcResult {
  const breakdown: BreakdownItem[] = [];
  const baseAttack = parseNumber(state.baseAttack, 0);

  let actualAttack = 0;
  if (state.attackMode === "direct") {
    const bonus = parseNumber(state.attackBonus, 0);
    actualAttack = baseAttack + bonus;
    breakdown.push({ name: "攻撃力", val: formatNumber(baseAttack) });
    if (bonus > 0) {
      breakdown.push({ name: "加撃", val: `+${formatNumber(bonus)}` });
    }
  } else {
    const yuugeki = parseNumber(state.friendYuugeki, 1.0);
    actualAttack = Math.floor(baseAttack * yuugeki);
    const suffix = getGradeSuffixFromLabel(getOptionLabel(FRIEND_YUUGEKI_OPTIONS, state.friendYuugeki));
    breakdown.push({ name: `友情コンボ威力 (×友撃${suffix})`, val: formatNumber(actualAttack) });
  }

  const isMultiMode = state.multiMode;
  let totalMultiplier = 1.0;
  let weakKillerRate = 1.0;
  let vsWeakRate = 1.0;
  let weakRate = 1.0;
  let weakPointRate = 1.0;
  let bodyRate = 1.0;

  const apply = (name: string, rate: number) => {
    if (rate !== 1.0 && rate !== 0) {
      totalMultiplier *= rate;
      breakdown.push({ name, val: `x${rate}` });
    }
  };

  if (state.attackMode === "direct") {
    if (state.gauge) apply("ゲージ", 1.2);
    if (state.superAdw) apply("超ADW", 1.3);
    if (state.warpEnabled) {
      const count = parseNumber(state.warpCount, 0);
      apply(`超AW (${count}個)`, 1 + count * 0.05);
    }
    if (state.mineSweeperEnabled) {
      apply(
        `マインスイーパー${getGradeSuffixFromLabel(getOptionLabel(GRADE_4_OPTIONS, state.mineSweeperGrade))}`,
        parseNumber(state.mineSweeperGrade, 1.0)
      );
    }
    if (state.sokoEnabled) {
      apply(`底力${getGradeSuffixFromLabel(getOptionLabel(GRADE_4_OPTIONS, state.sokoGrade))}`, parseNumber(state.sokoGrade, 1.0));
    }
    if (state.wallBoostEnabled) {
      const gradeSuffix = getGradeSuffixFromLabel(getOptionLabel(WBOOST_GRADE_OPTIONS, state.wallBoostGrade));
      const wallRate = WALL_BOOST_DATA[state.wallBoostGrade]?.[state.wallBoostWalls];
      if (wallRate) {
        apply(`ウォールブースト${gradeSuffix}(${state.wallBoostWalls}壁)`, wallRate);
      }
    }
    if (state.magicCircleBoostEnabled) {
      apply(
        `魔法陣ブースト${getGradeSuffixFromLabel(getOptionLabel(GRADE_3_OPTIONS, state.magicCircleBoostGrade))}`,
        parseNumber(state.magicCircleBoostGrade, 1.0)
      );
    }
    if (state.konshin) apply("渾身", 3.0);
    if (state.critical) apply("クリティカル", 7.5);
    if (state.superPower) apply("超パワー型(初撃)", 1.2);
    if (state.powerFieldEnabled) {
      apply(
        `パワーフィールド${getGradeSuffixFromLabel(getOptionLabel(PFIELD_OPTIONS, state.powerFieldGrade))}`,
        parseNumber(state.powerFieldGrade, 1.0)
      );
    }
    if (state.ss1Enabled) apply("SS倍率1", parseNumber(state.ss1Rate, 1.0));
    if (state.ss2Enabled) apply("SS倍率2", parseNumber(state.ss2Rate, 1.0));
    if (state.directEnemyRateEnabled) apply("直殴り倍率", parseNumber(state.directEnemyRate, 1.0));
  }

  if (state.attackMode === "friend") {
    if (state.friendBoostEnabled) {
      apply(
        `友情ブースト${getGradeSuffixFromLabel(getOptionLabel(GRADE_4_OPTIONS, state.friendBoostGrade))}`,
        parseNumber(state.friendBoostGrade, 1.0)
      );
    }
    if (state.friendHalf) apply("誘発", 0.5);
    if (state.friendSokoEnabled) {
      apply(
        `友情底力${getGradeSuffixFromLabel(getOptionLabel(GRADE_4_OPTIONS, state.friendSokoGrade))}`,
        parseNumber(state.friendSokoGrade, 1.0)
      );
    }
    if (state.friendCritical) apply("友情コンボクリティカル", 3.0);
    if (state.friendField) apply("友情フィールド", 1.5);
    if (state.friendBuffEnabled) apply("友情バフ", parseNumber(state.friendBuffRate, 1.0));
    if (state.friendEnemyRateEnabled) apply("友情倍率", parseNumber(state.friendEnemyRate, 1.0));
  }

  if (state.auraEnabled) {
    apply(`パワーオーラ${getGradeSuffixFromLabel(getOptionLabel(AURA_OPTIONS, state.auraGrade))}`, parseNumber(state.auraGrade, 1.0));
  }
  if (state.hiyoko) apply("ヒヨコ", 1 / 3);
  if (state.sleep) apply("睡眠", 1.5);

  if (state.weakKillerEnabled) {
    const rate = parseNumber(state.weakKillerRate, 1.0);
    if (isMultiMode) weakKillerRate = rate;
    else apply("弱点キラー", rate);
  }
  if (state.killerEnabled) apply("その他キラー", parseNumber(state.killerRate, 1.0));
  if (state.buffEnabled) apply("バフ", parseNumber(state.buffRate, 1.0));
  if (state.guardianEnabled) apply("守護獣", parseNumber(state.guardianRate, 1.0));
  if (state.assistSkillEnabled) apply("アシストスキル", parseNumber(state.assistSkillRate, 1.0));
  if (state.otherEnabled) apply("その他", parseNumber(state.otherRate, 1.0));

  if (state.crestVsAttribute) apply("紋章(対属性)", 1.25);
  if (state.crestVsWeak) {
    if (isMultiMode) vsWeakRate = 1.1;
    else apply("紋章(対弱)", 1.1);
  }
  if (state.crestVsBoss) apply("紋章(対将/兵)", 1.1);
  if (state.crestGuardianAssist) apply("紋章(守護獣)", 1.08);

  const inputWeakRate = parseNumber(state.weakRate, 3.0);
  if (isMultiMode) weakRate = inputWeakRate;
  else if (state.weakEnabled) apply("弱点倍率", inputWeakRate);

  const inputWeakPointRate = parseNumber(state.weakPointRate, 1.0);
  if (isMultiMode) weakPointRate = inputWeakPointRate;
  else if (state.weakPointEnabled) apply("弱点判定倍率", inputWeakPointRate);

  const inputBodyRate = parseNumber(state.bodyRate, 1.0);
  if (isMultiMode) bodyRate = inputBodyRate;
  else if (state.bodyEnabled) apply("本体倍率", inputBodyRate);

  if (state.defDownEnabled) apply("防御ダウン倍率", parseNumber(state.defDownRate, 1.0));
  if (state.angryEnabled) {
    apply(`怒り倍率${getGradeSuffixFromLabel(getOptionLabel(ANGRY_OPTIONS, state.angryRate))}`, parseNumber(state.angryRate, 1.0));
  }
  if (state.mineEnabled) apply("地雷倍率", parseNumber(state.mineRate, 1.0));
  if (state.specialEnabled) apply("特殊倍率", parseNumber(state.specialRate, 1.0));

  const stageBase = getStageLabel(state.stageType, state.stageMagnitude, state.customStageRate);
  let stageMultiplier = stageBase.multiplier;
  let stageName = stageBase.name;
  if (state.stageType === "advantage" && state.superBalance && stageBase.multiplier > 1.0) {
    const temp = ((stageBase.multiplier - 1) / 0.33) * 0.596 + 1;
    stageMultiplier = Math.round(temp * 1_000_000) / 1_000_000;
    stageName = `超バランス型(${stageName.replace("属性倍率", "").replace(/[()]/g, "")})`;
  }
  apply(stageName, stageMultiplier);

  if (state.gimmickEnabled) apply("ギミック倍率", parseNumber(state.gimmickRate, 1.0));

  let finalDamage = 0;
  if (isMultiMode) {
    const commonDamage = actualAttack * totalMultiplier;
    const damageToBody = Math.floor(commonDamage * bodyRate);
    const weakCount = parseNumber(state.weakHitCount, 0);
    const weakTotalRate = weakRate * weakPointRate * weakKillerRate * vsWeakRate;
    const weakUnitDamage = Math.floor(commonDamage * weakTotalRate);
    const weakTotalDamage = weakUnitDamage * weakCount;
    const judgeCount = parseNumber(state.weakJudgeCount, 0);
    const judgeUnitDamage = Math.floor(commonDamage * weakPointRate);
    const judgeTotalDamage = judgeUnitDamage * judgeCount;

    finalDamage = damageToBody + weakTotalDamage + judgeTotalDamage;
    breakdown.push({ name: "--- 複数判定内訳 ---", val: "" });
    breakdown.push({ name: `本体 (x${bodyRate})`, val: formatNumber(damageToBody) });
    if (weakCount > 0) {
      breakdown.push({
        name: `弱点 (x${Math.round(weakTotalRate * 100) / 100})`,
        val: `${formatNumber(weakUnitDamage)} × ${weakCount}hit`,
      });
    }
    if (judgeCount > 0) {
      breakdown.push({
        name: `弱点判定 (x${weakPointRate})`,
        val: `${formatNumber(judgeUnitDamage)} × ${judgeCount}hit`,
      });
    }
  } else {
    finalDamage = Math.floor(actualAttack * totalMultiplier + 0.00001);
  }

  return {
    actualAttack,
    finalDamage,
    breakdown,
    stageRealRate: Math.floor(stageMultiplier * 1_000_000) / 1_000_000,
  };
}

export function judgeOneShot(totalDamage: number, state: DamageCalcState): OneShotResult {
  const maxHp = parseNumber(state.enemyHp, Number.NaN);
  if (!Number.isFinite(maxHp) || maxHp <= 0) {
    return { realHp: null, success: null, message: "HPを入力してください" };
  }

  let reduceRate = 0;
  if (state.reduceAbEnabled) reduceRate += parseNumber(state.reduceAbGrade, 0);
  if (state.reduceTenPercent) reduceRate += 0.1;

  const realHp = Math.floor(maxHp * (1 - reduceRate));
  const success = totalDamage >= realHp;
  return {
    realHp,
    success,
    message: success ? "ワンパンできます" : "ワンパンできません",
  };
}
