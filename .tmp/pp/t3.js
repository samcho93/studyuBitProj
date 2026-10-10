// 블록에서 만든 MicroPython 을 시뮬레이터에서 1.5초씩 돌려 오류를 찾는다 (원래 예제도 같이 돌려 비교)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  for (let k = 0; k < 4; k++) {
    try { await page.goto('http://localhost:8765/index.html?role=student#ch01-1', { waitUntil: 'networkidle2' }); } catch (e) { console.log('goto', e.message); }
    try { await page.waitForFunction(() => window.MbBlocks, { timeout: 15000 }); break; } catch (e) { console.log('retry'); }
  }
  await page.evaluate(() => MbEngine.load());
  const conv = JSON.parse(fs.readFileSync('D:/Work/Web/studyuBitProj/.tmp/conv.json', 'utf8'));
  const codes = JSON.parse(fs.readFileSync('D:/Work/Web/studyuBitProj/.tmp/codes.json', 'utf8')).filter((c) => !c.slide);
  const only = process.argv[2];
  const out = [];
  for (let i = 0; i < conv.length; i++) {
    const c = conv[i];
    if (only && !c.title.includes(only)) continue;
    const runOne = async (code) => page.evaluate(async (code) => {
      app.console.clear && app.console.clear();
      app.runCode(code, { label: 'test' });
      await new Promise((r) => setTimeout(r, 1500));
      const t = document.querySelector('#mbConsole').innerText;
      await app.console.stop();
      await new Promise((r) => setTimeout(r, 200));
      return t;
    }, code);
    const a = await runOne(codes[i].code);
    const b = await runOne(c.py);
    const err = (t) => /Traceback|Error|오류/.test(t);
    if (err(b) && !err(a)) out.push({ title: c.title, orig: a.slice(-300), conv: b.slice(-600) });
    if (only) console.log('ORIG:\n' + a + '\nCONV:\n' + b);
  }
  out.forEach((o) => console.log('### ' + o.title + '\n' + o.conv + '\n'));
  console.log('new errors:', out.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
