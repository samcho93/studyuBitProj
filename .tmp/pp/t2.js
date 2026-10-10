// 모든 예제: 파이썬 → 블록 → MicroPython / MakeCode JS 변환 결과를 모은다
const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  for (let k = 0; k < 4; k++) {
    try { await page.goto('http://localhost:8765/index.html?role=student#ch01-1', { waitUntil: 'networkidle2' }); } catch (e) { console.log('goto', e.message); }
    try { await page.waitForFunction(() => window.MbBlocks, { timeout: 15000 }); break; } catch (e) { console.log('retry'); }
  }
  await page.evaluate(() => MbBlocks.openLast());
  await page.waitForFunction(() => MbBlocks.workspace(), { timeout: 60000 });
  const codes = JSON.parse(fs.readFileSync('D:/Work/Web/studyuBitProj/.tmp/codes.json', 'utf8')).filter((c) => !c.slide);
  const res = await page.evaluate(async (codes) => {
    const ws = MbBlocks.workspace();
    const out = [];
    for (const c of codes) {
      const o = { sec: c.sec, title: c.title };
      try {
        const r = await MbBlocks.convertPython(c.code);
        if (r.error) { o.error = r.error; out.push(o); continue; }
        Blockly.Events.disable();
        ws.clear();
        Blockly.serialization.workspaces.load(r.state, ws);
        Blockly.Events.enable();
        o.raw = r.raw; o.count = r.count; o.notes = r.notes;
        o.rawCodes = ws.getAllBlocks(false).filter((b) => b.type.startsWith('py_raw')).map((b) => b.code);
        o.py = MbBlocks.genPy().code;
        const ts = MbBlocks.genTs(); o.ts = ts.code; o.tsraw = ts.raw;
        o.disabled = ws.getAllBlocks(false).filter((b) => !b.isEnabled()).map((b) => b.type);
      } catch (e) { o.error = 'EXC ' + (e.stack || e); }
      out.push(o);
    }
    return out;
  }, codes);
  fs.writeFileSync('D:/Work/Web/studyuBitProj/.tmp/conv.json', JSON.stringify(res, null, 1));
  const bad = res.filter((r) => r.error);
  console.log('total', res.length, 'errors', bad.length, 'withRaw', res.filter((r) => r.raw).length, 'rawSum', res.reduce((a, r) => a + (r.raw || 0), 0));
  bad.forEach((b) => console.log('ERR', b.title, b.error.slice(0, 300)));
  console.log(errs.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
