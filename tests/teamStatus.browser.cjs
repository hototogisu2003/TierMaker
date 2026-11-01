// Usage: node tests/teamStatus.browser.cjs [http://localhost:3100]
// Uses installed Chrome and Node 24. All character requests use local fixtures.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = process.argv[2] || "http://localhost:3100";
const port = 19349;
const chrome = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "team-status-"))}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
let socket;
let browserError;
const timeout = setTimeout(() => { console.error("Browser test timed out"); socket?.close(); chrome.kill(); process.exit(1); }, 120000);
chrome.on("error", (error) => { browserError = error; });

async function main() {
  let pages;
  for (let i = 0; i < 100; i++) {
    if (browserError) throw browserError;
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert.ok(pages, "Chrome must start");
  console.log("Chrome ready");
  socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const fixture = {
    id: "test-status", name: "ステータステスト", name_kana: "すてーたすてすと", hp: 20000, attack: 25000, speed: 300.25,
    shuzoku: "妖精", gekishu: "反射", senkei: "バランス", ゲージ: 1, element: "火", obtain: "ガチャ",
    gacha: "恒常", form: "獣神化", get: 1, number: 1, icon_path: `${base}/icon/icon_火.png`,
  };
  const fixtures = [fixture, ...["15", "16", "155", "true-test"].map((id) => ({
    ...fixture, id, name: `特殊キャラ${id}`, form: "真獣神化", shuzoku: "神",
  }))];
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const promise = pending.get(event.id); pending.delete(event.id);
      if (event.error) promise.reject(new Error(event.error.message)); else promise.resolve(event.result);
    } else if (event.method === "Fetch.requestPaused") {
      void send("Fetch.fulfillRequest", { requestId: event.params.requestId, responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Headers", value: "apikey,authorization,content-type,x-client-info,accept-profile" },
          { name: "Access-Control-Allow-Methods", value: "GET,OPTIONS" },
        ],
        body: Buffer.from(JSON.stringify(event.params.request.url.includes("hp") ? fixtures : [])).toString("base64"),
      });
    }
  };
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText.slice(-2500)")}`);
  };
  const click = async (text) => {
    assert.equal(await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); b?.click(); return !!b; })()`), true, text);
    await delay(100);
  };
  const stats = (rank = "1st") => `document.querySelector('[aria-label="${rank}のステータスを変更"]')`;
  const values = async () => evaluate("[...document.querySelectorAll('dialog input')].filter(i => i.closest('label').textContent.trim() !== '使用回数').map(i => i.value)");
  const setValues = async (numbers) => {
    await evaluate(`(() => { const inputs = [...document.querySelectorAll('dialog input')].filter(i => i.closest('label').textContent.trim() !== '使用回数'); ${JSON.stringify(numbers)}.forEach((v, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[i], String(v));
      inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
    }); })()`);
  };
  const open = async (rank = "1st") => {
    await evaluate(`${stats(rank)}.click()`);
    await waitFor("document.querySelector('dialog')?.open");
  };
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/*" }] });
  console.log("Fixture interception ready");
  await send("Page.enable");
  const oldShare = { title: "ステータス回帰テスト", mainSpot: "火", slots: [{ slotIndex: 0, characterId: fixture.id, fruits: ["同族加撃"] }] };
  await send("Page.navigate", { url: `${base}/TeamBuild/memo?share=b64.${Buffer.from(JSON.stringify(oldShare)).toString("base64url")}` });
  await waitFor(`${stats()}?.textContent.includes('30000')`);
  console.log("Legacy share loaded");
  assert.equal(await evaluate(`${stats()}.textContent.includes('36000')`), true);
  await open();
  assert.deepEqual(await values(), ["20000", "0", "25000", "0", "300.25"]);
  await setValues([22000, 1500, 27000, 1000, 315.75]);
  assert.equal(await evaluate(`${stats()}.textContent.includes('25500')`), true, "valid edits apply before closing");
  assert.equal(await evaluate("[...document.querySelectorAll('dialog button')].map(b => b.textContent.trim()).join(',')"), "閉じる");
  await click("閉じる");
  await waitFor("!document.querySelector('dialog')");
  const text = await evaluate(`${stats()}.textContent`);
  for (const value of ["25500", "33000", "39600", "356.55"]) assert.ok(text.includes(value), text);
  assert.equal(await evaluate("document.querySelector('[class*=exportTotalHp]').textContent"), "HP：25,500");
  assert.equal(await evaluate("document.querySelector('[class*=exportSheet] [class*=statsGrid]').textContent.includes('39600')"), true);
  await open();
  assert.deepEqual(await values(), ["22000", "1500", "27000", "1000", "315.75"]);
  await setValues([1, 2, 3, 4, 5]);
  await click("閉じる");
  await open();
  assert.deepEqual(await values(), ["1", "2", "3", "4", "5"]);
  await setValues([22000, 1500, 27000, 1000, 315.75]);
  await setValues([-1, 1500, 27000, 1000, 315.75]);
  assert.equal(await evaluate("document.querySelector('dialog').open"), true);
  assert.equal(await evaluate(`${stats()}.textContent.includes('25500')`), true, "invalid edits preserve the last valid stats");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog')");
  await click("保存");
  await waitFor("document.body.textContent.includes('編成を保存しました')");
  const saved = await evaluate(`new Promise((resolve, reject) => { const req = indexedDB.open('ms-team-custom-db', 2); req.onsuccess = () => {
    const get = req.result.transaction('teams').objectStore('teams').getAll(); get.onsuccess = () => resolve(get.result[0]); get.onerror = reject;
  }; req.onerror = reject; })`);
  assert.deepEqual(saved.slots[0].status, { hp: 22000, attack: 27000, speed: 315.75, assistHp: 1500, assistAttack: 1000 });
  await send("Page.navigate", { url: `${base}/TeamBuild/team?edit=${saved.id}` });
  await waitFor(`${stats()}?.textContent.includes('39600')`);
  await open();
  assert.deepEqual(await values(), ["22000", "1500", "27000", "1000", "315.75"]);
  await click("閉じる");
  await evaluate(`window.__sharedUrl = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__sharedUrl = text; } } });`);
  await click("画像・URL生成");
  await click("URLコピー");
  await waitFor("window.__sharedUrl");
  const shareUrl = await evaluate("window.__sharedUrl");
  const target = new URL(shareUrl); target.host = new URL(base).host; target.protocol = new URL(base).protocol;
  await send("Page.navigate", { url: target.toString() });
  await waitFor(`${stats()}?.textContent.includes('39600')`);
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await open();
  assert.deepEqual(await values(), ["22000", "1500", "27000", "1000", "315.75"]);
  assert.equal(await evaluate("document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth"), true);
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/team-status-mobile.png"), Buffer.from(screenshot.data, "base64"));
  await click("閉じる");
  await evaluate("document.querySelector('[aria-label=\"1stを下へ移動\"]').click()");
  await waitFor(`${stats("2nd")}?.textContent.includes('39600')`);
  await open("2nd");
  assert.deepEqual(await values(), ["22000", "1500", "27000", "1000", "315.75"]);
  await click("閉じる");
  await click("使用回数最大");
  await waitFor(`${stats("2nd")}.children[1].textContent === '26500'`);
  assert.equal(await evaluate("document.querySelector('[class*=exportTotalHp]').textContent"), "HP：26,500");
  assert.equal(await evaluate(`${stats("2nd")}.children[2].textContent`), "(+4500)");
  assert.equal(await evaluate(`${stats("2nd")}.children[5].textContent`), "(+6000)");
  await open("2nd");
  assert.equal(await evaluate("[...document.querySelectorAll('dialog label')].find(l => l.textContent.trim() === '使用回数').querySelector('input').value"), "1000");
  const usageScreenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/team-usage-mobile.png"), Buffer.from(usageScreenshot.data, "base64"));
  await evaluate(`(() => {
    for (const name of ['使用回数', 'HPアシスト加算', '攻撃力アシスト加算']) {
      const input = [...document.querySelectorAll('dialog label')].find(l => l.textContent.trim() === name).querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  assert.equal(await evaluate("document.querySelector('dialog [role=alert]') === null"), true, "blank assist and usage fields must not warn");
  assert.equal(await evaluate(`${stats("2nd")}.children[1].textContent`), "24000", "blank additions count as zero");
  assert.equal(await evaluate(`${stats("2nd")}.children[4].textContent.includes('32000')`), true);
  await setValues([22000, 1500, 27000, 1000, 315.75]);
  await evaluate(`(() => { const input = [...document.querySelectorAll('dialog label')].find(l => l.textContent.trim() === '使用回数').querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '250');
    input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click("閉じる");
  await waitFor(`${stats("2nd")}.children[1].textContent === '25750'`);
  await click("保存");
  await waitFor("document.body.textContent.includes('編成を保存しました')");
  const usageSavedId = await evaluate(`new Promise((resolve, reject) => { const req = indexedDB.open('ms-team-custom-db', 2); req.onsuccess = () => {
    const get = req.result.transaction('teams').objectStore('teams').getAll();
    get.onsuccess = () => resolve(get.result.find(r => r.slots[1]?.usageHp === 250)?.id); get.onerror = reject;
  }; req.onerror = reject; })`);
  assert.ok(usageSavedId, "individual usage HP must be persisted");
  await send("Page.navigate", { url: `${base}/TeamBuild/team?edit=${usageSavedId}` });
  await waitFor(`${stats("2nd")}?.children[1].textContent === '25750'`);
  await evaluate(`window.__sharedUrl = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__sharedUrl = text; } } });`);
  await click("画像・URL生成");
  await click("URLコピー");
  await waitFor("window.__sharedUrl");
  const usageUrl = new URL(await evaluate("window.__sharedUrl"));
  usageUrl.host = new URL(base).host; usageUrl.protocol = new URL(base).protocol;
  await send("Page.navigate", { url: usageUrl.toString() });
  await waitFor(`${stats("2nd")}?.children[1].textContent === '25750'`);
  await open("2nd");
  assert.equal(await evaluate("[...document.querySelectorAll('dialog label')].find(l => l.textContent.trim() === '使用回数').querySelector('input').value"), "250");
  await click("閉じる");
  const supportShare = {
    title: "HPサポートテスト", mainSpot: "火",
    slots: ["15", fixture.id, "true-test", "155"].map((characterId, slotIndex) => ({
      slotIndex, characterId, fruits: slotIndex === 1 ? ["同族加命"] : [],
      status: slotIndex === 1 ? { hp: 20001, attack: 25000, speed: 300.25, assistHp: 1500, assistAttack: 0 } : undefined,
    })),
  };
  await send("Page.navigate", { url: `${base}/TeamBuild/memo?share=b64.${Buffer.from(JSON.stringify(supportShare)).toString("base64url")}` });
  const hp = (rank) => `${stats(rank)}?.children[1].firstElementChild.firstElementChild.textContent`;
  await waitFor(`${hp("2nd")} === '39001'`);
  assert.equal(await evaluate(`${stats("2nd")}.children[1].textContent`), "39001（×1.5）");
  assert.equal(await evaluate(`${stats("2nd")}.children[2].textContent`), "(+6000)");
  assert.equal(await evaluate(hp("1st")), "22000");
  assert.equal(await evaluate(hp("3rd")), "22000");
  assert.equal(await evaluate(hp("4th")), "22000");
  assert.equal(await evaluate("document.querySelector('[class*=exportTotalHp]').textContent"), "HP：105,001");
  assert.equal(await evaluate("[...document.querySelectorAll('[class*=exportSheet] [class*=statsGrid]')].some(g => g.children[1].textContent === '39001（×1.5）' && g.children[2].textContent === '(+6000)')"), true);
  await click("使用回数最大");
  await waitFor(`${hp("2nd")} === '40501'`);
  assert.equal(await evaluate(`${stats("2nd")}.children[2].textContent`), "(+7000)");
  assert.equal(await evaluate("document.querySelector('[class*=exportTotalHp]').textContent"), "HP：109,501");
  await click("使用回数最大");
  await waitFor(`${hp("2nd")} === '39001'`);
  const hpScreenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(__dirname, "../.next/team-hp-support-mobile.png"), Buffer.from(hpScreenshot.data, "base64"));
  // Editing base HP must not start from the support-multiplied display value.
  await open("2nd");
  assert.deepEqual(await values(), ["20001", "1500", "25000", "0", "300.25"]);
  await click("閉じる");
  await waitFor(`${hp("2nd")} === '39001'`);
  await evaluate("document.querySelector('[aria-label=\"1stを解除\"]').click()");
  await waitFor(`${hp("2nd")} === '32501'`);
  assert.equal(await evaluate(`${stats("2nd")}.children[1].textContent`), "32501（×1.25）");
  assert.equal(await evaluate(`${stats("2nd")}.children[2].textContent`), "(+6000)");
  await evaluate("document.querySelector('[aria-label=\"4thを解除\"]').click()");
  await waitFor(`${hp("2nd")} === '26001'`);
  assert.equal(await evaluate(`${stats("2nd")}.children[1].textContent`), "26001");
  const legacyMaxShare = { ...supportShare, maxUsageUsed: true, slots: [
    { slotIndex: 0, characterId: "16" }, supportShare.slots[1],
  ] };
  await send("Page.navigate", { url: `${base}/TeamBuild/memo?share=b64.${Buffer.from(JSON.stringify(legacyMaxShare)).toString("base64url")}` });
  await waitFor(`${hp("2nd")} === '27001'`);
  assert.equal(await evaluate("document.querySelector('[class*=exportTotalHp]').textContent"), "HP：50,001");
  console.log("PASS: status editing, per-character usage autofill/edit/save/share, legacy maximum migration, additions display, mobile, slot movement; HP support priority/exclusions, rounding, export/total HP, no double application");
  await send("Browser.close");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { clearTimeout(timeout); socket?.close(); chrome.kill(); });
