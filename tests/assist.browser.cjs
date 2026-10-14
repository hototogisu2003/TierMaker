// Usage: node tests/assist.browser.cjs [http://localhost:3100]
// Uses installed Chrome (or CHROME_PATH) and Node 24; no browser package required.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = process.argv[2] || "http://localhost:3100";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "assist-browser-"));
const port = 19338;
const chrome = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
let socket;
let failedApi = false;
let browserError;
chrome.on("error", (error) => { browserError = error; });

async function main() {
  let pages;
  for (let i = 0; i < 100; i++) {
    if (browserError) throw browserError;
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert.ok(pages, "Chrome debugging endpoint must be available");
  socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  const flags = { attack_up: 0, friendship_up: 0, hp_up: 0, ss_shortening: 0, damage_reduction: 0, recovery: 0, barrier_grant: 0, status_grant: 0 };
  const characters = [
    { ...flags, number: 10, ratio: null, name: "名前のみ", assist_skill: "HPが50%アップ", iconUrl: "", hp_up: 1 },
    { ...flags, number: 100, ratio: 25, name: "複合スキル", assist_skill: "攻撃力と友情コンボの威力が25%アップ", iconUrl: `${base}/missing-assist-icon.jpg`, attack_up: 1, friendship_up: 1 },
    { ...flags, number: 20, ratio: 106, name: "長文キャラ", assist_skill: "攻撃力が20%アップ。".repeat(35), iconUrl: "", attack_up: 1 },
  ];
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const promise = pending.get(event.id); pending.delete(event.id);
      if (event.error) promise.reject(new Error(event.error.message)); else promise.resolve(event.result);
    } else if (event.method === "Fetch.requestPaused") {
      const requestId = event.params.requestId;
      void send("Fetch.fulfillRequest", { requestId, responseCode: failedApi ? 500 : 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify(failedApi ? { message: "error" } : { characters })).toString("base64"),
      });
    }
  };
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}`);
  }
  const click = (label) => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(label)}).click()`);
  const open = () => evaluate("document.querySelector('[aria-haspopup=dialog]').click()");
  const search = (text) => evaluate(`(() => { const el=document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(text)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const countIs = (n) => waitFor(`document.querySelector('[role=status]').textContent === '計 ${n}件'`);
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/assist/characters*" }] });
  await send("Page.navigate", { url: `${base}/assist` });
  await countIs(3);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('li h2'),e=>e.textContent)"), ["複合スキル", "長文キャラ", "名前のみ"]);
  await waitFor("document.querySelectorAll('[role=img]').length === 3");
  await open(); await click("攻撃アップ"); await click("友情アップ"); await click("閉じる"); await countIs(3);
  await open(); assert.equal(await evaluate("document.querySelector('[aria-pressed=true]') === null"), true);
  await click("攻撃アップ"); await click("友情アップ"); await click("検索"); await countIs(1);
  await open(); assert.equal(await evaluate("document.querySelectorAll('[aria-pressed=true]').length"), 2);
  await click("攻撃アップ"); await click("友情アップ");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog').open"); await countIs(1);
  assert.equal(await evaluate("document.activeElement.matches('[aria-haspopup=dialog]')"), true);
  await search("  25%  "); await countIs(1);
  await search("名前のみ"); await countIs(0);
  assert.ok(await evaluate("document.body.textContent.includes('条件に一致するキャラクターはありません。')"));
  await click("条件をリセット"); await countIs(3);
  await search("50%");
  assert.equal(await evaluate("document.querySelector('[role=status]').textContent"), "計 3件");
  await countIs(1);
  await click("条件をリセット"); await countIs(3);
  await open(); await click("HPアップ");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
  await waitFor("!document.querySelector('dialog').open"); await countIs(3);
  const ratioInput = "document.querySelector('input[value=ratio]')";
  const numberInput = "document.querySelector('input[value=number]')";
  const names = () => evaluate("Array.from(document.querySelectorAll('li h2'),e=>e.textContent)");
  await open();
  assert.equal(await evaluate(`${ratioInput}.disabled`), true);
  await click("攻撃アップ");
  assert.equal(await evaluate(`${ratioInput}.disabled`), false);
  await evaluate(`${ratioInput}.click()`); await click("閉じる"); await countIs(3);
  await open(); assert.equal(await evaluate(`${numberInput}.checked && ${ratioInput}.disabled`), true);
  await click("攻撃アップ"); await evaluate(`${ratioInput}.click()`); await click("検索"); await countIs(2);
  assert.deepEqual(await names(), ["長文キャラ", "複合スキル"]);
  await open(); assert.equal(await evaluate(`${ratioInput}.checked`), true);
  await click("攻撃アップ");
  assert.equal(await evaluate(`${numberInput}.checked && ${ratioInput}.disabled`), true);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog').open");
  assert.deepEqual(await names(), ["長文キャラ", "複合スキル"]);
  await open(); await click("友情アップ"); await click("検索"); await countIs(1);
  await click("条件をリセット"); await countIs(3);
  await open(); assert.equal(await evaluate(`${numberInput}.checked && ${ratioInput}.disabled`), true);
  await click("攻撃アップ"); await evaluate(`${ratioInput}.click()`); await click("攻撃アップ"); await click("攻撃アップ");
  assert.equal(await evaluate(`${numberInput}.checked`), true);
  await click("検索"); await countIs(2);
  assert.deepEqual(await names(), ["複合スキル", "長文キャラ"]);
  await click("条件をリセット"); await countIs(3);
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await open();
  await waitFor("document.querySelector('dialog').open");
  assert.equal(await evaluate("document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth"), true);
  const modalScreenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/assist-sort-mobile.png"), Buffer.from(modalScreenshot.data, "base64"));
  await evaluate("document.querySelector('dialog button:last-of-type').focus()");
  for (let i = 0; i < 14; i++) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.querySelector('dialog').contains(document.activeElement) || document.activeElement === document.body"), true);
  }
  await click("閉じる");
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/assist-mobile.png"), Buffer.from(screenshot.data, "base64"));
  failedApi = true;
  await send("Page.reload", { ignoreCache: true });
  await waitFor("document.querySelector('[role=alert]') !== null");
  failedApi = false; await click("再試行"); await countIs(3);
  console.log("PASS: numeric ratio sort, disabled/reenabled controls, apply/discard/reset, image fallback, AND search, debounce, Escape/backdrop, focus, mobile layout, API error/retry");
  await send("Browser.close");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome.kill();
  // The temporary Chrome profile is left to the operating system's temp cleanup.
});
