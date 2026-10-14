const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, "lib/assist/characters.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { filterAssistCharacters, ASSIST_FILTERS } = context.exports;

// Parse quoted CSV cells too, so descriptions containing commas/newlines remain intact.
function parseCsv(source) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell.replace(/\r$/, "")); cell = "";
      if (c === "\n") { rows.push(row); row = []; }
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i]])));
}
const source = parseCsv(fs.readFileSync(path.join(root, "supabase/assist_characters.csv"), "utf8"));
const characters = source.map((row) => ({ ...row, number: Number(row.number), iconUrl: row.file_path,
  ratio: row.ratio ? Number(row.ratio) : null,
  ...Object.fromEntries(ASSIST_FILTERS.map(({ key }) => [key, Number(row[key])])),
}));

test("initial data has 87 unique characters and the corrected classifications", () => {
  assert.equal(characters.length, 87);
  assert.equal(new Set(characters.map((c) => c.number)).size, 87);
  assert.equal(filterAssistCharacters(characters, "", ["attack_up"]).length, 45);
  assert.equal(filterAssistCharacters(characters, "", ["ss_shortening"]).length, 8);
  assert.equal(characters.find((c) => c.number === 8487).ss_shortening, 1);
  assert.equal(characters.find((c) => c.number === 8921).attack_up, 1);
  assert.equal(characters.filter((c) => c.ratio != null).length, 45);
  assert.equal(characters.find((c) => c.number === 7322).ratio, 106);
  for (const character of characters) {
    assert.match(character.file_path, new RegExp(`^${character.number}\\.jpg$`));
    for (const { key } of ASSIST_FILTERS) assert.ok(character[key] === 0 || character[key] === 1);
  }
});

test("ratio order is numeric descending, breaks ties by number and puts missing ratios last", () => {
  const fixture = [
    { ...characters[0], number: 900, ratio: null },
    { ...characters[0], number: 800, ratio: 9 },
    { ...characters[0], number: 700, ratio: 25 },
    { ...characters[0], number: 600, ratio: 106 },
    { ...characters[0], number: 750, ratio: 25 },
    { ...characters[0], number: 950, ratio: null },
    { ...characters[0], number: 100, ratio: 0 },
    { ...characters[0], number: 300, ratio: 25.5 },
  ];
  assert.deepEqual(Array.from(filterAssistCharacters(fixture, "", ["attack_up"], "ratio"), (c) => c.number),
    [600, 300, 750, 700, 800, 100, 950, 900]);
  assert.deepEqual(fixture.map((c) => c.number), [900, 800, 700, 600, 750, 950, 100, 300]);
});

test("ratio order requires attack_up and combines with text and multiple classifications", () => {
  const byRatio = filterAssistCharacters(characters, "25%", ["attack_up", "friendship_up"], "ratio");
  assert.ok(byRatio.length > 0);
  assert.ok(byRatio.every((c) => c.attack_up === 1 && c.friendship_up === 1 && c.assist_skill.includes("25%")));
  assert.deepEqual(Array.from(filterAssistCharacters(characters, "", [], "ratio"), (c) => c.number),
    Array.from(filterAssistCharacters(characters, "", [], "number"), (c) => c.number));
  const allAttack = filterAssistCharacters(characters, "", ["attack_up"], "ratio");
  assert.equal(allAttack[0].number, 8921);
  assert.equal(allAttack[0].ratio, 107);
  assert.ok(allAttack.every((c, i) => i === 0 || allAttack[i - 1].ratio >= c.ratio));
});

test("empty conditions return all characters in numeric descending order without mutating the input", () => {
  const original = characters.map((c) => c.number);
  const results = filterAssistCharacters(characters, "  ", []);
  assert.equal(results.length, 87);
  assert.deepEqual(Array.from(results, (c) => c.number), [...original].sort((a, b) => b - a));
  assert.deepEqual(characters.map((c) => c.number), original);
});

test("classifications use AND and combine with literal trimmed description search", () => {
  const results = filterAssistCharacters(characters, "  25%  ", ["attack_up", "friendship_up"]);
  const expected = characters.filter((c) => c.attack_up === 1 && c.friendship_up === 1 && c.assist_skill.includes("25%"));
  assert.ok(results.length > 0);
  assert.deepEqual(Array.from(results, (c) => c.number), expected.map((c) => c.number).sort((a, b) => b - a));
  assert.equal(filterAssistCharacters(characters, "存在しない説明文", []).length, 0);
});

test("search matches only the description and treats punctuation literally", () => {
  const fixture = [{ ...characters[0], name: "名前のみ", assist_skill: "HPが50%アップ" }];
  assert.equal(filterAssistCharacters(fixture, "名前のみ", []).length, 0);
  assert.equal(filterAssistCharacters(fixture, "50%", []).length, 1);
  assert.equal(filterAssistCharacters(fixture, ".*", []).length, 0);
});
