/* Pyodide 위에서 micro:bit MicroPython 코드를 실행하는 엔진
 * - 브라우저 안에서만 동작한다 (서버 · 설치 필요 없음)
 * - 사용자 코드는 _mbrt 가 비동기 코루틴으로 바꿔 실행하므로 while True: 도 화면이 멈추지 않는다
 */
'use strict';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

const MbEngine = {
  state: 'idle',          // idle | loading | ready | error
  message: '',
  python: '',
  pyodide: '0.26.4',
  loadMs: 0,
  py: null,
  sim: null,
  running: false,
  _listeners: [],
  _loading: null,
  _out: null,

  onChange(fn) { this._listeners.push(fn); fn(this); },
  _emit() { for (const f of this._listeners) { try { f(this); } catch (e) { /* 무시 */ } } },
  _set(state, message) { this.state = state; this.message = message || ''; this._emit(); },

  supported() {
    return typeof WebAssembly === 'object' && typeof Worker !== 'undefined';
  },

  write(kind, text) { if (this._out) this._out(kind, text); },

  load() {
    if (this._loading) return this._loading;
    const t0 = performance.now();
    this._loading = (async () => {
      this._set('loading', 'Python 실행 환경을 내려받는 중…');
      if (!window.loadPyodide) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = PYODIDE_URL + 'pyodide.js';
          s.crossOrigin = 'anonymous';
          s.onload = res;
          s.onerror = () => rej(new Error('Pyodide 스크립트를 불러오지 못했습니다 (인터넷 연결을 확인하세요)'));
          document.head.appendChild(s);
        });
      }
      this._set('loading', 'Python 시작 중…');
      const py = await loadPyodide({ indexURL: PYODIDE_URL });
      py.setStdout({ batched: (s) => this.write('out', s + '\n') });
      py.setStderr({ batched: (s) => this.write('err', s + '\n') });

      // 강좌용 파이썬 모듈을 가상 파일 시스템에 쓴다
      py.FS.mkdirTree('/mblib');
      for (const [name, src] of Object.entries(Object.assign({}, PY_LIB, PY_MB))) {
        py.FS.writeFile(`/mblib/${name}.py`, src);
      }
      py.FS.mkdirTree('/mbfs');

      py.registerJsModule('mbhw', makeMbHwApi(this.sim));
      py.runPython(BOOT_PY);
      this.python = py.runPython('import sys; ".".join(str(x) for x in sys.version_info[:3])');
      this.py = py;
      this.loadMs = performance.now() - t0;
      this._set('ready', '');
      return py;
    })().catch((e) => {
      this._loading = null;
      this._set('error', e && e.message || String(e));
      throw e;
    });
    return this._loading;
  },

  /** main.py 실행 */
  async run(code, opts = {}) {
    this._out = opts.onOutput || null;
    if (this.running) await this.stop(true);
    let py;
    try { py = await this.load(); } catch (e) { this.write('err', String(e.message || e) + '\n'); return 'error'; }
    const sim = this.sim;
    sim.start();
    this.running = true;
    MbSpeech.stop();
    let result = 'error';
    try {
      py.globals.set('__mb_src', code);
      result = await py.runPythonAsync('await _mbrt.run(__mb_src)');
    } catch (e) {
      if (!sim.stopFlag) this.write('err', String(e && e.message || e) + '\n');
      result = sim.stopFlag ? 'stopped' : 'error';
    }
    if (!this.running) return 'stopped';
    // 백그라운드(wait=False) 애니메이션 · 음악이 남아 있으면 계속 돌린다
    let pending = 0;
    try { pending = py.runPython('_mbrt.pending()'); } catch (e) { pending = 0; }
    if (result === 'done' && pending > 0 && !sim.stopFlag) return 'background';
    this.finish();
    return result;
  },

  /** 대화형 모드(>>>) 한 줄(또는 블록) 실행 */
  async repl(line, opts = {}) {
    this._out = opts.onOutput || this._out;
    let py;
    try { py = await this.load(); } catch (e) { this.write('err', String(e.message || e) + '\n'); return 'error'; }
    if (!this.sim.running) { this.sim.start(); }
    this.sim.stopFlag = false;
    this.running = true;
    let r = 'error';
    try {
      py.globals.set('__mb_line', line);
      r = await py.runPythonAsync('await _mbrt.repl(__mb_line)');
    } catch (e) {
      this.write('err', String(e && e.message || e) + '\n');
    }
    this.running = false;
    return r;
  },

  resetRepl() {
    try { if (this.py) this.py.runPython('_mbrt.repl_reset()'); } catch (e) { /* 무시 */ }
  },

  finish() {
    this.running = false;
    this.sim.stop();
    MbSpeech.stop();
    try { if (this.py) this.py.runPython('_mbrt.cancel_all()'); } catch (e) { /* 무시 */ }
  },

  async stop(quiet) {
    this.sim.stopFlag = true;
    MbSound.allOff();
    MbSpeech.stop();
    if (this.running) await new Promise((r) => setTimeout(r, 80));
    this.finish();
  },

  /* ---------------- micro:bit 파일 시스템 (/mbfs) ---------------- */
  files() {
    if (!this.py) return [];
    try {
      return this.py.FS.readdir('/mbfs').filter((n) => n !== '.' && n !== '..').map((n) => ({
        name: n, size: this.py.FS.stat('/mbfs/' + n).size
      }));
    } catch (e) { return []; }
  },
  readFile(name) {
    try { return new TextDecoder().decode(this.py.FS.readFile('/mbfs/' + name)); } catch (e) { return null; }
  },
  writeFile(name, text) {
    try { this.py.FS.writeFile('/mbfs/' + name, new TextEncoder().encode(text)); return true; } catch (e) { return false; }
  },
  removeFile(name) {
    try { this.py.FS.unlink('/mbfs/' + name); return true; } catch (e) { return false; }
  }
};

/* Pyodide 시작 직후 한 번 실행하는 준비 코드 */
const BOOT_PY = String.raw`
import sys, os
sys.path.insert(0, '/mblib')
import _mbrt, time_patch          # noqa: 런타임 · time 확장 준비

# micro:bit 의 파일 시스템처럼 한 폴더만 쓴다 (폴더 · 경로 없음)
os.chdir('/mbfs')
os.size = lambda n: os.stat(n)[6]


class _Uname(tuple):
    _F = ('sysname', 'nodename', 'release', 'version', 'machine')

    def __getattr__(self, k):
        try:
            return self[_Uname._F.index(k)]
        except ValueError:
            raise AttributeError(k)


_UN = _Uname(('microbit', 'microbit', '2.1.2', 'micro:bit v2.1.2+ on 2024-01-01', 'micro:bit with nRF52833'))
os.uname = lambda: _UN
`;
