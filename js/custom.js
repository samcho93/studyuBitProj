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
