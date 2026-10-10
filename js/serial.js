/* Web Serial API 로 실제 BBC micro:bit 에 연결한다 (Chrome · Edge)
 * - 보드에 MicroPython 펌웨어가 이미 설치되어 있어야 한다 (python.microbit.org 에서 설치)
 * - 연결하면 REPL 콘솔, main.py 업로드, 바로 실행, 파일 목록을 쓸 수 있다
 */
'use strict';

class MicrobitSerial {
  constructor(app) {
    this.app = app;
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.buf = '';
    this.quiet = false;
    this.busy = false;
    this.enc = new TextEncoder();
    this.dec = new TextDecoder();
  }

  get supported() { return 'serial' in navigator; }
  get connected() { return !!this.port; }

  async connect() {
    if (!this.supported) {
      throw new Error('이 브라우저는 Web Serial 을 지원하지 않습니다. Chrome 또는 Edge(데스크톱)로 열어 주세요.');
    }
    if (!window.isSecureContext) {
      throw new Error('보드 연결은 HTTPS 또는 localhost 에서만 됩니다.');
    }
    const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0D28 }] }).catch((e) => {
      if (e.name === 'NotFoundError') throw new Error('포트 선택이 취소되었습니다. micro:bit 를 USB 로 연결했는지 확인하세요.');
      throw e;
    });
    await port.open({ baudRate: 115200 });
    this.port = port;
    this.writer = port.writable.getWriter();
    this.readLoop();
    navigator.serial.addEventListener('disconnect', (e) => { if (e.target === this.port) this.cleanup('보드 연결이 끊어졌습니다'); });
    this.app.serialLog('\n[micro:bit 연결됨 · 115200bps]\n', 'info');
    this.app.onSerialState(true);
  }

  async readLoop() {
    while (this.port && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          const s = this.dec.decode(value, { stream: true });
          this.buf += s;
          if (this.buf.length > 200000) this.buf = this.buf.slice(-100000);
          if (!this.quiet) this.app.serialLog(s.replace(/\x04/g, ''));
        }
      } catch (e) { break; } finally {
        try { this.reader.releaseLock(); } catch (e) { /* 무시 */ }
      }
    }
  }

  async disconnect() {
    try { if (this.reader) await this.reader.cancel(); } catch (e) { /* 무시 */ }
    try { if (this.writer) this.writer.releaseLock(); } catch (e) { /* 무시 */ }
    try { await this.port.close(); } catch (e) { /* 무시 */ }
    this.cleanup('보드 연결 해제');
  }

  cleanup(msg) {
    this.port = null; this.reader = null; this.writer = null;
    this.app.serialLog(`\n[${msg}]\n`, 'info');
    this.app.onSerialState(false);
  }

  async write(s) {
    if (!this.port) throw new Error('보드가 연결되지 않았습니다');
    await this.writer.write(typeof s === 'string' ? this.enc.encode(s) : s);
  }

  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async waitFor(str, timeout = 5000, from = 0) {
    const t0 = Date.now();
    for (;;) {
      const i = this.buf.indexOf(str, from);
      if (i >= 0) return i;
      if (Date.now() - t0 > timeout) throw new Error(`보드가 응답하지 않습니다 (${JSON.stringify(str)})`);
      await this.sleep(10);
    }
  }

  async interrupt() { await this.write('\r\x03\x03'); }

  async enterRaw() {
    await this.write('\r\x03\x03');
    await this.sleep(150);
    this.buf = '';
    await this.write('\r\x01');
    await this.waitFor('raw REPL; CTRL-B to exit\r\n>', 3000);
    this.buf = '';
  }

  async exitRaw() { await this.write('\r\x02'); }

  /** raw REPL 에서 코드를 실행하고 표준 출력을 돌려준다 */
  async exec(code, timeout = 10000) {
    this.buf = '';
    const data = this.enc.encode(code);
    for (let i = 0; i < data.length; i += 256) {
      await this.write(data.slice(i, i + 256));
      await this.sleep(8);
    }
    await this.write('\x04');
    await this.waitFor('OK', 3000);
    const e1 = await this.waitFor('\x04', timeout, 2);
    const e2 = await this.waitFor('\x04', timeout, e1 + 1);
    const out = this.buf.slice(2, e1), err = this.buf.slice(e1 + 1, e2);
    if (err.trim()) throw new Error(err.trim());
    return out;
  }

  /** micro:bit 에는 binascii 가 없으므로 bytes 리터럴로 나눠 보낸다 */
  async writeFile(path, content) {
    const bytes = this.enc.encode(content);
    await this.exec(`f=open('${path}','wb')\nw=f.write`);
    for (let i = 0; i < bytes.length; i += 160) {
      const chunk = bytes.slice(i, i + 160);
      let lit = '';
      chunk.forEach((b) => {
        lit += (b >= 32 && b < 127 && b !== 39 && b !== 92) ? String.fromCharCode(b) : '\\x' + b.toString(16).padStart(2, '0');
      });
      await this.exec(`w(b'${lit}')`);
    }
    await this.exec('f.close()');
  }

  async guard(fn) {
    if (this.busy) throw new Error('다른 작업이 진행 중입니다');
    if (!this.port) throw new Error('먼저 🔌 보드 연결을 누르세요');
    this.busy = true;
    this.quiet = true;
    try { return await fn(); } finally { this.quiet = false; this.busy = false; }
  }

  async check(progress) {
    const ver = (await this.exec('import sys\nprint(sys.implementation.name, sys.version, sys.platform)')).trim();
    progress('보드: ' + ver);
    if (!/microbit|nrf/i.test(ver)) progress('⚠ micro:bit 가 아닌 보드로 보입니다');
  }

  /** main.py 로 저장하고 재시작 — 보드 전원만 있으면 계속 실행된다 */
  async upload(code, progress) {
    return this.guard(async () => {
      progress('보드 준비 (raw REPL)…');
      await this.enterRaw().catch(() => {
        throw new Error('MicroPython REPL 이 응답하지 않습니다. python.microbit.org 에서 MicroPython 펌웨어를 먼저 설치하세요.');
      });
      await this.check(progress);
      progress('main.py 전송 중…');
      await this.writeFile('main.py', code);
      progress('전송 완료 → 보드를 다시 시작합니다');
      this.quiet = false;
      await this.exitRaw();
      await this.sleep(100);
      await this.write('\x04');
    });
  }

  /** 저장하지 않고 즉시 실행 */
  async runOnce(code, progress) {
    return this.guard(async () => {
      progress('raw REPL 진입…');
      await this.enterRaw();
      progress('보드에서 실행 중… (■ 정지로 중단)');
      this.quiet = false;
      const data = this.enc.encode(code);
      for (let i = 0; i < data.length; i += 256) { await this.write(data.slice(i, i + 256)); await this.sleep(8); }
      await this.write('\x04');
    });
  }

  async stopProgram() {
    await this.write('\r\x03\x03');
    await this.sleep(100);
    await this.exitRaw();
  }

  async listFiles() {
    return this.guard(async () => {
      await this.enterRaw();
      const o = await this.exec('import os\nfor n in os.listdir():\n    print(n, os.size(n))');
      await this.exitRaw();
      return o;
    });
  }

  async removeAll() {
    return this.guard(async () => {
      await this.enterRaw();
      await this.exec('import os\nfor n in os.listdir():\n    os.remove(n)');
      await this.exitRaw();
    });
  }
}
