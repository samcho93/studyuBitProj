
  /* ── 화면: 가운데 칸을 덮는 블록 편집기 (오른쪽 시뮬레이터는 그대로 보임) ── */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = () => rej(new Error('블록 편집기(Blockly)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));
      document.head.appendChild(s);
    });
  }
  let loading = null;
  function loadBlockly() {
    if (!loading) {
      loading = (async () => {
        if (!window.Blockly) { await loadScript(BL + 'blockly_compressed.js'); await loadScript(BL + 'blocks_compressed.js'); await loadScript(BL + 'msg/ko.js'); }
        defineBlocks();
      })();
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 저장 공간 부족 등은 무시 */ } }
  };
  const EMPTY = { blocks: { languageVersion: 0, blocks: [{ type: 'mb_on_start', x: 20, y: 20 }, { type: 'mb_forever', x: 20, y: 160 }] } };
  let panel = null, ws = null, view = 'blocks', saveTimer = null, codeTimer = null;
  let cur = { key: null, title: '', original: null };

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'bk-panel hidden';
    panel.innerHTML = `
      <div class="bk-bar">
        <b>🧩 블록 코딩</b><span class="bk-src muted"></span>
        <span class="spacer"></span>
        <button class="btn primary small bk-run" title="블록을 MicroPython 으로 바꿔 오른쪽 시뮬레이터(🔌 보드를 골랐으면 실제 보드)에서 실행">▶ 실행</button>
        <button class="btn ghost small bk-stop" title="실행 멈춤">■ 중지</button>
        <span class="bk-seg" role="group" aria-label="코드 보기">
          <button data-view="blocks" class="on" title="블록만 보기">블록</button><button data-view="py" title="블록에서 만든 MicroPython 함께 보기">MicroPython</button><button data-view="ts" title="MakeCode 의 JavaScript 함께 보기">JavaScript</button>
        </span>
        <button class="btn ghost small bk-save" title="MakeCode 프로젝트 파일(.mkcd)로 저장 — makecode.microbit.org 의 [가져오기 → 파일 가져오기]로 열면 같은 블록이 보입니다">💾 MakeCode 파일</button>
        <button class="btn ghost small bk-copy" title="MakeCode JavaScript 복사 — MakeCode 의 JavaScript 탭에 붙여 넣고 [블록]을 누르면 블록으로 바뀝니다">⧉ JS 복사</button>
        <a class="btn ghost small" href="https://makecode.microbit.org/" target="_blank" rel="noopener" title="MakeCode 를 새 탭에서 열기">MakeCode ↗</a>
        <label class="btn ghost small" title="이 화면에서 저장한 .mkcd 파일이나 파이썬(.py) 파일 열기">📂 열기<input type="file" accept=".mkcd,.py,.json" hidden class="bk-file"></label>
        <button class="btn ghost small bk-new" title="빈 블록 프로젝트로 시작">＋ 새로</button>
        <button class="btn ghost small bk-reset" title="원래 파이썬 예제에서 다시 블록으로 바꾸기">↺ 원래대로</button>
        <button class="btn ghost small bk-topy" title="블록에서 만든 MicroPython 을 아래 편집기(main.py)로 보내기">🐍 편집기로</button>
        <button class="btn ghost small bk-close" title="닫고 문서로 돌아가기 (Esc)">✕ 닫기</button>
      </div>
      <div class="bk-report"></div>
      <div class="bk-main"><div class="bk-ws"></div><pre class="bk-code hidden"></pre></div>`;
    document.getElementById('center').appendChild(panel);
    const $ = (s) => panel.querySelector(s);
    $('.bk-run').onclick = run;
    $('.bk-stop').onclick = () => { if (app.console && app.console.stop) app.console.stop(); };
    panel.querySelectorAll('.bk-seg button').forEach((b) => { b.onclick = () => setView(b.dataset.view); });
    $('.bk-save').onclick = saveMkcd;
    $('.bk-copy').onclick = copyTs;
    $('.bk-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };
    $('.bk-new').onclick = () => { cur = { key: null, title: '새 프로젝트', original: null }; showSrc(); loadState(EMPTY); report(''); };
    $('.bk-reset').onclick = () => { if (!cur.original) return; if (cur.key) store.set('mb.blk.' + cur.key, null); convertInto(cur.original); };
    $('.bk-topy').onclick = toEditor;
    $('.bk-close').onclick = close;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel && !panel.classList.contains('hidden') && !document.querySelector('.blocklyWidgetDiv[style*="display: block"], .blocklyDropDownDiv[style*="display: block"]')) close(); });
    return panel;
  }
  function show() {
    ensurePanel().classList.remove('hidden');
    const bar = document.querySelector('#center .topbar');
    panel.style.setProperty('--bk-top', (bar ? bar.offsetHeight : 0) + 'px');
    if (ws) setTimeout(() => Blockly.svgResize(ws), 0);
  }
  function close() { if (panel) panel.classList.add('hidden'); }
  function report(html) { if (panel) panel.querySelector('.bk-report').innerHTML = html; }
  function showSrc() { panel.querySelector('.bk-src').textContent = cur.title ? '· ' + cur.title : ''; panel.querySelector('.bk-reset').style.display = cur.original ? '' : 'none'; }

  async function ensureWs() {
    await loadBlockly();
    if (ws) return ws;
    ws = Blockly.inject(panel.querySelector('.bk-ws'), {
      toolbox: toolbox(), renderer: 'zelos', theme: theme(), trashcan: true, sounds: false, media: BL + 'media/',
      zoom: { controls: true, wheel: true, startScale: 0.75, maxScale: 2, minScale: 0.3 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 24, length: 2, colour: '#dce3ea', snap: false }
    });
    ws.registerToolboxCategoryCallback('MB_FUNCTIONS', functionsFlyout);
    ws.addChangeListener(Blockly.Events.disableOrphans);
    ws.addChangeListener(onChange);
    new ResizeObserver(() => Blockly.svgResize(ws)).observe(panel.querySelector('.bk-ws'));
    return ws;
  }
  // 함수 이름 · 매개변수를 바꾸면 호출 블록도 따라 바꾼다
  function syncCalls(e) {
    const isCall = (c) => c.type === 'mb_fn_call' || c.type === 'mb_fn_call_expr';
    if (e.type === Blockly.Events.BLOCK_CHANGE && e.element === 'field') {
      const b = ws.getBlockById(e.blockId);
      if (b && b.type === 'mb_fn_def' && e.name === 'NAME') ws.getAllBlocks(false).forEach((c) => { if (isCall(c) && c.getFieldValue('NAME') === e.oldValue) c.setFieldValue(e.newValue, 'NAME'); });
      if (b && b.type === 'mb_fn_def' && e.name === 'PARAMS') fnParams(b).forEach((p) => { if (!ws.getVariable(p)) ws.createVariable(p); });
    }
    const defs = {};
    ws.getBlocksByType('mb_fn_def', false).forEach((d) => { defs[d.getFieldValue('NAME')] = fnParams(d); });
    ws.getAllBlocks(false).forEach((c) => { if (isCall(c) && defs[c.getFieldValue('NAME')]) c.setParams(defs[c.getFieldValue('NAME')]); });
  }
  function onChange(e) {
    if (e.isUiEvent || !ws || ws.isDragging()) return;
    syncCalls(e);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 600);
    clearTimeout(codeTimer);
    codeTimer = setTimeout(refreshCode, 250);
  }
  function persist() {
    if (!ws) return;
    const state = Blockly.serialization.workspaces.save(ws);
    if (cur.key) store.set('mb.blk.' + cur.key, JSON.stringify(state));
    store.set('mb.blk.last', JSON.stringify({ key: cur.key, title: cur.title, original: cur.original, state }));
  }
  function loadState(state) {
    Blockly.Events.disable();
    try { ws.clear(); Blockly.serialization.workspaces.load(state, ws); } finally { Blockly.Events.enable(); }
    ws.cleanUp();
    ws.scrollCenter();
    const first = ws.getTopBlocks(true)[0];
    if (first) { const xy = first.getRelativeToSurfaceXY(); ws.scroll(-xy.x * ws.scale + 40, -xy.y * ws.scale + 20); }
    refreshCode();
    persist();
  }
  function setView(v) {
    view = v;
    panel.querySelectorAll('.bk-seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    panel.querySelector('.bk-code').classList.toggle('hidden', v === 'blocks');
    refreshCode();
    setTimeout(() => ws && Blockly.svgResize(ws), 0);
  }
  function refreshCode() {
    if (!ws || view === 'blocks') return;
    const pre = panel.querySelector('.bk-code');
    try { pre.textContent = view === 'py' ? genPy(ws).code : genTs(ws).code; } catch (e) { pre.textContent = '코드를 만들지 못했습니다: ' + (e.message || e); }
  }

  async function openFromCode(code, title, key) {
    show();
    cur = { key: key || null, title: title || '', original: code };
    showSrc();
    report('블록 편집기를 준비하는 중…');
    try { await ensureWs(); } catch (e) { report(`<b class="bk-warn">${esc(e.message || e)}</b>`); return; }
    const saved = key && store.get('mb.blk.' + key);
    if (saved) {
      try { loadState(JSON.parse(saved)); report('지난번에 고친 블록을 불러왔습니다. 예제 그대로 다시 바꾸려면 <b>↺ 원래대로</b>를 누르세요.'); return; } catch (e) { /* 아래에서 다시 바꿈 */ }
    }
    await convertInto(code);
  }
  async function convertInto(code) {
    report(window.MbEngine && MbEngine.state === 'ready' ? '파이썬 코드를 블록으로 바꾸는 중…' : '파이썬 실행 환경을 준비하고 블록으로 바꾸는 중… (처음 한 번은 조금 걸립니다)');
    let r;
    try { r = await convertPython(code); } catch (e) { report(`<b class="bk-warn">블록으로 바꾸지 못했습니다: ${esc(e.message || e)}</b>`); return; }
    if (r.error) { report(`<b class="bk-warn">파이썬 문법 오류가 있어 블록으로 바꾸지 못했습니다 — ${esc(r.error)}</b>`); return; }
    loadState(r.state);
    const head = r.raw
      ? `블록 ${r.count}개로 바꿨습니다. <b class="bk-warn">블록으로 바꿀 수 없는 ${r.raw}곳</b>은 회색 '파이썬' 블록으로 남겼습니다 (여기서 실행은 되지만, MakeCode 로 보내면 주석이 됩니다).`
      : `블록 ${r.count}개로 모두 바꿨습니다. <b>▶ 실행</b>으로 시뮬레이터에서 돌려 보고, <b>💾 MakeCode 파일</b>로 저장하면 makecode.microbit.org 에서 그대로 열 수 있습니다.`;
    report(head + (r.notes.length ? '<ul>' + r.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : ''));
  }
  async function openLast() {
    show();
    report('블록 편집기를 준비하는 중…');
    try { await ensureWs(); } catch (e) { report(`<b class="bk-warn">${esc(e.message || e)}</b>`); return; }
    let last = null;
    try { last = JSON.parse(store.get('mb.blk.last') || 'null'); } catch (e) { last = null; }
    cur = last ? { key: last.key, title: last.title, original: last.original } : { key: null, title: '새 프로젝트', original: null };
    showSrc();
    try { loadState(last ? last.state : EMPTY); } catch (e) { loadState(EMPTY); }
    report('왼쪽 분류에서 블록을 끌어다 놓아 프로그램을 만듭니다. 본문 예제의 <b>🧩 블록</b> 버튼을 누르면 그 예제가 블록으로 열립니다.');
  }

  function run() {
    if (!ws) return;
    let r;
    try { r = genPy(ws); } catch (e) { toast('블록을 코드로 바꾸지 못했습니다: ' + (e.message || e)); return; }
    app.runCode(r.code, { label: '🧩 ' + (cur.title || '블록') });
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const projName = () => (String(cur.title || '블록 프로젝트').replace(/^(예제|응용|도전)\s*/, '').replace(/[\\/:*?"<>|.]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '블록 프로젝트');
  function saveMkcd() {
    if (!ws) return;
    const name = projName();
    const ts = genTs(ws);
    download('microbit-' + name.replace(/\s/g, '-') + '.mkcd', mkcd(ws, name), 'application/octet-stream');
    toast(ts.raw ? `저장했습니다. 회색 '파이썬' 블록 ${ts.raw}곳은 MakeCode 에서 주석으로 보입니다.` : '저장했습니다. makecode.microbit.org → 가져오기 → 파일 가져오기로 여세요.');
  }
  function copyTs() {
    if (!ws) return;
    const t = genTs(ws).code;
    const done = () => toast('MakeCode JavaScript 를 복사했습니다. MakeCode 의 JavaScript 탭에 붙여 넣고 [블록]을 누르세요.');
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => toast('복사하지 못했습니다'));
  }
  function toEditor() {
    if (!ws) return;
    app.editor.setValue(genPy(ws).code);
    close();
    toast('블록에서 만든 MicroPython 을 아래 편집기로 보냈습니다');
  }
  function openFile(f) {
    const r = new FileReader();
    r.onload = async () => {
      const text = String(r.result);
      if (/\.py$/i.test(f.name)) { cur = { key: null, title: f.name, original: text }; showSrc(); await ensureWs(); convertInto(text); return; }
      let data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (data && data.meta && data.meta.mbBlocks) {
        cur = { key: null, title: data.meta.name || f.name, original: null }; showSrc();
        await ensureWs(); loadState(data.meta.mbBlocks); report(esc(f.name) + ' 을(를) 열었습니다.');
      } else toast('이 화면에서 저장한 .mkcd 파일만 열 수 있습니다 (MakeCode 에서 만든 파일은 MakeCode 에서 여세요).');
    };
    r.readAsText(f);
  }

  window.MbBlocks = { openFromCode, openLast, convertPython, genPy: () => ws && genPy(ws), genTs: () => ws && genTs(ws), workspace: () => ws };

  // 위쪽 막대 [🧩 블록 코딩] · 편집기 막대 [🧩 블록으로] · 본문 예제 [🧩 블록]
  function addMenu() {
    const bar = document.querySelector('#center .topbar');
    if (bar && !bar.querySelector('.bk-menu')) {
      const b = document.createElement('button');
      b.className = 'btn ghost small bk-menu';
      b.title = 'MakeCode 와 같은 블록으로 코딩하기 (시뮬레이터 실행 · MakeCode 파일 저장)';
      b.textContent = '🧩 블록 코딩';
      b.onclick = openLast;
      bar.insertBefore(b, bar.querySelector('.view-switch'));
    }
    const eb = document.querySelector('#editorPane .editor-bar');
    if (eb && !eb.querySelector('.bk-ed')) {
      const b = document.createElement('button');
      b.className = 'btn ghost small bk-ed';
      b.title = '편집기의 파이썬 코드를 MakeCode 블록으로 바꾸기';
      b.textContent = '🧩 블록으로';
      b.onclick = () => openFromCode(app.editor.getValue(), (app.editorState && app.editorState.label) || 'main.py', null);
      eb.insertBefore(b, document.getElementById('copyBtn'));
    }
  }
  function addCodeButtons() {
    if (!window.app || !app.blockCodes) return;
    document.querySelectorAll('#content .code-block:not(.repl)').forEach((el) => {
      const head = el.querySelector('.code-head');
      const id = el.id.replace(/^cb-/, '');
      if (!head || head.querySelector('.bk-open') || !head.querySelector('[data-code-act="run"]') || !app.blockCodes[id]) return;
      const b = document.createElement('button');
      b.className = 'btn small ghost bk-open';
      b.textContent = '🧩 블록';
      b.title = '이 예제를 MakeCode 블록으로 보기 · 실행 · MakeCode 파일로 저장';
      b.onclick = () => { const c = app.blockCodes[id]; if (c) openFromCode(c.code, c.title, (app.route && app.route.sec ? app.route.sec.id : 'x') + ':' + c.title); };
      head.insertBefore(b, head.querySelector('[data-code-act="copy"]'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMenu); else addMenu();
  document.addEventListener('lb:render', () => { addMenu(); setTimeout(addCodeButtons, 0); });
  setTimeout(addCodeButtons, 0);
})();
