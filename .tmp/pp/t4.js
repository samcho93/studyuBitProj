// 변환한 .mkcd 를 실제 makecode.microbit.org 에 끌어다 놓아(drop) 블록 · 오류를 확인한다
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--window-size=1500,950'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  for (let k = 0; k < 4; k++) {
    try { await page.goto('http://localhost:8765/index.html?role=student#ch01-1', { waitUntil: 'networkidle2' }); } catch (e) { console.log('goto', e.message); }
    try { await page.waitForFunction(() => window.MbBlocks, { timeout: 15000 }); break; } catch (e) { console.log('retry'); }
  }
  await page.evaluate(() => MbBlocks.openLast());
  await page.waitForFunction(() => MbBlocks.workspace(), { timeout: 60000 });
  const codes = JSON.parse(fs.readFileSync('D:/Work/Web/studyuBitProj/.tmp/codes.json', 'utf8')).filter((c) => !c.slide);
  const pick = (process.argv[2] || '예제 3-14.').split('|');
  const sel = process.argv[2] === 'ALL' ? codes : codes.filter((c) => pick.some((p) => c.title.startsWith(p)));
  const results = [];
  const files = [];
  for (const c of sel) {
    const r = await page.evaluate(async (code, title) => {
      const r = await MbBlocks.convertPython(code);
      const ws = MbBlocks.workspace();
      Blockly.Events.disable(); ws.clear(); Blockly.serialization.workspaces.load(r.state, ws); Blockly.Events.enable();
      return { mkcd: MbBlocks.mkcd(title.replace(/[^\w가-힣 ]/g, '').slice(0, 30)), ts: MbBlocks.genTs().code, raw: r.raw };
    }, c.code, c.title);
    files.push(Object.assign({ title: c.title }, r));
  }
  const mc = await browser.newPage();
  await mc.setViewport({ width: 1500, height: 950 });
  await mc.goto('https://makecode.microbit.org/', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(4000);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    await mc.evaluate((text, name) => {
      const file = new File([text], name, { type: 'application/octet-stream' });
      const dt = new DataTransfer(); dt.items.add(file);
      const target = document.body;
      ['dragenter', 'dragover', 'drop'].forEach((t) => target.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true })));
    }, f.mkcd, 'microbit-test' + i + '.mkcd');
    await sleep(7000);
    const markers = await mc.evaluate(() => window.monaco ? monaco.editor.getModelMarkers({}).map((m) => m.startLineNumber + ': ' + m.message) : 'no monaco');
    console.log('MARKERS', JSON.stringify(markers).slice(0, 3000));
    const view0 = await mc.evaluate(() => (document.querySelector('.editor-toggle .selected, [aria-selected=true]') || {}).textContent || '');
    await mc.evaluate(() => { const el = [...document.querySelectorAll('[role=menuitem],[role=tab],button,a,div')].filter((e) => e.children.length < 3 && /^\s*블록\s*$/.test(e.textContent))[0]; if (el) el.click(); });
    await sleep(5000);
    const modal = await mc.evaluate(() => [...document.querySelectorAll('.ui.modal, .modal, [role=dialog]')].map((m) => m.innerText).join(' | ').slice(0, 800));
    console.log('VIEW0', view0, 'MODAL', modal);
    results.push({ title: f.title, raw: f.raw, markers, fail: /변환하는 과정에 문제/.test(modal) });
    fs.writeFileSync('D:/Work/Web/studyuBitProj/.tmp/mc_results.json', JSON.stringify(results, null, 1));
    // 남은 대화상자 닫기
    await mc.evaluate(() => { const b = [...document.querySelectorAll('button, .button')].find((e) => /자바스크립트 유지/.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
    const info = await mc.evaluate(() => {
      const B = window.Blockly || window.pxtblockly && window.pxtblockly.Blockly; let ws = B && ((B.getMainWorkspace && B.getMainWorkspace()) || (B.common && B.common.getMainWorkspace && B.common.getMainWorkspace()));
      if (!ws && B && B.Workspace && B.Workspace.getAll) ws = B.Workspace.getAll().filter((w) => !w.isFlyout).sort((a, b) => b.getAllBlocks(false).length - a.getAllBlocks(false).length)[0];
      if (!ws) return { err: 'no workspace', keys: Object.keys(window).filter((k) => /block|pxt/i.test(k)).join(',') };
      const all = ws.getAllBlocks(false);
      const types = {};
      all.forEach((b) => { types[b.type] = (types[b.type] || 0) + 1; });
      const grey = all.filter((b) => /typescript|grey|gray/i.test(b.type)).map((b) => (b.getFieldValue && (b.getFieldValue('EXPRESSION') || '')) || b.toString().slice(0, 120));
      return { n: all.length, grey, top: ws.getTopBlocks(false).map((b) => b.type), types };
    });
    // 컴파일 오류 · 경고 확인: JavaScript 보기로 바꿔 문제 목록을 본다
    console.log('### ' + f.title + ' (회색 파이썬 블록 ' + f.raw + ')');
    console.log(JSON.stringify(info).slice(0, 1500));
    if (sel.length < 10) await mc.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/mc' + i + '.png' });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
