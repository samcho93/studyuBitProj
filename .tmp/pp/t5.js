const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const page = await browser.newPage();
  try { await page.goto('http://localhost:8765/index.html?role=student#ch01-1', { waitUntil: 'networkidle2' }); } catch (e) {}
  await page.waitForFunction(() => window.MbBlocks, { timeout: 30000 });
  await page.evaluate(() => MbBlocks.openLast());
  await page.waitForFunction(() => MbBlocks.workspace(), { timeout: 60000 });
  const codes = JSON.parse(fs.readFileSync('D:/Work/Web/studyuBitProj/.tmp/codes.json', 'utf8')).filter((c) => !c.slide);
  const c = codes.find((x) => x.title.startsWith(process.argv[2]));
  const r = await page.evaluate(async (code) => {
    const r = await MbBlocks.convertPython(code);
    const ws = MbBlocks.workspace();
    Blockly.Events.disable(); ws.clear(); Blockly.serialization.workspaces.load(r.state, ws); Blockly.Events.enable();
    const t = MbBlocks._typer();
    return { vt: [...t.vt], pt: [...t.pt], ft: [...t.ft] };
  }, c.code);
  console.log(JSON.stringify(r));
  await browser.close();
})();
