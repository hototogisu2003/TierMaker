const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/irohaBuff/calculator.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { calculateBuff, createInitialState, selectSpot, toggleFruit, FRUITS } = exportsObject;
const inputs = (atk, spd, atkBonus = '', spdBonus = '') => ({ atk: String(atk), spd: String(spd), atkBonus, spdBonus });

test('all characters use their configured coefficients, caps and truncation', () => {
  for (const [character, stages] of Object.entries({ A: [[.75, 1.65], [1.5, 2.25]], B: [[.35, 1.25], [1.35, 2]], C: [[1.15, 2], [1.5, 2.25]] })) {
    for (const values of [inputs(30000, 300), inputs(40000, 300), inputs(30000, 400), inputs(100000, 100), inputs(31001, 297.17, '3300', '36.6')]) {
      const atk = Number(values.atk) + Number(values.atkBonus);
      const spd = (Number(values.spd) + Number(values.spdBonus)) * 100;
      const ratio = Math.max(atk, spd) / Math.min(atk, spd) - 1;
      const result = calculateBuff(values, character);
      assert.equal(result.error, '');
      stages.forEach(([k, cap], index) => {
        const raw = 1 + k * ratio;
        assert.equal(result.stages[index].value, Math.trunc(Math.min(raw, cap) * 1000) / 1000);
        assert.equal(result.stages[index].capped, raw > cap);
      });
    }
  }
});

test('blank, negative, non-finite and non-positive effective stats produce no results', () => {
  for (const values of [inputs('', 300), inputs(30000, ''), inputs(-1, 300), inputs(0, 300), inputs(30000, 0), inputs(30000, 300, '-30001'), inputs(30000, 300, '', '-300'), inputs(Infinity, 300), inputs(30000, 300, 'Infinity')]) {
    const result = calculateBuff(values, 'A');
    assert.ok(result.error);
    assert.equal(result.stages.length, 0);
  }
});

test('spot switching and removal preserve manual additions without double counting', () => {
  let state = { ...createInitialState(), atkBonus: '700', spdBonus: '1.2' };
  state = selectSpot(state, 'main');
  assert.equal(state.atkBonus, '2700');
  assert.equal(state.spdBonus, '42');
  state = selectSpot(state, 'mainOrSubPlus');
  assert.equal(state.atkBonus, '2200');
  assert.equal(state.spdBonus, '31.8');
  state = selectSpot(state, 'sub');
  assert.equal(state.atkBonus, '1200');
  assert.equal(state.spdBonus, '11.4');
  state = selectSpot(state, 'none');
  assert.equal(state.atkBonus, '700');
  assert.equal(state.spdBonus, '1.2');
});

test('each fruit allows one grade, toggles off, and keeps independent stat selections', () => {
  for (const stat of ['atk', 'spd']) {
    const field = stat === 'atk' ? 'atkBonus' : 'spdBonus';
    for (const group of FRUITS[stat]) {
      let state = createInitialState();
      state = toggleFruit(state, stat, group.label, 'L');
      assert.equal(Number(state[field]), group.L);
      state = toggleFruit(state, stat, group.label, 'EL');
      assert.equal(Number(state[field]), group.EL);
      assert.equal(state.fruits[stat][group.label], 'EL');
      state = toggleFruit(state, stat, group.label, 'EL');
      assert.equal(Number(state[field]), 0);
      assert.equal(state.fruits[stat][group.label], undefined);
    }
  }
  let state = toggleFruit(createInitialState(), 'atk', '同族加撃速', 'EL');
  state = toggleFruit(state, 'spd', '同族加撃速', 'L');
  assert.equal(state.atkBonus, '2200');
  assert.equal(state.spdBonus, '26.6');
});

test('reset removes spot tracking and fruit selections before the next selection', () => {
  let state = toggleFruit(selectSpot(createInitialState('B'), 'main'), 'atk', '同族加撃', 'L');
  assert.equal(state.atkBonus, '5000');
  state = createInitialState(state.character);
  assert.equal(state.character, 'B');
  assert.equal(state.spot, 'none');
  assert.equal(Object.keys(state.fruits.atk).length, 0);
  state = selectSpot(state, 'sub');
  assert.equal(state.atkBonus, '500');
  assert.equal(state.spdBonus, '10.2');
});
