const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const cache = new Map();
function loadModule(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  cache.set(filename, exports);
  vm.runInNewContext(compiled, {
    exports,
    require: name => loadModule(path.resolve(path.dirname(filename), `${name}.ts`)),
  }, { filename });
  return exports;
}
const { judgeOneShot, getEnemyHp, computeDamage, calculateRequiredAttackBonus } = loadModule(path.resolve(__dirname, '../lib/damageCalc/calculator.ts'));
const { createDefaultDamageCalcState } = loadModule(path.resolve(__dirname, '../lib/damageCalc/defaultState.ts'));
const bossState = (bossHps, overrides = {}) => ({
  ...createDefaultDamageCalcState(), bossHpEnabled: true, bossHps, ...overrides,
});

test('boss HP sums partially filled stages and includes equality in success', () => {
  for (const [values, total] of [
    [['1000', '2000', '', ''], 3000],
    [['1000', '2000', '2000', ''], 5000],
    [['1000', '2000', '2000', '3000'], 8000],
  ]) {
    const state = bossState(values);
    assert.equal(getEnemyHp(state), total);
    assert.equal(judgeOneShot(total, state).success, true);
    assert.equal(judgeOneShot(total - 1, state).success, false);
  }
});

test('10% reduction subtracts 100 from the example total, rather than 500', () => {
  const state = bossState(['1000', '2000', '2000', ''], { reduceTenPercent: true });
  assert.equal(judgeOneShot(4900, state).realHp, 4900);
  assert.equal(judgeOneShot(4900, state).success, true);
  assert.equal(judgeOneShot(4899, state).success, false);
});

test('16%, 17% and combined reductions only affect boss 1', () => {
  const state = bossState(['1000', '2000', '2000', ''], { reduceAbEnabled: true });
  assert.equal(judgeOneShot(0, state).realHp, 4840);
  state.reduceAbGrade = '0.17';
  assert.equal(judgeOneShot(0, state).realHp, 4830);
  state.reduceTenPercent = true;
  assert.equal(judgeOneShot(0, state).realHp, 4730);
});

test('blank stages do not cause errors or move the reduction to another stage', () => {
  const state = bossState(['', '2000', '', ''], { reduceTenPercent: true });
  assert.equal(judgeOneShot(2000, state).realHp, 2000);
  assert.equal(judgeOneShot(2000, state).success, true);
  const empty = judgeOneShot(100, bossState(['', '', '', '']));
  assert.equal(empty.realHp, null);
  assert.equal(empty.success, null);
});

test('normal HP mode still reduces the entire HP and ignores stored boss inputs', () => {
  const state = bossState(['1000', '2000', '2000', ''], {
    bossHpEnabled: false, enemyHp: '5000', reduceTenPercent: true,
  });
  assert.equal(getEnemyHp(state), 5000);
  assert.equal(judgeOneShot(4500, state).realHp, 4500);
  assert.equal(judgeOneShot(4500, state).success, true);
  assert.equal(judgeOneShot(4499, state).success, false);
});

const attackState = (baseAttack, multiplier, overrides = {}) => ({
  ...createDefaultDamageCalcState(), baseAttack: String(baseAttack),
  otherEnabled: true, otherRate: String(multiplier), ...overrides,
});

test('common required bonus solves the user example across all attacks', () => {
  const states = [attackState(1000, 2), attackState(1000, 3)];
  assert.equal(calculateRequiredAttackBonus(states, 7500), 500);
  assert.equal(calculateRequiredAttackBonus([...states].reverse(), 7500), 500);
});

test('common bonus replaces current bonuses and handles different base attacks', () => {
  const states = [attackState(1000, 2, { attackBonus: '900' }), attackState(2000, 3, { attackBonus: '100' })];
  assert.equal(calculateRequiredAttackBonus(states, 10500), 500);
  assert.equal(states[0].attackBonus, '900');
  assert.equal(calculateRequiredAttackBonus(states, 8000), 0);
  assert.equal(calculateRequiredAttackBonus([attackState(1000, 2)], 3001), 501);
});

test('the smallest integer bonus respects rounding each attack separately', () => {
  const states = [attackState(1, 1.5), attackState(1, 1.5)];
  assert.equal(calculateRequiredAttackBonus(states, 9), 3);
});

test('multi-hit rounding and fixed friendship damage are included', () => {
  const states = [
    attackState(100, 1.3, { multiMode: true, weakEnabled: true, weakRate: '1.5', weakHitCount: '1', weakJudgeCount: '0' }),
    attackState(100, 1, { attackMode: 'friend' }),
  ];
  const bonus = calculateRequiredAttackBonus(states, 1000);
  const total = x => states.reduce((sum, state) => sum + computeDamage(state.attackMode === 'direct' ? { ...state, attackBonus: String(x) } : state).finalDamage, 0);
  assert.ok(bonus > 0);
  assert.ok(total(bonus) >= 1000);
  assert.ok(total(bonus - 1) < 1000);
});

test('invalid HP, missing base attack, and friendship-only inputs return no bonus', () => {
  assert.equal(calculateRequiredAttackBonus([attackState(1000, 2)], null), null);
  assert.equal(calculateRequiredAttackBonus([attackState(1000, 2)], 0), null);
  assert.equal(calculateRequiredAttackBonus([attackState('', 2)], 1000), null);
  assert.equal(calculateRequiredAttackBonus([attackState(1000, 2, { attackMode: 'friend' })], 1000), null);
});
