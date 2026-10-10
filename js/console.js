/* 콘솔 + 파이썬 셸(>>>) — print() 출력, 오류 도움말, 대화형 모드 */
'use strict';

(function () {
  const { esc } = window.JU;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } }
  };

  /* ------------------------------------------------ 오류 도움말 (micro:bit 맞춤) */
  const HINTS = [
    [/ImportError: no module named 'microbit'|ModuleNotFoundError: No module named 'microbit'/, '<code>from microbit import *</code> 를 맨 위에 적었는지 확인하세요.'],
    [/NameError: name 'display' is not defined/, '<code>from microbit import *</code> 를 맨 위에 적어야 <code>display</code> 를 쓸 수 있습니다.'],
    [/NameError: name 'Image' is not defined/, '<code>Image</code> 는 microbit 모듈에 있습니다. <code>from microbit import *</code> 를 확인하세요.'],
    [/NameError: name 'music' is not defined/, '음악을 쓰려면 <code>import music</code> 이 따로 필요합니다.'],
    [/NameError: name 'radio' is not defined/, '무선을 쓰려면 <code>import radio</code> 가 따로 필요합니다.'],
    [/NameError: name 'random' is not defined/, '난수를 쓰려면 <code>import random</code> 이 따로 필요합니다.'],
    [/NameError: name '(\w+)' is not defined/, '만들지 않은 이름입니다. <b>철자와 대소문자</b>를 확인하세요. (파이썬은 <code>Display</code> 와 <code>display</code> 를 다르게 봅니다)'],
    [/ValueError: radio is not enabled/, '<code>radio.on()</code> 을 먼저 불러야 보내고 받을 수 있습니다.'],
    [/ValueError: 핀 \d+ 는 아날로그 입력/, '아날로그 입력은 <b>P0, P1, P2, P3, P4, P10</b> 에서만 됩니다.'],
    [/ValueError: 밝기/, 'LED 밝기는 <b>0(꺼짐) ~ 9(가장 밝음)</b> 사이의 정수입니다.'],
    [/ValueError: 아날로그 출력/, '<code>write_analog()</code> 값은 <b>0 ~ 1023</b> 사이여야 합니다.'],
    [/ValueError: index out of bounds/, 'LED 화면의 좌표는 <b>x, y 모두 0 ~ 4</b> 입니다. (왼쪽 위가 0, 0)'],
    [/ValueError: value must be 0 or 1/, '<code>write_digital()</code> 에는 <b>0 또는 1</b> 만 넣을 수 있습니다.'],
    [/SyntaxError: invalid syntax\. Perhaps you forgot a comma/, '값들 사이에 <b>쉼표(,)</b>가 빠진 것 같습니다.'],
    [/SyntaxError: expected ':'/, '<code>if</code> · <code>for</code> · <code>while</code> · <code>def</code> 줄 끝에 <b>콜론(:)</b>이 필요합니다.'],
    [/SyntaxError: unterminated string literal/, '문자열의 <b>따옴표</b>가 닫히지 않았습니다.'],
    [/was never closed/, '<b>괄호</b>가 닫히지 않았습니다. 여는 괄호와 닫는 괄호의 개수를 세어 보세요.'],
    [/SyntaxError: invalid character/, '한글 따옴표(“ ” ‘ ’)나 전각 문자가 섞였습니다. <b>영문 자판</b>으로 다시 입력하세요.'],
    [/SyntaxError: Missing parentheses in call to 'print'/, '파이썬 3 에서는 <code>print("…")</code> 처럼 <b>괄호</b>를 씁니다.'],
    [/SyntaxError/, '<b>문법 오류</b>입니다. 표시된 줄과 바로 윗줄의 괄호 · 따옴표 · 콜론(:)을 확인하세요.'],
    [/IndentationError: expected an indented block/, '<code>:</code> 다음 줄은 <b>들여쓰기(공백 4칸)</b>를 해야 합니다.'],
    [/IndentationError: unexpected indent/, '필요 없는 곳에 <b>들여쓰기</b>가 있습니다. 줄 앞의 공백을 지우세요.'],
    [/IndentationError|TabError/, '들여쓰기 칸 수가 맞지 않습니다. <b>공백 4칸</b>으로 통일하세요.'],
    [/TypeError: can only concatenate str \(not "int"\) to str|unsupported operand type\(s\) for \+: 'int' and 'str'/, '<b>문자열과 숫자</b>는 <code>+</code> 로 더할 수 없습니다. <code>str(숫자)</code> 로 바꾸세요.'],
    [/TypeError: '(\w+)' object is not callable/, '함수가 아닌 값을 <b>( )</b> 로 불렀습니다. 변수 이름이 함수 이름과 겹치지 않았는지 확인하세요.'],
    [/TypeError: .* takes (\d+) positional arguments? but (\d+)/, '함수를 부를 때 <b>괄호 안 값의 개수</b>가 맞지 않습니다.'],
    [/TypeError/, '값의 <b>종류(자료형)</b>가 맞지 않습니다. <code>type(값)</code> 으로 확인해 보세요.'],
    [/ValueError: invalid literal for int\(\)/, '숫자로 바꿀 수 없는 문자열입니다.'],
    [/ZeroDivisionError/, '<b>0 으로 나누었습니다.</b>'],
    [/IndexError/, '<b>번호(인덱스) 범위</b>를 벗어났습니다. 0 부터 <code>len(…) - 1</code> 까지입니다.'],
    [/KeyError/, '딕셔너리에 <b>없는 키</b>입니다.'],
    [/AttributeError: '(\w+)' object has no attribute/, '그런 이름의 기능(메서드)이 없습니다. 철자를 확인하세요.'],
    [/OSError: \[Errno 2\]|FileNotFoundError/, '그런 이름의 파일이 없습니다. <code>os.listdir()</code> 로 목록을 확인하세요. micro:bit 에는 <b>폴더가 없습니다</b>.'],
    [/MemoryError/, '보드의 메모리가 부족합니다. 코드를 짧게 나누거나 큰 목록을 줄이세요.'],
    [/RuntimeError: 이 위치/, '<code>lambda</code> 나 제너레이터 안에서는 <code>sleep()</code> · <code>display.scroll()</code> 처럼 기다리는 동작을 쓸 수 없습니다.'],
    [/KeyboardInterrupt/, '■ 정지 버튼으로 실행을 멈췄습니다.']
  ];
  const hintFor = (t) => { for (const [re, h] of HINTS) if (re.test(t)) return h; return null; };

  class MbConsole {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      this.out = el.querySelector('#mbConsole');
      this.form = el.querySelector('#shellForm');
      this.input = el.querySelector('#shellInput');
      this.prompt = el.querySelector('#shellPrompt');
      this.stopBtn = el.querySelector('#stopBtn');
      this.state = el.querySelector('#runState');
      this.left = el.querySelector('#statusLeft');
      this.right = el.querySelector('#statusRight');
      this.main = el.querySelector('#consoleMain');
      this.history = [];
      this.hIndex = 0;
      this.pending = [];          // 여러 줄 블록 입력 중인 줄들
      this.run = null;
      this.onJump = null;
      this.fontSize = +store.get('mb.consoleFont', 13.5);
      this.applyFont();

      this.form.addEventListener('submit', (e) => { e.preventDefault(); this.shellLine(); });
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); this.stop(); }
        if (e.key === 'ArrowUp' && this.history.length) { e.preventDefault(); this.hIndex = Math.max(0, this.hIndex - 1); this.input.value = this.history[this.hIndex] || ''; }
        if (e.key === 'ArrowDown' && this.history.length) { e.preventDefault(); this.hIndex = Math.min(this.history.length, this.hIndex + 1); this.input.value = this.history[this.hIndex] || ''; }
        if (e.key === 'Escape' && this.pending.length) { e.preventDefault(); this.pending = []; this.setPrompt(); this.write('m', '(블록 입력 취소)\n'); }
        e.stopPropagation();
      });
      this.stopBtn.addEventListener('click', () => this.stop());
      el.querySelector('#clearBtn').addEventListener('click', () => this.clear());
      el.querySelector('#cFontUp').addEventListener('click', () => { this.fontSize = Math.min(24, this.fontSize + 1); this.applyFont(); });
      el.querySelector('#cFontDown').addEventListener('click', () => { this.fontSize = Math.max(10, this.fontSize - 1); this.applyFont(); });
      this.out.addEventListener('click', (e) => {
        const loc = e.target.closest('[data-jump]');
        if (loc && this.onJump) this.onJump(+loc.dataset.jump);
      });
    }

    applyFont() { this.el.style.setProperty('--c-font', this.fontSize + 'px'); store.set('mb.consoleFont', this.fontSize); }

    clear() { this.out.innerHTML = ''; this.last = null; }

    atBottom() { return this.out.scrollHeight - this.out.scrollTop - this.out.clientHeight < 40; }

    write(cls, text) {
      if (!text) return;
      const stick = this.atBottom();
      const w = this.out.querySelector('.console-welcome');
      if (w) w.remove();
      if (this.last && this.last.className === cls && this.last.parentNode === this.out && this.last.textContent.length < 20000) {
        this.last.textContent += text;
      } else {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        this.out.appendChild(span);
        this.last = span;
      }
      if (this.out.textContent.length > 300000) {
        while (this.out.firstChild && this.out.textContent.length > 200000) this.out.firstChild.remove();
      }
      if (stick) this.out.scrollTop = this.out.scrollHeight;
    }

    html(h) {
      const stick = this.atBottom();
      const w = this.out.querySelector('.console-welcome');
      if (w) w.remove();
      const div = document.createElement('span');
      div.innerHTML = h;
      while (div.firstChild) this.out.appendChild(div.firstChild);
      this.last = null;
      if (stick) this.out.scrollTop = this.out.scrollHeight;
    }

    setState(kind, text) { this.state.className = 'run-state ' + kind; this.state.textContent = text; }

    setPrompt() {
      const cont = this.pending.length > 0;
      this.prompt.textContent = cont ? '...' : '>>>';
      this.input.placeholder = cont ? '블록을 이어서 입력 (빈 줄로 끝, Esc 로 취소)' : '파이썬 한 줄을 입력하고 Enter — 예: display.show(Image.HEART)';
    }

    setRunning(on) {
      this.stopBtn.disabled = !on;
      this.el.classList.toggle('running', on);
      this.app.onRunState(on ? 'running' : 'idle');
    }

    /* -------------------------------------------- 파이썬 셸 (>>>) */
    async shellLine() {
      const text = this.input.value;
      this.input.value = '';
      if (text.trim()) { this.history.push(text); this.hIndex = this.history.length; }
      this.html(`<span class="i"><span class="p">${this.pending.length ? '...' : '&gt;&gt;&gt;'}</span> ${esc(text)}\n</span>`);

      if (this.pending.length) {
        if (text.trim() === '') {
          const block = this.pending.join('\n');
          this.pending = [];
          this.setPrompt();
          await this.evalShell(block);
          return;
        }
        this.pending.push(text);
        this.setPrompt();
        return;
      }
      if (/:\s*(#.*)?$/.test(text)) { this.pending.push(text); this.setPrompt(); return; }
      if (!text.trim()) return;
      await this.evalShell(text);
    }

    async evalShell(code) {
      if (this.app.serialMode()) { this.app.serialShell(code); return; }
      this.setRunning(true);
      this.setState('running', '셸 실행 중');
      let stderr = '';
      await MbEngine.repl(code, {
        onOutput: (k, t) => { if (k === 'err') stderr += t; this.write(k === 'err' ? 'e' : 'o', t); }
      });
      this.setRunning(false);
      this.setState('idle', '셸 대기');
      if (stderr) this.showHint(stderr);
      this.input.focus({ preventScroll: true });
    }

    showHint(stderr) {
      const h = hintFor(stderr.trim().split('\n').slice(-3).join('\n')) || hintFor(stderr);
      if (h) this.html(`<span class="hint"><b>💡 도움말</b> ${h}</span>`);
    }

    stop() {
      if (this.app.serialMode()) { this.app.serialStop(); return; }
      MbEngine.stop();
      if (this.background) {
        // main.py 는 이미 끝났고 애니메이션 · 음악만 돌고 있던 상태
        this.background = false;
        this.setRunning(false);
        this.setState('idle', '중지됨');
        this.left.textContent = '■ 백그라운드 동작을 멈췄습니다';
        this.write('m', '── 백그라운드 동작 정지 ──\n');
      }
    }

    /* -------------------------------------------- main.py 실행 */
    async execute(code, opts = {}) {
      if (!MbEngine.supported()) {
        this.setState('error', '실행 불가');
        this.html('<span class="hint"><b>⚠ 이 브라우저에서는 파이썬을 실행할 수 없습니다.</b><br>최신 Chrome · Edge · Firefox · Safari 를 사용하세요.</span>');
        return { ok: false };
      }
      if (this.app.serialMode() && opts.target === 'board') return this.app.serialRun(code, opts);

      const run = { code, done: false, label: opts.label || '' };
      this.run = run;
      this.background = false;
      if (store.get('mb.keepConsole', '0') !== '1') this.clear();
      else if (this.out.textContent.trim()) this.html('<span class="run-sep"></span>');
      this.main.textContent = opts.label ? '· ' + opts.label : '';
      if (opts.onDiagnostics) opts.onDiagnostics([]);

      if (MbEngine.state !== 'ready') {
        this.setState('compiling', '준비 중…');
        this.html(`<span class="hint"><b>🐍 브라우저 안에서 파이썬 실행 환경을 준비하고 있습니다…</b><br>
          처음 한 번만 <b>5 ~ 20초</b> 걸리고, 그 뒤로는 바로 실행됩니다.</span>`);
        try { await MbEngine.load(); } catch (e) {
          this.setState('error', '준비 실패');
          this.write('e', '파이썬 실행 환경을 준비하지 못했습니다: ' + (e && e.message || e) + '\n인터넷 연결을 확인하고 새로고침해 보세요.\n');
          return { ok: false };
        }
        this.clear();
      }

      this.setRunning(true);
      this.setState('running', '시뮬레이터 실행 중');
      this.left.textContent = '▶ 시뮬레이터에서 실행 중';
      this.right.textContent = '';
      const started = performance.now();
      const tick = setInterval(() => { this.right.textContent = ((performance.now() - started) / 1000).toFixed(1) + '초'; }, 100);
      let stderr = '';
      let result = 'error';
      try {
        result = await MbEngine.run(code, {
          onOutput: (k, t) => {
            if (k === 'err') stderr += t;
            this.write(k === 'err' ? 'e' : k === 'speech' ? 'm' : 'o', t);
          }
        });
      } catch (e) {
        this.write('e', '\n실행 중 오류: ' + (e && e.message || e) + '\n');
      } finally {
        clearInterval(tick);
        run.done = true;
      }
      const sec = ((performance.now() - started) / 1000).toFixed(2);
      if (result === 'background') {
        this.background = true;
        this.setState('running', '백그라운드');
        this.left.textContent = '▶ main.py 는 끝났지만 애니메이션 · 음악이 계속 돌고 있습니다 (■ 정지)';
        this.write('m', `\n── main.py 끝 (${sec}초) · 백그라운드 동작 계속 ──\n`);
        return { ok: true, result };
      }
      this.setRunning(false);
      this.write('m', `\n── 프로그램 ${result === 'stopped' ? '중지' : '종료'} (${sec}초) ──\n`);
      const diags = this.linkTraceback(stderr);
      if (opts.onDiagnostics && diags.length) opts.onDiagnostics(diags);
      if (stderr) this.showHint(stderr);
      this.setState(result === 'done' ? 'done' : result === 'stopped' ? 'idle' : 'error',
        result === 'done' ? '완료' : result === 'stopped' ? '중지됨' : '오류');
      this.left.textContent = result === 'done' ? '✓ 실행 완료' : result === 'stopped' ? '■ 실행을 중지했습니다' : '✗ 오류로 멈췄습니다';
      this.right.textContent = sec + '초';
      this.app.onRunState('idle');
      return { ok: result !== 'error', result };
    }

    /** traceback 의 File "main.py", line 5 를 누르면 편집기의 그 줄로 간다 */
    linkTraceback(stderr) {
      const diags = [];
      let last = null;
      const re = /File "main\.py", line (\d+)/g;
      let m;
      while ((m = re.exec(stderr))) last = +m[1];
      this.out.querySelectorAll('span.e').forEach((sp) => {
        if (sp.dataset.linked || !/File "[^"]+", line \d+/.test(sp.textContent)) return;
        sp.dataset.linked = '1';
        sp.innerHTML = esc(sp.textContent).replace(/File &quot;(main\.py)&quot;, line (\d+)/g,
          (all, f, l) => `File "<span class="loc" data-jump="${l}" title="편집기에서 이 줄로 이동">${f}</span>", line <span class="loc" data-jump="${l}">${l}</span>`);
      });
      if (last && !/KeyboardInterrupt/.test(stderr)) {
        diags.push({ kind: 'error', line: last, editorLine: last, message: stderr.trim().split('\n').pop() || '' });
      }
      return diags;
    }
  }

  window.MbRunner = { MbConsole, store, hintFor };
})();
