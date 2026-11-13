// Usage: node tests/teamListExport.browser.cjs [http://localhost:3100]
// Chrome + Node 24; uses an isolated profile and local IndexedDB fixtures.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const base = process.argv[2] || "http://localhost:3100";
const port = 19351;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "team-list-export-"))}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
let socket;
const timeout = setTimeout(() => { console.error("Timed out"); chrome.kill(); process.exit(1); }, 120000);
async function main() {
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert.ok(pages);
  socket = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  let downloadName;
  let downloadComplete = false;
  socket.onmessage = ({ data }) => {
    const e = JSON.parse(data);
    if (e.id) {
      const p = pending.get(e.id); pending.delete(e.id);
      if (e.error) p.reject(new Error(e.error.message)); else p.resolve(e.result);
    } else if (e.method === "Fetch.requestPaused") {
      void send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: 200,
        responseHeaders: [ { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Headers", value: "apikey,authorization,content-type,x-client-info,accept-profile" },
          { name: "Access-Control-Allow-Methods", value: "GET,OPTIONS" } ], body: Buffer.from("[]").toString("base64") });
    } else if (e.method === "Browser.downloadWillBegin") downloadName = e.params.suggestedFilename;
    else if (e.method === "Browser.downloadProgress" && e.params.state === "completed") downloadComplete = true;
  };
  const evaluate = async expression => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText.slice(-1500)")}`);
  };
  const click = async label => {
    assert.equal(await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); b?.click(); return !!b; })()`), true, label);
    await delay(100);
  };
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/*" }] });
  await send("Page.navigate", { url: `${base}/TeamBuild/list` });
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent === '一覧表示')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === '一覧表示').disabled"), true);
  const records = Array.from({ length: 21 }, (_, i) => ({
    id: `overview-${i}`, title: i === 0 ? "長い編成タイトルの表示を確認・禁忌の獄と天魔の孤城のための編成メモ" : `テスト編成${i + 1}`,
    targetQuestId: "quest", targetQuestName: "クエスト", targetQuestIconUrl: i === 1 ? null : `${base}/icon/icon_火.png`,
    shugojuName: "守護獣", shugojuIconUrl: i === 1 ? null : `${base}/icon/icon_水.png`,
    slots: [3, 1, 0, 2].map(slotIndex => ({ slotIndex, characterId: String(slotIndex), characterName: `キャラ${slotIndex + 1}`,
      iconUrl: i === 1 && slotIndex === 2 ? "" : i === 2 ? `${base}/missing-overview-image.png` : `${base}/icon/icon_木.png`, fruits: [], crests: [] })),
    createdAt: new Date(Date.UTC(2026, 10, 14, 0, 0, i)).toISOString(),
  }));
  // Insert through the same store as the app; transaction completion ensures reload sees all records.
  await evaluate(`new Promise((resolve, reject) => { const req = indexedDB.open('ms-team-custom-db', 2);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('teams', { keyPath: 'id' });
      req.result.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => { try {
    const db = req.result; const tx = db.transaction(['teams', 'settings'], 'readwrite');
    for (const r of ${JSON.stringify(records)}) tx.objectStore('teams').put(r);
    tx.objectStore('settings').put({ key: 'arrangeIds', value: ${JSON.stringify(records.map(r => r.id))} });
    tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = reject;
  } catch (error) { reject(error); } }; req.onerror = reject; })`);
  await send("Page.reload");
  await waitFor("document.body.innerText.includes('21/50件')");
  await click("一覧表示");
  await waitFor("document.querySelectorAll('#team-overview-selection input').length === 21");
  assert.equal(await evaluate("document.querySelector('dialog').open && document.querySelector('dialog').contains(document.querySelector('#team-overview-selection'))"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'プレビューを表示').disabled"), true);
  await click("先頭20件を選択");
  assert.equal(await evaluate("document.querySelectorAll('#team-overview-selection input:checked').length"), 20);
  assert.equal(await evaluate("document.querySelectorAll('#team-overview-selection input:disabled').length"), 1);
  // Excluding one selection must allow a different team to take its place.
  await evaluate("document.querySelector('#team-overview-selection input').click()");
  assert.equal(await evaluate("document.querySelectorAll('#team-overview-selection input:disabled').length"), 0);
  await click("先頭20件を選択");
  const downloadDir = path.resolve(__dirname, "../.next/team-list-downloads");
  fs.mkdirSync(downloadDir, { recursive: true });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });
  await click("プレビューを表示");
  await waitFor("document.querySelector('dialog img')?.src.startsWith('data:image/png')");
  const dimensions = await evaluate("({width: document.querySelector('dialog img').naturalWidth, height: document.querySelector('dialog img').naturalHeight})");
  assert.equal(dimensions.width, 1080);
  assert.equal(dimensions.height, await evaluate("Math.round(document.querySelector('[class*=exportSheet]').getBoundingClientRect().height * 1080 / 1000)"));
  assert.equal(await evaluate("document.querySelectorAll('[class*=exportSheet] > [class*=exportRow]').length"), 20);
  assert.deepEqual(await evaluate("[...document.querySelector('[class*=exportSheet] > [class*=exportRow]').children].flatMap(c => c.matches('[class*=teamIcons]') ? [...c.children] : [c]).map(c => c.textContent || c.alt || c.getAttribute('aria-label'))"),
    ["クエスト", records[0].title, "キャラ1", "キャラ2", "キャラ3", "キャラ4", "守護獣"]);
  await click("画像保存");
  for (let i = 0; i < 100 && !downloadComplete; i++) await delay(100);
  assert.ok(downloadComplete, "PNG download must complete");
  const png = fs.readFileSync(path.join(downloadDir, downloadName));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1080);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog')");
  await click("一覧表示");
  await waitFor("document.querySelector('dialog')?.open");
  await click("選択解除");
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('#team-overview-selection input').click()");
  await click("プレビューを表示");
  await waitFor("document.querySelector('dialog img')?.naturalWidth === 1080");
  assert.equal(await evaluate("document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth"), true);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.resolve(__dirname, "../.next/team-list-mobile.png"), Buffer.from(shot.data, "base64"));
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '削除')"), false, "top delete button must be removed");
  assert.equal(await evaluate("document.querySelectorAll('button[title=\"編成を削除\"]').length"), 21);
  assert.equal(await evaluate("document.querySelector('button[title=\"編成を削除\"]').previousElementSibling.title"), "編成を編集");
  await evaluate("document.querySelector('button[title=\"編成を削除\"]').click()");
  await waitFor("document.querySelector('dialog[aria-labelledby=remove-team-title]')?.open");
  assert.equal(await evaluate(`document.querySelector('#remove-team-description').textContent.includes(${JSON.stringify(records[0].title)})`), true);
  const deleteShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.resolve(__dirname, "../.next/team-delete-mobile.png"), Buffer.from(deleteShot.data, "base64"));
  await click("キャンセル");
  assert.equal(await evaluate("document.querySelectorAll('button[title=\"編成を削除\"]').length"), 21);
  await evaluate("document.querySelector('button[title=\"編成を削除\"]').click()");
  await waitFor("document.querySelector('dialog')?.open");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog')");
  assert.equal(await evaluate("document.querySelectorAll('button[title=\"編成を削除\"]').length"), 21);
  await evaluate("document.querySelector('button[title=\"編成を削除\"]').click()");
  await waitFor("document.querySelector('dialog')?.open");
  await click("削除");
  await waitFor("!document.querySelector('dialog') && document.querySelectorAll('button[title=\"編成を削除\"]').length === 20");
  assert.equal(await evaluate(`new Promise((resolve, reject) => { const req = indexedDB.open('ms-team-custom-db', 2); req.onsuccess = () => {
    const get = req.result.transaction('teams').objectStore('teams').get('overview-0');
    get.onsuccess = () => { req.result.close(); resolve(get.result === undefined); }; get.onerror = reject;
  }; req.onerror = reject; })`), true);
  await send("Page.reload");
  await waitFor("document.body.innerText.includes('20/50件')");
  await click("一覧表示");
  await waitFor("document.querySelectorAll('#team-overview-selection input').length === 20");
  assert.equal(await evaluate(`document.querySelector('#team-overview-selection').textContent.includes(${JSON.stringify(records[0].title)})`), false);
  console.log("PASS: overview selection/limit, PNG download, mobile; per-team trash position, confirm title, cancel/Escape, delete persistence and overview synchronization");
  await send("Browser.close");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { clearTimeout(timeout); socket?.close(); chrome.kill(); });
