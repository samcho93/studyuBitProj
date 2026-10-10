/* 강좌별 추가 기능 — lectureBuilder 가 엔진을 갱신해도 이 파일은 덮어쓰지 않습니다.
 * 쓸 수 있는 전역:
 *   MB_COURSE  강좌 데이터 (order · chapters)
 *   window.app 현재 상태 (= window.MbApp) — role('student'|'teacher') · view('doc'|'slides') · route · target('sim'|'board')
 *              app.sim(micro:bit 시뮬레이터) · app.console(콘솔 · 셸) · app.runCode(code, {label}) · app.toast(msg)
 *   MbEngine   파이썬 실행 환경(Pyodide) 상태 · MB_FIG 본문 그림용 보드 그리기 도우미
 * 화면이 바뀔 때마다:
 *   document.addEventListener('lb:render', function (e) {
 *     // e.detail = app.route = { type: 'home' | 'chapter' | 'section', ch, sec }
 *   });
 */

/* ── 러닝 데이터 보기 (ch05) ────────────────────────────────────────────
 * 실제 micro:bit 의 MY_DATA.HTM · 📊 로그 탭 CSV · 시뮬레이터 기록을 불러와
 * 표 · 선 그래프 · 영역 그래프 · 막대 그래프 · 산점도 · 히스토그램 · 통계로 보여 줍니다.
 * 열기: 위쪽 막대의 [📈 데이터 보기] 메뉴, 또는 본문의 <div class="rv-launch"></div> 자리 버튼.
 */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NUM_RE = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  const isNum = (s) => NUM_RE.test(s);
  const COLORS = ['var(--accent)', 'var(--danger)', 'var(--ok)', 'var(--warn)', 'var(--more)', 'var(--accent2)'];

  // 예시 기록 (ch05 그림 5-8 과 같은 값: 10초마다 한 줄)
  const SAMPLE = (() => {
    const cad = [108, 112, 114, 110, 113, 111, 150, 160, 164, 162, 166, 236, 163, 161, 165, 158, 162, 160, 130, 114, 112, 110, 113, 0];
    const steps = [18, 37, 56, 74, 93, 112, 137, 164, 191, 218, 246, 273, 300, 327, 355, 381, 408, 435, 457, 476, 495, 513, 532, 532];
    const dist = [11.7, 24.1, 36.4, 48.1, 60.5, 72.8, 95.3, 119.6, 143.9, 168.2, 193.4, 217.7, 242, 266.3, 291.5, 314.9, 339.2, 363.5, 377.8, 390.1, 402.5, 414.2, 426.6, 426.6];
    return { name: '예시 러닝 기록 (걷기 → 뛰기 → 걷기)', head: ['time', 'steps', 'cadence', 'distance'], rows: cad.map((c, i) => [(i + 1) * 10, steps[i], c, dist[i]]) };
  })();

  /* ── 읽기: MY_DATA.HTM · CSV 글에서 "이름표 줄 + 숫자 줄들" 묶음을 찾는다 ──
   * MY_DATA.HTM 은 기록 화면용 HTML · 스크립트와 CSV 모양의 기록이 함께 들어 있는 파일입니다.
   * 줄마다 쉼표로 나눠 "글자 이름표 줄" 다음에 "같은 칸 수의 숫자 줄"이 이어지는 곳을 모두 찾습니다.
   * (기록 중에 이름표가 바뀌면 묶음이 여러 개가 됩니다.) */
  function parseLog(text, fileName) {
    text = String(text).replace(/[\u0000\uFFFD\u00FF]/g, '');
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.replace(/<[^>]*>/g, '').trim());
    const cellsOf = (l) => l.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    const isHead = (cells) => cells.every((c) => c.length > 0 && c.length <= 40 && !isNum(c) && !/[<>{}\[\];=`'\\]/.test(c));
    const isData = (cells, n) => cells.length <= n && cells.every((c) => c === '' || isNum(c)) && cells.some((c) => c !== '');
    const sets = [];
    let i = 0;
    while (i < lines.length) {
      const head = cellsOf(lines[i]);
      const next = i + 1 < lines.length ? cellsOf(lines[i + 1]) : null;
      if (lines[i] && isHead(head) && next && next.length === head.length && isData(next, head.length)) {
        const rows = [];
        let j = i + 1;
        for (; j < lines.length; j++) {
          if (!lines[j]) continue;
          const c = cellsOf(lines[j]);
          if (!isData(c, head.length)) break;
          rows.push(head.map((_, k) => (c[k] == null || c[k] === '' ? null : Number(c[k]))));
        }
        // 한 칸짜리 묶음은 스크립트 조각을 잘못 잡기 쉬우니 2줄 이상일 때만
        if (head.length > 1 || rows.length > 1) sets.push({ name: '', head, rows });
        i = j;
      } else i++;
    }
    sets.forEach((s, k) => { s.name = (fileName || '파일') + (sets.length > 1 ? ' — 묶음 ' + (k + 1) : '') + ' (' + s.head.join(', ') + ')'; });
    return sets;
  }

  function fromSim() {
    const L = window.app && app.sim && app.sim.s && app.sim.s.log;
    if (!L || !L.rows || !L.rows.length) return null;
    const ts = !!L.timestamp && L.rows.some((r) => r.t != null);
    const head = (ts ? ['Time (' + L.timestamp + ')'] : []).concat(L.labels);
    const num = (v) => (v == null || v === '' || !isNum(String(v)) ? null : Number(v));
    const rows = L.rows.map((r) => (ts ? [num(r.t)] : []).concat(L.labels.map((k) => num(r.obj[k]))));
    return { name: '시뮬레이터 📊 로그', head, rows };
  }

  /* ── 통계 ── */
  const colValues = (ds, k) => ds.rows.map((r) => r[k]).filter((v) => v != null && isFinite(v));
  function stats(vals) {
    if (!vals.length) return null;
    const s = vals.slice().sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mid = s.length >> 1;
    return { n: vals.length, min: s[0], max: s[s.length - 1], avg: sum / vals.length, med: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2 };
  }
  const fmt = (v) => (v == null || !isFinite(v) ? '' : Number.isInteger(v) || Math.abs(v) >= 100 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100));

  /* ── SVG 그래프 도우미 ── */
  const W = 900, H = 360, PAD = { l: 64, r: 20, t: 20, b: 48 };
  function niceTicks(lo, hi, n) {
    if (lo === hi) { lo -= 1; hi += 1; }
    const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const t = [];
    for (let v = a; v <= b + step / 2; v += step) t.push(Math.round(v / step) * step);
    return t;
  }
  const scaler = (lo, hi, a, b) => (v) => a + (v - lo) / (hi - lo) * (b - a);
  const svgWrap = (inner) => `<svg class="rv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${inner}</svg>`;
  const empty = (m) => `<p class="rv-empty">${m || '숫자가 없습니다.'}</p>`;
  // xLabels 가 있으면 막대용 글자 눈금, 없으면 숫자 눈금
  function frame(xt, yt, xs, ys, xl, yl, xLabels) {
    let g = '';
    yt.forEach((v) => { g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${PAD.l - 8}" y="${ys(v) + 5}" text-anchor="end" font-size="13" fill="var(--muted)">${fmt(v)}</text>`; });
    if (xLabels) xLabels.forEach(([x, t]) => { g += `<text x="${x}" y="${H - PAD.b + 18}" text-anchor="middle" font-size="12" fill="var(--muted)">${esc(t)}</text>`; });
    else xt.forEach((v) => { g += `<line x1="${xs(v)}" x2="${xs(v)}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--line)" stroke-dasharray="2 4"/><text x="${xs(v)}" y="${H - PAD.b + 18}" text-anchor="middle" font-size="13" fill="var(--muted)">${fmt(v)}</text>`; });
    g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${H - PAD.b}" y2="${H - PAD.b}" stroke="var(--muted)"/><line x1="${PAD.l}" x2="${PAD.l}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--muted)"/>`;
    const cy = (PAD.t + H - PAD.b) / 2;
    g += `<text x="${(PAD.l + W - PAD.r) / 2}" y="${H - 8}" text-anchor="middle" font-size="14" fill="var(--fg)">${esc(xl)}</text>`;
    g += `<text x="16" y="${cy}" text-anchor="middle" font-size="14" fill="var(--fg)" transform="rotate(-90 16 ${cy})">${esc(yl)}</text>`;
    return g;
  }
  // x 열 값 (−1 = 줄 번호)
  const xOf = (ds, xk, i) => (xk < 0 ? i + 1 : ds.rows[i][xk]);
  const xName = (ds, xk) => (xk < 0 ? '줄 번호' : ds.head[xk]);
  const legend = (ds, ks) => `<div class="rv-legend">${ks.map((k, n) => `<span><i style="background:${COLORS[n % COLORS.length]}"></i>${esc(ds.head[k])}</span>`).join('')}</div>`;

  function lineChart(ds, xk, yks, area) {
    if (!yks.length) return empty('세로축에 그릴 열을 하나 이상 고르세요.');
    const xv = ds.rows.map((r, i) => xOf(ds, xk, i)).filter((v) => v != null);
    const yv = [].concat(...yks.map((k) => colValues(ds, k)));
    if (!xv.length || !yv.length) return empty();
    const xt = niceTicks(Math.min(...xv), Math.max(...xv), 8), yt = niceTicks(Math.min(0, ...yv), Math.max(...yv), 5);
    const xs = scaler(xt[0], xt[xt.length - 1], PAD.l, W - PAD.r), ys = scaler(yt[0], yt[yt.length - 1], H - PAD.b, PAD.t);
    let g = frame(xt, yt, xs, ys, xName(ds, xk), yks.map((k) => ds.head[k]).join(' · '));
    yks.forEach((k, n) => {
      const c = COLORS[n % COLORS.length];
      const p = ds.rows.map((r, i) => [xOf(ds, xk, i), r[k]]).filter(([x, y]) => x != null && y != null);
      if (!p.length) return;
      const pts = p.map(([x, y]) => xs(x).toFixed(1) + ',' + ys(y).toFixed(1)).join(' ');
      if (area) g += `<polygon points="${xs(p[0][0]).toFixed(1)},${ys(yt[0])} ${pts} ${xs(p[p.length - 1][0]).toFixed(1)},${ys(yt[0])}" fill="${c}" opacity=".18"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`;
      if (p.length <= 80) g += p.map(([x, y]) => `<circle cx="${xs(x).toFixed(1)}" cy="${ys(y).toFixed(1)}" r="3.5" fill="${c}"><title>${esc(xName(ds, xk))} ${fmt(x)} → ${esc(ds.head[k])} ${fmt(y)}</title></circle>`).join('');
    });
    return svgWrap(g) + legend(ds, yks);
  }

  function barChart(ds, xk, yk) {
    let d = ds.rows.map((r, i) => ({ x: xOf(ds, xk, i), y: r[yk] })).filter((v) => v.y != null);
    if (!d.length) return empty();
    let note = '';
    const MAXB = 40;
    if (d.length > MAXB) {     // 막대가 너무 많으면 몇 줄씩 묶어 평균
      const n = Math.ceil(d.length / MAXB), g2 = [];
      for (let i = 0; i < d.length; i += n) { const part = d.slice(i, i + n); g2.push({ x: part[0].x, y: part.reduce((a, v) => a + v.y, 0) / part.length }); }
      d = g2; note = `<p class="rv-note">줄이 많아서 ${n}줄씩 묶은 평균으로 그렸습니다.</p>`;
    }
    const yt = niceTicks(Math.min(0, ...d.map((v) => v.y)), Math.max(...d.map((v) => v.y)), 5);
    const ys = scaler(yt[0], yt[yt.length - 1], H - PAD.b, PAD.t);
    const bw = (W - PAD.l - PAD.r) / d.length, every = Math.ceil(d.length / 12);
    const labels = d.map((v, i) => [PAD.l + bw * (i + .5), i % every ? '' : fmt(v.x)]);
    let g = frame([], yt, null, ys, xName(ds, xk), ds.head[yk], labels);
    const y0 = ys(Math.max(0, yt[0]));
    d.forEach((v, i) => {
      const y1 = ys(v.y);
      g += `<rect x="${(PAD.l + bw * i + bw * .12).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw * .76).toFixed(1)}" height="${Math.abs(y0 - y1).toFixed(1)}" rx="2" fill="var(--accent)"><title>${esc(fmt(v.x))} → ${fmt(v.y)}</title></rect>`;
    });
    const avg = stats(d.map((v) => v.y)).avg;
    g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${ys(avg)}" y2="${ys(avg)}" stroke="var(--danger)" stroke-dasharray="6 4"/><text x="${W - PAD.r}" y="${ys(avg) - 6}" text-anchor="end" font-size="13" fill="var(--danger)">평균 ${fmt(avg)}</text>`;
    return svgWrap(g) + note;
  }

  function scatterChart(ds, xk, yk, trend) {
    const p = ds.rows.map((r, i) => [xOf(ds, xk, i), r[yk]]).filter(([x, y]) => x != null && y != null);
    if (!p.length) return empty();
    const xt = niceTicks(Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0])), 8);
    const yt = niceTicks(Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1])), 5);
    const xs = scaler(xt[0], xt[xt.length - 1], PAD.l, W - PAD.r), ys = scaler(yt[0], yt[yt.length - 1], H - PAD.b, PAD.t);
    let g = frame(xt, yt, xs, ys, xName(ds, xk), ds.head[yk]);
    g += p.map(([x, y]) => `<circle cx="${xs(x).toFixed(1)}" cy="${ys(y).toFixed(1)}" r="5" fill="var(--accent)" fill-opacity=".5" stroke="var(--accent)"><title>(${fmt(x)}, ${fmt(y)})</title></circle>`).join('');
    let note = '';
    if (trend && p.length >= 2) {   // 추세선: 점들 사이를 가장 잘 지나는 직선 (최소제곱법 — 준비된 계산)
      const n = p.length, mx = p.reduce((a, q) => a + q[0], 0) / n, my = p.reduce((a, q) => a + q[1], 0) / n;
      const sxx = p.reduce((a, q) => a + (q[0] - mx) ** 2, 0), sxy = p.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0);
      if (sxx > 0) {
        const m = sxy / sxx, b = my - m * mx, x0 = xt[0], x1 = xt[xt.length - 1];
        g += `<line x1="${xs(x0)}" y1="${ys(m * x0 + b)}" x2="${xs(x1)}" y2="${ys(m * x1 + b)}" stroke="var(--danger)" stroke-width="2" stroke-dasharray="8 5"/>`;
        note = `<p class="rv-note">추세선: ${esc(ds.head[yk])} ≈ ${fmt(m)} × ${esc(xName(ds, xk))} ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}</p>`;
      }
    }
    return svgWrap(g) + note;
  }

  function histChart(ds, yk, bins, skipZero) {
    let v = colValues(ds, yk);
    if (skipZero) v = v.filter((x) => x !== 0);
    if (!v.length) return empty();
    const lo = Math.min(...v), hi = Math.max(...v), w = (hi - lo) / bins || 1;
    const cnt = new Array(bins).fill(0);
    v.forEach((x) => { cnt[Math.min(bins - 1, Math.floor((x - lo) / w))]++; });
    const yt = niceTicks(0, Math.max(...cnt), 5).filter((t) => Number.isInteger(t));
    const ys = scaler(yt[0], yt[yt.length - 1], H - PAD.b, PAD.t), bw = (W - PAD.l - PAD.r) / bins, every = Math.ceil(bins / 10);
    const labels = cnt.map((_, i) => [PAD.l + bw * (i + .5), i % every ? '' : fmt(lo + w * i) + '~']);
    let g = frame([], yt, null, ys, ds.head[yk] + ' 구간', '줄 수 (몇 번 나왔나)', labels);
    cnt.forEach((c, i) => {
      g += `<rect x="${(PAD.l + bw * i + 1).toFixed(1)}" y="${ys(c).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(ys(0) - ys(c)).toFixed(1)}" fill="var(--ok)"><title>${fmt(lo + w * i)} ~ ${fmt(lo + w * (i + 1))}: ${c}줄</title></rect>`;
      if (c) g += `<text x="${PAD.l + bw * (i + .5)}" y="${ys(c) - 5}" text-anchor="middle" font-size="12" fill="var(--fg)">${c}</text>`;
    });
    return svgWrap(g);
  }

  /* ── 화면 (모달) ── */
  const VIEWS = [['table', '표'], ['line', '선 그래프'], ['area', '영역 그래프'], ['bar', '막대 그래프'], ['scatter', '산점도'], ['hist', '히스토그램'], ['stats', '통계']];
  const st = { sets: [], cur: 0, view: 'table', x: -1, ys: [], y: 0, sx: -1, sy: 0, bins: 10, trend: true, zero: true, sort: null, desc: false };
  let modal = null;
  const toast = (m) => (window.app && app.toast ? app.toast(m) : alert(m));

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rv-modal hidden';
    modal.innerHTML = `<div class="rv-box" role="dialog" aria-label="러닝 데이터 보기">
      <div class="rv-head"><b>📈 러닝 데이터 보기</b><span class="rv-sub">MY_DATA.HTM · CSV · 시뮬레이터 기록</span><span class="spacer"></span><button class="icon-btn rv-close" title="닫기 (Esc)">✕</button></div>
      <div class="rv-load">
        <label class="btn small primary">📂 파일 열기 (MY_DATA.HTM · CSV)<input type="file" accept=".htm,.html,.csv,.txt" hidden></label>
        <button class="btn small ghost" data-src="sim">📊 시뮬레이터 기록 가져오기</button>
        <button class="btn small ghost" data-src="sample">예시 데이터</button>
        <select class="rv-set" title="기록 묶음"></select>
        <button class="btn small ghost rv-csv" title="지금 보이는 기록을 CSV 파일로 저장">⬇ CSV</button>
      </div>
      <div class="rv-cards"></div>
      <div class="rv-tabs" role="tablist">${VIEWS.map(([k, t]) => `<button data-view="${k}">${t}</button>`).join('')}</div>
      <div class="rv-opts"></div>
      <div class="rv-body"></div>
    </div>`;
    document.body.appendChild(modal);
    const $ = (s) => modal.querySelector(s);
    $('.rv-close').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    $('input[type=file]').onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
    modal.querySelectorAll('.rv-load [data-src]').forEach((b) => { b.onclick = () => load(b.dataset.src); });
    $('.rv-set').onchange = (e) => { st.cur = +e.target.value; st.sort = null; pickDefaults(); render(); };
    $('.rv-csv').onclick = saveCsv;
    modal.querySelectorAll('.rv-tabs button').forEach((b) => { b.onclick = () => { st.view = b.dataset.view; render(); }; });
    const box = $('.rv-box');
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('drag'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
    return modal;
  }

  function open(src) {
    ensureModal().classList.remove('hidden');
    if (src) load(src); else render();
  }
  function close() { if (modal) modal.classList.add('hidden'); }

  function setSets(sets) {
    st.sets = sets; st.sort = null;
    // 가장 긴 묶음을 먼저 보여 줌
    st.cur = sets.reduce((best, s, i) => (s.rows.length > sets[best].rows.length ? i : best), 0);
    pickDefaults(); render();
  }
  function pickDefaults() {
    const ds = st.sets[st.cur]; if (!ds) return;
    // 첫 열이 시간이면 가로축으로, 아니면 줄 번호
    st.x = ds.head.length > 1 && /time|시간/i.test(ds.head[0]) ? 0 : -1;
    const rest = ds.head.map((_, k) => k).filter((k) => k !== st.x);
    const cad = ds.head.findIndex((h) => /cad|케이던스/i.test(h));
    st.y = cad >= 0 ? cad : (rest[0] != null ? rest[0] : 0);
    st.ys = [st.y]; st.sx = st.x; st.sy = st.y;
  }
  function load(src) {
    if (src === 'sample') setSets([JSON.parse(JSON.stringify(SAMPLE))]);
    else if (src === 'sim') { const ds = fromSim(); if (ds) setSets([ds]); else { toast('시뮬레이터 📊 로그에 기록이 없습니다. 먼저 log.add() 로 기록하는 예제를 실행해 보세요.'); render(); } }
    else if (src === 'file') ensureModal().querySelector('input[type=file]').click();
  }
  function loadFile(f) {
    const r = new FileReader();
    r.onload = () => {
      const sets = parseLog(r.result, f.name);
      if (!sets.length) { toast(f.name + ' 에서 기록(이름표 줄 + 숫자 줄)을 찾지 못했습니다.'); return; }
      setSets(sets);
      toast(f.name + ' — 기록 ' + sets.reduce((a, s) => a + s.rows.length, 0) + '줄을 읽었습니다.');
    };
    r.readAsText(f);
  }
  function saveCsv() {
    const ds = st.sets[st.cur]; if (!ds) return;
    const csv = [ds.head.join(',')].concat(ds.rows.map((r) => r.map((v) => (v == null ? '' : v)).join(','))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'running-data.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const colSelect = (ds, cls, val, withRow) => `<select class="${cls}">${withRow ? `<option value="-1"${val === -1 ? ' selected' : ''}>줄 번호</option>` : ''}${ds.head.map((h, k) => `<option value="${k}"${val === k ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select>`;

  function cardsHtml(ds) {
    const card = (t, v) => `<div class="rv-card"><span>${t}</span><b>${v}</b></div>`;
    const find = (re) => ds.head.findIndex((h) => re.test(h));
    const last = (k) => { const v = colValues(ds, k); return v.length ? v[v.length - 1] : null; };
    const iT = find(/time|시간/i), iS = find(/step|걸음/i), iC = find(/cad|케이던스/i), iD = find(/dist|거리/i);
    let h = card('기록 줄 수', ds.rows.length) + card('열(이름표)', ds.head.length);
    if (iT >= 0) h += card('기록 시간', fmt(last(iT)) + (/minute/i.test(ds.head[iT]) ? '분' : /milli/i.test(ds.head[iT]) ? 'ms' : /hour/i.test(ds.head[iT]) ? '시간' : '초'));
    if (iS >= 0) h += card('총 걸음', fmt(last(iS)));
    if (iD >= 0) h += card('거리', fmt(last(iD)) + 'm');
    if (iC >= 0) { const s = stats(colValues(ds, iC).filter((v) => v > 0)); if (s) h += card('평균 케이던스', Math.round(s.avg) + ' spm'); }
    if (iS >= 0 && iD >= 0 && last(iS)) h += card('평균 보폭', Math.round(last(iD) * 100 / last(iS)) + 'cm');
    return h;
  }

  function render() {
    if (!modal) return;
    const $ = (s) => modal.querySelector(s);
    const ds = st.sets[st.cur];
    $('.rv-set').innerHTML = st.sets.map((s, i) => `<option value="${i}"${i === st.cur ? ' selected' : ''}>${esc(s.name)} · ${s.rows.length}줄</option>`).join('');
    $('.rv-set').style.display = st.sets.length > 1 ? '' : 'none';
    $('.rv-csv').style.display = ds ? '' : 'none';
    $('.rv-tabs').style.display = ds ? '' : 'none';
    modal.querySelectorAll('.rv-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === st.view));
    if (!ds) {
      $('.rv-cards').innerHTML = ''; $('.rv-opts').innerHTML = '';
      $('.rv-body').innerHTML = '<div class="rv-drop">위의 버튼으로 기록을 불러오거나, 여기에 파일을 끌어 놓으세요.<br>실제 보드의 기록은 <b>MICROBIT</b> 드라이브의 <b>MY_DATA.HTM</b> 파일을 고르면 됩니다.</div>';
      return;
    }
    $('.rv-cards').innerHTML = cardsHtml(ds);

    let opts = '', body = '';
    if (st.view === 'table') {
      const order = ds.rows.map((r, i) => i);
      if (st.sort != null) {
        const val = (i) => { const v = st.sort < 0 ? i : ds.rows[i][st.sort]; return v == null ? -Infinity : v; };
        order.sort((a, b) => (val(a) - val(b)) * (st.desc ? -1 : 1));
      }
      const arrow = (k) => (st.sort === k ? (st.desc ? ' ▼' : ' ▲') : '');
      opts = `<span class="muted">이름표를 누르면 그 열의 크기 순서로 정렬합니다.${order.length > 2000 ? ' (앞 2000줄만 표시)' : ''}</span>`;
      body = `<div class="rv-table"><table><thead><tr><th data-k="-1">#${arrow(-1)}</th>${ds.head.map((h, k) => `<th data-k="${k}">${esc(h)}${arrow(k)}</th>`).join('')}</tr></thead><tbody>${order.slice(0, 2000).map((i) => `<tr><td class="muted">${i + 1}</td>${ds.rows[i].map((v) => `<td>${esc(fmt(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } else if (st.view === 'line' || st.view === 'area') {
      opts = `가로축 ${colSelect(ds, 'rv-x', st.x, true)} 세로축 ${ds.head.map((h, k) => `<label class="rv-chk"><input type="checkbox" value="${k}"${st.ys.includes(k) ? ' checked' : ''}>${esc(h)}</label>`).join('')}`;
      body = lineChart(ds, st.x, st.ys, st.view === 'area');
    } else if (st.view === 'bar') {
      opts = `가로축 ${colSelect(ds, 'rv-x', st.x, true)} 막대 ${colSelect(ds, 'rv-y', st.y)}`;
      body = barChart(ds, st.x, st.y);
    } else if (st.view === 'scatter') {
      opts = `가로축 ${colSelect(ds, 'rv-sx', st.sx, true)} 세로축 ${colSelect(ds, 'rv-sy', st.sy)} <label class="rv-chk"><input type="checkbox" class="rv-trend"${st.trend ? ' checked' : ''}>추세선</label>`;
      body = scatterChart(ds, st.sx, st.sy, st.trend);
    } else if (st.view === 'hist') {
      opts = `열 ${colSelect(ds, 'rv-y', st.y)} 구간 수 <select class="rv-bins">${[5, 8, 10, 15, 20].map((b) => `<option${b === st.bins ? ' selected' : ''}>${b}</option>`).join('')}</select> <label class="rv-chk"><input type="checkbox" class="rv-zero"${st.zero ? ' checked' : ''}>0 빼기 (멈춘 시간)</label>`;
      body = histChart(ds, st.y, st.bins, st.zero);
    } else if (st.view === 'stats') {
      body = `<div class="rv-table"><table><thead><tr><th>열</th><th>개수</th><th>가장 작은 값</th><th>가장 큰 값</th><th>평균</th><th>중앙값</th></tr></thead><tbody>${ds.head.map((h, k) => { const s = stats(colValues(ds, k)); return `<tr><th>${esc(h)}</th>${s ? [s.n, s.min, s.max, s.avg, s.med].map((v) => `<td>${fmt(v)}</td>`).join('') : '<td colspan="5" class="muted">숫자 없음</td>'}</tr>`; }).join('')}</tbody></table></div><p class="rv-note">중앙값은 크기 순서로 늘어놓았을 때 한가운데 값입니다. 튀는 값이 있으면 평균은 크게 흔들리지만 중앙값은 덜 흔들립니다.</p>`;
    }
    $('.rv-opts').innerHTML = opts;
    $('.rv-body').innerHTML = body;

    const on = (sel, fn) => modal.querySelectorAll('.rv-opts ' + sel).forEach((el) => el.addEventListener('change', fn));
    on('.rv-x', (e) => { st.x = +e.target.value; render(); });
    on('.rv-y', (e) => { st.y = +e.target.value; render(); });
    on('.rv-sx', (e) => { st.sx = +e.target.value; render(); });
    on('.rv-sy', (e) => { st.sy = +e.target.value; render(); });
    on('.rv-bins', (e) => { st.bins = +e.target.value; render(); });
    on('.rv-trend', (e) => { st.trend = e.target.checked; render(); });
    on('.rv-zero', (e) => { st.zero = e.target.checked; render(); });
    on('.rv-chk input[value]', () => { st.ys = Array.from(modal.querySelectorAll('.rv-opts .rv-chk input[value]:checked')).map((i) => +i.value); render(); });
    modal.querySelectorAll('.rv-table thead th[data-k]').forEach((th) => { th.onclick = () => { const k = +th.dataset.k; if (st.sort === k) st.desc = !st.desc; else { st.sort = k; st.desc = false; } render(); }; });
  }

  window.RunViewer = { open, close, parse: parseLog };

  // 위쪽 막대 메뉴 [📈 데이터 보기]
  function addMenu() {
    const bar = document.querySelector('#center .topbar');
    if (!bar || bar.querySelector('.rv-menu')) return;
    const b = document.createElement('button');
    b.className = 'btn ghost small rv-menu';
    b.title = 'MY_DATA.HTM · CSV · 시뮬레이터 기록을 표와 그래프로 보기';
    b.textContent = '📈 데이터 보기';
    b.onclick = () => open();
    bar.insertBefore(b, bar.querySelector('.view-switch'));
  }
  // 본문의 <div class="rv-launch"></div> 자리에 여는 버튼 넣기
  function fillLaunchers() {
    document.querySelectorAll('.rv-launch:not(.ready)').forEach((el) => {
      el.classList.add('ready');
      el.innerHTML = '<button class="btn primary" data-src="file">📂 MY_DATA.HTM 열어서 보기</button><button class="btn ghost" data-src="sim">📊 시뮬레이터 기록으로 보기</button><button class="btn ghost" data-src="sample">예시 데이터로 보기</button>';
      el.querySelectorAll('button').forEach((b) => { b.onclick = () => open(b.dataset.src); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMenu); else addMenu();
  document.addEventListener('lb:render', () => { addMenu(); setTimeout(fillLaunchers, 0); });
  setTimeout(fillLaunchers, 0);
})();

/* ── 공간 설계 · 경로 보기 (ch08) ──────────────────────────────────────
 * 마우스로 공간(가로 · 세로 m)을 만들고 사각형 · 원 · 삼각형 구조물과 시작점을 놓은 뒤,
 * MY_DATA.HTM · CSV · 시뮬레이터 기록의 x · y(cm) 를 시작점에서부터 겹쳐 그립니다.
 * 벽 밖 · 구조물 안에 찍힌 점은 빨간 X 로 표시합니다. 공간은 이 브라우저(localStorage)에 저장됩니다.
 * 열기: 위쪽 막대의 [🗺 공간 · 경로] 메뉴, 또는 본문의 <div class="pm-launch"></div> 자리 버튼.
 */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => (window.app && app.toast ? app.toast(m) : alert(m));
  const KEY = 'mbproj.pathmap.v1';
  const KINDS = { rect: '사각형', circle: '원', tri: '삼각형' };
  const TOOLS = [['select', '선택'], ['rect', '사각형'], ['circle', '원'], ['tri', '삼각형'], ['start', '시작점']];
  const PCOLORS = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--more)', 'var(--accent2)'];
  const r1 = (v) => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 예시 공간: ch07 2교시 교실 (8m × 5m, 시작점 = 문 옆) + 원탁 · 화단
  const SAMPLE_SPACE = () => ({
    w: 8, h: 5, grid: 1, snap: true,
    start: { x: 7.5, y: 0.5, dir: 0 },
    items: [
      { type: 'rect', name: '기둥', x: 3.5, y: 2.5, w: 1, h: 1, rot: 0 },
      { type: 'circle', name: '원탁', x: 5.5, y: 2.3, r: 0.5 },
      { type: 'tri', name: '화단', x: 2, y: 1, w: 0.8, h: 0.8, rot: 0 }
    ]
  });
  // 예시 기록 (ch08 그림 8-2 · 8-7 과 같은 값, cm · 시작점 기준)
  const SAMPLES = {
    before: ['예시: 개선 전', [[-12, 66], [-26, 132], [-33, 198], [-48, 263], [-57, 330], [-69, 396], [-84, 461], [-150, 452], [-215, 436], [-281, 425], [-346, 410], [-412, 395], [-478, 384], [-545, 380], [-610, 365], [-676, 352], [-742, 345], [-739, 278], [-731, 211], [-720, 145], [-718, 78], [-783, 63], [-850, 59]]],
    after: ['예시: 개선 후', [[1, 58], [2, 116], [4, 174], [7, 232], [8, 290], [11, 348], [8, 406], [-50, 406], [-108, 409], [-166, 410], [-224, 412], [-282, 410], [-340, 410], [-398, 408], [-456, 408], [-514, 408], [-572, 405], [-570, 347], [-569, 289], [-571, 231], [-573, 173], [-631, 171], [-689, 173]]],
    board: ['예시: 실제 보드', [[0, 60], [0, 120], [3, 180], [3, 240], [3, 300], [4, 360], [1, 420], [-59, 420], [-119, 421], [-179, 423], [-226, 386], [-274, 350], [-321, 313], [-372, 280], [-422, 248], [-482, 243], [-486, 184], [-490, 124], [-491, 64], [-492, 4], [-552, 1], [-612, -4]]]
  };

  const validSpace = (s) => !!(s && s.w > 0 && s.h > 0 && Array.isArray(s.items) && s.start);
  function loadSpace() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (validSpace(s)) return s; } catch (e) { /* 저장된 것 없음 */ }
    return SAMPLE_SPACE();
  }
  const st = { sp: loadSpace(), tool: 'select', sel: null, paths: [], upto: 0, labels: false, drag: null };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st.sp)); } catch (e) { /* 저장 못 함 */ } };
  const snapStep = () => (st.sp.snap ? Math.min(0.5, st.sp.grid / 2) : 0.1);
  const snapV = (v) => { const s = snapStep(); return r1(Math.round(v / s) * s); };

  /* ── 준비된 계산: 점이 구조물 안인가? (회전한 구조물은 점을 거꾸로 돌려서 봄) ── */
  function inside(it, px, py) {
    if (it.type === 'circle') return Math.hypot(px - it.x, py - it.y) <= it.r;
    const a = (it.rot || 0) * Math.PI / 180, dx = px - it.x, dy = -(py - it.y);   // 화면 방향(아래가 +)으로
    const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
    if (it.type === 'rect') return Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.h / 2;
    if (ly < -it.h / 2 || ly > it.h / 2) return false;          // 삼각형: 꼭짓점이 위, 밑변이 아래
    return Math.abs(lx) <= (ly + it.h / 2) / it.h * it.w / 2;
  }
  function hitName(x, y) {
    if (x < 0 || y < 0 || x > st.sp.w || y > st.sp.h) return '벽 밖';
    for (let i = st.sp.items.length - 1; i >= 0; i--) if (inside(st.sp.items[i], x, y)) return st.sp.items[i].name || KINDS[st.sp.items[i].type];
    return '';
  }
  // 기록 (x, y cm · 시작점 기준) → 공간 좌표 (m). 출발 방향 dir° 만큼 시계 방향으로 돌림
  function toWorld(p) {
    const s = st.sp.start, a = (s.dir || 0) * Math.PI / 180;
    return { x: s.x + (p.x * Math.cos(a) + p.y * Math.sin(a)) / 100, y: s.y + (-p.x * Math.sin(a) + p.y * Math.cos(a)) / 100 };
  }
  function analyse(path) {
    const s = st.sp.start;
    let prev = { x: s.x, y: s.y }, len = 0;
    const pts = path.pts.map((p) => { const w = toWorld(p); len += Math.hypot(w.x - prev.x, w.y - prev.y); prev = w; return Object.assign({}, p, w, { hit: hitName(w.x, w.y) }); });
    return { pts, len, bad: pts.filter((p) => p.hit) };
  }

  /* ── 그리기 (SVG 1단위 = 1cm, 위쪽이 +y 가 되게 뒤집음) ── */
  const X = (x) => r1(x * 100), Y = (y) => r1((st.sp.h - y) * 100);
  function viewBox() {
    let x0 = 0, y0 = 0, x1 = st.sp.w, y1 = st.sp.h;
    st.paths.filter((p) => p.on).forEach((p) => p.pts.forEach((q) => { const w = toWorld(q); x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); }));
    const m = Math.max(x1 - x0, y1 - y0) * 0.08 + 0.3;
    return [X(x0 - m), Y(y1 + m), r1((x1 - x0 + 2 * m) * 100), r1((y1 - y0 + 2 * m) * 100)];
  }
  function shapeSvg(it, attrs) {
    if (it.type === 'circle') return `<circle cx="${X(it.x)}" cy="${Y(it.y)}" r="${r1(it.r * 100)}" ${attrs}/>`;
    const tr = `transform="translate(${X(it.x)} ${Y(it.y)}) rotate(${it.rot || 0})"`, w = it.w * 50, h = it.h * 50;
    if (it.type === 'rect') return `<rect x="${-w}" y="${-h}" width="${2 * w}" height="${2 * h}" ${tr} ${attrs}/>`;
    return `<polygon points="0,${-h} ${w},${h} ${-w},${h}" ${tr} ${attrs}/>`;
  }
  function svgHtml() {
    const sp = st.sp, vb = viewBox(), k = Math.max(sp.w, sp.h) / 8, fs = r1(18 * k);
    let g = `<rect x="0" y="0" width="${sp.w * 100}" height="${sp.h * 100}" fill="var(--card)"/>`;
    for (let x = sp.grid; x < sp.w - 1e-9; x += sp.grid) g += `<line x1="${X(x)}" x2="${X(x)}" y1="0" y2="${sp.h * 100}" stroke="var(--line)" stroke-width="${k}"/>`;
    for (let y = sp.grid; y < sp.h - 1e-9; y += sp.grid) g += `<line x1="0" x2="${sp.w * 100}" y1="${Y(y)}" y2="${Y(y)}" stroke="var(--line)" stroke-width="${k}"/>`;
    const lab = Math.max(sp.grid, Math.ceil(Math.max(sp.w, sp.h) / 10));
    for (let x = 0; x <= sp.w + 1e-9; x += lab) g += `<text x="${X(x)}" y="${r1(sp.h * 100 + fs * 1.2)}" font-size="${fs}" text-anchor="middle" fill="var(--muted)">${r1(x)}</text>`;
    for (let y = 0; y <= sp.h + 1e-9; y += lab) g += `<text x="${r1(-fs * 0.5)}" y="${r1(Y(y) + fs * 0.35)}" font-size="${fs}" text-anchor="end" fill="var(--muted)">${r1(y)}</text>`;
    g += `<rect x="0" y="0" width="${sp.w * 100}" height="${sp.h * 100}" fill="none" stroke="var(--fg)" stroke-width="${r1(5 * k)}"/>`;
    g += `<text x="${sp.w * 50}" y="${r1(-fs * 0.6)}" font-size="${fs}" text-anchor="middle" fill="var(--muted)">위쪽 (출발 방향 0°) · ${r1(sp.w)}m × ${r1(sp.h)}m</text>`;
    // 구조물
    sp.items.forEach((it, i) => {
      g += `<g class="pm-item" data-i="${i}">${shapeSvg(it, `fill="var(--muted)" fill-opacity=".35" stroke="var(--muted)" stroke-width="${r1(2 * k)}"`)}`;
      g += `<text x="${X(it.x)}" y="${r1(Y(it.y) + fs * 0.35)}" font-size="${fs}" text-anchor="middle" fill="var(--fg)" pointer-events="none">${esc(it.name)}</text></g>`;
      if (st.sel === i) g += shapeSvg(it, `fill="none" stroke="var(--accent)" stroke-width="${r1(4 * k)}" stroke-dasharray="${r1(10 * k)} ${r1(6 * k)}" pointer-events="none"`);
    });
    if (st.drag && st.drag.mode === 'new' && st.drag.item) g += shapeSvg(st.drag.item, `fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width="${r1(3 * k)}" stroke-dasharray="${r1(8 * k)} ${r1(5 * k)}"`);
    // 경로
    const s = sp.start;
    st.paths.forEach((p, n) => {
      if (!p.on) return;
      const c = PCOLORS[n % PCOLORS.length], pts = analyse(p).pts.slice(0, st.upto);
      g += `<polyline points="${[s].concat(pts).map((q) => X(q.x) + ',' + Y(q.y)).join(' ')}" fill="none" stroke="${c}" stroke-width="${r1(4 * k)}" stroke-linejoin="round" stroke-opacity=".85" pointer-events="none"/>`;
      pts.forEach((q, i) => {
        const cx = X(q.x), cy = Y(q.y), tip = `<title>${esc(p.name)} · ${q.n}걸음 · (${r1(q.x)}m, ${r1(q.y)}m)${q.hit ? ' · ' + esc(q.hit) + ' 통과!' : ''}</title>`;
        if (q.hit) { const d = r1(10 * k); g += `<g stroke="var(--danger)" stroke-width="${r1(4 * k)}"><line x1="${cx - d}" y1="${cy - d}" x2="${cx + d}" y2="${cy + d}"/><line x1="${cx - d}" y1="${cy + d}" x2="${cx + d}" y2="${cy - d}"/><circle cx="${cx}" cy="${cy}" r="${r1(d * 1.4)}" fill="transparent" stroke="none">${tip}</circle></g>`; }
        else if (q.fix) g += `<circle cx="${cx}" cy="${cy}" r="${r1(10 * k)}" fill="none" stroke="${c}" stroke-width="${r1(4 * k)}">${tip}</circle>`;
        else g += `<circle cx="${cx}" cy="${cy}" r="${r1((i === pts.length - 1 ? 9 : 5) * k)}" fill="${c}">${tip}</circle>`;
        if (st.labels) g += `<text x="${r1(cx + 9 * k)}" y="${r1(cy - 9 * k)}" font-size="${r1(fs * 0.75)}" fill="${c}" pointer-events="none">${esc(q.n)}</text>`;
      });
    });
    // 시작점 + 출발 방향 화살표
    const a = (s.dir || 0) * Math.PI / 180, L = 60 * k;
    g += `<g class="pm-start"><line x1="${X(s.x)}" y1="${Y(s.y)}" x2="${r1(X(s.x) + L * Math.sin(a))}" y2="${r1(Y(s.y) - L * Math.cos(a))}" stroke="var(--ok)" stroke-width="${r1(5 * k)}" marker-end="url(#pmArrow)"/>`;
    g += `<circle cx="${X(s.x)}" cy="${Y(s.y)}" r="${r1(15 * k)}" fill="var(--ok)" stroke="${st.sel === 'start' ? 'var(--accent)' : 'var(--card)'}" stroke-width="${r1(4 * k)}"/>`;
    g += `<text x="${X(s.x)}" y="${r1(Y(s.y) + fs * 0.35)}" font-size="${fs}" font-weight="bold" text-anchor="middle" fill="#fff" pointer-events="none">S</text></g>`;
    return `<svg class="pm-svg" viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif"><defs><marker id="pmArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ok)"/></marker></defs>${g}</svg>`;
  }

  /* ── 오른쪽 칸 ── */
  const num = (k, v, min, max, stp, title) => `<input type="number" class="pm-p" data-k="${k}" value="${r1(v)}" min="${min}" max="${max}" step="${stp}"${title ? ` title="${title}"` : ''}>`;
  function propsHtml() {
    const sp = st.sp;
    if (st.sel === 'start') {
      return `<div class="pm-row"><b>시작점 S</b></div>
        <div class="pm-row">x ${num('x', sp.start.x, 0, sp.w, 0.1)} y ${num('y', sp.start.y, 0, sp.h, 0.1)} m</div>
        <div class="pm-row">출발 방향 ${num('dir', sp.start.dir || 0, -360, 360, 5, '도면 위쪽 = 0°, 오른쪽 = 90° (시계 방향)')}°</div>
        <div class="pm-row">${[0, 90, 180, 270].map((d) => `<button class="btn small ghost pm-dir" data-d="${d}">${d}°</button>`).join('')}</div>
        <p class="rv-note">A 를 누르고 출발할 때 바라본 쪽입니다. 도면 위쪽을 보고 출발했다면 0° 입니다.</p>`;
    }
    const it = sp.items[st.sel];
    if (!it) return '<p class="rv-note">선택 도구로 구조물이나 시작점 S 를 누르면 여기에서 크기 · 위치를 바꿀 수 있습니다.</p>';
    const size = it.type === 'circle' ? `<div class="pm-row">반지름 ${num('r', it.r, 0.1, 50, 0.1)} m</div>`
      : `<div class="pm-row">가로 ${num('w', it.w, 0.1, 50, 0.1)} 세로 ${num('h', it.h, 0.1, 50, 0.1)} m</div><div class="pm-row">회전 ${num('rot', it.rot || 0, -360, 360, 15)}°</div>`;
    return `<div class="pm-row"><b>${KINDS[it.type]}</b> <input type="text" class="pm-name" value="${esc(it.name)}" maxlength="12" title="이름"></div>
      <div class="pm-row">가운데 x ${num('x', it.x, -50, 100, 0.1)} y ${num('y', it.y, -50, 100, 0.1)} m</div>
      ${size}
      <div class="pm-row"><button class="btn small ghost pm-dup">복제</button><button class="btn small ghost pm-del">삭제 (Delete)</button></div>`;
  }
  function pathsHtml() {
    if (!st.paths.length) return '<p class="rv-note">아직 불러온 기록이 없습니다. 기록에 <code>x</code> · <code>y</code> 열(cm)이 있어야 합니다.</p>';
    const max = Math.max(...st.paths.map((p) => p.pts.length));
    return st.paths.map((p, n) => `<div class="pm-row pm-path"><label class="rv-chk"><input type="checkbox" class="pm-on" data-n="${n}"${p.on ? ' checked' : ''}><i style="background:${PCOLORS[n % PCOLORS.length]}"></i>${esc(p.name)}</label><button class="icon-btn pm-rm" data-n="${n}" title="이 기록 빼기">✕</button></div>`).join('') +
      `<div class="pm-row">보여 줄 걸음 <input type="range" class="pm-upto" min="0" max="${max}" value="${st.upto}"> <span class="pm-upto-n">${st.upto} / ${max}</span></div>
       <label class="rv-chk"><input type="checkbox" class="pm-labels"${st.labels ? ' checked' : ''}>걸음 번호 보이기</label>`;
  }
  function resultHtml() {
    const on = st.paths.filter((p) => p.on);
    if (!on.length) return '';
    const s = st.sp.start;
    const rows = on.map((p) => {
      const a = analyse(p), e = a.pts[a.pts.length - 1];
      const bad = a.bad.length ? a.bad.slice(0, 8).map((q) => `${esc(q.n)}걸음(${esc(q.hit)})`).join(', ') + (a.bad.length > 8 ? ' …' : '') : '없음';
      return `<tr><th>${esc(p.name)}</th><td>${a.pts.length}</td><td>${r1(a.len)}m</td><td>(${r1(e.x)}, ${r1(e.y)})</td><td>${r1(Math.hypot(e.x - s.x, e.y - s.y))}m</td><td class="${a.bad.length ? 'pm-bad' : ''}">${a.bad.length}</td><td class="pm-badlist">${bad}</td></tr>`;
    }).join('');
    return `<div class="rv-table"><table><thead><tr><th>기록</th><th>점 수</th><th>걸은 길</th><th>끝점 (m)</th><th>S → 끝점</th><th>통과 점</th><th>통과한 걸음 (어디)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ── 화면 (모달) ── */
  let modal = null;
  const $ = (s) => modal.querySelector(s);
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rv-modal pm-modal hidden';
    modal.innerHTML = `<div class="rv-box pm-box" role="dialog" aria-label="공간 설계 · 경로 보기">
      <div class="rv-head"><b>🗺 공간 설계 · 경로 보기</b><span class="rv-sub">공간 크기 · 구조물 · 시작점을 정하고 기록을 겹쳐 그리기</span><span class="spacer"></span><button class="icon-btn rv-close" title="닫기 (Esc)">✕</button></div>
      <div class="pm-tools" role="toolbar">${TOOLS.map(([t, n]) => `<button class="btn small ghost" data-tool="${t}">${n}</button>`).join('')}<span class="pm-tip"></span></div>
      <div class="pm-main">
        <div class="pm-canvas"></div>
        <div class="pm-side">
          <div class="pm-sec"><h4>공간</h4>
            <div class="pm-row">가로 <input type="number" class="pm-sw" min="1" max="50" step="0.5"> 세로 <input type="number" class="pm-sh" min="1" max="50" step="0.5"> m</div>
            <div class="pm-row">격자 <select class="pm-grid">${[0.5, 1, 2, 5].map((v) => `<option value="${v}">${v}m</option>`).join('')}</select><label class="rv-chk"><input type="checkbox" class="pm-snap">격자에 맞추기</label></div>
            <div class="pm-row"><button class="btn small ghost pm-new">빈 공간</button><button class="btn small ghost pm-sample">예시 공간</button></div>
            <div class="pm-row"><button class="btn small ghost pm-save" title="공간 도면을 .json 파일로 저장">💾 공간 저장</button><label class="btn small ghost">📂 공간 불러오기<input type="file" class="pm-load" accept=".json" hidden></label></div>
          </div>
          <div class="pm-sec"><h4>고른 것</h4><div class="pm-props"></div></div>
          <div class="pm-sec"><h4>경로 기록</h4>
            <div class="pm-row"><label class="btn small primary">📂 MY_DATA.HTM · CSV 열기<input type="file" class="pm-file" accept=".htm,.html,.csv,.txt" hidden></label><button class="btn small ghost" data-src="sim">📊 시뮬레이터 기록</button></div>
            <div class="pm-row">${Object.keys(SAMPLES).map((k) => `<button class="btn small ghost" data-src="${k}">${SAMPLES[k][0]}</button>`).join('')}</div>
            <div class="pm-paths"></div>
          </div>
        </div>
      </div>
      <div class="pm-result"></div>
    </div>`;
    document.body.appendChild(modal);

    $('.rv-close').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') close();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); delSel(); }
    });
    modal.querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => { st.tool = b.dataset.tool; render(); }; });
    $('.pm-sw').onchange = (e) => { st.sp.w = clamp(+e.target.value || 1, 1, 50); changed(); };
    $('.pm-sh').onchange = (e) => { st.sp.h = clamp(+e.target.value || 1, 1, 50); changed(); };
    $('.pm-grid').onchange = (e) => { st.sp.grid = +e.target.value; changed(); };
    $('.pm-snap').onchange = (e) => { st.sp.snap = e.target.checked; changed(); };
    $('.pm-new').onclick = () => {
      if (st.sp.items.length && !confirm('구조물을 모두 지우고 빈 공간으로 시작할까요?')) return;
      st.sp = { w: st.sp.w, h: st.sp.h, grid: st.sp.grid, snap: st.sp.snap, start: { x: 0.5, y: 0.5, dir: 0 }, items: [] }; st.sel = null; changed();
    };
    $('.pm-sample').onclick = () => { if (st.sp.items.length && !confirm('지금 공간 대신 예시 공간(ch07 교실)을 열까요?')) return; st.sp = SAMPLE_SPACE(); st.sel = null; changed(); };
    $('.pm-save').onclick = () => download('space.json', JSON.stringify(st.sp, null, 1), 'application/json');
    $('.pm-load').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readText(f, (t) => loadSpaceText(t, f.name)); };
    $('.pm-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readText(f, (t) => addFromText(t, f.name)); };
    modal.querySelectorAll('[data-src]').forEach((b) => { b.onclick = () => loadSrc(b.dataset.src); });

    // 오른쪽 칸은 다시 그려지므로 이벤트를 위임
    const side = $('.pm-side');
    side.addEventListener('change', onSide);
    side.addEventListener('input', (e) => { if (e.target.classList.contains('pm-upto')) { st.upto = +e.target.value; draw(); $('.pm-upto-n').textContent = st.upto + ' / ' + e.target.max; } });
    side.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.classList.contains('pm-dir')) { st.sp.start.dir = +t.dataset.d; changed(); }
      else if (t.classList.contains('pm-del')) delSel();
      else if (t.classList.contains('pm-dup')) { const it = Object.assign({}, st.sp.items[st.sel]); it.x = r1(it.x + 0.5); it.y = r1(it.y - 0.5); st.sp.items.push(it); st.sel = st.sp.items.length - 1; changed(); }
      else if (t.classList.contains('pm-rm')) { st.paths.splice(+t.dataset.n, 1); fitUpto(); render(); }
    });

    const cv = $('.pm-canvas');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    const box = $('.pm-box');
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (e) => {
      e.preventDefault(); box.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) readText(f, (t) => (/\.json$/i.test(f.name) ? loadSpaceText(t, f.name) : addFromText(t, f.name)));
    });
    return modal;
  }

  function onSide(e) {
    const t = e.target;
    if (t.classList.contains('pm-p')) {
      const k = t.dataset.k, v = r1(+t.value), isStart = st.sel === 'start';
      const o = isStart ? st.sp.start : st.sp.items[st.sel];
      if (!o || !isFinite(v)) return;
      if (/^[whr]$/.test(k)) o[k] = Math.max(0.1, v);
      else if (isStart && k === 'x') o.x = clamp(v, 0, st.sp.w);
      else if (isStart && k === 'y') o.y = clamp(v, 0, st.sp.h);
      else o[k] = v;
      changed();
    } else if (t.classList.contains('pm-name')) { const it = st.sp.items[st.sel]; if (it) { it.name = t.value.trim() || KINDS[it.type]; changed(); } }
    else if (t.classList.contains('pm-on')) { st.paths[+t.dataset.n].on = t.checked; render(); }
    else if (t.classList.contains('pm-labels')) { st.labels = t.checked; draw(); }
  }
  function delSel() {
    if (typeof st.sel !== 'number' || !st.sp.items[st.sel]) return;
    st.sp.items.splice(st.sel, 1); st.sel = null; changed();
  }

  /* ── 마우스: 구조물 그리기 · 고르기 · 끌어 옮기기 · 시작점 놓기 ── */
  function worldAt(e) {
    const svg = $('.pm-svg'), pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x / 100, y: st.sp.h - p.y / 100 };
  }
  function boxItem(type, a, b) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (type === 'circle') return { type, x: r1((x0 + x1) / 2), y: r1((y0 + y1) / 2), r: Math.max(0.1, r1(Math.max(x1 - x0, y1 - y0) / 2)) };
    return { type, x: r1((x0 + x1) / 2), y: r1((y0 + y1) / 2), w: Math.max(0.1, r1(x1 - x0)), h: Math.max(0.1, r1(y1 - y0)), rot: 0 };
  }
  function onDown(e) {
    if (e.button || !$('.pm-svg')) return;
    const w = worldAt(e), p = { x: snapV(w.x), y: snapV(w.y) };
    $('.pm-canvas').setPointerCapture(e.pointerId);
    if (st.tool === 'start') {
      st.sp.start.x = clamp(p.x, 0, st.sp.w); st.sp.start.y = clamp(p.y, 0, st.sp.h); st.sel = 'start';
      st.drag = { mode: 'move', o: st.sp.start, dx: 0, dy: 0, inRoom: true };
      changed(); return;
    }
    if (KINDS[st.tool]) { st.drag = { mode: 'new', a: p, item: null }; return; }
    const g = e.target.closest('.pm-item, .pm-start');
    if (!g) { st.sel = null; render(); return; }
    st.sel = g.classList.contains('pm-start') ? 'start' : +g.dataset.i;
    const o = st.sel === 'start' ? st.sp.start : st.sp.items[st.sel];
    st.drag = { mode: 'move', o, dx: o.x - w.x, dy: o.y - w.y, inRoom: st.sel === 'start' };
    render();
  }
  function onMove(e) {
    const d = st.drag; if (!d) return;
    const w = worldAt(e);
    if (d.mode === 'new') d.item = boxItem(st.tool, d.a, { x: snapV(w.x), y: snapV(w.y) });
    else {
      d.o.x = snapV(w.x + d.dx); d.o.y = snapV(w.y + d.dy); d.moved = true;
      if (d.inRoom) { d.o.x = clamp(d.o.x, 0, st.sp.w); d.o.y = clamp(d.o.y, 0, st.sp.h); }
    }
    draw();
  }
  function onUp() {
    const d = st.drag; if (!d) return;
    st.drag = null;
    if (d.mode === 'new') {
      let it = d.item;
      const small = !it || (it.type === 'circle' ? it.r < 0.15 : it.w < 0.15 && it.h < 0.15);
      if (small) it = boxItem(st.tool, { x: d.a.x - 0.5, y: d.a.y - 0.5 }, { x: d.a.x + 0.5, y: d.a.y + 0.5 });   // 한 번 누르기 = 1m 크기
      it.name = KINDS[it.type] + ' ' + (st.sp.items.filter((q) => q.type === it.type).length + 1);
      st.sp.items.push(it); st.sel = st.sp.items.length - 1; st.tool = 'select';
      changed();
    } else if (d.moved) changed();
  }

  /* ── 공간 파일 · 기록 불러오기 ── */
  function readText(f, cb) { const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsText(f); }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function loadSpaceText(text, fileName) {
    let s = null;
    try { s = JSON.parse(text); } catch (e) { /* 아래에서 안내 */ }
    if (!validSpace(s)) { toast(fileName + ' 은 공간 파일이 아닙니다.'); return; }
    st.sp = s; st.sel = null; changed();
    toast(fileName + ' 공간을 불러왔습니다.');
  }
  // 이름표 · 숫자 줄 묶음 { head, rows } 에서 x · y 열을 찾아 경로로
  function pathFromSet(ds, name) {
    const find = (re) => ds.head.findIndex((h) => re.test(String(h).trim()));
    const ix = find(/^x$/i), iy = find(/^y$/i), ifx = find(/^fix$/i), is = find(/^steps?$|걸음/i);
    if (ix < 0 || iy < 0) return null;
    const pts = [];
    ds.rows.forEach((r, i) => {
      if (r[ix] == null || r[iy] == null || !isFinite(r[ix]) || !isFinite(r[iy])) return;
      pts.push({ x: +r[ix], y: +r[iy], fix: ifx >= 0 && +r[ifx] === 1, n: is >= 0 && r[is] != null ? r[is] : i + 1 });
    });
    return pts.length ? { name, pts, on: true } : null;
  }
  function fitUpto() { st.upto = st.paths.length ? Math.max(...st.paths.map((q) => q.pts.length)) : 0; }
  function addPath(p) {
    if (st.paths.length >= PCOLORS.length) st.paths.shift();
    st.paths.push(p);
    fitUpto(); render();
    const bad = analyse(p).bad.length;
    toast(p.name + ' — 점 ' + p.pts.length + '개' + (bad ? ', 벽 · 구조물 통과 ' + bad + '개' : ''));
  }
  function addFromText(text, fileName) {
    if (!window.RunViewer || !RunViewer.parse) { toast('기록 읽기 기능을 찾지 못했습니다.'); return; }
    const paths = RunViewer.parse(text, fileName).map((s) => pathFromSet(s, fileName)).filter(Boolean);
    if (!paths.length) { toast(fileName + ' 에서 x · y 열이 있는 기록을 찾지 못했습니다. 예제 7-15 · 8-16 의 경로 기록기로 저장한 기록이 필요합니다.'); return; }
    addPath(paths.reduce((b, p) => (p.pts.length > b.pts.length ? p : b)));   // 가장 긴 묶음
  }
  function loadSrc(src) {
    if (SAMPLES[src]) { addPath({ name: SAMPLES[src][0], pts: SAMPLES[src][1].map((q, i) => ({ x: q[0], y: q[1], fix: false, n: i + 1 })), on: true }); return; }
    if (src === 'sim') {
      const L = window.app && app.sim && app.sim.s && app.sim.s.log;
      const toNum = (v) => (v == null || v === '' || !isFinite(+v) ? null : +v);
      const p = L && L.rows && L.rows.length ? pathFromSet({ head: L.labels, rows: L.rows.map((r) => L.labels.map((k) => toNum(r.obj[k]))) }, '시뮬레이터 📊 로그') : null;
      if (p) addPath(p); else toast('시뮬레이터 📊 로그에 x · y 기록이 없습니다. 먼저 예제 7-15 나 8-16 의 경로 기록기를 실행해 걸어 보세요.');
    }
  }

  /* ── 다시 그리기 ── */
  function changed() { save(); render(); }
  function draw() { if (modal) $('.pm-canvas').innerHTML = svgHtml(); }
  const TIPS = { select: '구조물 · S 를 눌러 고르고 끌어 옮깁니다.', rect: '공간 위에서 끌어 사각형을 만듭니다 (한 번 누르면 1m).', circle: '끌어서 원의 지름을 정합니다 (한 번 누르면 지름 1m).', tri: '끌어서 삼각형의 밑변 × 높이를 정합니다.', start: '누른 곳이 출발 위치 S 가 됩니다.' };
  function render() {
    if (!modal) return;
    const sp = st.sp;
    modal.querySelectorAll('[data-tool]').forEach((b) => { b.classList.toggle('primary', b.dataset.tool === st.tool); b.classList.toggle('ghost', b.dataset.tool !== st.tool); });
    $('.pm-tip').textContent = TIPS[st.tool];
    $('.pm-canvas').dataset.tool = st.tool;
    $('.pm-sw').value = sp.w; $('.pm-sh').value = sp.h; $('.pm-grid').value = String(sp.grid); $('.pm-snap').checked = !!sp.snap;
    $('.pm-props').innerHTML = propsHtml();
    $('.pm-paths').innerHTML = pathsHtml();
    $('.pm-result').innerHTML = resultHtml();
    draw();
  }

  function open(src) {
    ensureModal().classList.remove('hidden');
    render();
    if (src) loadSrc(src);
  }
  function close() { if (modal) modal.classList.add('hidden'); }
  window.PathMap = { open, close, inside };

  // 위쪽 막대 메뉴 [🗺 공간 · 경로]
  function addMenu() {
    const bar = document.querySelector('#center .topbar');
    if (!bar || bar.querySelector('.pm-menu')) return;
    const b = document.createElement('button');
    b.className = 'btn ghost small pm-menu';
    b.title = '마우스로 공간 · 구조물을 만들고 경로 기록을 겹쳐 보기';
    b.textContent = '🗺 공간 · 경로';
    b.onclick = () => open();
    bar.insertBefore(b, bar.querySelector('.view-switch'));
  }
  // 본문의 <div class="pm-launch"></div> 자리에 여는 버튼 넣기
  function fillLaunchers() {
    document.querySelectorAll('.pm-launch:not(.ready)').forEach((el) => {
      el.classList.add('ready');
      el.innerHTML = '<button class="btn primary">🗺 공간 설계 창 열기</button><button class="btn ghost" data-src="before">예시: 개선 전 경로로 열기</button><button class="btn ghost" data-src="board">예시: 실제 보드 경로로 열기</button>';
      el.querySelectorAll('button').forEach((b) => { b.onclick = () => open(b.dataset.src); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMenu); else addMenu();
  document.addEventListener('lb:render', () => { addMenu(); setTimeout(fillLaunchers, 0); });
  setTimeout(fillLaunchers, 0);
})();
