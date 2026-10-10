// 화면 동작 확인: 메뉴 · 보기 전환 · 실행 · 편집기 버튼 · 슬라이드 버튼
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const go = async (url) => { for (let k = 0; k < 4; k++) { try { await page.goto(url, { waitUntil: 'networkidle2' }); } catch (e) {} try { await page.waitForFunction(() => window.MbBlocks, { timeout: 15000 }); return; } catch (e) {} } };
  await go('http://localhost:8765/index.html?role=student#ch04-2');
  console.log('menu', await page.$$eval('.bk-menu', (a) => a.length), 'editorBtn', await page.$$eval('.bk-ed', (a) => a.length), 'codeBtns', await page.$$eval('.bk-open', (a) => a.length));
  // 예제 하나 열고 MicroPython 보기 → 실행
  const btns = await page.$$('.bk-open');
  await btns[1].click();
  await page.waitForFunction(() => /블록 \d+개/.test(document.querySelector('.bk-report').textContent), { timeout: 120000 });
  await page.click('.bk-seg button[data-view="py"]');
  await sleep(600);
  await page.click('.bk-run');
  await sleep(2500);
  await page.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/ui1.png' });
  console.log('console:', (await page.$eval('#mbConsole', (e) => e.innerText)).slice(-300));
  await page.click('.bk-stop');
  await page.click('.bk-seg button[data-view="ts"]');
  await sleep(400);
  await page.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/ui2.png' });
  // 닫고, 위쪽 메뉴로 다시 열기 (마지막 상태 복원)
  await page.click('.bk-close');
  await page.click('.bk-menu');
  await sleep(1500);
  console.log('reopen report:', await page.$eval('.bk-report', (e) => e.innerText));
  console.log('reopen blocks:', await page.evaluate(() => MbBlocks.workspace().getAllBlocks(false).length));
  // 편집기로 보내기
  await page.click('.bk-topy');
  await sleep(300);
  console.log('editor head:', (await page.evaluate(() => app.editor.getValue())).split('\n').slice(0, 3).join(' | '));
  // 교사용 슬라이드
  await go('http://localhost:8765/index.html?role=teacher#ch01-1@4');
  await sleep(1500);
  console.log('slide bk buttons:', await page.$$eval('#slideView .bk-open', (a) => a.length));
  const sb = await page.$('#slideView .bk-open');
  if (sb) { await sb.click(); await page.waitForFunction(() => /블록 \d+개|못했/.test(document.querySelector('.bk-report').textContent), { timeout: 60000 }); await sleep(500); await page.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/ui3.png' }); console.log('slide report:', await page.$eval('.bk-report', (e) => e.innerText)); }
  console.log(errs.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
