// Usage: node tests/crestSprite.browser.cjs [http://localhost:3100]
// Requires installed Chrome; Supabase requests are replaced with local fixtures.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const base = process.argv[2] || "http://localhost:3100";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "crest-sprite-"));
const chrome = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=19350", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
let socket;
let browserError;
chrome.on("error", (error) => { browserError = error; });
const timeout = setTimeout(() => { console.error("Browser test timed out"); chrome.kill(); process.exit(1); }, 120000);

async function main() {
  let pages;
  for (let i = 0; i < 100; i++) {
    if (browserError) throw browserError;
    try { pages = await (await fetch("http://127.0.0.1:19350/json/list", { signal: AbortSignal.timeout(1000) })).json(); break; } catch { await delay(100); }
  }
  assert.ok(pages, "Chrome must start");
  console.log("Chrome ready");
  socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  console.log("Chrome debugger connected");
  let serial = 0;
  const pending = new Map();
  const requests = [];
  const spriteResponses = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const fixture = { id: "crest-test", name: "紋章テスト", hp: 20000, attack: 25000, speed: 300,
    shuzoku: "妖精", gekishu: "反射", senkei: "バランス", element: "火", obtain: "ガチャ",
    gacha: "恒常", form: "獣神化", get: 1, number: 1,
    icon_path: `${base}/icon/icon_HP.png` };
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const promise = pending.get(event.id); pending.delete(event.id);
      if (event.error) promise.reject(new Error(event.error.message)); else promise.resolve(event.result);
    } else if (event.method === "Network.requestWillBeSent") {
      requests.push(event.params.request.url);
    } else if (event.method === "Network.responseReceived" && event.params.response.url.includes("soulskill-sprite")) {
      spriteResponses.push(event.params.response);
    } else if (event.method === "Fetch.requestPaused") {
      void send("Fetch.fulfillRequest", { requestId: event.params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Headers", value: "apikey,authorization,content-type,x-client-info,accept-profile" },
          { name: "Access-Control-Allow-Methods", value: "GET,OPTIONS" }],
        body: Buffer.from(JSON.stringify(event.params.request.url.includes("hp") ? [fixture] : [])).toString("base64") });
    }
  };
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText.slice(0, 2500)")}`);
  };
  await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/*" }] });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const share = { title: "紋章スプライト検証", slots: [0, 1, 2, 2].map((grade, slotIndex) => ({
    slotIndex, characterId: fixture.id, crests: ["対火の心得", "対兵の心得", "精神力", "NP耐性"],
    crestGrades: { "対火の心得": grade, "対兵の心得": grade, "精神力": grade, "NP耐性": grade === 1 ? 0 : grade },
  })) };
  await send("Page.navigate", { url: `${base}/TeamBuild/memo?share=b64.${Buffer.from(JSON.stringify(share)).toString("base64url")}` });
  await waitFor("document.querySelector('[data-crest-id=\"1\"][data-crest-grade=\"2\"] img')?.complete && document.querySelector('[data-crest-id=\"1\"][data-crest-grade=\"2\"] img')?.naturalWidth === 800");
  assert.equal(await evaluate("new Set([...document.querySelectorAll('[data-crest-id] img')].map(i => i.src)).size"), 1);
  assert.equal(requests.filter((url) => url.includes("soulskill-sprite")).length, 1, "all icons share one initial image request");
  assert.equal(requests.some((url) => /\/soulskill\/skill_\d+_\d\.png/.test(url)), false);
  await waitFor("[...document.querySelectorAll('[data-element] img')].length === 6 && [...document.querySelectorAll('[data-element] img')].every(i => i.complete && i.naturalWidth === 768)");
  assert.equal(requests.filter((url) => url.includes("element-sprite")).length, 1, "six elements share one initial image request");
  assert.equal(requests.some((url) => /\/icon\/icon_(全|火|水|木|光|闇)\.(png|avif)/.test(decodeURI(url))), false);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-element]')].map(i => i.getAttribute('aria-label'))"), ["全属性", "火属性", "水属性", "木属性", "光属性", "闇属性"]);
  assert.equal(await evaluate("[...document.querySelectorAll('[data-element]')].every(i => getComputedStyle(i).width === '22px' && getComputedStyle(i).height === '22px')"), true);
  await evaluate("document.querySelector('[data-element=\"火\"]').closest('button').click()");
  await waitFor("document.querySelector('[data-element=\"火\"]').closest('button').dataset.selected === '1'");
  await evaluate("document.querySelector('[data-element=\"all\"]').closest('button').click()");
  await waitFor("document.querySelector('[data-element=\"all\"]').closest('button').dataset.selected === '1'");
  for (const grade of [0, 1, 2]) {
    assert.ok(await evaluate(`document.querySelector('[data-crest-id="1"][data-crest-grade="${grade}"]')?.getBoundingClientRect().width > 0`));
  }
  const desktop = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/crest-sprite-desktop.png"), Buffer.from(desktop.data, "base64"));
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '画像・URL生成').click()");
  await waitFor("document.querySelector('img[alt=\"PNGプレビュー\"]')?.naturalWidth > 0");
  const png = await evaluate("document.querySelector('img[alt=\"PNGプレビュー\"]').src");
  fs.writeFileSync(path.join(__dirname, "../.next/crest-sprite-export.png"), Buffer.from(png.split(",")[1], "base64"));
  assert.equal(new Set(requests.filter((url) => url.includes("soulskill-sprite"))).size, 1, "export must not add cache-busting URLs");
  assert.ok(spriteResponses.every((response) => response.status === 200));
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる' && b.closest('[class*=arrangeDialog]'))?.click()");
  await delay(500);
  const mobile = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/crest-sprite-mobile.png"), Buffer.from(mobile.data, "base64"));
  console.log("PASS: one initial request per crest/element sprite, no individual icon requests, six element labels/sizes and filter selection, grades 0/1/2, PNG export, desktop/mobile captures");
  await send("Browser.close");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  clearTimeout(timeout); socket?.close(); chrome.kill();
});
