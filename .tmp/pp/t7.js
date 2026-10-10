const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mb.teacherOk', '1'); } catch (e) {} });
  for (let k = 0; k < 4; k++) { try { await page.goto('http://localhost:8765/index.html?role=teacher#ch03-2@1', { waitUntil: 'networkidle2' }); } catch (e) {} try { await page.waitForFunction(() => window.MbBlocks, { timeout: 15000 }); break; } catch (e) {} }
  await sleep(1500); await page.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/ui4.png' }); console.log(await page.evaluate(() => [app.view, app.role, location.hash, document.querySelectorAll('.s-editor').length]));
  for (let i = 1; i < 12; i++) {
    await page.evaluate((i) => { location.hash = 'ch03-2@' + i; }, i);
    await sleep(700);
    const n = await page.$$eval('#slideView .s-editor-bar', (a) => a.length);
    const m = await page.$$eval('#slideView .bk-open', (a) => a.length);
    if (n) { console.log('slide', i, 'editor bars', n, 'bk buttons', m); if (m) { await page.click('#slideView .bk-open'); await page.waitForFunction(() => /블록 \d+개|못했/.test(document.querySelector('.bk-report').textContent), { timeout: 60000 }); console.log(await page.$eval('.bk-report', (e) => e.innerText)); await page.screenshot({ path: 'D:/Work/Web/studyuBitProj/.tmp/ui3.png' }); break; } }
  }
  await browser.close();
})();
