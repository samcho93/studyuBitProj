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

  window.RunViewer = { open, close, parse: parseLog, fromSim };

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

/* ── 웹 지도 (ch07 · ch08) ──────────────────────────────────────────────
 * 문자 지도(도면) 위에 경로 기록(x · y 열, cm)을 겹쳐 그립니다.
 * 계획 경로(초록 점선) · 추정 경로(선 + 걸음 점) · 벽 통과 걸음(빨간 X) · 끝점 오차 · ▶ 재생.
 * 열기: 위쪽 막대의 [🗺 웹 지도] 메뉴, 또는 본문의 <div class="wm-launch"></div> 자리 버튼.
 */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => (window.app && app.toast ? app.toast(m) : alert(m));
  const KEY = 'mb-webmap';
  const CELL = 100;   // 1칸 = 100cm
  const COLORS = ['var(--accent)', 'var(--warn)', 'var(--more)', 'var(--accent2)'];

  // ch08 의 교실 · 계획 경로 · 세 기록 (본문 예제와 같은 값)
  const SAMPLE_ROOM = ['##########', '#...BB...#', '#W.......#', '#W..P....#', '#W.......#', '#.......SD', '##########'];
  const SAMPLE_PLAN = [[0, 0], [0, 400], [-600, 400], [-600, 200], [-700, 200]];
  const SAMPLES = {
    before: ['예시: 개선 전', [[-12, 66], [-26, 132], [-33, 198], [-48, 263], [-57, 330], [-69, 396], [-84, 461], [-150, 452], [-215, 436], [-281, 425], [-346, 410], [-412, 395], [-478, 384], [-545, 380], [-610, 365], [-676, 352], [-742, 345], [-739, 278], [-731, 211], [-720, 145], [-718, 78], [-783, 63], [-850, 59]]],
    board: ['예시: 실제 보드', [[0, 60], [0, 120], [3, 180], [3, 240], [3, 300], [4, 360], [1, 420], [-59, 420], [-119, 421], [-179, 423], [-226, 386], [-274, 350], [-321, 313], [-372, 280], [-422, 248], [-482, 243], [-486, 184], [-490, 124], [-491, 64], [-492, 4], [-552, 1], [-612, -4]]],
    after: ['예시: 개선 후', [[1, 58], [2, 116], [4, 174], [7, 232], [8, 290], [11, 348], [8, 406], [-50, 406], [-108, 409], [-166, 410], [-224, 412], [-282, 410], [-340, 410], [-398, 408], [-456, 408], [-514, 408], [-572, 405], [-570, 347], [-569, 289], [-571, 231], [-573, 173], [-631, 171], [-689, 173]]]
  };

  // 파이썬 round() 와 같게 (.5 는 짝수 쪽으로) — 본문의 to_cell() 과 칸이 똑같이 나오도록
  const pyRound = (v) => { const f = Math.floor(v), d = v - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };

  /* ── 도면 (문자 지도) ── */
  function findS(room) {
    for (let r = 0; r < room.length; r++) { const c = room[r].indexOf('S'); if (c >= 0) return [c, r]; }
    return null;
  }
  // 글자 지도 읽기: 파이썬 ROOM = ["...", ...] 모양이면 따옴표 안만, 아니면 줄마다
  function parseRoom(text) {
    text = String(text).replace(/\r/g, '');
    const q = text.match(/"([^"\n]+)"|'([^'\n]+)'/g);
    let rows = q && q.length > 1 ? q.map((s) => s.slice(1, -1)) : text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    rows = rows.filter((l) => !/\s/.test(l) && l.length <= 80);
    return rows.length && findS(rows) ? rows : null;
  }

  function loadSaved() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.room) && findS(s.room)) return s; } catch (e) { /* 저장된 것 없음 */ }
    return { room: SAMPLE_ROOM.slice(), plan: SAMPLE_PLAN.map((p) => p.slice()) };
  }
  const saved = loadSaved();
  const st = { room: saved.room, plan: saved.plan && saved.plan.length ? saved.plan : [[0, 0]], recs: [], upto: 0, dots: true, showPlan: true, edit: false, timer: null };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ room: st.room, plan: st.plan })); } catch (e) { /* 저장 안 됨 */ } };

  const charAt = (c, r) => (r >= 0 && r < st.room.length && c >= 0 && c < st.room[r].length ? st.room[r][c] : '#');
  const toCell = (x, y) => { const [SC, SR] = findS(st.room); return [SC + pyRound(x / CELL), SR - pyRound(y / CELL)]; };
  const isWall = (x, y) => '#P'.includes(charAt(...toCell(x, y)));

  /* ── 기록 (x · y 열이 있는 묶음) ── */
  function recordsFrom(sets) {
    const out = [];
    sets.forEach((ds) => {
      const ix = ds.head.findIndex((h) => /^x$/i.test(h.trim())), iy = ds.head.findIndex((h) => /^y$/i.test(h.trim()));
      if (ix < 0 || iy < 0) return;
      const ifx = ds.head.findIndex((h) => /^fix$/i.test(h.trim()));
      const pts = ds.rows.filter((r) => r[ix] != null && r[iy] != null).map((r) => [r[ix], r[iy], ifx >= 0 ? r[ifx] || 0 : 0]);
      // 첫 줄이 (0, 0) 출발점이면 걸음이 아니므로 뺌
      if (pts.length && pts[0][0] === 0 && pts[0][1] === 0) pts.shift();
      if (pts.length) out.push({ name: ds.name, pts });
    });
    return out;
  }
  const maxLen = () => st.recs.reduce((m, r) => Math.max(m, r.pts.length), 0);
  function addRecs(recs) {
    stop();
    recs.forEach((r) => { st.recs.push(r); });
    while (st.recs.length > COLORS.length) st.recs.shift();
    st.upto = maxLen(); render();
  }

  function analyse(rec) {
    const shown = rec.pts.slice(0, st.upto);
    let len = 0, px = 0, py = 0;
    shown.forEach(([x, y]) => { len += Math.hypot(x - px, y - py); px = x; py = y; });
    const walls = [];
    shown.forEach(([x, y], i) => { if (isWall(x, y)) walls.push(i + 1); });
    const end = shown[shown.length - 1], pe = st.plan[st.plan.length - 1];
    const err = end && st.plan.length > 1 ? Math.round(Math.hypot(end[0] - pe[0], end[1] - pe[1])) : null;
    return { n: shown.length, len, end, err, walls };
  }

  /* ── 그리기 ── */
  const PAD = 24;
  function geom() {
    const rows = st.room.length, cols = Math.max(...st.room.map((l) => l.length));
    const s = Math.min(64, 680 / cols, 440 / rows);
    const [SC, SR] = findS(st.room);
    return { s, rows, cols, W: cols * s + PAD * 2, H: rows * s + PAD * 2, px: (x) => PAD + (SC + x / CELL + 0.5) * s, py: (y) => PAD + (SR - y / CELL + 0.5) * s };
  }
  const CELL_STYLE = {
    '#': ['var(--fg)', 0.75], 'P': ['var(--muted)', 0.8], 'D': ['var(--ok)', 0.35],
    'B': ['var(--accent2)', 0.22], 'W': ['var(--accent2)', 0.22], 'G': ['var(--danger)', 0.2]
  };
  function mapSvg() {
    const g = geom(), s = g.s;
    let h = '';
    st.room.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const ch = line[c], x = PAD + c * s, y = PAD + r * s, sty = CELL_STYLE[ch];
        h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${sty ? sty[0] : 'var(--card)'}" fill-opacity="${sty ? sty[1] : 1}" stroke="var(--line)"/>`;
        if (ch !== '#' && ch !== '.' && ch !== 'S') h += `<text x="${x + s / 2}" y="${y + s / 2 + 5}" text-anchor="middle" font-size="${Math.round(s * 0.36)}" fill="var(--fg)">${esc(ch)}</text>`;
      }
    });
    const line = (pts) => pts.map(([x, y]) => g.px(x).toFixed(1) + ',' + g.py(y).toFixed(1)).join(' ');
    // 계획 경로
    if (st.showPlan && st.plan.length > 1) {
      h += `<polyline points="${line(st.plan)}" fill="none" stroke="var(--ok)" stroke-width="4" stroke-dasharray="10 7" stroke-linejoin="round"/>`;
      h += st.plan.slice(1).map(([x, y]) => `<circle cx="${g.px(x)}" cy="${g.py(y)}" r="4" fill="var(--ok)"/>`).join('');
    }
    // 추정 경로들
    st.recs.forEach((rec, k) => {
      const c = COLORS[k], shown = rec.pts.slice(0, st.upto);
      if (!shown.length) return;
      h += `<polyline points="${line([[0, 0]].concat(shown))}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`;
      shown.forEach(([x, y, fix], i) => {
        const X = g.px(x), Y = g.py(y), tip = `<title>${esc(rec.name)} · ${i + 1}걸음째 (${x}, ${y})</title>`;
        if (isWall(x, y)) h += `<g stroke="var(--danger)" stroke-width="3.5">${tip}<line x1="${X - 7}" y1="${Y - 7}" x2="${X + 7}" y2="${Y + 7}"/><line x1="${X - 7}" y1="${Y + 7}" x2="${X + 7}" y2="${Y - 7}"/></g>`;
        else if (st.dots) h += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="4" fill="${c}">${tip}</circle>`;
        if (fix) h += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="9" fill="none" stroke="${c}" stroke-width="2.5">${tip}</circle>`;
      });
      // 끝점 오차 (끝까지 재생했을 때만)
      const a = analyse(rec);
      if (a.err != null && st.upto >= rec.pts.length) {
        const pe = st.plan[st.plan.length - 1];
        h += `<line x1="${g.px(pe[0])}" y1="${g.py(pe[1])}" x2="${g.px(a.end[0])}" y2="${g.py(a.end[1])}" stroke="var(--danger)" stroke-width="2.5" stroke-dasharray="4 4"/>`;
      }
      const last = shown[shown.length - 1];
      h += `<circle cx="${g.px(last[0])}" cy="${g.py(last[1])}" r="7" fill="none" stroke="${c}" stroke-width="3"/>`;
    });
    // 시작점 S
    h += `<circle cx="${g.px(0)}" cy="${g.py(0)}" r="${Math.max(9, g.s * 0.3)}" fill="var(--ok)"/><text x="${g.px(0)}" y="${g.py(0) + 6}" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">S</text>`;
    return `<svg class="rv-svg wm-svg${st.edit ? ' editing' : ''}" viewBox="0 0 ${g.W} ${g.H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${h}</svg>`;
  }

  /* ── 화면 (모달) ── */
  let modal = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rv-modal hidden';
    modal.innerHTML = `<div class="rv-box" role="dialog" aria-label="웹 지도">
      <div class="rv-head"><b>🗺 웹 지도</b><span class="rv-sub">도면 위에 계획 경로 · 추정 경로를 겹쳐 보기 (1칸 = 1m)</span><span class="spacer"></span><button class="icon-btn rv-close" title="닫기 (Esc)">✕</button></div>
      <div class="rv-load">
        <label class="btn small ghost" title="문자 지도 글자 파일 (room.txt) — ROOM = [...] 파이썬 코드가 든 파일도 됩니다">📂 도면 불러오기<input type="file" class="wm-room-file" accept=".txt,.py" hidden></label>
        <label class="btn small primary">📂 기록 불러오기 (MY_DATA.HTM · CSV)<input type="file" class="wm-rec-file" accept=".htm,.html,.csv,.txt" hidden></label>
        <button class="btn small ghost" data-src="sim">📊 시뮬레이터 기록</button>
        <select class="rv-set wm-sample" title="ch08 예시 기록"><option value="">예시 기록 ▾</option>${Object.keys(SAMPLES).map((k) => `<option value="${k}">${SAMPLES[k][0]}</option>`).join('')}</select>
        <button class="btn small ghost wm-clear" title="불러온 기록 모두 지우기">기록 지우기</button>
      </div>
      <div class="rv-load wm-ctrl">
        <button class="btn small primary wm-play">▶ 재생</button>
        <input type="range" class="wm-range" min="0" value="0">
        <span class="wm-step muted"></span>
        <label class="rv-chk"><input type="checkbox" class="wm-dots">걸음 점</label>
        <label class="rv-chk"><input type="checkbox" class="wm-plan">계획 경로</label>
        <button class="btn small ghost wm-edit" title="지도 칸을 눌러 계획 경로의 꺾이는 점을 차례로 찍습니다">✏ 계획 경로 찍기</button>
        <button class="btn small ghost wm-plan-undo" title="계획 경로의 마지막 점 지우기">↶</button>
        <button class="btn small ghost wm-plan-clear">계획 지우기</button>
      </div>
      <div class="wm-main">
        <div class="wm-map"></div>
        <div class="wm-side">
          <div class="wm-legend">
            <div><i class="ln plan"></i>계획 경로 (걸으려던 길)</div>
            <div><i class="ln"></i>추정 경로 · 점 = 한 걸음</div>
            <div><b class="x">✕</b>벽 · 기둥 칸에 찍힌 걸음</div>
            <div><i class="ln err"></i>끝점 오차 (계획 끝 ↔ 추정 끝)</div>
            <div><b class="ring">◯</b>랜드마크로 바로잡은 걸음 (fix = 1)</div>
          </div>
          <details class="wm-roomed"><summary>✏ 도면 글자로 고치기</summary>
            <p class="rv-note"># 벽 · . 바닥 · D 문 · P 기둥 · S 시작점 · B · W 랜드마크 — 한 글자 = 1m</p>
            <textarea class="wm-text" rows="9" spellcheck="false"></textarea>
            <div class="rv-load"><button class="btn small primary wm-apply">적용</button><button class="btn small ghost wm-sroom">예시 교실</button><button class="btn small ghost wm-save">💾 room.txt 저장</button></div>
          </details>
        </div>
      </div>
      <div class="wm-result"></div>
    </div>`;
    document.body.appendChild(modal);
    const $ = (s) => modal.querySelector(s);
    $('.rv-close').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    $('.wm-room-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readText(f, (t) => loadRoomText(t, f.name)); };
    $('.wm-rec-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readText(f, (t) => loadRecText(t, f.name)); };
    $('[data-src=sim]').onclick = () => load('sim');
    $('.wm-sample').onchange = (e) => { if (e.target.value) load(e.target.value); e.target.value = ''; };
    $('.wm-clear').onclick = () => { stop(); st.recs = []; st.upto = 0; render(); };
    $('.wm-play').onclick = () => (st.timer ? stop() : play());
    $('.wm-range').oninput = (e) => { stop(); st.upto = +e.target.value; render(); };
    $('.wm-dots').onchange = (e) => { st.dots = e.target.checked; render(); };
    $('.wm-plan').onchange = (e) => { st.showPlan = e.target.checked; render(); };
    $('.wm-edit').onclick = () => { st.edit = !st.edit; if (st.edit) st.showPlan = true; render(); };
    $('.wm-plan-undo').onclick = () => { if (st.plan.length > 1) st.plan.pop(); persist(); render(); };
    $('.wm-plan-clear').onclick = () => { st.plan = [[0, 0]]; persist(); render(); };
    $('.wm-apply').onclick = () => loadRoomText($('.wm-text').value, '입력한 도면');
    $('.wm-sroom').onclick = () => { st.room = SAMPLE_ROOM.slice(); st.plan = SAMPLE_PLAN.map((p) => p.slice()); persist(); render(); };
    $('.wm-save').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([st.room.join('\n') + '\n'], { type: 'text/plain' }));
      a.download = 'room.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('.wm-map').addEventListener('click', onMapClick);
    const box = $('.rv-box');
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (e) => {
      e.preventDefault(); box.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) readText(f, (t) => { if (!loadRecText(t, f.name, true)) loadRoomText(t, f.name); });
    });
    return modal;
  }
  function readText(f, cb) { const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsText(f); }
  function loadRoomText(text, name) {
    const room = parseRoom(text);
    if (!room) { toast(name + ' 에서 시작점 S 가 있는 문자 지도를 찾지 못했습니다.'); return false; }
    st.room = room; persist(); render();
    toast(name + ' — 도면 ' + Math.max(...room.map((l) => l.length)) + ' × ' + room.length + '칸을 불러왔습니다.');
    return true;
  }
  function loadRecText(text, name, quiet) {
    const recs = window.RunViewer ? recordsFrom(RunViewer.parse(text, name)) : [];
    if (!recs.length) { if (!quiet) toast(name + ' 에서 x · y 열이 있는 기록을 찾지 못했습니다.'); return false; }
    addRecs(recs);
    toast(name + ' — 기록 ' + recs.length + '개 (' + recs.map((r) => r.pts.length + '걸음').join(', ') + ')');
    return true;
  }
  function load(src) {
    if (SAMPLES[src]) {
      // 예시 기록은 ch08 교실에서 계획 경로를 걸은 것
      if (st.room.join('\n') !== SAMPLE_ROOM.join('\n')) st.room = SAMPLE_ROOM.slice();
      if (st.plan.length < 2) st.plan = SAMPLE_PLAN.map((p) => p.slice());
      persist();
      addRecs([{ name: SAMPLES[src][0], pts: SAMPLES[src][1].map((p) => [p[0], p[1], 0]) }]);
    } else if (src === 'sim') {
      const ds = window.RunViewer && RunViewer.fromSim();
      const recs = ds ? recordsFrom([ds]) : [];
      if (recs.length) addRecs(recs);
      else toast('시뮬레이터 📊 로그에 x · y 기록이 없습니다. 먼저 경로 기록기(예제 7-15 · 8-16)를 실행해 걸어 보세요.');
    }
  }
  function onMapClick(e) {
    if (!st.edit) return;
    const svg = modal.querySelector('.wm-svg'); if (!svg) return;
    const g = geom(), b = svg.getBoundingClientRect();
    const mx = (e.clientX - b.left) * g.W / b.width, my = (e.clientY - b.top) * g.H / b.height;
    const c = Math.floor((mx - PAD) / g.s), r = Math.floor((my - PAD) / g.s);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return;
    const [SC, SR] = findS(st.room);
    st.plan.push([(c - SC) * CELL, (SR - r) * CELL]); persist(); render();
  }
  function play() {
    const n = maxLen(); if (!n) return;
    if (st.upto >= n) st.upto = 0;
    st.timer = setInterval(() => { st.upto++; if (st.upto >= maxLen()) stop(); else render(); }, 300);
    render();
  }
  function stop() { if (st.timer) { clearInterval(st.timer); st.timer = null; } if (modal) render(); }

  function open(src) {
    ensureModal().classList.remove('hidden');
    if (src) load(src); else render();
  }
  function close() { st.edit = false; stop(); if (modal) modal.classList.add('hidden'); }

  function render() {
    if (!modal) return;
    const $ = (s) => modal.querySelector(s), n = maxLen();
    $('.wm-map').innerHTML = mapSvg();
    $('.wm-range').max = n; $('.wm-range').value = st.upto; $('.wm-range').disabled = !n;
    $('.wm-step').textContent = n ? st.upto + ' / ' + n + ' 걸음' : '';
    $('.wm-play').textContent = st.timer ? '⏸ 멈춤' : '▶ 재생';
    $('.wm-play').disabled = !n;
    $('.wm-dots').checked = st.dots; $('.wm-plan').checked = st.showPlan;
    $('.wm-edit').classList.toggle('primary', st.edit); $('.wm-edit').classList.toggle('ghost', !st.edit);
    $('.wm-edit').textContent = st.edit ? '✔ 찍기 끝' : '✏ 계획 경로 찍기';
    const ta = $('.wm-text'); if (document.activeElement !== ta) ta.value = st.room.join('\n');
    if (!st.recs.length) {
      $('.wm-result').innerHTML = `<div class="rv-drop">${st.edit ? '지도 칸을 차례로 누르면 S 에서부터 계획 경로가 이어집니다.<br>' : ''}<b>📂 기록 불러오기</b>로 MY_DATA.HTM · path.csv 를 열거나, 여기에 파일을 끌어 놓으세요. 기록에 <code>x</code> · <code>y</code> 열(cm)이 있어야 합니다.<br>먼저 둘러보려면 <b>예시 기록 ▾</b> 에서 하나를 고르세요.</div>`;
      return;
    }
    const m = (v) => (v / 100).toFixed(1) + 'm';
    $('.wm-result').innerHTML = `<div class="rv-table"><table><thead><tr><th>기록</th><th>걸음 수</th><th>걸은 길</th><th>끝점 (x, y)</th><th>끝점 오차</th><th>벽 통과 걸음</th></tr></thead><tbody>${st.recs.map((rec, k) => {
      const a = analyse(rec);
      return `<tr><th><i class="wm-sw" style="background:${COLORS[k]}"></i>${esc(rec.name)}</th><td>${a.n}</td><td>${m(a.len)}</td><td>${a.end ? '(' + Math.round(a.end[0]) + ', ' + Math.round(a.end[1]) + ')' : ''}</td><td>${a.err == null ? '<span class="muted">계획 없음</span>' : a.err + 'cm'}</td><td>${a.walls.length ? `<b style="color:var(--danger)">${a.walls.length}</b> <span class="muted">(${a.walls.join(', ')}걸음째)</span>` : '0'}</td></tr>`;
    }).join('')}</tbody></table></div><p class="rv-note">끝점 오차는 계획 경로의 마지막 점과 추정 경로의 마지막 점 사이의 직선 거리입니다. 벽 통과 걸음은 본문의 <code>to_cell()</code> · <code>is_wall()</code> 과 같은 계산으로 찾습니다.</p>`;
  }

  window.WebMap = { open, close };

  // 위쪽 막대 메뉴 [🗺 웹 지도]
  function addMenu() {
    const bar = document.querySelector('#center .topbar');
    if (!bar || bar.querySelector('.wm-menu')) return;
    const b = document.createElement('button');
    b.className = 'btn ghost small wm-menu';
    b.title = '도면 위에 경로 기록(MY_DATA.HTM · CSV)을 겹쳐 보기';
    b.textContent = '🗺 웹 지도';
    b.onclick = () => open();
    bar.insertBefore(b, bar.querySelector('.view-switch'));
  }
  // 본문의 <div class="wm-launch"></div> 자리에 여는 버튼 넣기
  function fillLaunchers() {
    document.querySelectorAll('.wm-launch:not(.ready)').forEach((el) => {
      el.classList.add('ready');
      el.innerHTML = '<button class="btn primary">🗺 웹 지도 열기</button><button class="btn ghost" data-src="before">예시: 개선 전 기록으로 보기</button>';
      el.querySelectorAll('button').forEach((b) => { b.onclick = () => open(b.dataset.src); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMenu); else addMenu();
  document.addEventListener('lb:render', () => { addMenu(); setTimeout(fillLaunchers, 0); });
  setTimeout(fillLaunchers, 0);
})();

/* ── 블록 코딩 (MakeCode 호환) ─────────────────────────────────────────
 * 열기: 본문 예제의 [🧩 블록] 버튼 · 아래 편집기의 [🧩 블록으로] · 위쪽 막대의 [🧩 블록 코딩] 메뉴.
 * - 파이썬 예제를 makecode.microbit.org 와 같은 분류 · 색 · 이름의 블록으로 바꿔 보여 줍니다.
 *   (파이썬 문법은 시뮬레이터용 Pyodide 의 ast 모듈로 읽습니다. 블록으로 바꿀 수 없는 줄은 회색 '파이썬' 블록으로 남깁니다.)
 * - ▶ 실행: 블록 → MicroPython 으로 바꿔 오른쪽 시뮬레이터(🔌 보드를 골랐으면 실제 보드)에서 실행합니다.
 * - 💾 MakeCode 파일: 블록 → MakeCode JavaScript(main.ts)를 담은 .mkcd 파일. makecode.microbit.org 의 [가져오기]로 열면 블록으로 보입니다.
 * 순서: 블록 정의 → 생성기(MicroPython / MakeCode JavaScript) → 파이썬 → 블록 변환기 → 화면.
 */
(function () {
  'use strict';

  const BL = 'https://cdn.jsdelivr.net/npm/blockly@11.2.1/';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => { if (window.app && app.toast) app.toast(m); };

  // MakeCode 와 같은 분류 색
  const C = {
    basic: '#1E90FF', input: '#D400D4', music: '#E63022', led: '#5C2D91', images: '#7600A8', loops: '#00AA00', logic: '#00A4A6',
    vars: '#DC143C', math: '#9400D3', fn: '#3455DB', arrays: '#FF8F08', text: '#B8860B', serial: '#002050', dl: '#378273', py: '#8A8A8A'
  };

  // [MicroPython 이름, MakeCode IconNames, 한국어, 5×5 무늬]
  const ICONS = [
    ['HEART', 'Heart', '하트', '09090:99999:99999:09990:00900'], ['HEART_SMALL', 'SmallHeart', '작은 하트', '00000:09090:09990:00900:00000'],
    ['YES', 'Yes', '체크', '00000:00009:00090:90900:09000'], ['NO', 'No', '엑스', '90009:09090:00900:09090:90009'],
    ['HAPPY', 'Happy', '웃는 얼굴', '00000:09090:00000:90009:09990'], ['SAD', 'Sad', '슬픈 얼굴', '00000:09090:00000:09990:90009'],
    ['CONFUSED', 'Confused', '헷갈림', '00000:09090:00000:09090:90909'], ['ANGRY', 'Angry', '화남', '90009:09090:00000:99999:90909'],
    ['ASLEEP', 'Asleep', '잠', '00000:99099:00000:09990:00000'], ['SURPRISED', 'Surprised', '놀람', '09090:00000:00900:09090:00900'],
    ['SILLY', 'Silly', '장난', '90009:00000:99999:00909:00999'], ['FABULOUS', 'Fabulous', '멋짐', '99999:99099:00000:09090:09990'],
    ['MEH', 'Meh', '시큰둥', '09090:00000:00090:00900:09000'], ['TSHIRT', 'TShirt', '티셔츠', '99099:99999:09990:09990:09990'],
    ['ROLLERSKATE', 'Rollerskate', '롤러스케이트', '00099:00099:99999:99999:09090'], ['DUCK', 'Duck', '오리', '09900:99900:09999:09990:00000'],
    ['HOUSE', 'House', '집', '00900:09990:99999:09990:09090'], ['TORTOISE', 'Tortoise', '거북이', '00000:09990:99999:09090:00000'],
    ['BUTTERFLY', 'Butterfly', '나비', '99099:99999:00900:99999:99099'], ['STICKFIGURE', 'StickFigure', '사람', '00900:99999:00900:09090:90009'],
    ['GHOST', 'Ghost', '유령', '99999:90909:99999:99999:90909'], ['SWORD', 'Sword', '칼', '00900:00900:00900:09990:00900'],
    ['GIRAFFE', 'Giraffe', '기린', '99000:09000:09000:09990:09090'], ['SKULL', 'Skull', '해골', '09990:90909:99999:09990:09990'],
    ['UMBRELLA', 'Umbrella', '우산', '09990:99999:00900:90900:09900'], ['SNAKE', 'Snake', '뱀', '99000:99099:09090:09990:00000'],
    ['RABBIT', 'Rabbit', '토끼', '90900:90900:99990:99090:99990'], ['COW', 'Cow', '소', '90009:90009:99999:09990:00900'],
    ['MUSIC_CROTCHET', 'QuarterNote', '4분음표', '00900:00900:00900:99900:99900'], ['MUSIC_QUAVER', 'EighthNote', '8분음표', '00900:00990:00909:99900:99900'],
    ['PITCHFORK', 'Pitchfork', '쇠스랑', '90909:90909:99999:00900:00900'], ['TARGET', 'Target', '과녁', '00900:09990:99099:09990:00900'],
    ['TRIANGLE', 'Triangle', '삼각형', '00000:00900:09090:99999:00000'], ['TRIANGLE_LEFT', 'LeftTriangle', '왼쪽 삼각형', '90000:99000:90900:90090:99999'],
    ['CHESSBOARD', 'Chessboard', '체스판', '09090:90909:09090:90909:09090'], ['DIAMOND', 'Diamond', '다이아몬드', '00900:09090:90009:09090:00900'],
    ['DIAMOND_SMALL', 'SmallDiamond', '작은 다이아몬드', '00000:00900:09090:00900:00000'], ['SQUARE', 'Square', '사각형', '99999:90009:90009:90009:99999'],
    ['SQUARE_SMALL', 'SmallSquare', '작은 사각형', '00000:09990:09090:09990:00000'], ['SCISSORS', 'Scissors', '가위', '99009:99090:00900:99090:99009']
  ];
  const ARROWS = [
    ['N', 'North', '북쪽', '00900:09990:90909:00900:00900'], ['NE', 'NorthEast', '북동쪽', '00999:00099:00909:09000:90000'],
    ['E', 'East', '동쪽', '00900:00090:99999:00090:00900'], ['SE', 'SouthEast', '남동쪽', '90000:09000:00909:00099:00999'],
    ['S', 'South', '남쪽', '00900:00900:90909:09990:00900'], ['SW', 'SouthWest', '남서쪽', '00009:00090:90900:99000:99900'],
    ['W', 'West', '서쪽', '00900:09000:99999:09000:00900'], ['NW', 'NorthWest', '북서쪽', '99900:99000:90900:00090:00009']
  ];
  const ICON_BY = Object.fromEntries(ICONS.map((i) => [i[0], i]));
  const ARROW_BY = Object.fromEntries(ARROWS.map((a) => [a[0], a]));
  // [한국어, MicroPython 이름, MakeCode Gesture]
  const GESTURES = [
    ['흔들림', 'shake', 'Shake'], ['로고 위쪽', 'up', 'LogoUp'], ['로고 아래쪽', 'down', 'LogoDown'], ['화면 위쪽', 'face up', 'ScreenUp'],
    ['화면 아래쪽', 'face down', 'ScreenDown'], ['왼쪽 기울임', 'left', 'TiltLeft'], ['오른쪽 기울임', 'right', 'TiltRight'],
    ['떨어짐', 'freefall', 'FreeFall'], ['3g', '3g', 'ThreeG'], ['6g', '6g', 'SixG'], ['8g', '8g', 'EightG']
  ];
  const GESTURE_BY = Object.fromEntries(GESTURES.map((g) => [g[1], g]));

  // 5×5 무늬 → 드롭다운 그림 (data URI)
  function ledUri(pat, px) {
    const rows = pat.split(':');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 50 50"><rect width="50" height="50" rx="5" fill="#222"/>`;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) s += `<rect x="${3 + c * 9.4}" y="${3 + r * 9.4}" width="7" height="7" rx="1.5" fill="${rows[r][c] !== '0' ? '#ff2d1a' : '#4a4a4a'}"/>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s + '</svg>');
  }
  const iconOptions = () => ICONS.map((i) => [{ src: ledUri(i[3], 30), width: 30, height: 30, alt: i[2] }, i[0]]);
  const arrowOptions = () => ARROWS.map((a) => [{ src: ledUri(a[3], 30), width: 30, height: 30, alt: a[2] }, a[0]]);

  /* ── 블록 정의 ── */
  const V = (name) => ({ type: 'input_value', name });
  const DD = (name, options) => ({ type: 'field_dropdown', name, options });
  const S = (type, colour, msg, args, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], previousStatement: null, nextStatement: null, inputsInline: true }, extra);
  const E = (type, colour, msg, args, output, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], output: output === undefined ? null : output, inputsInline: true }, extra);
  const H = (type, colour, msg, args, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] }, extra);
  const BTN = () => DD('BTN', [['A', 'A'], ['B', 'B'], ['A+B', 'AB']]);
  const MODE = () => DD('MODE', [['끝날 때까지', 'wait'], ['백그라운드로', 'bg']]);
  const GEST = () => DD('G', GESTURES.map((g) => [g[0], g[1]]));

  let defined = false;
  function defineBlocks() {
    if (defined) return;
    defined = true;
    const Bk = Blockly;
    Bk.common.defineBlocksWithJsonArray([
      // 기본
      H('mb_on_start', C.basic, '시작하면 실행', [], { tooltip: '프로그램이 시작될 때 한 번 실행합니다.' }),
      H('mb_forever', C.basic, '무한반복 실행', [], { tooltip: '안의 블록을 계속 되풀이합니다.' }),
      S('mb_show_number', C.basic, '수 출력 %1', [V('NUM')], { tooltip: 'LED 화면에 수를 보입니다 (두 자리 이상은 흘러갑니다).' }),
      S('mb_show_string', C.basic, '문자열 출력 %1', [V('TEXT')], { tooltip: 'LED 화면에 글자를 보입니다 (두 글자 이상은 흘러갑니다).' }),
      S('mb_show_icon', C.basic, '아이콘 출력 %1', [DD('ICON', iconOptions())]),
      S('mb_show_arrow', C.basic, '화살표 출력 %1', [DD('DIR', arrowOptions())]),
      S('mb_clear', C.basic, 'LED 스크린 지우기'),
      S('mb_pause', C.basic, '일시중지 (ms) %1', [V('MS')]),
      // 입력
      H('mb_on_button', C.input, '%1 버튼 누르면 실행', [BTN()]),
      H('mb_on_gesture', C.input, '%1 감지하면 실행', [GEST()]),
      H('mb_on_logo', C.input, '로고 터치하면 실행'),
      E('mb_button_pressed', C.input, '%1 버튼 누름 상태', [BTN()], 'Boolean'),
      E('mb_logo_pressed', C.input, '로고 터치 상태', [], 'Boolean'),
      E('mb_is_gesture', C.input, '%1 감지 상태', [GEST()], 'Boolean'),
      E('mb_accel', C.input, '가속도 센서 값 (mg) %1', [DD('AXIS', [['x', 'x'], ['y', 'y'], ['z', 'z'], ['세기', 'strength']])], 'Number'),
      E('mb_compass', C.input, '나침반 방향 (°)', [], 'Number'),
      S('mb_calibrate', C.input, '나침반 보정하기'),
      E('mb_magnetic', C.input, '자기장 세기', [], 'Number', { tooltip: 'MicroPython 은 nT, MakeCode 는 µT 단위입니다.' }),
      E('mb_running_time', C.input, '동작 시간 (ms)', [], 'Number'),
      E('mb_temperature', C.input, '온도 (°C)', [], 'Number'),
      E('mb_light', C.input, '빛 센서 값', [], 'Number'),
      E('mb_sound', C.input, '소리 크기', [], 'Number'),
      // 음악
      S('mb_play_tone', C.music, '%1 Hz 소리를 %2 ms 동안 %3 재생', [V('FREQ'), V('MS'), MODE()]),
      S('mb_play_melody', C.music, '멜로디 %1 빠르기 %2 %3 재생', [{ type: 'field_input', name: 'MELODY', text: 'C5 E5 G5' }, V('BPM'), MODE()]),
      // LED
      S('mb_plot', C.led, 'LED 켜기 x %1 y %2', [V('X'), V('Y')]),
      S('mb_unplot', C.led, 'LED 끄기 x %1 y %2', [V('X'), V('Y')]),
      S('mb_plot_brightness', C.led, 'LED 켜기 x %1 y %2 밝기 %3', [V('X'), V('Y'), V('B')], { tooltip: '밝기 0~255 (MicroPython 의 0~9 로 바꿔 실행합니다).' }),
      E('mb_point', C.led, 'LED 밝기 x %1 y %2', [V('X'), V('Y')], 'Number'),
      // 이미지
      S('mb_show_image', C.images, '이미지 %1 출력', [V('IMG')]),
      E('mb_icon_image', C.images, '아이콘 이미지 %1', [DD('ICON', iconOptions())], 'Image'),
      E('mb_arrow_image', C.images, '화살표 이미지 %1', [DD('DIR', arrowOptions())], 'Image'),
      // 반복
      {
        type: 'mb_for_index', colour: C.loops, message0: '%1 값을 0 부터 %2 까지 1씩 늘리며 반복',
        args0: [{ type: 'field_variable', name: 'VAR', variable: 'index' }, V('TO')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
        previousStatement: null, nextStatement: null, inputsInline: true
      },
      // 계산
      E('mb_math_fn1', C.math, '%1 %2', [DD('OP', [['제곱근', 'sqrt'], ['절댓값', 'abs'], ['반올림', 'round'], ['내림', 'floor'], ['올림', 'ceil'], ['소수점 버림', 'trunc'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan']]), V('X')], 'Number'),
      E('mb_math_fn2', C.math, '%1 ( %2 , %3 )', [DD('OP', [['최솟값', 'min'], ['최댓값', 'max'], ['몫 (정수 나눗셈)', 'idiv'], ['atan2', 'atan2']]), V('A'), V('B')], 'Number'),
      E('mb_random', C.math, '%1 부터 %2 까지 정수 랜덤값', [V('A'), V('B')], 'Number'),
      E('mb_pi', C.math, 'π', [], 'Number'),
      // 텍스트
      E('mb_text_length', C.text, '%1 의 글자 수', [V('TEXT')], 'Number'),
      E('mb_to_text', C.text, '%1 을(를) 문자열로', [V('X')], 'String'),
      E('mb_text_index_of', C.text, '%1 에서 %2 의 위치', [V('TEXT'), V('SUB')], 'Number'),
      E('mb_text_char_at', C.text, '%1 의 %2 번째 글자', [V('TEXT'), V('I')], 'String'),
      E('mb_text_includes', C.text, '%1 에 %2 포함?', [V('TEXT'), V('SUB')], 'Boolean'),
      E('mb_parse_number', C.text, '%1 을(를) 수로', [V('TEXT')], 'Number'),
      // 배열
      E('mb_list_get', C.arrays, '%1 의 %2 번째 값', [V('LIST'), V('I')]),
      S('mb_list_set', C.arrays, '%1 의 %2 번째 값을 %3 (으)로 바꾸기', [V('LIST'), V('I'), V('VALUE')]),
      E('mb_list_length', C.arrays, '%1 의 길이', [V('LIST')], 'Number'),
      S('mb_list_push', C.arrays, '%1 의 끝에 %2 추가', [V('LIST'), V('VALUE')]),
      S('mb_list_remove_first', C.arrays, '%1 의 첫 번째 값 삭제', [V('LIST')]),
      S('mb_list_remove_last', C.arrays, '%1 의 마지막 값 삭제', [V('LIST')]),
      S('mb_list_remove_at', C.arrays, '%1 의 %2 번째 값 삭제', [V('LIST'), V('I')]),
      E('mb_list_shift', C.arrays, '%1 의 첫 번째 값 꺼내기', [V('LIST')]),
      E('mb_list_pop', C.arrays, '%1 의 마지막 값 꺼내기', [V('LIST')]),
      S('mb_list_insert', C.arrays, '%1 의 %2 번째에 %3 넣기', [V('LIST'), V('I'), V('VALUE')]),
      E('mb_list_index_of', C.arrays, '%1 에서 %2 의 위치', [V('LIST'), V('VALUE')], 'Number'),
      // 함수
      S('mb_fn_return', C.fn, '반환 %1', [V('VALUE')], { nextStatement: undefined }),
      // 시리얼 · 데이터 로거
      S('mb_serial_line', C.serial, '시리얼 출력 (한 줄) %1', [V('TEXT')], { tooltip: '콘솔에 한 줄 찍습니다 (MicroPython 의 print).' }),
      S('dl_set_columns', C.dl, '데이터 로거 열 이름 %1 시간 기록 %2', [{ type: 'field_input', name: 'COLS', text: 'time,steps' }, DD('TS', [['안 함', 'none'], ['초', 's'], ['밀리초', 'ms'], ['분', 'min']])], { tooltip: '열 이름은 쉼표로 나눠 씁니다.' }),
      S('dl_delete', C.dl, '데이터 로그 지우기')
    ]);

    // LED 출력 · 이미지 만들기 — 5×5 체크 칸
    const grid = (b) => { for (let r = 0; r < 5; r++) { const inp = b.appendDummyInput('R' + r); for (let c = 0; c < 5; c++) inp.appendField(new Bk.FieldCheckbox(false), 'L' + (r * 5 + c)); } };
    Bk.Blocks.mb_show_leds = {
      init() { this.appendDummyInput().appendField('LED 출력'); grid(this); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.basic); this.setTooltip('칸을 눌러 켤 LED 를 고릅니다.'); }
    };
    Bk.Blocks.mb_create_image = {
      init() { this.appendDummyInput().appendField('이미지 만들기'); grid(this); this.setOutput(true, 'Image'); this.setColour(C.images); }
    };

    // 회색 '파이썬' 블록 — 블록으로 바꿀 수 없는 코드를 그대로 담는다 (고치기는 파이썬 편집기에서)
    const rawLines = (b) => {
      for (let i = 0; b.getInput('C' + i); i++) b.removeInput('C' + i);
      String(b.code || '').split('\n').forEach((l, k) => b.appendDummyInput('C' + k).appendField(new Bk.FieldLabel(l.replace(/ /g, ' ') || ' ', 'bk-raw-line')));
    };
    Bk.Blocks.py_raw = {
      init() { this.code = ''; this.appendDummyInput('HEAD').appendField('파이썬'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.py); this.setTooltip('블록으로 바꿀 수 없는 파이썬 코드입니다. 실행할 때는 그대로 쓰이고, MakeCode 로 보낼 때는 주석으로 남습니다.'); },
      saveExtraState() { return { code: this.code }; },
      loadExtraState(s) { this.code = s.code || ''; rawLines(this); }
    };
    Bk.Blocks.py_raw_expr = {
      init() { this.code = ''; this.appendDummyInput('HEAD').appendField('파이썬'); this.setOutput(true); this.setInputsInline(true); this.setColour(C.py); this.setTooltip('블록으로 바꿀 수 없는 파이썬 식입니다.'); },
      saveExtraState() { return { code: this.code, t: this.hint }; },
      loadExtraState(s) { this.code = s.code || ''; this.hint = s.t || null; this.getInput('HEAD').appendField(new Bk.FieldLabel(this.code, 'bk-raw-line')); }
    };

    // 데이터 기록 — 열 개수를 + / − 로 바꾼다 (MakeCode 의 log data 블록과 같음)
    const pm = (d) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="#fff" fill-opacity=".85"/><path d="${d}" stroke="${C.dl}" stroke-width="2.5"/></svg>`);
    const PLUS = pm('M5 10h10M10 5v10'), MINUS = pm('M5 10h10');
    Bk.Blocks.dl_log = {
      init() { this.n = 0; this.appendDummyInput('HEAD').appendField('데이터 기록'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.dl); this.setInputsInline(false); this.setN(1); },
      saveExtraState() { return { n: this.n }; },
      loadExtraState(s) { this.setN(s.n || 1); },
      setN(n) {
        if (this.getInput('PM')) this.removeInput('PM');
        while (this.n < n) { const i = this.n++; this.appendValueInput('VAL' + i).appendField('열').appendField(new Bk.FieldTextInput('열' + (i + 1)), 'COL' + i).appendField('값'); }
        while (this.n > n) { this.n--; this.removeInput('VAL' + this.n); }
        const row = this.appendDummyInput('PM');
        row.appendField(new Bk.FieldImage(PLUS, 20, 20, '+', () => this.setN(this.n + 1)));
        if (this.n > 1) row.appendField(new Bk.FieldImage(MINUS, 20, 20, '-', () => this.setN(this.n - 1)));
      }
    };

    // 함수 정의 · 호출 (MakeCode 의 함수 블록처럼 매개변수 · 반환 블록을 쓴다)
    const identOk = (t) => { t = String(t).trim().replace(/\s+/g, '_'); return t && /^[A-Za-z_가-힣][\w가-힣]*$/.test(t) ? t : null; };
    Bk.Blocks.mb_fn_def = {
      init() {
        this.appendDummyInput('HEAD').appendField('함수').appendField(new Bk.FieldTextInput('함수이름', identOk), 'NAME')
          .appendField('(').appendField(new Bk.FieldTextInput('', (t) => String(t).split(',').map((p) => p.trim()).filter(identOk).join(', ')), 'PARAMS').appendField(')');
        this.appendStatementInput('DO');
        this.setColour(C.fn);
        this.setTooltip('괄호 안에는 매개변수 이름을 쉼표로 나눠 씁니다 (예: x, y). 매개변수는 변수 블록으로 꺼내 씁니다.');
      }
    };
    const callBlock = (out) => ({
      init() {
        this.params = [];
        this.appendDummyInput('HEAD').appendField('호출').appendField(new Bk.FieldLabelSerializable('함수이름'), 'NAME');
        if (out) this.setOutput(true); else { this.setPreviousStatement(true); this.setNextStatement(true); }
        this.setInputsInline(true); this.setColour(C.fn);
      },
      saveExtraState() { return { name: this.getFieldValue('NAME'), params: this.params.slice() }; },
      loadExtraState(s) { this.setFieldValue(s.name || '함수이름', 'NAME'); this.setParams(s.params || []); },
      setParams(ps) {
        if (ps.join(',') === this.params.join(',') && ps.every((_, i) => this.getInput('ARG' + i))) return;
        const keep = this.params.map((_, i) => { const inp = this.getInput('ARG' + i); const t = inp && inp.connection.targetBlock(); if (t) inp.connection.disconnect(); return t; });
        this.params.forEach((_, i) => { if (this.getInput('ARG' + i)) this.removeInput('ARG' + i); });
        ps.forEach((p, i) => { const inp = this.appendValueInput('ARG' + i).appendField(p); if (keep[i] && keep[i].outputConnection) inp.connection.connect(keep[i].outputConnection); });
        keep.slice(ps.length).forEach((t) => t && t.dispose(true));
        this.params = ps.slice();
      }
    });
    Bk.Blocks.mb_fn_call = callBlock(false);
    Bk.Blocks.mb_fn_call_expr = callBlock(true);
  }
  const fnParams = (b) => String(b.getFieldValue('PARAMS') || '').split(',').map((p) => p.trim()).filter(Boolean);

  // MakeCode 색 테마 (기본 블록 · 변수 · 목록 등)
  function theme() {
    const st = (c) => ({ colourPrimary: c });
    return Blockly.Theme.defineTheme('mb-makecode', {
      base: Blockly.Themes.Classic,
      blockStyles: {
        logic_blocks: st(C.logic), loop_blocks: st(C.loops), math_blocks: st(C.math), text_blocks: st(C.text),
        list_blocks: st(C.arrays), variable_blocks: st(C.vars), variable_dynamic_blocks: st(C.vars), procedure_blocks: st(C.fn)
      },
      componentStyles: { workspaceBackgroundColour: '#f3f6f9', toolboxBackgroundColour: '#ffffff', flyoutBackgroundColour: '#e6ebf0', flyoutOpacity: 1, scrollbarColour: '#c4cbd3' }
    });
  }

  /* ── 도구 상자 (MakeCode 와 같은 분류 · 순서) ── */
  const sh = (type, fields) => ({ shadow: { type, fields } });
  const N = (v) => sh('math_number', { NUM: v });
  const T = (v) => sh('text', { TEXT: v });
  const tb = (type, inputs, extra) => Object.assign({ kind: 'block', type }, inputs ? { inputs } : null, extra);
  function toolbox() {
    const cat = (name, colour, contents) => ({ kind: 'category', name, colour, contents });
    return {
      kind: 'categoryToolbox',
      contents: [
        cat('기본', C.basic, [tb('mb_on_start'), tb('mb_forever'), tb('mb_show_number', { NUM: N(0) }), tb('mb_show_string', { TEXT: T('Hello!') }),
          tb('mb_show_icon'), tb('mb_show_leds'), tb('mb_show_arrow'), tb('mb_clear'), tb('mb_pause', { MS: N(100) })]),
        cat('입력', C.input, [tb('mb_on_button'), tb('mb_on_gesture'), tb('mb_on_logo'), tb('mb_button_pressed'), tb('mb_logo_pressed'), tb('mb_is_gesture'),
          tb('mb_accel'), tb('mb_compass'), tb('mb_calibrate'), tb('mb_magnetic'), tb('mb_running_time'), tb('mb_temperature'), tb('mb_light'), tb('mb_sound')]),
        cat('음악', C.music, [tb('mb_play_tone', { FREQ: N(262), MS: N(500) }), tb('mb_play_melody', { BPM: N(120) })]),
        cat('LED', C.led, [tb('mb_plot', { X: N(0), Y: N(0) }), tb('mb_unplot', { X: N(0), Y: N(0) }), tb('mb_plot_brightness', { X: N(0), Y: N(0), B: N(255) }), tb('mb_point', { X: N(0), Y: N(0) })]),
        cat('반복', C.loops, [tb('controls_repeat_ext', { TIMES: N(4) }), tb('controls_whileUntil', { BOOL: sh('logic_boolean', { BOOL: 'TRUE' }) }),
          tb('mb_for_index', { TO: N(4) }), tb('controls_forEach'), tb('controls_flow_statements')]),
        cat('논리', C.logic, [tb('controls_if'), tb('controls_if', null, { extraState: { hasElse: true } }), tb('logic_compare', { A: N(0), B: N(0) }),
          tb('logic_operation'), tb('logic_negate'), tb('logic_boolean')]),
        { kind: 'category', name: '변수', colour: C.vars, custom: 'VARIABLE' },
        cat('계산', C.math, [tb('math_number'), tb('math_arithmetic', { A: N(0), B: N(0) }), tb('math_modulo', { DIVIDEND: N(0), DIVISOR: N(1) }),
          tb('mb_math_fn2', { A: N(0), B: N(0) }), tb('mb_math_fn1', { X: N(0) }), tb('mb_random', { A: N(0), B: N(10) }), tb('mb_pi')]),
        { kind: 'category', name: '함수', colour: C.fn, custom: 'MB_FUNCTIONS' },
        cat('배열', C.arrays, [tb('lists_create_with', { ADD0: N(1), ADD1: N(2) }, { extraState: { itemCount: 2 } }), tb('lists_create_with', null, { extraState: { itemCount: 0 } }),
          tb('mb_list_get', { I: N(0) }), tb('mb_list_set', { I: N(0) }), tb('mb_list_length'), tb('mb_list_push'), tb('mb_list_remove_first'), tb('mb_list_remove_last'),
          tb('mb_list_remove_at', { I: N(0) }), tb('mb_list_shift'), tb('mb_list_pop'), tb('mb_list_insert', { I: N(0) }), tb('mb_list_index_of')]),
        cat('텍스트', C.text, [tb('text'), tb('text_join', { ADD0: T('Hello'), ADD1: T('World') }, { extraState: { itemCount: 2 } }), tb('mb_text_length', { TEXT: T('Hello') }),
          tb('mb_to_text', { X: N(0) }), tb('mb_text_index_of', { TEXT: T('Hello'), SUB: T('l') }), tb('mb_text_char_at', { TEXT: T('Hello'), I: N(0) }),
          tb('mb_text_includes', { TEXT: T('Hello'), SUB: T('ell') }), tb('mb_parse_number', { TEXT: T('123') })]),
        { kind: 'sep' },
        cat('이미지', C.images, [tb('mb_show_image'), tb('mb_create_image'), tb('mb_icon_image'), tb('mb_arrow_image')]),
        cat('시리얼', C.serial, [tb('mb_serial_line', { TEXT: T('Hello') })]),
        cat('데이터 로거', C.dl, [tb('dl_set_columns'), tb('dl_log'), tb('dl_delete')])
      ]
    };
  }
  function functionsFlyout(ws) {
    const list = [{ kind: 'label', text: '함수를 만들고 호출합니다' }, tb('mb_fn_def'), tb('mb_fn_return')];
    ws.getBlocksByType('mb_fn_def', false).forEach((d) => {
      const st = { name: d.getFieldValue('NAME'), params: fnParams(d) };
      list.push(tb('mb_fn_call', null, { extraState: st }), tb('mb_fn_call_expr', null, { extraState: st }));
    });
    return list;
  }

  /* ── 생성기: 블록 → MicroPython (강좌 시뮬레이터 · 보드) / MakeCode JavaScript (main.ts) ── */
  const O = { ATOM: 0, MEMBER: 1, UNARY: 2, POW: 3, MUL: 4, ADD: 5, REL: 6, NOT: 7, AND: 8, OR: 9, NONE: 99 };
  const PY_RESERVED = new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is ' +
    'lambda nonlocal not or pass raise return try while with yield display button_a button_b accelerometer compass music math log random Image pin_logo ' +
    'microphone sleep running_time temperature print len str int float round abs min max range sum show_number show_string index_of').split(' '));
  const TS_RESERVED = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in ' +
    'instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public ' +
    'any number string boolean basic input music led images serial pins radio control game datalogger Math Image console randint').split(' '));
  const q = (s) => JSON.stringify(String(s));
  const leds = (b) => { const r = []; for (let i = 0; i < 5; i++) { let s = ''; for (let j = 0; j < 5; j++) s += b.getFieldValue('L' + (i * 5 + j)) === 'TRUE' ? '9' : '0'; r.push(s); } return r; };
  const tsLeds = (rows) => '`\n' + rows.map((r) => '        ' + r.split('').map((c) => (c === '0' ? '.' : '#')).join(' ')).join('\n') + '\n        `';
  const STMT_VARS = { variables_set: 1, math_change: 1 };
  const LOOP_VARS = { controls_forEach: 1, mb_for_index: 1 };
  const varOf = (b) => b.getField('VAR').getText();
  const topOf = (b) => { let t = b; while (t.getSurroundParent()) t = t.getSurroundParent(); return t; };

  // 변환기가 짐작한 파이썬 자료형(num · str · list<num> …) → TypeScript 형식 (모르면 null)
  const pyType = (t) => {
    if (!t) return null;
    const m = { num: 'number', str: 'string', bool: 'boolean', img: 'Image' }[t];
    if (m) return m;
    if (t.startsWith('list<')) { const e = pyType(t.slice(5, -1)); return e ? e + '[]' : null; }
    return null;
  };
  // 블록마다 값의 자료형을 짐작한다 (MakeCode JavaScript 의 let 선언 · 함수 매개변수 형식에 씀)
  function typer(ws) {
    const vt = new Map(), ft = new Map(), pt = new Map();
    const all = ws.getAllBlocks(false);
    const elem = (t) => (t && t.endsWith('[]') ? t.slice(0, -2) : null);
    // 모르면 null (함수의 반환 자료형처럼 나중에 알게 되는 것을 미리 '수'로 굳히지 않게)
    function Tq(b) {
      if (!b) return null;
      switch (b.type) {
        case 'text': case 'text_join': case 'mb_to_text': case 'mb_text_char_at': return 'string';
        case 'logic_compare': case 'logic_operation': case 'logic_negate': case 'logic_boolean': case 'mb_button_pressed': case 'mb_logo_pressed':
        case 'mb_is_gesture': case 'mb_text_includes': return 'boolean';
        case 'mb_create_image': case 'mb_icon_image': case 'mb_arrow_image': return 'Image';
        case 'lists_create_with': { const f = b.getInputTargetBlock('ADD0'); if (!f) return 'number[]'; const t = Tq(f); return t ? t + '[]' : null; }
        case 'mb_list_get': case 'mb_list_shift': case 'mb_list_pop': return elem(Tq(b.getInputTargetBlock('LIST')));
        case 'variables_get': {
          const n = varOf(b), top = topOf(b);
          if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) return pt.get(top.getFieldValue('NAME') + '.' + n) || null;
          return vt.get(n) || null;
        }
        case 'mb_fn_call_expr': return ft.get(b.getFieldValue('NAME')) || null;
        case 'py_raw_expr': return pyType(b.hint);
        default: return 'number';
      }
    }
    const T = (b) => Tq(b) || 'number';
    for (let pass = 0; pass < 3; pass++) {
      all.forEach((b) => {
        if (b.type === 'variables_set') {
          const n = varOf(b), v = b.getInputTargetBlock('VALUE');
          const empty = v && v.type === 'lists_create_with' && !v.getInputTargetBlock('ADD0');
          const t = Tq(v);
          if (!vt.has(n) && !empty && t) vt.set(n, t);
        } else if (b.type === 'mb_list_push' || b.type === 'mb_list_insert') {
          const l = b.getInputTargetBlock('LIST'), t = Tq(b.getInputTargetBlock('VALUE'));
          if (l && l.type === 'variables_get' && !vt.has(varOf(l)) && t) vt.set(varOf(l), t + '[]');
        } else if (b.type === 'controls_forEach') {
          const t = elem(Tq(b.getInputTargetBlock('LIST')));
          if (!vt.has(varOf(b)) && t) vt.set(varOf(b), t);
        } else if (b.type === 'mb_fn_call' || b.type === 'mb_fn_call_expr') {
          const fn = b.getFieldValue('NAME');
          (b.params || []).forEach((p, i) => { const t = Tq(b.getInputTargetBlock('ARG' + i)); if (t && !pt.has(fn + '.' + p)) pt.set(fn + '.' + p, t); });
        } else if (b.type === 'mb_fn_return') {
          const top = topOf(b), t = Tq(b.getInputTargetBlock('VALUE'));
          if (top.type === 'mb_fn_def' && t && !ft.has(top.getFieldValue('NAME'))) ft.set(top.getFieldValue('NAME'), t);
        }
      });
    }
    // 그래도 모르면 쓰임새로 짐작: 목록 블록의 '목록' 칸에 들어가면 배열, 글자 블록이면 문자열
    const LIST_IN = { mb_list_get: 1, mb_list_set: 1, mb_list_length: 1, mb_list_push: 1, mb_list_remove_first: 1, mb_list_remove_last: 1, mb_list_remove_at: 1, mb_list_shift: 1, mb_list_pop: 1, mb_list_insert: 1, mb_list_index_of: 1 };
    const usage = (vb) => {
      const p = vb.getParent(), inp = p && p.getInputWithBlock(vb);
      if (!inp) return null;
      if (LIST_IN[p.type] && inp.name === 'LIST') { if (p.type === 'mb_list_get') { const u = usage(p); return (u || 'number') + '[]'; } return 'number[]'; }
      if (p.type === 'controls_forEach' && inp.name === 'LIST') return 'number[]';
      if (/^mb_text_(length|char_at|index_of|includes)$/.test(p.type) && inp.name === 'TEXT') return 'string';
      if (p.type === 'logic_compare') { const o = p.getInputTargetBlock(inp.name === 'A' ? 'B' : 'A'); return Tq(o) === 'string' ? 'string' : null; }
      return null;
    };
    // 쓰임새가 여럿이면 더 구체적인 것 (글자 · 참거짓이 들어 있거나 배열이 더 깊은 것)
    const score = (t) => (/string|boolean/.test(t) ? 10 : 0) + (t.match(/\[\]/g) || []).length;
    const guess = new Map();
    all.forEach((b) => {
      if (b.type !== 'variables_get') return;
      const n = varOf(b), top = topOf(b), u = usage(b);
      if (!u) return;
      const k = top.type === 'mb_fn_def' && fnParams(top).includes(n) ? 'p:' + top.getFieldValue('NAME') + '.' + n : 'v:' + n;
      if (!guess.has(k) || score(u) > score(guess.get(k))) guess.set(k, u);
    });
    guess.forEach((u, k) => { const key = k.slice(2); if (k[0] === 'p') { if (!pt.has(key)) pt.set(key, u); } else if (!vt.has(key)) vt.set(key, u); });
    // 돌려주는 값의 자료형을 모르는 함수는, 호출 결과를 받는 변수의 자료형으로
    all.forEach((b) => {
      if (b.type !== 'mb_fn_call_expr' || ft.has(b.getFieldValue('NAME'))) return;
      const p = b.getParent();
      if (p && p.type === 'variables_set' && vt.has(varOf(p))) ft.set(b.getFieldValue('NAME'), vt.get(varOf(p)));
    });
    // 끝까지 모르는 것은 수로 본다
    all.forEach((b) => {
      if (b.type === 'controls_forEach' && !vt.has(varOf(b))) vt.set(varOf(b), 'number');
      if (b.type === 'variables_set' && !vt.has(varOf(b))) { const v = b.getInputTargetBlock('VALUE'); if (!(v && v.type === 'lists_create_with' && !v.getInputTargetBlock('ADD0'))) vt.set(varOf(b), T(v)); }
    });
    // 빈 목록으로만 만든 변수는 수 목록으로 본다
    all.forEach((b) => { if (b.type === 'variables_set' && !vt.has(varOf(b))) vt.set(varOf(b), 'number[]'); });
    return { T, vt, ft, pt };
  }

  function makeGen(ws, lang) {
    const py = lang === 'py';
    const g = { py, ws, imports: new Set(), helpers: new Set(), pend: [], raw: 0, datalogger: false, depth: 0, names: new Map(), types: typer(ws) };
    const reserved = py ? PY_RESERVED : TS_RESERVED;
    g.name = (n) => {
      if (g.names.has(n)) return g.names.get(n);
      let o = String(n);
      if (py ? !/^[A-Za-z_]\w*$/.test(o) : !/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(o)) o = 'v' + (g.names.size + 1);
      const used = new Set(g.names.values());
      while (reserved.has(o) || used.has(o)) o += '_';
      g.names.set(n, o);
      return o;
    };
    g.vname = (b) => g.name(varOf(b));
    g.expr = (b) => { const f = GEN[b.type]; return f ? f[lang](b, g) : [py ? 'None' : 'null', O.ATOM]; };
    g.v = (b, input, order, dflt) => {
      const t = b.getInputTargetBlock(input);
      if (!t || !t.isEnabled()) return dflt != null ? dflt : '0';
      const [c, o] = g.expr(t);
      return o > order ? '(' + c + ')' : c;
    };
    // 이 블록의 값 칸(안쪽 문장 묶음은 빼고)에 회색 파이썬 식이 있나?
    const rawInside = (b) => b.inputList.some((inp) => {
      if (inp.type !== Blockly.inputs.inputTypes.VALUE) return false;
      const t = inp.connection && inp.connection.targetBlock();
      return t && (t.type === 'py_raw_expr' || rawInside(t));
    });
    g.one = (b) => {
      const f = GEN[b.type];
      const saved = g.pend; g.pend = [];
      let code, commented = false;
      if (!py && rawInside(b)) {
        // MakeCode 로는 옮길 수 없는 문장 → 원래 파이썬을 주석으로 (자료형 오류로 블록 변환이 막히지 않게)
        g.pyg = g.pyg || makeGen(ws, 'py');
        code = String(GEN[b.type].py(b, g.pyg)).split('\n').map((l) => '// [파이썬] ' + l).join('\n');
        // 반환문이면 자료형에 맞는 기본값을 돌려줘서 부르는 쪽 코드가 계속 맞게
        if (b.type === 'mb_fn_return') { const top = topOf(b); code += '\nreturn ' + TS_DEFAULT((top.type === 'mb_fn_def' && g.types.ft.get(top.getFieldValue('NAME'))) || g.types.T(b.getInputTargetBlock('VALUE'))); }
        g.raw++; commented = true;
      } else code = f ? f[lang](b, g) : '';
      const pre = [];
      const cm = b.getCommentText && b.getCommentText();
      if (cm) cm.split('\n').forEach((l) => pre.push((py ? '# ' : '// ') + l));
      pre.push(...g.pend);
      g.pend = saved;
      return { pre, code: typeof code === 'string' ? code : '', commented };
    };
    g.stack = (b) => {
      const out = [];
      for (; b; b = b.getNextBlock()) {
        if (!b.isEnabled()) continue;
        const r = g.one(b);
        out.push(...r.pre);
        if (r.code) out.push(...r.code.split('\n'));
      }
      return out;
    };
    g.body = (b, input) => {
      g.depth++;
      const lines = g.stack(b.getInputTargetBlock(input));
      g.depth--;
      if (py && !lines.some((l) => !/^\s*#/.test(l))) lines.push('pass');
      return lines.map((l) => '    ' + l).join('\n');
    };
    g.block = (head, b, input) => (py ? head + ':\n' + g.body(b, input) : head + ' {\n' + g.body(b, input) + '\n}');
    g.isText = (b, input) => g.types.T(b.getInputTargetBlock(input)) === 'string';
    return g;
  }

  const GEN = {};
  const def = (type, py, ts) => { GEN[type] = { py, ts: ts || py }; };
  const stmt = (type, py, ts) => def(type, py, ts);
  const call = (code) => [code, O.MEMBER];

  // 기본
  stmt('mb_show_number', (b, g) => { g.helpers.add('show_number'); return `show_number(${g.v(b, 'NUM', O.NONE)})`; }, (b, g) => `basic.showNumber(${g.v(b, 'NUM', O.NONE)})`);
  stmt('mb_show_string', (b, g) => { g.helpers.add('show_string'); return `show_string(${g.v(b, 'TEXT', O.NONE, '""')})`; }, (b, g) => `basic.showString(${g.v(b, 'TEXT', O.NONE, '""')})`);
  stmt('mb_show_icon', (b) => `display.show(Image.${b.getFieldValue('ICON')})`, (b) => `basic.showIcon(IconNames.${ICON_BY[b.getFieldValue('ICON')][1]})`);
  stmt('mb_show_arrow', (b) => `display.show(Image.ARROW_${b.getFieldValue('DIR')})`, (b) => `basic.showArrow(ArrowNames.${ARROW_BY[b.getFieldValue('DIR')][1]})`);
  stmt('mb_show_leds', (b) => `display.show(Image("${leds(b).join(':')}"))`, (b) => `basic.showLeds(${tsLeds(leds(b))})`);
  stmt('mb_clear', () => 'display.clear()', () => 'basic.clearScreen()');
  stmt('mb_pause', (b, g) => `sleep(${g.v(b, 'MS', O.NONE)})`, (b, g) => `basic.pause(${g.v(b, 'MS', O.NONE)})`);
  // 입력
  const BTN_PY = { A: 'button_a.is_pressed()', B: 'button_b.is_pressed()', AB: 'button_a.is_pressed() and button_b.is_pressed()' };
  def('mb_button_pressed', (b) => [BTN_PY[b.getFieldValue('BTN')], b.getFieldValue('BTN') === 'AB' ? O.AND : O.MEMBER], (b) => call(`input.buttonIsPressed(Button.${b.getFieldValue('BTN')})`));
  def('mb_logo_pressed', () => call('pin_logo.is_touched()'), () => call('input.logoIsPressed()'));
  def('mb_is_gesture', (b) => call(`accelerometer.is_gesture(${q(b.getFieldValue('G'))})`), (b) => call(`input.isGesture(Gesture.${GESTURE_BY[b.getFieldValue('G')][2]})`));
  def('mb_accel', (b) => call(b.getFieldValue('AXIS') === 'strength' ? 'accelerometer.get_strength()' : `accelerometer.get_${b.getFieldValue('AXIS')}()`),
    (b) => call(`input.acceleration(Dimension.${{ x: 'X', y: 'Y', z: 'Z', strength: 'Strength' }[b.getFieldValue('AXIS')]})`));
  def('mb_compass', () => call('compass.heading()'), () => call('input.compassHeading()'));
  stmt('mb_calibrate', () => 'compass.calibrate()', () => 'input.calibrateCompass()');
  def('mb_magnetic', () => call('compass.get_field_strength()'), () => call('input.magneticForce(Dimension.Strength)'));
  def('mb_running_time', () => call('running_time()'), () => call('input.runningTime()'));
  def('mb_temperature', () => call('temperature()'), () => call('input.temperature()'));
  def('mb_light', () => call('display.read_light_level()'), () => call('input.lightLevel()'));
  def('mb_sound', () => call('microphone.sound_level()'), () => call('input.soundLevel()'));
  // 음악
  stmt('mb_play_tone', (b, g) => { g.imports.add('music'); return `music.pitch(${g.v(b, 'FREQ', O.NONE)}, ${g.v(b, 'MS', O.NONE)}${b.getFieldValue('MODE') === 'bg' ? ', wait=False' : ''})`; },
    (b, g) => `music.play(music.tonePlayable(${g.v(b, 'FREQ', O.NONE)}, ${g.v(b, 'MS', O.NONE)}), music.PlaybackMode.${b.getFieldValue('MODE') === 'bg' ? 'InBackground' : 'UntilDone'})`);
  stmt('mb_play_melody', (b, g) => {
    g.imports.add('music');
    const notes = String(b.getFieldValue('MELODY')).trim().split(/\s+/).filter(Boolean).map(q).join(', ');
    return `music.set_tempo(bpm=${g.v(b, 'BPM', O.NONE, '120')})\nmusic.play([${notes}]${b.getFieldValue('MODE') === 'bg' ? ', wait=False' : ''})`;
  }, (b, g) => `music.play(music.stringPlayable(${q(String(b.getFieldValue('MELODY')).trim() + ' ')}, ${g.v(b, 'BPM', O.NONE, '120')}), music.PlaybackMode.${b.getFieldValue('MODE') === 'bg' ? 'InBackground' : 'UntilDone'})`);
  // LED
  const XY = (b, g) => `${g.v(b, 'X', O.NONE)}, ${g.v(b, 'Y', O.NONE)}`;
  stmt('mb_plot', (b, g) => `display.set_pixel(${XY(b, g)}, 9)`, (b, g) => `led.plot(${XY(b, g)})`);
  stmt('mb_unplot', (b, g) => `display.set_pixel(${XY(b, g)}, 0)`, (b, g) => `led.unplot(${XY(b, g)})`);
  stmt('mb_plot_brightness', (b, g) => {
    const t = b.getInputTargetBlock('B');
    const lv = t && t.type === 'math_number' ? String(Math.max(0, Math.min(9, Math.round(Number(t.getFieldValue('NUM')) * 9 / 255)))) : `min(9, round(${g.v(b, 'B', O.MUL)} * 9 / 255))`;
    return `display.set_pixel(${XY(b, g)}, ${lv})`;
  }, (b, g) => `led.plotBrightness(${XY(b, g)}, ${g.v(b, 'B', O.NONE)})`);
  def('mb_point', (b, g) => [`display.get_pixel(${XY(b, g)}) * 28`, O.MUL], (b, g) => call(`led.pointBrightness(${XY(b, g)})`));
  // 이미지
  stmt('mb_show_image', (b, g) => `display.show(${g.v(b, 'IMG', O.NONE, 'Image()')})`, (b, g) => `${g.v(b, 'IMG', O.MEMBER, 'images.iconImage(IconNames.Heart)')}.showImage(0)`);
  def('mb_create_image', (b) => call(`Image("${leds(b).join(':')}")`), (b) => call(`images.createImage(${tsLeds(leds(b))})`));
  def('mb_icon_image', (b) => [`Image.${b.getFieldValue('ICON')}`, O.MEMBER], (b) => call(`images.iconImage(IconNames.${ICON_BY[b.getFieldValue('ICON')][1]})`));
  def('mb_arrow_image', (b) => [`Image.ARROW_${b.getFieldValue('DIR')}`, O.MEMBER], (b) => call(`images.arrowImage(ArrowNames.${ARROW_BY[b.getFieldValue('DIR')][1]})`));
  // 반복
  stmt('controls_repeat_ext', (b, g) => g.block(`for _ in range(${g.v(b, 'TIMES', O.NONE)})`, b, 'DO'),
    (b, g) => { const i = 'index' + (g.depth ? g.depth + 1 : ''); return g.block(`for (let ${i} = 0; ${i} < ${g.v(b, 'TIMES', O.REL - 1)}; ${i}++)`, b, 'DO'); });
  stmt('controls_whileUntil', (b, g) => {
    const until = b.getFieldValue('MODE') === 'UNTIL';
    return g.block(until ? `while not ${g.v(b, 'BOOL', O.NOT, 'False')}` : `while ${g.v(b, 'BOOL', O.NONE, 'False')}`, b, 'DO');
  }, (b, g) => {
    const until = b.getFieldValue('MODE') === 'UNTIL';
    return g.block(until ? `while (!${g.v(b, 'BOOL', O.UNARY, 'false')})` : `while (${g.v(b, 'BOOL', O.NONE, 'false')})`, b, 'DO');
  });
  stmt('mb_for_index', (b, g) => {
    const t = b.getInputTargetBlock('TO');
    let n;
    if (t && t.type === 'math_number') n = String(Number(t.getFieldValue('NUM')) + 1);
    else if (t && t.type === 'math_arithmetic' && t.getFieldValue('OP') === 'MINUS' && t.getInputTargetBlock('B') && t.getInputTargetBlock('B').type === 'math_number' && Number(t.getInputTargetBlock('B').getFieldValue('NUM')) === 1) n = g.v(t, 'A', O.NONE);
    else n = `${g.v(b, 'TO', O.ADD)} + 1`;
    return g.block(`for ${g.vname(b)} in range(${n})`, b, 'DO');
  }, (b, g) => { const v = g.vname(b); return g.block(`for (let ${v} = 0; ${v} <= ${g.v(b, 'TO', O.ADD)}; ${v}++)`, b, 'DO'); });
  stmt('controls_forEach', (b, g) => g.block(`for ${g.vname(b)} in ${g.v(b, 'LIST', O.NONE, '[]')}`, b, 'DO'),
    (b, g) => g.block(`for (let ${g.vname(b)} of ${g.v(b, 'LIST', O.NONE, '[]')})`, b, 'DO'));
  stmt('controls_flow_statements', (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break' : 'continue'));
  // 논리
  stmt('controls_if', (b, g) => {
    let s = '', i = 0;
    for (; b.getInput('IF' + i); i++) {
      const c = g.v(b, 'IF' + i, g.py ? O.NONE : O.NONE, g.py ? 'False' : 'false');
      if (g.py) s += (i ? '\nelif ' : 'if ') + c + ':\n' + g.body(b, 'DO' + i);
      else s += (i ? ' else if (' : 'if (') + c + ') {\n' + g.body(b, 'DO' + i) + '\n}';
    }
    if (b.getInput('ELSE')) s += g.py ? '\nelse:\n' + g.body(b, 'ELSE') : ' else {\n' + g.body(b, 'ELSE') + '\n}';
    return s;
  });
  const CMP = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  def('logic_compare', (b, g) => [`${g.v(b, 'A', O.ADD)} ${CMP[b.getFieldValue('OP')]} ${g.v(b, 'B', O.ADD)}`, O.REL]);
  def('logic_operation', (b, g) => {
    const and = b.getFieldValue('OP') === 'AND', o = and ? O.AND : O.OR;
    const op = g.py ? (and ? 'and' : 'or') : (and ? '&&' : '||');
    const f = g.py ? 'False' : 'false';
    return [`${g.v(b, 'A', o, f)} ${op} ${g.v(b, 'B', o, f)}`, o];
  });
  def('logic_negate', (b, g) => [`not ${g.v(b, 'BOOL', O.NOT, 'False')}`, O.NOT], (b, g) => [`!${g.v(b, 'BOOL', O.UNARY, 'false')}`, O.UNARY]);
  def('logic_boolean', (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False', O.ATOM], (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOM]);
  // 계산
  def('math_number', (b) => { const n = Number(b.getFieldValue('NUM')); return [String(n), n < 0 ? O.UNARY : O.ATOM]; });
  const ARITH = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MUL], DIVIDE: ['/', O.MUL], POWER: ['**', O.POW] };
  def('math_arithmetic', (b, g) => {
    const [op, o] = ARITH[b.getFieldValue('OP')];
    if (op === '**') return [`${g.v(b, 'A', O.MEMBER)} ** ${g.v(b, 'B', O.POW)}`, o];
    return [`${g.v(b, 'A', o)} ${op} ${g.v(b, 'B', o - 1)}`, o];
  });
  def('math_modulo', (b, g) => [`${g.v(b, 'DIVIDEND', O.MUL)} % ${g.v(b, 'DIVISOR', O.MUL - 1, '1')}`, O.MUL]);
  const FN1_PY = { sqrt: 'math.sqrt', abs: 'abs', round: 'round', floor: 'math.floor', ceil: 'math.ceil', trunc: 'int', sin: 'math.sin', cos: 'math.cos', tan: 'math.tan' };
  def('mb_math_fn1', (b, g) => { const f = FN1_PY[b.getFieldValue('OP')]; if (f.startsWith('math.')) g.imports.add('math'); return call(`${f}(${g.v(b, 'X', O.NONE)})`); },
    (b, g) => call(`Math.${b.getFieldValue('OP')}(${g.v(b, 'X', O.NONE)})`));
  def('mb_math_fn2', (b, g) => {
    const op = b.getFieldValue('OP');
    if (op === 'idiv') return [`${g.v(b, 'A', O.MUL)} // ${g.v(b, 'B', O.MUL - 1, '1')}`, O.MUL];
    if (op === 'atan2') g.imports.add('math');
    return call(`${op === 'atan2' ? 'math.atan2' : op}(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`);
  }, (b, g) => call(`Math.${b.getFieldValue('OP')}(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`));
  def('mb_random', (b, g) => { g.imports.add('random'); return call(`random.randint(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`); }, (b, g) => call(`randint(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`));
  def('mb_pi', (b, g) => { g.imports.add('math'); return ['math.pi', O.MEMBER]; }, () => ['Math.PI', O.MEMBER]);
  // 변수
  def('variables_get', (b, g) => [g.vname(b), O.ATOM]);
  stmt('variables_set', (b, g) => `${g.vname(b)} = ${g.v(b, 'VALUE', O.NONE)}`);
  stmt('math_change', (b, g) => `${g.vname(b)} += ${g.v(b, 'DELTA', O.NONE, '1')}`);
  // 텍스트
  def('text', (b) => [q(b.getFieldValue('TEXT')), O.ATOM]);
  def('text_join', (b, g) => {
    const items = [];
    for (let i = 0; b.getInput('ADD' + i); i++) if (b.getInputTargetBlock('ADD' + i)) items.push(i);
    if (!items.length) return ['""', O.ATOM];
    if (g.py) return [items.map((i) => (g.isText(b, 'ADD' + i) ? g.v(b, 'ADD' + i, O.MUL) : `str(${g.v(b, 'ADD' + i, O.NONE)})`)).join(' + '), items.length > 1 ? O.ADD : O.MEMBER];
    const parts = items.map((i) => g.v(b, 'ADD' + i, O.MUL));
    if (!g.isText(b, 'ADD' + items[0])) parts.unshift('""');
    return parts.length > 1 ? [parts.join(' + '), O.ADD] : [parts[0], O.ATOM];
  });
  def('mb_text_length', (b, g) => call(`len(${g.v(b, 'TEXT', O.NONE, '""')})`), (b, g) => [`${g.v(b, 'TEXT', O.MEMBER, '""')}.length`, O.MEMBER]);
  def('mb_to_text', (b, g) => call(`str(${g.v(b, 'X', O.NONE)})`), (b, g) => [`"" + ${g.v(b, 'X', O.MUL)}`, O.ADD]);
  def('mb_text_index_of', (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.find(${g.v(b, 'SUB', O.NONE, '""')})`), (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.indexOf(${g.v(b, 'SUB', O.NONE, '""')})`));
  def('mb_text_char_at', (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}[${g.v(b, 'I', O.NONE)}]`), (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.charAt(${g.v(b, 'I', O.NONE)})`));
  def('mb_text_includes', (b, g) => [`${g.v(b, 'SUB', O.ADD, '""')} in ${g.v(b, 'TEXT', O.ADD, '""')}`, O.REL], (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.includes(${g.v(b, 'SUB', O.NONE, '""')})`));
  def('mb_parse_number', (b, g) => call(`float(${g.v(b, 'TEXT', O.NONE, '"0"')})`), (b, g) => call(`parseFloat(${g.v(b, 'TEXT', O.NONE, '"0"')})`));
  // 배열
  def('lists_create_with', (b, g) => { const a = []; for (let i = 0; b.getInput('ADD' + i); i++) a.push(g.v(b, 'ADD' + i, O.NONE)); return ['[' + a.join(', ') + ']', O.ATOM]; });
  const L = (b, g) => g.v(b, 'LIST', O.MEMBER, '[]');
  def('mb_list_get', (b, g) => call(`${L(b, g)}[${g.v(b, 'I', O.NONE)}]`));
  stmt('mb_list_set', (b, g) => `${L(b, g)}[${g.v(b, 'I', O.NONE)}] = ${g.v(b, 'VALUE', O.NONE)}`);
  def('mb_list_length', (b, g) => call(`len(${g.v(b, 'LIST', O.NONE, '[]')})`), (b, g) => [`${L(b, g)}.length`, O.MEMBER]);
  stmt('mb_list_push', (b, g) => `${L(b, g)}.append(${g.v(b, 'VALUE', O.NONE)})`, (b, g) => `${L(b, g)}.push(${g.v(b, 'VALUE', O.NONE)})`);
  stmt('mb_list_remove_first', (b, g) => `${L(b, g)}.pop(0)`, (b, g) => `${L(b, g)}.shift()`);
  stmt('mb_list_remove_last', (b, g) => `${L(b, g)}.pop()`);
  stmt('mb_list_remove_at', (b, g) => `${L(b, g)}.pop(${g.v(b, 'I', O.NONE)})`, (b, g) => `${L(b, g)}.removeAt(${g.v(b, 'I', O.NONE)})`);
  def('mb_list_shift', (b, g) => call(`${L(b, g)}.pop(0)`), (b, g) => call(`${L(b, g)}.shift()`));
  def('mb_list_pop', (b, g) => call(`${L(b, g)}.pop()`));
  stmt('mb_list_insert', (b, g) => `${L(b, g)}.insert(${g.v(b, 'I', O.NONE)}, ${g.v(b, 'VALUE', O.NONE)})`, (b, g) => `${L(b, g)}.insertAt(${g.v(b, 'I', O.NONE)}, ${g.v(b, 'VALUE', O.NONE)})`);
  def('mb_list_index_of', (b, g) => { g.helpers.add('index_of'); return call(`index_of(${g.v(b, 'LIST', O.NONE, '[]')}, ${g.v(b, 'VALUE', O.NONE)})`); }, (b, g) => call(`${L(b, g)}.indexOf(${g.v(b, 'VALUE', O.NONE)})`));
  // 함수
  stmt('mb_fn_return', (b, g) => (b.getInputTargetBlock('VALUE') ? `return ${g.v(b, 'VALUE', O.NONE)}` : 'return'), (b, g) => {
    if (b.getInputTargetBlock('VALUE')) return `return ${g.v(b, 'VALUE', O.NONE)}`;
    const top = topOf(b), rt = top.type === 'mb_fn_def' && g.types.ft.get(top.getFieldValue('NAME'));
    return rt ? 'return ' + TS_DEFAULT(rt) : 'return';
  });
  const args = (b, g) => (b.params || []).map((_, i) => g.v(b, 'ARG' + i, O.NONE)).join(', ');
  stmt('mb_fn_call', (b, g) => `${g.name(b.getFieldValue('NAME'))}(${args(b, g)})`);
  def('mb_fn_call_expr', (b, g) => call(`${g.name(b.getFieldValue('NAME'))}(${args(b, g)})`));
  // 시리얼 · 데이터 로거
  stmt('mb_serial_line', (b, g) => `print(${g.v(b, 'TEXT', O.NONE, '""')})`,
    (b, g) => `serial.writeLine(${g.isText(b, 'TEXT') || !b.getInputTargetBlock('TEXT') ? g.v(b, 'TEXT', O.NONE, '""') : '"" + ' + g.v(b, 'TEXT', O.MUL)})`);
  const cols = (b) => String(b.getFieldValue('COLS') || '').split(',').map((c) => c.trim()).filter(Boolean);
  const TS_PY = { none: 'None', s: 'log.SECONDS', ms: 'log.MILLISECONDS', min: 'log.MINUTES' };
  const TS_TS = { none: 'None', s: 'Seconds', ms: 'Milliseconds', min: 'Minutes' };
  stmt('dl_set_columns', (b, g) => { g.imports.add('log'); return `log.set_labels(${cols(b).map(q).join(', ')}, timestamp=${TS_PY[b.getFieldValue('TS')]})`; },
    (b, g) => { g.datalogger = true; return `datalogger.includeTimestamp(FlashLogTimeStampFormat.${TS_TS[b.getFieldValue('TS')]})\ndatalogger.setColumnTitles(${cols(b).map(q).join(', ')})`; });
  stmt('dl_log', (b, g) => {
    g.imports.add('log');
    const kv = []; for (let i = 0; i < b.n; i++) kv.push([String(b.getFieldValue('COL' + i)).trim(), g.v(b, 'VAL' + i, O.NONE)]);
    if (kv.every(([k]) => /^[A-Za-z_]\w*$/.test(k) && !PY_RESERVED.has(k))) return `log.add(${kv.map(([k, v]) => k + '=' + v).join(', ')})`;
    return `log.add({${kv.map(([k, v]) => q(k) + ': ' + v).join(', ')}})`;
  }, (b, g) => {
    g.datalogger = true;
    const kv = []; for (let i = 0; i < b.n; i++) kv.push(`datalogger.createCV(${q(String(b.getFieldValue('COL' + i)).trim())}, ${g.v(b, 'VAL' + i, O.NONE)})`);
    return `datalogger.log(${kv.join(', ')})`;
  });
  stmt('dl_delete', (b, g) => { g.imports.add('log'); return 'log.delete()'; }, (b, g) => { g.datalogger = true; return 'datalogger.deleteLog()'; });
  // 파이썬 그대로
  stmt('py_raw', (b) => b.code, (b, g) => { g.raw++; return String(b.code).split('\n').map((l) => '// [파이썬] ' + l).join('\n'); });
  def('py_raw_expr', (b) => [b.code, O.NONE], (b, g) => { g.raw++; g.pend.push('// [파이썬] ' + b.code); return ['0', O.ATOM]; });

  const PY_HELPERS = {
    show_number: 'def show_number(n):\n    # MakeCode 의 \'수 출력\' 과 같게: 한 자리 정수는 그대로, 아니면 흘려서 보이기\n    if n == int(n) and 0 <= n <= 9:\n        display.show(int(n))\n    else:\n        display.scroll(n)',
    show_string: 'def show_string(s):\n    # MakeCode 의 \'문자열 출력\' 과 같게: 한 글자는 그대로, 아니면 흘려서 보이기\n    if len(s) == 1:\n        display.show(s)\n    else:\n        display.scroll(s)',
    index_of: 'def index_of(items, value):\n    # MakeCode 의 \'위치\' 블록과 같게: 없으면 -1\n    return items.index(value) if value in items else -1'
  };
  const PY_DEFAULT = (t) => (t === 'string' ? '""' : t === 'boolean' ? 'False' : t === 'Image' ? 'Image()' : t.endsWith('[]') ? '[]' : '0');
  const TS_DEFAULT = (t) => (t === 'string' ? '""' : t === 'boolean' ? 'false' : t === 'Image' ? 'null' : t.endsWith('[]') ? '[]' : '0');
  const EVENT_TYPES = ['mb_on_button', 'mb_on_gesture', 'mb_on_logo'];

  // 함수 · 이벤트 안에서 값을 바꾸는 변수 (매개변수 · 반복 변수 제외)
  function assigned(top, skip) {
    const s = new Set();
    top.getDescendants(false).forEach((d) => { if (STMT_VARS[d.type] && d.isEnabled()) s.add(varOf(d)); });
    (skip || []).forEach((p) => s.delete(p));
    return [...s];
  }
  function topsOf(ws) {
    const tops = ws.getTopBlocks(true).filter((b) => b.isEnabled());
    const by = (t) => tops.filter((b) => b.type === t);
    return { fns: by('mb_fn_def'), starts: by('mb_on_start'), forevers: by('mb_forever'), events: tops.filter((b) => EVENT_TYPES.includes(b.type)) };
  }
  // '시작하면 실행' 의 맨 바깥 줄에서 값을 정하는 변수
  function startSets(starts) {
    const s = new Set();
    starts.forEach((st) => { for (let b = st.getInputTargetBlock('DO'); b; b = b.getNextBlock()) if (b.type === 'variables_set' && b.isEnabled()) s.add(varOf(b)); });
    return s;
  }
  const allVars = (ws) => { const s = new Set(); ws.getAllBlocks(false).forEach((b) => { if (STMT_VARS[b.type] && b.isEnabled()) s.add(varOf(b)); }); return s; };
  const cmLines = (b, py) => { const c = b.getCommentText && b.getCommentText(); return c ? c.split('\n').map((l) => (py ? '# ' : '// ') + l) : []; };

  function genPy(ws) {
    const g = makeGen(ws, 'py');
    const { fns, starts, forevers, events } = topsOf(ws);
    const defs = [], loop = [];
    const globalsLine = (top, params) => { const a = assigned(top, params).map(g.name); return a.length ? '    global ' + a.join(', ') + '\n' : ''; };
    const defBlock = (top, name, params) => [...cmLines(top, true), `def ${name}(${params.map(g.name).join(', ')}):`].join('\n') + '\n' + globalsLine(top, params) + g.body(top, 'DO');
    fns.forEach((b) => defs.push(defBlock(b, g.name(b.getFieldValue('NAME')), fnParams(b))));
    const used = new Set();
    const uniq = (n) => { let o = n, i = 2; while (used.has(o)) o = n + '_' + i++; used.add(o); return o; };
    let logo = false;
    events.forEach((b) => {
      if (b.type === 'mb_on_button') {
        const k = b.getFieldValue('BTN'), name = uniq('on_button_' + k.toLowerCase());
        defs.push(defBlock(b, name, []));
        if (k === 'AB') loop.unshift(`if button_a.is_pressed() and button_b.is_pressed():\n    while button_a.is_pressed() or button_b.is_pressed():\n        sleep(10)\n    button_a.was_pressed()\n    button_b.was_pressed()\n    ${name}()`);
        else loop.push(`if button_${k.toLowerCase()}.was_pressed():\n    ${name}()`);
      } else if (b.type === 'mb_on_gesture') {
        const k = b.getFieldValue('G'), name = uniq('on_gesture_' + k.replace(/\W/g, '_'));
        defs.push(defBlock(b, name, []));
        loop.push(`if accelerometer.was_gesture(${q(k)}):\n    ${name}()`);
      } else {
        const name = uniq('on_logo_pressed');
        defs.push(defBlock(b, name, []));
        loop.push(`touched = pin_logo.is_touched()\nif touched and not logo_was_touched:\n    ${name}()\nlogo_was_touched = touched`);
        logo = true;
      }
    });
    forevers.forEach((b) => { const name = uniq('on_forever'); defs.push(defBlock(b, name, [])); loop.push(`${name}()`); });
    // 시작할 때 값이 정해지지 않는 변수는 MakeCode 처럼 0 · "" · [] 로 먼저 둔다
    const set0 = startSets(starts), init = [];
    allVars(ws).forEach((n) => { if (!set0.has(n)) init.push(`${g.name(n)} = ${PY_DEFAULT(g.types.vt.get(n) || 'number')}`); });
    const start = [];
    starts.forEach((b) => { start.push(...cmLines(b, true), ...g.stack(b.getInputTargetBlock('DO'))); });
    const head = ['from microbit import *', ...[...g.imports].sort().map((m) => 'import ' + m)];
    const parts = [head.join('\n')];
    const helpers = [...g.helpers].map((h) => PY_HELPERS[h]);
    if (helpers.length) parts.push(helpers.join('\n\n'));
    if (defs.length) parts.push(defs.join('\n\n'));
    if (logo) init.push('logo_was_touched = False');
    const body = [...init, ...start];
    if (loop.length) body.push('while True:\n' + [...loop, 'sleep(20)'].join('\n').split('\n').map((l) => '    ' + l).join('\n'));
    if (body.length) parts.push(body.join('\n'));
    return { code: parts.join('\n\n') + '\n', raw: g.raw };
  }

  function genTs(ws) {
    const g = makeGen(ws, 'ts');
    const { fns, starts, forevers, events } = topsOf(ws);
    const out = [];
    const T = g.types;
    fns.forEach((b) => {
      const fn = b.getFieldValue('NAME');
      const ps = fnParams(b).map((p) => `${g.name(p)}: ${T.pt.get(fn + '.' + p) || 'number'}`);
      // 값을 돌려주는 함수는 끝에서도 돌려주게 하고, 배열을 돌려주면 형식을 적는다 (MakeCode 컴파일러가 요구)
      const rt = T.ft.get(fn);
      let last = b.getInputTargetBlock('DO');
      while (last && last.getNextBlock()) last = last.getNextBlock();
      let body = g.body(b, 'DO');
      if (rt && !(last && last.type === 'mb_fn_return')) body += (body ? '\n' : '') + '    return ' + TS_DEFAULT(rt);
      out.push([...cmLines(b, false), `function ${g.name(fn)} (${ps.join(', ')})${rt && rt.endsWith('[]') ? ': ' + rt : ''} {`, body, '}'].join('\n'));
    });
    events.forEach((b) => {
      let head;
      if (b.type === 'mb_on_button') head = `input.onButtonPressed(Button.${b.getFieldValue('BTN')}, function () {`;
      else if (b.type === 'mb_on_gesture') head = `input.onGesture(Gesture.${GESTURE_BY[b.getFieldValue('G')][2]}, function () {`;
      else head = 'input.onLogoEvent(TouchButtonEvent.Pressed, function () {';
      out.push([...cmLines(b, false), head, g.body(b, 'DO'), '})'].join('\n'));
    });
    // 변수 선언: '시작하면 실행' 맨 바깥에서 처음 값을 정하면 그 줄을 let 으로, 나머지는 기본값으로 먼저 선언
    const declared = new Set(), start = [], seen = new Set();
    const ann = (n, vb) => { const t = T.vt.get(n) || 'number'; const empty = vb && vb.type === 'lists_create_with' && !vb.getInputTargetBlock('ADD0'); return empty || (vb && vb.type === 'py_raw_expr') || t === 'Image' ? ': ' + t : ''; };
    starts.forEach((s) => {
      start.push(...cmLines(s, false));
      for (let b = s.getInputTargetBlock('DO'); b; b = b.getNextBlock()) {
        if (!b.isEnabled()) continue;
        const r = g.one(b);
        let code = r.code;
        if (b.type === 'variables_set' && !r.commented) {
          const n = varOf(b);
          if (!declared.has(n) && !seen.has(n)) { declared.add(n); code = `let ${g.name(n)}${ann(n, b.getInputTargetBlock('VALUE'))}${code.slice(g.name(n).length)}`; }
        }
        const after = b.getNextBlock() ? new Set(b.getNextBlock().getDescendants(false)) : new Set();
        b.getDescendants(false).forEach((d) => { if (!after.has(d) && d.getField('VAR')) seen.add(varOf(d)); });
        start.push(...r.pre, ...code.split('\n'));
      }
    });
    const decl = [];
    allVars(ws).forEach((n) => { if (!declared.has(n)) { const t = T.vt.get(n) || 'number'; decl.push(`let ${g.name(n)}${t.endsWith('[]') || t === 'Image' ? ': ' + t : ''} = ${TS_DEFAULT(t)}`); } });
    if (decl.length || start.length) out.push([...decl, ...start].join('\n'));
    forevers.forEach((b) => out.push([...cmLines(b, false), 'basic.forever(function () {', g.body(b, 'DO'), '})'].join('\n')));
    return { code: out.join('\n') + '\n', raw: g.raw, datalogger: g.datalogger };
  }

  // makecode.microbit.org 의 [가져오기 → 파일 가져오기]로 여는 프로젝트 파일 (.mkcd · JSON)
  // main.blocks 를 비워 두면 MakeCode 가 main.ts 를 읽어 블록으로 바꿔 보여 줍니다.
  function mkcd(ws, name) {
    const ts = genTs(ws);
    const deps = { core: '*', radio: '*', microphone: '*' };
    if (ts.datalogger) deps.datalogger = '*';
    const pxt = { name, description: '', dependencies: deps, files: ['main.blocks', 'main.ts', 'README.md'], preferredEditor: 'blocksprj' };
    const source = { 'main.blocks': '', 'main.ts': ts.code, 'README.md': ' ', 'pxt.json': JSON.stringify(pxt, null, 4) };
    // MakeCode 는 JSON 파일을 바이트 그대로(UTF-8 로 풀지 않고) 읽으므로 한글 등은 \uXXXX 로 적는다
    return JSON.stringify({ meta: { cloudId: 'pxt/microbit', editor: 'blocksprj', name, mbBlocks: Blockly.serialization.workspaces.save(ws) }, source: JSON.stringify(source) })
      .replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  /* ── 변환기: 파이썬 코드 → 블록 ──
   * Pyodide 의 ast 로 구문 트리(JSON)를 받아 MakeCode 블록 JSON 으로 바꾼다.
   * - 맨 바깥 while True: → '무한반복 실행', 그 안의 'if 버튼.was_pressed():' → '버튼 누르면 실행' 이벤트 (MakeCode 방식)
   * - 함수는 함수 블록으로, 함수 안에서만 쓰는 변수가 바깥 변수와 이름이 겹치면 '이름_함수' 로 바꾼다 (블록의 변수는 모두 전역이라서)
   * - 바꿀 수 없는 문장 · 식은 회색 '파이썬' 블록 (실행은 되고, MakeCode 로 보낼 때는 주석)
   */
  const AST_PY = String.raw`
import ast, json, tokenize, io

def _j(n):
    if isinstance(n, ast.AST):
        d = {'_': type(n).__name__}
        for k, v in ast.iter_fields(n):
            if k in ('ctx', 'type_comment', 'kind', 'type_params'):
                continue
            d[k] = _j(v)
        if isinstance(n, (ast.stmt, ast.expr)):
            d['ln'] = n.lineno
            d['eln'] = n.end_lineno
            if isinstance(n, ast.expr):
                try:
                    d['py'] = ast.unparse(n)
                except Exception:
                    d['py'] = ''
        return d
    if isinstance(n, list):
        return [_j(x) for x in n]
    if n is None or isinstance(n, (bool, int, float, str)):
        return n
    return repr(n)

def to_json(src):
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return json.dumps({'error': '%s (%s번째 줄)' % (e.msg, e.lineno)}, ensure_ascii=False)
    comments = []
    try:
        for t in tokenize.generate_tokens(io.StringIO(src).readline):
            if t.type == tokenize.COMMENT:
                comments.append([t.start[0], t.string[1:].strip(), t.line[:t.start[1]].strip() != ''])
    except Exception:
        pass
    return json.dumps({'body': _j(tree.body), 'comments': comments}, ensure_ascii=False)
`;
  let astFn = null;
  async function pyAst(src) {
    if (!astFn) {
      const py = await MbEngine.load();
      const ns = py.globals.get('dict')();
      py.runPython(AST_PY, { globals: ns });
      astFn = ns.get('to_json');
    }
    return JSON.parse(astFn(src));
  }

  // MakeCode 에 sum · min(목록) · max(목록) 블록이 없어서 준비된 함수로 붙인다
  const LIST_HELPERS = {
    sum: ['sum_list', 'def sum_list(values):\n    # 준비된 함수: 목록의 값을 모두 더하기\n    sum_total = 0\n    for sum_item in values:\n        sum_total += sum_item\n    return sum_total'],
    min: ['min_list', 'def min_list(values):\n    # 준비된 함수: 목록에서 가장 작은 값\n    min_best = values[0]\n    for min_item in values:\n        if min_item < min_best:\n            min_best = min_item\n    return min_best'],
    max: ['max_list', 'def max_list(values):\n    # 준비된 함수: 목록에서 가장 큰 값\n    max_best = values[0]\n    for max_item in values:\n        if max_item > max_best:\n            max_best = max_item\n    return max_best']
  };

  function walk(n, fn, skipDefs) {
    if (Array.isArray(n)) { n.forEach((x) => walk(x, fn, skipDefs)); return; }
    if (!n || typeof n !== 'object' || !n._) return;
    if (fn(n) === false) return;
    for (const k in n) { if (k === '_' || k === 'py') continue; const v = n[k]; if (v && typeof v === 'object') { if (skipDefs && v._ === 'FunctionDef') continue; walk(v, fn, skipDefs); } }
  }
  const dotted = (f) => (f && f._ === 'Name' ? f.id : f && f._ === 'Attribute' && dotted(f.value) ? dotted(f.value) + '.' + f.attr : null);
  const isConst = (n, t) => n && n._ === 'Constant' && (t ? typeof n.value === t : true);
  const numVal = (n) => (isConst(n, 'number') ? n.value : n && n._ === 'UnaryOp' && n.op._ === 'USub' && isConst(n.operand, 'number') ? -n.operand.value : null);
  const targetNames = (t, out) => { if (!t) return out; if (t._ === 'Name') out.push(t.id); else if (t._ === 'Tuple' || t._ === 'List') t.elts.forEach((e) => targetNames(e, out)); return out; };

  async function convertPython(src) {
    src = String(src).replace(/\t/g, '    ').replace(/\r\n?/g, '\n');
    let tree = await pyAst(src);
    if (tree.error) return { error: tree.error };
    // sum(목록) · min(목록) · max(목록) 을 쓰면 준비된 함수를 뒤에 붙여 다시 읽는다
    const need = new Set();
    walk(tree.body, (n) => { if (n._ === 'Call' && n.func._ === 'Name' && LIST_HELPERS[n.func.id] && n.args.length === 1 && !n.keywords.length) need.add(n.func.id); });
    const defined = new Set(tree.body.filter((n) => n._ === 'FunctionDef').map((n) => n.name));
    const add = [...need].filter((k) => !defined.has(LIST_HELPERS[k][0]));
    if (add.length) { tree = await pyAst(src + '\n\n' + add.map((k) => LIST_HELPERS[k][1]).join('\n\n') + '\n'); if (tree.error) return { error: tree.error }; }
    return buildBlocks(tree, src);
  }

  function buildBlocks(tree, src) {
    const lines = src.split('\n');
    const notes = new Set();
    let uid = 0, raw = 0, count = 0;
    // Blockly 의 변수 이름은 대소문자를 가리지 않으므로 stride · STRIDE 처럼 겹치면 나중 것을 stride2 로
    const vars = new Map(), lowers = new Set();
    const vid = (n) => {
      if (!vars.has(n)) {
        let name = n, k = 2;
        while (lowers.has(name.toLowerCase())) name = n + k++;
        lowers.add(name.toLowerCase());
        vars.set(n, { id: 'v' + vars.size, name });
      }
      return vars.get(n).id;
    };
    const vname = (n) => { vid(n); return vars.get(n).name; };
    const B = (type, fields, inputs, extra) => {
      count++;
      const o = { type, id: 'k' + (++uid) };
      if (fields) o.fields = fields;
      if (inputs) { o.inputs = {}; for (const k in inputs) if (inputs[k]) o.inputs[k] = { block: inputs[k] }; }
      if (extra) o.extraState = extra;
      return o;
    };
    const chain = (arr) => { arr = arr.filter(Boolean); for (let i = 0; i < arr.length - 1; i++) { let last = arr[i]; while (last.next) last = last.next.block; last.next = { block: arr[i + 1] }; } return arr[0] || null; };
    const VAR = (n) => ({ VAR: { id: vid(n) } });
    const num = (v) => B('math_number', { NUM: v });
    const txt = (s) => B('text', { TEXT: s });
    const getv = (n) => B('variables_get', VAR(n));
    const setv = (n, v) => B('variables_set', VAR(n), { VALUE: v });
    const arith = (op, a, b) => B('math_arithmetic', { OP: op }, { A: a, B: b });
    const fn1 = (op, x) => B('mb_math_fn1', { OP: op }, { X: x });
    const fn2 = (op, a, b) => B('mb_math_fn2', { OP: op }, { A: a, B: b });
    const listOf = (items) => { const inputs = {}; items.forEach((it, i) => { inputs['ADD' + i] = it; }); return B('lists_create_with', null, inputs, { itemCount: items.length }); };
    const joinOf = (items) => { const inputs = {}; items.forEach((it, i) => { inputs['ADD' + i] = it; }); return B('text_join', null, inputs, { itemCount: items.length }); };
    const rawExpr = (n) => { raw++; return B('py_raw_expr', null, null, { code: n.py || '', t: T(n) }); };
    const dedent = (ls) => { const ind = Math.min(...ls.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)); return ls.map((l) => l.slice(ind)).join('\n').replace(/\s+$/, ''); };
    const rawStmt = (n) => { raw++; return B('py_raw', null, null, { code: dedent(lines.slice(n.ln - 1, n.eln)) }); };

    // 주석: 문장의 첫 줄과 그 앞에 있는 # 주석을 블록 메모로
    const comments = (tree.comments || []).slice();
    let ci = 0;
    const takeComments = (upto) => { const t = []; while (ci < comments.length && comments[ci][0] <= upto) t.push(comments[ci++][1]); return t; };
    const dropComments = (upto) => { while (ci < comments.length && comments[ci][0] <= upto) ci++; };
    const attach = (blk, texts) => { if (blk && texts.length) { const t = texts.filter(Boolean).join('\n'); if (t) blk.icons = { comment: { text: (blk.icons ? blk.icons.comment.text + '\n' : '') + t, pinned: false, height: 60, width: 260 } }; } };

    /* 함수 정보 · 이름 겹침 정리 */
    const body = tree.body;
    const fdefs = body.filter((n) => n._ === 'FunctionDef');
    const FN = {};
    const globalNames = new Set();
    body.forEach((n) => {
      if (n._ === 'FunctionDef') return;
      walk(n, (m) => {
        if (m._ === 'Assign') m.targets.forEach((t) => targetNames(t, []).forEach((x) => globalNames.add(x)));
        else if (m._ === 'AugAssign' || m._ === 'For') targetNames(m.target, []).forEach((x) => globalNames.add(x));
      }, true);
    });
    fdefs.forEach((f) => {
      const params = f.args.args.map((a) => a.arg);
      const defaults = f.args.defaults || [];
      const glob = new Set(), loc = new Set();
      walk(f.body, (m) => {
        if (m._ === 'Global') m.names.forEach((x) => { glob.add(x); globalNames.add(x); });
        else if (m._ === 'Assign') m.targets.forEach((t) => targetNames(t, []).forEach((x) => loc.add(x)));
        else if (m._ === 'AugAssign' || m._ === 'For') targetNames(m.target, []).forEach((x) => loc.add(x));
      }, true);
      FN[f.name] = { params, defaults: params.map((_, i) => defaults[i - (params.length - defaults.length)] || null), glob, loc };
    });
    fdefs.forEach((f) => {
      const info = FN[f.name], ren = {};
      info.loc.forEach((x) => { if (!info.glob.has(x) && !info.params.includes(x) && globalNames.has(x)) ren[x] = x + '_' + f.name; });
      if (Object.keys(ren).length) {
        walk(f.body, (m) => { if (m._ === 'Name' && ren[m.id]) m.id = ren[m.id]; }, true);
        notes.add(`함수 ${f.name}() 안의 변수 ${Object.keys(ren).join(', ')} 는 바깥 변수와 이름이 겹쳐 ${Object.values(ren).join(', ')} (으)로 바꿨습니다 (블록의 변수는 모두 전역).`);
      }
    });

    // 바깥(전역) 변수 이름을 먼저 정해 두면, 겹치는 매개변수 쪽이 stride2 처럼 바뀐다
    globalNames.forEach(vid);

    /* 자료형 짐작: num · str · bool · img · list<…> · dict · any */
    const VT = new Map(), FT = new Map(), PT = new Map();
    let curFn = null;
    const elemOf = (t) => (t && t.startsWith('list<') ? t.slice(5, -1) : 'any');
    function typeOf(n) {
      if (!n) return 'any';
      switch (n._) {
        case 'Constant': return typeof n.value === 'string' ? 'str' : typeof n.value === 'boolean' ? 'bool' : typeof n.value === 'number' ? 'num' : 'any';
        case 'Name': {
          if (curFn && FN[curFn] && FN[curFn].params.includes(n.id)) return PT.get(curFn + '.' + n.id) || 'any';
          return VT.get(n.id) || 'any';
        }
        case 'BinOp': {
          const a = typeOf(n.left), b = typeOf(n.right);
          if (n.op._ === 'Add' && (a === 'str' || b === 'str')) return 'str';
          if (n.op._ === 'Mod' && a === 'str') return 'str';
          if (a.startsWith('list') || (n.op._ === 'Mult' && b.startsWith('list'))) return a.startsWith('list') ? a : b;
          return 'num';
        }
        case 'UnaryOp': return n.op._ === 'Not' ? 'bool' : 'num';
        case 'BoolOp': case 'Compare': return 'bool';
        case 'IfExp': return typeOf(n.body);
        case 'List': case 'Tuple': {
          // ("이름", 목록) 처럼 섞인 묶음은 원소 자료형을 any 로
          const ts = [...new Set(n.elts.map(typeOf))];
          return 'list<' + (ts.length === 1 ? ts[0] : 'any') + '>';
        }
        case 'Dict': return 'dict<' + (n.values.length ? typeOf(n.values[0]) : 'any') + '>';
        case 'ListComp': return 'list<any>';
        case 'JoinedStr': return 'str';
        case 'Attribute': return dotted(n.value) === 'Image' ? 'img' : 'num';
        case 'Subscript': {
          const t = typeOf(n.value);
          if (n.slice && n.slice._ === 'Slice') return t;
          if (t === 'str') return 'str';
          if (t.startsWith('dict<')) return t.slice(5, -1);
          return elemOf(t);
        }
        case 'Call': {
          const f = dotted(n.func);
          if (f && FN[f]) return FT.get(f) || 'any';
          if (['str', 'chr'].includes(f) || /\.(join|format|upper|lower|strip|replace)$/.test(f || '')) return 'str';
          if (f === 'Image' || (f && f.startsWith('Image.'))) return 'img';
          if (/\.(is_pressed|was_pressed|is_touched|was_gesture|is_gesture)$/.test(f || '')) return 'bool';
          if (f === 'accelerometer.get_values') return 'list<num>';
          if (f === 'list') return typeOf(n.args[0]);
          if (/\.split$/.test(f || '')) return 'list<str>';
          if (n.func._ === 'Attribute' && n.func.attr === 'pop') return elemOf(typeOf(n.func.value));
          if (n.func._ === 'Attribute' && n.func.attr === 'get') return typeOf(n.func.value).startsWith('dict<') ? typeOf(n.func.value).slice(5, -1) : 'any';
          return 'num';
        }
        default: return 'any';
      }
    }
    // [("교실", "C", 지도), …] 처럼 묶음의 목록이면 자리마다 자료형을 기억 (꺼내서 풀 때 씀)
    const TUP = new Map();
    const tupTypes = (v) => (v._ === 'List' && v.elts.length && v.elts.every((e) => e._ === 'Tuple' && e.elts.length === v.elts[0].elts.length) ? v.elts[0].elts.map(typeOf) : null);
    const posType = (v, i) => {
      if (v._ === 'Subscript' && v.value._ === 'Name' && TUP.has(v.value.id)) return TUP.get(v.value.id)[i];
      return null;
    };
    const setT = (name, t) => { if (t && t !== 'any' && t !== 'list<any>' && (!VT.has(name) || VT.get(name) === 'list<any>')) VT.set(name, t); else if (t === 'list<any>' && !VT.has(name)) VT.set(name, t); };
    function inferStmt(n) {
      walk(n, (m) => {
        if (m._ === 'FunctionDef') return false;
        if (m._ === 'Assign') {
          m.targets.forEach((t) => {
            if (t._ === 'Name') { setT(t.id, typeOf(m.value)); const tt = tupTypes(m.value); if (tt) TUP.set(t.id, tt); }
            else if (t._ === 'Tuple' || t._ === 'List') {
              t.elts.forEach((e, i) => { if (e._ !== 'Name') return; const v = m.value; setT(e.id, v._ === 'Tuple' || v._ === 'List' ? typeOf(v.elts[i]) : posType(v, i) ? posType(v, i) : elemOf(typeOf(v)) === 'any' && dotted(v.func) === 'accelerometer.get_values' ? 'num' : elemOf(typeOf(v))); });
            }
          });
        } else if (m._ === 'AugAssign' && m.target._ === 'Name') setT(m.target.id, typeOf(m.value));
        else if (m._ === 'For') {
          const it = m.iter, f = it._ === 'Call' ? dotted(it.func) : null;
          const et = f === 'range' ? 'num' : elemOf(typeOf(it));
          if (m.target._ === 'Name') setT(m.target.id, et);
          else if (m.target._ === 'Tuple') m.target.elts.forEach((e, i) => { if (e._ === 'Name') setT(e.id, it._ === 'Name' && TUP.has(it.id) ? TUP.get(it.id)[i] : elemOf(et)); });
        } else if (m._ === 'Call') {
          const f = dotted(m.func);
          if (m.func._ === 'Attribute' && m.func.attr === 'append' && m.func.value._ === 'Name' && (VT.get(m.func.value.id) || 'list<any>') === 'list<any>') VT.set(m.func.value.id, 'list<' + typeOf(m.args[0]) + '>');
          if (f && FN[f]) FN[f].params.forEach((p, i) => { const a = m.args[i]; if (a && !PT.has(f + '.' + p)) { const t = typeOf(a); if (t !== 'any') PT.set(f + '.' + p, t); } });
        } else if (m._ === 'Return' && curFn && m.value && !FT.has(curFn)) {
          const t = typeOf(m.value); if (t !== 'any' && t !== 'list<any>') FT.set(curFn, t);
        }
      });
    }
    for (let pass = 0; pass < 3; pass++) {
      body.forEach((n) => {
        if (n._ === 'FunctionDef') { curFn = n.name; n.body.forEach(inferStmt); curFn = null; } else inferStmt(n);
      });
    }

    /* 식 */
    const ctx = { fn: null };
    const T = (n) => { const s = curFn; curFn = ctx.fn; const t = typeOf(n); curFn = s; return t; };
    function idx(listNode, i) {
      const k = numVal(i);
      if (k != null && k < 0) return arith('MINUS', T(listNode) === 'str' ? B('mb_text_length', null, { TEXT: ex(listNode) }) : B('mb_list_length', null, { LIST: ex(listNode) }), num(-k));
      return ex(i);
    }
    function ex(n) {
      const r = ex0(n);
      return r || rawExpr(n);
    }
    function ex0(n) {
      switch (n._) {
        case 'Constant':
          if (typeof n.value === 'boolean') return B('logic_boolean', { BOOL: n.value ? 'TRUE' : 'FALSE' });
          if (typeof n.value === 'number') return num(n.value);
          if (typeof n.value === 'string') return txt(n.value);
          return null;
        case 'Name':
          if (FN[n.id]) return null;
          return getv(n.id);
        case 'UnaryOp':
          if (n.op._ === 'Not') return B('logic_negate', null, { BOOL: ex(n.operand) });
          if (n.op._ === 'USub') return numVal(n) != null ? num(numVal(n)) : arith('MINUS', num(0), ex(n.operand));
          if (n.op._ === 'UAdd') return ex(n.operand);
          return null;
        case 'BinOp': {
          const op = n.op._, lt = T(n.left), rt = T(n.right);
          if (op === 'Add' && (lt === 'str' || rt === 'str')) {
            const items = [];
            const flat = (m) => { if (m._ === 'BinOp' && m.op._ === 'Add' && (T(m.left) === 'str' || T(m.right) === 'str')) { flat(m.left); flat(m.right); } else items.push(m._ === 'Call' && dotted(m.func) === 'str' && m.args.length === 1 ? ex(m.args[0]) : ex(m)); };
            flat(n);
            return joinOf(items);
          }
          if (lt.startsWith('list') || rt.startsWith('list') || lt === 'str' || rt === 'str') return null;
          const M = { Add: 'ADD', Sub: 'MINUS', Mult: 'MULTIPLY', Div: 'DIVIDE', Pow: 'POWER' };
          if (M[op]) return arith(M[op], ex(n.left), ex(n.right));
          if (op === 'Mod') return B('math_modulo', null, { DIVIDEND: ex(n.left), DIVISOR: ex(n.right) });
          if (op === 'FloorDiv') return fn2('idiv', ex(n.left), ex(n.right));
          return null;
        }
        case 'BoolOp': {
          const op = n.op._ === 'And' ? 'AND' : 'OR';
          return n.values.slice(1).reduce((a, v) => B('logic_operation', { OP: op }, { A: a, B: ex(v) }), ex(n.values[0]));
        }
        case 'Compare': {
          const parts = [];
          let left = n.left;
          for (let i = 0; i < n.ops.length; i++) {
            const right = n.comparators[i], op = n.ops[i]._;
            const C2 = { Eq: 'EQ', NotEq: 'NEQ', Lt: 'LT', LtE: 'LTE', Gt: 'GT', GtE: 'GTE' };
            let p;
            if (C2[op]) p = B('logic_compare', { OP: C2[op] }, { A: ex(left), B: ex(right) });
            else if (op === 'In' || op === 'NotIn') {
              const rt = T(right);
              if (rt === 'str') p = B('mb_text_includes', null, { TEXT: ex(right), SUB: ex(left) });
              else if (rt.startsWith('list')) p = B('logic_compare', { OP: 'GTE' }, { A: B('mb_list_index_of', null, { LIST: ex(right), VALUE: ex(left) }), B: num(0) });
              else return null;
              if (op === 'NotIn') p = B('logic_negate', null, { BOOL: p });
            } else return null;
            parts.push(p);
            left = right;
          }
          return parts.slice(1).reduce((a, p) => B('logic_operation', { OP: 'AND' }, { A: a, B: p }), parts[0]);
        }
        case 'List': case 'Tuple': {
          if (n.elts.some((e) => e._ === 'Starred')) return null;
          // MakeCode 의 배열은 한 가지 자료형만 담는다 → 섞여 있으면 회색 블록
          const ts = new Set(n.elts.map(T).filter((t) => t !== 'any' && t !== 'list<any>'));
          if (ts.size > 1) { notes.add('글자와 수 · 목록이 섞인 묶음은 MakeCode 배열에 담을 수 없어 회색 블록으로 남겼습니다.'); return null; }
          return listOf(n.elts.map(ex));
        }
        case 'Subscript': {
          if (n.slice._ === 'Slice') return null;
          const t = T(n.value);
          if (t.startsWith('dict')) return null;
          if (t === 'str') return B('mb_text_char_at', null, { TEXT: ex(n.value), I: idx(n.value, n.slice) });
          return B('mb_list_get', null, { LIST: ex(n.value), I: idx(n.value, n.slice) });
        }
        case 'Attribute': {
          const d = dotted(n);
          if (d === 'math.pi') return B('mb_pi');
          if (d && d.startsWith('Image.')) {
            const k = d.slice(6);
            if (ICON_BY[k]) return B('mb_icon_image', { ICON: k });
            if (k.startsWith('ARROW_') && ARROW_BY[k.slice(6)]) return B('mb_arrow_image', { DIR: k.slice(6) });
          }
          return null;
        }
        case 'Call': return callExpr(n);
        default: return null;
      }
    }
    const kw = (n) => Object.fromEntries((n.keywords || []).map((k) => [k.arg, k.value]));
    function callExpr(n) {
      const f = dotted(n.func), a = n.args, k = kw(n);
      if (a.some((x) => x._ === 'Starred') || (n.keywords || []).some((x) => !x.arg)) return null;
      const simple = { running_time: 'mb_running_time', temperature: 'mb_temperature', 'display.read_light_level': 'mb_light', 'microphone.sound_level': 'mb_sound', 'compass.heading': 'mb_compass', 'compass.get_field_strength': 'mb_magnetic', 'pin_logo.is_touched': 'mb_logo_pressed' };
      if (simple[f] && !a.length) return B(simple[f]);
      let m;
      if ((m = /^button_([ab])\.(is_pressed|was_pressed)$/.exec(f || ''))) {
        if (m[2] === 'was_pressed') notes.add('was_pressed() 를 이벤트로 옮길 수 없는 곳은 \'버튼 누름 상태\' 블록으로 바꿨습니다 (누르고 있는 동안 참).');
        return B('mb_button_pressed', { BTN: m[1].toUpperCase() });
      }
      if ((m = /^accelerometer\.get_([xyz])$/.exec(f || ''))) return B('mb_accel', { AXIS: m[1] });
      if (f === 'accelerometer.get_strength') return B('mb_accel', { AXIS: 'strength' });
      if (f === 'accelerometer.get_values') return listOf(['x', 'y', 'z'].map((x) => B('mb_accel', { AXIS: x })));
      if (/^accelerometer\.(was|is)_gesture$/.test(f || '') && isConst(a[0], 'string') && GESTURE_BY[a[0].value]) return B('mb_is_gesture', { G: a[0].value });
      if (f === 'display.get_pixel' && a.length === 2) return fn2('idiv', B('mb_point', null, { X: ex(a[0]), Y: ex(a[1]) }), num(28));
      if (f === 'random.randint' && a.length === 2) return B('mb_random', null, { A: ex(a[0]), B: ex(a[1]) });
      if ((m = /^math\.(sqrt|sin|cos|tan|floor|ceil|fabs)$/.exec(f || '')) && a.length === 1) return fn1(m[1] === 'fabs' ? 'abs' : m[1], ex(a[0]));
      if (f === 'math.atan2' && a.length === 2) return fn2('atan2', ex(a[0]), ex(a[1]));
      if (f === 'math.radians' && a.length === 1) return arith('DIVIDE', arith('MULTIPLY', ex(a[0]), B('mb_pi')), num(180));
      if (f === 'math.degrees' && a.length === 1) return arith('DIVIDE', arith('MULTIPLY', ex(a[0]), num(180)), B('mb_pi'));
      if (f === 'abs' && a.length === 1) return fn1('abs', ex(a[0]));
      if (f === 'round' && a.length === 1) return fn1('round', ex(a[0]));
      if (f === 'round' && a.length === 2 && numVal(a[1]) != null) { const p = Math.pow(10, numVal(a[1])); return arith('DIVIDE', fn1('round', arith('MULTIPLY', ex(a[0]), num(p))), num(p)); }
      if (f === 'int' && a.length === 1) return T(a[0]) === 'str' ? fn1('trunc', B('mb_parse_number', null, { TEXT: ex(a[0]) })) : fn1('trunc', ex(a[0]));
      if (f === 'float' && a.length === 1) return T(a[0]) === 'str' ? B('mb_parse_number', null, { TEXT: ex(a[0]) }) : ex(a[0]);
      if (f === 'str' && a.length === 1) return T(a[0]) === 'str' ? ex(a[0]) : B('mb_to_text', null, { X: ex(a[0]) });
      if (f === 'len' && a.length === 1) return T(a[0]) === 'str' ? B('mb_text_length', null, { TEXT: ex(a[0]) }) : T(a[0]).startsWith('dict') ? null : B('mb_list_length', null, { LIST: ex(a[0]) });
      if ((f === 'min' || f === 'max') && a.length >= 2) return a.slice(1).reduce((acc, x) => fn2(f, acc, ex(x)), ex(a[0]));
      if (LIST_HELPERS[f] && a.length === 1 && !Object.keys(k).length) return fnCall(LIST_HELPERS[f][0], a, {}, true);
      if (f === 'Image' && a.length === 1 && isConst(a[0], 'string')) return imageBlock('mb_create_image', a[0].value);
      if (n.func._ === 'Attribute') {
        const obj = n.func.value, at = n.func.attr, ot = T(obj);
        if (ot.startsWith('list')) {
          if (at === 'pop' && !a.length) return B('mb_list_pop', null, { LIST: ex(obj) });
          if (at === 'pop' && numVal(a[0]) === 0) return B('mb_list_shift', null, { LIST: ex(obj) });
          if (at === 'index' && a.length === 1) return B('mb_list_index_of', null, { LIST: ex(obj), VALUE: ex(a[0]) });
        }
        if (ot === 'str' && at === 'find' && a.length === 1) return B('mb_text_index_of', null, { TEXT: ex(obj), SUB: ex(a[0]) });
      }
      if (f && FN[f]) return fnCall(f, a, k, true);
      return null;
    }
    function fnCall(f, a, k, expr) {
      const info = FN[f] || { params: ['values'], defaults: [null] };
      const inputs = {};
      for (let i = 0; i < info.params.length; i++) {
        const p = info.params[i];
        const v = a[i] || k[p] || info.defaults[i];
        if (v) inputs['ARG' + i] = ex(v);
      }
      return B(expr ? 'mb_fn_call_expr' : 'mb_fn_call', null, inputs, { name: f, params: info.params.map(vname) });
    }
    function imageBlock(type, s) {
      const rows = String(s).split(':').map((r) => r.trim());
      if (rows.length !== 5 || rows.some((r) => !/^[0-9]{5}$/.test(r))) return null;
      const fields = {};
      rows.forEach((r, i) => r.split('').forEach((c, j) => { fields['L' + (i * 5 + j)] = c !== '0'; }));
      if (rows.join('').split('').some((c) => c !== '0' && c !== '9')) notes.add('LED 밝기(1~8)는 MakeCode 의 \'LED 출력\' 에서 켜짐으로 바뀝니다.');
      return B(type, fields);
    }

    /* 문장 */
    function showBlock(x, scroll) {
      const d = x._ === 'Attribute' ? dotted(x) : null;
      if (d && d.startsWith('Image.') && !scroll) {
        const k = d.slice(6);
        if (ICON_BY[k]) return B('mb_show_icon', { ICON: k });
        if (k.startsWith('ARROW_') && ARROW_BY[k.slice(6)]) return B('mb_show_arrow', { DIR: k.slice(6) });
        return null;
      }
      if (x._ === 'Call' && dotted(x.func) === 'Image' && x.args.length === 1 && isConst(x.args[0], 'string')) return imageBlock('mb_show_leds', x.args[0].value);
      const t = T(x);
      if (t === 'img') return B('mb_show_image', null, { IMG: ex(x) });
      if (t === 'str') return B('mb_show_string', null, { TEXT: ex(x) });
      if (t === 'num' || t === 'any' || t === 'bool') return B('mb_show_number', null, { NUM: ex(x) });
      return null;
    }
    function callStmt(n) {
      const f = dotted(n.func), a = n.args, k = kw(n);
      if (a.some((x) => x._ === 'Starred') || (n.keywords || []).some((x) => !x.arg)) return null;
      if (f === 'display.show' && a.length === 1) return showBlock(a[0], false);
      if (f === 'display.scroll' && a.length === 1) return showBlock(a[0], true);
      if (f === 'display.clear' && !a.length) return B('mb_clear');
      if (f === 'display.set_pixel' && a.length === 3) {
        const v = numVal(a[2]);
        if (v === 9) return B('mb_plot', null, { X: ex(a[0]), Y: ex(a[1]) });
        if (v === 0) return B('mb_unplot', null, { X: ex(a[0]), Y: ex(a[1]) });
        return B('mb_plot_brightness', null, { X: ex(a[0]), Y: ex(a[1]), B: v != null ? num(Math.round(v * 255 / 9)) : arith('MULTIPLY', ex(a[2]), num(28)) });
      }
      if (f === 'sleep' && a.length === 1) return B('mb_pause', null, { MS: ex(a[0]) });
      if (f === 'compass.calibrate' && !a.length) return B('mb_calibrate');
      if (f === 'music.pitch' && (a.length >= 2 || k.duration)) {
        const bg = k.wait && k.wait._ === 'Constant' && k.wait.value === false;
        return B('mb_play_tone', { MODE: bg ? 'bg' : 'wait' }, { FREQ: ex(a[0]), MS: ex(a[1] || k.duration) });
      }
      if (f === 'music.play' && a[0] && a[0]._ === 'List' && a[0].elts.every((e) => isConst(e, 'string'))) {
        const bg = k.wait && k.wait._ === 'Constant' && k.wait.value === false;
        if (a[0].elts.some((e) => e.value.includes(':'))) notes.add('멜로디의 음 길이(:2 등)는 MakeCode 멜로디 블록에서 한 박자로 맞춰집니다.');
        return B('mb_play_melody', { MELODY: a[0].elts.map((e) => e.value.split(':')[0]).join(' '), MODE: bg ? 'bg' : 'wait' }, { BPM: num(120) });
      }
      if (f === 'log.set_labels' && a.length && a.every((x) => isConst(x, 'string'))) {
        const t = k.timestamp, d = t ? dotted(t) : 'log.SECONDS';
        const ts = t && t._ === 'Constant' && t.value === null ? 'none' : { 'log.SECONDS': 's', 'log.MILLISECONDS': 'ms', 'log.MINUTES': 'min' }[d];
        if (!ts) return null;
        return B('dl_set_columns', { COLS: a.map((x) => x.value).join(','), TS: ts });
      }
      if (f === 'log.add' && !a.length && n.keywords.length) {
        const fields = {}, inputs = {};
        n.keywords.forEach((x, i) => { fields['COL' + i] = x.arg; inputs['VAL' + i] = ex(x.value); });
        return B('dl_log', fields, inputs, { n: n.keywords.length });
      }
      if (f === 'log.delete') return B('dl_delete');
      if (f === 'print') {
        if (Object.keys(k).some((x) => x !== 'sep')) return null;
        const sep = k.sep ? (isConst(k.sep, 'string') ? k.sep.value : null) : ' ';
        if (sep == null) return null;
        if (!a.length) return B('mb_serial_line', null, { TEXT: txt('') });
        if (a.length === 1) return B('mb_serial_line', null, { TEXT: T(a[0]) === 'str' ? ex(a[0]) : B('mb_to_text', null, { X: ex(a[0]) }) });
        const items = [];
        a.forEach((x, i) => {
          if (i && sep) items.push(txt(sep));
          // print 의 (a, b) 는 MicroPython 처럼 "(a, b)" 글자로
          if (x._ === 'Tuple' && x.elts.length) {
            items.push(txt('('));
            x.elts.forEach((e, j) => { if (j) items.push(txt(', ')); items.push(isConst(e, 'string') ? txt("'" + e.value + "'") : ex(e)); });
            items.push(txt(')'));
          }
          else items.push(ex(x));
        });
        // 이웃한 글자 조각은 하나로 합친다 ("x" + " " → "x ")
        const merged = [];
        items.forEach((it) => { const last = merged[merged.length - 1]; if (last && last.type === 'text' && it.type === 'text') last.fields.TEXT += it.fields.TEXT; else merged.push(it); });
        return B('mb_serial_line', null, { TEXT: merged.length === 1 ? merged[0] : joinOf(merged) });
      }
      if (n.func._ === 'Attribute') {
        const obj = n.func.value, at = n.func.attr, ot = T(obj);
        if (ot.startsWith('list') || (obj._ === 'Name' && !VT.has(obj.id))) {
          if (at === 'append' && a.length === 1) return B('mb_list_push', null, { LIST: ex(obj), VALUE: ex(a[0]) });
          if (at === 'pop' && !a.length) return B('mb_list_remove_last', null, { LIST: ex(obj) });
          if (at === 'pop' && numVal(a[0]) === 0) return B('mb_list_remove_first', null, { LIST: ex(obj) });
          if (at === 'pop' && a.length === 1) return B('mb_list_remove_at', null, { LIST: ex(obj), I: ex(a[0]) });
          if (at === 'insert' && a.length === 2) return B('mb_list_insert', null, { LIST: ex(obj), I: ex(a[0]), VALUE: ex(a[1]) });
        }
      }
      if (f && FN[f]) return fnCall(f, a, k, false);
      return null;
    }
    // 여러 값을 한 번에 넣기 (x, y = …)
    function unpack(names, value) {
      if (value._ === 'Call' && dotted(value.func) === 'accelerometer.get_values' && names.length === 3) return names.map((nm, i) => setv(nm, B('mb_accel', { AXIS: 'xyz'[i] })));
      if ((value._ === 'Tuple' || value._ === 'List') && value.elts.length === names.length) {
        // 오른쪽에서 왼쪽 변수를 읽지 않으면 차례로 넣어도 같다 (a, b = b, a 처럼 겹치면 임시 목록을 거친다)
        const rhs = new Set(); walk(value, (m) => { if (m._ === 'Name') rhs.add(m.id); });
        if (!names.some((nm) => rhs.has(nm))) return names.map((nm, i) => setv(nm, ex(value.elts[i])));
      }
      const tmp = 'tmp_list';
      VT.set(tmp, 'list<num>');
      return [setv(tmp, ex(value)), ...names.map((nm, i) => setv(nm, B('mb_list_get', null, { LIST: getv(tmp), I: num(i) })))];
    }
    function stmts(list) {
      const out = [];
      list.forEach((n) => { const bs = stmt(n); if (bs && bs.length) out.push(...bs); });
      return chain(out);
    }
    function stmt(n) {
      const cm = takeComments(n.ln);
      let r;
      try { r = stmt0(n); } catch (e) { r = null; }
      if (r === undefined) { if (cm.length) pendingCm.push(...cm); return []; }
      if (!r) { dropComments(n.eln); r = [rawStmt(n)]; }
      attach(r[0], pendingCm.splice(0).concat(cm));
      return r;
    }
    const pendingCm = [];
    function stmt0(n) {
      switch (n._) {
        case 'Expr':
          if (isConst(n.value, 'string')) return undefined;
          if (n.value._ === 'Call') { const b = callStmt(n.value); return b ? [b] : null; }
          return null;
        case 'Pass': case 'Global': case 'Import': case 'ImportFrom': return undefined;
        case 'Assign': {
          const v = n.value, out = [];
          // x = A if 조건 else B → 만약 블록
          if (v._ === 'IfExp' && n.targets.length === 1 && n.targets[0]._ === 'Name') {
            const nm = n.targets[0].id;
            return [B('controls_if', null, { IF0: ex(v.test), DO0: setv(nm, ex(v.body)), ELSE: setv(nm, ex(v.orelse)) }, { hasElse: true })];
          }
          for (const t of n.targets) {
            if (t._ === 'Name') out.push(setv(t.id, ex(v)));
            else if (t._ === 'Subscript' && t.slice._ !== 'Slice' && T(t.value).startsWith('list')) out.push(B('mb_list_set', null, { LIST: ex(t.value), I: idx(t.value, t.slice), VALUE: ex(v) }));
            else if ((t._ === 'Tuple' || t._ === 'List') && t.elts.every((e) => e._ === 'Name')) out.push(...unpack(t.elts.map((e) => e.id), v));
            else return null;
          }
          return out;
        }
        case 'AugAssign': {
          const t = n.target, op = n.op._;
          const M = { Add: 'ADD', Sub: 'MINUS', Mult: 'MULTIPLY', Div: 'DIVIDE', Pow: 'POWER' };
          if (t._ === 'Name') {
            if (T(t) !== 'str' && (op === 'Add' || op === 'Sub')) {
              const d = op === 'Add' ? ex(n.value) : numVal(n.value) != null ? num(-numVal(n.value)) : arith('MINUS', num(0), ex(n.value));
              return [B('math_change', VAR(t.id), { DELTA: d })];
            }
            const cur = getv(t.id), rhs = ex(n.value);
            if (op === 'Add' && T(t) === 'str') return [setv(t.id, joinOf([cur, rhs]))];
            if (M[op]) return [setv(t.id, arith(M[op], cur, rhs))];
            if (op === 'Mod') return [setv(t.id, B('math_modulo', null, { DIVIDEND: cur, DIVISOR: rhs }))];
            if (op === 'FloorDiv') return [setv(t.id, fn2('idiv', cur, rhs))];
            return null;
          }
          if (t._ === 'Subscript' && T(t.value).startsWith('list') && M[op]) {
            const get = B('mb_list_get', null, { LIST: ex(t.value), I: idx(t.value, t.slice) });
            return [B('mb_list_set', null, { LIST: ex(t.value), I: idx(t.value, t.slice), VALUE: arith(M[op], get, ex(n.value)) })];
          }
          return null;
        }
        case 'If': {
          const inputs = {};
          let i = 0, cur = n;
          for (;;) {
            inputs['IF' + i] = ex(cur.test);
            inputs['DO' + i] = stmts(cur.body);
            i++;
            if (cur.orelse.length === 1 && cur.orelse[0]._ === 'If') { cur = cur.orelse[0]; pendingCm.push(...takeComments(cur.ln)); continue; }
            break;
          }
          const hasElse = cur.orelse.length > 0;
          if (hasElse) inputs.ELSE = stmts(cur.orelse);
          const ext = {};
          if (i > 1) ext.elseIfCount = i - 1;
          if (hasElse) ext.hasElse = true;
          return [B('controls_if', null, inputs, Object.keys(ext).length ? ext : null)];
        }
        case 'While':
          if (n.orelse.length) return null;
          return [B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: ex(n.test), DO: stmts(n.body) })];
        case 'For': {
          if (n.orelse.length) return null;
          const it = n.iter, f = it._ === 'Call' ? dotted(it.func) : null;
          if (f === 'range' && n.target._ === 'Name' && it.args.length >= 1 && it.args.length <= 3) {
            const [start, stop, step] = it.args.length === 1 ? [null, it.args[0], null] : it.args;
            const v = n.target.id;
            if ((!start || numVal(start) === 0) && !step) {
              const sv = numVal(stop);
              const to = sv != null ? num(sv - 1) : arith('MINUS', ex(stop), num(1));
              return [B('mb_for_index', VAR(v), { TO: to, DO: stmts(n.body) })];
            }
            let cont = false; walk(n.body, (m) => { if (m._ === 'Continue') cont = true; if (m._ === 'For' || m._ === 'While') return false; });
            if (cont) return null;
            const stp = step ? numVal(step) : 1;
            if (stp == null || stp === 0) return null;
            const loopBody = stmts(n.body);
            const inc = B('math_change', VAR(v), { DELTA: num(stp) });
            return [setv(v, start ? ex(start) : num(0)), B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: B('logic_compare', { OP: stp > 0 ? 'LT' : 'GT' }, { A: getv(v), B: ex(stop) }), DO: chain([loopBody, inc]) })];
          }
          if (T(it) === 'str' || T(it).startsWith('dict')) return null;
          if (n.target._ === 'Name') return [B('controls_forEach', VAR(n.target.id), { LIST: ex(it), DO: stmts(n.body) })];
          if (n.target._ === 'Tuple' && n.target.elts.every((e) => e._ === 'Name')) {
            const item = 'item';
            const sets = n.target.elts.map((e, i) => setv(e.id, B('mb_list_get', null, { LIST: getv(item), I: num(i) })));
            return [B('controls_forEach', VAR(item), { LIST: ex(it), DO: chain([...sets, stmts(n.body)]) })];
          }
          return null;
        }
        case 'Break': return [B('controls_flow_statements', { FLOW: 'BREAK' })];
        case 'Continue': return [B('controls_flow_statements', { FLOW: 'CONTINUE' })];
        case 'Return':
          if (!ctx.fn) return null;
          return [B('mb_fn_return', null, n.value && !(n.value._ === 'Constant' && n.value.value === null) ? { VALUE: ex(n.value) } : null)];
        default: return null;
      }
    }

    /* 맨 바깥: 함수 · 시작 · 무한반복 · 이벤트 */
    const tops = [], start = [], events = new Map();
    let forever = null;
    const loopIdx = (() => {
      for (let i = body.length - 1; i >= 0; i--) {
        const n = body[i];
        if (n._ === 'FunctionDef') continue;
        if (n._ === 'While' && n.test._ === 'Constant' && n.test.value === true && !n.orelse.length) {
          let flow = false;
          walk(n.body, (m) => { if (m._ === 'Break' || m._ === 'Continue') flow = true; if (m._ === 'For' || m._ === 'While') return false; }, true);
          return flow ? -1 : i;
        }
        return -1;
      }
      return -1;
    })();
    // if 버튼.was_pressed() [and 조건]: → 이벤트로 옮길 수 있으면 { key, block, extra }
    function eventOf(test) {
      const one = (t) => {
        const f = t._ === 'Call' && !t.args.length ? dotted(t.func) : null;
        let m;
        if (f && (m = /^button_([ab])\.was_pressed$/.exec(f))) return { key: 'btn:' + m[1].toUpperCase(), make: () => B('mb_on_button', { BTN: m[1].toUpperCase() }) };
        if (t._ === 'Call' && dotted(t.func) === 'accelerometer.was_gesture' && isConst(t.args[0], 'string') && GESTURE_BY[t.args[0].value]) { const g = t.args[0].value; return { key: 'g:' + g, make: () => B('mb_on_gesture', { G: g }) }; }
        return null;
      };
      const e = one(test);
      if (e) return Object.assign(e, { extra: null });
      if (test._ === 'BoolOp' && test.op._ === 'And') {
        const hits = test.values.map(one);
        if (hits.filter(Boolean).length !== 1) return null;
        const k = hits.findIndex(Boolean);
        const rest = test.values.filter((_, i) => i !== k);
        let walked = false; rest.forEach((r) => walk(r, (m) => { if (m._ === 'Call' && /was_pressed|was_gesture/.test(dotted(m.func) || '')) walked = true; }));
        if (walked) return null;
        return Object.assign(hits[k], { extra: rest.length === 1 ? rest[0] : { _: 'BoolOp', op: { _: 'And' }, values: rest, py: rest.map((r) => r.py).join(' and ') } });
      }
      return null;
    }
    body.forEach((n, i) => {
      if (n._ === 'FunctionDef') {
        const info = FN[n.name];
        ctx.fn = n.name;
        const cm = takeComments(n.ln);
        const first = n.body[0];
        if (first) cm.push(...takeComments(first.ln - 1));
        if (first && first._ === 'Expr' && isConst(first.value, 'string')) cm.push(first.value.value.trim());
        if (n.decorator_list.length || n.args.vararg || n.args.kwarg || n.args.kwonlyargs.length) { ctx.fn = null; dropComments(n.eln); tops.push(rawStmt(n)); return; }
        const d = B('mb_fn_def', { NAME: n.name, PARAMS: info.params.map(vname).join(', ') }, { DO: stmts(n.body) });
        attach(d, cm);
        if (info.defaults.some(Boolean)) notes.add(`함수 ${n.name}() 의 기본값 매개변수는 MakeCode 에 없어서, 부르는 곳마다 값을 채워 넣었습니다.`);
        tops.push(d);
        ctx.fn = null;
        return;
      }
      if (i !== loopIdx) { start.push(...stmt(n)); return; }
      // 맨 바깥 while True:
      const loopCm = takeComments(n.ln);
      const rest = [];
      n.body.forEach((s) => {
        let ev = s._ === 'If' ? eventOf(s.test) : null;
        // elif 사슬이 모두 버튼 · 제스처 조건이면 하나씩 이벤트로
        const chainIfs = [];
        if (ev) {
          let cur = s;
          for (;;) {
            const e = eventOf(cur.test);
            if (!e) { ev = null; break; }
            chainIfs.push([cur, e]);
            if (!cur.orelse.length) break;
            if (cur.orelse.length === 1 && cur.orelse[0]._ === 'If') { cur = cur.orelse[0]; continue; }
            ev = null; break;
          }
        }
        if (!ev) { rest.push(...stmt(s)); return; }
        chainIfs.forEach(([cur, e]) => {
          const cm = takeComments(cur.ln);
          let h = events.get(e.key);
          if (!h) { h = { block: e.make(), parts: [] }; events.set(e.key, h); attach(h.block, cm); } else attach(h.block, cm);
          const inner = stmts(cur.body);
          h.parts.push(e.extra ? B('controls_if', null, { IF0: ex(e.extra), DO0: inner }) : inner);
        });
      });
      // 잠깐 쉬기(sleep)만 남으면 무한반복은 만들지 않는다 (MakeCode 의 이벤트가 알아서 기다림)
      const onlySleep = (() => { let b = rest[0]; if (!b) return true; for (const x of rest) { let y = x; while (y) { if (y.type !== 'mb_pause') return false; y = y.next && y.next.block; } } return true; })();
      if (!onlySleep || !events.size) { forever = B('mb_forever', null, { DO: chain(rest) }); attach(forever, loopCm); }
      else if (events.size) attach([...events.values()][0].block, loopCm);
      if (events.size) notes.add('맨 바깥 반복의 버튼 · 제스처 조건은 MakeCode 처럼 \'… 누르면 실행\' 이벤트 블록으로 옮겼습니다.');
    });
    events.forEach((h) => { h.block.inputs = h.block.inputs || {}; const c = chain(h.parts); if (c) h.block.inputs.DO = { block: c }; });
    const all = [];
    if (start.length) all.push(B('mb_on_start', null, { DO: chain(start) }));
    all.push(...tops.filter((t) => t.type === 'mb_fn_def'));
    events.forEach((h) => all.push(h.block));
    if (forever) all.push(forever);
    tops.filter((t) => t.type !== 'mb_fn_def').forEach((t) => all.push(B('mb_on_start', null, { DO: t })));
    all.forEach((b, i) => { b.x = 20; b.y = 20 + i * 60; });
    const state = { blocks: { languageVersion: 0, blocks: all }, variables: [...vars.values()] };
    return { state, raw, count, notes: [...notes] };
  }

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
    saveTimer = setTimeout(() => persist(true), 600);
    clearTimeout(codeTimer);
    codeTimer = setTimeout(refreshCode, 250);
  }
  // 고친 블록은 예제마다 저장 (저장 공간을 아끼려고 최근 30개까지만)
  function persist(edited) {
    if (!ws) return;
    const state = Blockly.serialization.workspaces.save(ws);
    if (edited && cur.key) {
      let keys = [];
      try { keys = JSON.parse(store.get('mb.blk.keys') || '[]'); } catch (e) { keys = []; }
      keys = keys.filter((k) => k !== cur.key).concat(cur.key);
      while (keys.length > 30) store.set('mb.blk.' + keys.shift(), null);
      store.set('mb.blk.keys', JSON.stringify(keys));
      store.set('mb.blk.' + cur.key, JSON.stringify(state));
    }
    store.set('mb.blk.last', JSON.stringify({ key: cur.key, title: cur.title, original: cur.original, state }));
  }
  function loadState(state) {
    // 불러오고 정리하는 동안은 '고침'으로 치지 않는다
    Blockly.Events.disable();
    try { ws.clear(); Blockly.serialization.workspaces.load(state, ws); ws.cleanUp(); } finally { Blockly.Events.enable(); }
    ws.scrollCenter();
    const first = ws.getTopBlocks(true)[0];
    if (first) { const xy = first.getRelativeToSurfaceXY(); ws.scroll(-xy.x * ws.scale + 40, -xy.y * ws.scale + 20); }
    refreshCode();
    persist(false);
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

  window.MbBlocks = { openFromCode, openLast, convertPython, genPy: () => ws && genPy(ws), genTs: () => ws && genTs(ws), mkcd: (name) => ws && mkcd(ws, name || projName()), workspace: () => ws };

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
  // 교사용 슬라이드의 코드 칸 (장을 넘길 때마다 다시 그려지므로 바뀔 때마다 붙인다)
  function addSlideButtons() {
    document.querySelectorAll('#slideView .s-editor-bar').forEach((bar) => {
      if (bar.querySelector('.bk-open') || /대화형/.test(bar.textContent) || !bar.querySelector('[data-act="run"]')) return;
      const b = document.createElement('button');
      b.className = 'btn ghost small bk-open';
      b.textContent = '🧩 블록';
      b.title = '이 코드를 MakeCode 블록으로 보기';
      b.onclick = (e) => {
        e.stopPropagation();
        const t = document.querySelector('#slideView .s-title');
        if (app.deck && app.deck.editor) openFromCode(app.deck.editor.getValue(), t ? t.textContent.trim() : '슬라이드 코드', null);
      };
      bar.insertBefore(b, bar.querySelector('[data-act="run"]'));
    });
  }
  function watchSlides() {
    const host = document.getElementById('slideView');
    if (!host || host.dataset.bkWatch) return;
    host.dataset.bkWatch = '1';
    new MutationObserver(() => addSlideButtons()).observe(host, { childList: true, subtree: true });
  }
  const init = () => { addMenu(); watchSlides(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('lb:render', () => { addMenu(); setTimeout(addCodeButtons, 0); });
  setTimeout(addCodeButtons, 0);
})();

/* ── 움직임 조이스틱 (가상의 사람) ────────────────────────────────────────
 * 시뮬레이터 보드 아래에 [🏃 움직임 조이스틱] 칸을 넣습니다.
 * 위로 밀면 걷기(살짝) · 뛰기(끝까지), 옆으로 밀면 왼쪽 · 오른쪽으로 돕니다. 놓으면 멈춥니다.
 * 움직이는 동안 accelerometer 는 걸음마다 출렁이는 값을, compass.heading() 은 바뀐 방향을 돌려줍니다.
 * (가만히 있을 때 출렁임 크기 ≈ 1024, 걷기 봉우리 ≈ 1400~1550, 뛰기 봉우리 ≈ 1900~2200)
 */
(function () {
  'use strict';

  const WALK_LEN = 0.7, RUN_LEN = 1.1;   // 미니 지도용 보폭 (m)
  const st = {
    jx: 0, jy: 0,          // 조이스틱 위치 (-1 ~ 1, 위 = 앞으로)
    hold: false,           // 손을 놓아도 유지
    drag: false,
    phase: 0, lastT: 0,    // 걸음 진행 (1 = 한 걸음)
    steps: 0,
    px: 0, py: 0, trail: [[0, 0]],
    open: true
  };
  let panel = null, simRef = null;

  // 조이스틱 → 움직임 상태 (위로 민 만큼 빠르게)
  function motion() {
    const r = Math.max(0, Math.min(1, -st.jy));
    if (r < 0.08) return { kind: 'stop', label: '멈춤', cad: 0, amp: 0 };
    if (r < 0.6) {
      const t = (r - 0.08) / 0.52;
      return { kind: 'walk', label: '걷기', cad: Math.round(90 + 40 * t), amp: 380 + 140 * t };
    }
    const t = (r - 0.6) / 0.4;
    return { kind: 'run', label: '뛰기', cad: Math.round(140 + 45 * t), amp: 900 + 300 * t };
  }
  const turning = () => Math.abs(st.jx) > 0.15;

  // 시간을 앞으로 돌리며 걸음 · 방향 · 위치를 갱신
  function advance(now) {
    const dt = Math.min(0.2, Math.max(0, (now - (st.lastT || now)) / 1000));
    st.lastT = now;
    const m = motion();
    const s = simRef.s;
    if (turning()) s.heading = (s.heading + st.jx * 90 * dt + 360) % 360;
    if (m.cad) {
      const before = Math.floor(st.phase);
      st.phase += dt * m.cad / 60;
      const n = Math.floor(st.phase) - before;
      for (let i = 0; i < n; i++) {
        st.steps++;
        const L = m.kind === 'run' ? RUN_LEN : WALK_LEN, h = s.heading * Math.PI / 180;
        st.px += Math.sin(h) * L; st.py -= Math.cos(h) * L;
        st.trail.push([st.px, st.py]);
        if (st.trail.length > 600) st.trail.shift();
      }
    }
    return m;
  }

  // 한 걸음 안에서의 출렁임 모양 (0 ~ 1 → 봉우리 하나 + 작은 골짜기)
  function bump(f) {
    if (f < 0.35) return Math.sin(Math.PI * f / 0.35);
    if (f < 0.65) return -0.25 * Math.sin(Math.PI * (f - 0.35) / 0.3);
    return 0;
  }

  // 프로그램이 accelerometer 를 읽을 때 걸음 출렁임을 돌려준다 (멈춤일 때는 원래 값 = 기울기 판)
  function hook(sim) {
    if (sim._mvHooked) return;
    sim._mvHooked = true;
    const orig = sim.accelValues.bind(sim);
    sim.accelValues = function () {
      const now = performance.now();
      if (now < this.s.shakeUntil) return orig();
      const m = advance(now);
      if (!m.cad) return orig();
      const f = st.phase - Math.floor(st.phase);
      const j = () => (Math.random() - 0.5) * 50;
      const mag = 1024 + m.amp * bump(f) + j();
      const sway = Math.sin(Math.PI * st.phase) * m.amp * 0.15;
      const fwd = Math.cos(2 * Math.PI * f) * m.amp * 0.1;
      return [Math.round(sway + j()), Math.round(fwd + j()), Math.round(-Math.sqrt(Math.max(0, mag * mag - sway * sway - fwd * fwd)))];
    };
  }

  function knobTo(x, y) {
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    st.jx = x; st.jy = y;
    paint();
  }

  function build() {
    const out = document.getElementById('output'), tabs = document.getElementById('simTabs');
    if (!out || !tabs || document.getElementById('mvPanel')) return;
    panel = document.createElement('div');
    panel.id = 'mvPanel';
    panel.className = 'mv-panel';
    panel.innerHTML = `<div class="mv-head"><b>🏃 움직임 조이스틱</b><span class="mv-state" id="mvState">멈춤</span><span class="spacer"></span>
        <button class="btn tiny ghost" id="mvToggle" title="접기 · 펴기">▾</button></div>
      <div class="mv-body">
        <div class="mv-joy" id="mvJoy" title="위로 살짝 밀면 걷기 · 끝까지 밀면 뛰기, 옆으로 밀면 돌기"><span class="mv-l t">뛰기</span><span class="mv-l m">걷기</span><span class="mv-l l">⟲</span><span class="mv-l r">⟳</span><i id="mvKnob"></i></div>
        <div class="mv-info">
          <div>케이던스 <b id="mvCad">0</b> 걸음/분</div>
          <div>걸음 <b id="mvSteps">0</b> · 방향 <b id="mvHead">0</b>°</div>
          <div class="btn-row"><button class="btn tiny" data-mv="stop">⏹ 멈춤</button><button class="btn tiny" data-mv="walk">🚶 걷기</button><button class="btn tiny" data-mv="run">🏃 뛰기</button></div>
          <div class="btn-row"><button class="btn tiny ghost" data-mv="left">⟲ 왼쪽 90°</button><button class="btn tiny ghost" data-mv="right">⟳ 오른쪽 90°</button></div>
          <label class="mv-hold"><input type="checkbox" id="mvHold"> 손을 놓아도 계속 움직이기</label>
        </div>
        <div class="mv-map"><canvas id="mvMap" width="120" height="120" title="가상의 사람이 실제로 걸은 길 (정답 경로)"></canvas>
          <button class="btn tiny ghost" id="mvClear" title="걸음 수 · 길 지우기">↺ 지우기</button></div>
      </div>`;
    out.insertBefore(panel, tabs);

    const joy = panel.querySelector('#mvJoy');
    const at = (e) => {
      const b = joy.getBoundingClientRect(), R = b.width / 2 - 12;
      knobTo((e.clientX - b.left - b.width / 2) / R, (e.clientY - b.top - b.height / 2) / R);
    };
    joy.addEventListener('pointerdown', (e) => { st.drag = true; joy.setPointerCapture(e.pointerId); at(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (st.drag) at(e); });
    const up = () => { if (!st.drag) return; st.drag = false; if (!st.hold) knobTo(0, 0); };
    joy.addEventListener('pointerup', up);
    joy.addEventListener('pointercancel', up);

    panel.querySelector('#mvHold').addEventListener('change', (e) => { st.hold = e.target.checked; });
    panel.querySelector('#mvToggle').addEventListener('click', () => { st.open = !st.open; lastView = ''; paint(); });
    panel.querySelector('#mvClear').addEventListener('click', () => { st.steps = 0; st.px = st.py = 0; st.trail = [[0, 0]]; paint(); });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      const k = b.dataset.mv;
      if (k === 'stop') knobTo(0, 0);
      else if (k === 'walk') knobTo(0, -0.35);
      else if (k === 'run') knobTo(0, -0.85);
      else { simRef.s.heading = (simRef.s.heading + (k === 'left' ? 270 : 90)) % 360; simRef.emit('input'); paint(); }
    });
    paint();
  }

  // 미니 지도: 가상의 사람이 실제로 걸은 길 (위 = 북쪽, 방위 0°)
  function drawMap() {
    const c = panel.querySelector('#mvMap');
    const g = c.getContext('2d'), W = c.width, H = c.height, css = getComputedStyle(document.documentElement);
    const col = (n, d) => (css.getPropertyValue(n).trim() || d);
    g.clearRect(0, 0, W, H);
    let span = 6;
    for (const [x, y] of st.trail) span = Math.max(span, Math.abs(x - st.px) * 2 + 2, Math.abs(y - st.py) * 2 + 2);
    span = Math.min(span, 40);
    const k = (W - 10) / span, sx = (x) => W / 2 + (x - st.px) * k, sy = (y) => H / 2 + (y - st.py) * k;
    const grid = span > 20 ? 5 : 1;
    g.strokeStyle = col('--line', '#ccc'); g.lineWidth = 1;
    for (let v = Math.ceil((st.px - span / 2) / grid) * grid; v < st.px + span / 2; v += grid) { g.beginPath(); g.moveTo(sx(v), 0); g.lineTo(sx(v), H); g.stroke(); }
    for (let v = Math.ceil((st.py - span / 2) / grid) * grid; v < st.py + span / 2; v += grid) { g.beginPath(); g.moveTo(0, sy(v)); g.lineTo(W, sy(v)); g.stroke(); }
    g.strokeStyle = col('--accent', '#2a6fdb'); g.lineWidth = 2; g.beginPath();
    st.trail.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
    g.stroke();
    g.fillStyle = col('--ok', '#2a2'); g.beginPath(); g.arc(sx(0), sy(0), 3, 0, 7); g.fill();
    const h = simRef.s.heading * Math.PI / 180, cx = W / 2, cy = H / 2;
    g.fillStyle = col('--danger', '#d33'); g.beginPath();
    g.moveTo(cx + Math.sin(h) * 9, cy - Math.cos(h) * 9);
    g.lineTo(cx + Math.sin(h + 2.5) * 6, cy - Math.cos(h + 2.5) * 6);
    g.lineTo(cx + Math.sin(h - 2.5) * 6, cy - Math.cos(h - 2.5) * 6);
    g.closePath(); g.fill();
    g.fillStyle = col('--muted', '#888'); g.font = '10px sans-serif';
    g.fillText('N↑', W - 18, 11); g.fillText(grid + 'm 칸', 3, H - 4);
  }

  let lastView = '';
  function paint() {
    if (!panel || !simRef) return;
    const m = motion(), head = Math.round(simRef.s.heading) % 360;
    panel.classList.toggle('closed', !st.open);
    panel.querySelector('#mvToggle').textContent = st.open ? '▾' : '▸';
    const knob = panel.querySelector('#mvKnob');
    knob.style.left = (50 + st.jx * 38) + '%';
    knob.style.top = (50 + st.jy * 38) + '%';
    const turn = turning() ? (st.jx < 0 ? ' · 왼쪽으로 돌기' : ' · 오른쪽으로 돌기') : '';
    const view = [m.label + turn, m.cad, st.steps, head, st.trail.length, st.open].join('|');
    if (view === lastView) return;
    lastView = view;
    const stEl = panel.querySelector('#mvState');
    stEl.textContent = m.label + turn;
    stEl.dataset.kind = m.kind;
    panel.querySelector('#mvCad').textContent = m.cad;
    panel.querySelector('#mvSteps').textContent = st.steps;
    panel.querySelector('#mvHead').textContent = head;
    // 🧭 센서 탭의 방위각 슬라이더 · 나침반도 함께 맞춘다
    const sv = app.simView;
    if (sv && sv.tab === 'sensor') {
      sv.sync('heading', head);
      const o = sv.panel.querySelector('[data-out="heading"]');
      if (o) o.textContent = head + '°';
      sv.drawNeedle();
    }
    if (st.open) drawMap();
  }

  function tick() {
    // 프로그램이 센서를 읽지 않을 때도 걸음 · 방향이 흐르게
    if (motion().cad || turning()) advance(performance.now()); else st.lastT = performance.now();
    paint();
  }

  function init() {
    if (!window.app || !app.sim) { setTimeout(init, 200); return; }
    simRef = app.sim;
    hook(simRef);
    build();
    setInterval(tick, 60);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
