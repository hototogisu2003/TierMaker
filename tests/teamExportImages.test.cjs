const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(fs.readFileSync(require("node:path").resolve(__dirname, "../lib/teamcustom/exportImages.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(policy = () => ({ ok: true, status: 200, payload: "VALID" }), decode) {
  const calls = new Map();
  let active = 0;
  let peak = 0;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, AbortController, setTimeout, clearTimeout,
    FileReader: class {
      readAsDataURL(blob) { this.result = `data:image/png;base64,${blob.payload}`; queueMicrotask(() => this.onload()); }
    },
    Image: class {
      async decode() { if (decode) return decode(); if (this.src.includes("CORRUPT")) throw new Error("Invalid image"); }
    },
    fetch: async (url, { signal }) => {
      signal.throwIfAborted();
      const count = (calls.get(url) || 0) + 1; calls.set(url, count);
      active += 1; peak = Math.max(peak, active);
      try {
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(signal.reason); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 5);
          signal.addEventListener("abort", abort, { once: true });
        });
        const response = policy(url, count);
        if (response instanceof Error) throw response;
        return { ...response, blob: async () => ({ payload: response.payload }) };
      } finally { active -= 1; }
    },
  });
  return { load: exports.loadExportImages, calls, peak: () => peak };
}

test("duplicate URLs are fetched once and decoded successes are reused in later previews", async () => {
  const loader = setup();
  const cache = new Map();
  const sources = Array.from({ length: 100 }, (_, i) => ({ url: `https://image.test/${i % 3}.png`, label: `slot ${i}` }));
  const progress = [];
  const result = await loader.load(sources, cache, new AbortController().signal, (completed, total) => progress.push([completed, total]));
  assert.equal(result.images.size, 3);
  assert.equal(result.failures.length, 0);
  assert.deepEqual([...loader.calls.values()], [1, 1, 1]);
  assert.deepEqual(progress.at(-1), [3, 3]);
  await loader.load(sources, cache, new AbortController().signal, () => {});
  assert.deepEqual([...loader.calls.values()], [1, 1, 1]);
});

test("120 distinct images finish before returning with a maximum of four concurrent requests", async () => {
  const loader = setup();
  const sources = Array.from({ length: 120 }, (_, i) => ({ url: `https://image.test/${i}.png`, label: `${i}` }));
  const result = await loader.load(sources, new Map(), new AbortController().signal, () => {});
  assert.equal(result.images.size, 120);
  assert.equal(loader.peak(), 4);
  assert.equal(loader.calls.size, 120);
});

test("HTTP errors, network errors and corrupt image data retry and recover", async () => {
  const loader = setup((url, count) => {
    if (count === 1 && url.endsWith("http.png")) return { ok: false, status: 429 };
    if (count === 1 && url.endsWith("network.png")) return new Error("Connection interrupted");
    return { ok: true, status: 200, payload: count === 1 && url.endsWith("corrupt.png") ? "CORRUPT" : "VALID" };
  });
  const sources = ["http", "network", "corrupt"].map(name => ({ url: `https://image.test/${name}.png`, label: name }));
  const result = await loader.load(sources, new Map(), new AbortController().signal, () => {});
  assert.equal(result.images.size, 3);
  assert.equal(result.failures.length, 0);
  assert.deepEqual([...loader.calls.values()], [2, 2, 2]);
});

test("permanent failures stop after three attempts, retain all target labels and are not cached", async () => {
  let failing = true;
  const loader = setup(() => ({ ok: !failing, status: failing ? 503 : 200, payload: "VALID" }));
  const sources = [{ url: "https://image.test/shared.png", label: "team A: quest" }, { url: "https://image.test/shared.png", label: "team B: character 2" }];
  const cache = new Map();
  const result = await loader.load(sources, cache, new AbortController().signal, () => {});
  assert.equal(result.images.size, 0);
  assert.equal(cache.size, 0);
  assert.equal(loader.calls.get(sources[0].url), 3);
  assert.deepEqual(Array.from(result.failures[0].labels), sources.map(s => s.label));
  failing = false;
  const recovered = await loader.load(sources, cache, new AbortController().signal, () => {});
  assert.equal(recovered.images.size, 1);
  assert.equal(recovered.failures.length, 0);
  assert.equal(loader.calls.get(sources[0].url), 4);
});

test("closing the preview cancels pending requests without turning cancellation into failures", async () => {
  const loader = setup();
  const controller = new AbortController();
  const sources = Array.from({ length: 20 }, (_, i) => ({ url: `https://image.test/${i}.png`, label: `${i}` }));
  const pending = loader.load(sources, new Map(), controller.signal, () => {});
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.ok(loader.calls.size <= 4);
});

test("cancellation also stops a stalled decode instead of keeping the preview loading", async () => {
  const loader = setup(undefined, () => new Promise(() => {}));
  const controller = new AbortController();
  const pending = loader.load([{ url: "data:image/png;base64,VALID", label: "uploaded icon" }], new Map(), controller.signal, () => {});
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
});
