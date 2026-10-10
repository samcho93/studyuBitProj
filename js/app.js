/* 마이크로비트 MicroPython 웹 실습 강좌 — 메인 앱
 * 목차 · 강좌 문서 · 코드 편집기 · 진도 · 역할(학생/교사) · 보기(문서/슬라이드) · 시뮬레이터 · 보드 연결
 */
(function () {
  const { esc, highlightLines, makeEditor } = window.JU;
  const { store } = window.MbRunner;
  const C = window.MB_COURSE;
  const $ = (id) => document.getElementById(id);
  const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

  /* 교사용 화면 비밀번호.
   * 정답 · 교사 노트가 학생에게 그냥 보이지 않도록 막는 안전장치일 뿐,
   * 모든 판단이 브라우저 안에서 이루어지므로 보안 수단은 아닙니다. */
  const TEACHER_PASS = String(C.teacherPass || '');

  const app = {
    role: 'student',
    view: 'doc',
    route: { type: 'home' },
    done: new Set(),
    blockCodes: {},
    activeEditor: null,
    target: 'sim'          // sim | board
  };
  window.MbApp = app;

  /* ============================================================== 초기화 */
  async function init() {
    applyTheme(store.get('mb.theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    try { JSON.parse(store.get('mb.done', '[]')).forEach((id) => app.done.add(id)); } catch (e) { /* 무시 */ }

    const q = new URLSearchParams(location.search);
    app.role = q.get('role') === 'teacher' ? 'teacher' : q.get('role') === 'student' ? 'student' : store.get('mb.role', 'student');
    app.viewPref = q.get('view');
    const wantTeacher = app.role === 'teacher';
    if (wantTeacher && !teacherVerified()) app.role = 'student';
    setRole(app.role, true);
    if (wantTeacher && app.role !== 'teacher') setTimeout(() => requireTeacher(() => setRole('teacher')), 300);

    app.sim = new MicrobitSim(app);
    MbEngine.sim = app.sim;
    app.console = new MbRunner.MbConsole($('consolePanel'), app);
    app.console.onJump = (line) => { if (app.activeEditor) app.activeEditor.jump(line); };
    app.simView = new SimView(app.sim, app);
    app.serial = new MicrobitSerial(app);
    setupEditor();
    app.deck = new Deck(app);
    setupLayout();
    setupServerBadge();
    bindUi();

    await loadLessons();
    buildNav();
    updateProgress();
    window.addEventListener('hashchange', () => routeFromHash());
    routeFromHash();
    app.console.setPrompt();
  }

  function loadLessons() {
    return Promise.all(C.order.map((o) => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `lessons/${o.id}.js`;
      s.async = false;
      s.onload = resolve;
      s.onerror = resolve;
      document.body.appendChild(s);
    })));
  }

  const chapters = () => C.order.map((o) => C.chapters[o.id] ? Object.assign({ icon: o.icon, ref: o.ref }, C.chapters[o.id]) : null).filter(Boolean);
  const allSections = () => chapters().flatMap((ch) => ch.sections.map((s) => ({ ch, sec: s })));
  function findSection(id) {
    for (const ch of chapters()) {
      const sec = ch.sections.find((s) => s.id === id);
      if (sec) return { ch, sec };
    }
    return null;
  }

  /* ============================================================== 테마 · 역할 · 보기 */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set('mb.theme', t);
  }

  function setRole(role, silent) {
    app.role = role;
    store.set('mb.role', role);
    document.body.classList.toggle('role-teacher', role === 'teacher');
    document.querySelectorAll('.role-switch button').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
    $('brandSub').textContent = role === 'teacher' ? '🧑‍🏫 교사용 · 슬라이드 수업 모드' : '🎓 학생용 · 문서 + 실습';
    const q = new URLSearchParams(location.search);
    q.set('role', role);
    q.delete('view');
    history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
    if (!silent) {
      app.view = role === 'teacher' ? 'slides' : 'doc';
      render();
    }
  }

  function setView(view) { app.view = view; render(); }
  app.setView = setView;

  /* 한 번 확인하면 그 브라우저에서는 다시 묻지 않습니다 */
  function teacherVerified() { return !TEACHER_PASS || store.get('mb.teacherOk', '0') === '1'; }

  function requireTeacher(then) {
    if (teacherVerified()) return then();
    openModal('🔒 교사용 화면', `
      <p>교사용 화면에는 <b>퀴즈 · 실습 정답</b>, <b>교사 노트</b>, <b>판서 도구</b>가 들어 있습니다.<br>
        비밀번호를 입력해 주세요. 한 번 확인하면 이 브라우저에서는 다시 묻지 않습니다.</p>
      <form id="passForm" style="display:flex;gap:8px;margin-top:12px">
        <input id="passInput" type="password" autocomplete="current-password" placeholder="비밀번호"
               style="flex:1;padding:8px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card2);color:var(--fg)">
        <button class="btn primary" type="submit">확인</button>
      </form>
      <p id="passMsg" class="muted" style="margin:10px 0 0;font-size:13px">
        교사용 비밀번호를 입력하세요.</p>`);
    setTimeout(() => { const i = $('passInput'); if (i) i.focus(); }, 60);
    $('passForm').onsubmit = (e) => {
      e.preventDefault();
      if ($('passInput').value.trim() === TEACHER_PASS) {
        store.set('mb.teacherOk', '1');
        closeModal();
        then();
      } else {
        const m = $('passMsg');
        m.textContent = '비밀번호가 맞지 않습니다. 다시 입력해 주세요.';
        m.style.color = 'var(--danger)';
        $('passInput').select();
      }
    };
  }

  function goRole(role) {
    if (role === 'teacher') requireTeacher(() => setRole('teacher'));
    else setRole('student');
  }

  /* ============================================================== 편집기 */
  function setupEditor() {
    app.editor = makeEditor($('editorHost'), '', { onRun: () => runEditor() });
    app.editorState = { key: null, label: '', original: '' };
    app.editor.on('change', () => {
      const st = app.editorState;
      if (st.key) store.set('mb.ed.' + st.key, JSON.stringify({ code: app.editor.getValue(), label: st.label, original: st.original }));
    });
    setEditorFont(+store.get('mb.edFont', 14));
  }

  function setEditorFont(px) {
    app.edFont = Math.max(10, Math.min(28, px));
    document.documentElement.style.setProperty('--ed-font', app.edFont + 'px');
    store.set('mb.edFont', app.edFont);
    app.editor.refresh();
  }

  function loadEditor(code, label, key) {
    app.editorState = { key: key || app.editorState.key, label: label || '', original: code };
    app.editor.setValue(code);
    $('editorLabel').textContent = label ? '· ' + label : '';
    if (app.editorState.key) store.set('mb.ed.' + app.editorState.key, JSON.stringify({ code, label, original: code }));
    $('editorPane').classList.remove('folded');
    $('foldBtn').textContent = '▾ 접기';
    setTimeout(() => app.editor.refresh(), 0);
  }

  function restoreEditor(sectionId, fallbackCode, fallbackLabel) {
    let saved = null;
    try { saved = JSON.parse(store.get('mb.ed.' + sectionId, 'null')); } catch (e) { saved = null; }
    if (saved && saved.code != null) {
      app.editorState = { key: sectionId, label: saved.label || '', original: saved.original || saved.code };
      app.editor.setValue(saved.code);
      $('editorLabel').textContent = saved.label ? '· ' + saved.label : '';
    } else {
      app.editorState = { key: sectionId, label: fallbackLabel || '', original: fallbackCode || '' };
      app.editor.setValue(fallbackCode || '');
      $('editorLabel').textContent = fallbackLabel ? '· ' + fallbackLabel : '';
    }
    setTimeout(() => app.editor.refresh(), 0);
  }

  function runEditor() {
    app.runCode(app.editor.getValue(), { label: app.editorState.label || 'main.py', editor: app.editor });
  }

  app.runCode = function (code, opts = {}) {
    app.activeEditor = opts.editor || null;
    if (opts.repl) {
      // 대화형 예제: 셸에 한 줄씩 넣어 실행한다
      return runInShell(String(opts.stdin || code));
    }
    return app.console.execute(code, {
      label: opts.label,
      target: app.target === 'board' ? 'board' : 'sim',
      onDiagnostics: (d) => { if (opts.editor) opts.editor.markErrors(d); }
    });
  };

  async function runInShell(text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const con = app.console;
    con.pending = [];
    for (const line of lines) {
      con.input.value = line;
      await con.shellLine();
    }
    if (con.pending.length) { con.input.value = ''; await con.shellLine(); }
    con.input.focus({ preventScroll: true });
  }

  app.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(app._toast);
    app._toast = setTimeout(() => t.classList.add('hidden'), 1900);
  };

  app.log = function (text, kind) {
    app.console.write(kind === 'err' ? 'e' : kind === 'info' || kind === 'speech' ? 'm' : 'o', String(text) + (/\n$/.test(text) ? '' : '\n'));
  };

  app.onRunState = function (state) {
    $('runSimBtn').disabled = state === 'running';
    $('stopSimBtn').disabled = state === 'idle';
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); app.toast('복사했습니다'); } catch (e) { app.toast('복사하지 못했습니다'); }
  }

  /* ============================================================== 실제 보드(Web Serial) */
  app.serialMode = () => app.target === 'board' && app.serial.connected;
  app.serialLog = (s, kind) => app.console.write(kind === 'info' ? 'm' : 'o', s);

  app.onSerialState = function (on) {
    $('connectBtn').classList.toggle('primary', on);
    $('connectBtn').textContent = on ? '🔌 연결됨' : '🔌 보드';
    if (!on && app.target === 'board') setTarget('sim');
    updateTargetChip();
  };

  app.serialRun = async function (code) {
    try {
      await app.serial.runOnce(code, (m) => app.console.write('m', m + '\n'));
      app.console.setState('running', '보드에서 실행 중');
      app.console.setRunning(true);
    } catch (e) {
      app.console.write('e', String(e.message || e) + '\n');
      app.console.setState('error', '오류');
    }
    return { ok: true };
  };

  app.serialShell = async function (line) {
    try { await app.serial.write(line + '\r\n'); } catch (e) { app.console.write('e', String(e.message || e) + '\n'); }
  };

  app.serialStop = async function () {
    try { await app.serial.stopProgram(); } catch (e) { /* 무시 */ }
    app.console.setRunning(false);
    app.console.setState('idle', '대기');
  };

  function setTarget(t) {
    app.target = t;
    updateTargetChip();
  }

  function updateTargetChip() {
    const chip = $('targetChip');
    const board = app.target === 'board';
    chip.textContent = board ? '실제 보드' : '시뮬레이터';
    chip.classList.toggle('board', board);
    chip.title = app.serial.connected ? '눌러서 시뮬레이터 ↔ 실제 보드 전환' : '보드를 연결하면 실제 micro:bit 에서 실행할 수 있습니다';
  }

  async function connectBoard() {
    if (app.serial.connected) {
      boardModal();
      return;
    }
    try {
      await app.serial.connect();
      setTarget('board');
      app.toast('micro:bit 에 연결했습니다');
    } catch (e) {
      openModal('🔌 실제 micro:bit 연결', `<p>${esc(e.message || e)}</p>
        <div class="callout info"><div class="ct">ℹ️ 연결 준비</div><div>
          <ol><li>micro:bit 를 USB 케이블로 컴퓨터에 연결합니다.</li>
          <li>보드에 <b>MicroPython 펌웨어</b>가 설치되어 있어야 합니다 —
            <a href="https://python.microbit.org" target="_blank" rel="noopener">python.microbit.org</a> 에서 빈 프로그램을 한 번 다운로드하면 설치됩니다.</li>
          <li>이 페이지를 <b>Chrome 또는 Edge</b>(데스크톱)에서 <b>https</b> 또는 <b>localhost</b> 주소로 엽니다.</li>
          <li>다시 <b>🔌 보드</b> 를 누르고 목록에서 micro:bit 를 고릅니다.</li></ol>
          <p class="muted">연결하지 않아도 시뮬레이터로 모든 실습을 할 수 있습니다.</p>
        </div></div>`);
    }
  }

  function boardModal() {
    openModal('🔌 연결된 micro:bit', `
      <div class="meta-row">
        <button class="btn primary" id="bUpload">⬆ main.py 로 저장하고 실행</button>
        <button class="btn" id="bRun">▶ 저장하지 않고 실행</button>
        <button class="btn ghost" id="bFiles">📁 보드의 파일 목록</button>
        <button class="btn ghost" id="bStop">■ 보드 프로그램 정지</button>
        <button class="btn danger" id="bDisc">연결 끊기</button>
      </div>
      <p class="muted">⬆ 로 저장하면 USB 를 빼고 <b>건전지만으로도</b> 프로그램이 돌아갑니다. ▶ 는 USB 가 연결된 동안만 실행됩니다.</p>
      <pre class="term" id="bOut" style="min-height:80px"></pre>`);
    const out = (m) => { $('bOut').textContent += m + '\n'; };
    $('bUpload').onclick = async () => {
      $('bOut').textContent = '';
      try { await app.serial.upload(app.editor.getValue(), out); out('✔ 완료'); } catch (e) { out('✗ ' + (e.message || e)); }
    };
    $('bRun').onclick = async () => {
      closeModal();
      setTarget('board');
      await app.serialRun(app.editor.getValue());
    };
    $('bFiles').onclick = async () => {
      $('bOut').textContent = '';
      try { out(await app.serial.listFiles() || '(파일 없음)'); } catch (e) { out('✗ ' + (e.message || e)); }
    };
    $('bStop').onclick = () => app.serialStop();
    $('bDisc').onclick = async () => { await app.serial.disconnect(); closeModal(); };
  }

  /* ============================================================== 목차 */
  function buildNav() {
    const q = $('navSearch').value.trim().toLowerCase();
    const tree = $('navTree');
    const cur = app.route;
    let html = `<a class="nav-home${cur.type === 'home' ? ' active' : ''}" href="#home">🏠 강좌 소개</a>`;
    C.order.forEach((o) => {
      const ch = C.chapters[o.id];
      if (!ch) {
        if (!q) html += `<div class="nav-ch"><div class="nav-ch-head" style="cursor:default;opacity:.6"><span class="no">${esc(o.no)}</span><span class="t">${esc(o.title)}</span><span class="pending">준비 중</span></div></div>`;
        return;
      }
      let secs = ch.sections;
      const hits = {};
      if (q) {
        const chHit = (ch.title + ' ' + (ch.subtitle || '')).toLowerCase().includes(q);
        secs = secs.filter((s) => {
          if (chHit || s.title.toLowerCase().includes(q)) return true;
          const text = sectionText(s).toLowerCase();
          const i = text.indexOf(q);
          if (i >= 0) { hits[s.id] = text.slice(Math.max(0, i - 18), i + q.length + 26); return true; }
          return false;
        });
        if (!secs.length) return;
      }
      const active = (cur.ch && cur.ch.id === ch.id);
      const open = q || active || (store.get('mb.open.' + ch.id, '0') === '1');
      const doneN = ch.sections.filter((s) => app.done.has(s.id)).length;
      html += `<div class="nav-ch${open ? ' open' : ''}${active ? ' active' : ''}" data-ch="${ch.id}">
        <div class="nav-ch-head"><span class="no">${esc(ch.no)}</span><span class="t" title="${esc(ch.title)}">${esc(o.icon || '')} ${esc(ch.title)}</span>
          <span class="pending">${doneN}/${ch.sections.length}</span><span class="caret">▶</span></div>
        <div class="nav-secs"><a class="nav-sec nav-overview${cur.type === 'chapter' && active ? ' active' : ''}" href="#${ch.id}"><span class="chk">ⓘ</span><span>챕터 개요</span></a>
        ${secs.map((s) => `<a class="nav-sec${cur.sec && cur.sec.id === s.id ? ' active' : ''}${app.done.has(s.id) ? ' done' : ''}" href="#${s.id}">
          <span class="chk">${app.done.has(s.id) ? '✔' : ch.sections.indexOf(s) + 1}</span><span>${esc(s.title)}${hits[s.id] ? `<span class="hit">…${esc(hits[s.id])}…</span>` : ''}</span></a>`).join('')}
        </div></div>`;
    });
    tree.innerHTML = html;
    const act = tree.querySelector('.nav-sec.active');
    if (act && !q) act.scrollIntoView({ block: 'nearest' });
  }

  const textCache = new Map();
  function sectionText(s) {
    if (textCache.has(s.id)) return textCache.get(s.id);
    const parts = [s.title, ...(s.goals || [])];
    (s.content || []).forEach((b) => parts.push(b.text || '', stripTags(b.html), b.title || '', (b.items || []).map(stripTags).join(' '), b.code || '', (b.rows || []).flat().map(stripTags).join(' ')));
    (s.practice || []).forEach((p) => parts.push(p.title, stripTags(p.desc)));
    const t = parts.join(' ');
    textCache.set(s.id, t);
    return t;
  }

  function updateProgress() {
    const all = allSections();
    const n = all.filter((x) => app.done.has(x.sec.id)).length;
    $('progressText').textContent = `${n} / ${all.length}`;
    $('progressBar').style.width = all.length ? (n / all.length * 100) + '%' : '0';
  }

  function toggleDone(id) {
    if (app.done.has(id)) app.done.delete(id); else app.done.add(id);
    store.set('mb.done', JSON.stringify([...app.done]));
    updateProgress();
    buildNav();
  }

  /* ============================================================== 라우팅 */
  function routeFromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [id, slide] = h.split('@');
    if (!id || id === 'home') app.route = { type: 'home' };
    else if (C.chapters[id]) app.route = { type: 'chapter', ch: chapters().find((c) => c.id === id) };
    else {
      const f = findSection(id);
      if (f) {
        app.route = { type: 'section', ch: f.ch, sec: f.sec, slide: slide ? Math.max(0, (+slide || 1) - 1) : (slide === '' ? 0 : null) };
        store.set('mb.last', id);
      } else app.route = { type: 'home' };
    }
    if (app.viewPref) { app.view = app.viewPref === 'slides' ? 'slides' : 'doc'; app.viewPref = null; }
    else if (!app.viewInit) app.view = app.role === 'teacher' ? 'slides' : 'doc';
    app.viewInit = true;
    render();
  }

  function go(hash) {
    if (location.hash === '#' + hash) routeFromHash();
    else location.hash = hash;
  }

  app.stepSection = function (dir, slide) {
    const all = allSections();
    const r = app.route;
    if (r.type !== 'section') return;
    const i = all.findIndex((x) => x.sec.id === r.sec.id);
    const n = all[i + dir];
    if (!n) { app.toast(dir > 0 ? '마지막 교시입니다' : '첫 교시입니다'); return; }
    app.pendingSlide = slide;
    go(n.sec.id);
  };

  app.onSlideChange = function (sec, index) {
    const h = `#${sec.id}@${index + 1}`;
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  };

  /* ============================================================== 렌더링 */
  function render() {
    const r = app.route;
    buildNav();
    document.querySelectorAll('.view-switch button').forEach((b) => b.classList.toggle('active', b.dataset.view === app.view));
    const isSection = r.type === 'section';
    const slides = isSection && app.view === 'slides';
    $('docView').classList.toggle('hidden', slides);
    $('slideView').classList.toggle('hidden', !slides);
    document.querySelector('.view-switch').style.visibility = isSection ? 'visible' : 'hidden';
    $('prevBtn').style.visibility = isSection ? 'visible' : 'hidden';
    $('nextBtn').style.visibility = isSection ? 'visible' : 'hidden';

    if (r.type === 'home') {
      $('crumb').innerHTML = '<b>강좌 소개</b>';
      renderHome();
    } else if (r.type === 'chapter') {
      $('crumb').innerHTML = `Chapter ${esc(r.ch.no)} · <b>${esc(r.ch.title)}</b>`;
      renderChapter(r.ch);
    } else {
      $('crumb').innerHTML = `Chapter ${esc(r.ch.no)} ${esc(r.ch.title)} › <b>${esc(r.sec.title)}</b>`;
      if (slides) {
        const idx = app.pendingSlide != null ? app.pendingSlide : (r.slide != null ? r.slide : 0);
        app.pendingSlide = null;
        app.deck.open(r.ch, r.sec, idx);
      } else renderSection(r.ch, r.sec);
    }
    if (!slides) setTimeout(() => app.editor.refresh(), 0);
    window.app = app;
    document.dispatchEvent(new CustomEvent('lb:render', { detail: app.route }));
  }

  /* -------------------------------------------------------------- 홈 */
  function renderHome() {
    const chs = chapters();
    const all = allSections();
    let nCode = 0, nSlides = 0, nPractice = 0, nQuiz = 0;
    all.forEach(({ sec }) => {
      nCode += (sec.content || []).filter((b) => b.type === 'code').length;
      nSlides += (sec.slides || []).length;
      nPractice += (sec.practice || []).length;
      nQuiz += (sec.quiz || []).length;
    });
    const last = store.get('mb.last', '');
    const lastF = last && findSection(last);
    const first = all[0];
    const teacher = app.role === 'teacher';
    $('content').innerHTML = `<div class="doc">
      <div class="hero">
        <h1>${esc(C.icon || '')} ${esc(C.title)}</h1>
        ${C.intro ? `<p>${C.intro}</p>` : ''}
        <p>챕터 ${chs.length}개 · 교시 ${all.length}개 · 예제 ${nCode}개 · 실습 ${nPractice}개 · 퀴즈 ${nQuiz}문항 · 슬라이드 ${nSlides}장</p>
        <div class="hero-actions">
          ${lastF ? `<a class="btn" href="#${lastF.sec.id}">⏯ 이어서 학습: ${esc(lastF.sec.title)}</a>` : ''}
          ${first ? `<a class="btn${lastF ? ' outline' : ''}" href="#${first.sec.id}">▶ 처음부터 시작</a>` : ''}
          <button class="btn outline" data-role-go="${teacher ? 'student' : 'teacher'}">${teacher ? '🎓 학생용 화면으로' : '🧑‍🏫 교사용(슬라이드) 화면으로'}</button>
        </div>
        <div class="cup">${esc(C.icon || '')}</div>
      </div>

      <h2>📚 챕터</h2>
      <div class="cards">${C.order.map((o) => {
      const ch = C.chapters[o.id];
      if (!ch) return `<div class="card disabled"><span class="ci">${o.icon}</span><span class="cn">Chapter ${esc(o.no)}</span><span class="ct">${esc(o.title)}</span><span class="cs">준비 중</span></div>`;
      const d = ch.sections.filter((s) => app.done.has(s.id)).length;
      return `<a class="card" href="#${ch.id}"><span class="ci">${o.icon}</span><span class="cn">Chapter ${esc(ch.no)}</span><span class="ct">${esc(ch.title)}</span>
          <span class="cs">${ch.sections.length}교시 · ${esc(stripTags(ch.summary).slice(0, 60))}${stripTags(ch.summary).length > 60 ? '…' : ''}</span>
          <span class="cp"><i style="width:${ch.sections.length ? d / ch.sections.length * 100 : 0}%"></i></span></a>`;
    }).join('')}</div>

      <h2>🧭 화면 구성과 사용 방법</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>구분</th><th>🎓 학생용</th><th>🧑‍🏫 교사용</th></tr></thead>
        <tbody>
          <tr><td>기본 화면</td><td>문서형 강좌 (개념 → 예제 → 실습 → 퀴즈)</td><td>슬라이드 (16:9) + 교사 노트 · 수업 흐름 · 정답</td></tr>
          <tr><td>코드 실행</td><td>예제의 <b>▶ 실행</b> 또는 편집기에서 <kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>코드 슬라이드에서 바로 수정하고 ▶ 실행 (전체 화면에서도 시뮬레이터 표시)</td></tr>
          <tr><td>결과 확인</td><td colspan="2">오른쪽 <b>micro:bit 시뮬레이터</b>에서 LED · 소리 · 핀이 움직이고, 아래 <b>콘솔</b>에 <code>print()</code> 출력이 보입니다.</td></tr>
          <tr><td>파이썬 셸</td><td colspan="2">콘솔 아래 <code>&gt;&gt;&gt;</code> 칸에 한 줄씩 입력해 바로 확인합니다. (REPL — 실제 보드의 셸과 같은 방식)</td></tr>
          <tr><td>보드 연결</td><td colspan="2">오른쪽 위 <b>🔌 보드</b> → USB 로 연결 → 같은 코드를 실제 micro:bit 에 올립니다. (Chrome · Edge)</td></tr>
        </tbody></table></div>

      <h2>📟 시뮬레이터로 할 수 있는 것</h2>
      <div class="cards small">
        <div class="card static"><span class="ci">🔆</span><span class="ct">LED 화면</span><span class="cs">5×5, 밝기 0~9, 스크롤 · 애니메이션</span></div>
        <div class="card static"><span class="ci">🔘</span><span class="ct">버튼 A · B · 로고</span><span class="cs">마우스로 누르거나 키보드 A · B</span></div>
        <div class="card static"><span class="ci">🧭</span><span class="ct">센서</span><span class="cs">가속도 · 나침반 · 온도 · 빛 · 소리</span></div>
        <div class="card static"><span class="ci">🔌</span><span class="ct">핀 입출력</span><span class="cs">디지털 · 아날로그 · PWM · 터치</span></div>
        <div class="card static"><span class="ci">🧩</span><span class="ct">부품 연결</span><span class="cs">LED · 버튼 · 가변저항 · 부저 · 서보 · NeoPixel</span></div>
        <div class="card static"><span class="ci">📡</span><span class="ct">무선 · 저장 · 로깅</span><span class="cs">radio · 파일 시스템 · log 모듈</span></div>
      </div>

      <ul class="steps">
        <li><b>교시 선택</b> — 왼쪽 목차에서 챕터와 교시를 고릅니다. 위쪽의 📄 문서 / 🖼️ 슬라이드 버튼으로 보기를 바꿉니다.</li>
        <li><b>코드 실행</b> — 예제의 ▶ 실행을 누르면 편집기로 코드가 들어가고 오른쪽 시뮬레이터가 움직입니다. 코드를 고쳐 다시 실행해 보세요. (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>)</li>
        <li><b>조작하기</b> — 보드 그림의 버튼 A · B 를 누르고, 아래 탭에서 센서 값을 바꾸거나 부품을 연결합니다. 끝나지 않는 프로그램은 <b>■ 중지</b>.</li>
        <li><b>교사용 수업</b> — 🧑‍🏫 교사용으로 바꾸면 슬라이드가 열립니다. <kbd>F</kbd> 전체 화면, <kbd>←</kbd> <kbd>→</kbd> 이동, <kbd>R</kbd> 결과 패널, <kbd>G</kbd> 목록, <kbd>N</kbd> 노트, <kbd>B</kbd> 화면 가리기, <kbd>T</kbd> 타이머.</li>
      </ul>
      <div class="callout info"><div class="ct">ℹ️ 실행 환경 <span id="homeEnv" class="muted" style="font-weight:600">준비 전</span></div><div>
        <p>파이썬은 <b>브라우저 안</b>(<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a>)에서 실행되고, <code>microbit</code> · <code>music</code> · <code>radio</code> · <code>speech</code> · <code>neopixel</code> · <code>log</code> 모듈은 이 강좌용 시뮬레이션 모듈로 동작합니다.
          처음 실행할 때 실행 환경을 내려받느라 <b>5~20초</b> 걸리고, 그 뒤로는 바로 실행됩니다.</p>
        <p>여기서 만든 코드는 <b>수정 없이 실제 micro:bit 에서도 그대로 동작</b>합니다. 실제 보드에는
          <a href="https://python.microbit.org" target="_blank" rel="noopener">python.microbit.org</a> 로 MicroPython 을 먼저 설치하세요.</p>
      </div></div>
    </div>`;
    updateEnvText();
    $('content').scrollTop = 0;
    restoreEditor('home', 'from microbit import *\n\ndisplay.scroll("Hello!")\ndisplay.show(Image.HEART)\n', '첫 micro:bit 프로그램');
  }

  /* -------------------------------------------------------------- 챕터 개요 */
  function renderChapter(ch) {
    const secMeta = (s) => {
      const nc = (s.content || []).filter((b) => b.type === 'code').length;
      return `${s.minutes || 50}분 · 예제 ${nc} · 실습 ${(s.practice || []).length} · 슬라이드 ${(s.slides || []).length}`;
    };
    $('content').innerHTML = `<div class="doc">
      <span class="chapter-badge">${esc(ch.icon || '')} Chapter ${esc(ch.no)}</span>
      <h1>${esc(ch.title)} ${ch.subtitle ? `<span class="muted" style="font-size:.6em;font-weight:600">${esc(ch.subtitle)}</span>` : ''}</h1>
      <p class="lead">${ch.summary || ''}</p>
      ${(ch.goals || []).length ? `<div class="goals"><b>🎯 챕터 학습 목표</b><ul>${ch.goals.map((g) => `<li>${g}</li>`).join('')}</ul></div>` : ''}
      <div class="meta-row">
        <a class="btn primary" href="#${ch.sections[0].id}">▶ 첫 교시 시작</a>
        <button class="btn" data-slides="${ch.sections[0].id}">🖼️ 슬라이드로 수업</button>
        ${ch.ref ? `<a class="btn ghost" href="${esc(ch.ref)}" target="_blank" rel="noopener">${esc(C.refLabel || '📑 참고 문서 보기')}</a>` : ''}
      </div>
      <h2>교시 구성</h2>
      <div class="sec-list">${ch.sections.map((s, i) => `<a class="sec-item" href="#${s.id}"><span class="sn">${i + 1}</span>
        <span class="st">${esc(s.title)}<div class="sm">${secMeta(s)}</div></span><span>${app.done.has(s.id) ? '✅' : ''}</span></a>`).join('')}</div>
    </div>`;
    $('content').scrollTop = 0;
    restoreEditor(ch.id, '', '');
  }

  /* -------------------------------------------------------------- 교시 문서 */
  function codeBlockHtml(b, id, opts = {}) {
    const runnable = b.run !== false;
    if (b.repl) {
      return `<div class="code-block repl" id="cb-${id}">
      <div class="code-head"><span class="t"><span class="tag">&gt;&gt;&gt;</span>${esc(b.title || '파이썬 셸에서 해 보기')}</span>
        <button class="btn small primary" data-code-act="run" data-code="${id}" title="오른쪽 아래 파이썬 셸(>>>)에서 한 줄씩 실행">▶ 셸에서 실행</button>
        <button class="btn small ghost" data-code-act="copy" data-code="${id}" title="코드 복사">⧉</button></div>
      <pre>${window.JU.highlightRepl(b.code)}</pre>
      ${b.desc ? `<div class="code-desc">${b.desc}</div>` : ''}${b.expect != null && !opts.noExpect ? `<details class="expect"><summary>실행 결과 예시</summary><pre class="term">${esc(String(b.expect).replace(/\s+$/, ''))}</pre></details>` : ''}</div>`;
    }
    const hint = b.hint ? `<div class="stdin-hint">${b.hint}</div>` : '';
    const expect = b.expect != null && !b.nondeterministic && !opts.noExpect ? `<details class="expect"><summary>실행 결과 · 화면 예시</summary><pre class="term">${esc(String(b.expect).replace(/\s+$/, ''))}</pre></details>` : '';
    const tag = opts.tag ? `<span class="tag">${esc(opts.tag)}</span>` : '';
    return `<div class="code-block" id="cb-${id}">
      <div class="code-head"><span class="t">${tag}${b.title ? esc(b.title) : 'main.py'}</span>
        ${runnable ? `<button class="btn small primary" data-code-act="run" data-code="${id}" title="편집기로 불러와 시뮬레이터에서 실행">▶ 실행</button>` : '<span class="chip">설명용 코드 조각</span>'}
        <button class="btn small ghost" data-code-act="edit" data-code="${id}" title="아래 편집기로 불러오기">✎ 편집기로</button>
        <button class="btn small ghost" data-code-act="copy" data-code="${id}" title="코드 복사">⧉</button></div>
      <pre>${highlightLines(b.code)}</pre>${hint}
      ${b.desc ? `<div class="code-desc">${b.desc}</div>` : ''}${expect}</div>`;
  }

  function renderSection(ch, sec) {
    const teacher = app.role === 'teacher';
    app.blockCodes = {};
    let n = 0;
    const reg = (code, title, repl) => { const id = 'c' + (n++); app.blockCodes[id] = { code, title, repl: !!repl }; return id; };
    const idx = ch.sections.indexOf(sec);
    const all = allSections();
    const gi = all.findIndex((x) => x.sec.id === sec.id);
    const prev = all[gi - 1], next = all[gi + 1];
    let firstCode = null;

    const blocks = (sec.content || []).map((b) => {
      switch (b.type) {
        case 'h': return `<h3>${esc(b.text)}</h3>`;
        case 'p': return `<p>${window.JU.scoped(b.html)}</p>`;
        case 'list': {
          const tagName = b.ordered ? 'ol' : 'ul';
          return `<${tagName}>${(b.items || []).map((i) => `<li>${i}</li>`).join('')}</${tagName}>`;
        }
        case 'table':
          return `<div class="table-wrap"><table><thead><tr>${(b.head || []).map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${b.caption ? `<p class="caption">${b.caption}</p>` : ''}`;
        case 'code': {
          const id = reg(b.code, b.title, b.repl);
          if (!firstCode && b.run !== false && !b.repl) firstCode = b;
          const t = b.title || '';
          const tag = /^예제/.test(t) ? '예제' : /^응용|도전/.test(t) ? '응용' : /더 해 보기/.test(t) ? '추가' : '';
          return codeBlockHtml(b, id, { tag });
        }
        case 'callout': {
          const icon = { tip: '💡', warn: '⚠️', info: 'ℹ️', more: '📘', board: '🔌' }[b.kind] || 'ℹ️';
          const title = b.title || { tip: '팁', warn: '주의', info: '참고', more: '더 알아보기', board: '실제 보드에서는' }[b.kind];
          return `<div class="callout ${esc(b.kind)}"><div class="ct">${icon} ${b.kind === 'more' && b.title ? '더 알아보기 · ' + b.title : title}</div><div>${window.JU.scoped(b.html)}</div></div>`;
        }
        case 'figure':
          return `<div class="figure">${window.JU.scoped(b.html)}${b.caption ? `<p class="caption">${b.caption}</p>` : ''}</div>`;
        default:
          return b.html ? `<div>${b.html}</div>` : '';
      }
    }).join('\n');

    const practice = (sec.practice || []).map((p, i) => {
      const sid = reg(p.starter || '', p.title + ' (시작 코드)');
      const solId = p.solution ? reg(p.solution, p.title + ' (정답)') : null;
      const lv = '★'.repeat(p.level || 1) + '☆'.repeat(3 - (p.level || 1));
      return `<div class="practice"><div class="practice-head"><b>🛠️ ${esc(p.title)}</b><span class="level" title="난이도">${lv}</span></div>
        <div class="practice-body">${p.desc || ''}
          ${p.hint ? `<details><summary>💡 힌트</summary><div>${p.hint}</div></details>` : ''}
          <div class="actions"><button class="btn small primary" data-code-act="edit" data-code="${sid}">✎ 시작 코드를 편집기로</button>
            ${teacher && solId ? `<button class="btn small blue" data-code-act="run" data-code="${solId}">▶ 정답 실행</button><button class="btn small ghost" data-toggle-sol="${i}">🔑 정답 코드 보기</button>` : ''}</div>
          ${teacher && solId ? `<div class="solution hidden" data-sol="${i}">${codeBlockHtml({ code: p.solution, title: '정답 코드' }, solId, { tag: '교사용' })}</div>` : ''}
        </div></div>`;
    }).join('');

    const quiz = (sec.quiz || []).map((q, i) => `<div class="quiz" data-quiz="${i}"><div class="q"><span class="qn">Q${i + 1}.</span>${q.q}</div>
      <div class="opts">${(q.options || []).map((o, j) => `<button class="opt" data-q="${i}" data-o="${j}"><span class="n">${j + 1}</span><span>${o}</span></button>`).join('')}</div>
      <div class="explain hidden">${teacher ? `<b>정답 ${q.answer + 1}번.</b> ` : ''}${q.explain || ''}</div></div>`).join('');

    const flow = (sec.flow || []).length ? `<div class="flow teacher-only">${sec.flow.map((f) => `<div style="flex:${f[1]}"><b>${esc(f[0])}</b> ${f[1]}분</div>`).join('')}</div>` : '';
    const done = app.done.has(sec.id);

    $('content').innerHTML = `<div class="doc">
      <span class="chapter-badge">${esc(ch.icon || '')} Chapter ${esc(ch.no)} · ${esc(ch.title)} · ${idx + 1}/${ch.sections.length}교시</span>
      <h1>${esc(sec.title)}</h1>
      <div class="meta-row"><span class="chip">⏱ ${sec.minutes || 50}분</span><span class="chip">💻 예제 ${(sec.content || []).filter((b) => b.type === 'code').length}</span>
        <span class="chip">🛠️ 실습 ${(sec.practice || []).length}</span><span class="chip">❓ 퀴즈 ${(sec.quiz || []).length}</span>
        <button class="btn small ghost" data-slides="${sec.id}">🖼️ 슬라이드로 보기</button>
        ${teacher ? '<button class="btn small ghost" id="showAllAnswers">🔑 퀴즈 정답 모두 보기</button>' : ''}</div>
      ${(sec.goals || []).length ? `<div class="goals"><b>🎯 학습 목표</b><ul>${sec.goals.map((g) => `<li>${g}</li>`).join('')}</ul></div>` : ''}
      ${flow}
      ${blocks}
      ${practice ? `<h2>🛠️ 실습 과제</h2>${practice}` : ''}
      ${quiz ? `<h2>❓ 확인 퀴즈</h2>${quiz}` : ''}
      <div class="section-end">
        <button class="btn done-btn${done ? ' done' : ''}" id="doneBtn">${done ? '✔ 학습 완료' : '☐ 학습 완료로 표시'}</button>
        <span class="spacer"></span>
        ${prev ? `<a class="btn ghost" href="#${prev.sec.id}">◀ ${esc(prev.sec.title)}</a>` : ''}
        ${next ? `<a class="btn primary" href="#${next.sec.id}">${esc(next.sec.title)} ▶</a>` : ''}
      </div>
    </div>`;
    $('content').scrollTop = 0;
    restoreEditor(sec.id, firstCode ? firstCode.code : '', firstCode ? firstCode.title : '');
  }

  /* ============================================================== 레이아웃 */
  function setupLayout() {
    const root = document.documentElement;
    const nav = store.get('mb.navW', ''), out = store.get('mb.outW', ''), ed = store.get('mb.edH', ''), con = store.get('mb.conH', '');
    if (nav) root.style.setProperty('--nav-w', nav);
    if (out) root.style.setProperty('--out-w', out);
    if (ed) root.style.setProperty('--editor-h', ed);
    if (con) root.style.setProperty('--console-h', con);
    if (store.get('mb.navCollapsed', '0') === '1') $('app').classList.add('nav-collapsed');

    document.querySelectorAll('[data-resize]').forEach((g) => {
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        g.setPointerCapture(e.pointerId);
        g.classList.add('drag');
        const kind = g.dataset.resize;
        const move = (ev) => {
          if (kind === 'nav') {
            const w = Math.max(200, Math.min(480, ev.clientX)) + 'px';
            root.style.setProperty('--nav-w', w); store.set('mb.navW', w);
          } else if (kind === 'out') {
            const w = Math.max(300, Math.min(window.innerWidth * 0.62, window.innerWidth - ev.clientX)) + 'px';
            root.style.setProperty('--out-w', w); store.set('mb.outW', w);
          } else if (kind === 'editor') {
            const rect = $('docView').getBoundingClientRect();
            const h = Math.max(60, Math.min(rect.height - 80, rect.bottom - ev.clientY));
            const v = (h / rect.height * 100).toFixed(1) + '%';
            root.style.setProperty('--editor-h', v); store.set('mb.edH', v);
            app.editor.refresh();
          } else if (kind === 'console') {
            const rect = $('output').getBoundingClientRect();
            const h = Math.max(90, Math.min(rect.height - 150, rect.bottom - ev.clientY));
            const v = h.toFixed(0) + 'px';
            root.style.setProperty('--console-h', v); store.set('mb.conH', v);
          }
        };
        const up = () => { g.classList.remove('drag'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); app.editor.refresh(); };
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', up);
      });
    });
  }

  /* ============================================================== 실행 환경 배지 · 모달 */
  function updateEnvText() {
    const el = $('homeEnv');
    if (!el) return;
    el.textContent = MbEngine.state === 'ready' ? `Python ${MbEngine.python} 준비 완료`
      : MbEngine.state === 'loading' ? '준비 중…' : MbEngine.state === 'error' ? '준비 실패' : '처음 실행할 때 준비합니다';
  }

  function setupServerBadge() {
    MbEngine.onChange(() => {
      const b = $('serverBtn');
      const st = MbEngine.state;
      b.classList.toggle('ok', st === 'ready');
      b.classList.toggle('bad', st === 'error');
      $('serverText').textContent = st === 'ready' ? `🐍 Python ${MbEngine.python} 준비 완료`
        : st === 'loading' ? `🐍 ${MbEngine.message || '파이썬 준비 중…'}`
          : st === 'error' ? '🐍 실행 환경 오류 (눌러서 확인)' : '🐍 파이썬 (실행하면 준비)';
      updateEnvText();
    });
    setTimeout(() => {
      if (MbEngine.supported() && MbEngine.state === 'idle' && store.get('mb.preload', '1') === '1') MbEngine.load().catch(() => { });
    }, 1200);
  }

  function openModal(title, html) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modal').classList.remove('hidden');
  }
  function closeModal() { $('modal').classList.add('hidden'); }

  /* ============================================================== 크게 보기 (라이트박스)
   * 전체 화면 대상 요소(#deckWrap) 안쪽에 두어 발표 중에도 보이게 합니다.
   * 보드를 복사하지 않고 그대로 옮겨 오므로 크게 보는 동안에도 계속 움직입니다. */
  function openLightbox() {
    const lb = $('lightbox');
    const inSlides = !$('slideView').classList.contains('hidden');
    (inSlides ? $('deckWrap') : document.body).appendChild(lb);
    $('lbTitle').textContent = '📟 micro:bit 보드 크게 보기';
    $('lbBody').appendChild($('simBoard'));
    lb.classList.remove('hidden');
  }

  function closeLightbox() {
    if (!app.lightboxOpen()) return;
    $('lightbox').classList.add('hidden');
    $('output').insertBefore($('simBoard'), $('simTabs'));   // 오른쪽 패널의 원래 자리로
  }
  app.lightboxOpen = () => !$('lightbox').classList.contains('hidden');
  app.closeLightbox = closeLightbox;

  function serverModal() {
    const st = {
      idle: '아직 준비 안 함', loading: MbEngine.message || '준비 중…',
      ready: `준비 완료 (Python ${MbEngine.python} · Pyodide ${MbEngine.pyodide}${MbEngine.loadMs ? ` · ${(MbEngine.loadMs / 1000).toFixed(1)}초` : ''})`,
      error: '오류: ' + MbEngine.message
    }[MbEngine.state];
    const preload = store.get('mb.preload', '1') === '1';
    openModal('파이썬 실행 환경', `
      <div class="table-wrap"><table><tbody>
        <tr><th>실행 방식</th><td>브라우저 안에서 실행 (<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> · WebAssembly) — 서버 · 설치가 필요 없습니다.</td></tr>
        <tr><th>상태</th><td><b style="color:${MbEngine.state === 'ready' ? 'var(--ok)' : MbEngine.state === 'error' ? 'var(--danger)' : 'inherit'}">${esc(st)}</b></td></tr>
        <tr><th>지원 모듈</th><td><code>microbit</code>(display · buttons · pins · accelerometer · compass · microphone · speaker · i2c · spi · uart),
          <code>music</code>, <code>radio</code>, <code>speech</code>, <code>audio</code>, <code>neopixel</code>, <code>log</code>, <code>machine</code>, <code>power</code>,
          그리고 <code>random</code> · <code>math</code> · <code>time</code> 등 표준 모듈</td></tr>
        <tr><th>다른 점</th><td>실제 보드보다 메모리가 훨씬 넉넉하고 계산이 빠릅니다. 보드에서는 <code>MemoryError</code> 가 날 수 있으니 긴 프로그램은 실제 보드에서도 확인하세요.</td></tr>
        <tr><th>파일</th><td>보드의 파일 시스템은 시뮬레이터 오른쪽 <b>💾 파일</b> 탭에서 볼 수 있습니다. 새로고침하면 사라집니다.</td></tr>
      </tbody></table></div>
      <div class="meta-row">
        <button class="btn primary" id="envLoad" ${MbEngine.state === 'ready' || MbEngine.state === 'loading' ? 'disabled' : ''}>지금 준비하기</button>
        <label class="chip" style="cursor:pointer"><input type="checkbox" id="envPreload" ${preload ? 'checked' : ''} style="margin-right:6px">페이지를 열 때 미리 준비</label>
      </div>`);
    $('envLoad').onclick = () => { MbEngine.load().then(serverModal, serverModal); $('envLoad').disabled = true; $('envLoad').textContent = '준비 중…'; };
    $('envPreload').onchange = (e) => store.set('mb.preload', e.target.checked ? '1' : '0');
  }

  function helpModal() {
    openModal('파이썬 셸(&gt;&gt;&gt;) 도움말', `
      <p>콘솔 아래 <code>&gt;&gt;&gt;</code> 칸에 한 줄씩 입력하면 바로 실행됩니다. 실제 micro:bit 의 REPL 과 같은 방식입니다.</p>
      <div class="table-wrap"><table><thead><tr><th>입력해 보기</th><th>하는 일</th></tr></thead><tbody>
        <tr><td><code>display.show(Image.HEART)</code></td><td>하트 그림 표시</td></tr>
        <tr><td><code>display.scroll("Hi")</code></td><td>글자 흘려보내기</td></tr>
        <tr><td><code>button_a.is_pressed()</code></td><td>버튼 A 가 눌렸는지 (보드 그림의 A 를 누른 채로)</td></tr>
        <tr><td><code>temperature()</code></td><td>온도 읽기</td></tr>
        <tr><td><code>accelerometer.get_x()</code></td><td>가속도 x 값</td></tr>
        <tr><td><code>import music; music.play(music.NYAN)</code></td><td>음악 재생</td></tr>
        <tr><td><code>2 ** 10</code></td><td>계산기처럼 쓰기</td></tr>
        <tr><td><code>dir(display)</code></td><td>쓸 수 있는 기능 목록 보기</td></tr>
      </tbody></table></div>
      <ul>
        <li><code>if</code> · <code>for</code> 처럼 <b>콜론(:)</b> 으로 끝나면 <code>...</code> 로 바뀝니다. 블록을 다 쓰고 <b>빈 줄</b>에서 Enter 를 누르면 실행됩니다. (<kbd>Esc</kbd> 로 취소)</li>
        <li><kbd>↑</kbd> <kbd>↓</kbd> 로 이전에 입력한 줄을 다시 불러옵니다.</li>
        <li>셸의 변수는 ▶ 실행(main.py)과 따로 관리됩니다.</li>
      </ul>`);
  }

  /* ============================================================== 이벤트 */
  function bindUi() {
    $('themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    document.querySelectorAll('.role-switch button').forEach((b) => b.onclick = () => goRole(b.dataset.role));
    document.querySelectorAll('.view-switch button').forEach((b) => b.onclick = () => setView(b.dataset.view));
    $('navSearch').addEventListener('input', () => buildNav());
    $('navTree').addEventListener('click', (e) => {
      const head = e.target.closest('.nav-ch-head');
      if (!head) return;
      const box = head.parentElement;
      if (!box.dataset.ch) return;
      box.classList.toggle('open');
      store.set('mb.open.' + box.dataset.ch, box.classList.contains('open') ? '1' : '0');
    });
    $('navCloseBtn').onclick = () => { $('app').classList.add('nav-collapsed'); store.set('mb.navCollapsed', '1'); setTimeout(() => { app.editor.refresh(); app.deck.fit(); }, 50); };
    $('navOpenBtn').onclick = () => { $('app').classList.remove('nav-collapsed'); store.set('mb.navCollapsed', '0'); setTimeout(() => { app.editor.refresh(); app.deck.fit(); }, 50); };
    $('prevBtn').onclick = () => app.stepSection(-1, 0);
    $('nextBtn').onclick = () => app.stepSection(1, 0);

    $('runBtn').onclick = () => runEditor();
    $('runSimBtn').onclick = () => runEditor();
    $('stopSimBtn').onclick = () => app.console.stop();
    $('resetSimBtn').onclick = () => { app.sim.reset(); MbEngine.resetRepl(); app.toast('보드를 리셋했습니다'); };
    $('connectBtn').onclick = connectBoard;
    $('targetChip').onclick = () => {
      if (!app.serial.connected) { connectBoard(); return; }
      setTarget(app.target === 'board' ? 'sim' : 'board');
      app.toast(app.target === 'board' ? '실제 보드에서 실행합니다' : '시뮬레이터에서 실행합니다');
    };
    $('resetBtn').onclick = () => { app.editor.setValue(app.editorState.original || ''); app.toast('불러온 원래 코드로 되돌렸습니다'); };
    $('copyBtn').onclick = () => copyText(app.editor.getValue());
    $('saveBtn').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([app.editor.getValue()], { type: 'text/x-python' }));
      a.download = 'main.py';
      a.click();
      app.toast('main.py 로 저장했습니다');
    };
    $('fontUpBtn').onclick = () => setEditorFont(app.edFont + 1);
    $('fontDownBtn').onclick = () => setEditorFont(app.edFont - 1);
    $('foldBtn').onclick = () => {
      const f = $('editorPane').classList.toggle('folded');
      $('foldBtn').textContent = f ? '▴ 펼치기' : '▾ 접기';
      if (!f) app.editor.refresh();
    };
    $('serverBtn').onclick = serverModal;
    $('helpBtn').onclick = helpModal;
    $('zoomSimBtn').onclick = () => (app.lightboxOpen() ? closeLightbox() : openLightbox());
    $('lbClose').onclick = closeLightbox;
    $('modalClose').onclick = closeModal;
    $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('modal').classList.contains('hidden')) { closeModal(); return; }
      if (app.lightboxOpen()) closeLightbox();     // 크게 보기만 닫고 발표 화면은 그대로 둡니다
    });
    updateTargetChip();
    app.onRunState('idle');

    $('content').addEventListener('click', (e) => {
      const act = e.target.closest('[data-code-act]');
      if (act) {
        const b = app.blockCodes[act.dataset.code];
        if (!b) return;
        const a = act.dataset.codeAct;
        if (a === 'copy') return copyText(b.code);
        if (b.repl && a === 'run') { app.runCode(b.code, { label: b.title, repl: true, stdin: b.code }); return; }
        if (a === 'edit' || a === 'run') {
          loadEditor(b.code, b.title, app.route.sec ? app.route.sec.id : null);
          if (a === 'run') runEditor();
          if (a === 'edit') app.toast('편집기로 불러왔습니다');
        }
        return;
      }
      const opt = e.target.closest('.quiz .opt');
      if (opt) {
        const q = app.route.sec.quiz[+opt.dataset.q];
        const box = opt.closest('.quiz');
        const j = +opt.dataset.o;
        opt.classList.add(j === q.answer ? 'right' : 'wrong');
        if (j === q.answer) box.querySelector('.explain').classList.remove('hidden');
        return;
      }
      const sol = e.target.closest('[data-toggle-sol]');
      if (sol) {
        const el = $('content').querySelector(`[data-sol="${sol.dataset.toggleSol}"]`);
        const hidden = el.classList.toggle('hidden');
        sol.textContent = hidden ? '🔑 정답 코드 보기' : '🔑 정답 코드 숨기기';
        return;
      }
      const sl = e.target.closest('[data-slides]');
      if (sl) { app.view = 'slides'; go(sl.dataset.slides); if (location.hash === '#' + sl.dataset.slides) render(); return; }
      const rg = e.target.closest('[data-role-go]');
      if (rg) { goRole(rg.dataset.roleGo); return; }
      if (e.target.id === 'doneBtn') { toggleDone(app.route.sec.id); render(); }
      if (e.target.id === 'showAllAnswers') {
        app.route.sec.quiz.forEach((q, i) => {
          const box = $('content').querySelector(`[data-quiz="${i}"]`);
          box.querySelector(`[data-o="${q.answer}"]`).classList.add('right');
          box.querySelector('.explain').classList.remove('hidden');
        });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (app.view === 'slides' && app.route.type === 'section') return;
      const t = e.target;
      if (t.closest && (t.closest('.CodeMirror') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); app.stepSection(1, 0); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); app.stepSection(-1, 0); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
