const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function loadTs(relativePath, globals, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    ...globals,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

test("assist reload bypasses the server data cache and returns updated Supabase ratios", async () => {
  let databaseRatio = 10;
  let cachedBody;
  const requests = [];
  const mockFetch = async (input, init) => {
    requests.push({ url: String(input), cache: init.cache });
    // Model a server cache that otherwise keeps the first database response.
    const body = JSON.stringify([{
      number: 9402, name: "アラジン", file_path: "", assist_skill: "攻撃力が10%アップ",
      ratio: databaseRatio, attack_up: 1, friendship_up: 0, hp_up: 0,
      ss_shortening: 0, damage_reduction: 0, recovery: 0, barrier_grant: 0, status_grant: 0,
    }]);
    if (cachedBody === undefined) cachedBody = body;
    return new Response(init.cache === "no-store" ? body : cachedBody, {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  const globals = {
    fetch: mockFetch,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://assist-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key" } },
  };
  const client = loadTs("lib/supabase/server.ts", globals);
  const characters = loadTs("lib/assist/characters.ts", globals);
  const { loadAssistCharacters } = loadTs("lib/assist/server.ts", globals, {
    "server-only": {}, "@/lib/supabase/server": client, "./characters": characters,
  });
  assert.equal((await loadAssistCharacters())[0].ratio, 10);
  databaseRatio = 110;
  assert.equal((await loadAssistCharacters())[0].ratio, 110);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.cache === "no-store"));
  assert.ok(requests.every((request) => new URL(request.url).searchParams.get("select").includes("ratio")));
});
