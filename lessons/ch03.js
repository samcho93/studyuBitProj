/* Chapter 03. 걸음 수 세기 — 만보기 만들기 */
(function () {
  /* ───────── 공통 파이썬 조각 (준비된 함수) ───────── */
  const PY_STRENGTH = `def strength():
    # 준비된 함수: 흔들림 세기 (ch02 에서 만든 것)
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))
`;
  const PY_SMOOTH = `recent = []

def smooth(value):
    # 준비된 함수: 최근 4개 값의 평균 (들쭉날쭉한 선을 부드럽게)
    recent.append(value)
    if len(recent) > 4:
        recent.pop(0)
    return sum(recent) // len(recent)
`;
  const PY_STEP = `above = False
last_step = 0

def is_step(value):
    # 준비된 함수: 걸음이면 True
    # 조건 1) 기준선 위로 올라갔다가 내려옴
    # 조건 2) 앞 걸음과 MIN_GAP(ms) 이상 떨어짐
    global above, last_step
    if value > THRESHOLD:
        above = True
        return False
    if above:
        above = False
        now = running_time()
        if now - last_step >= MIN_GAP:
            last_step = now
            return True
    return False
`;

  /* ───────── 그래프 도우미 ───────── */
  const R = Math.round;
  const path = (pts) => 'M' + pts.map((p) => R(p[0]) + ' ' + R(p[1])).join(' L');
  // 걸음 하나의 모양: 시작 x, 폭 w, 기준 y b, 봉우리 높이 h, 골 깊이 d
  const stepShape = (x, w, b, h, d) => [[x, b], [x + w * 0.2, b - 6], [x + w * 0.38, b - h], [x + w * 0.52, b + d], [x + w * 0.7, b + d * 0.4], [x + w, b]];
  const wave = (x0, n, w, b, h, d) => {
    let pts = [];
    for (let i = 0; i < n; i++) {
      const s = stepShape(x0 + i * w, w, b, h, d);
      pts = pts.concat(i ? s.slice(1) : s);
    }
    return path(pts);
  };

  /* ───────── 그림 3-1. 러닝 앱이 보여 주는 숫자 ───────── */
  const FIG_APP = (() => {
    const stat = (y, label, val, unit, color) => `
  <text x="130" y="${y}" font-size="19" fill="var(--muted)">${label}</text>
  <text x="130" y="${y + 36}" font-size="32" font-weight="bold" fill="${color}">${val}<tspan font-size="18" fill="var(--muted)"> ${unit}</tspan></text>`;
    const row = (y, name, how, ch, color) => `
  <rect x="560" y="${y}" width="660" height="66" rx="12" fill="var(--code-bg)" stroke="${color}" stroke-width="3"/>
  <text x="585" y="${y + 41}" font-size="23" font-weight="bold" fill="${color}">${name}</text>
  <text x="760" y="${y + 41}" font-size="20" fill="var(--fg)">${how}</text>
  <text x="1200" y="${y + 41}" text-anchor="end" font-size="19" fill="var(--muted)">${ch}</text>`;
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c3aa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--muted)"/></marker></defs>
  <rect x="90" y="20" width="300" height="380" rx="34" fill="none" stroke="var(--fg)" stroke-width="4"/>
  <rect x="190" y="34" width="100" height="10" rx="5" fill="var(--line)"/>
  <text x="240" y="80" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">오늘의 달리기</text>
  ${stat(115, '걸음 수', '4,812', '걸음', 'var(--danger)')}
  ${stat(185, '케이던스', '168', '걸음/분', 'var(--accent)')}
  ${stat(255, '보폭', '0.9', 'm', 'var(--ok)')}
  ${stat(325, '거리', '4.3', 'km', 'var(--warn)')}
  <path d="M410 210 L530 210" stroke="var(--muted)" stroke-width="4" marker-end="url(#c3aa)"/>
  <text x="470" y="195" text-anchor="middle" font-size="18" fill="var(--muted)">직접 만들기</text>
  <text x="890" y="45" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">micro:bit 로 하나씩 만들어 봅니다</text>
  ${row(70, '걸음 수', '흔들림의 봉우리를 센다', '오늘 (ch03)', 'var(--danger)')}
  ${row(150, '케이던스', '1분 동안 걸음 수', 'ch04', 'var(--accent)')}
  ${row(230, '보폭', '한 걸음의 길이', 'ch05', 'var(--ok)')}
  ${row(310, '거리', '걸음 수 × 보폭', 'ch05', 'var(--warn)')}
</svg>`;
  })();

  /* ───────── 그림 3-2. 한 걸음 = 봉우리 하나 ───────── */
  const FIG_PEAK = (() => {
    const x0 = 120, w = 180, b = 260, n = 6;
    let dots = '';
    for (let i = 0; i < n; i++) {
      const px = R(x0 + i * w + w * 0.38);
      dots += `<circle cx="${px}" cy="${b - 130}" r="9" fill="var(--danger)"/><text x="${px}" y="${b - 145}" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">${i + 1}</text>`;
    }
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c3pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <path d="M110 380 L1230 380" stroke="var(--line)" stroke-width="2" marker-end="url(#c3pa)"/>
  <path d="M110 380 L110 60" stroke="var(--line)" stroke-width="2" marker-end="url(#c3pa)"/>
  <text x="100" y="50" font-size="19" fill="var(--muted)">strength()</text>
  <text x="1220" y="408" text-anchor="end" font-size="19" fill="var(--muted)">시간 →</text>
  <path d="M110 ${b} L1220 ${b}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 6"/>
  <text x="100" y="${b + 6}" text-anchor="end" font-size="17" fill="var(--muted)">1000</text>
  <path d="${wave(x0, n, w, b, 130, 60)}" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linejoin="round"/>
  ${dots}
  <path d="M265 70 L195 120" stroke="var(--danger)" stroke-width="3"/>
  <text x="270" y="70" font-size="20" font-weight="bold" fill="var(--danger)">발이 땅에 “쿵” → 값이 크게 튐 (봉우리)</text>
  <path d="M240 355 L215 323" stroke="var(--ok)" stroke-width="3"/>
  <text x="245" y="368" font-size="20" fill="var(--ok)">몸이 살짝 떠오름 → 값이 작아짐 (골짜기)</text>
  <text x="900" y="368" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">봉우리 6개 = 6걸음</text>
</svg>`;
  })();

  /* ───────── 그림 3-3. 제자리 · 걷기 · 뛰기 비교 ───────── */
  const FIG_COMPARE = (() => {
    const panel = (x, title, d, note1, note2, color) => `
  <rect x="${x}" y="50" width="380" height="290" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="${x + 190}" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="${color}">${title}</text>
  <path d="M${x + 10} 220 L${x + 370} 220" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 6"/>
  <path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>
  <text x="${x + 190}" y="372" text-anchor="middle" font-size="20" fill="var(--fg)">${note1}</text>
  <text x="${x + 190}" y="400" text-anchor="middle" font-size="20" fill="var(--fg)">${note2}</text>`;
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${panel(40, '제자리', wave(50, 6, 60, 220, 8, 6), '봉우리 높이: 거의 없음', '간격: —', 'var(--ok)')}
  ${panel(450, '걷기', wave(460, 3, 120, 220, 80, 40), '봉우리 높이: 중간', '간격: 넓음', 'var(--accent)')}
  ${panel(860, '뛰기', wave(870, 5, 72, 220, 150, 100), '봉우리 높이: 큼', '간격: 좁음', 'var(--danger)')}
</svg>`;
  })();

  /* ───────── 그림 3-4. 기준선 높이에 따라 달라지는 걸음 수 ───────── */
  const FIG_THRESH = (() => {
    const hs = [80, 58, 86, 62];
    const panel = (x, title, th, color) => {
      const w = 88, b = 250;
      let pts = [], cnt = 0, dots = '';
      hs.forEach((h, i) => {
        const sx = x + 14 + i * w;
        const s = [[sx, b], [sx + w * 0.2, b - 6], [sx + w * 0.35, b - h], [sx + w * 0.5, b + 40], [sx + w * 0.65, b], [sx + w * 0.8, b - 28], [sx + w * 0.92, b]];
        pts = pts.concat(i ? s.slice(1) : s);
        if (h > th) { cnt++; dots += `<circle cx="${R(sx + w * 0.35)}" cy="${b - h}" r="7" fill="var(--danger)"/>`; }
        if (28 > th) { cnt++; dots += `<circle cx="${R(sx + w * 0.8)}" cy="${b - 28}" r="7" fill="var(--danger)"/>`; }
      });
      return `
  <rect x="${x}" y="60" width="380" height="260" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="${x + 190}" y="44" text-anchor="middle" font-size="23" font-weight="bold" fill="${color}">${title}</text>
  <path d="${path(pts)}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"/>
  <path d="M${x + 8} ${b - th} L${x + 372} ${b - th}" stroke="${color}" stroke-width="3" stroke-dasharray="10 6"/>
  ${dots}
  <text x="${x + 190}" y="360" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--fg)">센 걸음: ${cnt}걸음 (진짜 4걸음)</text>`;
    };
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${panel(40, '기준선이 너무 낮음', 20, 'var(--warn)')}
  ${panel(450, '알맞은 기준선', 45, 'var(--ok)')}
  ${panel(860, '기준선이 너무 높음', 72, 'var(--danger)')}
  <text x="230" y="400" text-anchor="middle" font-size="19" fill="var(--muted)">작은 흔들림까지 걸음으로 셈</text>
  <text x="640" y="400" text-anchor="middle" font-size="19" fill="var(--muted)">진짜 봉우리만 셈</text>
  <text x="1050" y="400" text-anchor="middle" font-size="19" fill="var(--muted)">약한 걸음을 놓침</text>
</svg>`;
  })();

  /* ───────── 그림 3-5. 들쭉날쭉한 선을 부드럽게 — smooth() ───────── */
  const FIG_SMOOTH = (() => {
    const raw = [];
    for (let i = 0; i < 46; i++) {
      const wv = Math.max(0, Math.sin(i * 0.55)) * 95 - Math.max(0, -Math.sin(i * 0.55)) * 35;
      const noise = (((i * 37) % 11) - 5) * 9;
      raw.push(250 - wv + noise);
    }
    const sm = raw.map((v, i) => { const a = raw.slice(Math.max(0, i - 3), i + 1); return a.reduce((p, q) => p + q, 0) / a.length; });
    const toPts = (arr) => arr.map((v, i) => [70 + i * 16, v]);
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <path d="M60 380 L800 380 M60 380 L60 60" stroke="var(--line)" stroke-width="2"/>
  <path d="${path(toPts(raw))}" fill="none" stroke="var(--muted)" stroke-width="2.5"/>
  <path d="${path(toPts(sm))}" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linejoin="round"/>
  <rect x="80" y="20" width="22" height="6" fill="var(--muted)"/><text x="110" y="30" font-size="19" fill="var(--muted)">원래 값 (들쭉날쭉)</text>
  <rect x="330" y="18" width="22" height="10" fill="var(--accent)"/><text x="360" y="30" font-size="19" fill="var(--accent)">smooth() 로 다듬은 값</text>
  <text x="430" y="410" text-anchor="middle" font-size="18" fill="var(--muted)">시간 →</text>
  <rect x="850" y="70" width="390" height="290" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1045" y="110" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--accent)">smooth(value) 가 하는 일</text>
  <text x="875" y="155" font-size="20" fill="var(--fg)">최근 값 4개를 모아 평균을 냅니다</text>
  <text x="875" y="200" font-size="20" fill="var(--fg)">1100, 1400, 900, 1200</text>
  <text x="875" y="240" font-size="20" fill="var(--fg)">→ 더해서 4600 ÷ 4 = <tspan font-weight="bold" fill="var(--accent)">1150</tspan></text>
  <text x="875" y="290" font-size="19" fill="var(--muted)">튀는 값 하나가 있어도</text>
  <text x="875" y="318" font-size="19" fill="var(--muted)">다른 값과 섞여 얌전해집니다</text>
</svg>`;
  })();

  /* ───────── 그림 3-6. is_step() 의 두 조건 ───────── */
  const FIG_ISSTEP = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <path d="M50 340 L810 340 M50 340 L50 60" stroke="var(--line)" stroke-width="2"/>
  <path d="M50 180 L810 180" stroke="var(--danger)" stroke-width="3" stroke-dasharray="10 6"/>
  <text x="815" y="186" font-size="19" font-weight="bold" fill="var(--danger)">기준선</text>
  <path d="M60 250 L120 245 L160 100 L190 300 L230 270 L300 250 L360 245 L400 110 L420 205 L440 140 L470 300 L510 270 L580 250 L620 245 L660 100 L690 300 L730 270 L800 250" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linejoin="round"/>
  <text x="170" y="80" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">1 ✔</text>
  <text x="400" y="90" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">2 ✔</text>
  <text x="470" y="125" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">✕</text>
  <text x="665" y="80" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">3 ✔</text>
  <text x="440" y="378" text-anchor="middle" font-size="19" fill="var(--danger)">✕ = 한 걸음 안에서 값이 두 번 튐 (겨우 80ms 뒤) → 무시</text>
  <text x="430" y="408" text-anchor="middle" font-size="18" fill="var(--muted)">시간 →</text>
  <rect x="890" y="50" width="350" height="140" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="910" y="90" font-size="22" font-weight="bold" fill="var(--accent)">조건 ① 기준선 넘기</text>
  <text x="910" y="128" font-size="19" fill="var(--fg)">기준선 위로 올라갔다가</text>
  <text x="910" y="158" font-size="19" fill="var(--fg)">다시 내려오면 → 걸음 후보</text>
  <rect x="890" y="215" width="350" height="140" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="910" y="255" font-size="22" font-weight="bold" fill="var(--warn)">조건 ② 최소 간격</text>
  <text x="910" y="293" font-size="19" fill="var(--fg)">앞 걸음과 약 300ms 이상</text>
  <text x="910" y="323" font-size="19" fill="var(--fg)">떨어져 있어야 → 진짜 걸음</text>
</svg>`;

  /* ───────── 그림 3-7. 만보기 프로그램의 흐름 ───────── */
  const FIG_PEDO = (() => {
    const box = (x, y, w, t1, t2, color) => `
  <rect x="${x}" y="${y}" width="${w}" height="92" rx="14" fill="var(--code-bg)" stroke="${color}" stroke-width="3"/>
  <text x="${x + w / 2}" y="${y + 40}" text-anchor="middle" font-size="21" font-weight="bold" fill="${color}">${t1}</text>
  <text x="${x + w / 2}" y="${y + 70}" text-anchor="middle" font-size="18" fill="var(--muted)">${t2}</text>`;
    const arr = (x1, x2, y) => `<path d="M${x1} ${y} L${x2} ${y}" stroke="var(--fg)" stroke-width="3" marker-end="url(#c3fa)"/>`;
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c3fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="640" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">while True: 안에서 0.02초마다 되풀이</text>
  ${box(30, 70, 200, '① 값 읽기', 'strength()', 'var(--accent)')}
  ${arr(230, 275, 116)}
  ${box(280, 70, 200, '② 다듬기', 'smooth()', 'var(--accent)')}
  ${arr(480, 525, 116)}
  ${box(530, 70, 200, '③ 걸음인가?', 'is_step()', 'var(--warn)')}
  ${arr(730, 775, 116)}
  <text x="752" y="100" text-anchor="middle" font-size="17" fill="var(--ok)">예</text>
  ${box(780, 70, 220, '④ steps + 1', '가운데 점 깜빡', 'var(--ok)')}
  ${arr(1000, 1045, 116)}
  ${box(1050, 70, 200, '⑤ 100걸음마다', 'music 짧은 소리', 'var(--danger)')}
  <path d="M630 162 L630 230 L130 230 L130 168" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#c3fa)"/>
  <text x="645" y="205" font-size="17" fill="var(--muted)">아니요 → 처음으로</text>
  <path d="M1150 162 L1150 230 L630 230" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="8 6"/>
  ${box(250, 285, 340, 'A 버튼', '지금까지 걸음 수 보기 (scroll)', 'var(--fg)')}
  ${box(690, 285, 340, 'B 버튼', '걸음 수를 0 으로', 'var(--fg)')}
</svg>`;
  })();

  /* ───────── 그림 3-8. 착용 위치에 따른 차이 ───────── */
  const FIG_WEAR = (() => {
    const row = (y, color, name, d, note) => `
  <circle cx="440" cy="${y}" r="14" fill="${color}"/>
  <text x="470" y="${y + 8}" font-size="23" font-weight="bold" fill="${color}">${name}</text>
  <path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>
  <text x="900" y="${y + 8}" font-size="20" fill="var(--fg)">${note}</text>`;
    const messy = path([[580, 90], [600, 70], [615, 115], [630, 60], [650, 120], [665, 75], [680, 105], [700, 55], [715, 118], [730, 80], [750, 100], [770, 65], [790, 112], [810, 75], [840, 90]]);
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <circle cx="190" cy="70" r="32" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <path d="M190 102 L190 250 M190 140 L120 215 M190 140 L255 200 M190 250 L140 380 M190 250 L245 375" fill="none" stroke="var(--fg)" stroke-width="6" stroke-linecap="round"/>
  <circle cx="120" cy="215" r="14" fill="var(--warn)"/>
  <circle cx="190" cy="235" r="14" fill="var(--ok)"/>
  <circle cx="140" cy="370" r="14" fill="var(--danger)"/>
  <path d="M134 215 L425 90 M204 235 L425 210 M154 370 L425 330" stroke="var(--line)" stroke-width="2" stroke-dasharray="6 6"/>
  ${row(90, 'var(--warn)', '손목', messy, '팔 흔들림이 섞여 들쭉날쭉')}
  ${row(210, 'var(--ok)', '허리', wave(580, 4, 65, 210, 50, 25), '봉우리가 고르고 또렷함')}
  ${row(330, 'var(--danger)', '발목', wave(580, 2, 130, 345, 85, 30), '아주 큰 봉우리 · 한쪽 발만 셈')}
</svg>`;
  })();

  MB_COURSE.addChapter({
    id: 'ch03', no: '03',
    title: '걸음 수 세기 — 만보기 만들기',
    subtitle: '봉우리(peak) · 기준선(threshold) · smooth() · is_step() · running_time() · 만보기',
    summary: '걸을 때 생기는 흔들림 그래프에서 <b>봉우리(peak)</b>를 찾아 걸음 수를 셉니다. 1교시에는 그래프를 읽고 <b>기준선</b>을 정하며, 2교시에는 준비된 함수 <code>is_step()</code> 으로 <b>만보기</b>를 완성합니다. 기준선 높이 · 착용 위치 · 차량 진동처럼 걸음 수가 틀어지는 까닭을 미리 토론하고, 실제 보드를 차고 걸어서 오차를 기록합니다.',
    goals: [
      '걸을 때 생기는 <code>strength()</code> 그래프에서 <b>봉우리 하나 = 한 걸음</b>임을 설명할 수 있다',
      '제자리 · 걷기 · 뛰기의 봉우리 높이와 간격을 비교하고 우리 모둠의 <b>기준선(threshold)</b>을 정할 수 있다',
      '준비된 함수 <code>smooth()</code> 로 들쭉날쭉한 값을 부드럽게 다듬을 수 있다',
      '준비된 함수 <code>is_step()</code> 의 두 조건(기준선 넘기 · 최소 간격)을 말하고 <code>running_time()</code> 이 왜 필요한지 설명할 수 있다',
      'A · B 버튼, LED 깜빡임, 목표 알림 소리가 있는 <b>만보기</b>를 완성할 수 있다',
      '착용 위치 · 차량 진동 · 계단처럼 걸음 수가 틀어지는 상황을 미리 토론하고 실제 보드로 오차를 기록할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch03-1',
        title: '걸음은 어떻게 생길까 — 가속도 그래프 읽기',
        minutes: 50,
        goals: [
          '러닝 앱이 보여 주는 숫자(걸음 수 · 케이던스 · 보폭 · 거리) 중 오늘 만들 것을 말할 수 있다',
          '<code>strength()</code> 값을 콘솔에 계속 찍어 그래프처럼 읽고, 봉우리 하나가 한 걸음임을 설명할 수 있다',
          '기준선(threshold)을 넘었다 내려오면 한 걸음으로 세는 방법을 이해하고, <code>smooth()</code> 로 값을 다듬을 수 있다',
          '제자리 · 걷기 · 뛰기의 최고값 · 최저값을 기록표로 정리해 모둠의 기준값을 정할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['러닝 데이터 프로젝트 소개', 4], ['봉우리 = 한 걸음', 8], ['움직임 비교', 8], ['기준선', 7], ['smooth() 다듬기', 6], ['토론: 기준선 높이', 5], ['실습: 기록표 · 기준값', 7]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '걸을 때 <b>주머니 속 휴대폰</b>은 어떤 모양으로 흔들릴까요? 휴대폰이 위아래로 흔들리는 모습을 시간에 따라 <b>선으로 그려</b> 오세요. 가로는 시간, 세로는 높이입니다. 반듯한 물결일까요, 뾰족한 톱니일까요? 정답은 없으니 떠오르는 대로 그리면 됩니다.' },
          { type: 'p', html: '그려 온 선을 짝과 비교해 봅니다. 많은 친구들이 <b>오르락내리락하는 물결</b>을 그렸을 것입니다. 걸을 때 우리 몸은 발을 디딜 때마다 아래로 “쿵” 내려앉았다가 다시 떠오릅니다. 이 오르내림이 걸음마다 한 번씩 되풀이되지요. 오늘은 micro:bit 가 느끼는 이 물결을 직접 보고, <b>물결이 몇 번 있었는지 세어서</b> 걸음 수를 알아냅니다.' },

          { type: 'h', text: '러닝 붐과 러닝 데이터' },
          { type: 'p', html: '요즘 공원이나 강변에서 달리는 사람을 많이 볼 수 있습니다. 달리기를 즐기는 사람들은 휴대폰이나 스마트워치의 <b>러닝 앱</b>으로 기록을 확인합니다. 앱 화면에는 <b>걸음 수</b>, <b>케이던스</b>(1분 동안 걸음 수), <b>보폭</b>(한 걸음의 길이), <b>거리</b> 같은 숫자가 나옵니다. 이런 숫자를 <b>러닝 데이터</b>라고 부릅니다.' },
          { type: 'figure', html: FIG_APP, caption: '그림 3-1. 러닝 앱이 보여 주는 숫자와 이 강좌에서 만들 순서' },
          { type: 'p', html: '이 숫자들은 모두 <b>걸음 수</b>에서 출발합니다. 걸음을 셀 수 있어야 1분 동안 몇 걸음인지(케이던스)도, 걸음 수에 보폭을 곱한 거리도 구할 수 있습니다. 그래서 러닝 데이터 측정기의 첫 단계는 <b>만보기</b>입니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 오늘은 어디쯤?', html: 'ch01 에서 본 개발 계단을 떠올려 봅니다. <b>문제 정하기 → 잴 것 정하기 → 센서 읽기 → 계산하기</b> → 저장하기 → 보여 주기 → 고치기. 오늘 1교시는 “센서 읽기”와 “계산하기” 사이에서 <b>걸음을 어떻게 알아볼지</b> 정하는 단계입니다.' },

          { type: 'h', text: '한 걸음 = 그래프의 봉우리 하나' },
          { type: 'p', html: 'ch02 에서 만든 준비된 함수 <code>strength()</code> 를 다시 씁니다. 세 방향 값을 하나로 합친 <b>흔들림 세기</b>였지요. 가만히 있으면 약 1000(중력 1배)이고, 걸으면 1000 위아래로 출렁입니다.' },
          { type: 'p', html: '출렁임을 자세히 보면 규칙이 있습니다. <b>발이 땅에 닿는 순간</b> 몸이 “쿵” 하고 멈추면서 값이 크게 튀어 오릅니다. 이렇게 뾰족하게 솟은 곳을 <b>봉우리(peak)</b>라고 합니다. 그다음 몸이 살짝 떠오르는 동안에는 값이 1000 아래로 내려가 <b>골짜기</b>가 생깁니다.' },
          { type: 'figure', html: FIG_PEAK, caption: '그림 3-2. 걸을 때 strength() 그래프 — 봉우리 하나가 한 걸음' },
          { type: 'p', html: '그래서 걸음 수를 세는 방법은 아주 단순합니다. <b>그래프에서 봉우리가 몇 개인지 세면 됩니다.</b> 그림 3-2 에는 봉우리가 6개 있으니 6걸음입니다. 이제 이 일을 micro:bit 가 대신 하도록 만들면 됩니다.' },

          { type: 'h', text: '콘솔에 값을 계속 찍어 그래프처럼 보기' },
          { type: 'p', html: '그래프를 그리는 도구가 없어도 괜찮습니다. 값을 <b>아주 빠르게, 한 줄에 하나씩</b> 찍고 값만큼 별(<code>*</code>)을 그리면, 콘솔을 옆으로 눕혀 본 그래프처럼 보입니다. 별 막대가 길어지는 곳이 봉우리입니다.' },
          {
            type: 'code', title: '예제 3-1. 흔들림을 별 그래프로 찍기', code: `from microbit import *
import math

` + PY_STRENGTH + `
while True:
    s = strength()
    bar = (s - 500) // 50      # 500 보다 큰 만큼 별 막대
    if bar < 0:
        bar = 0
    print(s, "*" * bar)
    sleep(50)`,
            desc: '값에서 500 을 빼고 50 으로 나눈 만큼 별을 찍습니다. 1000 이면 별 10개, 1500 이면 별 20개입니다. 500 을 빼는 까닭은 출렁이는 부분을 <b>더 크게 보이게</b> 하려는 것입니다.',
            hint: '<b>움직임 조이스틱</b>을 살짝 밀어 가상의 사람을 걷게 하고, 콘솔에서 별 막대가 길어졌다 짧아지는 모양을 보세요. 길게 튀는 줄 하나가 한 걸음입니다.',
            expect: '1024 **********\n1010 **********\n1390 *****************\n 870 *******\n1020 ********** …',
            nondeterministic: true
          },
          { type: 'p', html: '콘솔을 보면 별 막대가 <b>규칙적으로 길게 튀는 줄</b>이 보입니다. 그 줄이 바로 발이 땅에 닿은 순간입니다. 막대가 길게 튀는 줄 사이에 몇 줄이 있는지도 살펴보세요. 그 줄 수가 걸음과 걸음 사이의 <b>간격</b>입니다.' },
          {
            type: 'code', title: '예제 3-2. 셸에서 흔들림 세기 물어보기', repl: true, code: `from microbit import *
import math
def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

strength()
strength()`,
            desc: '셸에서 함수를 한 번 만들어 두면 <code>strength()</code> 를 입력할 때마다 지금 값을 바로 알려 줍니다. 가만히 있을 때와 조이스틱으로 걷게 했을 때 값을 비교해 봅니다.',
            hint: '<code>def</code> 줄을 다 입력한 뒤에는 빈 줄에서 Enter 를 한 번 더 눌러야 함수가 완성됩니다.',
            expect: '>>> strength()\n1024\n>>> strength()\n1312',
            nondeterministic: true
          },

          { type: 'h', text: '움직임 시뮬레이션 — 제자리 · 걷기 · 뛰기 비교' },
          { type: 'p', html: '가상의 사람을 <b>제자리</b>에 세워 두고, <b>걷기</b>, <b>뛰기</b>로 바꾸면서 별 그래프를 비교해 봅니다. 두 가지를 눈여겨봅니다. 첫째, <b>봉우리 높이</b>(별 막대가 얼마나 길게 튀는가). 둘째, <b>봉우리 간격</b>(튀는 줄 사이가 몇 줄인가).' },
          { type: 'figure', html: FIG_COMPARE, caption: '그림 3-3. 제자리 · 걷기 · 뛰기의 그래프 모양 비교' },
          {
            type: 'table', caption: '표 3-1. 움직임에 따른 봉우리의 높이와 간격',
            head: ['움직임', '봉우리 높이', '봉우리 간격', '그래프 모양'],
            rows: [
              ['제자리', '거의 없음', '—', '1000 근처에서 잔잔함'],
              ['걷기', '중간', '넓음 (천천히)', '규칙적인 물결'],
              ['뛰기', '큼', '좁음 (빠르게)', '크고 촘촘한 톱니']
            ]
          },
          { type: 'p', html: '제자리에 서 있어도 값이 <b>완전히 1000 에 멈춰 있지는 않습니다</b>. 숨을 쉬거나 몸이 조금만 흔들려도 값이 아주 조금씩 움직입니다. 이런 작은 흔들림을 <b>잡음(noise)</b>이라고 합니다. 잡음까지 걸음으로 세면 안 되겠지요? 그래서 다음에 배울 <b>기준선</b>이 필요합니다.' },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '움직임 조이스틱 대신 <b>🧭 센서</b> 탭의 <b>흔들기(shake)</b> 제스처 버튼을 일정한 박자로 눌러도 봉우리를 만들 수 있습니다. 버튼을 한 번 누를 때마다 값이 크게 튀는 줄이 하나 생깁니다.' },

          { type: 'h', text: '기준선(threshold) — 높이 올라갔다가 내려오면 한 걸음' },
          { type: 'p', html: '봉우리를 micro:bit 가 알아보게 하려면 <b>“이만큼 넘으면 봉우리”</b>라는 약속이 필요합니다. 그래프에 가로로 선을 하나 긋고, 값이 <b>그 선 위로 올라갔다가 다시 내려오면 한 걸음</b>으로 셉니다. 이 선을 <b>기준선(threshold)</b>이라고 합니다.' },
          { type: 'list', ordered: true, items: [
            '값이 기준선보다 커지면 → “지금 봉우리 위에 있다”고 기억합니다 (<code>above = True</code>).',
            '봉우리 위에 있다가 값이 기준선 아래로 내려오면 → <b>한 걸음!</b> 하고 셉니다.',
            '다시 “봉우리 위에 있지 않다”로 바꿉니다 (<code>above = False</code>).'
          ] },
          { type: 'p', html: '왜 “넘을 때” 바로 세지 않고 “넘었다가 내려올 때” 셀까요? 봉우리 위에 있는 동안에는 값이 여러 번 연속으로 기준선보다 큽니다. 넘을 때마다 세면 봉우리 하나를 여러 번 세게 됩니다. <b>내려오는 순간에 한 번만</b> 세면 봉우리 하나에 딱 한 걸음이 됩니다.' },
          {
            type: 'code', title: '예제 3-3. 기준선 위에 있는지 보기', code: `from microbit import *
import math

` + PY_STRENGTH + `
THRESHOLD = 1200    # 기준선

while True:
    s = strength()
    if s > THRESHOLD:
        print(s, "▲ 기준선 위")
        display.set_pixel(2, 2, 9)
    else:
        print(s)
        display.set_pixel(2, 2, 0)
    sleep(50)`,
            desc: '값이 기준선보다 크면 콘솔에 <b>▲ 기준선 위</b>가 붙고 LED 가운데 점이 켜집니다. 걸을 때 점이 걸음마다 한 번씩 반짝이는지 보세요.',
            hint: '조이스틱으로 걷기 · 뛰기를 해 보며 가운데 점이 깜빡이는 박자를 봅니다. 제자리에서는 점이 켜지지 않아야 합니다.',
            expect: '1020\n1260 ▲ 기준선 위\n1310 ▲ 기준선 위\n 880\n1010 …',
            nondeterministic: true
          },
          {
            type: 'code', title: '예제 3-4. 기준선을 넘었다 내려오면 한 걸음', code: `from microbit import *
import math

` + PY_STRENGTH + `
THRESHOLD = 1200    # 기준선
above = False       # 지금 봉우리 위에 있나?
count = 0

while True:
    s = strength()
    if s > THRESHOLD:
        above = True
    elif above:             # 봉우리 위에 있다가 내려옴
        above = False
        count += 1
        print("한 걸음!", count)
    sleep(20)`,
            desc: '이제 걸음을 셉니다. <code>above</code> 는 “지금 봉우리 위에 있나?”를 기억하는 변수입니다. <code>elif above:</code> 는 “기준선 아래인데, 방금 전까지 봉우리 위에 있었다면”이라는 뜻입니다. 값을 더 자주 보도록 <code>sleep(20)</code> 으로 바꾸었습니다.',
            hint: '조이스틱으로 10걸음쯤 걷게 한 뒤 멈추고, 콘솔에 찍힌 숫자가 실제 걸음 수와 비슷한지 확인하세요.',
            expect: '한 걸음! 1\n한 걸음! 2\n한 걸음! 3 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'warn', title: '가끔 한 걸음을 두 번 세요', html: '예제 3-4 를 오래 돌려 보면 가끔 한 걸음에 숫자가 <b>2씩</b> 올라가는 일이 생깁니다. 봉우리 꼭대기에서 값이 들쭉날쭉해서 기준선을 <b>잠깐 내려갔다가 다시 넘는</b> 일이 생기기 때문입니다. 다음에 배울 <code>smooth()</code> 가 이 문제를 줄여 줍니다.' },

          { type: 'h', text: '흔들리는 값 다듬기 — smooth()' },
          { type: 'p', html: '센서 값은 원래 조금씩 <b>들쭉날쭉</b>합니다. 이 들쭉날쭉한 선을 <b>부드럽게</b> 만드는 준비된 함수가 <code>smooth(value)</code> 입니다. 넣는 것은 지금 값 하나, 나오는 것은 <b>최근 값 4개의 평균</b>입니다.' },
          { type: 'figure', html: FIG_SMOOTH, caption: '그림 3-5. smooth() 로 들쭉날쭉한 선을 부드럽게 다듬기' },
          { type: 'p', html: '친구 네 명이 각자 잰 키를 평균 내면 한 사람이 잘못 재더라도 크게 틀리지 않는 것과 같습니다. 이런 방법을 <b>이동 평균 필터(moving average filter)</b>라고 부릅니다. 이름은 어렵지만 “최근 몇 개를 평균 낸다”는 것만 기억하면 됩니다.' },
          {
            type: 'code', title: '예제 3-5. 원래 값과 다듬은 값 나란히 보기', code: `from microbit import *
import math

` + PY_STRENGTH + `
` + PY_SMOOTH + `
while True:
    s = strength()
    sm = smooth(s)
    print("원래", s, " 다듬음", sm)
    sleep(20)`,
            desc: '두 숫자를 나란히 찍어 봅니다. 원래 값은 위아래로 크게 튀지만, 다듬은 값은 <b>천천히, 부드럽게</b> 바뀝니다. 봉우리의 높이는 조금 낮아지지만 모양은 그대로 남습니다.',
            hint: '조이스틱으로 걷게 하면서 두 숫자의 움직임을 비교하세요. 다듬은 값이 원래 값을 조금 늦게 따라가는 것도 보입니다.',
            expect: '원래 1024  다듬음 1024\n원래 1380  다듬음 1113\n원래 1150  다듬음 1145\n원래  870  다듬음 1106 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '몇 개를 평균 내면 좋을까요?', html: '함수 안의 <code>4</code> 를 키우면 선이 더 부드러워지지만 봉우리가 낮아지고 반응이 늦어집니다. 너무 작으면 다듬는 효과가 거의 없습니다. 이 강좌에서는 4 를 씁니다. <code>global</code> 이나 <code>pop(0)</code> 같은 함수 속 내용은 몰라도 괜찮습니다.' },
          {
            type: 'code', title: '예제 3-6. 다듬은 값으로 걸음 세기', code: `from microbit import *
import math

` + PY_STRENGTH + `
` + PY_SMOOTH + `
THRESHOLD = 1150    # 다듬으면 봉우리가 낮아지니 기준선도 조금 낮게
above = False
count = 0

while True:
    s = smooth(strength())
    if s > THRESHOLD:
        above = True
    elif above:
        above = False
        count += 1
        print("한 걸음!", count)
    sleep(20)`,
            desc: '예제 3-4 와 같은데 <code>strength()</code> 를 <code>smooth()</code> 에 한 번 넣었습니다. <code>smooth(strength())</code> 는 “지금 세기를 재서, 다듬은 값을 받는다”는 뜻입니다. 한 걸음을 두 번 세는 일이 훨씬 줄어듭니다.',
            hint: '예제 3-4 와 3-6 을 번갈아 실행하며 조이스틱으로 같은 시간만큼 걷게 해 보세요. 어느 쪽이 더 정확한가요?',
            expect: '한 걸음! 1\n한 걸음! 2\n한 걸음! 3 …',
            nondeterministic: true
          },

          { type: 'h', text: '실시간 그래프로 보기 — 가속도 그래프 도구' },
          { type: 'p', html: '별 그래프 대신 진짜 선 그래프로 볼 수도 있습니다. 위쪽 막대의 <b>📉 가속도 그래프</b>를 누르면 <b>x · y · z</b> 와 세기 <b>√(x²+y²+z²)</b> 네 가지 값이 실시간 선으로 그려집니다. 보고 싶은 값만 골라서 켤 수 있고, 시뮬레이터는 코드를 실행하지 않아도 바로 그려집니다.' },
          {
            type: 'code', title: '더 해 보기 — 가속도 값을 그래프 도구로 보내기', code: `from microbit import *

while True:
    x, y, z = accelerometer.get_values()
    print(x, y, z)      # 한 줄에 숫자 3개 → 그래프 도구가 읽음
    sleep(40)`,
            desc: '한 줄에 숫자 3개(x y z)를 찍는 프로그램입니다. 그래프 도구의 <b>값 받는 곳</b>이 <b>자동</b>이면 콘솔에 찍히는 이 줄을 읽어 그래프를 그립니다. 실제 보드에 연결해 실행하면 <b>진짜 보드의 움직임</b>이 그래프에 나타납니다.',
            hint: '그래프 창을 연 채로 ▶ 실행하고, 조이스틱으로 걷기 · 뛰기를 해 보세요. 창은 머리줄을 끌어 옮길 수 있습니다.',
            expect: '-12 20 -1024\n-30 64 -1310\n25 -8 -880 …',
            nondeterministic: true
          },
          { type: 'figure', html: '<div class="ag-launch"><span class="muted">위쪽 막대의 <b>📉 가속도 그래프</b> 메뉴를 누르세요.</span></div>' },
          { type: 'p', html: '그래프 도구 아래의 <b>필터 · 계산 설정</b>은 오늘 배운 방법과 같습니다. 숫자를 바꿔 가며 걸음 수가 어떻게 달라지는지 비교해 보세요.' },
          { type: 'list', ordered: true, items: [
            '<b>연습용 튀는 값 섞기</b>를 켜면 가끔 값이 크게 튑니다. <b>튀는 값 처리</b>를 “안 함” → “바로 앞 값으로 바꾸기” → “중앙값”으로 바꾸며 선이 어떻게 달라지는지 봅니다.',
            '<b>이동 평균 smooth() 개수</b>를 1(다듬지 않음)과 4(예제 3-5)로 바꿔 봅니다. 흐린 선은 다듬기 전, 굵은 선은 다듬은 값입니다.',
            '<b>② 이동 평균</b> 방식을 “최근 개수” 대신 <b>“시간 폭”</b>으로 바꾸고 100 ms · 300 ms 로 맞춰 봅니다. “최근 개수”는 최근 몇 개의 값을, “시간 폭”은 최근 몇 ms 동안 들어온 값을 평균 냅니다. 실제 보드처럼 값이 들어오는 빠르기가 들쭉날쭉할 때는 시간 폭이 더 고르게 다듬습니다.',
            '<b>기준선 THRESHOLD</b> 와 <b>MIN_GAP</b> 을 바꾸며, 걸음 수 카드의 숫자와 “필터 없이” 센 숫자를 비교합니다. 세기 선 위의 ▼ 표시가 걸음으로 센 곳입니다.',
            '케이던스 · 보폭 · 거리 카드는 ch04 · ch05 에서 만들 계산을 미리 보여 줍니다.'
          ] },

          { type: 'h', text: '토론 — 기준선을 너무 낮게 / 너무 높게 정하면?' },
          { type: 'p', html: '기준선은 우리가 정하는 숫자입니다. 아무 숫자나 넣어도 프로그램은 돌아가지만, 결과는 크게 달라집니다. 그림 3-4 를 보고 모둠에서 이야기해 봅니다.' },
          { type: 'figure', html: FIG_THRESH, caption: '그림 3-4. 기준선 높이에 따라 달라지는 걸음 수 (진짜 걸음은 4걸음)' },
          { type: 'list', items: [
            '💬 기준선이 <b>너무 낮으면</b> 어떤 일이 생길까요? (작은 흔들림 · 잡음까지 걸음으로 셀 수 있습니다)',
            '💬 기준선이 <b>너무 높으면</b> 어떤 일이 생길까요? (살살 걷는 걸음을 놓칠 수 있습니다)',
            '💬 걷기에 맞춰 정한 기준선으로 <b>뛰기</b>를 재면 어떨까요? 반대로 뛰기에 맞춘 기준선으로 걷기를 재면?',
            '💬 키나 몸무게, 신발이 다른 친구가 같은 기준선을 써도 될까요?'
          ] },
          {
            type: 'code', title: '응용 3-7. 기준선 세 개로 동시에 세어 비교하기', code: `from microbit import *
import math

` + PY_STRENGTH + `
` + PY_SMOOTH + `
LINES = [1030, 1150, 1600]     # 낮음 · 중간 · 높음
above = [False, False, False]
counts = [0, 0, 0]

while True:
    s = smooth(strength())
    for i in range(3):
        if s > LINES[i]:
            above[i] = True
        elif above[i]:
            above[i] = False
            counts[i] += 1
    if button_a.was_pressed():
        print("낮음", counts[0], " 중간", counts[1], " 높음", counts[2])
    if button_b.was_pressed():
        counts = [0, 0, 0]
        print("다시 셉니다")
    sleep(20)`,
            desc: '같은 움직임을 <b>기준선 세 개로 동시에</b> 셉니다. 목록(list) 안의 세 칸이 각각 따로 기억하고 셉니다. 낮은 기준선은 너무 많이, 높은 기준선은 너무 적게 세는지 확인해 봅니다.',
            hint: '<b>B</b> 를 눌러 0 으로 만든 뒤 조이스틱으로 정확히 10걸음쯤 걷게 하고 <b>A</b> 를 누르세요. 제자리에서 기다리기 · 뛰기로도 해 봅니다.',
            expect: '다시 셉니다\n낮음 23  중간 10  높음 3',
            nondeterministic: true
          },

          { type: 'h', text: '실습 — 기록표를 만들고 우리 모둠의 기준값 정하기' },
          { type: 'p', html: '좋은 기준선은 <b>제자리의 최고값보다는 높고, 걷기의 최고값보다는 낮은</b> 곳입니다. 그러려면 먼저 각 상태의 최고값과 최저값을 재어 보아야 합니다. 아래 예제로 <b>A 버튼</b>을 누르면 5초 동안 값을 재서 최고값과 최저값을 알려 줍니다.' },
          {
            type: 'code', title: '예제 3-8. 5초 동안 최고값 · 최저값 재기', code: `from microbit import *
import math

` + PY_STRENGTH + `
` + PY_SMOOTH + `
display.show("A")

while True:
    if button_a.was_pressed():
        display.show(Image.ARROW_S)
        biggest = 0
        smallest = 9999
        for i in range(250):        # 0.02초 x 250번 = 5초
            s = smooth(strength())
            if s > biggest:
                biggest = s
            if s < smallest:
                smallest = s
            sleep(20)
        print("최고:", biggest, " 최저:", smallest)
        display.scroll(biggest)
        display.show("A")
    sleep(50)`,
            desc: '화살표가 보이는 5초 동안 값을 재고, 끝나면 콘솔에 최고 · 최저값을 찍고 LED 에 최고값을 흘려 줍니다. 상태마다 <b>세 번씩</b> 재서 기록표에 적습니다.',
            hint: '조이스틱을 제자리 · 걷기 · 뛰기 중 하나로 맞춘 다음 <b>A 버튼</b>을 누르고 5초 기다리세요.',
            expect: '최고: 1031  최저: 1012   (제자리)\n최고: 1384  최저: 902    (걷기)\n최고: 2210  최저: 640    (뛰기)',
            nondeterministic: true
          },
          {
            type: 'table', caption: '표 3-2. 우리 모둠 기록표 (예시 값 — 직접 재서 채워 보세요)',
            head: ['상태', '1회 최고 / 최저', '2회 최고 / 최저', '3회 최고 / 최저', '최고값 평균'],
            rows: [
              ['제자리', '1031 / 1012', '', '', ''],
              ['걷기', '1384 / 902', '', '', ''],
              ['뛰기', '2210 / 640', '', '', '']
            ]
          },
          { type: 'list', ordered: true, items: [
            '★ 제자리 · 걷기 · 뛰기를 각각 세 번씩 재서 표 3-2 를 채웁니다.',
            '★ <b>제자리 최고값</b>과 <b>걷기 최고값</b> 사이의 가운데쯤을 우리 모둠 기준값으로 정합니다. 예: (1031 + 1384) ÷ 2 ≈ 1200',
            '★★ 정한 기준값을 예제 3-6 의 <code>THRESHOLD</code> 에 넣고 10걸음을 걷게 해서 몇 걸음으로 세는지 확인합니다.',
            '★★★ 뛰기도 잘 세는지 확인하고, 걷기와 뛰기를 모두 잘 세는 기준값이 있는지 찾아봅니다.'
          ] },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제 보드로 재면 시뮬레이터보다 값이 훨씬 들쭉날쭉합니다. 보드를 <b>허리띠나 바지 허리춤에 단단히 고정</b>하고, 배터리 팩을 연결한 뒤 USB 케이블은 뽑고 걸어 봅니다. 결과는 보드를 다시 USB 에 연결해 <b>A 버튼</b>을 눌러 LED 로 확인하면 됩니다. 시뮬레이터 값과 실제 값을 표에 함께 적으면 다음 시간 토론에 도움이 됩니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: '한 걸음 = 그래프의 <b>봉우리</b> 하나. 값이 <b>기준선</b>을 넘었다가 내려오면 한 걸음으로 셉니다. 들쭉날쭉한 값은 <code>smooth()</code> 로 다듬습니다. 기준선이 너무 낮으면 많이 세고, 너무 높으면 놓칩니다 — 기록표로 알맞은 값을 찾습니다.' }
        ],
        slides: [
          { layout: 'title', title: '걸음은 어떻게 생길까 — 가속도 그래프 읽기', subtitle: 'Chapter 03 · 걸음 수 세기 — 만보기 만들기', badge: '1교시', notes: '<p>ch02 에서 걷기 · 뛰기의 strength() 값이 1000 위아래로 출렁였던 것을 떠올리게 합니다. “오늘은 그 출렁임을 세어 봅니다.”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 주머니 속 휴대폰', lead: '걸을 때 어떤 모양으로 흔들릴까?', bullets: ['가로 = 시간, 세로 = 높이', '물결? 톱니? 계단?', '발 디딤 → “쿵” 내려앉음', '떠오름 → 다시 올라감', '→ 걸음마다 되풀이'], notes: '<p>그려 온 선을 2~3명에게 칠판에 그려 보게 합니다.</p><p>💬 “걸음 하나에 선이 몇 번 오르내리나요?” — 예상 답: 한 번.</p><p>💬 “뛰면 선이 어떻게 바뀔까요?” — 더 높고 더 촘촘해짐. 뒤에서 확인한다고 예고합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '러닝 앱의 숫자, 직접 만들기', html: FIG_APP, caption: '모든 숫자는 걸음 수에서 출발', notes: '<p>러닝 앱을 써 본 학생이 있으면 어떤 숫자를 보는지 물어봅니다.</p><p>💬 “거리는 어떻게 알 수 있을까요?” — 걸음 수 × 보폭. 케이던스 · 보폭은 다음 차시에서 만든다고만 알려 줍니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '한 걸음 = 봉우리 하나', html: FIG_PEAK, caption: '발이 땅에 닿을 때 값이 크게 튐', notes: '<p>교사가 제자리 걸음을 하며 “쿵” 할 때 봉우리를 손가락으로 가리킵니다.</p><p>💬 “골짜기는 언제 생길까요?” — 몸이 떠오를 때.</p><p>💬 “봉우리를 세면 무엇을 알 수 있나요?” — 걸음 수.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '콘솔을 그래프처럼', code: `from microbit import *
import math

` + PY_STRENGTH + `
while True:
    s = strength()
    bar = (s - 500) // 50
    if bar < 0:
        bar = 0
    print(s, "*" * bar)
    sleep(50)`, points: ['별 막대가 길게 튀는 줄 = 봉우리', '조이스틱: 제자리 → 걷기 → 뛰기', '튀는 줄 사이 줄 수 = 간격'], notes: '<p>▶ 실행 후 조이스틱으로 걷기를 보여 줍니다. 콘솔을 고개를 옆으로 돌려 보면 그래프처럼 보인다고 말해 줍니다.</p><p>500 을 빼는 까닭: 출렁이는 부분을 크게 보려고. 깊이 설명하지 않습니다.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '제자리 · 걷기 · 뛰기', html: FIG_COMPARE, caption: '높이와 간격을 비교', notes: '<p>학생들이 조이스틱으로 직접 세 상태를 바꿔 보게 합니다.</p><p>💬 “제자리인데도 값이 조금씩 바뀌는 까닭은?” — 숨쉬기 · 몸의 작은 흔들림 = 잡음(noise).</p><p>💬 “뛰기 봉우리는 걷기와 무엇이 다른가요?” — 더 높고 더 촘촘함.</p><p>시간: 5분</p>' },
          { layout: 'bullets', title: '기준선(threshold)', lead: '“이만큼 넘으면 봉우리”라는 약속', bullets: ['값 &gt; 기준선 → 봉우리 위 (<code>above = True</code>)', '봉우리 위였는데 내려옴 → <b>한 걸음!</b>', '넘을 때가 아니라 <b>내려올 때</b> 한 번만', '→ 봉우리 하나 = 한 걸음'], notes: '<p>칠판에 그림 3-2 를 그리고 가로선을 그어 설명합니다.</p><p>💬 “넘을 때마다 세면 어떻게 될까요?” — 봉우리 위에서 값이 여러 번 기준선보다 크므로 한 걸음을 여러 번 셈.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '넘었다 내려오면 한 걸음', code: `from microbit import *
import math
def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))
THRESHOLD = 1200
above = False
count = 0
while True:
    s = strength()
    if s > THRESHOLD:
        above = True
    elif above:
        above = False
        count += 1
        print("한 걸음!", count)
    sleep(20)`, points: ['<code>above</code> = 봉우리 위에 있나?', '<code>elif above:</code> = 방금 내려옴', '가끔 한 걸음을 두 번 셈 → 다음 장'], notes: '<p>▶ 실행하고 조이스틱으로 10걸음쯤 걷게 합니다. 오래 돌리면 가끔 2씩 올라가는 것을 보여 주면 좋습니다.</p><p>💬 “왜 두 번 셀까요?” — 꼭대기에서 값이 들쭉날쭉해서 기준선을 잠깐 내려갔다가 다시 넘음.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '들쭉날쭉 → 부드럽게: smooth()', html: FIG_SMOOTH, caption: '최근 4개 값의 평균 (이동 평균)', notes: '<p>“친구 넷이 잰 키의 평균” 비유를 씁니다.</p><p>함수 속 내용(append · pop · global)은 설명하지 않고 “넣는 것 = 지금 값, 나오는 것 = 다듬은 값”만 강조합니다.</p><p>💬 “평균 낼 개수를 아주 크게 하면?” — 너무 부드러워서 봉우리가 사라질 수 있음.</p><p>시간: 3분</p>' },
          { layout: 'two', title: '원래 값 vs 다듬은 값', left: { title: '원래 값 strength()', bullets: ['위아래로 크게 튐', '꼭대기에서 들쭉날쭉', '한 걸음을 두 번 셀 수 있음'] }, right: { title: '다듬은 값 smooth(strength())', bullets: ['천천히 부드럽게 바뀜', '봉우리는 조금 낮아짐', '→ 기준선도 조금 낮게 (1150)'] }, notes: '<p>예제 3-5 를 학생 화면에서 실행해 두 숫자를 비교하게 합니다.</p><p>다듬은 값이 원래 값을 조금 늦게 따라간다는 것도 짚어 줍니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '토론 — 기준선 높이', html: FIG_THRESH, caption: '진짜 걸음은 4걸음', notes: '<p>모둠별로 1분 동안 이야기하고 발표합니다.</p><p>💬 “너무 낮으면?” — 잡음까지 셈(많이 셈). “너무 높으면?” — 약한 걸음을 놓침(적게 셈).</p><p>💬 “사람마다 같은 기준선을 써도 될까?” — 몸무게 · 걸음걸이 · 신발에 따라 다를 수 있음. 그래서 직접 재서 정해야 한다는 결론으로 이어 갑니다.</p><p>응용 3-7 을 실행해 세 기준선을 비교해 보여 주면 좋습니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '실습 — 기록표와 기준값', head: ['상태', '최고값', '최저값'], rows: [['제자리', '', ''], ['걷기', '', ''], ['뛰기', '', '']], lead: '예제 3-8: A 버튼 → 5초 측정, 상태마다 세 번', notes: '<p>모둠별로 역할을 나눕니다: 조이스틱 담당 · 기록 담당 · 확인 담당.</p><p>기준값 = 제자리 최고값과 걷기 최고값의 가운데쯤. 예: (1031 + 1384) ÷ 2 ≈ 1200.</p><p>★★ 모둠은 예제 3-6 에 넣어 10걸음 확인, ★★★ 모둠은 뛰기도 확인합니다.</p><p>시간: 7분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['한 걸음 = 그래프의 봉우리 하나', '제자리 · 걷기 · 뛰기 = 높이와 간격이 다름', '기준선을 넘었다 내려오면 한 걸음', '<code>smooth()</code> = 최근 4개 평균으로 다듬기', '기준선은 직접 재서 정한다'], notes: '<p>모둠별 기준값을 칠판에 적어 비교합니다.</p><p>다음 시간 “생각하기”: 손만 흔들어도 걸음 수가 올라가는 만보기가 있다면, 어떻게 막을 수 있을까요? 를 안내합니다.</p><p>시간: 1분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch03-2',
        title: '만보기 완성 — 걸음 검출 함수 쓰기',
        minutes: 50,
        goals: [
          '준비된 함수 <code>is_step()</code> 의 두 조건(기준선 넘기 · 최소 간격)을 말할 수 있다',
          '<code>running_time()</code> 으로 시간을 재고, 최소 간격 조건이 왜 필요한지 설명할 수 있다',
          '걸음 수 변수 <code>steps</code> 와 A · B 버튼, LED 깜빡임, 100걸음 알림 소리가 있는 만보기를 완성할 수 있다',
          '착용 위치 · 차량 진동 · 계단 같은 상황을 토론하고, 실제 보드로 20걸음 오차를 기록할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['is_step() 두 조건', 7], ['running_time() · 최소 간격', 8], ['만보기 만들기', 10], ['목표 알림 소리', 4], ['토론: 착용 위치 · 진동', 6], ['실제 보드 시험', 5], ['단계별 실습 · 정리', 5]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>손만 흔들어도</b> 걸음 수가 올라가는 만보기가 있다면, 어떻게 막을 수 있을까요? 진짜 걸음과 손 흔들기는 무엇이 다를지 한 가지 이상 적어 오세요. “흔들림의 크기”, “흔들리는 빠르기”, “보드를 다는 곳”처럼 생각나는 대로 쓰면 됩니다.' },
          { type: 'p', html: '적어 온 생각을 나눠 봅니다. 좋은 아이디어가 많이 나왔을 것입니다. 그중 오늘 쓸 방법은 <b>“걸음 사이의 시간”</b>입니다. 사람이 아무리 빨리 뛰어도 1초에 다섯 걸음 넘게 디디기는 어렵습니다. 그런데 손을 파르르 떨거나 보드가 덜컹거리면 아주 짧은 시간에 봉우리가 여러 개 생깁니다. <b>너무 빨리 이어지는 봉우리는 걸음이 아니다</b>라고 정하면 많은 잘못을 막을 수 있습니다.' },

          { type: 'h', text: '준비된 걸음 검출 함수 is_step(value)' },
          { type: 'p', html: '1교시에 만든 “기준선을 넘었다 내려오면 한 걸음”에 조건을 하나 더 붙여 <b>준비된 함수</b> <code>is_step(value)</code> 로 묶었습니다. 넣는 것은 다듬은 값 하나, 나오는 것은 <code>True</code>(걸음이다) 또는 <code>False</code>(아니다)입니다.' },
          { type: 'figure', html: FIG_ISSTEP, caption: '그림 3-6. is_step() 의 두 조건 — 기준선 넘기와 최소 간격' },
          {
            type: 'table', caption: '표 3-3. is_step() 이 걸음으로 인정하는 두 조건',
            head: ['조건', '뜻', '막아 주는 문제'],
            rows: [
              ['① 기준선 넘기', '값이 <code>THRESHOLD</code> 위로 올라갔다가 다시 내려옴', '제자리의 작은 흔들림(잡음)'],
              ['② 최소 간격', '앞 걸음과 <code>MIN_GAP</code>(약 300ms) 이상 떨어짐', '한 걸음 안에서 두 번 튐, 손 떨림, 덜컹거림']
            ]
          },
          {
            type: 'code', title: '준비된 함수 is_step() 들여다보기', run: false, code: `THRESHOLD = 1150   # 기준선 (우리 모둠 값으로)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STEP,
            desc: '함수 위에 있는 두 숫자 <code>THRESHOLD</code> 와 <code>MIN_GAP</code> 만 바꾸면 됩니다. 함수 속은 다 이해하지 않아도 괜찮습니다. <code>global</code> 은 “함수 밖에 있는 변수를 고쳐 쓰겠다”는 표시입니다.'
          },
          { type: 'callout', kind: 'tip', title: '함수는 도구 상자', html: 'ch01 에서 약속했듯이, 어려운 함수는 <b>무엇을 넣으면 무엇이 나오는지</b>만 알면 됩니다. <code>is_step(값)</code> → 걸음이면 <code>True</code>. 오늘 만보기는 이 함수를 그대로 가져다 씁니다.' },

          { type: 'h', text: 'running_time() 으로 시간 재기' },
          { type: 'p', html: '“앞 걸음과 300ms 이상 떨어졌나?”를 알려면 <b>시간</b>을 잴 수 있어야 합니다. <code>running_time()</code> 은 micro:bit 가 켜진 뒤(프로그램이 시작된 뒤) <b>몇 밀리초(ms)가 지났는지</b> 알려 줍니다. 1000ms 가 1초입니다.' },
          {
            type: 'code', title: '예제 3-9. 셸에서 running_time() 물어보기', repl: true, code: `from microbit import *
running_time()
running_time()`,
            desc: '두 번 물어볼 때마다 숫자가 커집니다. 두 숫자의 <b>차이</b>가 그 사이에 흐른 시간입니다.',
            expect: '>>> running_time()\n15230\n>>> running_time()\n18914',
            nondeterministic: true
          },
          {
            type: 'code', title: '예제 3-10. 버튼을 두 번 누른 사이의 시간 재기', code: `from microbit import *

last = running_time()

while True:
    if button_a.was_pressed():
        now = running_time()
        gap = now - last            # 지난번에 누른 뒤 흐른 시간
        print("간격:", gap, "ms")
        last = now
    sleep(10)`,
            desc: '<b>A 버튼</b>을 누를 때마다 지난번에 누른 뒤 몇 ms 가 지났는지 찍습니다. “지금 시간 − 지난번 시간 = 간격”이 is_step() 안에서도 똑같이 쓰는 방법입니다.',
            hint: '<b>A 버튼</b>을 천천히 몇 번, 아주 빠르게 몇 번 눌러 보세요. 가장 빠르게 눌렀을 때 몇 ms 까지 줄어드나요?',
            expect: '간격: 812 ms\n간격: 640 ms\n간격: 180 ms …',
            nondeterministic: true
          },
          { type: 'p', html: '이제 걸음과 걸음 사이의 간격을 직접 재 봅니다. 아래 예제는 1교시의 “기준선만 쓰는 방법”으로 걸음을 찾고, 걸음 사이의 간격을 함께 찍습니다.' },
          {
            type: 'code', title: '예제 3-11. 걸음 사이 간격 찍어 보기', code: `from microbit import *
import math

` + PY_STRENGTH + `
` + PY_SMOOTH + `
THRESHOLD = 1150
above = False
last = 0

while True:
    s = smooth(strength())
    if s > THRESHOLD:
        above = True
    elif above:
        above = False
        now = running_time()
        print("걸음 간격:", now - last, "ms")
        last = now
    sleep(20)`,
            desc: '걸을 때는 간격이 대체로 일정하게 나옵니다. 그런데 가끔 <b>100ms 도 안 되는 아주 짧은 간격</b>이 섞여 나오면, 그것은 진짜 걸음이 아니라 한 걸음 안에서 값이 두 번 튄 것입니다.',
            hint: '조이스틱으로 걷기 · 뛰기를 해 보고, <b>🧭 센서</b> 탭의 <b>흔들기(shake)</b> 버튼을 아주 빠르게 여러 번 눌러 보세요. 간격이 어떻게 나오나요?',
            expect: '걸음 간격: 560 ms\n걸음 간격: 548 ms\n걸음 간격: 70 ms   ← 걸음이 아님!\n걸음 간격: 490 ms …',
            nondeterministic: true
          },
          {
            type: 'table', caption: '표 3-4. 간격으로 보는 걸음 (대략)',
            head: ['움직임', '걸음 사이 간격', '최소 간격 300ms 로 막으면'],
            rows: [
              ['천천히 걷기', '약 600ms 안팎', '그대로 셈'],
              ['빠르게 뛰기', '약 330ms 안팎', '그대로 셈'],
              ['한 걸음 안의 두 번 튐 · 손 떨림', '100ms 안팎', '<b>무시</b>']
            ]
          },
          { type: 'callout', kind: 'warn', title: '최소 간격을 너무 크게 하면', html: '<code>MIN_GAP</code> 을 500ms 처럼 크게 하면 걷기는 잘 세도 <b>빠르게 뛸 때 걸음을 놓칩니다</b>. 반대로 너무 작게 하면 막아 주는 효과가 사라집니다. 기준선처럼 최소 간격도 직접 재서 정해야 하는 값입니다.' },

          { type: 'h', text: '만보기 만들기 — steps, LED, A · B 버튼' },
          { type: 'p', html: '이제 재료가 모두 모였습니다. <b>걸음 수를 기억하는 변수</b> <code>steps</code> 를 만들고, <code>is_step()</code> 이 <code>True</code> 를 돌려줄 때마다 1씩 늘립니다. 그림 3-7 은 만보기 프로그램이 되풀이하는 순서입니다.' },
          { type: 'figure', html: FIG_PEDO, caption: '그림 3-7. 만보기 프로그램의 흐름' },
          {
            type: 'code', title: '예제 3-12. 만보기 첫걸음 — 콘솔에 걸음 수 찍기', code: `from microbit import *
import math

THRESHOLD = 1150   # 기준선 (우리 모둠 값으로)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP + `
steps = 0

while True:
    s = smooth(strength())
    if is_step(s):
        steps += 1
        print("걸음 수:", steps)
    sleep(20)`,
            desc: '준비된 함수 세 개(<code>strength</code> · <code>smooth</code> · <code>is_step</code>)를 위에 두고, 맨 아래 <code>while True:</code> 는 단 몇 줄입니다. “재고 → 다듬고 → 걸음이면 1 더하기.”',
            hint: '조이스틱으로 걷게 하면서 콘솔의 걸음 수가 하나씩 올라가는지 확인하세요. 흔들기 버튼을 빠르게 연타해도 덜 올라가는지도 보세요.',
            expect: '걸음 수: 1\n걸음 수: 2\n걸음 수: 3 …',
            nondeterministic: true
          },
          {
            type: 'code', title: '예제 3-13. 만보기 — LED 깜빡임과 A · B 버튼', code: `from microbit import *
import math

THRESHOLD = 1150   # 기준선 (우리 모둠 값으로)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP + `
steps = 0

while True:
    s = smooth(strength())
    if is_step(s):
        steps += 1
        display.set_pixel(2, 2, 9)   # 걸음마다 가운데 점 깜빡
        sleep(30)
        display.set_pixel(2, 2, 0)
    if button_a.was_pressed():
        display.scroll(steps)        # 지금까지 걸음 수
    if button_b.was_pressed():
        steps = 0                    # 처음부터 다시
        display.show(Image.YES)
        sleep(300)
        display.clear()
    sleep(20)`,
            desc: '걸음마다 LED 가운데 점이 짧게 깜빡입니다. <b>A 버튼</b>을 누르면 걸음 수가 흐르고, <b>B 버튼</b>을 누르면 0 으로 돌아가며 체크 표시가 잠깐 보입니다. 이제 콘솔 없이도 쓸 수 있는 진짜 만보기입니다.',
            hint: '조이스틱으로 걷게 하면서 점이 깜빡이는 박자를 보고, 멈춘 뒤 <b>A 버튼</b>을 눌러 보세요. <b>B 버튼</b>으로 0 을 만들고 다시 시작해 봅니다.',
            expect: '걸음마다 LED 가운데 점이 깜빡이고, A 를 누르면 “23” 처럼 걸음 수가 흐릅니다. B 를 누르면 체크 표시 뒤 0 부터 다시 셉니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'warn', title: '숫자가 흐르는 동안은 걸음을 못 셉니다', html: '<code>display.scroll()</code> 은 글자가 다 흐를 때까지 프로그램을 기다리게 합니다. 걸으면서 <b>A 버튼</b>을 누르면 그동안의 걸음은 세지 못합니다. 걸음 수는 <b>멈춰서</b> 확인하는 것으로 약속합니다.' },

          { type: 'h', text: '목표 달성 알림 — 100걸음마다 소리' },
          { type: 'p', html: '걸음 수가 100, 200, 300 … 이 될 때마다 짧은 소리를 내 봅니다. “100으로 나누어떨어진다”는 <code>steps % 100 == 0</code> 으로 씁니다. <code>%</code> 는 <b>나머지</b>를 구하는 기호입니다. 250 % 100 은 50, 300 % 100 은 0 입니다.' },
          {
            type: 'code', title: '예제 3-14. 완성된 만보기 — 100걸음마다 알림', code: `from microbit import *
import math
import music

THRESHOLD = 1150   # 기준선 (우리 모둠 값으로)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)
GOAL = 100         # 몇 걸음마다 소리를 낼까

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP + `
steps = 0

while True:
    s = smooth(strength())
    if is_step(s):
        steps += 1
        display.set_pixel(2, 2, 9)
        sleep(30)
        display.set_pixel(2, 2, 0)
        if steps % GOAL == 0:        # 100, 200, 300 ... 걸음
            music.play(["C5:2", "E5:2", "G5:4"], wait=False)
            print("목표 달성!", steps)
    if button_a.was_pressed():
        display.scroll(steps)
    if button_b.was_pressed():
        steps = 0
        display.show(Image.YES)
        sleep(300)
        display.clear()
    sleep(20)`,
            desc: '<code>wait=False</code> 는 “소리를 틀어 놓고 기다리지 말고 바로 다음 일을 하라”는 뜻입니다. 그래서 소리가 나는 동안에도 걸음을 계속 셉니다.',
            hint: '시뮬레이터에서 100걸음은 오래 걸립니다. 시험할 때는 <code>GOAL = 10</code> 으로 바꿔 실행해 보세요.',
            expect: '(GOAL = 10 일 때) 10걸음마다 “도미솔” 소리가 나고 콘솔에 “목표 달성! 10”, “목표 달성! 20” … 이 찍힙니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: 'micro:bit V2 는 보드 뒷면에 <b>작은 스피커</b>가 있어 따로 부저를 연결하지 않아도 소리가 납니다. 소리가 작으면 귀 가까이 대어 들어 봅니다. V1 보드는 스피커가 없어 0번 핀에 부저를 연결해야 합니다.' },

          { type: 'h', text: '토론 — 걸음 수가 틀어지는 상황' },
          { type: 'p', html: '만보기가 완성되었습니다. 그런데 정말 언제나 정확할까요? 실제로 쓰기 전에 걸음 수가 틀어질 수 있는 상황을 모둠에서 미리 이야기해 봅니다.' },
          { type: 'figure', html: FIG_WEAR, caption: '그림 3-8. 착용 위치에 따라 달라지는 그래프 모양' },
          {
            type: 'table', caption: '표 3-5. 걸음 수가 틀어질 수 있는 상황 — 토론 카드',
            head: ['상황', '예상되는 문제', '해결 아이디어 (예)'],
            rows: [
              ['손목에 차기', '팔만 흔들어도 걸음으로 셈', '최소 간격 늘리기, 허리에 차기'],
              ['허리에 차기', '비교적 정확함', '단단히 고정하기'],
              ['발목에 차기', '한쪽 발만 재서 걸음 수가 절반, 봉우리가 아주 큼', '걸음 수 × 2, 기준선 높이기'],
              ['자동차 · 버스 타기', '덜컹거림을 걸음으로 셈', '타기 전에 B 로 멈춤 · 초기화 (더 좋은 방법은?)'],
              ['계단 오르기', '봉우리 모양 · 간격이 평지와 다름', '계단에서 따로 재서 비교하기']
            ]
          },
          { type: 'list', items: [
            '💬 우리 모둠의 만보기는 <b>어디에</b> 차는 것이 가장 좋을까요? 이유는 무엇인가요?',
            '💬 버스를 타고 가는 동안 걸음 수가 늘어나는 것을 막으려면 어떤 조건을 더할 수 있을까요?',
            '💬 계단을 오를 때와 내려갈 때 그래프는 어떻게 다를까요? 실제로 재 보고 확인해 봅니다.',
            '💬 시뮬레이터에서는 정확했는데 실제 보드에서는 틀린다면, 무엇이 다를까요?'
          ] },

          { type: 'h', text: '실제 보드 시험 — 20걸음 걸어 보기' },
          { type: 'p', html: '이제 실제 보드로 시험합니다. 예제 3-14 를 <b>🔌 보드</b> 버튼으로 보드에 올리고, 배터리 팩을 연결합니다. 허리에 단단히 고정하고 <b>B 버튼</b>으로 0 을 만든 뒤, 친구가 세어 주는 대로 <b>정확히 20걸음</b>을 걷습니다. 멈춰서 <b>A 버튼</b>을 눌러 만보기가 센 걸음 수를 확인합니다.' },
          {
            type: 'table', caption: '표 3-6. 20걸음 시험 기록표 (예시 — 직접 채워 보세요)',
            head: ['횟수', '착용 위치', 'THRESHOLD / MIN_GAP', '만보기 걸음 수', '오차 (만보기 − 20)'],
            rows: [
              ['1', '허리', '1150 / 300', '22', '+2'],
              ['2', '', '', '', ''],
              ['3', '', '', '', '']
            ]
          },
          { type: 'callout', kind: 'board', title: '안전하게 시험하기', html: 'USB 케이블을 꽂은 채 걷지 않습니다. 배터리 팩은 <b>AAA 건전지 2개(3V)</b>용을 쓰고, 보드는 고무줄 · 벨크로 · 집게로 단단히 고정합니다. 복도나 운동장에서는 앞을 보며 천천히 걷고, 계단 시험은 난간을 잡고 합니다.' },

          { type: 'h', text: '단계별 실습 — 만보기 완성하기' },
          { type: 'p', html: '자기 수준에 맞게 골라 도전합니다. ★ 은 예제 3-14 를 그대로 실행해 20걸음 시험을 하는 것입니다. ★★ 과 ★★★ 은 아래 예제를 바탕으로 합니다.' },
          {
            type: 'code', title: '응용 3-15. 20걸음 시험 모드로 오차 줄이기 (★★)', code: `from microbit import *
import math

THRESHOLD = 1150   # 바꿔 보기: 1050, 1250 ...
MIN_GAP = 300      # 바꿔 보기: 250, 400 ...
TARGET = 20        # 실제로 걸을 걸음 수

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP + `
steps = 0
display.show(Image.YES)

while True:
    s = smooth(strength())
    if is_step(s):
        steps += 1
        display.set_pixel(2, 2, 9)
        sleep(30)
        display.set_pixel(2, 2, 0)
    if button_a.was_pressed():
        print("기준", THRESHOLD, "간격", MIN_GAP, "→", steps, "걸음, 오차", steps - TARGET)
        display.scroll(steps - TARGET)    # 오차를 LED 로
    if button_b.was_pressed():
        steps = 0
        display.show(Image.YES)
        sleep(300)
        display.clear()
    sleep(20)`,
            desc: '<b>A 버튼</b>을 누르면 걸음 수 대신 <b>오차</b>(센 걸음 − 20)를 보여 줍니다. 0 에 가까울수록 정확합니다. <code>THRESHOLD</code> 와 <code>MIN_GAP</code> 을 하나씩 바꿔 가며 표 3-6 에 기록하고 오차가 가장 작은 조합을 찾습니다.',
            hint: '<b>B</b> 로 0 을 만들고, 조이스틱으로 20걸음쯤 걷게 한 뒤 <b>A</b> 를 누르세요. 실제 보드로는 친구가 걸음을 세어 줍니다.',
            expect: '기준 1150 간격 300 → 22 걸음, 오차 2',
            nondeterministic: true
          },
          {
            type: 'code', title: '도전 3-16. 걷기와 뛰기를 구분해 아이콘 보이기 (★★★)', code: `from microbit import *
import math

THRESHOLD = 1150   # 기준선
MIN_GAP = 300      # 최소 간격 (ms)
RUN_LEVEL = 1700   # 봉우리가 이보다 높으면 뛰기

WALK = Image("00900:09990:00900:09090:09090")
RUN = Image("00990:99900:00909:09090:90009")

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP + `
steps = 0
peak = 0           # 이번 걸음에서 가장 높았던 값

while True:
    s = smooth(strength())
    if s > peak:
        peak = s
    if is_step(s):
        steps += 1
        if peak > RUN_LEVEL:
            display.show(RUN)
        else:
            display.show(WALK)
        peak = 0       # 다음 걸음을 위해 다시 0
    if button_a.was_pressed():
        display.scroll(steps)
    sleep(20)`,
            desc: '걸음마다 그 걸음의 <b>봉우리 높이</b>(<code>peak</code>)를 기억했다가, <code>RUN_LEVEL</code> 보다 높으면 뛰는 사람 아이콘, 아니면 걷는 사람 아이콘을 보여 줍니다. 1교시 기록표의 걷기 · 뛰기 최고값 사이로 <code>RUN_LEVEL</code> 을 정하면 됩니다.',
            hint: '조이스틱을 살짝 밀었다가(걷기) 끝까지 밀어(뛰기) 보며 아이콘이 바뀌는지 확인하세요. 잘 안 바뀌면 <code>RUN_LEVEL</code> 을 고칩니다.',
            expect: '걸을 때는 걷는 사람 아이콘, 뛸 때는 팔다리를 크게 벌린 아이콘이 걸음마다 보입니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 봉우리 높이 말고 다른 방법은?', html: '뛰기는 봉우리가 높을 뿐 아니라 <b>걸음 사이 간격도 짧습니다</b>. 예제 3-11 처럼 간격을 재어 구분할 수도 있습니다. 1분 동안의 걸음 수로 걷기와 뛰기를 나누는 방법은 다음 차시에서 자세히 다룹니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: '<code>is_step()</code> = 조건 ① 기준선을 넘었다 내려옴 + 조건 ② 앞 걸음과 <code>MIN_GAP</code> 이상 떨어짐. 시간은 <code>running_time()</code> 으로 잽니다. 만보기 = 재고 → 다듬고 → 걸음이면 <code>steps += 1</code>. 착용 위치 · 진동 · 계단에 따라 오차가 생기니 실제로 걸어서 확인합니다.' }
        ],
        slides: [
          { layout: 'title', title: '만보기 완성 — 걸음 검출 함수 쓰기', subtitle: 'Chapter 03 · 걸음 수 세기 — 만보기 만들기', badge: '2교시', notes: '<p>1교시에 모둠별로 정한 기준값을 다시 확인합니다. “오늘은 그 기준값으로 진짜 만보기를 완성합니다.”</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 손만 흔드는 만보기', lead: '진짜 걸음과 손 흔들기는 무엇이 다를까?', bullets: ['흔들림의 크기', '흔들리는 빠르기 (간격)', '보드를 다는 곳', '→ 오늘은 <b>걸음 사이 시간</b>으로 막기'], notes: '<p>적어 온 생각을 3~4명 발표시키고 칠판에 모읍니다.</p><p>💬 “사람이 1초에 몇 걸음까지 디딜 수 있을까요?” — 아주 빨리 뛰어도 다섯 걸음 안팎. 그보다 촘촘한 봉우리는 걸음이 아님.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: 'is_step() 의 두 조건', html: FIG_ISSTEP, caption: '① 기준선 넘기 + ② 최소 간격 약 300ms', notes: '<p>✕ 표시된 봉우리가 왜 무시되는지 묻습니다.</p><p>💬 “✕ 는 앞 걸음과 얼마나 떨어져 있나요?” — 80ms. 300ms 보다 짧으니 걸음이 아님.</p><p>시간: 3분</p>' },
          { layout: 'two', title: '준비된 함수 is_step(value)', left: { title: '바꿀 것은 두 숫자', code: `THRESHOLD = 1150   # 기준선
MIN_GAP = 300      # 최소 간격 (ms)

if is_step(s):
    steps += 1`, run: false }, right: { title: '도구 상자 약속', bullets: ['넣는 것: 다듬은 값', '나오는 것: True / False', '함수 속은 몰라도 OK', '<code>global</code> = 밖의 변수 고쳐 쓰기'] }, notes: '<p>함수 속 코드는 학생 화면(본문)에서 한 번 훑어보게만 하고, 슬라이드에서는 바꿀 두 숫자만 강조합니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: 'running_time() — 시간 재기', code: `from microbit import *

last = running_time()

while True:
    if button_a.was_pressed():
        now = running_time()
        print("간격:", now - last, "ms")
        last = now
    sleep(10)`, points: ['켜진 뒤 흐른 시간 (ms)', '지금 − 지난번 = 간격', '1000ms = 1초'], notes: '<p>▶ 실행하고 학생 한 명에게 A 버튼을 천천히 · 빠르게 눌러 보게 합니다.</p><p>💬 “가장 빠르게 누르면 몇 ms 까지 줄어들까요?” — 대략 100~200ms. 손가락도 그보다 빠르기는 어렵다는 점을 걸음과 연결합니다.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '간격으로 보는 걸음', head: ['움직임', '걸음 사이 간격', 'MIN_GAP 300'], rows: [['천천히 걷기', '약 600ms', '셈'], ['빠르게 뛰기', '약 330ms', '셈'], ['두 번 튐 · 손 떨림', '약 100ms', '<b>무시</b>']], lead: '예제 3-11 로 직접 확인', notes: '<p>예제 3-11 을 실행하고 흔들기 버튼을 연타해 짧은 간격이 찍히는 것을 보여 줍니다.</p><p>💬 “MIN_GAP 을 500 으로 하면?” — 빠르게 뛸 때 걸음을 놓침.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '만보기 프로그램의 흐름', html: FIG_PEDO, caption: '재고 → 다듬고 → 걸음이면 1 더하기', notes: '<p>①~⑤를 손가락으로 따라가며 읽습니다. 아니요 화살표가 처음으로 돌아가는 것이 <code>while True:</code> 라는 점을 짚습니다.</p><p>A · B 버튼은 반복 안에서 “눌렸나?”를 매번 확인한다고 설명합니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '만보기 핵심 — while 안', code: `from microbit import *

steps = 0
while True:
    if accelerometer.was_gesture("shake"):   # (걸음 대신 흔들기)
        steps += 1
        display.set_pixel(2, 2, 9)
        sleep(30)
        display.set_pixel(2, 2, 0)
    if button_a.was_pressed():
        display.scroll(steps)
    if button_b.was_pressed():
        steps = 0
        display.show(Image.YES)
        sleep(300)
        display.clear()
    sleep(20)`, points: ['걸음 대신 흔들기로 연습하는 뼈대', '<code>steps += 1</code> · 점 깜빡', 'A 보기 · B 초기화', '본문 예제 3-13 에서 is_step() 으로 교체'], notes: '<p>슬라이드에는 준비된 함수가 길어 다 들어가지 않으므로, 걸음 대신 흔들기 제스처를 쓰는 뼈대로 흐름만 보여 줍니다. ▶ 실행 후 🧭 센서 탭의 흔들기 버튼을 눌러 봅니다.</p><p>학생들은 본문의 예제 3-12 → 3-13 순서로 실행합니다.</p><p>💬 “걸으면서 A 를 누르면 왜 걸음을 놓칠까요?” — scroll 이 끝날 때까지 기다리기 때문.</p><p>시간: 6분</p>' },
          { layout: 'bullets', title: '목표 알림 — 100걸음마다 소리', bullets: ['<code>steps % 100 == 0</code> → 100, 200, 300 …', '<code>%</code> = 나머지 (250 % 100 = 50)', '<code>music.play([...], wait=False)</code>', '<code>wait=False</code> = 소리 나는 동안에도 계속 셈', '시험할 때는 <code>GOAL = 10</code>'], notes: '<p>💬 “300 % 100 은?” — 0. “120 % 100 은?” — 20.</p><p>예제 3-14 를 GOAL = 10 으로 바꿔 실행해 소리를 들려줍니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '토론 — 어디에 찰까?', html: FIG_WEAR, caption: '손목 · 허리 · 발목', notes: '<p>모둠별로 표 3-5 의 상황 카드 하나씩(손목 · 발목 · 버스 · 계단)을 맡아 1분 토론 후 발표합니다.</p><p>💬 “버스에서 걸음이 늘어나는 것을 막으려면?” — 예상 답: 일정한 박자가 아니면 무시, 버튼으로 일시 정지 등. 정답을 정하지 않고 아이디어를 모읍니다.</p><p>💬 “발목에 차면 걸음 수를 어떻게 고칠까?” — × 2.</p><p>시간: 6분</p>' },
          { layout: 'table', title: '실제 보드 — 20걸음 시험', head: ['횟수', '위치', '기준 / 간격', '센 걸음', '오차'], rows: [['1', '허리', '1150 / 300', '', ''], ['2', '', '', '', ''], ['3', '', '', '', '']], lead: 'B → 20걸음 → A, 오차 = 센 걸음 − 20', notes: '<p>보드에 올리고 배터리 팩을 연결한 뒤 USB 를 뽑게 합니다. 복도에서 모둠별로 번갈아 걷습니다.</p><p>⚠️ 걸을 때 USB 케이블을 꽂지 않기, 앞을 보며 천천히.</p><p>보드가 부족하면 모둠당 한 대로 돌아가며 합니다.</p><p>시간: 5분</p>' },
          { layout: 'practice', title: '실습 — 만보기 완성하기', desc: '★ 예제 3-14 그대로 실행 · 20걸음 시험<br>★★ 응용 3-15: THRESHOLD · MIN_GAP 바꿔 오차 줄이기<br>★★★ 도전 3-16: 걷기 / 뛰기 다른 아이콘', starter: `from microbit import *

steps = 0
while True:
    if accelerometer.was_gesture("shake"):   # 걸음 대신 흔들기
        steps += 1
        # TODO: 10걸음마다 체크 표시 보이기
    if button_a.was_pressed():
        display.scroll(steps)
    sleep(20)`, solution: `from microbit import *

steps = 0
while True:
    if accelerometer.was_gesture("shake"):
        steps += 1
        if steps % 10 == 0:
            display.show(Image.YES)
            sleep(300)
            display.clear()
    if button_a.was_pressed():
        display.scroll(steps)
    sleep(20)`, notes: '<p>슬라이드의 시작 코드는 흔들기 제스처를 걸음 대신 쓰는 간단한 연습입니다. 실제 실습은 본문의 3-14 · 3-15 · 3-16 으로 진행합니다.</p><p>★★ 모둠은 바꾼 값과 오차를 표 3-6 에 꼭 기록하게 합니다. ★★★ 모둠은 RUN_LEVEL 을 1교시 기록표의 걷기 · 뛰기 최고값 사이로 정하게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['<code>is_step()</code> = 기준선 넘기 + 최소 간격', '<code>running_time()</code> 으로 간격 재기', '만보기: 재고 → 다듬고 → <code>steps += 1</code>', 'A 보기 · B 초기화 · 100걸음 소리', '위치 · 진동 · 계단 → 실제로 걸어서 확인'], notes: '<p>모둠별 가장 작은 오차와 그때의 THRESHOLD · MIN_GAP 을 발표시킵니다.</p><p>다음 시간 “생각하기”: 1분 동안 걸을 때와 달릴 때 각각 몇 번 발을 디딜까요? 친구와 직접 세어 오기 를 안내합니다.</p><p>시간: 1분</p>' }
        ]
      }
    ]
  });
})();
