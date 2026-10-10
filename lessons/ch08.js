/* Chapter 08. 경로 시각화와 정확도 높이기 */
(function () {
  /* ───────── 지도와 기록 데이터 (그림과 파이썬 코드에서 같이 씀) ───────── */
  // ch07 2교시의 교실 — # 벽 · . 바닥 · D 문 · P 기둥 · S 시작점 · B 칠판 앞 · W 창가
  const ROOM_ROUTE = [
    '##########',
    '#...BB...#',
    '#W.......#',
    '#W..P....#',
    '#W.......#',
    '#.......SD',
    '##########'
  ];
  // 계획 경로: 북쪽 4m → 서쪽 6m → 남쪽 2m → 서쪽 1m (cm)
  const PLAN = [[0, 0], [0, 400], [-600, 400], [-600, 200], [-700, 200]];
  // 개선 전 기록 (가상 공간 · 보폭 67cm 로 설정 · 출발 방향 8° 틀림)
  const EST = [[-12, 66], [-26, 132], [-33, 198], [-48, 263], [-57, 330], [-69, 396], [-84, 461], [-150, 452], [-215, 436], [-281, 425], [-346, 410], [-412, 395], [-478, 384], [-545, 380], [-610, 365], [-676, 352], [-742, 345], [-739, 278], [-731, 211], [-720, 145], [-718, 78], [-783, 63], [-850, 59]];
  // 실제 보드 기록 (걸음 하나 놓침 · 기둥 옆 철제 사물함 근처에서 방향이 휨)
  const BOARD = [[0, 60], [0, 120], [3, 180], [3, 240], [3, 300], [4, 360], [1, 420], [-59, 420], [-119, 421], [-179, 423], [-226, 386], [-274, 350], [-321, 313], [-372, 280], [-422, 248], [-482, 243], [-486, 184], [-490, 124], [-491, 64], [-492, 4], [-552, 1], [-612, -4]];
  // 개선 후 기록 (보폭 58cm 로 보정 · 방향 오프셋 · 직진 보정)
  const AFTER = [[1, 58], [2, 116], [4, 174], [7, 232], [8, 290], [11, 348], [8, 406], [-50, 406], [-108, 409], [-166, 410], [-224, 412], [-282, 410], [-340, 410], [-398, 408], [-456, 408], [-514, 408], [-572, 405], [-570, 347], [-569, 289], [-571, 231], [-573, 173], [-631, 171], [-689, 173]];

  const pyList = (name, rows) => name + ' = [\n' + rows.map(r => '    "' + r + '",').join('\n') + '\n]\n';
  const pyPts = (name, pts) => {
    const lines = [];
    for (let i = 0; i < pts.length; i += 6) lines.push('    ' + pts.slice(i, i + 6).map(p => '(' + p[0] + ', ' + p[1] + ')').join(', ') + ',');
    return name + ' = [\n' + lines.join('\n') + '\n]\n';
  };

  /* ───────── 공통 파이썬 조각 (준비된 함수) ───────── */
  const PY_ROOM = pyList('ROOM', ROOM_ROUTE);
  const PY_MAP_KIT = `CELL = 100   # 1칸 = 100cm

def find(ch):
    # 준비된 함수: 지도에서 글자 ch 가 있는 칸 (열, 줄)
    for r in range(len(ROOM)):
        c = ROOM[r].find(ch)
        if c >= 0:
            return c, r
    return None

def cell(c, r):
    # 준비된 함수: (열, 줄) 칸의 글자 — 지도 밖은 벽으로 봄
    if 0 <= r < len(ROOM) and 0 <= c < len(ROOM[r]):
        return ROOM[r][c]
    return "#"

def to_cell(x, y):
    # 준비된 함수: 위치 (x, y) cm -> 지도 칸 (열, 줄)
    return SC + round(x / CELL), SR - round(y / CELL)

def is_wall(x, y):
    # 준비된 함수: 위치가 벽 · 기둥 칸이면 True
    c, r = to_cell(x, y)
    return cell(c, r) in "#P"
`;
  const PY_DRAW = `def draw_path(path):
    # 준비된 함수: 지도 위에 경로 찍기 (* 걸음 · X 벽 통과 · E 끝점)
    grid = [list(row) for row in ROOM]
    for i in range(len(path)):
        c, r = to_cell(path[i][0], path[i][1])
        if 0 <= r < len(grid) and 0 <= c < len(grid[r]):
            if ROOM[r][c] in "#P":
                grid[r][c] = "X"
            elif i == len(path) - 1:
                grid[r][c] = "E"
            elif grid[r][c] != "S":
                grid[r][c] = "*"
    for row in grid:
        print(" ".join(row))
`;
  const PY_ERR = `def end_error(plan, est):
    # 준비된 함수: 두 점 사이의 직선 거리 (cm)
    dx = est[0] - plan[0]
    dy = est[1] - plan[1]
    return round(math.sqrt(dx * dx + dy * dy))
`;
  const PY_WALLS = `def wall_steps(path):
    # 준비된 함수: 벽 · 기둥 칸에 찍힌 걸음 번호 목록
    out = []
    for i in range(len(path)):
        if is_wall(path[i][0], path[i][1]):
            out.append(i + 1)
    return out
`;
  const PY_DIAG = `def diagnose(plan, est):
    # 준비된 함수: 출발점 -> 끝점 의 길이 비율과 방향 차이(°)
    pl = math.sqrt(plan[0] ** 2 + plan[1] ** 2)
    el = math.sqrt(est[0] ** 2 + est[1] ** 2)
    pa = math.degrees(math.atan2(plan[0], plan[1]))
    ea = math.degrees(math.atan2(est[0], est[1]))
    diff = (ea - pa + 180) % 360 - 180
    return round(el / pl, 2), round(diff)
`;
  const PY_GUESS = `def guess(ratio, diff):
    # 준비된 함수: 숫자로 본 가장 의심 가는 원인
    if ratio > 1.1:
        return "보폭이 너무 큼 (또는 걸음을 더 셈)"
    if ratio < 0.9:
        return "보폭이 너무 작음 (또는 걸음 놓침)"
    if abs(diff) > 10:
        return "방향 오차 (출발 방향 · 자석 간섭)"
    return "큰 문제 없음"
`;
  const PY_MOVE = `def move(x, y, heading, stride):
    # 준비된 함수: heading 방향으로 stride 만큼 한 칸 밀기 -> 새 위치 (ch06)
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)
`;
  const PY_STRENGTH = `def strength():
    # 준비된 함수: 흔들림 세기 (ch02)
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))
`;
  const PY_SMOOTH = `recent = []

def smooth(value):
    # 준비된 함수: 최근 4개 값의 평균 (ch03)
    recent.append(value)
    if len(recent) > 4:
        recent.pop(0)
    return sum(recent) // len(recent)
`;
  const PY_STEP = `above = False
last_step = 0

def is_step(value):
    # 준비된 함수: 걸음이면 True (ch03)
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
  const PY_STEP_KIT = `THRESHOLD = 1150   # 기준선 (ch03 에서 정한 우리 모둠 값)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP;

  /* ───────── 개선 함수 (2교시) ───────── */
  const PY_CALIB = `def calibrate_stride(real_cm, counted_steps):
    # 준비된 함수: 아는 거리를 걸은 걸음 수로 보폭 다시 정하기
    return round(real_cm / counted_steps)
`;
  const PY_OFFSET = `def heading_offset(samples=10):
    # 준비된 함수: 도면 위쪽을 보고 여러 번 읽은 방위의 '원 평균'
    sx, sy = 0, 0
    for i in range(samples):
        rad = math.radians(compass.heading())
        sx += math.sin(rad)
        sy += math.cos(rad)
        sleep(50)
    return round(math.degrees(math.atan2(sx, sy))) % 360
`;
  const PY_STRAIGHT = `def keep_straight(new_h, last_h, limit=20):
    # 준비된 함수: 바뀐 각도가 limit 보다 작으면 직진으로 보고 이전 방향 유지
    diff = (new_h - last_h + 180) % 360 - 180
    if abs(diff) < limit:
        return last_h
    return new_h
`;
  const PY_LANDMARK = `LANDMARKS = {"문": (0, 0), "칠판 앞": (-300, 400), "창가": (-700, 200)}

def nearest_landmark(x, y):
    # 준비된 함수: 지금 위치에서 가장 가까운 랜드마크 (이름, x, y)
    best = None
    for name in LANDMARKS:
        lx, ly = LANDMARKS[name]
        d = (lx - x) ** 2 + (ly - y) ** 2
        if best is None or d < best[0]:
            best = (d, name, lx, ly)
    return best[1], best[2], best[3]
`;

  /* ───────── 그림 도우미 (SVG) ───────── */
  const drawMap = (rows, x0, y0, s) => {
    let out = '';
    rows.forEach((row, r) => {
      row.split('').forEach((ch, c) => {
        const x = x0 + c * s, y = y0 + r * s, cx = x + s / 2, cy = y + s / 2;
        out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
        if (ch === '#') out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="var(--fg)" opacity="0.55"/>`;
        else if (ch === 'P') out += `<rect x="${x + 4}" y="${y + 4}" width="${s - 8}" height="${s - 8}" rx="3" fill="var(--muted)"/>`;
        else if (ch === 'D') out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="var(--warn)"/>`;
        else if (ch === 'S') out += `<circle cx="${cx}" cy="${cy}" r="${s * 0.3}" fill="none" stroke="var(--ok)" stroke-width="3"/>`;
        else if (ch === 'B') out += `<rect x="${x + 3}" y="${y + 3}" width="${s - 6}" height="${s - 6}" fill="var(--accent)" opacity="0.35"/>`;
        else if (ch === 'W') out += `<rect x="${x + 3}" y="${y + 3}" width="${s - 6}" height="${s - 6}" fill="var(--accent2)" opacity="0.35"/>`;
      });
    });
    return out;
  };
  // 위치(cm) → 그림 좌표. 시작점 S 는 8열 5줄
  const toPx = (x0, y0, s) => (p) => [x0 + (8 + p[0] / 100) * s + s / 2, y0 + (5 - p[1] / 100) * s + s / 2];
  const pathD = (pts, f) => 'M' + pts.map(p => f(p).map(v => v.toFixed(1)).join(' ')).join(' L');
  const wallJS = (p) => {
    const c = 8 + Math.round(p[0] / 100), r = 5 - Math.round(p[1] / 100);
    const ch = (ROOM_ROUTE[r] || '')[c];
    return ch === undefined || ch === '#' || ch === 'P';
  };
  const stepDots = (pts, f, color, r) => pts.map(p => {
    const [cx, cy] = f(p);
    return wallJS(p)
      ? `<path d="M${cx - 7} ${cy - 7} L${cx + 7} ${cy + 7} M${cx + 7} ${cy - 7} L${cx - 7} ${cy + 7}" stroke="var(--danger)" stroke-width="4"/>`
      : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${color}"/>`;
  }).join('');
  const arrowDef = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${color}"/></marker>`;
  const mapWithPaths = (x0, y0, s, est, color) => {
    const f = toPx(x0, y0, s);
    const [ex, ey] = f(est[est.length - 1]), [px, py] = f(PLAN[PLAN.length - 1]);
    return `${drawMap(ROOM_ROUTE, x0, y0, s)}
  <path d="${pathD(PLAN, f)}" fill="none" stroke="var(--ok)" stroke-width="4" stroke-dasharray="10 7"/>
  <path d="${pathD([[0, 0]].concat(est), f)}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.8"/>
  ${stepDots(est, f, color, 4.5)}
  <path d="M${px} ${py} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="var(--danger)" stroke-width="2.5" stroke-dasharray="4 4"/>
  <circle cx="${px}" cy="${py}" r="7" fill="var(--ok)"/>`;
  };

  /* ───────── 그림 8-1. 데이터 가져오는 세 길 ───────── */
  const FIG_IMPORT = (() => {
    const src = (y, t1, t2, t3, c) => `<rect x="30" y="${y}" width="420" height="100" rx="14" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="50" y="${y + 35}" font-size="21" font-weight="bold" fill="${c}">${t1}</text>
  <text x="50" y="${y + 65}" font-size="17" fill="var(--fg)">${t2}</text>
  <text x="50" y="${y + 88}" font-size="16" fill="var(--muted)">${t3}</text>
  <path d="M452 ${y + 50} L640 ${y + 50} L700 200" fill="none" stroke="var(--fg)" stroke-width="2.5" marker-end="url(#c8ia)"/>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c8ia', 'var(--fg)')}</defs>
  ${src(20, '① 시뮬레이터 · 📊 로그 탭', 'log 로 기록한 표 → ⬇ CSV 내려받기', 'microbit-log.csv', 'var(--accent)')}
  ${src(145, '② 시뮬레이터 · 💾 파일 탭', 'open() 으로 쓴 path.csv 내려받기', 'path.csv', 'var(--accent2)')}
  ${src(270, '③ 실제 보드 · USB', 'MY_DATA.HTM 열기 또는 🔌 보드 + 콘솔', '예제 8-1 로 path.csv 꺼내기', 'var(--warn)')}
  <rect x="710" y="110" width="250" height="180" rx="16" fill="var(--code-bg)" stroke="var(--ok)" stroke-width="3"/>
  <text x="835" y="155" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">CSV 파일</text>
  <text x="835" y="195" text-anchor="middle" font-size="16" font-family="monospace" fill="var(--fg)">time,steps,heading,x,y</text>
  <text x="835" y="222" text-anchor="middle" font-size="16" font-family="monospace" fill="var(--fg)">0.5,1,350,-12,66</text>
  <text x="835" y="249" text-anchor="middle" font-size="16" font-family="monospace" fill="var(--fg)">1.0,2,348,-26,132</text>
  <text x="835" y="274" text-anchor="middle" font-size="16" fill="var(--muted)">…</text>
  <path d="M962 200 L1032 200" stroke="var(--fg)" stroke-width="3" marker-end="url(#c8ia)"/>
  <rect x="1040" y="110" width="215" height="180" rx="16" fill="var(--code-bg)" stroke="var(--danger)" stroke-width="3"/>
  <text x="1147" y="160" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">웹 지도</text>
  <text x="1147" y="200" text-anchor="middle" font-size="17" fill="var(--fg)">+ 내가 만든 도면</text>
  <text x="1147" y="230" text-anchor="middle" font-size="17" fill="var(--fg)">(ch07 에서 저장)</text>
  <text x="1147" y="265" text-anchor="middle" font-size="17" fill="var(--muted)">겹쳐 그리기</text>
  <text x="835" y="350" text-anchor="middle" font-size="19" fill="var(--fg)">어느 길로 가져와도 결국 <tspan font-weight="bold">x · y 가 든 CSV</tspan> 하나가 됩니다</text>
</svg>`;
  })();

  /* ───────── 그림 8-2. 웹 지도 화면 ───────── */
  const FIG_WEBMAP = (() => {
    const s = 44, x0 = 40, y0 = 62;
    const btn = (x, w, t, on) => `<rect x="${x}" y="14" width="${w}" height="36" rx="8" fill="${on ? 'var(--accent)' : 'var(--code-bg)'}" stroke="var(--line)" stroke-width="2"/><text x="${x + w / 2}" y="38" text-anchor="middle" font-size="16" fill="${on ? '#fff' : 'var(--fg)'}">${t}</text>`;
    const card = (x, y, t, v, c) => `<rect x="${x}" y="${y}" width="170" height="84" rx="12" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="${x + 85}" y="${y + 30}" text-anchor="middle" font-size="16" fill="var(--muted)">${t}</text>
  <text x="${x + 85}" y="${y + 66}" text-anchor="middle" font-size="27" font-weight="bold" fill="${c}">${v}</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${btn(40, 130, '도면 불러오기')}${btn(180, 130, 'CSV 불러오기')}${btn(320, 90, '▶ 재생', true)}${btn(420, 110, '☑ 걸음 점')}
  ${mapWithPaths(x0, y0, s, EST, 'var(--accent)')}
  <rect x="40" y="380" width="440" height="8" rx="4" fill="var(--line)"/>
  <rect x="40" y="380" width="300" height="8" rx="4" fill="var(--accent)"/>
  <circle cx="340" cy="384" r="10" fill="var(--accent)"/>
  <text x="560" y="40" font-size="21" font-weight="bold" fill="var(--fg)">교실 (1칸 = 1m) · 기록: 개선 전</text>
  ${card(560, 62, '걸음 수', '23', 'var(--fg)')}${card(745, 62, '끝점 오차', '206cm', 'var(--danger)')}${card(930, 62, '벽 통과', '4걸음', 'var(--warn)')}
  <path d="M570 200 L620 200" stroke="var(--ok)" stroke-width="4" stroke-dasharray="10 7"/>
  <text x="635" y="207" font-size="18" fill="var(--fg)">계획 경로 (걸으려던 길)</text>
  <circle cx="595" cy="240" r="6" fill="var(--accent)"/><path d="M570 240 L620 240" stroke="var(--accent)" stroke-width="2.5"/>
  <text x="635" y="247" font-size="18" fill="var(--fg)">추정 경로 (보드가 계산한 길) · 점 = 한 걸음</text>
  <path d="M588 274 L602 288 M602 274 L588 288" stroke="var(--danger)" stroke-width="4"/>
  <text x="635" y="288" font-size="18" fill="var(--fg)">벽 · 기둥 칸에 찍힌 걸음</text>
  <path d="M570 322 L620 322" stroke="var(--danger)" stroke-width="2.5" stroke-dasharray="4 4"/>
  <text x="635" y="329" font-size="18" fill="var(--fg)">끝점 오차 (계획 끝점 ↔ 추정 끝점)</text>
  <text x="560" y="372" font-size="17" fill="var(--muted)">아래 막대 = 재생 위치 · 끌면 그 걸음까지만 보입니다</text>
</svg>`;
  })();

  /* ───────── 그림 8-3. 오차 원인 네 가지의 모양 ───────── */
  const FIG_CAUSES = (() => {
    const panel = (i, title, est, extra, note) => {
      const ox = 20 + i * 315, oy = 70;
      const f = (p) => [ox + 230 + p[0] * 0.22, oy + 230 - p[1] * 0.22];
      const plan = [[0, 0], [0, 800], [-800, 800]];
      const d = (pts) => 'M' + pts.map(p => f(p).map(v => v.toFixed(1)).join(' ')).join(' L');
      return `<rect x="${ox}" y="${oy - 50}" width="295" height="350" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="${ox + 147}" y="${oy - 18}" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">${title}</text>
  <path d="${d(plan)}" fill="none" stroke="var(--ok)" stroke-width="4" stroke-dasharray="10 7"/>
  <path d="${d(est)}" fill="none" stroke="var(--danger)" stroke-width="4"/>
  ${extra(f)}
  <text x="${ox + 147}" y="${oy + 268}" text-anchor="middle" font-size="16" fill="var(--fg)">${note[0]}</text>
  <text x="${ox + 147}" y="${oy + 292}" text-anchor="middle" font-size="16" fill="var(--muted)">${note[1]}</text>`;
    };
    const rot = (p, deg) => { const a = deg * Math.PI / 180; return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]; };
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${panel(0, '① 보폭 오차', [[0, 0], [0, 950], [-950, 950]], () => '', ['모양은 같고 크기만 다름', '길쭉하게 · 짧게'])}
  ${panel(1, '② 방향 오차', [[0, 0], rot([0, 800], 12), rot([-800, 800], 12)], () => '', ['모양 · 크기는 같고', '통째로 돌아감'])}
  ${panel(2, '③ 걸음 놓침', [[0, 0], [0, 560], [-800, 560]], () => '', ['한 구간만 짧아짐', '빨리 걸은 곳 · 계단'])}
  ${panel(3, '④ 자석 간섭', [[0, 0], [0, 800], [-300, 800], [-520, 640], [-800, 640]], (f) => { const [x, y] = f([-420, 900]); return `<rect x="${x - 18}" y="${y - 22}" width="36" height="28" rx="3" fill="var(--muted)"/><text x="${x}" y="${y - 30}" text-anchor="middle" font-size="14" fill="var(--muted)">철제 사물함</text>`; }, ['한곳에서만 휘어짐', '철 · 전자 기기 근처'])}
  <text x="20" y="392" font-size="17" fill="var(--muted)">초록 점선 = 계획 경로 · 빨간 선 = 추정 경로 (출발점은 모두 오른쪽 아래)</text>
</svg>`;
  })();

  /* ───────── 그림 8-4. 개선 함수 세 가지 ───────── */
  const FIG_FIX3 = (() => {
    let a = '', b = '';
    for (let i = 0; i <= 8; i++) a += `<circle cx="${60 + i * 30}" cy="150" r="6" fill="var(--danger)"/>`;
    for (let i = 0; i <= 10; i++) b += `<circle cx="${60 + i * 26}" cy="235" r="6" fill="var(--ok)"/>`;
    let zig = 'M890 170';
    for (let i = 1; i <= 8; i++) zig += ` L${890 + i * 40} ${170 + (i % 2 ? -18 : 14) * (i % 3 === 0 ? 0.5 : 1)}`;
    const str = 'M890 245 L1210 245';
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c8fa', 'var(--fg)')}</defs>
  <rect x="20" y="20" width="390" height="360" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="215" y="58" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--accent)">① calibrate_stride()</text>
  <text x="215" y="88" text-anchor="middle" font-size="17" fill="var(--muted)">보폭 오차 고치기</text>
  <path d="M60 115 L320 115 M60 105 L60 125 M320 105 L320 125" stroke="var(--fg)" stroke-width="3"/>
  <text x="190" y="108" text-anchor="middle" font-size="16" fill="var(--fg)">줄자 5.8m</text>
  ${a}<text x="335" y="156" font-size="15" fill="var(--danger)">67cm</text>
  <text x="60" y="190" font-size="16" fill="var(--danger)">설정 보폭: 9걸음이면 지나침</text>
  ${b}<text x="335" y="241" font-size="15" fill="var(--ok)">58cm</text>
  <text x="60" y="275" font-size="16" fill="var(--ok)">실제: 10걸음 → 580 ÷ 10 = 58</text>
  <text x="215" y="340" text-anchor="middle" font-size="17" fill="var(--fg)">아는 거리 ÷ 센 걸음 수</text>
  <rect x="445" y="20" width="390" height="360" rx="14" fill="var(--code-bg)" stroke="var(--accent2)" stroke-width="3"/>
  <text x="640" y="58" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--accent2)">② heading_offset()</text>
  <text x="640" y="88" text-anchor="middle" font-size="17" fill="var(--muted)">출발 방향 오차 고치기</text>
  <path d="M560 290 L560 130" stroke="var(--ok)" stroke-width="5" marker-end="url(#c8fa)"/>
  <text x="560" y="315" text-anchor="middle" font-size="16" fill="var(--ok)">도면 위쪽</text>
  <path d="M700 290 L740 135" stroke="var(--danger)" stroke-width="5" marker-end="url(#c8fa)"/>
  <text x="740" y="315" text-anchor="middle" font-size="16" fill="var(--danger)">나침반: 15°</text>
  <path d="M660 160 A 60 60 0 0 1 720 150" fill="none" stroke="var(--fg)" stroke-width="2"/>
  <text x="640" y="355" text-anchor="middle" font-size="17" fill="var(--fg)">도면 위쪽을 보고 여러 번 읽어 기억</text>
  <rect x="870" y="20" width="390" height="360" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="1065" y="58" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--warn)">③ keep_straight()</text>
  <text x="1065" y="88" text-anchor="middle" font-size="17" fill="var(--muted)">직진할 때 흔들림 줄이기</text>
  <path d="${zig}" fill="none" stroke="var(--danger)" stroke-width="4"/>
  <text x="1065" y="215" text-anchor="middle" font-size="16" fill="var(--danger)">몸이 흔들려 방향이 들쭉날쭉</text>
  <path d="${str}" fill="none" stroke="var(--ok)" stroke-width="4"/>
  <text x="1065" y="275" text-anchor="middle" font-size="16" fill="var(--ok)">작은 변화는 무시 → 곧은 길</text>
  <text x="1065" y="355" text-anchor="middle" font-size="17" fill="var(--fg)">20° 넘게 바뀌어야 진짜 회전</text>
</svg>`;
  })();

  /* ───────── 그림 8-5. 랜드마크에서 위치 바로잡기 ───────── */
  const FIG_LANDMARK = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c8la', 'var(--accent)')}</defs>
  <rect x="40" y="60" width="760" height="300" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <rect x="300" y="50" width="140" height="20" fill="var(--accent)" opacity="0.6"/>
  <text x="370" y="40" text-anchor="middle" font-size="18" fill="var(--accent)">칠판</text>
  <rect x="790" y="290" width="20" height="60" fill="var(--warn)"/>
  <text x="830" y="325" font-size="18" fill="var(--warn)">문</text>
  <path d="M740 330 L740 110 L380 110" fill="none" stroke="var(--ok)" stroke-width="4" stroke-dasharray="10 7"/>
  <path d="M740 330 L760 90 L560 70 L470 62" fill="none" stroke="var(--danger)" stroke-width="4"/>
  <circle cx="470" cy="62" r="9" fill="var(--danger)"/>
  <circle cx="380" cy="110" r="14" fill="none" stroke="var(--accent)" stroke-width="4"/>
  <path d="M465 70 L398 104" stroke="var(--accent)" stroke-width="4" marker-end="url(#c8la)"/>
  <text x="480" y="150" font-size="19" font-weight="bold" fill="var(--accent)">로고 터치 → 칠판 앞으로!</text>
  <path d="M380 110 L120 110 L120 300" fill="none" stroke="var(--accent)" stroke-width="4"/>
  <text x="140" y="250" font-size="17" fill="var(--accent)">바로잡은 뒤 다시 계산</text>
  <text x="560" y="230" font-size="17" fill="var(--danger)">오차가 쌓여</text>
  <text x="560" y="255" font-size="17" fill="var(--danger)">벽 밖으로 나감</text>
  <rect x="860" y="60" width="390" height="300" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1055" y="100" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">랜드마크(landmark)</text>
  <text x="885" y="145" font-size="18" fill="var(--fg)">위치를 미리 아는 곳</text>
  <text x="885" y="180" font-size="18" fill="var(--fg)">· 문 (0, 0)</text>
  <text x="885" y="210" font-size="18" fill="var(--fg)">· 칠판 앞 (−300, 400)</text>
  <text x="885" y="240" font-size="18" fill="var(--fg)">· 창가 (−700, 200)</text>
  <text x="885" y="285" font-size="18" fill="var(--fg)">거기 서서 로고를 만지면</text>
  <text x="885" y="315" font-size="18" fill="var(--fg)">쌓인 오차를 <tspan font-weight="bold">0 으로</tspan></text>
</svg>`;

  /* ───────── 그림 8-6. 지도 맞춤(map matching) ───────── */
  const FIG_MATCH = (() => {
    const room = (ox) => `<rect x="${ox}" y="70" width="480" height="260" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <path d="M${ox + 240} 70 L${ox + 240} 200" stroke="var(--fg)" stroke-width="5"/>
  <rect x="${ox + 232}" y="200" width="16" height="70" fill="var(--warn)"/>
  <path d="M${ox + 240} 270 L${ox + 240} 330" stroke="var(--fg)" stroke-width="5"/>
  <text x="${ox + 120}" y="105" text-anchor="middle" font-size="18" fill="var(--muted)">방 A</text>
  <text x="${ox + 360}" y="105" text-anchor="middle" font-size="18" fill="var(--muted)">방 B</text>
  <text x="${ox + 270}" y="240" font-size="16" fill="var(--warn)">문</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c8ma', 'var(--danger)')}${arrowDef('c8mb', 'var(--ok)')}</defs>
  <text x="300" y="45" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">① 계산만 한 경로</text>
  ${room(60)}
  <path d="M110 290 L200 220 L290 150 L380 120 L470 110" fill="none" stroke="var(--danger)" stroke-width="4" marker-end="url(#c8ma)"/>
  <path d="M290 140 L310 160 M310 140 L290 160" stroke="var(--danger)" stroke-width="4"/>
  <text x="300" y="370" text-anchor="middle" font-size="18" fill="var(--fg)">벽을 뚫고 방 B 로 — 있을 수 없는 길</text>
  <path d="M590 200 L680 200" stroke="var(--fg)" stroke-width="3" marker-end="url(#c8mb)"/>
  <text x="635" y="185" text-anchor="middle" font-size="16" fill="var(--muted)">지도 맞춤</text>
  <text x="970" y="45" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">② 지도에 맞춘 경로</text>
  ${room(730)}
  <path d="M780 290 L860 250 L940 235 L1000 235 L1060 200 L1140 130" fill="none" stroke="var(--ok)" stroke-width="4" marker-end="url(#c8mb)"/>
  <text x="970" y="370" text-anchor="middle" font-size="18" fill="var(--fg)">“벽은 못 지나고, 문으로만 다닌다” 규칙으로 고침</text>
</svg>`;
  })();

  /* ───────── 그림 8-7. 개선 전 · 후 웹 지도 ───────── */
  const FIG_BA = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="260" y="38" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">개선 전 — 오차 206cm · 벽 통과 4걸음</text>
  ${mapWithPaths(40, 62, 44, EST, 'var(--accent)')}
  <text x="960" y="38" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">개선 후 — 오차 29cm · 벽 통과 0걸음</text>
  ${mapWithPaths(740, 62, 44, AFTER, 'var(--accent2)')}
  <text x="640" y="392" text-anchor="middle" font-size="17" fill="var(--muted)">같은 경로를 같은 사람이 걸음 · 보폭 58cm 로 보정 + 출발 방향 오프셋 + 직진 보정</text>
</svg>`;

  /* ───────── 그림 8-8. 3분 발표 순서 ───────── */
  const FIG_PRESENT = (() => {
    const parts = [['문제', '30초', '왜 만들었나', 'var(--accent)', 150], ['만든 과정', '60초', '단계 · 겪은 문제', 'var(--accent2)', 300], ['결과', '45초', '그래프 · 지도', 'var(--ok)', 225], ['한계', '25초', '아직 안 되는 것', 'var(--warn)', 125], ['다음 단계', '20초', '더 해 볼 아이디어', 'var(--danger)', 100]];
    let x = 70, out = '';
    parts.forEach(([t, sec, d, c, w]) => {
      out += `<rect x="${x}" y="120" width="${w * 1.2 - 8}" height="110" rx="12" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="${x + (w * 1.2 - 8) / 2}" y="160" text-anchor="middle" font-size="21" font-weight="bold" fill="${c}">${t}</text>
  <text x="${x + (w * 1.2 - 8) / 2}" y="192" text-anchor="middle" font-size="17" fill="var(--fg)">${sec}</text>
  <text x="${x + (w * 1.2 - 8) / 2}" y="268" text-anchor="middle" font-size="16" fill="var(--muted)">${d}</text>`;
      x += w * 1.2;
    });
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="640" y="60" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">3분 발표 = 문제 → 만든 과정 → 결과 → 한계 → 다음 단계</text>
  ${out}
  <path d="M70 300 L1150 300" stroke="var(--fg)" stroke-width="2"/>
  <text x="70" y="325" font-size="16" fill="var(--muted)">0초</text>
  <text x="1150" y="325" text-anchor="end" font-size="16" fill="var(--muted)">180초</text>
  <text x="640" y="370" text-anchor="middle" font-size="18" fill="var(--fg)">상자 폭 = 쓰는 시간 · 가장 긴 것은 “만든 과정”, 가장 중요한 한 장은 “결과” 의 그래프 · 지도</text>
</svg>`;
  })();

  /* ───────── 그림 8-9. 공간 설계 창 (마우스로 공간 · 구조물 · 시작점 → 기록 겹치기) ───────── */
  const FIG_SPACE = (() => {
    const px = (x) => 320 + x * 50, py = (y) => 330 - y * 50;   // 공간 1m = 50px
    let grid = '';
    for (let x = 1; x < 8; x++) grid += `<line x1="${px(x)}" x2="${px(x)}" y1="${py(5)}" y2="${py(0)}" stroke="var(--line)"/>`;
    for (let y = 1; y < 5; y++) grid += `<line x1="${px(0)}" x2="${px(8)}" y1="${py(y)}" y2="${py(y)}" stroke="var(--line)"/>`;
    const tools = ['선택', '사각형', '원', '삼각형', '시작점'];
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c8sA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ok)"/></marker></defs>
  <text x="140" y="40" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">① 도구 · 크기</text>
  ${tools.map((t, i) => `<rect x="40" y="${60 + i * 42}" width="200" height="34" rx="8" fill="${i === 1 ? 'var(--accent)' : 'var(--code-bg)'}" stroke="var(--line)"/><text x="140" y="${83 + i * 42}" text-anchor="middle" font-size="18" fill="${i === 1 ? '#fff' : 'var(--fg)'}">${t}</text>`).join('')}
  <text x="140" y="300" text-anchor="middle" font-size="17" fill="var(--muted)">공간 가로 8m · 세로 5m</text>
  <text x="140" y="326" text-anchor="middle" font-size="17" fill="var(--muted)">구조물 가로 · 세로 · 반지름</text>
  <text x="140" y="352" text-anchor="middle" font-size="17" fill="var(--muted)">회전 · 출발 방향</text>
  <text x="520" y="40" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">② 마우스로 그리기 → ③ 기록 겹치기</text>
  <rect x="${px(0)}" y="${py(5)}" width="400" height="250" fill="var(--card)"/>
  ${grid}
  <rect x="${px(0)}" y="${py(5)}" width="400" height="250" fill="none" stroke="var(--fg)" stroke-width="4"/>
  <rect x="${px(3)}" y="${py(3)}" width="50" height="50" fill="var(--muted)" fill-opacity=".4" stroke="var(--muted)" stroke-width="2"/>
  <text x="${px(3.5)}" y="${py(2.5) + 6}" text-anchor="middle" font-size="15" fill="var(--fg)">기둥</text>
  <circle cx="${px(5.5)}" cy="${py(2.3)}" r="25" fill="var(--muted)" fill-opacity=".4" stroke="var(--muted)" stroke-width="2"/>
  <text x="${px(5.5)}" y="${py(2.3) + 6}" text-anchor="middle" font-size="15" fill="var(--fg)">원탁</text>
  <polygon points="${px(2)},${py(1.4)} ${px(2.4)},${py(0.6)} ${px(1.6)},${py(0.6)}" fill="var(--muted)" fill-opacity=".4" stroke="var(--muted)" stroke-width="2"/>
  <rect x="${px(3.8)}" y="${py(1.5)}" width="75" height="40" fill="var(--accent)" fill-opacity=".15" stroke="var(--accent)" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="${px(4.55)}" y="${py(0.8) + 18}" text-anchor="middle" font-size="14" fill="var(--accent)">끌어서 만들기</text>
  <polyline points="${px(7.5)},${py(0.5)} ${px(7.4)},${py(5.1)} ${px(6.7)},${py(5.15)}" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-dasharray="6 5"/>
  <g stroke="var(--danger)" stroke-width="4"><line x1="${px(6.7) - 9}" y1="${py(5.15) - 9}" x2="${px(6.7) + 9}" y2="${py(5.15) + 9}"/><line x1="${px(6.7) - 9}" y1="${py(5.15) + 9}" x2="${px(6.7) + 9}" y2="${py(5.15) - 9}"/></g>
  <polyline points="${px(7.5)},${py(0.5)} ${px(7.5)},${py(4.6)} ${px(1.8)},${py(4.6)} ${px(1.8)},${py(2.2)} ${px(0.8)},${py(2.2)}" fill="none" stroke="var(--ok)" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="${px(0.8)}" cy="${py(2.2)}" r="8" fill="var(--ok)"/>
  <line x1="${px(7.5)}" y1="${py(0.5)}" x2="${px(7.5)}" y2="${py(0.5) - 34}" stroke="var(--ok)" stroke-width="4" marker-end="url(#c8sA)"/>
  <circle cx="${px(7.5)}" cy="${py(0.5)}" r="13" fill="var(--ok)"/>
  <text x="${px(7.5)}" y="${py(0.5) + 6}" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">S</text>
  <text x="${px(4)}" y="372" text-anchor="middle" font-size="16" fill="var(--muted)">S = 시작점 · 화살표 = 출발 방향 · 빨간 X = 벽 밖 · 구조물 안</text>
  <text x="1015" y="40" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">④ 결과 표</text>
  <rect x="790" y="60" width="450" height="270" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <g font-size="17" fill="var(--fg)">
    <text x="810" y="98" font-weight="bold">기록</text><text x="960" y="98" font-weight="bold">걸은 길</text><text x="1070" y="98" font-weight="bold">통과 점</text>
    <line x1="805" x2="1225" y1="112" y2="112" stroke="var(--line)"/>
    <text x="810" y="146" fill="var(--danger)">개선 전</text><text x="960" y="146">15.4m</text><text x="1070" y="146" fill="var(--danger)" font-weight="bold">4</text>
    <text x="810" y="184" fill="var(--warn)">실제 보드</text><text x="960" y="184">13.2m</text><text x="1070" y="184" fill="var(--danger)" font-weight="bold">1</text>
    <text x="810" y="222" fill="var(--ok)">개선 후</text><text x="960" y="222">13.3m</text><text x="1070" y="222">0</text>
  </g>
  <text x="1015" y="270" text-anchor="middle" font-size="16" fill="var(--muted)">끝점 위치 · S → 끝점 거리 ·</text>
  <text x="1015" y="296" text-anchor="middle" font-size="16" fill="var(--muted)">통과한 걸음 번호도 함께</text>
</svg>`;
  })();
  const FIG_PM_LAUNCH = `<div class="pm-launch"><span class="muted">위쪽 막대의 <b>🗺 공간 · 경로</b> 메뉴를 누르세요.</span></div>`;

  MB_COURSE.addChapter({
    id: 'ch08', no: '08',
    title: '경로 시각화와 정확도 높이기',
    subtitle: '웹 지도 · 경로 재생 · 끝점 오차 · 오차 원인 분석 · 보폭 보정 · 방향 오프셋 · 랜드마크 · 지도 맞춤 · 발표',
    summary: '마지막 챕터입니다. 1교시에는 ch07 에서 저장한 경로를 시뮬레이터 · 파일 · 실제 보드에서 가져와 <b>웹 지도</b>의 공간 도면 위에 겹쳐 그립니다. 경로를 재생하며 <b>계획 경로</b>와 <b>추정 경로</b>를 비교하고, 끝점 오차와 벽을 통과한 걸음을 찾아 <b>오차 원인 분석표</b>를 만듭니다. 2교시에는 준비된 개선 함수(<code>calibrate_stride()</code> · <code>heading_offset()</code> · <code>keep_straight()</code>)와 <b>랜드마크</b>로 정확도를 높이고, 개선 전후를 웹 지도에서 비교합니다. 마지막으로 러닝 데이터 측정기와 실내 경로 추적기, 두 프로젝트를 돌아보며 3분 발표를 준비합니다.',
    goals: [
      '시뮬레이터 📊 로그 · 💾 파일 · 실제 보드(USB)에서 경로 기록을 꺼내 CSV 로 모을 수 있다',
      '웹 지도에서 계획 경로와 추정 경로를 겹쳐 보고, 경로 재생 · 걸음 점 · 끝점 오차 · 벽 통과 걸음을 읽을 수 있다',
      '경로의 모양을 보고 오차 원인(보폭 오차 · 방향 오차 · 걸음 놓침 · 자석 간섭)을 추측해 분석표로 정리할 수 있다',
      '준비된 개선 함수와 랜드마크로 기록기를 고치고, 개선 전후의 오차를 숫자와 지도로 비교할 수 있다',
      '지도 맞춤(map matching)의 생각을 그림으로 설명할 수 있다',
      '두 프로젝트의 개발 과정 · 결과 · 한계 · 다음 단계를 3분 발표로 정리할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch08-1',
        title: '웹 지도에서 경로 보기',
        minutes: 50,
        goals: [
          '시뮬레이터 · 파일 · 실제 보드에서 경로 기록을 꺼내는 세 가지 길을 말하고, 콘솔로 <code>path.csv</code> 를 꺼낼 수 있다',
          '웹 지도에서 공간 도면 위에 추정 경로를 겹쳐 그리고, 경로 재생과 걸음 점으로 어디서 틀어졌는지 찾을 수 있다',
          '계획 경로와 추정 경로의 끝점 오차 거리와 벽 통과 걸음 수를 구할 수 있다',
          '경로 모양으로 오차 원인을 추측해 분석표를 만들고, 같은 경로를 세 번 걸어도 결과가 다른 까닭을 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['데이터 가져오기', 8], ['웹 지도 위에 그리기 · 재생', 9], ['끝점 오차 · 벽 통과', 5], ['오차 원인 분석표', 8], ['비교 활동 (가상 · 보드)', 8], ['토론: 세 번 걷기', 5], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>기록된 경로를 도면 위에 그렸더니 벽을 뚫고 지나간다면, 무엇이 잘못된 것일까요?</b> 벽은 움직이지 않습니다. 사람도 벽을 뚫고 걸을 수 없습니다. 그렇다면 틀린 것은 무엇일까요? 떠오르는 까닭을 세 가지 이상 공책에 적어 오세요.' },
          { type: 'p', html: '친구들이 적어 온 까닭을 모아 보면 대개 네 묶음으로 나뉩니다. “보폭을 잘못 넣었다”, “방향이 틀렸다”, “걸음을 덜 세거나 더 셌다”, “나침반이 이상했다”. 모두 맞는 생각입니다. 벽을 뚫은 경로는 <b>사람이 아니라 계산이 틀렸다</b>는 증거입니다. 오늘은 이 증거를 지도 위에서 눈으로 보고, 어느 까닭이 가장 컸는지 찾아내는 <b>탐정</b>이 되어 봅니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 마지막 두 단계', html: '실내 이동 경로 추적 프로젝트의 마지막 시간입니다. 문제 정하기 → 잴 것 정하기 → 센서 읽기 → 계산하기(ch06) → 공간 만들기 · 저장하기(ch07) → <b>보여 주기</b>(1교시) → <b>고치기 · 발표하기</b>(2교시). 러닝 데이터 측정기를 ch05 에서 그래프로 보았듯이, 경로 추적기도 <b>그림으로 보아야</b> 무엇이 잘못됐는지 알 수 있습니다.' },

          { type: 'h', text: '데이터 가져오기 — 세 가지 길' },
          { type: 'p', html: 'ch07 에서 경로를 두 가지 방법으로 저장했습니다. <code>log</code> 모듈로 저장한 표와, <code>open()</code> 으로 쓴 <code>path.csv</code> 파일입니다. 여기에 실제 보드로 기록한 데이터까지 더하면 데이터를 가져오는 길은 세 가지입니다. 어느 길로 가져와도 결국 <b>x · y 가 든 CSV</b> 하나가 됩니다.' },
          { type: 'figure', html: FIG_IMPORT, caption: '그림 8-1. 경로 기록을 웹 지도로 가져오는 세 가지 길' },
          {
            type: 'list', ordered: true, items: [
              '<b>시뮬레이터 · 📊 로그 탭</b> — 예제 7-15(경로 기록기)로 기록했다면 📊 로그 탭에 걸음마다 한 줄씩 표가 쌓여 있습니다. <b>⬇ CSV 내려받기</b>를 누르면 파일로 저장됩니다.',
              '<b>시뮬레이터 · 💾 파일 탭</b> — 응용 7-16(파일 기록기)로 기록했다면 💾 파일 탭에 <code>path.csv</code> 가 있습니다. 파일 이름을 눌러 내려받습니다.',
              '<b>실제 보드 · USB</b> — <code>log</code> 로 기록했다면 USB 로 연결했을 때 보이는 <b>MICROBIT</b> 드라이브의 <b>MY_DATA.HTM</b> 을 엽니다. <code>open()</code> 으로 쓴 파일은 드라이브에 보이지 않으므로, <b>🔌 보드</b>로 연결한 뒤 아래 예제 8-1 로 콘솔에 꺼냅니다.'
            ]
          },
          {
            type: 'code', title: '예제 8-1. 보드에 저장된 path.csv 를 콘솔로 꺼내기', code: `from microbit import *

try:
    with open("path.csv") as f:
        text = f.read()
    lines = [line for line in text.split("\\n") if line]
    for line in lines:
        print(line)
    print("모두", len(lines) - 1, "걸음 기록")
    display.show(Image.YES)
except OSError:
    print("path.csv 가 없습니다.")
    print("ch07 의 파일 기록기(응용 7-16)로 먼저 기록하세요.")
    display.show(Image.NO)`,
            desc: '파일을 열어 전부 읽고, 줄바꿈으로 나눈 뒤 빈 줄을 빼고 한 줄씩 찍습니다. 첫 줄은 이름표이므로 걸음 수는 <b>줄 수 − 1</b> 입니다. 파일이 없으면 <code>OSError</code> 가 나는데, <code>try ... except</code> 로 잡아서 안내 문구를 보여 줍니다. 콘솔에 나온 글자를 모두 복사해 메모장에 붙이고 <code>path.csv</code> 로 저장하면 웹 지도에 불러올 수 있습니다.',
            expect: 'time,steps,heading,x,y\n0.5,1,350,-12,66\n1.0,2,348,-26,132\n…\n모두 23 걸음 기록\n(파일이 없으면) path.csv 가 없습니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '<code>log</code> 로 저장한 기록은 <b>MY_DATA.HTM</b> 에서 바로 CSV 로 내려받을 수 있어 가장 쉽습니다. 반면 <code>open()</code> 으로 쓴 파일은 MICROBIT 드라이브에 보이지 않습니다. 이때는 기록기 대신 예제 8-1 을 <b>🔌 보드</b>로 올려 실행합니다. 새 프로그램을 올려도 보드 안의 파일은 남아 있지만, 보드를 다시 <b>플래시(hex 파일 복사)</b>하면 파일이 지워질 수 있으니 먼저 꺼내 둡니다.' },

          { type: 'h', text: '웹 지도 위에 경로 겹쳐 그리기' },
          { type: 'p', html: '웹 지도 화면은 두 가지를 불러옵니다. ch07 에서 만든 <b>공간 도면</b>과, 방금 꺼낸 <b>경로 CSV</b> 입니다. 그러면 도면 위에 두 가지 길이 겹쳐 보입니다. 하나는 걸으려고 계획했던 <b>계획 경로</b>, 다른 하나는 보드가 걸음 · 방향으로 계산한 <b>추정 경로</b>입니다.' },
          { type: 'figure', html: FIG_WEBMAP, caption: '그림 8-2. 웹 지도 화면 예시 — ch07 의 교실 도면 위에 개선 전 기록을 겹쳐 그림' },
          {
            type: 'table', caption: '표 8-1. 웹 지도 화면의 각 부분이 알려 주는 것',
            head: ['화면 부분', '보이는 모양', '알 수 있는 것'],
            rows: [
              ['계획 경로', '초록 점선', '걸으려던 길 (정답)'],
              ['추정 경로', '파란 선 + 점', '보드가 계산한 길 · 점 하나 = 한 걸음'],
              ['벽 통과 표시', '빨간 X', '벽 · 기둥 칸에 찍힌 걸음 — 계산이 틀린 곳'],
              ['▶ 재생 · 막대', '점이 하나씩 늘어남', '어느 걸음부터 틀어지기 시작했나'],
              ['끝점 오차', '빨간 짧은 점선 · 카드', '마지막 위치가 얼마나 빗나갔나 (cm)'],
              ['☑ 걸음 점', '켜고 끄기', '점 간격이 넓으면 보폭이 크게, 좁으면 작게 설정된 것']
            ]
          },
          { type: 'p', html: '그림 8-2 를 보면 처음 7걸음은 북쪽으로 잘 가다가 <b>위쪽 벽을 뚫고</b> 나갔고, 서쪽으로 간 뒤 마지막 두 걸음은 <b>왼쪽 벽 밖</b>으로 나갔습니다. 걸음 점의 간격이 계획보다 넓고, 길 전체가 왼쪽으로 조금 기울었습니다. 무엇이 잘못됐는지 벌써 짐작이 가나요?' },
          { type: 'p', html: '웹 지도가 하는 일의 핵심은 <b>cm 위치를 지도 칸으로 바꾸는 것</b>입니다. 시작점 S 가 8열 5줄에 있으므로, x 는 100cm 마다 한 칸씩 오른쪽(열 +1), y 는 100cm 마다 한 칸씩 위쪽(줄 −1)으로 갑니다. y 가 커지면 줄 번호는 <b>작아진다</b>는 점에 주의합니다.' },
          {
            type: 'code', title: '예제 8-2. 위치(cm)를 지도 칸으로 바꾸기', repl: true, code: `SC, SR = 8, 5
x, y = -412, 395
SC + round(x / 100), SR - round(y / 100)
x, y = -84, 461
SC + round(x / 100), SR - round(y / 100)`,
            desc: '시작점 칸 (8, 5) 에서 출발합니다. 12번째 걸음 (−412, 395) 는 4열 1줄 — 칠판 앞(B) 근처 바닥입니다. 7번째 걸음 (−84, 461) 은 7열 <b>0줄</b>인데, 지도의 0줄은 위쪽 벽입니다. 이렇게 걸음마다 칸을 구해 점을 찍으면 지도가 됩니다.',
            expect: '>>> SC, SR = 8, 5\n>>> x, y = -412, 395\n>>> SC + round(x / 100), SR - round(y / 100)\n(4, 1)\n>>> x, y = -84, 461\n>>> SC + round(x / 100), SR - round(y / 100)\n(7, 0)'
          },
          { type: 'p', html: '이 계산을 걸음마다 되풀이해 지도 글자 위에 찍으면, 웹 화면이 없어도 콘솔에서 경로 지도를 볼 수 있습니다. 준비된 함수 <code>draw_path()</code> 가 그 일을 합니다. 걸음은 <code>*</code>, 벽 · 기둥에 찍힌 걸음은 <code>X</code>, 끝점은 <code>E</code> 입니다.' },
          {
            type: 'code', title: '예제 8-3. 콘솔에 경로 지도 그리기', code: `from microbit import *
import math

` + PY_ROOM + `
` + PY_MAP_KIT + `
` + PY_DRAW + `
SC, SR = find("S")
` + pyPts('EST', EST) + `
draw_path(EST)
print("걸음 수:", len(EST))`,
            desc: '<code>EST</code> 는 개선 전 기록(그림 8-2 와 같은 데이터)에서 x · y 만 뽑은 목록입니다. 맨 위 줄(벽)과 맨 왼쪽 열(벽)에 <code>X</code> 가 보이면, 그 걸음에서 계산이 벽을 뚫은 것입니다. 이 기록은 끝점(23걸음째)마저 벽 위라서 <code>E</code> 대신 <code>X</code> 로 보입니다. 한 칸에 여러 걸음이 찍히면 <code>*</code> 하나로 보입니다.',
            expect: '# # # # # # X X # #\n# * * * * * * * . #\n# * . . . . . * * #\n# * . . P . . . * #\nX * . . . . . . * #\n# . . . . . . . S D\n# # # # # # # # # #\n걸음 수: 23'
          },
          { type: 'callout', kind: 'tip', title: '내 기록으로 그려 보기', html: '예제 8-1 로 꺼낸 CSV 에서 x · y 두 칸만 골라 <code>EST</code> 목록에 옮겨 적으면 내 경로가 그려집니다. 줄이 많으면 앞의 10줄만 옮겨도 충분히 모양을 볼 수 있습니다.' },
          { type: 'p', html: '지도는 한 장의 사진이라 <b>어느 순서로</b> 틀어졌는지 알기 어렵습니다. 그래서 웹 지도에는 <b>▶ 재생</b>이 있습니다. 걸음을 하나씩 다시 보여 주면, 몇 번째 걸음에서 벽에 닿았는지 바로 보입니다. 같은 일을 LED 화면에서도 해 봅니다.' },
          {
            type: 'code', title: '예제 8-4. LED 로 경로 재생하기', code: `from microbit import *

` + PY_ROOM + `
` + PY_MAP_KIT + `
SC, SR = find("S")
` + pyPts('EST', EST) + `
LIGHT = {"#": 3, "P": 3, "D": 6, "B": 6, "W": 6}   # LED 밝기

def show_at(x, y):
    # 준비된 함수: 사람 둘레 5x5 칸을 LED 에 (벽 흐리게 · 사람 밝게)
    pc, pr = to_cell(x, y)
    for i in range(5):
        for j in range(5):
            display.set_pixel(i, j, LIGHT.get(cell(pc + i - 2, pr + j - 2), 0))
    display.set_pixel(2, 2, 9)

def replay(path, delay):
    for i in range(len(path)):
        x, y = path[i]
        show_at(x, y)
        if is_wall(x, y):
            print(i + 1, "걸음째: 벽 통과!", (x, y))
            sleep(delay)
            display.show(Image.NO)
        sleep(delay)
    display.show(Image.YES)

replay(EST, 300)
while True:
    if button_a.was_pressed():       # 다시 재생
        replay(EST, 300)
    if button_b.was_pressed():       # 빠르게 재생
        replay(EST, 100)
    sleep(20)`,
            desc: '가운데 밝은 점이 계산한 위치이고, 흐린 점은 둘레의 벽입니다. 벽 칸에 들어간 걸음에서는 X 표시가 잠깐 뜨고 콘솔에 걸음 번호가 찍힙니다. 웹 지도의 ▶ 재생과 같은 생각입니다.',
            hint: '처음 한 번 자동으로 재생됩니다. 다시 보려면 <b>A</b>, 빠르게 보려면 <b>B</b> 를 누릅니다.',
            expect: '7 걸음째: 벽 통과! (-84, 461)\n8 걸음째: 벽 통과! (-150, 452)\n22 걸음째: 벽 통과! (-783, 63)\n23 걸음째: 벽 통과! (-850, 59)\n(LED: 밝은 점이 한 걸음씩 움직이고, 벽 칸에서는 X 가 잠깐 보인 뒤 마지막에 ✓)'
          },

          { type: 'h', text: '계획 경로와 비교하기 — 끝점 오차' },
          { type: 'p', html: '경로가 얼마나 틀렸는지 숫자 하나로 말하려면 <b>끝점 오차</b>를 씁니다. 걸으려던 끝점(계획)과 계산한 끝점(추정) 사이의 <b>직선 거리</b>입니다. 오늘의 계획 끝점은 창가 (−700, 200) 입니다. 두 점 사이 거리는 피타고라스 정리로 구하는데, 준비된 함수 <code>end_error()</code> 에 맡깁니다.' },
          {
            type: 'code', title: '예제 8-5. 끝점 오차 거리 구하기', code: `from microbit import *
import math

` + PY_ERR + `
PLAN_END = (-700, 200)     # 계획 끝점: 창가
EST_END = (-850, 59)       # 개선 전 기록의 마지막 줄
ROUTE_LEN = 1300           # 계획 경로 길이 4 + 6 + 2 + 1 m

err = end_error(PLAN_END, EST_END)
print("끝점 오차:", err, "cm")
print("걸은 길 대비:", round(err * 100 / ROUTE_LEN), "%")
if err <= 50:
    print("같은 칸 안 - 아주 좋음")
elif err <= 100:
    print("옆 칸 - 쓸 만함")
else:
    print("두 칸 이상 - 고칠 곳이 있음")
display.scroll(str(err))`,
            desc: '끝점이 계획보다 서쪽으로 150cm, 남쪽으로 141cm 빗나가 직선 거리는 약 2m 입니다. 13m 를 걸었으니 걸은 길의 16% 만큼 틀렸습니다. 1칸 = 1m 지도에서는 <b>50cm 안이면 같은 칸</b>이라 지도 위에서는 맞은 것처럼 보입니다.',
            expect: '끝점 오차: 206 cm\n걸은 길 대비: 16 %\n두 칸 이상 - 고칠 곳이 있음\n(LED 에 206 이 흘러갑니다)'
          },
          { type: 'p', html: '끝점 오차만으로는 <b>중간에 벽을 뚫었는지</b> 알 수 없습니다. 끝점이 운 좋게 맞아도 중간에 엉뚱한 곳을 지났을 수 있으니까요. 그래서 벽 · 기둥 칸에 찍힌 걸음도 셉니다.' },
          {
            type: 'code', title: '예제 8-6. 벽을 뚫은 걸음 찾기', code: `from microbit import *

` + PY_ROOM + `
` + PY_MAP_KIT + `
` + PY_WALLS + `
SC, SR = find("S")
` + pyPts('EST', EST) + `
bad = wall_steps(EST)
print("벽 통과 걸음:", bad)
print("모두", len(bad), "걸음 /", len(EST), "걸음")
for n in bad:
    x, y = EST[n - 1]
    print(n, "걸음째", (x, y), "->", to_cell(x, y), "칸")`,
            desc: '7 · 8 걸음째는 위쪽 벽(0줄), 22 · 23 걸음째는 왼쪽 벽(0열)입니다. 북쪽으로 걸을 때 이미 계획(4m)보다 멀리 가 버렸다는 뜻입니다. 이 숫자들이 다음에 만들 원인 분석표의 <b>증거</b>가 됩니다.',
            expect: '벽 통과 걸음: [7, 8, 22, 23]\n모두 4 걸음 / 23 걸음\n7 걸음째 (-84, 461) -> (7, 0) 칸\n8 걸음째 (-150, 452) -> (6, 0) 칸\n22 걸음째 (-783, 63) -> (0, 4) 칸\n23 걸음째 (-850, 59) -> (0, 4) 칸'
          },
          { type: 'callout', kind: 'info', title: '오차가 몇 cm 면 괜찮을까?', html: '정답은 <b>쓰임에 따라 다릅니다</b>. “지금 어느 방에 있나?”만 알면 되는 장치라면 1m 오차도 괜찮습니다. “어느 책상 앞인가?”를 알아야 한다면 50cm 안이어야 합니다. 발표할 때 “우리 장치는 ○○ 용도라서 오차 ○○cm 를 목표로 했다”라고 말할 수 있으면 아주 좋은 발표입니다.' },

          { type: 'h', text: '오차 원인 분석표 만들기' },
          { type: 'p', html: '이제 탐정 일입니다. 오차의 원인은 크게 네 가지인데, 원인마다 <b>지도 위에 남기는 모양</b>이 다릅니다. 모양을 알면 범인을 좁힐 수 있습니다.' },
          { type: 'figure', html: FIG_CAUSES, caption: '그림 8-3. 오차 원인마다 지도에 남는 모양' },
          {
            type: 'table', caption: '표 8-2. 오차 원인과 확인 방법',
            head: ['원인', '지도에 보이는 모양', '확인 방법'],
            rows: [
              ['① 보폭 오차', '모양은 같은데 전체가 크거나 작음', '걸음 점 간격 · 줄자로 잰 실제 보폭과 비교'],
              ['② 방향 오차', '모양 · 크기는 같은데 통째로 돌아감', '출발할 때 어느 쪽을 보고 A 를 눌렀나'],
              ['③ 걸음 놓침 (또는 더 셈)', '어느 한 구간만 짧거나 김', '실제 걸음 수와 기록 걸음 수 비교'],
              ['④ 자석 간섭', '한곳에서만 휘어지거나 꺾임', '휘는 곳 근처에 철제 가구 · 전자 기기가 있나']
            ]
          },
          { type: 'p', html: '모양을 눈으로 보는 것에 더해, 숫자로도 확인합니다. 준비된 함수 <code>diagnose()</code> 는 출발점에서 끝점까지의 <b>길이 비율</b>과 <b>방향 차이</b>를 구합니다. 길이 비율이 1 보다 크면 너무 멀리 간 것(보폭이 큼), 작으면 덜 간 것입니다. 방향 차이가 + 면 시계 방향, − 면 반시계 방향으로 돌아간 것입니다.' },
          {
            type: 'code', title: '예제 8-7. 길이 비율과 방향 차이로 원인 좁히기', code: `from microbit import *
import math

` + PY_DIAG + `
` + PY_GUESS + `
PLAN_END = (-700, 200)
EST_END = (-850, 59)

ratio, diff = diagnose(PLAN_END, EST_END)
print("길이 비율:", ratio)
print("방향 차이:", diff, "도")
print("의심 1순위:", guess(ratio, diff))
if abs(diff) > 10:
    print("의심 2순위: 방향 오차")`,
            desc: '길이 비율 1.17 — 계산한 길이 실제보다 17% 깁니다. 보폭을 67cm 로 넣었는데 실제 보폭이 약 58cm 였다면 딱 이만큼 차이가 납니다(67 ÷ 58 ≈ 1.16). 방향 차이 −12° 는 길 전체가 반시계 방향(왼쪽)으로 돌아갔다는 뜻으로, 출발할 때 방향을 잘못 기억했을 가능성이 큽니다.',
            expect: '길이 비율: 1.17\n방향 차이: -12 도\n의심 1순위: 보폭이 너무 큼 (또는 걸음을 더 셈)\n의심 2순위: 방향 오차'
          },
          {
            type: 'table', caption: '표 8-3. 오차 원인 분석표 (개선 전 기록 예시)',
            head: ['원인', '증거', '의심 정도', '다음 시간에 고칠 방법'],
            rows: [
              ['보폭 오차', '걸음 점 간격이 넓음 · 길이 비율 1.17 · 북쪽 4m 에서 벽 통과', '★★★', '보폭 다시 재기'],
              ['방향 오차', '길 전체가 반시계로 12° · 북쪽으로 가는데 왼쪽으로 기욺', '★★', '출발 방향 다시 맞추기'],
              ['걸음 놓침', '실제 23걸음 · 기록 23걸음 — 같음', '☆', '—'],
              ['자석 간섭', '한곳에서만 꺾인 곳은 없음', '☆', '—']
            ]
          },
          { type: 'p', html: '<code>diagnose()</code> 는 끝점 하나만 보기 때문에 속을 때도 있습니다. 아래 응용 예제는 같은 경로를 <b>실제 보드</b>로 걸은 기록과 함께 비교합니다. 실제 보드 기록은 숫자만 보면 “보폭이 작다”로 나오지만, 지도를 그려 보면 다른 범인이 보입니다.' },
          {
            type: 'code', title: '응용 8-8. 가상 공간 기록과 실제 보드 기록 비교하기', code: `from microbit import *
import math

` + PY_ROOM + `
` + PY_MAP_KIT + `
` + PY_DRAW + `
` + PY_WALLS + `
` + PY_ERR + `
` + PY_DIAG + `
` + PY_GUESS + `
SC, SR = find("S")
PLAN_END = (-700, 200)
` + pyPts('EST', EST) + `
` + pyPts('BOARD', BOARD) + `
for name, path in [("가상 공간", EST), ("실제 보드", BOARD)]:
    ratio, diff = diagnose(PLAN_END, path[-1])
    print("[", name, "]", len(path), "걸음")
    print("  끝점 오차", end_error(PLAN_END, path[-1]), "cm · 벽 통과", len(wall_steps(path)))
    print("  길이 비율", ratio, "· 방향 차이", diff, "->", guess(ratio, diff))

print("실제 보드 기록 지도:")
draw_path(BOARD)`,
            desc: '실제 보드 기록은 23걸음을 걸었는데 22걸음만 남았습니다(걸음 놓침). 그런데 지도를 보면 더 큰 범인이 보입니다. 서쪽으로 가던 길이 중간에 <b>아래로 비스듬히 꺾여</b> 기둥(P)을 지납니다. 기둥 옆에 <b>철제 사물함</b>이 있었다면 자석 간섭을 의심해야 합니다. 숫자와 지도를 <b>함께</b> 보아야 하는 까닭입니다.',
            expect: '[ 가상 공간 ] 23 걸음\n  끝점 오차 206 cm · 벽 통과 4\n  길이 비율 1.17 · 방향 차이 -12 -> 보폭이 너무 큼 (또는 걸음을 더 셈)\n[ 실제 보드 ] 22 걸음\n  끝점 오차 222 cm · 벽 통과 1\n  길이 비율 0.84 · 방향 차이 -16 -> 보폭이 너무 작음 (또는 걸음 놓침)\n실제 보드 기록 지도:\n# # # # # # # # # #\n# . . . B * * * * #\n# W . . * * . . * #\n# W . * X . . . * #\n# W . * . . . . * #\n# . E * . . . . S D\n# # # # # # # # # #'
          },

          { type: 'h', text: '토론 — 같은 경로를 세 번 걸으면?' },
          { type: 'p', html: '같은 사람이 같은 경로를 세 번 걸으면 웹 지도의 경로도 세 번 똑같을까요? 실제로 해 보면 매번 조금씩 다릅니다. 아래 예제는 걸을 때마다 보폭이 조금 달라지고(55~65cm), 몸이 흔들려 방향이 ±10° 흔들리고, 가끔(5%) 걸음을 놓치는 상황을 흉내 냅니다.' },
          {
            type: 'code', title: '예제 8-9. 같은 경로를 세 번 걸어 보기', code: `from microbit import *
import math
import random

` + PY_MOVE + `
` + PY_ERR + `
PLAN = [(0, 4), (270, 6), (180, 2), (270, 1)]   # (도면 방위, m)
PLAN_END = (-700, 200)
STRIDE = 60                                     # 프로그램에 넣은 보폭

def walk_once():
    # 같은 경로를 한 번 걷는 흉내 - 실제 보폭 · 방향이 매번 조금씩 다름
    x, y, steps = 0, 0, 0
    for h, m in PLAN:
        real = random.randint(55, 65)        # 이번 구간의 실제 보폭
        for i in range(round(m * 100 / real)):
            if random.randint(1, 20) == 1:   # 5% 는 걸음을 놓침
                continue
            x, y = move(x, y, h + random.randint(-10, 10), STRIDE)
            steps += 1
    return round(x), round(y), steps

for k in range(3):
    x, y, steps = walk_once()
    print(k + 1, "번째:", steps, "걸음 · 끝점", (x, y), "· 오차", end_error(PLAN_END, (x, y)), "cm")`,
            desc: '실행할 때마다 결과가 달라집니다. 세 번의 끝점이 서로 가까이 모여 있으면 <b>매번 비슷하게 틀리는</b> 것(보폭 · 출발 방향처럼 고칠 수 있는 오차)이고, 여기저기 흩어져 있으면 <b>그때그때 달라지는</b> 것(흔들림 · 걸음 놓침)입니다.',
            expect: '1 번째: 18 걸음 · 끝점 (-516, 162) · 오차 188 cm\n2 번째: 21 걸음 · 끝점 (-719, 319) · 오차 121 cm\n3 번째: 22 걸음 · 끝점 (-790, 170) · 오차 95 cm\n(실행할 때마다 다릅니다)',
            nondeterministic: true
          },
          {
            type: 'list', items: [
              '💬 <b>왜 매번 다를까요?</b> — 걷는 빠르기에 따라 보폭이 바뀌고, 몸이 흔들려 방위가 출렁이고, 살살 걸으면 걸음을 놓칩니다. 출발할 때 바라본 방향도 매번 조금씩 다릅니다.',
              '💬 <b>어떤 오차는 매번 같은 쪽으로 틀릴까요?</b> — 보폭을 잘못 넣은 것, 출발 방향을 잘못 기억한 것. 이런 오차는 <b>보정</b>으로 고칠 수 있습니다(2교시).',
              '💬 <b>세 번 걸은 결과로 무엇을 할 수 있을까요?</b> — 세 끝점의 가운데를 구하면 한 번보다 믿을 만합니다. 흩어진 정도를 보면 우리 장치가 얼마나 믿을 만한지 말할 수 있습니다.'
            ]
          },
          { type: 'callout', kind: 'board', title: '실제 보드로 같은 경로 걷기', html: '가능하면 실제 보드로도 같은 경로를 걸어 봅니다. 보드는 <b>배꼽 앞에 수평으로</b> 붙이고, 출발할 때 칠판 쪽을 보고 A 를 누릅니다. 철제 사물함 · 스피커 · 노트북 옆을 지나면 방위가 휘기 쉬우니, 그런 곳을 지났다면 분석표에 꼭 적습니다. 복도에서는 뛰지 않습니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 활동', html: '① 가상 공간에서 조이스틱으로 오늘의 경로를 걸어 기록합니다(예제 7-15). ② 가능하면 실제 보드로도 같은 경로를 걷습니다. ③ 두 기록을 웹 지도(또는 예제 8-3 · 응용 8-8)로 그려 비교합니다. ④ 표 8-3 처럼 <b>오차 원인 분석표</b>를 모둠 공책에 만듭니다. 기록한 CSV 는 2교시에 개선 전 자료로 쓰니 잘 보관합니다.' }
        ],
        slides: [
          { layout: 'title', title: '웹 지도에서 경로 보기', subtitle: 'Chapter 08 · 경로 시각화와 정확도 높이기', badge: '1교시', notes: '<p>마지막 챕터임을 알립니다. “지난 시간에 저장한 경로를 오늘은 지도 위에 그려 봅니다. 그리고 다음 시간에는 고쳐서 발표합니다.”</p><p>ch07 에서 내려받은 CSV 를 준비했는지 확인합니다. 없으면 예제 데이터를 씁니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 벽을 뚫는 경로', lead: '벽도 사람도 그대로인데 왜?', bullets: ['보폭을 잘못 넣었다', '방향이 틀렸다', '걸음을 덜 · 더 셌다', '나침반이 이상했다', '→ 틀린 것은 <b>계산</b>'], notes: '<p>💬 “벽을 뚫고 지나갔다면 무엇이 잘못일까요?” — 예상 답: 보폭, 방향, 걸음 수, 센서 고장.</p><p>학생 답을 칠판에 네 묶음으로 모아 적어 두면 나중 분석표와 연결됩니다.</p><p>“오늘 우리는 탐정입니다. 증거는 지도입니다.”</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '데이터 가져오기 — 세 가지 길', html: FIG_IMPORT, caption: '어느 길이든 x · y 가 든 CSV 하나', notes: '<p>세 길을 차례로 시연합니다: 📊 로그 탭 CSV, 💾 파일 탭 path.csv, 실제 보드 MY_DATA.HTM.</p><p>open() 으로 쓴 파일은 MICROBIT 드라이브에 보이지 않는다는 점을 꼭 짚습니다.</p><p>💬 “어떤 길이 가장 쉬울까요?” — log + MY_DATA.HTM.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '콘솔로 path.csv 꺼내기', code: `from microbit import *

try:
    with open("path.csv") as f:
        text = f.read()
    for line in text.split("\\n"):
        if line:
            print(line)
except OSError:
    print("path.csv 가 없습니다.")`, points: ['<code>try ... except</code> — 파일이 없을 때 대비', '콘솔 글자 복사 → 메모장 → .csv', '🔌 보드로 연결해 실제 보드에서도'], notes: '<p>예제 8-1 의 짧은 버전입니다. 파일이 없으면 안내 문구가 나오는 것도 보여 줍니다.</p><p>실제 보드가 있는 모둠은 🔌 보드 연결 후 실행해 보게 합니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '웹 지도 화면', html: FIG_WEBMAP, caption: '초록 점선 = 계획 · 파란 점 = 걸음 · X = 벽 통과', notes: '<p>도면 불러오기 → CSV 불러오기 → ▶ 재생 순서로 시연합니다.</p><p>💬 “처음 몇 걸음은 잘 가다가 어디서부터 틀어지나요?” — 북쪽 끝에서 벽을 뚫음, 마지막에 왼쪽 벽 밖.</p><p>💬 “점 간격이 계획보다 넓은가 좁은가?” — 넓음 → 보폭 의심.</p><p>시간: 5분</p>' },
          { layout: 'code', title: 'cm → 지도 칸', repl: true, code: `SC, SR = 8, 5
x, y = -412, 395
SC + round(x / 100), SR - round(y / 100)
x, y = -84, 461
SC + round(x / 100), SR - round(y / 100)`, points: ['열 = SC + x ÷ 100', '줄 = SR − y ÷ 100 (위로 갈수록 작아짐)', '0줄 = 위쪽 벽'], notes: '<p>예제 8-2 를 셸에서 함께 입력합니다.</p><p>y 가 커지면 줄 번호가 작아지는 것이 헷갈리기 쉬우니 손가락으로 지도를 짚으며 설명합니다.</p><p>이어서 예제 8-3(콘솔 지도) · 8-4(LED 재생)를 학생 화면에서 실행하게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '끝점 오차 · 벽 통과', head: ['잰 것', '개선 전 기록', '뜻'], rows: [['끝점 오차', '206cm', '두 칸 넘게 빗나감'], ['걸은 길 대비', '16%', '13m 중 약 2m'], ['벽 통과 걸음', '7 · 8 · 22 · 23', '북쪽 끝 · 서쪽 끝'], ['50cm 이내?', '아니요', '같은 칸이면 지도상 정답']], lead: '예제 8-5 · 8-6', notes: '<p>끝점 오차는 “직선 거리”임을 강조합니다. 계산은 준비된 함수에 맡깁니다.</p><p>💬 “끝점이 맞으면 다 맞은 걸까요?” — 아니요, 중간에 벽을 뚫었을 수 있음 → 벽 통과 걸음도 셈.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '오차 원인 네 가지의 모양', html: FIG_CAUSES, caption: '크기 · 회전 · 한 구간 · 한곳', notes: '<p>네 그림을 하나씩 가리키며 “이 모양이면 누가 범인?”을 묻습니다.</p><p>💬 “우리 기록은 어느 모양에 가까운가요?” — 조금 크고(보폭) 조금 돌아감(방향).</p><p>예제 8-7 diagnose() 로 숫자 확인: 비율 1.17, 방향 −12°.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '오차 원인 분석표', head: ['원인', '증거', '의심'], rows: [['보폭 오차', '점 간격 넓음 · 비율 1.17', '★★★'], ['방향 오차', '반시계 12°', '★★'], ['걸음 놓침', '23 = 23', '☆'], ['자석 간섭', '꺾인 곳 없음', '☆']], lead: '증거와 함께 적기', notes: '<p>표 8-3 을 함께 채워 보고, 모둠 기록으로 같은 표를 만들게 합니다.</p><p>“의심 정도”는 증거가 많을수록 ★ 를 더 줍니다. 증거 없이 ★ 를 주지 않도록 합니다.</p><p>시간: 4분</p>' },
          { layout: 'two', title: '비교 활동 — 가상 공간 · 실제 보드', left: { title: '가상 공간', bullets: ['조이스틱으로 오늘의 경로', '예제 7-15 로 기록', '📊 로그 → CSV'] }, right: { title: '실제 보드 (가능하면)', bullets: ['배꼽 앞 수평으로', '칠판 쪽 보고 A', '철제 가구 옆은 메모'] }, notes: '<p>모둠별로 두 기록을 만들고 웹 지도 또는 응용 8-8 로 비교합니다.</p><p>💬 응용 8-8 결과: 실제 보드는 숫자로는 “보폭 작음”이지만, 지도에서는 기둥 근처에서 꺾임 → 자석 간섭. 숫자와 지도를 함께 봐야 함.</p><p>복도에서 뛰지 않기를 다시 강조합니다.</p><p>시간: 9분</p>' },
          { layout: 'bullets', title: '토론 — 세 번 걸으면?', bullets: ['매번 다른 까닭: 보폭 · 흔들림 · 놓침', '모여 있으면 → 매번 같은 쪽으로 틀림', '흩어지면 → 그때그때 달라짐', '같은 쪽 오차는 <b>보정</b>으로 고침'], notes: '<p>예제 8-9 를 세 번 실행해 끝점을 칠판에 찍어 봅니다.</p><p>💬 “어떤 오차는 고칠 수 있고, 어떤 오차는 어려울까요?” — 보폭 · 출발 방향은 고칠 수 있음, 흔들림은 줄일 수만 있음.</p><p>2교시와 연결합니다.</p><p>시간: 4분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['세 길로 가져와도 결국 CSV 하나', '웹 지도 = 도면 + 계획 경로 + 추정 경로', '끝점 오차 + 벽 통과 걸음', '모양으로 원인 찾기: 크기 · 회전 · 한 구간 · 한곳', '숫자와 지도를 함께'], notes: '<p>분석표와 CSV 를 2교시까지 보관하게 합니다.</p><p>다음 시간 “생각하기”: 내가 만든 두 장치를 친구가 쓴다면 무엇이 가장 불편하거나 부정확할까요? 를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch08-2',
        title: '정확도 개선과 프로젝트 발표',
        minutes: 50,
        goals: [
          '준비된 개선 함수 <code>calibrate_stride()</code> · <code>heading_offset()</code> · <code>keep_straight()</code> 가 각각 어떤 오차를 줄이는지 말하고 골라 쓸 수 있다',
          '랜드마크에서 로고를 만져 위치를 바로잡는 방법과, 지도 맞춤(map matching)의 생각을 그림으로 설명할 수 있다',
          '같은 경로를 다시 기록해 개선 전후의 끝점 오차 · 벽 통과 걸음을 비교할 수 있다',
          '두 프로젝트의 단계별 개발 과정과 겪은 문제를 돌아보고, 문제 → 과정 → 결과 → 한계 → 다음 단계 순서로 3분 발표를 준비할 수 있다'
        ],
        flow: [['생각하기 나누기', 4], ['개선 함수 세 가지', 11], ['랜드마크 · 지도 맞춤', 7], ['개선 적용 · 전후 비교', 12], ['두 프로젝트 돌아보기', 5], ['발표 준비', 9], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>내가 만든 두 장치(러닝 데이터 측정기 · 실내 경로 추적기)를 친구가 쓴다면, 무엇이 가장 불편하거나 부정확할까요?</b> 친구는 나보다 키가 크거나 작고, 걷는 빠르기도 다릅니다. 장치를 처음 본 친구가 “이상해!”라고 말할 만한 곳을 두 가지 적어 오세요.' },
          { type: 'p', html: '많이 나오는 답은 이렇습니다. “보폭이 내 것으로 들어 있어서 친구 거리는 틀린다.” “A 를 누를 때 어느 쪽을 봐야 하는지 모른다.” “걸을 때 몸이 흔들려서 길이 꼬불꼬불하다.” “오래 걸으면 점점 틀어진다.” 이 네 가지는 모두 오늘 고칠 수 있습니다. 앞의 세 가지는 <b>준비된 개선 함수</b>로, 마지막 하나는 <b>랜드마크</b>로 줄입니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 고치기와 발표하기', html: '오늘은 두 프로젝트의 마지막 단계입니다. 고칠 때는 <b>한 번에 하나씩</b> 바꾸고 다시 재야 무엇이 효과가 있었는지 알 수 있습니다. 그리고 수업 끝에는 지금까지 만든 것을 3분 동안 발표합니다.' },

          { type: 'h', text: '준비된 개선 함수 세 가지' },
          { type: 'p', html: '1교시 분석표에서 찾은 원인마다 맞는 처방이 있습니다. 계산이 어려운 부분은 함수로 준비해 두었으니, <b>어떤 원인에 어떤 함수를 쓰는지</b>만 알면 됩니다.' },
          { type: 'figure', html: FIG_FIX3, caption: '그림 8-4. 준비된 개선 함수 세 가지 — 보폭 · 출발 방향 · 직진 흔들림' },
          {
            type: 'table', caption: '표 8-4. 개선 함수 고르기',
            head: ['함수', '줄이는 오차', '언제 쓰나', '쓰는 법'],
            rows: [
              ['<code>calibrate_stride(real_cm, steps)</code>', '보폭 오차', '경로 크기가 크거나 작을 때 · 다른 사람이 쓸 때', '아는 거리를 걷고 센 걸음 수를 넣음'],
              ['<code>heading_offset()</code>', '출발 방향 오차', '경로가 통째로 돌아갈 때', '도면 위쪽을 보고 A — 1초 동안 읽어 기억'],
              ['<code>keep_straight(new_h, last_h)</code>', '직진할 때 흔들림', '곧은 길이 꼬불꼬불할 때', '걸음마다 방향을 이 함수에 한 번 통과']
            ]
          },

          { type: 'h', text: '① 보폭 보정 — calibrate_stride()' },
          { type: 'p', html: '보폭은 사람마다, 걷는 빠르기마다 다릅니다. 가장 확실한 방법은 <b>길이를 아는 길</b>을 평소처럼 걸으며 걸음을 세는 것입니다. 줄자로 5.8m 를 재어 두고 걸었더니 10걸음이었다면, 보폭은 580 ÷ 10 = 58cm 입니다. ch05 에서 보폭을 잰 방법과 같은데, 이번에는 <b>기록기에 넣는 값</b>을 고치는 것이 목적입니다.' },
          {
            type: 'code', title: '예제 8-10. 보폭 다시 정하기', repl: true, code: `def calibrate_stride(real_cm, counted_steps):
    return round(real_cm / counted_steps)

calibrate_stride(580, 10)
calibrate_stride(1000, 17)
round(67 / 58, 2)`,
            desc: '5.8m 에 10걸음이면 58cm, 10m 에 17걸음이면 59cm 입니다. 마지막 줄은 1교시의 길이 비율(1.17)과 거의 같습니다 — 보폭 67cm 를 58cm 로 고치면 길이 오차가 거의 사라진다는 뜻입니다. 셸에서는 <code>def</code> 다음에 빈 줄을 한 번 더 입력합니다.',
            expect: '>>> def calibrate_stride(real_cm, counted_steps):\n...     return round(real_cm / counted_steps)\n...\n>>> calibrate_stride(580, 10)\n58\n>>> calibrate_stride(1000, 17)\n59\n>>> round(67 / 58, 2)\n1.16'
          },
          { type: 'callout', kind: 'tip', title: '보폭을 잘 재는 요령', html: '① 10걸음보다 길게 걷습니다 — 짧으면 한 걸음 차이가 크게 틀립니다. ② 재는 것을 의식하지 말고 <b>평소처럼</b> 걷습니다. ③ 세 번 재서 가운데 값이나 평균을 씁니다. ④ 걷기 보폭과 뛰기 보폭은 따로 잽니다(ch05).' },

          { type: 'h', text: '② 방향 오프셋 보정 — heading_offset()' },
          { type: 'p', html: 'ch07 에서는 A 를 누르는 순간의 나침반 값 하나를 “도면 위쪽”으로 기억했습니다. 그런데 그 순간 몸이 살짝 돌아가 있었거나 나침반 값이 튀었다면, 경로 전체가 그만큼 돌아갑니다. 1교시의 −12° 가 바로 그것입니다. <code>heading_offset()</code> 은 도면 위쪽을 보고 서 있는 동안 <b>1초 동안 10번 읽어 평균</b>을 냅니다. 이 평균을 <b>오프셋(offset)</b>이라 하고, 걸을 때마다 나침반 값에서 빼서 도면 방위로 바꿉니다.' },
          { type: 'p', html: '그런데 방위각은 그냥 평균을 내면 큰일 납니다. 북쪽 근처에서는 358° 와 2° 가 섞여 나오는데, 둘의 그냥 평균은 180°, 정반대 남쪽입니다! 그래서 준비된 함수는 각도를 화살표처럼 더해서 평균 방향을 구하는 <b>원 평균</b>을 씁니다. 차이를 직접 확인해 봅니다.' },
          {
            type: 'code', title: '예제 8-11. 그냥 평균과 원 평균', code: `from microbit import *
import math

samples = [358, 2, 355, 5, 359, 1]     # 북쪽을 보고 읽은 방위각

print("그냥 평균:", sum(samples) / len(samples))

sx, sy = 0, 0
for h in samples:
    sx += math.sin(math.radians(h))
    sy += math.cos(math.radians(h))
print("원 평균:", round(math.degrees(math.atan2(sx, sy))) % 360)`,
            desc: '그냥 평균은 180° 로 완전히 틀렸고, 원 평균은 0° 로 맞습니다. 원 평균은 각도마다 길이 1 인 화살표를 그려 모두 이어 붙인 뒤, 그 끝이 가리키는 방향을 읽는 방법입니다. 이 계산은 <code>heading_offset()</code> 안에 숨어 있으니 쓰기만 하면 됩니다.',
            expect: '그냥 평균: 180.0\n원 평균: 0'
          },
          {
            type: 'code', title: '예제 8-12. 방향 오프셋 재고 도면 방위 보기', code: `from microbit import *
import math

` + PY_OFFSET + `
offset = 0
display.show("A")

while True:
    if button_a.was_pressed():        # 도면 위쪽을 보고 A
        display.show(Image.ARROW_N)
        offset = heading_offset()
        print("오프셋:", offset, "도 - 이제 이 방향이 도면 위쪽(0)")
        display.show(Image.YES)
    if button_b.was_pressed():        # 지금 도면 방위 보기
        h = (compass.heading() - offset) % 360
        print("나침반", compass.heading(), "-> 도면 방위", h)
        display.scroll(str(h))
    sleep(20)`,
            desc: 'A 를 누르면 1초쯤 화살표가 보이는 동안 가만히 서 있어야 합니다. 그 사이 10번 읽어 오프셋을 정합니다. 그 뒤 B 를 누르면 나침반 값에서 오프셋을 뺀 <b>도면 방위</b>가 나옵니다. 도면 위쪽을 보면 0 근처, 오른쪽(동쪽)을 보면 90 근처가 나와야 합니다.',
            hint: '<b>🧭 센서</b> 탭의 방위각 슬라이더를 30 으로 두고 <b>A</b>. 그다음 슬라이더를 120 으로 옮기고 <b>B</b> 를 누르면 도면 방위 90 이 나옵니다.',
            expect: '오프셋: 30 도 - 이제 이 방향이 도면 위쪽(0)\n나침반 120 -> 도면 방위 90',
            nondeterministic: true
          },

          { type: 'h', text: '③ 직진할 때 방향 흔들림 줄이기 — keep_straight()' },
          { type: 'p', html: '사람은 걸을 때 몸이 좌우로 흔들립니다. 그래서 곧게 걸어도 나침반 값은 262°, 275°, 268° … 처럼 출렁이고, 경로가 꼬불꼬불해집니다. <code>keep_straight()</code> 는 <b>“조금 바뀐 것은 흔들림, 많이 바뀐 것만 진짜 회전”</b>이라고 정합니다. 이전 방향과의 차이가 20° 보다 작으면 이전 방향을 그대로 쓰고, 20° 이상이면 새 방향을 받아들입니다.' },
          {
            type: 'code', title: '예제 8-13. 흔들리는 방향을 곧게 펴기', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_STRAIGHT + `
# 서쪽(270)으로 10걸음, 남쪽(180)으로 3걸음 - 걸을 때 읽은 도면 방위
HEADINGS = [262, 275, 268, 259, 281, 266, 273, 258, 277, 270, 185, 178, 172]
STRIDE = 60

for use in [False, True]:
    x, y, last_h = 0, 0, 270
    ys = []
    for h in HEADINGS:
        if use:
            h = keep_straight(h, last_h)
        last_h = h
        x, y = move(x, y, h, STRIDE)
        ys.append(round(y))
    print("keep_straight" if use else "그대로      ", "· 서쪽 구간 y:", ys[:10])
    print("   끝점:", (round(x), round(y)), "· 목표 (-600, -180)")`,
            desc: '그대로 쓰면 서쪽으로 걷는 동안 y 가 −3 ~ −19 사이를 오르내립니다(꼬불꼬불). <code>keep_straight</code> 를 쓰면 서쪽 구간의 y 가 0 으로 곧게 유지되고, 남쪽으로 꺾을 때(270 → 185, 85° 차이)는 회전을 제대로 받아들입니다. 다만 꺾은 뒤에는 처음 읽은 185 를 계속 써서 x 가 조금 더 밀렸습니다. 끝점은 둘 다 목표에서 15cm 쯤 떨어져 비슷하지만, <b>경로의 모양</b>이 훨씬 깔끔해집니다.',
            expect: '그대로       · 서쪽 구간 y: [-8, -3, -5, -17, -5, -9, -6, -19, -11, -11]\n   끝점: (-590, -191) · 목표 (-600, -180)\nkeep_straight · 서쪽 구간 y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]\n   끝점: (-616, -179) · 목표 (-600, -180)'
          },
          { type: 'callout', kind: 'warn', title: 'limit 를 너무 크게 하면', html: '<code>limit</code> 를 60° 로 크게 하면 흔들림은 거의 없어지지만, 45° 쯤 비스듬히 도는 <b>진짜 회전</b>까지 무시해 버립니다. 너무 작게(5°) 하면 효과가 없습니다. 우리 강좌의 공간처럼 90° 로 꺾는 길이 많다면 <b>20~30°</b> 가 알맞습니다. 또 꺾을 때 처음 읽은 값(185)을 그대로 쓰므로 회전 직후 방향은 조금 틀릴 수 있습니다.' },

          { type: 'h', text: '기준점 다시 맞추기 — 랜드마크' },
          { type: 'p', html: '아무리 잘 보정해도 걸음으로 위치를 계산하면 오차가 <b>조금씩 쌓입니다</b>. 오래 걸을수록 점점 더 빗나가지요. 이럴 때 쓰는 방법이 <b>랜드마크(landmark)</b>입니다. 문 앞, 칠판 앞처럼 <b>위치를 미리 아는 곳</b>에 도착하면 로고를 만져 “나는 지금 여기!”라고 알려 줍니다. 그러면 그때까지 쌓인 오차가 한 번에 사라집니다.' },
          { type: 'figure', html: FIG_LANDMARK, caption: '그림 8-5. 칠판 앞에서 로고를 만져 쌓인 오차를 지우기' },
          { type: 'p', html: '준비된 함수 <code>nearest_landmark()</code> 는 지금 계산한 위치에서 <b>가장 가까운 랜드마크</b>를 찾아 줍니다. 1교시의 개선 전 기록에서, 12걸음째(실제로 칠판 앞에 서 있던 때)에 로고를 만졌다고 해 봅니다. 그 뒤의 걸음들은 바로잡은 만큼 같이 옮겨집니다.' },
          {
            type: 'code', title: '예제 8-14. 칠판 앞에서 위치 바로잡기', code: `from microbit import *
import math

` + PY_ERR + `
` + PY_LANDMARK + `
PLAN_END = (-700, 200)
` + pyPts('EST', EST) + `
TOUCH = 12                    # 12걸음째에 칠판 앞에서 로고 터치

x, y = EST[TOUCH - 1]
name, lx, ly = nearest_landmark(x, y)
dx, dy = lx - x, ly - y       # 바로잡는 만큼
print(TOUCH, "걸음째", (x, y), "->", name, (lx, ly))
print("바로잡은 양:", (dx, dy))

fixed = EST[:TOUCH - 1] + [(px + dx, py + dy) for px, py in EST[TOUCH - 1:]]
print("끝점 오차 (그대로):", end_error(PLAN_END, EST[-1]), "cm")
print("끝점 오차 (랜드마크):", end_error(PLAN_END, fixed[-1]), "cm")`,
            desc: '12걸음째 계산 위치 (−412, 395) 에서 가장 가까운 랜드마크는 칠판 앞 (−300, 400) 입니다. x 를 112cm 바로잡았더니 끝점 오차가 206cm 에서 141cm 로 줄었습니다. 다만 보폭과 방향 오차는 그대로라 칠판 앞 이후에도 다시 쌓입니다. 그래서 랜드마크는 보정 함수와 <b>함께</b> 쓸 때 가장 좋습니다.',
            expect: '12 걸음째 (-412, 395) -> 칠판 앞 (-300, 400)\n바로잡은 양: (112, 5)\n끝점 오차 (그대로): 206 cm\n끝점 오차 (랜드마크): 141 cm'
          },
          { type: 'callout', kind: 'tip', title: '좋은 랜드마크 고르기', html: '① 다른 곳과 헷갈리지 않는 곳(문, 방 모서리, 기둥 옆). ② 자주 지나가는 곳. ③ 도면에서 위치를 정확히 아는 곳. 랜드마크가 너무 가까이 붙어 있으면 <code>nearest_landmark()</code> 가 엉뚱한 곳을 고를 수 있으니 적어도 2~3m 떨어뜨립니다.' },

          { type: 'h', text: '벽을 통과하지 않게 — 지도 맞춤(map matching)' },
          { type: 'p', html: '랜드마크는 사람이 로고를 만져 줘야 합니다. 이걸 <b>지도가 스스로</b> 하게 할 수는 없을까요? 그 생각이 <b>지도 맞춤(map matching)</b>입니다. 계산한 경로가 벽을 뚫으면 “그럴 리 없다”고 보고, 지도 위에서 <b>실제로 갈 수 있는 길 가운데 가장 비슷한 길</b>로 옮겨 놓는 것입니다.' },
          { type: 'figure', html: FIG_MATCH, caption: '그림 8-6. 지도 맞춤 — 벽을 뚫은 경로를 문으로 지나는 길로 바꾸기 (개념 그림)' },
          {
            type: 'list', items: [
              '<b>규칙 1.</b> 벽 · 기둥은 지나갈 수 없다.',
              '<b>규칙 2.</b> 다른 방으로는 문으로만 간다.',
              '<b>규칙 3.</b> 규칙을 어긴 경로는 규칙을 지키는 경로 가운데 <b>가장 가까운 것</b>으로 바꾼다.',
              'ch07 의 <code>try_move()</code>(벽이면 제자리)는 규칙 1 만 지키는 <b>가장 간단한 지도 맞춤</b>이었습니다.'
            ]
          },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 내비게이션도 같은 방법', html: '자동차 내비게이션은 위치가 조금 틀려도 차를 <b>도로 위</b>에 그려 줍니다. 차는 건물 안이나 강 위를 달릴 수 없으니, 가장 가까운 도로로 옮겨 그리는 것입니다. 이것이 지도 맞춤입니다. 실내 지도 앱도 벽과 문 정보를 써서 같은 일을 합니다. 실제로는 여러 경로 후보를 비교하는 어려운 계산이 필요해서, 이 강좌에서는 그림으로만 소개합니다.' },

          { type: 'h', text: '개선 전후 비교' },
          { type: 'p', html: '개선했다면 반드시 <b>같은 경로를 다시 기록</b>해서 정말 나아졌는지 확인합니다. 아래 예제는 보폭을 58cm 로 고치고, <code>heading_offset()</code> 과 <code>keep_straight()</code> 를 넣은 기록기로 같은 경로를 다시 걸은 기록(AFTER)을 개선 전 기록(EST)과 비교합니다.' },
          {
            type: 'code', title: '예제 8-15. 개선 전후 숫자로 비교하기', code: `from microbit import *
import math

` + PY_ROOM + `
` + PY_MAP_KIT + `
` + PY_DRAW + `
` + PY_WALLS + `
` + PY_ERR + `
SC, SR = find("S")
PLAN_END = (-700, 200)
` + pyPts('EST', EST) + `
` + pyPts('AFTER', AFTER) + `
before = end_error(PLAN_END, EST[-1])
after = end_error(PLAN_END, AFTER[-1])
print("끝점 오차:", before, "cm ->", after, "cm")
print("줄어든 정도:", round((before - after) * 100 / before), "%")
print("벽 통과 걸음:", len(wall_steps(EST)), "->", len(wall_steps(AFTER)))
print("개선 후 지도:")
draw_path(AFTER)`,
            desc: '끝점 오차가 206cm 에서 29cm 로, 86% 줄었습니다. 벽 통과 걸음도 4 에서 0 이 되었습니다. 29cm 는 50cm 보다 작으니 지도 위에서는 <b>창가 칸에 정확히</b> 도착한 것으로 보입니다.',
            expect: '끝점 오차: 206 cm -> 29 cm\n줄어든 정도: 86 %\n벽 통과 걸음: 4 -> 0\n개선 후 지도:\n# # # # # # # # # #\n# . * * * * * * * #\n# W * . . . . . * #\n# E * . P . . . * #\n# W . . . . . . * #\n# . . . . . . . S D\n# # # # # # # # # #'
          },
          { type: 'figure', html: FIG_BA, caption: '그림 8-7. 웹 지도에서 본 개선 전 · 후 — 같은 경로, 같은 사람' },
          { type: 'p', html: '이제 지금까지의 개선을 모두 넣은 <b>개선된 경로 기록기</b>입니다. ch07 의 경로 기록기와 비교하면 ① 보폭을 <code>calibrate_stride()</code> 로 정하고, ② A 를 누르면 <code>heading_offset()</code> 으로 출발 방향을 재고, ③ 걸음마다 방향을 <code>keep_straight()</code> 에 통과시키고, ④ 로고를 만지면 가장 가까운 랜드마크로 위치를 바로잡습니다. 바로잡은 줄은 <code>fix</code> 칸에 1 로 표시해 웹 지도에서 구분합니다.' },
          {
            type: 'code', title: '예제 8-16. 개선된 경로 기록기', code: `from microbit import *
import math
import log

` + PY_STEP_KIT + `
` + PY_MOVE + `
` + PY_CALIB + `
` + PY_OFFSET + `
` + PY_STRAIGHT + `
` + PY_LANDMARK + `
STRIDE = calibrate_stride(580, 10)   # ① 5.8m 를 10걸음 -> 내 보폭
log.set_labels("time", "steps", "heading", "x", "y", "fix", timestamp=None)

recording = False
x, y, steps = 0, 0, 0
start_t, offset, last_h = 0, 0, 0
display.show("A")

while True:
    if button_a.was_pressed():               # 도면 위쪽을 보고 출발
        display.show(Image.ARROW_N)
        offset = heading_offset()            # ② 출발 방향 재기
        x, y, steps, last_h = 0, 0, 0, 0
        start_t = running_time()
        recording = True
        display.clear()
        print("기록 시작 · 오프셋", offset, "· 보폭", STRIDE)
    if button_b.was_pressed() and recording: # 도착
        recording = False
        display.show(Image.YES)
        print("기록 끝:", steps, "걸음")
    if recording and is_step(smooth(strength())):
        h = (compass.heading() - offset) % 360
        h = keep_straight(h, last_h)         # ③ 직진 흔들림 줄이기
        last_h = h
        x, y = move(x, y, h, STRIDE)
        steps += 1
        t = (running_time() - start_t) // 100 / 10
        log.add(time=t, steps=steps, heading=h, x=round(x), y=round(y), fix=0)
        display.show(steps % 10)
    if recording and pin_logo.is_touched():  # ④ 랜드마크에서 바로잡기
        name, lx, ly = nearest_landmark(x, y)
        print(name, "에서 바로잡기:", (round(x), round(y)), "->", (lx, ly))
        x, y = lx, ly
        t = (running_time() - start_t) // 100 / 10
        log.add(time=t, steps=steps, heading=last_h, x=x, y=y, fix=1)
        display.show(Image.TARGET)
        sleep(500)
    sleep(20)`,
            desc: '위쪽은 모두 준비된 함수이고, 반복문은 ch07 의 기록기와 거의 같습니다. 바뀐 곳에 ① ~ ④ 번호를 달아 두었습니다. 걸을 때 LED 에는 걸음 수의 마지막 자리가 보입니다. 자기 보폭이 다르면 <code>calibrate_stride(580, 10)</code> 의 두 숫자를 내가 잰 값으로 바꿉니다.',
            hint: '가상의 사람을 시작점에서 <b>도면 위쪽(칠판 쪽)</b>을 보게 하고 <b>A</b> — 화살표가 보이는 1초 동안은 움직이지 않습니다. 조이스틱으로 오늘의 경로를 걷고, 칠판 앞과 창가에서 <b>로고</b>를 만진 뒤 <b>B</b>. 📊 로그 탭에서 <code>fix</code> 가 1 인 줄을 찾아봅니다.',
            expect: '기록 시작 · 오프셋 0 · 보폭 58\n…\n칠판 앞 에서 바로잡기: (-284, 410) -> (-300, 400)\n…\n창가 에서 바로잡기: (-689, 173) -> (-700, 200)\n기록 끝: 23 걸음',
            nondeterministic: true
          },
          {
            type: 'table', caption: '표 8-5. 난이도별 개선 도전',
            head: ['난이도', '할 일', '예'],
            rows: [
              ['★ 함수 하나 적용', '분석표의 1순위 원인에 맞는 함수 하나를 기록기에 넣고 다시 기록', '보폭 오차가 컸다면 <code>calibrate_stride()</code> 로 내 보폭 넣기'],
              ['★★ 두 가지 조합', '함수 두 개 또는 함수 + 랜드마크를 함께 쓰고, 하나씩 넣었을 때와 비교', '<code>heading_offset()</code> + 칠판 앞 랜드마크'],
              ['★★★ 나만의 아이디어', '분석표를 보고 새 개선 방법을 생각해 구현', '문 칸을 지나면 자동으로 문 위치로 바로잡기 · 뛸 때는 보폭을 다르게 · 벽에 막히면 벽을 따라 미끄러지기']
            ]
          },
          { type: 'callout', kind: 'warn', title: '한 번에 하나씩 바꾸기', html: '세 함수를 한꺼번에 넣고 오차가 줄었다면, <b>어느 것이 효과가 있었는지</b> 알 수 없습니다. 하나 넣고 기록 → 비교, 또 하나 넣고 기록 → 비교 순서로 해야 발표에서 “보폭 보정으로 오차가 ○○cm 줄었다”라고 말할 수 있습니다. 비교할 때는 <b>같은 경로 · 같은 사람 · 같은 출발 방향</b>을 지킵니다.' },

          { type: 'h', text: '두 프로젝트 돌아보기' },
          { type: 'p', html: '여덟 챕터 동안 두 장치를 만들었습니다. 발표 전에 어떤 단계를 거쳐 왔는지 표로 돌아봅니다. 두 프로젝트는 <b>같은 걸음 세기 위에</b> 서로 다른 것을 쌓아 올렸다는 점을 눈여겨봅니다.' },
          {
            type: 'table', caption: '표 8-6. 두 프로젝트의 단계별 개발 과정',
            head: ['단계', '러닝 데이터 측정기', '실내 경로 추적기'],
            rows: [
              ['센서 읽기', '가속도로 흔들림 세기 (ch02)', '가속도 + 지자기 방위각 (ch02 · ch06)'],
              ['핵심 계산', '걸음 수 · 케이던스 (ch03 · ch04)', '걸음 + 방향 → 위치 x · y (ch06)'],
              ['쓸모 더하기', '메트로놈 비트음 (ch04) · 보폭 → 거리 · 속도 (ch05)', '가상 공간 · 벽 검사 (ch07)'],
              ['저장', '1초마다 log (ch05)', '걸음마다 log · path.csv (ch07)'],
              ['보여 주기', '웹 그래프 · 요약 카드 (ch05)', '웹 지도 · 경로 재생 (ch08)'],
              ['고치기', '기준선 · 보폭 다시 재기', '보폭 · 방향 보정 · 랜드마크 (ch08)']
            ]
          },
          {
            type: 'table', caption: '표 8-7. 우리가 겪은 문제와 해결 (예시)',
            head: ['겪은 문제', '어디서', '어떻게 풀었나'],
            rows: [
              ['한 걸음을 두 번 셈', 'ch03 걸음 세기', '평균으로 다듬기 + 최소 간격 300ms'],
              ['메트로놈 소리가 안 들림', 'ch04 운동장', '빛 · 진동 같은 다른 신호도 생각'],
              ['걷기와 뛰기의 보폭이 다름', 'ch05 거리 계산', '보폭을 따로 재기'],
              ['보드를 기울이면 방향이 틀림', 'ch06 방위각', '수평으로 붙이기 · tilt_heading()'],
              ['출발 방향이 틀리면 경로가 돌아감', 'ch07 기록', 'heading_offset() 으로 여러 번 재기'],
              ['오래 걸으면 오차가 쌓임', 'ch08 비교', '랜드마크로 바로잡기']
            ]
          },

          { type: 'h', text: '3분 발표 준비하기' },
          { type: 'p', html: '발표는 <b>문제 → 만든 과정 → 결과 → 한계 → 다음 단계</b> 순서로 합니다. 3분은 짧습니다. 모든 것을 말하려 하지 말고, 가장 중요한 <b>그래프 한 장 · 지도 한 장</b>을 골라 그 이야기를 합니다.' },
          { type: 'figure', html: FIG_PRESENT, caption: '그림 8-8. 3분 발표의 순서와 시간 나누기' },
          {
            type: 'table', caption: '표 8-8. 발표 순서와 예시 문장',
            head: ['순서', '시간', '넣을 것', '예시 문장'],
            rows: [
              ['문제', '30초', '왜 만들었나 · 누가 쓰나', '“학교 건물 안에서는 GPS 가 안 돼서, 걸음과 방향만으로 위치를 찾고 싶었습니다.”'],
              ['만든 과정', '60초', '단계 2~3개 · 겪은 문제 하나', '“걸음 세기 → 위치 계산 → 지도 저장 순서로 만들었고, 출발 방향 때문에 경로가 돌아가는 문제가 있었습니다.”'],
              ['결과', '45초', '웹 그래프 · 지도 한 장 · 숫자', '“보폭 보정 후 끝점 오차가 206cm 에서 29cm 로 줄었습니다.”'],
              ['한계', '25초', '아직 안 되는 것', '“철제 사물함 옆에서는 아직도 방향이 휩니다.”'],
              ['다음 단계', '20초', '더 해 볼 아이디어', '“문을 지날 때 자동으로 위치를 바로잡는 기능을 넣고 싶습니다.”']
            ]
          },
          { type: 'p', html: '발표 화면에 띄울 <b>결과 카드</b>를 만들어 둡니다. 예제 8-15 에서 구한 숫자를 넣으면 콘솔에 발표용 요약이 나옵니다. 내 기록의 숫자로 바꿔 씁니다.' },
          {
            type: 'code', title: '더 해 보기 8-17. 발표용 결과 카드 출력하기', code: `from microbit import *

NAME = "실내 경로 추적기"
ROUTE_LEN = 1300                          # 계획 경로 길이 (cm)
FIXES = ["calibrate_stride", "heading_offset", "keep_straight"]
BEFORE = {"error": 206, "walls": 4}
AFTER = {"error": 29, "walls": 0}

better = round((BEFORE["error"] - AFTER["error"]) * 100 / BEFORE["error"])
print("===== 발표용 결과 카드 =====")
print("프로젝트:", NAME)
print("적용한 개선:", ", ".join(FIXES))
print("끝점 오차:", BEFORE["error"], "cm ->", AFTER["error"], "cm (", better, "% 줄어듦 )")
print("벽 통과 걸음:", BEFORE["walls"], "->", AFTER["walls"])
print("걸은 길 대비 오차:", round(AFTER["error"] * 100 / ROUTE_LEN), "%")
display.scroll(str(better) + "%")`,
            desc: '숫자 몇 개만 바꾸면 내 모둠의 결과 카드가 됩니다. 러닝 데이터 측정기 발표라면 <code>NAME</code> 을 바꾸고, 끝점 오차 대신 “실제 거리와 계산 거리의 차이”, “평균 케이던스” 같은 숫자를 넣어 봅니다.',
            expect: '===== 발표용 결과 카드 =====\n프로젝트: 실내 경로 추적기\n적용한 개선: calibrate_stride, heading_offset, keep_straight\n끝점 오차: 206 cm -> 29 cm ( 86 % 줄어듦 )\n벽 통과 걸음: 4 -> 0\n걸은 길 대비 오차: 2 %\n(LED 에 86% 가 흘러갑니다)'
          },
          { type: 'callout', kind: 'tip', title: '발표를 잘하는 요령', html: '① 그래프 · 지도 한 장에는 <b>메시지 하나</b>만. ② 숫자에는 꼭 <b>단위</b>(cm, 걸음/분)를. ③ <b>한계를 솔직하게</b> 말하는 것은 약점이 아니라 실력입니다. ④ 친구 발표를 들을 때는 “좋았던 점 하나 + 궁금한 점 하나”를 적어 둡니다.' },

          { type: 'h', text: '마우스로 공간을 만들고 내 경로 표시하기' },
          { type: 'p', html: '지금까지는 글자 지도(<code>ROOM</code>)로 교실을 그렸습니다. 이번에는 <b>마우스로</b> 공간을 직접 그리고, 마이크로비트에 저장된 기록을 그 위에 겹쳐 봅니다. 화면 위쪽 막대의 <b>🗺 공간 · 경로</b> 메뉴(또는 아래 버튼)를 누르면 공간 설계 창이 열립니다. 발표에 쓸 <b>지도 한 장</b>을 여기에서 만들 수 있습니다.' },
          { type: 'figure', html: FIG_SPACE, caption: '그림 8-9. 공간 설계 창 — 공간 크기 · 구조물 · 시작점을 정하고 기록을 겹쳐 그리기' },
          { type: 'list', ordered: true, items: [
            '<b>공간 크기 정하기</b>: 오른쪽 <b>공간</b> 칸에 가로 · 세로(m)를 넣습니다. 우리 교실을 줄자로 재어 넣으면 됩니다. 격자 한 칸의 크기(0.5m · 1m · 2m · 5m)도 고를 수 있고, <b>격자에 맞추기</b>를 켜면 구조물이 격자 반 칸 단위로 딱딱 맞춰집니다.',
            '<b>구조물 만들기</b>: <b>사각형 · 원 · 삼각형</b> 도구를 고르고 공간 위에서 마우스를 <b>끌면</b> 그 크기로 생깁니다. 한 번 누르기만 하면 1m 크기로 생깁니다. 기둥 · 책상 · 사물함 · 화분처럼 <b>지나갈 수 없는 곳</b>을 만듭니다.',
            '<b>크기 · 위치 바꾸기</b>: <b>선택</b> 도구로 구조물을 누르면 오른쪽 <b>고른 것</b> 칸에 이름 · 가운데 위치 · 가로 · 세로(원은 반지름) · 회전이 나옵니다. 숫자를 넣어 정확히 맞추거나, 마우스로 끌어 옮깁니다. 지우려면 <kbd>Delete</kbd> 키나 <b>삭제</b> 버튼을 누릅니다.',
            '<b>시작점 정하기</b>: <b>시작점</b> 도구로 공간을 누르면 그 자리가 출발 위치 <b>S</b>, 곧 기록의 (0, 0) 이 됩니다. <b>출발 방향</b>은 A 를 누를 때 바라본 쪽입니다. 도면 위쪽을 보고 출발했다면 0° 그대로 둡니다.',
            '<b>경로 표시하기</b>: <b>📂 MY_DATA.HTM · CSV 열기</b>로 보드의 기록을 고르면, 기록에서 <code>x</code> · <code>y</code> 열을 찾아 S 에서부터 걸음마다 점을 찍고 선으로 잇습니다. 기록은 다섯 개까지 함께 겹쳐 볼 수 있습니다.'
          ] },
          { type: 'figure', html: FIG_PM_LAUNCH },
          {
            type: 'table', caption: '표 8-9. 공간 설계 창의 도구',
            head: ['도구', '마우스로 하는 일', '이럴 때 씁니다'],
            rows: [
              ['선택', '구조물 · S 를 눌러 고르고 끌어 옮기기', '크기 · 회전을 숫자로 고치기, 복제 · 삭제'],
              ['사각형', '끌어서 가로 × 세로 정하기', '기둥 · 책상 · 사물함 · 칸막이'],
              ['원', '끌어서 지름 정하기', '둥근 탁자 · 화분 · 원기둥'],
              ['삼각형', '끌어서 밑변 × 높이 정하기', '모서리 화단 · 비스듬한 구조물 (회전과 함께)'],
              ['시작점', '누른 곳이 출발 위치 S', 'A 를 누르고 출발한 자리 · 출발 방향'],
              ['💾 공간 저장 · 📂 공간 불러오기', '공간 도면을 파일(.json)로', '모둠끼리 같은 교실 도면을 나눠 쓰기']
            ]
          },
          { type: 'p', html: '<b>결과 읽기.</b> 창 아래 표에 기록마다 <b>점 수 · 걸은 길 · 끝점 위치 · S 에서 끝점까지 거리 · 통과 점</b>이 나옵니다. 벽 밖이나 구조물 안에 찍힌 점은 <b>빨간 X</b> 로 표시됩니다. 사람은 기둥을 뚫고 걸을 수 없으니, 빨간 X 가 있는 곳이 바로 계산이 틀어진 곳입니다. 예제 8-16 에서 랜드마크로 바로잡은 줄(<code>fix</code> 가 1)은 고리 모양으로 보입니다. <b>보여 줄 걸음</b> 막대를 움직이면 경로를 한 걸음씩 다시 볼 수 있습니다.' },
          { type: 'p', html: '<b>예시로 해 보기.</b> <b>예시 공간</b>(ch07 교실과 같은 8m × 5m 에 기둥 · 원탁 · 화단)을 열고 <b>예시: 개선 전 · 실제 보드 · 개선 후</b>를 차례로 불러옵니다. 개선 전 기록은 7 · 8 · 22 · 23 걸음이 벽 밖에 X 로 찍힙니다(예제 8-6 의 결과와 같습니다). 실제 보드 기록은 기둥 옆에서 휘다가 15걸음째 점이 <b>기둥 안</b>에 찍힙니다. 개선 후 기록에는 X 가 없습니다. 세 기록을 함께 켜서 한 지도에서 비교해 보세요.' },
          { type: 'callout', kind: 'more', title: '구조물 안인지 어떻게 알까?', html: '점이 구조물 안에 있는지는 <b>준비된 계산</b>이 판단합니다. 사각형은 “가로 · 세로 범위 안인가”, 원은 “가운데까지 거리가 반지름보다 짧은가”, 삼각형은 “그 높이에서 삼각형 폭 안인가”를 봅니다. 회전한 구조물은 점을 거꾸로 돌려 놓고 같은 방법으로 봅니다. 걸음 <b>점</b>만 검사하므로, 점과 점 사이 선이 구조물 모서리를 살짝 스치는 것은 잡지 못합니다.' },
          { type: 'callout', kind: 'board', title: '실제 보드 기록을 겹칠 때', html: '기록에 <code>x</code> · <code>y</code> 열(cm)이 있어야 합니다. 예제 7-15 · 8-16 의 경로 기록기가 이렇게 저장합니다. 보드를 USB 로 연결해 <b>MICROBIT</b> 드라이브의 <b>MY_DATA.HTM</b> 을 고르면 됩니다. 출발할 때 바라본 방향과 창의 <b>출발 방향</b>이 다르면 경로 전체가 돌아가 보입니다. 공간 도면은 이 브라우저에 자동으로 저장되지만, 다른 컴퓨터에서 쓰려면 <b>💾 공간 저장</b>으로 파일을 만들어 둡니다.' },
          { type: 'callout', kind: 'info', title: '강좌를 마치며', html: '여러분은 작은 보드 하나로 걸음을 세고, 리듬을 맞추고, 거리를 재고, 건물 안에서 길을 그렸습니다. 그리고 그 과정에서 <b>잴 것 정하기 → 만들기 → 데이터로 확인하기 → 원인 찾기 → 고치기</b>라는, 엔지니어가 일하는 방식을 그대로 해 보았습니다. 이 방식은 마이크로비트가 아닌 어떤 프로젝트에서도 똑같이 쓸 수 있습니다.' }
        ],
        slides: [
          { layout: 'title', title: '정확도 개선과 프로젝트 발표', subtitle: 'Chapter 08 · 경로 시각화와 정확도 높이기', badge: '2교시', notes: '<p>1교시 분석표를 꺼내게 합니다. “오늘은 범인을 잡아서 고치고, 마지막으로 발표합니다.”</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 친구가 쓴다면?', lead: '불편하거나 부정확한 곳', bullets: ['보폭이 내 것으로 들어 있음', 'A 를 누를 때 어느 쪽?', '걸을 때 길이 꼬불꼬불', '오래 걸으면 점점 틀어짐'], notes: '<p>💬 “친구가 내 장치를 쓰면 무엇이 이상할까요?” — 예상 답: 보폭, 출발 방향, 흔들림, 오차 누적.</p><p>각 답에 오늘 배울 처방을 미리 연결합니다: 보폭 → calibrate_stride, 방향 → heading_offset, 흔들림 → keep_straight, 누적 → 랜드마크.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '준비된 개선 함수 세 가지', html: FIG_FIX3, caption: '보폭 · 출발 방향 · 직진 흔들림', notes: '<p>세 함수가 각각 1교시 분석표의 어느 원인을 고치는지 짝지어 봅니다.</p><p>💬 “우리 모둠 1순위 원인에는 어떤 함수?”</p><p>함수 속 계산은 몰라도 된다고 안심시킵니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '① 보폭 보정', repl: true, code: `def calibrate_stride(real_cm, counted_steps):
    return round(real_cm / counted_steps)

calibrate_stride(580, 10)
calibrate_stride(1000, 17)`, points: ['아는 거리 ÷ 센 걸음 수', '10걸음보다 길게 · 평소처럼', '세 번 재서 가운데 값'], notes: '<p>예제 8-10 을 셸에서 함께 입력합니다.</p><p>💬 “67cm 로 넣었는데 실제 58cm 면 경로는 어떻게 될까요?” — 약 1.16배 커짐 → 1교시 비율 1.17 과 같음.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '② 방향 — 그냥 평균의 함정', code: `from microbit import *
import math

samples = [358, 2, 355, 5, 359, 1]
print("그냥 평균:", sum(samples) / len(samples))

sx, sy = 0, 0
for h in samples:
    sx += math.sin(math.radians(h))
    sy += math.cos(math.radians(h))
print("원 평균:", round(math.degrees(math.atan2(sx, sy))) % 360)`, points: ['358° 와 2° 의 평균 = 180°?!', '원 평균 = 화살표를 이어 붙인 방향', 'heading_offset() 안에 숨어 있음'], notes: '<p>실행 전에 💬 “북쪽 근처 값 여섯 개의 평균은?” 하고 물어 180 이 나오면 놀라게 합니다.</p><p>이어서 예제 8-12 로 방위각 슬라이더 30 → A, 120 → B 를 시연합니다(도면 방위 90).</p><p>시간: 4분</p>' },
          { layout: 'code', title: '③ 직진 흔들림 줄이기', code: `from microbit import *

def keep_straight(new_h, last_h, limit=20):
    diff = (new_h - last_h + 180) % 360 - 180
    if abs(diff) < limit:
        return last_h
    return new_h

last_h = 270
for h in [262, 275, 268, 259, 185, 178]:
    last_h = keep_straight(h, last_h)
    print(h, "->", last_h)`, points: ['20° 안쪽 변화 = 흔들림 → 무시', '20° 넘는 변화 = 진짜 회전', 'limit 이 크면 진짜 회전도 놓침'], notes: '<p>출력: 262→270, 275→270, 268→270, 259→270, 185→185, 178→185.</p><p>💬 “limit 를 90 으로 하면?” — 90° 회전도 놓칠 수 있음.</p><p>예제 8-13 으로 꼬불꼬불한 y 와 곧은 y 를 비교하게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '랜드마크로 바로잡기', html: FIG_LANDMARK, caption: '아는 곳에서 로고 → 쌓인 오차 0', notes: '<p>예제 8-14 결과: 칠판 앞에서 바로잡으니 끝점 오차 206 → 141cm.</p><p>💬 “왜 0 이 안 될까요?” — 보폭 · 방향 오차는 그대로라 그 뒤로 다시 쌓임 → 보정 함수와 함께.</p><p>💬 “우리 교실의 좋은 랜드마크는?” — 문, 모서리, 기둥 옆.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '지도 맞춤 (map matching)', html: FIG_MATCH, caption: '벽은 못 지나고 문으로만', notes: '<p>그림으로만 소개합니다. 코드는 쓰지 않습니다.</p><p>💬 “내비게이션에서 차가 강 위를 달리는 걸 본 적 있나요?” — 거의 없음 → 도로에 맞춰 그리기 때문.</p><p>ch07 의 try_move() 가 가장 간단한 지도 맞춤이었다는 것을 연결합니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '개선 전 · 후', html: FIG_BA, caption: '끝점 오차 206cm → 29cm · 벽 통과 4 → 0', notes: '<p>예제 8-15 를 실행해 숫자를 확인합니다(86% 줄어듦).</p><p>“같은 경로 · 같은 사람 · 같은 출발 방향”으로 비교해야 공정하다는 점을 강조합니다.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '개선 도전 — 난이도 고르기', head: ['난이도', '할 일'], rows: [['★', '1순위 원인에 함수 하나 → 다시 기록'], ['★★', '두 가지 조합 · 하나씩 넣어 비교'], ['★★★', '나만의 개선 아이디어 구현']], lead: '예제 8-16 개선된 경로 기록기에서 출발', notes: '<p>예제 8-16 을 기본으로 나눠 주고, 모둠이 난이도를 고르게 합니다.</p><p>★★★ 예: 문 칸을 지나면 자동 바로잡기, 뛸 때 보폭 바꾸기, 벽을 따라 미끄러지기.</p><p>한 번에 하나씩 바꾸고 기록 → 비교를 순회하며 확인합니다.</p><p>시간: 9분</p>' },
          { layout: 'table', title: '두 프로젝트 돌아보기', head: ['단계', '러닝 측정기', '경로 추적기'], rows: [['센서', '가속도', '가속도 + 방위각'], ['계산', '걸음 · 케이던스', '걸음 + 방향 → x · y'], ['쓸모', '메트로놈 · 거리 · 속도', '가상 공간 · 벽 검사'], ['보여 주기', '웹 그래프', '웹 지도 · 재생'], ['고치기', '기준선 · 보폭', '보정 함수 · 랜드마크']], notes: '<p>💬 “두 프로젝트의 공통 뿌리는?” — 걸음 세기(is_step).</p><p>💬 “가장 어려웠던 단계는?” 모둠별로 한 가지씩 말하게 하고, 그것을 발표의 “만든 과정”에 넣게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '3분 발표 순서', html: FIG_PRESENT, caption: '문제 → 과정 → 결과 → 한계 → 다음 단계', notes: '<p>표 8-8 의 예시 문장을 읽어 줍니다.</p><p>더 해 보기 8-17 로 결과 카드를 만들어 발표 화면에 띄우게 합니다.</p><p>💬 “한계를 말하면 점수가 깎일까요?” — 아니요, 한계를 아는 것이 실력.</p><p>남은 시간에 모둠별 발표 리허설, 시간이 되면 두세 모둠 발표.</p><p>시간: 7분</p>' },
          { layout: 'diagram', title: '마우스로 공간 만들고 경로 겹치기', html: FIG_SPACE, caption: '🗺 공간 · 경로 → 구조물 · 시작점 → 📂 MY_DATA.HTM', notes: '<p>위쪽 막대의 🗺 공간 · 경로 메뉴를 열고 시연합니다: 공간 크기 8 × 5 → 사각형 도구로 기둥 끌어 만들기 → 선택 도구로 크기 · 회전 숫자 고치기 → 시작점 도구로 S 놓기.</p><p>예시: 개선 전 · 실제 보드 · 개선 후를 차례로 불러와 겹칩니다.</p><p>💬 “빨간 X 는 무슨 뜻일까요?” — 사람이 갈 수 없는 곳(벽 밖 · 기둥 안)에 점이 찍힘 = 계산이 틀어진 곳.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '공간 설계 창의 도구', head: ['도구', '쓰임'], rows: [['선택', '고르기 · 끌어 옮기기 · 크기 숫자'], ['사각형 · 원 · 삼각형', '끌어서 구조물 만들기'], ['시작점', '출발 위치 S · 출발 방향'], ['📂 기록 열기', 'x · y 열 → S 에서부터 경로'], ['💾 공간 저장', '모둠끼리 도면 나눠 쓰기']], lead: '우리 교실을 재어서 그려 보기', notes: '<p>모둠별로 교실 가로 · 세로를 줄자로 재어 공간을 만들고, 기둥 · 책상을 구조물로 넣게 합니다.</p><p>자기 MY_DATA.HTM(없으면 시뮬레이터 기록)을 겹쳐 발표용 지도 한 장을 만듭니다.</p><p>💬 “경로가 통째로 돌아가 보이면?” — 출발 방향을 확인.</p><p>시간: 3분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['보폭 → <code>calibrate_stride()</code>', '출발 방향 → <code>heading_offset()</code> (원 평균)', '흔들림 → <code>keep_straight()</code>', '쌓인 오차 → 랜드마크 · 지도 맞춤', '한 번에 하나씩 바꾸고 다시 재기'], notes: '<p>강좌 전체를 마무리합니다: “잴 것 정하기 → 만들기 → 데이터로 확인 → 원인 찾기 → 고치기.”</p><p>발표를 다음 시간에 이어서 한다면 결과 카드와 지도 한 장을 준비해 오게 합니다.</p><p>시간: 2분</p>' }
        ]
      }
    ]
  });
})();
