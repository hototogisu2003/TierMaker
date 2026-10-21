// Usage: node tests/damageCalc.browser.cjs [http://localhost:3100]
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const base = process.argv[2] || 'http://localhost:3100';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'damage-calc-browser-'));
const port = 19349;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--remote-allow-origins=*', '--in-process-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const timeout = setTimeout(() => { console.error('Browser test timed out'); chrome.kill(); process.exit(1); }, 90000);
let socket;
let browserError;
chrome.on('error', error => { browserError = error; });

async function main() {
  let pages;
  for (let i = 0; i < 100; i++) {
    if (browserError) throw browserError;
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; }
    catch { await delay(100); }
  }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  socket.onclose = () => { for (const promise of pending.values()) promise.reject(new Error('Browser connection closed')); };
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (!event.id) return;
    const promise = pending.get(event.id);
    pending.delete(event.id);
    if (event.error) promise.reject(new Error(event.error.message));
    else promise.resolve(event.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    console.error(await evaluate("document.body.innerText.slice(-1600)"));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await delay(50);
  };
  const clickText = async text => {
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(text)}).click()`);
    await delay(50);
  };
  const input = async (index, value) => {
    await evaluate(`(() => {
      const el = document.querySelectorAll('input.uiInput')[${index}];
      el.focus();
      el.select();
    })()`);
    await send('Input.insertText', { text: value });
    await delay(50);
  };
  const total = number => waitFor(`document.querySelector('[aria-controls="damage-calc-breakdown"]').textContent.includes(${JSON.stringify(number.toLocaleString('ja-JP'))})`);
  await send('Page.enable');
  await send('Page.navigate', { url: `${base}/damage-calc` });
  await waitFor('document.querySelectorAll("input.uiInput").length > 1');
  await delay(500);
  await input(0, '100');
  await total(100);
  await clickText('+ 追加');
  await waitFor('document.querySelector("[aria-label=攻撃2]").getAttribute("aria-pressed") === "true"');
  await total(200);
  assert.equal(await evaluate('document.querySelector("input.uiInput").value'), '100');
  await input(0, '250');
  await total(350);
  await click('[aria-label="攻撃1"]');
  assert.equal(await evaluate('document.querySelector("input.uiInput").value'), '100');
  assert.equal(await evaluate('document.querySelector("[aria-label=攻撃1を削除]")'), null);
  // Adding while attack 1 is selected must still copy the last attack (2).
  await clickText('+ 追加');
  await total(600);
  assert.equal(await evaluate('document.querySelector("input.uiInput").value'), '250');
  await input(0, '400');
  await total(750);
  await click('[aria-controls="damage-calc-breakdown"]');
  await waitFor('document.querySelector("dialog").open');
  assert.equal(await evaluate('document.querySelectorAll("dialog section").length'), 1);
  for (const [number, damage] of [[1, 100], [2, 250], [3, 400]]) {
    await click(`[aria-label="攻撃${number}の内訳を表示"]`);
    assert.equal(await evaluate('document.querySelector("#selected-attack-breakdown h4").textContent'), `攻撃${number}${damage}`);
    await total(750);
  }
  assert.equal(await evaluate('Math.round(document.querySelector("dialog").getBoundingClientRect().height) === innerHeight'), true);
  await click('[aria-label="計算結果を閉じる"]');
  await waitFor('!document.querySelector("dialog").open');
  await click('[aria-label="攻撃2"]');
  await click('[aria-label="攻撃2を削除"]');
  await total(500);
  await click('[aria-label="攻撃2"]');
  assert.equal(await evaluate('document.querySelector("input.uiInput").value'), '400');
  await click('[aria-label="攻撃2を削除"]');
  await total(100);
  await clickText('ワンパン判定');
  await input(0, '150');
  await waitFor('document.body.textContent.includes("ワンパン不可") || document.body.textContent.includes("ワンパンできません")');
  await clickText('計算モード');
  await clickText('+ 追加');
  await total(200);
  await clickText('ワンパン判定');
  await waitFor('document.body.textContent.includes("ワンパンできます")');
  // A copied attack must preserve all input values, including nested fruit selection.
  await clickText('計算モード');
  await click('[aria-label="攻撃1"]');
  await clickText('▼ 詳細選択');
  const fruit = '[class*="fruitOptions"] button';
  await click(fruit);
  await total(3200);
  await click('[aria-label="加撃量の詳細選択を閉じる"]');
  await click('[aria-label="攻撃2"]');
  await clickText('▼ 詳細選択');
  assert.equal(await evaluate('document.querySelectorAll("input.uiInput")[1].value'), '');
  await click(fruit);
  await total(6200);
  await click('[aria-label="加撃量の詳細選択を閉じる"]');
  await clickText('+ 追加');
  await total(9300);
  await clickText('▼ 詳細選択');
  await click(fruit);
  await total(6300);
  await click('[aria-label="加撃量の詳細選択を閉じる"]');
  await click('[aria-label="攻撃2"]');
  assert.equal(await evaluate('document.querySelectorAll("input.uiInput")[1].value'), '3000');
  // Boss HP totals, first-stage-only reduction, and shared inputs across attacks.
  await clickText('ワンパン判定');
  await clickText('ボスHP入力');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#boss-hp-inputs input"), el => el.placeholder)'), ['ボス1', 'ボス2', 'ボス3', 'ボス4']);
  assert.equal(await evaluate('document.querySelector("#enemy-hp").readOnly'), true);
  await input(1, '1000');
  await input(2, '2000');
  await input(3, '3400');
  assert.equal(await evaluate('document.querySelector("#enemy-hp").value'), '6400');
  await waitFor('document.body.textContent.includes("ワンパンできません")');
  await evaluate('Array.from(document.querySelectorAll("label")).find(el => el.textContent.includes("10%削り")).querySelector("input").click()');
  await waitFor('document.body.textContent.includes("ワンパンできます")');
  assert.equal(await evaluate('Array.from(document.querySelectorAll("span")).find(el => el.textContent === "削り後HP").nextElementSibling.textContent'), '6,300');
  await clickText('計算モード');
  await click('[aria-label="攻撃1"]');
  await clickText('ワンパン判定');
  assert.equal(await evaluate('document.querySelector("#enemy-hp").value'), '6400');
  await clickText('ボスHP入力');
  assert.equal(await evaluate('document.querySelector("#boss-hp-inputs")'), null);
  assert.equal(await evaluate('document.querySelector("#enemy-hp").value'), '150');
  await clickText('ボスHP入力');
  assert.equal(await evaluate('document.querySelector("#enemy-hp").value'), '6400');
  await clickText('計算モード');
  // Keep the controls usable on mobile even with many attacks.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  for (let i = 0; i < 10; i++) await clickText('+ 追加');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate('document.querySelector("[aria-label=攻撃13を削除]").getBoundingClientRect().right <= innerWidth'), true);
  await evaluate('window.confirm = () => true');
  await click('[aria-label="入力をリセット"]');
  await waitFor('document.querySelectorAll("[aria-label=攻撃1]").length === 1 && !document.querySelector("[aria-label=攻撃2]")');
  await total(0);
  // The common required bonus is independent of the selected attack.
  await input(0, '1000');
  await evaluate('Array.from(document.querySelectorAll("label")).find(el => el.textContent === "その他倍率").querySelector("input").click()');
  const multiplierInput = async value => {
    await evaluate('(() => { const el = Array.from(document.querySelectorAll("label")).find(el => el.textContent === "その他倍率").parentElement.querySelector("input.uiInput"); el.focus(); el.select(); })()');
    await send('Input.insertText', { text: value });
    await delay(50);
  };
  await multiplierInput('2');
  await clickText('+ 追加');
  await multiplierInput('3');
  await total(5000);
  await clickText('ワンパン判定');
  await input(0, '7500');
  await waitFor('document.querySelector("section[aria-label=必要加撃量] strong").textContent === "500"');
  await clickText('計算モード');
  await click('[aria-label="攻撃1"]');
  await clickText('ワンパン判定');
  await waitFor('document.querySelector("section[aria-label=必要加撃量] strong").textContent === "500"');
  console.log('PASS: add/copy/switch/delete, independent input and fruit selection, totals and breakdown, combined one-shot judgment, boss HP totals/reduction/toggle, common required bonus, mobile layout and reset');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(timeout);
  if (socket) socket.close();
  chrome.kill();
  await delay(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
