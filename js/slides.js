/* 교사용 PPT 슬라이드 엔진: 16:9 슬라이드, 코드 편집·실행, 전체 화면, 교사 노트, 발표자 창, 타이머 */
(function () {
  const { esc, highlightInline, fileName, makeEditor } = window.JU;
  const $ = (id) => document.getElementById(id);
  const SW = 1280, SH = 720;                      // 고정 무대 크기 (16:9)
  const plain = (h) => String(h || '').replace(/<[^>]+>/g, '').trim();
  const LAYOUT_NAME = { title: '제목', goals: '학습 목표', bullets: '개념', code: '코드', two: '비교', table: '표', diagram: '그림', quiz: '퀴즈', practice: '실습', summary: '정리' };
  const LAYOUT_ICON = { title: '🎬', goals: '🎯', bullets: '📌', code: '💻', two: '⚖️', table: '📊', diagram: '🧭', quiz: '❓', practice: '🛠️', summary: '✅' };

  function bulletsHtml(items, dense) {
    if (!Array.isArray(items)) return '';
    return `<ul class="s-bullets${dense ? ' dense' : ''}">${items.map((b) => {
      if (Array.isArray(b)) return `<li>${b[0]}${Array.isArray(b[1]) ? `<ul>${b[1].map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</li>`;
      return `<li>${b}</li>`;
    }).join('')}</ul>`;
  }

  /** 슬라이드 안의 코드가 잘리지 않도록 글자 크기(cqw)를 계산한다 */
  function autoCodeFont(code, hasPoints, isPractice) {
    const lines = String(code || '').split('\n');
    const n = Math.max(1, lines.length);
    const cols = Math.max(24, ...lines.map((l) => l.replace(/\t/g, '    ').length));
    const boxH = 32;                                   // 코드 상자 높이 (cqw 기준 대략값)
    const boxW = hasPoints ? 55 : isPractice ? 48 : 86; // 코드 상자 폭
    const byLines = boxH / (n * 1.55);
    const byCols = boxW / (cols * 0.62);
    return Math.max(0.78, Math.min(1.55, byLines, byCols));
  }

  class Deck {
    constructor(app) {
      this.app = app;
      this.console = app.console;
      this.slides = [];
      this.index = 0;
      this.edits = {};
      this.solutionOn = {};
      this.editor = null;
      this.notesOpen = MbRunner.store.get('mb.notesOpen', '1') === '1';
      this.stage = $('stage');
      this.slideHost = $('stageSlide');
      this.fitBox = $('stageFit');
      this.wrap = $('deckWrap');
      this.host = $('stageHost');
      this.bars = $('deckBars');
      this.scale = 1;
      this.edgePx = 28;
      this.press = null;
      this.ink = new InkLayer($('inkCanvas'));
      this.ink.onChange = () => this.syncInkBar();
      this.timer = { start: 0, acc: 0 };
      this.channel = 'BroadcastChannel' in window ? new BroadcastChannel('python-presenter') : null;
      this.bind();
    }

    get active() { return !$('slideView').classList.contains('hidden'); }

    // ---------------------------------------------------------------- 데이터
    open(ch, sec, index) {
      this.ch = ch;
      this.sec = sec;
      this.slides = this.build(ch, sec);
      const n = this.slides.length;
      this.index = index === 'last' ? n - 1 : Math.max(0, Math.min(n - 1, (index | 0)));
      $('notesPane').classList.toggle('collapsed', !this.notesOpen);
      this.render();
    }

    build(ch, sec) {
      const list = (sec.slides || []).map((s) => Object.assign({}, s));
      const hasGoals = list.some((s) => s.layout === 'goals' || /학습\s*목표/.test(s.title || ''));
      let at = 0;
      if (!list.length || list[0].layout !== 'title') {
        list.unshift({ layout: 'title', title: sec.title, subtitle: ch.title, notes: '<p>섹션을 소개합니다.</p>', auto: true });
      }
      at = 1;
      if (!hasGoals && sec.goals && sec.goals.length) {
        list.splice(at, 0, {
          layout: 'goals', title: '학습 목표', goals: sec.goals, flow: sec.flow, auto: true,
          notes: `<p>이번 시간에 배울 내용을 소개합니다. 목표를 소리 내어 함께 읽고, 수업이 끝날 때 다시 확인합니다.</p>${(sec.flow || []).length ? `<p class="muted">수업 흐름: ${sec.flow.map((f) => `${esc(f[0])} ${f[1]}분`).join(' → ')}</p>` : ''}`
        });
      }
      return list;
    }

    // ---------------------------------------------------------------- 렌더링
    render() {
      const s = this.slides[this.index];
      if (!s) { this.slideHost.innerHTML = ''; return; }
      const teacher = this.app.role === 'teacher';
      this.editor = null;
      const key = `${this.sec.id}@${this.index}`;
      const top = `<div class="s-top"><span class="s-ch">Chapter ${esc(this.ch.no)}</span><span>${esc(this.ch.title)}</span><span class="spacer"></span><span>${esc(this.sec.title)}</span></div>`;
      const foot = `<div class="s-foot"><span>${esc(((window.MB_COURSE && MB_COURSE.icon) || '') + ' ' + ((window.MB_COURSE && (MB_COURSE.footer || MB_COURSE.title)) || ''))}</span><span class="spacer"></span><span class="pg">${this.index + 1} / ${this.slides.length}</span></div>`;
      const title = `<h2 class="s-title">${s.title || ''}</h2>`;
      const lead = s.lead ? `<p class="s-lead">${s.lead}</p>` : '';
      let html = '';
      let cls = 'slide';

      switch (s.layout) {
        case 'title':
          cls += ' title-slide';
          html = `<div class="badge">${esc(s.badge || `Chapter ${this.ch.no} · ${this.ch.title}`)}</div>
            <h1>${s.title}</h1>
            ${s.subtitle ? `<div class="sub">${s.subtitle}</div>` : ''}
            <div class="meta"><span>⏱ ${this.sec.minutes || 50}분</span><span>🖼️ 슬라이드 ${this.slides.length}장</span></div>
            <div class="deco">🐍</div>`;
          break;
        case 'goals':
          html = top + title + `<div class="s-body"><div class="s-goals${s.goals.length > 3 ? ' dense' : ''}">${s.goals.map((g) => `<div>${g}</div>`).join('')}</div>
            ${(s.flow || []).length ? `<div class="s-flow">${s.flow.map((f) => `<div style="flex:${f[1]}"><b>${esc(f[0])}</b> ${f[1]}분</div>`).join('')}</div>` : ''}</div>` + foot;
          break;
        case 'bullets':
          html = top + title + lead + `<div class="s-body">${bulletsHtml(s.bullets, (s.bullets || []).length > 5)}</div>` + foot;
          break;
        case 'summary':
          cls += ' summary-slide';
          html = top + title + lead + `<div class="s-body">${bulletsHtml(s.bullets, (s.bullets || []).length > 5)}</div>` + foot;
          break;
        case 'code':
          html = top + title + lead + `<div class="s-body"><div class="s-code${s.points && s.points.length ? ' has-points' : ''}">
              <div class="s-editor">
                <div class="s-editor-bar"><span class="fname">${s.repl ? '&gt;&gt;&gt; 대화형 모드 (한 줄씩 실행)' : '📄 ' + esc(fileName(s.code))}</span>
                  <button class="btn ghost small" data-act="font-" title="글자 작게">A−</button>
                  <button class="btn ghost small" data-act="font+" title="글자 크게">A+</button>
                  <button class="btn ghost small" data-act="reset" title="원래 코드로">↺</button>
                  <button class="btn primary small" data-act="run" title="실행 (Ctrl+Enter)">▶ 실행</button></div>
                <div class="s-editor-host"></div>
                ${s.stdin ? `<div class="s-stdin">⌨ 입력 예: <code>${esc(s.stdin.replace(/\n$/, '').replace(/\n/g, ' ⏎ '))}</code> <button class="btn ghost small" data-act="run-stdin">예시 입력으로 실행</button></div>` : ''}
              </div>
              ${s.points && s.points.length ? `<ul class="s-points">${s.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
            </div></div>` + foot;
          break;
        case 'two': {
          const col = (c, i) => {
            if (!c) return '<div class="s-col"></div>';
            let inner = '';
            if (c.bullets) inner += bulletsHtml(c.bullets, true);
            if (c.html) inner += `<div>${JU.scoped(c.html)}</div>`;
            if (c.code) inner += `<pre class="s-static">${highlightInline(c.code)}</pre>`;
            const runBtn = c.code && c.run !== false ?`<button class="btn ghost small" data-act="run-col" data-col="${i}" style="float:right;font-size:1.1cqw">▶ 실행</button>` : '';
            return `<div class="s-col"><h3>${runBtn}${c.title || ''}</h3>${inner}</div>`;
          };
          html = top + title + lead + `<div class="s-body"><div class="s-two">${col(s.left, 'left')}${col(s.right, 'right')}</div></div>` + foot;
          break;
        }
        case 'table': {
          const rows = s.rows || [];
          const dense = rows.length > 6 || (s.head || []).length > 3;
          html = top + title + lead + `<div class="s-body"><table class="s-table${dense ? ' dense' : ''}"><thead><tr>${(s.head || []).map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` + foot;
          break;
        }
        case 'diagram':
          html = top + title + lead + `<div class="s-body"><div class="s-diagram"><div class="d-host">${JU.scoped(s.html)}</div>${s.caption ? `<div class="cap">${s.caption}</div>` : ''}</div></div>` + foot;
          break;
        case 'quiz':
          html = top + title + `<div class="s-body s-quiz"><div class="q">${s.q || ''}</div>
            <div class="opts">${(s.options || []).map((o, i) => `<button class="opt" data-opt="${i}"><span class="n">${i + 1}</span><span>${o}</span></button>`).join('')}</div>
            <div class="explain hidden">${s.explain || ''}</div>
            ${teacher ? '<div class="reveal"><button class="btn ghost small" data-act="reveal">정답 공개</button></div>' : ''}</div>` + foot;
          break;
        case 'practice': {
          const sol = !!this.solutionOn[key];
          html = top + title + `<div class="s-body"><div class="s-practice"><div class="desc">${s.desc || ''}</div>
              <div class="s-editor">
                <div class="s-editor-bar"><span class="fname">📝 ${sol ? '정답 코드' : '실습 코드'}</span>
                  ${teacher && s.solution ? `<button class="btn ghost small${sol ? ' sol-on' : ''}" data-act="solution" title="정답 코드 보기/숨기기">${sol ? '✓ 정답' : '🔑 정답'}</button>` : ''}
                  <button class="btn ghost small" data-act="reset" title="원래 코드로">↺</button>
                  <button class="btn primary small" data-act="run" title="실행 (Ctrl+Enter)">▶ 실행</button></div>
                <div class="s-editor-host"></div>
                ${s.stdin ? `<div class="s-stdin">⌨ 입력 예: <code>${esc(s.stdin.replace(/\n$/, '').replace(/\n/g, ' ⏎ '))}</code> <button class="btn ghost small" data-act="run-stdin">예시 입력으로 실행</button></div>` : ''}
              </div></div></div>` + foot;
          break;
        }
        default:
          html = top + title + `<div class="s-body">${s.html ? JU.scoped(s.html) : bulletsHtml(s.bullets)}</div>` + foot;
      }

      this.slideHost.innerHTML = `<div class="${cls}">${html}</div>`;
      const slideEl = this.slideHost.firstElementChild;

      // 코드 편집기
      const edHost = slideEl.querySelector('.s-editor-host');
      if (edHost) {
        const isPractice = s.layout === 'practice';
        const sol = isPractice && this.solutionOn[key];
        const editKey = key + (sol ? ':sol' : '');
        const original = isPractice ? (sol ? s.solution : (s.starter || '')) : s.code;
        const ed = makeEditor(edHost, this.edits[editKey] != null ? this.edits[editKey] : original, { onRun: () => this.runCode() });
        ed.on('change', () => { this.edits[editKey] = ed.getValue(); });
        const manual = +(MbRunner.store.get('mb.slideCodeFont', '0')) || 0;
        const fs = manual || autoCodeFont(ed.getValue(), !!(s.points && s.points.length), s.layout === 'practice');
        slideEl.querySelector('.s-editor').style.setProperty('--s-code-font', fs.toFixed(2) + 'cqw');
        this.editor = ed;
        this.editorOriginal = original;
        this.editorKey = editKey;
        requestAnimationFrame(() => ed.refresh());
      }

      slideEl.addEventListener('click', (e) => this.onSlideClick(e, s));
      this.ink.setSlide(`${this.sec.id}@${this.index}`);
      if (this.isFull()) this.showConsole(false);   // 슬라이드를 넘기면 결과 창은 닫힌 채로 시작
      this.updateChrome();
      this.renderNotes();
      this.broadcast();
      this.app.onSlideChange(this.sec, this.index);
      this.fit();
    }

    onSlideClick(e, s) {
      const act = e.target.closest('[data-act]');
      const opt = e.target.closest('[data-opt]');
      if (opt && s.layout === 'quiz') {
        const i = +opt.dataset.opt;
        opt.classList.add(i === s.answer ? 'right' : 'wrong');
        if (i === s.answer) this.slideHost.querySelector('.explain').classList.remove('hidden');
        return;
      }
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'run') this.runCode();
      else if (a === 'run-stdin') this.runCode(s.stdin);
      else if (a === 'reset' && this.editor) { this.editor.setValue(this.editorOriginal); delete this.edits[this.editorKey]; }
      else if (a === 'font+' || a === 'font-') {
        const cur = +(MbRunner.store.get('mb.slideCodeFont', '0')) || 1.45;
        const next = Math.max(0.9, Math.min(2.6, cur + (a === 'font+' ? 0.15 : -0.15)));
        MbRunner.store.set('mb.slideCodeFont', next.toFixed(2));
        this.slideHost.querySelector('.s-editor').style.setProperty('--s-code-font', next.toFixed(2) + 'cqw');
        this.editor && this.editor.refresh();
      } else if (a === 'solution') {
        const key = `${this.sec.id}@${this.index}`;
        this.solutionOn[key] = !this.solutionOn[key];
        this.render();
      } else if (a === 'reveal') {
        this.slideHost.querySelectorAll('.opt').forEach((o) => { if (+o.dataset.opt === s.answer) o.classList.add('right'); });
        this.slideHost.querySelector('.explain').classList.remove('hidden');
      } else if (a === 'run-col') {
        const c = s[act.dataset.col];
        this.showConsole(true);
        this.app.runCode(c.code, { label: `${s.title} · ${c.title || ''}`, repl: !!c.repl, stdin: c.repl ? c.code : undefined });
      }
    }

    runCode(stdin) {
      if (!this.editor) return;
      const s = this.slides[this.index];
      this.showConsole(true);
      const code = this.editor.getValue();
      if (s.repl) this.app.runCode(code, { label: s.title, repl: true, stdin: code });
      else this.app.runCode(code, { label: s.title, stdin, editor: this.editor });
    }

    renderNotes() {
      const pane = $('notesPane');
      if (this.app.role !== 'teacher') { pane.innerHTML = ''; return; }
      const s = this.slides[this.index];
      let answer = '';
      if (s.layout === 'quiz' && typeof s.answer === 'number') {
        answer = `<div class="answer"><b>정답: ${s.answer + 1}번</b> — ${(s.options || [])[s.answer] || ''}${s.explain ? `<div>${s.explain}</div>` : ''}</div>`;
      }
      if (s.layout === 'practice' && s.solution) {
        answer = `<div class="answer"><b>🔑 정답 코드</b> <button class="btn small ghost" id="noteRunSol">▶ 정답 실행</button> <button class="btn small ghost" id="noteShowSol">슬라이드에 표시</button>
          <pre style="margin:6px 0 0;font-size:12.5px;overflow:auto;max-height:260px">${highlightInline(s.solution)}</pre></div>`;
      }
      const flow = (this.sec.flow || []).map((f) => `<div class="row"><span>${esc(f[0])}</span><b>${f[1]}분</b></div>`).join('');
      const nextS = this.slides[this.index + 1];
      const nextTxt = nextS ? `${LAYOUT_ICON[nextS.layout] || ''} ${plain(nextS.title)}` : '이 교시의 마지막 슬라이드';
      pane.innerHTML = `<div class="notes-head" title="눌러서 접기 / 펼치기 (N)">
          <span class="nh-title">🗒 교사용 노트</span>
          <span class="muted" style="font-size:12px">${LAYOUT_ICON[s.layout] || ''} ${LAYOUT_NAME[s.layout] || ''} · ${this.index + 1}/${this.slides.length}</span>
          <span class="spacer"></span>
          <span class="nh-next">다음 ▸ ${esc(nextTxt)}</span>
          <button class="btn ghost small" data-notes-fold>${this.notesOpen ? '▾ 접기' : '▴ 펼치기'}</button>
        </div>
        <div class="notes-body"><div class="n-grid"><div class="n-notes">
          ${s.notes || '<p class="muted">노트 없음</p>'}${answer}</div>
        <div class="n-side"><h5>⏱ 수업 흐름 (${this.sec.minutes || 50}분)</h5>${flow || '<span class="muted">-</span>'}
          <h5 style="margin-top:12px">다음 슬라이드</h5><div>${esc(nextTxt)}</div></div></div></div>`;
      pane.querySelector('.notes-head').onclick = () => this.toggleNotes();
      const run = $('noteRunSol');
      if (run) run.onclick = () => { this.showConsole(true); this.app.runCode(s.solution, { label: s.title + ' (정답)', stdin: s.stdin }); };
      const show = $('noteShowSol');
      if (show) show.onclick = () => { this.solutionOn[`${this.sec.id}@${this.index}`] = true; this.render(); };
    }

    updateChrome() {
      const n = this.slides.length;
      const txt = `${this.index + 1} / ${n}`;
      $('sCount').textContent = txt;
      $('fsCount').textContent = txt;
      const sl = $('sSlider');
      sl.max = String(Math.max(1, n));
      sl.value = String(this.index + 1);
      const s = this.slides[this.index] || {};
      const t = plain(s.title);
      $('sTitle').textContent = t;
      $('sTitle').title = t;
      $('sFirst').disabled = this.index === 0;
      $('deckProgress').style.width = (n > 1 ? (this.index / (n - 1)) * 100 : 100) + '%';
      this.syncInkBar();
      if (!$('gridOverlay').classList.contains('hidden')) this.renderGrid();
    }

    /* ---------------------------------------------------------------- 판서 */
    canDraw() { return this.app.role === 'teacher'; }

    syncInkBar() {
      const bar = $('inkBar');
      if (!bar) return;
      bar.querySelectorAll('[data-ink-tool]').forEach((b) => b.classList.toggle('on', b.dataset.inkTool === this.ink.tool));
      bar.querySelectorAll('[data-ink-color]').forEach((b) => b.classList.toggle('on', b.dataset.inkColor === this.ink.color));
      bar.querySelectorAll('[data-ink-width]').forEach((b) => b.classList.toggle('on', +b.dataset.inkWidth === this.ink.width));
      $('inkUndo').disabled = !this.ink.canUndo();
      $('inkClear').disabled = !this.ink.hasInk();
      $('inkClearAll').disabled = !this.ink.hasAnyInk();
    }

    /** 지우개 · 지시봉 상태에서 색이나 굵기를 고르면 자동으로 펜으로 돌아갑니다 */
    backToPen() { if (this.ink.tool === 'eraser' || this.ink.tool === 'pointer') this.ink.setTool('pen'); }

    bindInkBar() {
      $('inkBar').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.dataset.inkTool) this.ink.setTool(b.dataset.inkTool);
        else if (b.dataset.inkColor) { this.ink.setColor(b.dataset.inkColor); this.backToPen(); }
        else if (b.dataset.inkWidth) { this.ink.setWidth(+b.dataset.inkWidth); this.backToPen(); }
        else if (b.id === 'inkUndo') this.ink.undoLast();
        else if (b.id === 'inkClear') this.ink.clearSlide();
        else if (b.id === 'inkClearAll') this.ink.clearAll();
      });
    }

    // ---------------------------------------------------------------- 이동
    go(i) {
      if (i < 0) return this.app.stepSection(-1, 'last');
      if (i >= this.slides.length) return this.app.stepSection(1, 0);
      this.index = i;
      this.render();
    }
    next() { this.go(this.index + 1); }
    prev() { this.go(this.index - 1); }
    first() { this.go(0); }

    renderGrid() {
      const g = $('gridOverlay');
      g.innerHTML = `<h4>▦ ${esc(this.sec.title)} <span class="muted" style="font-weight:500">슬라이드 ${this.slides.length}장</span><span class="spacer"></span><button class="btn small ghost" data-close>닫기 (Esc)</button></h4>
        <div class="grid-list">${this.slides.map((s, i) => `<button class="grid-item${i === this.index ? ' cur' : ''}" data-i="${i}">
          <span class="gi-n">${i + 1}</span><span class="gi-l">${LAYOUT_ICON[s.layout] || ''} ${LAYOUT_NAME[s.layout] || s.layout}</span>
          <span class="gi-t">${String(s.title || '').replace(/<[^>]+>/g, '')}</span></button>`).join('')}</div>`;
    }
    toggleGrid(force) {
      const g = $('gridOverlay');
      const show = force != null ? force : g.classList.contains('hidden');
      g.classList.toggle('hidden', !show);
      if (show) this.renderGrid();
    }

    toggleNotes() {
      this.notesOpen = !this.notesOpen;
      MbRunner.store.set('mb.notesOpen', this.notesOpen ? '1' : '0');
      $('notesPane').classList.toggle('collapsed', !this.notesOpen);
      const b = $('notesPane').querySelector('[data-notes-fold]');
      if (b) b.textContent = this.notesOpen ? '▾ 접기' : '▴ 펼치기';
      this.fit();
    }

    // ---------------------------------------------------------------- 전체 화면 · 결과 패널
    isFull() { return this.wrap.classList.contains('is-full'); }

    async toggleFull() {
      if (this.isFull()) {
        if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) { /* 무시 */ } }
        this.wrap.classList.remove('pfull');
        this.onFullChange();
        return;
      }
      this.fsConsole = false;              // 발표를 시작할 때 결과 창은 닫힌 상태
      try {
        if (!this.wrap.requestFullscreen) throw new Error('unsupported');
        await this.wrap.requestFullscreen();
      } catch (e) {
        // 전체 화면 API 를 쓸 수 없는 환경(iframe 등): 창 전체를 채우는 발표 모드
        this.wrap.classList.add('pfull');
        this.onFullChange();
      }
    }

    onFullChange() {
      const panel = $('consolePanel');
      const slot = $('fsConsoleSlot');
      const full = document.fullscreenElement === this.wrap || this.wrap.classList.contains('pfull');
      this.wrap.classList.toggle('is-full', full);
      if (full) {
        // 전체 화면에서는 대상 요소 안쪽만 보이므로 상단 메뉴와 결과 창을 안으로 옮깁니다
        this.wrap.insertBefore(this.bars, this.wrap.firstChild);
        slot.appendChild(panel);
        slot.classList.toggle('off', !this.fsConsole);
      } else {
        $('slideView').insertBefore(this.bars, $('slideView').firstChild);
        $('output').appendChild(panel);
        this.wrap.classList.remove('bar-peek', 'idle');
      }
      this.fit();
      setTimeout(() => this.fit(), 120);
    }

    showConsole(on) {
      this.fsConsole = on;
      $('fsConsoleSlot').classList.toggle('off', !on);
      this.fit();
    }

    /** 1280 x 720 고정 무대를 화면 크기에 맞춰 축소·확대한다 */
    fit() {
      const host = this.host;
      const cs = getComputedStyle(host);
      const w = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (w <= 0 || h <= 0) return;
      const k = Math.min(w / SW, h / SH);
      this.scale = k;
      this.fitBox.style.width = Math.floor(SW * k) + 'px';
      this.fitBox.style.height = Math.floor(SH * k) + 'px';
      this.stage.style.transform = `scale(${k})`;
      this.edgePx = Math.max(28, SW * k * 0.06);
      this.wrap.querySelectorAll('.edge-band').forEach((b) => { b.style.width = this.edgePx + 'px'; });
    }

    /* ---------------------------------------------------------------- 슬라이드 위 조작 */
    /** 버튼 · 링크 · 퀴즈 보기 · 편집기 위에서는 슬라이드 조작을 하지 않습니다 */
    isInteractive(t) {
      return !!(t && t.closest && t.closest('button, a, input, select, textarea, label, .CodeMirror, .opt, [data-act], [data-opt]'));
    }

    /** 화면 좌표 → 슬라이드 좌표(1280 x 720) */
    toSlide(e) {
      const r = this.fitBox.getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
    }

    /** 가장자리 구간(슬라이드 너비의 6%, 최소 28px) 판정 */
    zoneOf(e) {
      const r = this.fitBox.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (x < this.edgePx) return 'prev';
      if (x > r.width - this.edgePx) return 'next';
      return 'mid';
    }

    setCursor(zone, inter) {
      const st = this.stage;
      st.classList.remove('cur-prev', 'cur-next', 'cur-point', 'cur-marker', 'cur-eraser');
      this.wrap.querySelectorAll('.edge-band').forEach((b) => b.classList.remove('hot'));
      if (inter || zone === 'off') return;
      if (zone === 'prev' || zone === 'next') {
        st.classList.add('cur-' + zone);
        const band = this.wrap.querySelector('.edge-band.' + zone);
        if (band) band.classList.add('hot');
        return;
      }
      const tool = this.canDraw() ? this.ink.tool : 'pointer';
      st.classList.add(tool === 'marker' ? 'cur-marker' : tool === 'eraser' ? 'cur-eraser' : 'cur-point');
    }

    bindStage() {
      const st = this.stage;
      st.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.isInteractive(e.target)) return;
        const zone = this.zoneOf(e);
        this.press = { zone, x: e.clientX, y: e.clientY, moved: false, drawing: false };
        if (zone === 'mid' && this.canDraw() && this.ink.begin(this.toSlide(e).x, this.toSlide(e).y)) {
          this.press.drawing = true;
          try { st.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
          e.preventDefault();
        }
      });

      st.addEventListener('pointermove', (e) => {
        const pr = this.press;
        if (pr && pr.drawing) { const p = this.toSlide(e); this.ink.move(p.x, p.y); return; }
        if (pr) {
          if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 4) pr.moved = true;
          return;                                    // 누르고 있는 동안에는 커서를 바꾸지 않습니다
        }
        this.setCursor(this.zoneOf(e), this.isInteractive(e.target));
      });

      const release = (e) => {
        const pr = this.press;
        this.press = null;
        if (!pr) return;
        if (pr.drawing) { this.ink.end(); return; }   // 그리기를 끝낸 클릭으로는 쪽을 넘기지 않습니다
        if (pr.moved) return;
        if (pr.zone === 'prev') this.prev();
        else if (pr.zone === 'next') this.next();
      };
      st.addEventListener('pointerup', release);
      st.addEventListener('pointercancel', () => { if (this.press && this.press.drawing) this.ink.end(); this.press = null; });
      st.addEventListener('pointerleave', () => { if (!this.press) this.setCursor('off', false); });
    }

    blackout(force) {
      const b = $('blackout');
      b.classList.toggle('hidden', force != null ? !force : !b.classList.contains('hidden'));
    }

    // ---------------------------------------------------------------- 타이머
    timerToggle() {
      if (this.timer.start) { this.timer.acc += Date.now() - this.timer.start; this.timer.start = 0; }
      else this.timer.start = Date.now();
      this.timerDraw();
    }
    timerReset() { this.timer.acc = 0; if (this.timer.start) this.timer.start = Date.now(); this.timerDraw(); }
    timerDraw() {
      const ms = this.timer.acc + (this.timer.start ? Date.now() - this.timer.start : 0);
      const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60;
      $('timerText').textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      $('timerBox').classList.toggle('running', !!this.timer.start);
      $('timerBox').classList.toggle('over', this.sec && m >= (this.sec.minutes || 50));
      $('timerIcon').textContent = this.timer.start ? '⏸' : '⏱';
    }

    // ---------------------------------------------------------------- 발표자 창
    broadcast() {
      if (!this.channel || !this.sec) return;
      const s = this.slides[this.index];
      const n = this.slides[this.index + 1];
      let notes = s.notes || '';
      if (s.layout === 'quiz' && typeof s.answer === 'number') notes += `<p><b>정답: ${s.answer + 1}번</b> ${(s.options || [])[s.answer] || ''}</p>`;
      this.channel.postMessage({
        type: 'state', lesson: `Chapter ${this.ch.no} ${this.ch.title} · ${this.sec.title}`, index: this.index, total: this.slides.length,
        title: s.title, notes, next: n ? n.title : '', schedule: this.sec.flow || [], minutes: this.sec.minutes || 50
      });
    }

    // ---------------------------------------------------------------- 이벤트
    bind() {
      $('sFirst').onclick = () => this.first();
      $('sPrev').onclick = () => this.prev();
      $('sNext').onclick = () => this.next();
      $('sSlider').addEventListener('input', (e) => { const i = (+e.target.value || 1) - 1; if (i !== this.index) this.go(i); });
      $('sGrid').onclick = () => this.toggleGrid();
      $('sDoc').onclick = () => this.app.setView('doc');
      $('sFull').onclick = () => this.toggleFull();
      $('sPresenter').onclick = () => { window.open('presenter.html', 'python-presenter', 'width=1100,height=720'); setTimeout(() => this.broadcast(), 800); };
      $('timerBtn').onclick = () => this.timerToggle();
      $('timerReset').onclick = () => this.timerReset();
      $('consoleHideBtn').onclick = () => this.showConsole(false);
      this.bindInkBar();
      this.bindStage();
      setInterval(() => this.timerDraw(), 500);

      $('gridOverlay').addEventListener('click', (e) => {
        const it = e.target.closest('[data-i]');
        if (it) { this.toggleGrid(false); this.go(+it.dataset.i); }
        if (e.target.closest('[data-close]')) this.toggleGrid(false);
      });
      this.wrap.querySelector('.fs-controls').addEventListener('click', (e) => {
        const b = e.target.closest('[data-fs]');
        if (!b) return;
        const a = b.dataset.fs;
        if (a === 'prev') this.prev();
        if (a === 'next') this.next();
        if (a === 'grid') this.toggleGrid();
        if (a === 'console') this.showConsole(!this.fsConsole);
        if (a === 'black') this.blackout();
        if (a === 'exit') this.toggleFull();
      });
      document.addEventListener('fullscreenchange', () => this.onFullChange());
      new ResizeObserver(() => this.fit()).observe(this.host);

      let idleT = 0;
      this.wrap.addEventListener('mousemove', (e) => {
        this.wrap.classList.remove('idle');
        clearTimeout(idleT);
        if (this.isFull()) this.wrap.classList.toggle('bar-peek', e.clientY - this.wrap.getBoundingClientRect().top < 56);
        idleT = setTimeout(() => { if (this.isFull()) this.wrap.classList.add('idle'); }, 2500);
      });

      document.addEventListener('keydown', (e) => {
        if (!this.active || !this.sec) return;
        if (!$('modal').classList.contains('hidden')) return;
        const t = e.target;
        if (t.closest && (t.closest('.gw') || t.closest('.gd-back'))) return; // 파이썬 GUI 창(거북이 · tkinter)의 키 입력
        if (t.closest && (t.closest('.CodeMirror') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) {
          if (e.key === 'Escape' && t.closest('.CodeMirror')) t.blur ? document.activeElement.blur() : 0;
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {   // 판서 되돌리기
          if (this.canDraw()) { e.preventDefault(); this.ink.undoLast(); }
          return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key;
        if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); this.next(); }
        else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); this.prev(); }
        else if (k === 'End') { e.preventDefault(); this.go(this.slides.length - 1); }
        else if (k === 'f' || k === 'F') { e.preventDefault(); this.toggleFull(); }
        else if (k === 'g' || k === 'G') { e.preventDefault(); this.toggleGrid(); }
        else if (k === 'r' || k === 'R') { e.preventDefault(); if (this.isFull()) this.showConsole(!this.fsConsole); }
        else if ((k === 'n' || k === 'N') && this.app.role === 'teacher') { e.preventDefault(); this.toggleNotes(); }
        else if (k === 'Home') { e.preventDefault(); this.first(); }
        else if (k === 'b' || k === 'B' || k === '.') { e.preventDefault(); this.blackout(); }
        else if ((k === 't' || k === 'T') && this.app.role === 'teacher') { e.preventDefault(); this.timerToggle(); }
        else if (k === 'Escape') {
          // 크게 보기가 열려 있으면 그것만 닫고 발표 화면은 그대로 둡니다
          if (this.app.lightboxOpen()) { e.preventDefault(); this.app.closeLightbox(); return; }
          if ($('gridOverlay').classList.contains('hidden') && this.wrap.classList.contains('pfull')) this.toggleFull();
          this.toggleGrid(false); this.blackout(false);
        }
      });

      if (this.channel) {
        this.channel.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.type === 'hello') this.broadcast();
          if (m.type === 'nav' && this.active) { if (m.dir > 0) this.next(); else this.prev(); }
        };
      }
    }
  }

  window.Deck = Deck;
})();
