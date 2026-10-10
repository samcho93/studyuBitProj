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
