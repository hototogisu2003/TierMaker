const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../lib/teamcustom/status.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { applyTeamHpSupport, normalizeUsageHp } = exportsObject;
const member = (id, formType = "獣神化") => ({ id, formType });

test("usage HP preserves individual values and migrates legacy maximum settings", () => {
  assert.equal(normalizeUsageHp(undefined), 0);
  assert.equal(normalizeUsageHp(undefined, true), 1000);
  for (const value of [0, 250, 1000]) assert.equal(normalizeUsageHp(value, true), value);
  for (const value of [-1, 1001, 1.5, Infinity, NaN, "1000"]) assert.equal(normalizeUsageHp(value), 0);
});

test("Magia 15 multiplies HP after base, fruit, spot and assist additions, rounding down", () => {
  const members = [member("15", "真獣神化"), member("100"), member("101", "真獣神化"), null];
  const hp = 20001 + 2500 + 2000 + 1500;
  assert.equal(applyTeamHpSupport(hp, 1, members), 39001);
  assert.equal(applyTeamHpSupport(hp, 0, members), hp);
  assert.equal(applyTeamHpSupport(hp, 2, members), hp);
  assert.equal(applyTeamHpSupport(0, 3, members), 0);
});

test("Kiss Kill Lyra 155 multiplies other eligible members by 1.25, rounding down", () => {
  const members = [member("155", "真獣神化"), member("100"), member("101", "真獣神化")];
  assert.equal(applyTeamHpSupport(20003, 1, members), 25003);
  assert.equal(applyTeamHpSupport(20003, 0, members), 20003);
  assert.equal(applyTeamHpSupport(20003, 2, members), 20003);
});

test("Magia wins over Kiss Kill Lyra regardless of slot order and never stacks", () => {
  for (const members of [
    [member("15"), member("155"), member("100")],
    [member("155"), member("15"), member("100")],
    [member("15"), member("15"), member("100")],
    [member("155"), member("155"), member("100")],
  ]) {
    assert.equal(applyTeamHpSupport(20003, 2, members), members.some(m => m.id === "15") ? 30004 : 25003);
  }
  // Self-exclusion still applies even if the provider's form data is missing.
  assert.equal(applyTeamHpSupport(20003, 0, [member("15", ""), member("155")]), 20003);
  assert.equal(applyTeamHpSupport(20003, 0, [member("155", "")]), 20003);
});

test("Magia 16 and names without the specified IDs do not activate the support", () => {
  for (const id of ["16", "custom-15", "custom-155", "マギア", "キスキルリラ"]) {
    assert.equal(applyTeamHpSupport(20003, 1, [member(id), member("100")]), 20003);
  }
  assert.equal(applyTeamHpSupport(20003, 1, [null, member("100")]), 20003);
});

test("removing, replacing or moving a provider immediately changes the derived HP", () => {
  const team = [member("15"), member("100"), null, null];
  assert.equal(applyTeamHpSupport(20003, 1, team), 30004);
  team[0] = member("16");
  assert.equal(applyTeamHpSupport(20003, 1, team), 20003);
  team[0] = member("155");
  assert.equal(applyTeamHpSupport(20003, 1, team), 25003);
  [team[0], team[2]] = [team[2], team[0]];
  assert.equal(applyTeamHpSupport(20003, 1, team), 25003);
  team[2] = null;
  assert.equal(applyTeamHpSupport(20003, 1, team), 20003);
});
