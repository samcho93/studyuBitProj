/* Chapter 06. 걸음과 방향으로 위치 찾기 */
(function () {
  /* ───────── 공통 파이썬 조각 (준비된 함수) ───────── */
  const PY_MOVE = `def move(x, y, heading, stride):
    # 준비된 함수: heading 방향으로 stride 만큼 한 칸 밀기 -> 새 위치
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)
`;
  const PY_SHOW = `def show_pos(x, y):
    # 준비된 함수: 위치 (x, y) 를 5x5 LED 지도에 점 하나로
    col = OX + round(x / CELL)
    row = OY - round(y / CELL)
    col = min(4, max(0, col))
    row = min(4, max(0, row))
    display.clear()
    display.set_pixel(OX, OY, 2)      # 출발점은 흐리게
    display.set_pixel(col, row, 9)    # 지금 위치는 밝게
`;
  const PY_MAP_CENTER = `CELL = 100        # LED 한 칸 = 100cm
OX, OY = 2, 2     # 출발점 = 가운데 칸
`;
  const PY_TILT = `good_heading = 0

def tilt_heading():
    # 준비된 함수: 기울기를 살펴 보정한 방위 (0~359)
    # 많이 기울면 바로 전의 믿을 만한 방위를 그대로 씀
    global good_heading
    x, y, z = accelerometer.get_values()
    if abs(x) > TILT_LIMIT or abs(y) > TILT_LIMIT:
        return good_heading
    h = compass.heading()
    diff = (h - good_heading + 540) % 360 - 180
    good_heading = (good_heading + diff // 2) % 360
    return good_heading
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
  // 걸음 감지 준비물 한 묶음 (상수 + 준비된 함수 세 개)
  const PY_STEP_KIT = `THRESHOLD = 1150   # 기준선 (ch03 에서 정한 우리 모둠 값)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP;

  const PY_WALK = `def walk(heading, stride, steps):
    # 같은 방향으로 steps 걸음 걸은 뒤의 위치
    x, y = 0, 0
    for i in range(steps):
        x, y = move(x, y, heading, stride)
    return x, y
`;

  /* ───────── 그림 6-1. 바깥과 실내의 GPS ───────── */
  const FIG_GPS = (() => {
    const sat = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-10" width="28" height="20" rx="3" fill="var(--accent)"/><rect x="-44" y="-6" width="26" height="12" fill="var(--accent2)"/><rect x="18" y="-6" width="26" height="12" fill="var(--accent2)"/></g>`;
    const person = (x, y) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="-48" r="13" fill="var(--fg)"/><path d="M0 -34 L0 6 M0 -24 L-18 -6 M0 -24 L18 -6 M0 6 L-14 36 M0 6 L14 36" stroke="var(--fg)" stroke-width="6" stroke-linecap="round"/></g>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="40" y="40" font-size="24" font-weight="bold" fill="var(--ok)">바깥: 위성 신호가 잘 닿음</text>
  ${sat(110, 95)}${sat(320, 80)}${sat(520, 110)}
  <path d="M110 105 L300 300 M320 90 L300 300 M520 120 L300 300" stroke="var(--ok)" stroke-width="3" stroke-dasharray="8 6"/>
  ${person(300, 340)}
  <text x="360" y="330" font-size="20" fill="var(--fg)">위치 OK</text>
  <path d="M640 30 L640 380" stroke="var(--line)" stroke-width="2"/>
  <text x="680" y="40" font-size="24" font-weight="bold" fill="var(--danger)">실내: 지붕 · 벽에 막혀 약해짐</text>
  ${sat(760, 95)}${sat(980, 80)}${sat(1180, 110)}
  <path d="M760 105 L840 175 M980 90 L960 175 M1180 120 L1100 175" stroke="var(--danger)" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="900" y="165" font-size="28" font-weight="bold" fill="var(--danger)">✕</text>
  <path d="M760 180 L960 140 L1160 180 Z" fill="var(--muted)" opacity="0.5"/>
  <rect x="780" y="180" width="360" height="200" fill="none" stroke="var(--muted)" stroke-width="5"/>
  ${person(900, 340)}
  <rect x="960" y="230" width="160" height="90" rx="12" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1040" y="265" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--accent)">센서만으로</text>
  <text x="1040" y="298" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--accent)">추측하기</text>
</svg>`;
  })();

  /* ───────── 그림 6-2. 추측항법 — 한 걸음마다 방향 + 보폭 ───────── */
  const FIG_PDR = (() => {
    // 동쪽 3걸음 → 북동쪽 2걸음 → 북쪽 2걸음
    const pts = [[160, 320], [260, 320], [360, 320], [460, 320], [531, 249], [602, 178], [602, 98], [602, 28]];
    let arrows = '';
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      arrows += `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="var(--accent)" stroke-width="5" marker-end="url(#c6pa)"/>`;
    }
    const dots = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 12 : 7}" fill="${i === 0 ? 'var(--ok)' : 'var(--fg)'}"/>`).join('');
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)"/></marker></defs>
  ${arrows}${dots}
  <text x="160" y="365" text-anchor="middle" font-size="19" fill="var(--ok)">출발 (0, 0)</text>
  <text x="310" y="300" text-anchor="middle" font-size="18" fill="var(--muted)">동쪽 90° × 3걸음</text>
  <text x="590" y="270" font-size="18" fill="var(--muted)">북동 45° × 2</text>
  <text x="625" y="80" font-size="18" fill="var(--muted)">북쪽 0° × 2</text>
  <rect x="760" y="60" width="480" height="270" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1000" y="105" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--accent)">추측항법 (PDR)</text>
  <text x="790" y="155" font-size="21" fill="var(--fg)">① 걸음을 느끼면 (걸음 검출)</text>
  <text x="790" y="200" font-size="21" fill="var(--fg)">② 지금 방향을 읽고 (나침반)</text>
  <text x="790" y="245" font-size="21" fill="var(--fg)">③ 그쪽으로 보폭만큼 이동</text>
  <text x="790" y="300" font-size="19" fill="var(--muted)">→ 화살표를 이어 붙이면 위치!</text>
</svg>`;
  })();

  /* ───────── 그림 6-3. 좌표와 방향 ───────── */
  const FIG_GRID = (() => {
    let grid = '';
    for (let i = 0; i <= 6; i++) {
      grid += `<path d="M${100 + i * 50} 50 L${100 + i * 50} 350" stroke="var(--line)" stroke-width="1"/>`;
      grid += `<path d="M100 ${50 + i * 50} L400 ${50 + i * 50}" stroke="var(--line)" stroke-width="1"/>`;
    }
    const rose = [[0, '0° 북(N)', 0, -1], [90, '90° 동(E)', 1, 0], [180, '180° 남(S)', 0, 1], [270, '270° 서(W)', -1, 0]]
      .map(([, t, dx, dy]) => `<path d="M960 210 L${960 + dx * 110} ${210 + dy * 110}" stroke="var(--accent)" stroke-width="4" marker-end="url(#c6ga)"/>
  <text x="${960 + dx * 165}" y="${216 + dy * 140}" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">${t}</text>`).join('');
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6ga" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)"/></marker>
  <marker id="c6gb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  ${grid}
  <path d="M100 350 L420 350" stroke="var(--fg)" stroke-width="3" marker-end="url(#c6gb)"/>
  <path d="M100 350 L100 30" stroke="var(--fg)" stroke-width="3" marker-end="url(#c6gb)"/>
  <text x="430" y="358" font-size="22" font-weight="bold" fill="var(--fg)">x (동쪽 +)</text>
  <text x="70" y="25" font-size="22" font-weight="bold" fill="var(--fg)">y (북쪽 +)</text>
  <circle cx="100" cy="350" r="9" fill="var(--ok)"/>
  <text x="90" y="385" text-anchor="end" font-size="18" fill="var(--ok)">(0, 0)</text>
  <circle cx="250" cy="250" r="10" fill="var(--danger)"/>
  <text x="265" y="240" font-size="20" font-weight="bold" fill="var(--danger)">(3, 2)</text>
  <path d="M100 350 L250 350 L250 250" fill="none" stroke="var(--danger)" stroke-width="3" stroke-dasharray="6 5"/>
  <text x="175" y="340" text-anchor="middle" font-size="16" fill="var(--danger)">동 3칸</text>
  <text x="262" y="305" font-size="16" fill="var(--danger)">북 2칸</text>
  <text x="560" y="120" font-size="21" fill="var(--fg)">한 칸 = 1m (모눈 한 칸)</text>
  <text x="560" y="160" font-size="21" fill="var(--fg)">x : 오른쪽(동)으로 갈수록 +</text>
  <text x="560" y="200" font-size="21" fill="var(--fg)">y : 위쪽(북)으로 갈수록 +</text>
  <text x="560" y="250" font-size="19" fill="var(--muted)">서쪽 · 남쪽으로 가면 − (음수)</text>
  ${rose}
  <circle cx="960" cy="210" r="8" fill="var(--fg)"/>
  <text x="1110" y="380" text-anchor="middle" font-size="18" fill="var(--muted)">compass.heading() 과 같은 각도</text>
</svg>`;
  })();

  /* ───────── 그림 6-4. LED 5×5 를 작은 지도로 ───────── */
  const FIG_LEDMAP = (() => {
    let cells = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const on = (c === 3 && r === 1) ? '#ff2d1a' : (c === 2 && r === 2) ? '#a8321f' : '#4a1a16';
        cells += `<rect x="${360 + c * 64}" y="${48 + r * 64}" width="40" height="40" rx="6" fill="${on}"/>`;
      }
    }
    let colLbl = '', rowLbl = '';
    for (let i = 0; i < 5; i++) {
      colLbl += `<text x="${380 + i * 64}" y="385" text-anchor="middle" font-size="18" fill="var(--muted)">${i}</text>`;
      rowLbl += `<text x="330" y="${74 + i * 64}" text-anchor="middle" font-size="18" fill="var(--muted)">${i}</text>`;
    }
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="330" y="22" width="340" height="340" rx="16" fill="#0e6b64"/>
  ${cells}
  ${colLbl}${rowLbl}
  <text x="500" y="20" text-anchor="middle" font-size="16" fill="var(--muted)">↑ 북쪽 (보드 로고 쪽)</text>
  <text x="80" y="140" font-size="20" fill="var(--fg)">흐린 점 = 출발점</text>
  <text x="80" y="170" font-size="20" fill="var(--fg)">(LED 2, 2) · 위치 (0, 0)</text>
  <text x="80" y="250" font-size="20" fill="var(--danger)">밝은 점 = 지금 위치</text>
  <text x="80" y="280" font-size="20" fill="var(--danger)">(LED 3, 1) · 위치 (1m, 1m)</text>
  <rect x="740" y="60" width="500" height="280" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="990" y="100" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">위치 → LED 칸 바꾸기</text>
  <text x="770" y="150" font-size="20" fill="var(--fg)">LED 칸 번호 = 출발 칸 + 위치 ÷ 한 칸</text>
  <text x="770" y="195" font-size="20" font-family="monospace" fill="var(--fg)">col = 2 + x ÷ 100</text>
  <text x="770" y="235" font-size="20" font-family="monospace" fill="var(--fg)">row = 2 − y ÷ 100</text>
  <text x="770" y="285" font-size="18" fill="var(--muted)">LED 줄 번호는 아래로 커지므로 y 는 뺍니다</text>
  <text x="770" y="317" font-size="18" fill="var(--muted)">지도 밖으로 나가면 가장자리에 붙여 둠</text>
</svg>`;
  })();

  /* ───────── 그림 6-5. 보폭 오차와 방향 오차 ───────── */
  const FIG_ERR = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6ea" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--ok)"/></marker>
  <marker id="c6eb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker></defs>
  <text x="40" y="40" font-size="23" font-weight="bold" fill="var(--fg)">① 보폭을 크게 잡으면</text>
  <circle cx="80" cy="200" r="10" fill="var(--fg)"/>
  <path d="M80 180 L440 180" stroke="var(--ok)" stroke-width="5" marker-end="url(#c6ea)"/>
  <path d="M80 225 L540 225" stroke="var(--danger)" stroke-width="5" stroke-dasharray="10 6" marker-end="url(#c6eb)"/>
  <text x="440" y="160" text-anchor="middle" font-size="19" fill="var(--ok)">진짜 끝</text>
  <text x="545" y="260" text-anchor="middle" font-size="19" fill="var(--danger)">계산한 끝</text>
  <text x="80" y="320" font-size="20" fill="var(--fg)">같은 방향으로 <tspan font-weight="bold">더 멀리</tspan> 간 것처럼</text>
  <text x="80" y="352" font-size="18" fill="var(--muted)">걸을수록 앞뒤 차이가 커짐</text>
  <path d="M640 30 L640 380" stroke="var(--line)" stroke-width="2"/>
  <text x="680" y="40" font-size="23" font-weight="bold" fill="var(--fg)">② 방향이 조금 틀리면</text>
  <circle cx="720" cy="300" r="10" fill="var(--fg)"/>
  <path d="M720 300 L1160 300" stroke="var(--ok)" stroke-width="5" marker-end="url(#c6ea)"/>
  <path d="M720 300 L1150 200" stroke="var(--danger)" stroke-width="5" stroke-dasharray="10 6" marker-end="url(#c6eb)"/>
  <path d="M1170 300 L1160 205" stroke="var(--warn)" stroke-width="3"/>
  <text x="1180" y="260" font-size="19" font-weight="bold" fill="var(--warn)">옆으로</text>
  <text x="1180" y="285" font-size="19" font-weight="bold" fill="var(--warn)">벗어남</text>
  <path d="M820 300 A100 100 0 0 0 818 278" fill="none" stroke="var(--danger)" stroke-width="3"/>
  <text x="830" y="285" font-size="18" fill="var(--danger)">조금</text>
  <text x="680" y="352" font-size="20" fill="var(--fg)">작은 각도라도 <tspan font-weight="bold">멀리 갈수록</tspan> 크게 벌어짐</text>
</svg>`;

  /* ───────── 그림 6-6. 위치 추적 반복문 ───────── */
  const FIG_LOOP = (() => {
    const box = (x, y, w, t1, t2, c) => `<rect x="${x}" y="${y}" width="${w}" height="90" rx="14" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" font-size="20" font-weight="bold" font-family="monospace" fill="${c}">${t1}</text>
  <text x="${x + w / 2}" y="${y + 70}" text-anchor="middle" font-size="17" fill="var(--muted)">${t2}</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6la" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="40" y="40" font-size="23" font-weight="bold" fill="var(--fg)">while True: 안에서 20ms 마다 한 바퀴</text>
  ${box(40, 90, 260, 'is_step(...)', '① 걸음이 났나? (ch03)', 'var(--accent)')}
  ${box(360, 90, 260, 'compass.heading()', '② 지금 방향 (ch02)', 'var(--warn)')}
  ${box(680, 90, 260, 'move(x, y, h, STRIDE)', '③ 새 위치 계산', 'var(--ok)')}
  ${box(1000, 90, 240, 'show_pos · print', '④ 보여 주기', 'var(--accent2)')}
  <path d="M300 135 L352 135" stroke="var(--fg)" stroke-width="3" marker-end="url(#c6la)"/>
  <path d="M620 135 L672 135" stroke="var(--fg)" stroke-width="3" marker-end="url(#c6la)"/>
  <path d="M940 135 L992 135" stroke="var(--fg)" stroke-width="3" marker-end="url(#c6la)"/>
  <path d="M1120 180 L1120 260 L170 260 L170 188" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#c6la)"/>
  <text x="645" y="250" text-anchor="middle" font-size="18" fill="var(--muted)">다시 처음으로</text>
  <text x="200" y="320" font-size="19" fill="var(--fg)">걸음이 아니면 ②~④ 를 건너뜀 → 위치는 그대로</text>
  <text x="200" y="355" font-size="19" fill="var(--fg)">STRIDE = ch05 에서 잰 내 보폭 (cm)</text>
</svg>`;
  })();

  /* ───────── 그림 6-7. 보드 기울기와 방향 ───────── */
  const FIG_TILT = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6ta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="210" y="45" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--ok)">① 수평</text>
  <path d="M90 230 L330 230 L370 190 L130 190 Z" fill="#0e6b64"/>
  <path d="M60 270 L360 270" stroke="var(--line)" stroke-width="3"/>
  <text x="210" y="320" text-anchor="middle" font-size="20" fill="var(--fg)">방향을 잘 믿을 수 있음</text>
  <text x="210" y="350" text-anchor="middle" font-size="18" fill="var(--muted)">x, y 기울기 값이 작음</text>
  <text x="640" y="45" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--warn)">② 조금 기울어짐</text>
  <path d="M520 250 L740 190 L780 150 L560 210 Z" fill="#0e6b64"/>
  <path d="M490 270 L790 270" stroke="var(--line)" stroke-width="3"/>
  <text x="640" y="320" text-anchor="middle" font-size="20" fill="var(--fg)">방향이 조금씩 틀어짐</text>
  <text x="640" y="350" text-anchor="middle" font-size="18" fill="var(--muted)">걸을 때 출렁이면 자주 생김</text>
  <text x="1070" y="45" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--danger)">③ 크게 기울어짐</text>
  <path d="M1030 260 L1030 100 L1080 70 L1080 230 Z" fill="#0e6b64"/>
  <path d="M920 270 L1220 270" stroke="var(--line)" stroke-width="3"/>
  <text x="1150" y="160" font-size="34" font-weight="bold" fill="var(--danger)">?</text>
  <text x="1070" y="320" text-anchor="middle" font-size="20" fill="var(--fg)">방향을 믿기 어려움</text>
  <text x="1070" y="350" text-anchor="middle" font-size="18" fill="var(--muted)">tilt_heading() 은 이전 값 유지</text>
</svg>`;

  /* ───────── 그림 6-8. 사각형 걷기 — 진짜 길과 계산한 길 ───────── */
  const FIG_DRIFT = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c6da" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--ok)"/></marker>
  <marker id="c6db" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker></defs>
  <path d="M120 330 L620 330 L620 30 L120 30 L120 322" fill="none" stroke="var(--ok)" stroke-width="5" marker-end="url(#c6da)"/>
  <path d="M120 330 L620 330 L620 30 L150 70 L150 370" fill="none" stroke="var(--danger)" stroke-width="4" stroke-dasharray="10 7" marker-end="url(#c6db)"/>
  <circle cx="120" cy="330" r="11" fill="var(--fg)"/>
  <text x="105" y="365" text-anchor="end" font-size="19" fill="var(--fg)">출발 · 도착</text>
  <path d="M120 330 L150 370" stroke="var(--warn)" stroke-width="3"/>
  <text x="170" y="388" font-size="18" font-weight="bold" fill="var(--warn)">끝점 차이</text>
  <text x="370" y="320" text-anchor="middle" font-size="19" fill="var(--muted)">가로 5m (동쪽)</text>
  <text x="640" y="185" font-size="19" fill="var(--muted)">세로 3m (북쪽)</text>
  <text x="320" y="62" font-size="18" fill="var(--danger)">이 변에서 자석 때문에 방향이 틀어짐</text>
  <rect x="760" y="60" width="480" height="270" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <path d="M790 110 L860 110" stroke="var(--ok)" stroke-width="5"/>
  <text x="875" y="117" font-size="20" fill="var(--fg)">진짜로 걸은 길</text>
  <path d="M790 160 L860 160" stroke="var(--danger)" stroke-width="4" stroke-dasharray="10 7"/>
  <text x="875" y="167" font-size="20" fill="var(--fg)">보드가 계산한 길</text>
  <text x="790" y="225" font-size="20" fill="var(--fg)">한 번 틀어진 위치는</text>
  <text x="790" y="258" font-size="20" fill="var(--fg)">스스로 되돌아오지 않고</text>
  <text x="790" y="291" font-size="20" font-weight="bold" fill="var(--danger)">계속 쌓입니다</text>
</svg>`;

  /* ───────── 그림 6-9. 보드를 어디에 붙일까 ───────── */
  const FIG_WEAR = (() => {
    const body = (x) => `<circle cx="${x}" cy="70" r="30" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <path d="M${x} 100 L${x} 250 M${x} 130 L${x - 50} 200 M${x} 130 L${x + 50} 200 M${x} 250 L${x - 35} 360 M${x} 250 L${x + 35} 360" stroke="var(--fg)" stroke-width="6" stroke-linecap="round"/>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${body(180)}
  <rect x="200" y="226" width="80" height="16" rx="3" fill="#0e6b64"/>
  <rect x="190" y="242" width="12" height="16" fill="var(--muted)"/>
  <text x="300" y="215" font-size="22" font-weight="bold" fill="var(--accent)">허리</text>
  <text x="300" y="248" font-size="18" fill="var(--fg)">걸음 흔들림이 또렷함</text>
  <text x="300" y="276" font-size="18" fill="var(--fg)">엉덩이가 돌며 방향이 출렁임</text>
  ${body(720)}
  <rect x="740" y="150" width="80" height="16" rx="3" fill="#0e6b64"/>
  <text x="840" y="140" font-size="22" font-weight="bold" fill="var(--accent)">가슴</text>
  <text x="840" y="173" font-size="18" fill="var(--fg)">몸통이 보는 방향과 같음</text>
  <text x="840" y="201" font-size="18" fill="var(--fg)">걸음 흔들림은 조금 약함</text>
  <rect x="840" y="250" width="400" height="110" rx="12" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="1040" y="290" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--warn)">둘 다: 받침으로 보드를 수평으로</text>
  <text x="1040" y="325" text-anchor="middle" font-size="18" fill="var(--fg)">화면은 위로 · 로고는 앞으로</text>
</svg>`;
  })();

  const FIG_ROUTE_TILES = `<div style="text-align:center">${MB_FIG.tile('0000000000002000000000000', '출발 (0, 0)')}${MB_FIG.tile('0000000000002900000000000', '동쪽 1걸음 (100, 0)')}${MB_FIG.tile('0000000009002000000000000', '북동쪽 1걸음 더')}${MB_FIG.tile('0000000000002000000000009', '지도 밖 → 가장자리')}</div>`;

  MB_COURSE.addChapter({
    id: 'ch06', no: '06',
    title: '걸음과 방향으로 위치 찾기',
    subtitle: '추측항법(PDR) · 좌표 (x, y) · 방위각 · move() · show_pos() · tilt_heading() · 오차 쌓임',
    summary: '이번 챕터부터 두 번째 프로젝트 <b>실내 이동 경로 추적</b>을 시작합니다. GPS 신호가 약한 실내에서 <b>걸음 수 + 방향 + 보폭</b>만으로 위치를 짐작하는 <b>추측항법(PDR)</b>의 원리를 익히고, 준비된 함수 <code>move()</code> 로 새 위치를 계산해 LED 5×5 지도에 점으로 보여 줍니다. 2교시에는 걸음 검출 · 나침반 · 위치 계산을 하나의 반복문으로 조립해 가상의 사람을 걷게 하고, 기울기 · 자석 · 옆걸음처럼 위치가 틀어지는 원인과 <b>오차가 쌓이는 모습</b>을 미리 토론합니다.',
    goals: [
      '실내에서 GPS 대신 <b>추측항법(PDR)</b>이 필요한 까닭을 말하고, “걸음 · 방향 · 보폭” 세 재료를 설명할 수 있다',
      '좌표 (x, y) 와 방위각의 관계(동쪽 = x 증가, 북쪽 = y 증가)를 모눈종이 위에서 나타낼 수 있다',
      '준비된 함수 <code>move()</code> 와 <code>show_pos()</code> 로 새 위치를 계산하고 LED 지도에 표시할 수 있다',
      '<code>is_step()</code> · <code>compass.heading()</code> · <code>move()</code> 를 하나의 반복문으로 조립해 <b>위치 추적기</b>를 만들 수 있다',
      '기울기를 살피는 <code>tilt_heading()</code> 을 쓰고, 방향 · 보폭 오차가 걸을수록 쌓이는 모습을 표로 설명할 수 있다',
      '옆걸음 · 제자리 회전 · 자석 간섭 같은 문제와 실제 보드 시험 계획(붙이는 곳 · 처음 방향)을 토론할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch06-1',
        title: '실내에서 위치를 아는 방법 — 추측항법',
        minutes: 50,
        goals: [
          '실내에서 GPS 가 잘 안 되는 까닭과 <b>추측항법(PDR)</b>의 생각을 설명할 수 있다',
          '방위각에 따라 한 걸음이 x · y 를 어떻게 바꾸는지 좌표로 나타낼 수 있다',
          '준비된 함수 <code>move()</code> · <code>show_pos()</code> 로 위치를 계산하고 LED 지도에 점으로 보여 줄 수 있다',
          'A 버튼(한 걸음)과 방위각 슬라이더로 점을 움직이고, 보폭 · 방향 오차가 위치에 주는 영향을 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['GPS 와 추측항법', 8], ['좌표와 방향 · 모눈 걷기', 8], ['move() · show_pos()', 10], ['A 버튼 + 방위각으로 걷기', 10], ['토론: 보폭 · 방향 오차', 7], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>눈을 감고 교실 문까지 걸어가야 한다면</b>, 무엇을 세고 무엇을 기억하며 걸을까요? 자리에서 문까지 가는 길을 떠올리고, “몇 걸음”, “어느 쪽으로”, “어디서 돌기”를 순서대로 적어 오세요. (실제로 해 볼 때는 꼭 친구가 옆에서 지켜 줍니다.)' },
          { type: 'p', html: '적어 온 내용을 모아 보면 대부분 비슷한 모양입니다. “앞으로 <b>6걸음</b> → <b>오른쪽</b>으로 돌기 → <b>4걸음</b>”처럼 <b>걸음 수</b>와 <b>방향</b>을 번갈아 기억합니다. 어떤 친구는 “내 걸음은 짧으니까 한 걸음 더”처럼 <b>한 걸음의 길이</b>까지 생각했을 것입니다. 바로 이 세 가지 — 걸음 · 방향 · 보폭 — 가 오늘 만들 위치 추적의 재료입니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 오늘은 어디쯤?', html: '두 번째 프로젝트 <b>실내 이동 경로 추적</b>의 첫 시간입니다. 문제 정하기 → 잴 것 정하기 → <b>센서 읽기 → 계산하기</b> → 저장하기 → 보여 주기 → 고치기. 걸음 세기(ch03) · 방향 읽기(ch02) · 보폭(ch05)은 이미 만들어 두었으니, 오늘은 이 재료로 <b>위치를 계산하는</b> 단계입니다.' },

          { type: 'h', text: '실내에서는 GPS 가 약합니다' },
          { type: 'p', html: '휴대폰 지도 앱은 하늘의 여러 위성이 보내는 신호를 받아 위치를 알아냅니다. 이것을 <b>GPS</b>라고 합니다. 그런데 위성 신호는 아주 약해서 <b>지붕 · 벽 · 두꺼운 콘크리트</b>를 지나면 더 약해지거나 끊깁니다. 그래서 건물 안, 지하 주차장, 지하철역에서는 지도 위 내 위치가 엉뚱한 곳에 있거나 빙글빙글 돌기도 합니다.' },
          { type: 'figure', html: FIG_GPS, caption: '그림 6-1. 바깥에서는 위성 신호가 잘 닿지만, 실내에서는 약해진다' },
          { type: 'p', html: '실내에서 위치를 알아내는 방법은 여러 가지가 있습니다. 와이파이 공유기나 작은 신호기(비콘)를 곳곳에 달아 두고 신호 세기로 짐작하는 방법도 있지요. 하지만 이런 방법은 <b>건물에 장비를 미리 설치</b>해야 합니다. 우리는 장비 없이 <b>몸에 단 센서만으로</b> 위치를 짐작하는 방법을 씁니다.' },

          { type: 'h', text: '추측항법(PDR) — 걸음마다 화살표 이어 붙이기' },
          { type: 'p', html: '<b>추측항법(dead reckoning)</b>은 출발점을 알고 있을 때, “어느 쪽으로 얼마나 움직였는지”를 계속 더해서 지금 위치를 짐작하는 방법입니다. 사람의 걸음으로 하는 추측항법을 <b>보행자 추측항법(PDR, Pedestrian Dead Reckoning)</b>이라고 부릅니다.' },
          { type: 'p', html: '규칙은 딱 하나입니다. <b>한 걸음을 느낄 때마다, 지금 보고 있는 방향으로, 보폭만큼 이동했다고 계산합니다.</b> 그림처럼 걸음 하나하나가 작은 화살표이고, 화살표를 꼬리에 머리를 붙여 이어 가면 지금 위치가 나옵니다.' },
          { type: 'figure', html: FIG_PDR, caption: '그림 6-2. 추측항법 — 걸음마다 “방향 + 보폭” 화살표를 이어 붙인다' },
          { type: 'table', head: ['재료', '무엇으로 아나요?', '어디서 배웠나요?'], rows: [
            ['걸음 (언제 움직였나)', '가속도 센서 + <code>is_step()</code>', 'ch03 만보기'],
            ['방향 (어느 쪽으로)', '지자기 센서 <code>compass.heading()</code>', 'ch02 나침반'],
            ['보폭 (얼마나)', '줄자로 잰 내 보폭 (cm)', 'ch05 보폭 계산']
          ], caption: '표 6-1. 추측항법의 세 가지 재료' },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 배와 비행기의 추측항법', html: 'GPS 가 없던 시절의 배도 같은 방법으로 바다 위 위치를 짐작했습니다. 나침반으로 <b>방향</b>을, 배의 빠르기와 걸린 시간으로 <b>거리</b>를 재서 지도 위에 선을 이어 그렸지요. 우리는 “빠르기 × 시간” 대신 “걸음 수 × 보폭”을 씁니다.' },

          { type: 'h', text: '좌표 (x, y) 와 방향' },
          { type: 'p', html: '위치를 숫자로 나타내려면 <b>좌표(coordinate)</b>가 필요합니다. 출발점을 <b>(0, 0)</b> 으로 정하고, <b>동쪽으로 가면 x 가 커지고</b>, <b>북쪽으로 가면 y 가 커지도록</b> 약속합니다. 서쪽 · 남쪽으로 가면 음수가 됩니다. 방향은 ch02 에서 배운 <b>방위각</b> 그대로 씁니다. 북쪽 0°, 동쪽 90°, 남쪽 180°, 서쪽 270° 입니다.' },
          { type: 'figure', html: FIG_GRID, caption: '그림 6-3. 출발점 (0, 0) 에서 동쪽 = x 증가, 북쪽 = y 증가' },
          { type: 'table', head: ['방위각', '방향', '한 걸음(1칸) 뒤 x 변화', '한 걸음(1칸) 뒤 y 변화'], rows: [
            ['0°', '북', '0', '+1'],
            ['90°', '동', '+1', '0'],
            ['180°', '남', '0', '−1'],
            ['270°', '서', '−1', '0'],
            ['45°', '북동', '약 +0.7', '약 +0.7']
          ], caption: '표 6-2. 방향에 따라 한 걸음이 바꾸는 x · y' },
          { type: 'p', html: '마지막 줄을 보세요. 대각선(45°)으로 한 칸 걸으면 x 도 1, y 도 1 이 늘어나는 것이 아니라 <b>각각 약 0.7</b> 만 늘어납니다. 한 걸음의 길이는 똑같이 1칸인데, 그 길이가 동쪽과 북쪽으로 <b>나눠지기</b> 때문입니다. 이 나누기 계산을 대신해 주는 함수를 곧 만나 봅니다.' },
          { type: 'list', ordered: true, items: [
            '<b>모눈종이 걷기 활동</b>: 모눈종이 가운데에 출발점 (0, 0) 을 찍고, 위쪽을 북쪽으로 정합니다.',
            '짝이 “동쪽 3걸음”, “북쪽 2걸음”, “서쪽 1걸음”처럼 말하면 한 칸씩 연필로 따라 그립니다.',
            '끝난 뒤 내 위치를 (x, y) 로 읽어 봅니다. 위 예라면 (2, 2) 입니다.',
            '짝과 바꿔서 한 번 더 하고, 두 사람의 끝점이 같은지 확인합니다.'
          ] },
          {
            type: 'code', title: '예제 6-1. 셸에서 좌표 따라가기', repl: true, code: `x, y = 0, 0
x = x + 1
x = x + 1
y = y + 1
print(x, y)`,
            desc: '셸에서 모눈 걷기를 숫자로 해 봅니다. 동쪽으로 한 칸 갈 때마다 <code>x</code> 에 1 을, 북쪽으로 한 칸 갈 때마다 <code>y</code> 에 1 을 더합니다. 서쪽이면 <code>x = x - 1</code>, 남쪽이면 <code>y = y - 1</code> 입니다.',
            expect: '>>> x, y = 0, 0\n>>> x = x + 1\n>>> x = x + 1\n>>> y = y + 1\n>>> print(x, y)\n2 1'
          },

          { type: 'h', text: '준비된 함수 move() — 방향으로 한 칸 밀기' },
          { type: 'p', html: '동 · 서 · 남 · 북 네 방향이면 더하기 빼기로 충분하지만, 사람은 30°, 135° 처럼 아무 방향으로나 걷습니다. 그래서 <b>어떤 방향이든</b> 한 걸음을 x · y 로 나눠 주는 준비된 함수 <code>move()</code> 를 씁니다.' },
          {
            type: 'code', title: '준비된 함수 move(x, y, heading, stride)', run: false, code: PY_MOVE,
            desc: '<b>넣는 것</b>: 지금 위치 <code>x</code>, <code>y</code>, 방위각 <code>heading</code>(0~359), 보폭 <code>stride</code>. <b>나오는 것</b>: 한 걸음 뒤의 새 위치 두 개. 안에서는 삼각함수(<code>sin</code> · <code>cos</code>)로 한 걸음을 동쪽 몫과 북쪽 몫으로 나눕니다. 지금은 “<b>그 방향으로 보폭만큼 한 칸 밀어 주는 함수</b>”라고만 알면 됩니다.'
          },
          { type: 'callout', kind: 'tip', title: '삼각함수를 몰라도 괜찮습니다', html: '사다리를 벽에 비스듬히 세우면 사다리 길이는 그대로인데 “벽에서 떨어진 거리”와 “올라간 높이”로 나뉩니다. <code>sin</code> 과 <code>cos</code> 는 이 두 몫을 각도로 알려 주는 계산기일 뿐입니다. 함수에 맡기고 우리는 <b>무엇을 넣고 무엇을 받는지</b>에만 집중합니다.' },
          {
            type: 'code', title: '예제 6-2. move() 로 한 걸음씩 걷기', code: `from microbit import *
import math

` + PY_MOVE + `
x, y = 0, 0
for heading in [90, 90, 0, 0, 45]:
    x, y = move(x, y, heading, 100)     # 보폭 100cm = 모눈 한 칸
    print("방향", heading, "→ x =", round(x), "y =", round(y))`,
            desc: '동쪽 두 걸음, 북쪽 두 걸음, 북동쪽 한 걸음을 차례로 걷습니다. 위치는 cm 로 계산하고, 보기 좋게 <code>round()</code> 로 반올림해서 찍습니다. 마지막 45° 걸음에서 x · y 가 각각 <b>71cm</b> 씩만 늘어나는 것을 확인하세요.',
            hint: '리스트 안의 방향을 <code>[0, 180, 270, 270]</code> 처럼 바꿔 실행해 보세요. 출발점보다 서쪽 · 남쪽으로 가면 음수가 나옵니다.',
            expect: '방향 90 → x = 100 y = 0\n방향 90 → x = 200 y = 0\n방향 0 → x = 200 y = 100\n방향 0 → x = 200 y = 200\n방향 45 → x = 271 y = 271'
          },
          { type: 'p', html: '이번에는 “어느 쪽으로 몇 걸음”을 짝지어 적은 <b>길 안내 목록</b>을 만들어 따라가 봅니다. 생각하기에서 적어 온 “6걸음 → 오른쪽 → 4걸음”과 같은 모양입니다.' },
          {
            type: 'code', title: '예제 6-3. 길 안내 목록 따라가기', code: `from microbit import *
import math

` + PY_MOVE + `
ROUTE = [(90, 2), (0, 2), (270, 2), (180, 2)]   # (방향, 걸음 수)
x, y = 0, 0
for heading, steps in ROUTE:
    for i in range(steps):
        x, y = move(x, y, heading, 100)
    print(heading, "쪽으로", steps, "걸음 → x =", round(x), "y =", round(y))`,
            desc: '동 → 북 → 서 → 남으로 두 걸음씩 걸으면 한 변이 2m 인 정사각형이 되어 <b>출발점 (0, 0) 으로 돌아옵니다</b>. 계산이 정확하니 끝점도 정확히 0, 0 입니다. 실제 센서로 걸으면 어떻게 될지는 2교시에 확인합니다.',
            hint: '<code>ROUTE</code> 를 생각하기에서 적어 온 “교실 문까지 가는 길”로 바꿔 보세요.',
            expect: '90 쪽으로 2 걸음 → x = 200 y = 0\n0 쪽으로 2 걸음 → x = 200 y = 200\n270 쪽으로 2 걸음 → x = 0 y = 200\n180 쪽으로 2 걸음 → x = 0 y = 0'
          },

          { type: 'h', text: 'LED 5×5 를 작은 지도로 — show_pos()' },
          { type: 'p', html: '숫자만 보면 어디쯤인지 감이 잘 오지 않습니다. 그래서 LED 화면을 <b>위에서 내려다본 작은 지도</b>로 씁니다. 가운데 칸을 출발점으로, 한 칸을 1m 로 정하고 지금 위치를 <b>밝은 점 하나</b>로 켭니다. 출발점은 흐리게 켜 두어 얼마나 떨어졌는지 보이게 합니다.' },
          { type: 'figure', html: FIG_LEDMAP, caption: '그림 6-4. LED 5×5 지도 — 가운데가 출발점, 한 칸 = 1m' },
          {
            type: 'code', title: '준비된 함수 show_pos(x, y)', run: false, code: PY_SHOW,
            desc: '<b>넣는 것</b>: 위치 <code>x</code>, <code>y</code>(cm). <b>하는 일</b>: LED 지도에 점을 켭니다. 프로그램 위쪽에 <code>CELL</code>(LED 한 칸이 몇 cm 인지)과 <code>OX, OY</code>(출발점이 몇 번째 칸인지)를 먼저 정해 두어야 합니다. 지도 밖으로 나가면 점을 <b>가장자리에 붙여</b> 보여 줍니다.'
          },
          { type: 'figure', html: FIG_ROUTE_TILES, caption: '그림 6-5. show_pos() 가 그리는 모습 (흐린 점 = 출발점, 밝은 점 = 지금 위치)' },
          {
            type: 'code', title: '예제 6-4. LED 지도 위에서 정사각형 걷기', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_MAP_CENTER + `
` + PY_SHOW + `
ROUTE = [(90, 1), (0, 1), (270, 2), (180, 2), (90, 2), (0, 1), (270, 1)]
while True:
    x, y = 0, 0
    show_pos(x, y)
    sleep(800)
    for heading, steps in ROUTE:
        for i in range(steps):
            x, y = move(x, y, heading, 100)
            show_pos(x, y)
            sleep(500)`,
            desc: '출발점에서 동쪽으로 한 칸 나간 뒤, 출발점을 한 바퀴 빙 둘러 다시 돌아오는 길을 LED 위에 0.5초마다 그립니다. 점이 출발점(흐린 점) 둘레를 시계 반대 방향으로 돌고 가운데로 돌아오면 성공입니다.',
            hint: '<code>CELL</code> 을 <code>50</code> 으로 바꾸면 한 칸이 50cm 가 되어 같은 길이 두 배로 크게 보입니다. 점이 가장자리에 붙는 모습도 확인하세요.',
            expect: 'LED 가운데에 흐린 점(출발점)이 있고, 밝은 점이 한 칸씩 출발점 둘레를 돌아 가운데로 돌아옵니다. 이 움직임이 계속 반복됩니다.'
          },

          { type: 'h', text: '합치기 — A 버튼은 한 걸음, 방위각 슬라이더는 방향' },
          { type: 'p', html: '이제 진짜 센서 값으로 점을 움직입니다. 걸음 검출은 2교시에 붙이고, 오늘은 <b>A 버튼 한 번 = 한 걸음</b>으로 정합니다. 방향은 <code>compass.heading()</code> 으로 읽습니다. 시뮬레이터에서는 <b>🧭 센서</b> 탭의 <b>방위각 슬라이더</b>가 보드가 보는 방향입니다.' },
          {
            type: 'code', title: '예제 6-5. A 버튼으로 걷는 위치 추적기', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_MAP_CENTER + `
` + PY_SHOW + `
STRIDE = 100       # 한 걸음 = 모눈 한 칸 (100cm)
x, y = 0, 0
steps = 0
show_pos(x, y)

while True:
    if button_a.was_pressed():
        h = compass.heading()
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, "걸음 · 방향", h, "· x =", round(x), "y =", round(y))
    sleep(50)`,
            desc: 'A 버튼을 누를 때마다 <b>그 순간의 방위각</b>으로 한 칸 이동하고, LED 지도의 점과 콘솔의 좌표가 함께 바뀝니다. 방향을 바꾸지 않고 A 를 여러 번 누르면 한 줄로 쭉 나아가고, 슬라이더를 돌린 뒤 누르면 그쪽으로 꺾입니다.',
            hint: '<b>🧭 센서</b> 탭의 <b>방위각 슬라이더</b>를 90 에 두고 <b>A</b> 를 두 번, 0 으로 옮기고 두 번 눌러 보세요. 예제 6-2 와 같은 좌표가 나오나요?',
            expect: '1 걸음 · 방향 90 · x = 100 y = 0\n2 걸음 · 방향 90 · x = 200 y = 0\n3 걸음 · 방향 0 · x = 200 y = 100\n4 걸음 · 방향 0 · x = 200 y = 200',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '움직임 조이스틱으로 방향 바꾸기', html: '시뮬레이터의 <b>움직임 조이스틱</b>을 옆으로 밀면 가상의 사람이 몸을 돌리면서 방위각도 함께 바뀝니다. 조이스틱이 보이지 않으면 위처럼 <b>방위각 슬라이더</b>를 쓰면 됩니다.' },
          { type: 'p', html: '출발점에서 얼마나 떨어졌는지도 알고 싶다면, x 와 y 로 <b>곧은 거리</b>를 구하면 됩니다. 직각삼각형의 빗변 길이를 구하는 식인데, 이것도 “두 몫을 다시 하나로 합치는 계산”이라고만 생각합시다.' },
          {
            type: 'code', title: '응용 6-6. B 버튼으로 출발점까지의 거리 보기', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_MAP_CENTER + `
` + PY_SHOW + `
STRIDE = 100
x, y = 0, 0
show_pos(x, y)

while True:
    if button_a.was_pressed():
        x, y = move(x, y, compass.heading(), STRIDE)
        show_pos(x, y)
        print("x =", round(x), "y =", round(y))
    if button_b.was_pressed():
        d = math.sqrt(x * x + y * y)     # 출발점까지 곧은 거리
        print("출발점까지", round(d), "cm")
        display.scroll(str(round(d / 100)) + "m")
        show_pos(x, y)
    sleep(50)`,
            desc: '예제 6-5 에 B 버튼을 더했습니다. B 를 누르면 출발점까지의 <b>곧은 거리</b>를 콘솔에 cm 로, LED 에 m 로 보여 준 뒤 다시 지도를 그립니다. 동쪽 3칸 · 북쪽 4칸이면 걸은 길은 7칸이지만 곧은 거리는 <b>500cm</b> 입니다.',
            hint: '방위각 90 에서 A 를 3번, 0 에서 A 를 4번 누른 뒤 B 를 눌러 보세요.',
            expect: '…\nx = 300 y = 400\n출발점까지 500 cm\n(LED 에 5m 가 흘러간 뒤 지도가 다시 보입니다)',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제 보드는 처음 <code>compass.heading()</code> 을 읽을 때 <b>보정(calibrate)</b> 화면이 나올 수 있습니다. 보드를 기울여 LED 를 모두 채우면 시작됩니다. 또 보드를 <b>책상 위에 수평으로</b> 놓고 돌려야 방위각이 잘 맞습니다. 철제 책상 · 스마트폰 옆에서는 방향이 틀어지니 피합니다 (ch02).' },

          { type: 'h', text: '토론 — 보폭과 방향이 조금씩 틀리면?' },
          { type: 'p', html: '추측항법은 <b>앞의 위치에 계속 더해 가는</b> 방법입니다. 그래서 재료가 조금만 틀려도 그 실수가 사라지지 않고 쌓입니다. 두 가지 경우를 그림으로 먼저 봅니다.' },
          { type: 'figure', html: FIG_ERR, caption: '그림 6-6. 보폭이 틀리면 앞뒤로, 방향이 틀리면 옆으로 어긋난다' },
          {
            type: 'code', title: '예제 6-7. 진짜 위치와 틀린 계산 비교하기', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_WALK + `
tx, ty = walk(0, 65, 20)       # 진짜: 북쪽으로 보폭 65cm 20걸음
print("진짜 위치:", round(tx), round(ty))

bx, by = walk(0, 75, 20)       # 보폭을 75cm 로 크게 잡음
gap = math.sqrt((bx - tx) * (bx - tx) + (by - ty) * (by - ty))
print("보폭 75cm:", round(bx), round(by), "→ 차이", round(gap), "cm")

hx, hy = walk(10, 65, 20)      # 방향이 10도 틀어짐
gap = math.sqrt((hx - tx) * (hx - tx) + (hy - ty) * (hy - ty))
print("방향 10도:", round(hx), round(hy), "→ 차이", round(gap), "cm")`,
            desc: '같은 20걸음을 세 가지로 계산해 비교합니다. 보폭을 10cm 크게 잡으면 <b>앞쪽으로 2m</b> 더 간 것으로, 방향이 10도 틀리면 <b>옆쪽으로 2m 넘게</b> 벗어난 것으로 계산됩니다. 겨우 20걸음인데도 차이가 꽤 큽니다.',
            hint: '<code>walk()</code> 의 걸음 수를 20 에서 100 으로 바꾸면 차이가 어떻게 되는지 예상한 뒤 실행해 보세요.',
            expect: '진짜 위치: 0 1300\n보폭 75cm: 0 1500 → 차이 200 cm\n방향 10도: 226 1280 → 차이 227 cm'
          },
          { type: 'list', items: [
            '💬 보폭을 실제보다 <b>크게</b> 잡으면 지도 위의 점은 어떻게 움직일까요? 작게 잡으면요?',
            '💬 방향이 늘 <b>같은 쪽으로 5도</b> 틀린다면, 곧게 걸은 길이 지도에서는 어떤 모양이 될까요?',
            '💬 걸음 하나를 <b>놓치거나</b>, 걷지 않았는데 한 걸음을 <b>더 세면</b> 어떻게 될까요?',
            '💬 이 오차를 줄이려면 어떤 재료를 더 정확하게 재야 할까요? (ch05 의 보폭 실측을 떠올려 보세요)'
          ] },
          { type: 'callout', kind: 'tip', title: '토론 정리', html: '보폭 오차는 <b>걸은 방향 그대로 앞뒤로</b>, 방향 오차는 <b>옆으로</b> 위치를 밀어냅니다. 두 오차 모두 <b>걸을수록 커집니다</b>. 그래서 추측항법은 ① 재료를 정확하게 재고(보폭 실측 · 나침반 보정), ② 가끔 “여기가 확실히 문 앞”처럼 <b>위치를 바로잡아 주는</b> 방법을 함께 씁니다.' },
          { type: 'callout', kind: 'info', title: '다음 시간 생각하기', html: '사각형 모양으로 걸어서 출발점으로 돌아왔는데, 기록은 출발점과 다르다면 원인은 무엇일까요? 오늘 토론한 내용에서 떠오르는 원인을 <b>세 가지 이상</b> 적어 오세요.' }
        ],
        slides: [
          { layout: 'title', title: '실내에서 위치를 아는 방법 — 추측항법', subtitle: 'Chapter 06 · 걸음과 방향으로 위치 찾기', badge: '1교시', notes: '<p>두 번째 프로젝트 “실내 이동 경로 추적”의 시작임을 알립니다. “러닝 기록기는 얼마나 갔는지를 알았죠. 이번에는 <b>어디에</b> 있는지를 알아봅니다.”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 눈 감고 문까지', lead: '무엇을 세고 무엇을 기억했나요?', bullets: ['몇 걸음? → <b>걸음 수</b>', '어느 쪽으로? 어디서 돌기? → <b>방향</b>', '내 걸음은 짧은가? → <b>보폭</b>', '→ 오늘 위치 계산의 세 재료'], notes: '<p>두세 명이 적어 온 길 안내를 읽게 하고, 칠판에 “걸음 · 방향 · 보폭” 세 칸으로 분류해 적습니다.</p><p>💬 “눈 감고 걸었더니 문에서 조금 빗나갔다면 왜일까요?” — 걸음 수를 잘못 셈, 덜 돌았음, 보폭이 달랐음. 오늘 토론의 실마리입니다.</p><p>실제로 눈 감고 걷게 할 때는 짝이 옆에서 지키게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '실내에서는 GPS 가 약하다', html: FIG_GPS, caption: '지붕 · 벽이 위성 신호를 막음', notes: '<p>지하 주차장 · 지하철역에서 지도 앱 위치가 엉뚱했던 경험을 물어봅니다.</p><p>💬 “장비 없이 실내 위치를 알 수 있을까요?” — 몸에 단 센서로 짐작하기.</p><p>와이파이 · 비콘 방식은 “건물에 장비가 필요하다”는 점만 짚고 넘어갑니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '추측항법(PDR)', html: FIG_PDR, caption: '걸음마다 “방향 + 보폭” 화살표 이어 붙이기', notes: '<p>PDR = Pedestrian Dead Reckoning(보행자 추측항법). 이름은 외우지 않아도 되고 규칙 한 문장만 강조합니다: “한 걸음마다, 지금 방향으로, 보폭만큼.”</p><p>세 재료가 각각 ch03 · ch02 · ch05 에서 이미 만든 것임을 표 6-1 로 연결합니다.</p><p>💬 “출발점을 모르면?” — 위치를 알 수 없다. 추측항법은 출발점이 꼭 필요합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '좌표 (x, y) 와 방향', html: FIG_GRID, caption: '동쪽 = x 증가 · 북쪽 = y 증가', notes: '<p>수학 시간의 좌표평면과 같다고 연결합니다. 초등학생에게는 “오른쪽으로 몇 칸, 위로 몇 칸”으로 설명합니다.</p><p>방위각은 시계 방향으로 커진다는 점(ch02)을 다시 확인합니다.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '한 걸음이 바꾸는 x · y', head: ['방위각', '방향', 'x 변화', 'y 변화'], rows: [['0°', '북', '0', '+1'], ['90°', '동', '+1', '0'], ['180°', '남', '0', '−1'], ['270°', '서', '−1', '0'], ['45°', '북동', '약 +0.7', '약 +0.7']], lead: '모눈종이 걷기 활동 후 확인', notes: '<p><b>모눈종이 걷기</b>(3분): 짝이 “동쪽 3걸음, 북쪽 2걸음, 서쪽 1걸음”을 불러 주면 연필로 따라 그리고 끝점을 (x, y) 로 읽습니다. 답 (2, 2).</p><p>💬 “대각선으로 한 칸 가면 왜 x, y 가 1 씩이 아니라 0.7 일까요?” — 한 걸음 길이가 두 방향으로 나뉘기 때문. 사다리 비유를 씁니다.</p><p>시간: 5분</p>' },
          { layout: 'code', title: '준비된 함수 move()', code: `from microbit import *
import math

def move(x, y, heading, stride):
    # heading 방향으로 stride 만큼 한 칸 밀기
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)

x, y = 0, 0
for heading in [90, 90, 0, 0, 45]:
    x, y = move(x, y, heading, 100)
    print("방향", heading, "→", round(x), round(y))`, points: ['넣는 것: 위치 · 방향 · 보폭', '나오는 것: 새 위치 (x, y)', '안은 삼각함수 — “한 칸 밀기”로만'], notes: '<p>함수 안쪽은 설명하지 않고 “무엇을 넣고 무엇을 받는지”만 짚습니다. 고등학생에게는 sin · cos 가 “동쪽 몫 · 북쪽 몫”이라고 한 줄 덧붙입니다.</p><p>실행 후 마지막 줄 45° 결과(271, 271)를 표와 비교합니다.</p><p>💬 “방향 리스트를 [180, 270] 으로 바꾸면?” — 음수 좌표.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: 'LED 5×5 를 작은 지도로', html: FIG_LEDMAP, caption: 'show_pos(x, y) — 가운데 = 출발점, 한 칸 = 1m', notes: '<p>LED 줄 번호는 위에서 아래로 커지므로 y 는 “빼야” 한다는 점이 헷갈리는 부분입니다. 손가락으로 칸을 짚으며 함께 계산합니다.</p><p><code>CELL</code> · <code>OX, OY</code> 를 바꾸면 지도의 크기와 출발 칸을 바꿀 수 있다고 안내합니다. 본문 예제 6-4 를 실행해 점이 출발점 둘레를 도는 모습을 보여 줍니다.</p><p>시간: 5분</p>' },
          { layout: 'two', title: 'A 버튼 = 한 걸음, 슬라이더 = 방향', left: { title: '반복문의 핵심', code: `while True:
    if button_a.was_pressed():
        h = compass.heading()
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, h, round(x), round(y))
    sleep(50)`, run: false }, right: { title: '해 보기', bullets: ['본문 <b>예제 6-5</b> ▶ 실행', '🧭 센서 탭 방위각 슬라이더 90 → A 두 번', '슬라이더 0 → A 두 번 → (200, 200)?', '응용 6-6: B = 출발점까지 거리'] }, notes: '<p>학생들은 본문 예제 6-5 를 실행합니다. 조이스틱이 보이면 옆으로 밀어 방향을 바꿔도 됩니다.</p><p>★ 학생: 예제 6-5 로 정사각형 걷기. ★★ 학생: 응용 6-6 으로 B 거리 보기. ★★★ 학생: <code>STRIDE</code> 를 내 보폭(ch05)으로 바꾸고 <code>CELL</code> 을 조절해 교실 크기 지도 만들기.</p><p>💬 “같은 방향으로 A 를 10번 누르면 점은?” — 가장자리에 붙어 멈춘 것처럼 보임 (지도 밖).</p><p>시간: 8분</p>' },
          { layout: 'diagram', title: '보폭 · 방향이 조금 틀리면?', html: FIG_ERR, caption: '보폭 오차 → 앞뒤 · 방향 오차 → 옆으로', notes: '<p>그림을 보여 주기 전에 먼저 예측하게 합니다. 💬 “보폭을 실제보다 크게 잡으면 점은?” — 더 멀리. “방향이 조금 틀리면?” — 옆으로 벗어남.</p><p>“걸을수록 벌어진다”는 말에 밑줄을 긋습니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '진짜 위치와 틀린 계산', code: `from microbit import *
import math

def move(x, y, heading, stride):
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)

def walk(heading, stride, steps):
    x, y = 0, 0
    for i in range(steps):
        x, y = move(x, y, heading, stride)
    return x, y

print("진짜   ", walk(0, 65, 20))
print("보폭 75", walk(0, 75, 20))
print("방향 10", walk(10, 65, 20))`, points: ['20걸음만에 약 2m 차이', '보폭 오차 → 앞으로 더', '방향 오차 → 옆으로'], notes: '<p>슬라이드 코드는 반올림 없이 찍으므로 소수가 길게 나옵니다. 앞자리만 읽게 합니다 (본문 예제 6-7 은 반올림 버전).</p><p>💬 “100걸음이면 차이는?” — 약 5배. 예상한 뒤 숫자를 바꿔 확인합니다.</p><p>시간: 4분</p>' },
          { layout: 'bullets', title: '토론 — 어떻게 줄일까?', bullets: ['보폭을 크게 / 작게 잡으면?', '방향이 늘 같은 쪽으로 5도 틀리면?', '걸음을 놓치거나 더 세면?', '→ 재료 정확히 + 가끔 위치 바로잡기'], notes: '<p>모둠별로 한 질문씩 맡아 1분 이야기하고 한 줄로 발표합니다.</p><p>예상 답: 보폭 실측(ch05) · 나침반 보정(ch02) · 걸음 검출 기준선 조절(ch03) · 문 앞처럼 확실한 곳에서 위치를 다시 맞추기.</p><p>시간: 3분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['실내는 GPS 약함 → 추측항법(PDR)', '한 걸음마다 방향으로 보폭만큼', '동쪽 = x+ · 북쪽 = y+', '<code>move()</code> 새 위치 · <code>show_pos()</code> LED 지도', '오차는 걸을수록 쌓인다'], notes: '<p>다섯 줄을 함께 읽습니다.</p><p>다음 시간 “생각하기”: 사각형 모양으로 걸어서 출발점으로 돌아왔는데 기록은 출발점과 다르다면, 원인은 무엇일까요? 원인 세 가지 이상 적어 오기를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch06-2',
        title: '움직임으로 위치 추적하기',
        minutes: 50,
        goals: [
          '<code>is_step()</code> · <code>compass.heading()</code> · <code>move()</code> 를 하나의 반복문으로 조립해 위치 추적기를 만들 수 있다',
          '움직임 조이스틱으로 가상의 사람을 걷게 하며 좌표가 따라오는지 확인할 수 있다',
          '준비된 함수 <code>tilt_heading()</code> 을 쓰고, 방향 · 보폭 오차가 쌓이는 크기를 표로 설명할 수 있다',
          '옆걸음 · 제자리 회전 · 자석 간섭 문제와 실제 보드 시험 계획(붙이는 곳 · 처음 방향)을 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['조립하기', 8], ['조이스틱으로 걷기', 7], ['기울기와 tilt_heading()', 6], ['오차가 쌓이는 모습', 6], ['사각형 걷기 실습', 10], ['토론 · 시험 계획', 6], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>사각형 모양으로 걸어서 출발점으로 돌아왔는데, 기록은 출발점과 다르다면</b> 원인은 무엇일까요? 1교시에 토론한 내용을 떠올리며 원인을 세 가지 이상 적어 오세요. 그리고 그중 <b>가장 자주 일어날 것 같은 원인</b>에 동그라미를 칩니다.' },
          { type: 'p', html: '적어 온 원인을 모으면 대략 이렇게 나뉩니다. <b>걸음</b>을 놓치거나 더 셌다, <b>방향</b>이 틀어졌다(보드가 기울었다, 근처에 자석이 있었다), <b>보폭</b>이 실제와 달랐다(돌 때 짧게 걸었다). 오늘은 위치 추적기를 완성한 뒤, 가상의 사람으로 사각형을 걸어 이 원인들을 하나씩 확인합니다.' },

          { type: 'h', text: '조립하기 — 세 함수를 하나의 반복문으로' },
          { type: 'p', html: '1교시의 추적기는 A 버튼이 “한 걸음”이었습니다. 이 자리에 ch03 의 <b>걸음 검출</b>을 넣으면 사람이 걸을 때 저절로 위치가 바뀝니다. 반복문 한 바퀴에서 하는 일은 그림처럼 네 가지입니다.' },
          { type: 'figure', html: FIG_LOOP, caption: '그림 6-7. 위치 추적기의 반복문 — 걸음 → 방향 → 위치 → 보여 주기' },
          {
            type: 'code', title: '준비된 함수 모음 — 걸음 검출 (ch03)', run: false, code: PY_STEP_KIT,
            desc: 'ch03 · ch05 에서 쓴 것과 똑같습니다. <code>THRESHOLD</code> 는 우리 모둠이 정한 기준선으로 바꿔 씁니다. <code>is_step(smooth(strength()))</code> 한 줄이 “방금 한 걸음이 났나?”를 <code>True</code> / <code>False</code> 로 알려 줍니다.'
          },
          {
            type: 'code', title: '예제 6-8. 걸음으로 움직이는 위치 추적기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_MOVE + `
` + PY_MAP_CENTER + `
` + PY_SHOW + `
STRIDE = 65        # 내 보폭 (cm, ch05 실측)
x, y = 0, 0
steps = 0
show_pos(x, y)

while True:
    if is_step(smooth(strength())):
        h = compass.heading()
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, "걸음 · 방향", h, "· x =", round(x), "y =", round(y))
    sleep(20)`,
            desc: '준비된 함수가 많아 길어 보이지만, 우리가 새로 쓴 부분은 맨 아래 반복문뿐입니다. 예제 6-5 의 <code>button_a.was_pressed()</code> 자리에 <code>is_step(smooth(strength()))</code> 가 들어갔고, 보폭이 모눈 한 칸(100cm)에서 <b>내 보폭</b>으로 바뀌었습니다.',
            hint: '<b>움직임 조이스틱</b>을 위로 살짝 밀어 가상의 사람을 걷게 하세요. 걸음마다 콘솔에 한 줄씩 찍히고 LED 점이 북쪽(위)으로 움직입니다.',
            expect: '1 걸음 · 방향 0 · x = 0 y = 65\n2 걸음 · 방향 0 · x = 0 y = 130\n3 걸음 · 방향 0 · x = 0 y = 195\n…',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '움직임 조이스틱 대신 <b>🧭 센서</b> 탭의 <b>흔들기(shake)</b> 제스처 버튼을 일정한 박자로 눌러 걸음을 만들고, <b>방위각 슬라이더</b>로 방향을 바꿉니다. 걸음이 잘 안 잡히면 1교시의 예제 6-5(A 버튼 = 한 걸음)로 같은 실험을 해도 됩니다.' },

          { type: 'h', text: '움직임 시뮬레이션 — 가상의 사람을 걷게 하기' },
          { type: 'p', html: '추적기가 제대로 만들어졌는지 확인하려면 “이렇게 움직이면 좌표가 이렇게 바뀌어야 한다”를 <b>미리 정해 두고</b> 비교합니다. 아래 순서대로 조이스틱을 움직이며 표의 오른쪽 칸과 같은지 확인하세요.' },
          { type: 'table', head: ['조이스틱 조작', '가상의 사람', '기대하는 좌표 변화', 'LED 지도'], rows: [
            ['가운데(손 뗌)', '멈춤', '바뀌지 않음', '점 그대로'],
            ['위로 살짝', '북쪽으로 걷기', 'y 만 한 걸음마다 +65', '점이 위로'],
            ['옆(오른쪽)으로 밀어 90° 돌기', '동쪽을 보고 서기', '돌기만 하면 바뀌지 않음', '점 그대로'],
            ['다시 위로 살짝', '동쪽으로 걷기', 'x 만 한 걸음마다 +65', '점이 오른쪽으로'],
            ['위로 끝까지', '동쪽으로 뛰기', 'x 가 빠르게 늘어남 (보폭은 그대로 65)', '점이 빠르게 오른쪽으로']
          ], caption: '표 6-3. 조이스틱 시험표 — 기대한 대로 움직이나요?' },
          { type: 'p', html: '마지막 줄을 보세요. 뛸 때는 실제 보폭이 길어지는데(ch05), 추적기는 <code>STRIDE = 65</code> 하나만 씁니다. 그래서 뛴 거리가 <b>실제보다 짧게</b> 계산됩니다. ch05 에서 토론한 것과 같은 문제입니다. 케이던스가 높으면 보폭을 키우는 방법을 떠올려 볼 수 있습니다.' },

          { type: 'h', text: '보드가 기울면 방향이 틀어집니다 — tilt_heading()' },
          { type: 'p', html: '나침반은 보드가 <b>수평</b>일 때 가장 정확합니다. 그런데 몸에 단 보드는 걸을 때마다 출렁이고, 붙이는 방법에 따라 비스듬히 기울어 있기도 합니다. 보드가 기울면 지자기 센서가 느끼는 방향이 섞여서 <b>방위각이 틀어집니다</b>.' },
          { type: 'figure', html: FIG_TILT, caption: '그림 6-8. 수평일수록 방향을 믿을 수 있다' },
          { type: 'p', html: '그래서 <b>기울기를 살펴서 보정한 방위</b>를 돌려주는 준비된 함수 <code>tilt_heading()</code> 을 씁니다. 하는 일은 두 가지입니다.' },
          { type: 'list', ordered: true, items: [
            '가속도 센서로 기울기를 봅니다. x · y 값 중 하나라도 <code>TILT_LIMIT</code> 보다 크면 “많이 기울었다”고 보고, 이번 방위는 버리고 <b>바로 전의 믿을 만한 방위</b>를 그대로 돌려줍니다.',
            '수평에 가까우면 새 방위를 받아들이되, 한 번에 확 바꾸지 않고 <b>절반씩 다가가게</b> 해서 출렁임을 다듬습니다.'
          ] },
          {
            type: 'code', title: '준비된 함수 tilt_heading()', run: false, code: PY_TILT,
            desc: '<b>넣는 것</b>: 없음 (프로그램 위쪽에 <code>TILT_LIMIT</code> 를 정해 둡니다. 300 이면 대략 17도쯤 기울 때까지 믿습니다). <b>나오는 것</b>: 방위각 0~359. 반복문에서 <b>매 바퀴마다</b> 불러 주어야 방위가 계속 새로 다듬어집니다.'
          },
          { type: 'p', html: '함수 안의 <code>diff</code> 줄은 359° 와 1° 처럼 <b>북쪽을 사이에 둔 두 각도</b>의 차이를 바르게 구하는 계산입니다. 그냥 빼면 358° 차이가 나지만, 실제로는 2° 차이입니다. 셸에서 확인해 봅니다.' },
          {
            type: 'code', title: '예제 6-9. 북쪽을 사이에 둔 두 각도의 차이', repl: true, code: `1 - 359
(1 - 359 + 540) % 360 - 180
(359 - 1 + 540) % 360 - 180`,
            desc: '그냥 빼면 −358 이 나오지만, 계산식을 쓰면 <b>+2</b>(시계 방향으로 2도) 와 <b>−2</b>(반대 방향으로 2도)가 나옵니다. 이 식이 없으면 북쪽을 향해 걸을 때 방위가 0 과 359 사이에서 크게 튀게 됩니다.',
            expect: '>>> 1 - 359\n-358\n>>> (1 - 359 + 540) % 360 - 180\n2\n>>> (359 - 1 + 540) % 360 - 180\n-2'
          },
          {
            type: 'code', title: '예제 6-10. heading 과 tilt_heading 비교하기', code: `from microbit import *

TILT_LIMIT = 300   # 이보다 기울면 방향을 믿지 않음

` + PY_TILT + `
while True:
    x, y, z = accelerometer.get_values()
    th = tilt_heading()
    print("기울기", x, y, "| heading", compass.heading(), "| tilt_heading", th)
    sleep(300)`,
            desc: '보드를 수평으로 두면 두 값이 거의 같아집니다(처음 몇 줄은 <code>tilt_heading</code> 이 0 에서 출발해 따라오는 중입니다). 보드를 크게 기울이면 <code>tilt_heading</code> 은 <b>기울기 직전의 값에서 멈춥니다</b>.',
            hint: '<b>🧭 센서</b> 탭의 <b>기울기 판</b>을 크게 기울인 채로 <b>방위각 슬라이더</b>를 움직여 보세요. <code>heading</code> 은 바뀌지만 <code>tilt_heading</code> 은 그대로입니다. 기울기를 풀면 다시 따라갑니다.',
            expect: '기울기 0 0 | heading 90 | tilt_heading 45\n기울기 0 0 | heading 90 | tilt_heading 67\n기울기 0 0 | heading 90 | tilt_heading 78\n…\n기울기 620 10 | heading 120 | tilt_heading 89',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 진짜 기울기 보상', html: '기울어진 각도만큼 지자기 센서 값을 <b>계산으로 되돌려</b> 수평일 때의 방향을 구하는 방법도 있습니다(기울기 보상, tilt compensation). 삼각함수가 여러 번 들어가는 복잡한 계산이라, 이 강좌에서는 “<b>믿을 수 있을 때만 쓰고, 부드럽게 다듬기</b>”라는 쉬운 방법을 씁니다. 그래서 보드를 <b>처음부터 수평으로 붙이는 것</b>이 가장 좋은 방법입니다.' },

          { type: 'h', text: '오차가 쌓이는 모습' },
          { type: 'p', html: '1교시에 보폭 · 방향 오차를 맛보았습니다. 이번에는 교실 복도 정도인 <b>20m</b>(보폭 65cm 로 31걸음)를 곧게 걸었을 때, 오차가 얼마나 커지는지 표로 만들어 봅니다.' },
          {
            type: 'code', title: '예제 6-11. 20m 를 걸은 뒤의 오차 계산표', code: `from microbit import *
import math

` + PY_MOVE + `
` + PY_WALK + `
tx, ty = walk(0, 65, 31)         # 진짜: 북쪽으로 31걸음 (약 20m)
print("20m(31걸음) 걸은 뒤")
for err in [1, 2, 5, 10]:
    x, y = walk(err, 65, 31)
    print("방향", err, "도 틀림 → 옆으로", round(x), "cm")
for d in [-5, 5, 10]:
    x, y = walk(0, 65 + d, 31)
    print("보폭", d, "cm 틀림 → 앞뒤로", round(y - ty), "cm")`,
            desc: '방향은 1 · 2 · 5 · 10도, 보폭은 −5 · +5 · +10cm 틀렸을 때를 계산합니다. 방향이 <b>5도</b>만 틀려도 20m 뒤에는 옆으로 <b>약 1.8m</b>, 보폭이 <b>5cm</b>만 틀려도 앞뒤로 <b>약 1.6m</b> 어긋납니다. 교실 책상 두세 줄 정도의 차이입니다.',
            hint: '<code>walk()</code> 의 걸음 수 31 을 62(약 40m)로 바꾸면 오차가 어떻게 되는지 예상한 뒤 실행해 보세요.',
            expect: '20m(31걸음) 걸은 뒤\n방향 1 도 틀림 → 옆으로 35 cm\n방향 2 도 틀림 → 옆으로 70 cm\n방향 5 도 틀림 → 옆으로 176 cm\n방향 10 도 틀림 → 옆으로 350 cm\n보폭 -5 cm 틀림 → 앞뒤로 -155 cm\n보폭 5 cm 틀림 → 앞뒤로 155 cm\n보폭 10 cm 틀림 → 앞뒤로 310 cm'
          },
          { type: 'table', head: ['20m 걸은 뒤', '1 차이', '2 차이', '5 차이', '10 차이'], rows: [
            ['방향(도) 오차 → 옆으로', '약 35cm', '약 70cm', '<b>약 176cm</b>', '약 350cm'],
            ['보폭(cm) 오차 → 앞뒤로', '약 31cm', '약 62cm', '<b>약 155cm</b>', '약 310cm']
          ], caption: '표 6-4. 작은 오차도 20m 를 걸으면 1~3m 가 된다 (40m 를 걸으면 약 2배)' },
          { type: 'p', html: '이번에는 오늘의 실습 모양인 <b>가로 5m · 세로 3m 사각형</b>을 계산으로 먼저 걸어 봅니다. 보폭 50cm 로 동쪽 10걸음 → 북쪽 6걸음 → 서쪽 10걸음 → 남쪽 6걸음입니다. 네 가지 경우를 비교합니다.' },
          { type: 'figure', html: FIG_DRIFT, caption: '그림 6-9. 한 변에서 방향이 틀어지면 끝점이 출발점으로 돌아오지 않는다' },
          {
            type: 'code', title: '예제 6-12. 사각형을 계산으로 걸어 보기', code: `from microbit import *
import math

` + PY_MOVE + `
def report(name, route):
    # route 대로 보폭 50cm 로 걸은 끝점과 출발점의 차이
    x, y = 0, 0
    for heading, steps in route:
        for i in range(steps):
            x, y = move(x, y, heading, 50)
    gap = math.sqrt(x * x + y * y)
    print(name, "→ 끝점", round(x), round(y), "· 차이", round(gap), "cm")

report("완벽", [(90, 10), (0, 6), (270, 10), (180, 6)])
report("모두 5도", [(95, 10), (5, 6), (275, 10), (185, 6)])
report("한 변 20도", [(90, 10), (0, 6), (290, 10), (180, 6)])
report("2걸음 놓침", [(90, 10), (0, 6), (270, 8), (180, 6)])`,
            desc: '놀라운 결과가 하나 있습니다. 네 변 <b>모두 똑같이 5도</b> 틀리면 사각형이 통째로 살짝 돌아갈 뿐, <b>끝점은 출발점으로 돌아옵니다</b>. 반면 <b>한 변에서만</b>(예: 자석 근처) 방향이 틀어지거나 <b>걸음을 놓치면</b> 끝점이 어긋납니다.',
            hint: '<code>"한 변 20도"</code> 의 290 을 280 으로 바꾸면 차이가 어떻게 되나요? 보폭 50 을 55 로 바꾸면 “완벽” 줄의 끝점은 어떻게 될까요?',
            expect: '완벽 → 끝점 0 0 · 차이 0 cm\n모두 5도 → 끝점 0 0 · 차이 0 cm\n한 변 20도 → 끝점 30 171 · 차이 174 cm\n2걸음 놓침 → 끝점 100 0 · 차이 100 cm'
          },
          { type: 'callout', kind: 'warn', title: '끝점이 맞았다고 길이 맞은 것은 아닙니다', html: '“모두 5도” 경우처럼 사각형 전체가 돌아가거나, 보폭이 모두 같은 비율로 틀려 사각형이 커져도 <b>끝점은 출발점과 같을 수 있습니다</b>. 그래서 끝점 차이만 보지 말고, <b>모서리 위치</b>(예: 첫 번째 모서리가 (500, 0) 근처인가)도 함께 기록합니다.' },

          { type: 'h', text: '사각형 걷기 — 가로 5m · 세로 3m' },
          { type: 'p', html: '이제 가상의 사람으로 직접 사각형을 걸어 봅니다. 5m 가 LED 지도에 들어가도록 <b>한 칸을 125cm</b> 로 하고, 출발점을 <b>왼쪽 아래 칸 (0, 4)</b> 으로 옮깁니다. 방향은 <code>tilt_heading()</code> 으로 읽고, <b>B 버튼</b>을 누르면 출발점과의 차이를 알려 줍니다.' },
          {
            type: 'code', title: '예제 6-13. 사각형 걷기 추적기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
TILT_LIMIT = 300
` + PY_TILT + `
` + PY_MOVE + `
CELL = 125         # LED 한 칸 = 125cm (5m 가 4칸)
OX, OY = 0, 4      # 출발점 = 왼쪽 아래 칸
` + PY_SHOW + `
STRIDE = 65        # 내 보폭 (cm)
x, y = 0, 0
steps = 0
show_pos(x, y)

while True:
    h = tilt_heading()                  # 매 바퀴 방위 다듬기
    if is_step(smooth(strength())):
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, "걸음 · 방향", h, "· x =", round(x), "y =", round(y))
    if button_b.was_pressed():
        gap = math.sqrt(x * x + y * y)
        print("출발점과의 차이:", round(gap), "cm")
    sleep(20)`,
            desc: '동쪽으로 약 8걸음(5m) → 북쪽 약 5걸음(3m) → 서쪽 약 8걸음 → 남쪽 약 5걸음을 걸으면 점이 LED 지도 아래쪽에서 사각형을 그리고 돌아옵니다. 끝나면 <b>B</b> 를 눌러 차이를 기록합니다.',
            hint: '조이스틱을 오른쪽으로 밀어 동쪽(90°)을 보게 한 뒤 위로 밀어 8걸음, 왼쪽으로 밀어 북쪽(0°)을 보게 한 뒤 5걸음 … 순서로 걸어 보세요. 조이스틱이 없으면 방위각 슬라이더 + 흔들기 제스처로 합니다.',
            expect: '1 걸음 · 방향 90 · x = 65 y = 0\n…\n8 걸음 · 방향 90 · x = 520 y = 0\n9 걸음 · 방향 0 · x = 520 y = 65\n…\n출발점과의 차이: 42 cm',
            nondeterministic: true
          },
          { type: 'table', head: ['시도', '걸음 수', '첫 모서리 (x, y)', '끝점 (x, y)', '출발점과 차이', '그때 있었던 일'], rows: [
            ['1', '', '', '', '', ''],
            ['2', '', '', '', '', ''],
            ['3', '', '', '', '', '']
          ], caption: '표 6-5. 사각형 걷기 기록표 — 공책에 옮겨 적어 씁니다' },
          { type: 'p', html: '여러 번 걸으려면 매번 ▶ 실행을 다시 눌러야 해서 불편합니다. <b>A 버튼으로 위치를 (0, 0) 으로 되돌리는</b> 기능을 더해 봅니다. 반복문 안에 아래 네 줄만 더하면 됩니다.' },
          {
            type: 'code', title: '도전 6-14. A 버튼으로 출발점 되돌리기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
TILT_LIMIT = 300
` + PY_TILT + `
` + PY_MOVE + `
CELL = 125
OX, OY = 0, 4
` + PY_SHOW + `
STRIDE = 65
x, y = 0, 0
steps = 0
show_pos(x, y)

while True:
    h = tilt_heading()
    if is_step(smooth(strength())):
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, "걸음 · 방향", h, "· x =", round(x), "y =", round(y))
    if button_b.was_pressed():
        gap = math.sqrt(x * x + y * y)
        print("출발점과의 차이:", round(gap), "cm")
    if button_a.was_pressed():          # 새로 더한 부분
        x, y = 0, 0
        steps = 0
        show_pos(x, y)
        print("--- 출발점 (0, 0) 으로 되돌림 ---")
    sleep(20)`,
            desc: 'A 를 누르면 위치와 걸음 수가 0 이 되고 점이 출발 칸으로 돌아갑니다. 이제 한 번 실행해 두고 <b>B 로 기록 → A 로 되돌리기</b>를 되풀이하며 여러 번 시도할 수 있습니다.',
            hint: '사각형을 한 바퀴 돌고 <b>B</b> → 기록표에 적기 → <b>A</b> → 다시 한 바퀴. 이번에는 한 변에서만 일부러 방향을 조금 틀어 걸어 보세요.',
            expect: '…\n출발점과의 차이: 58 cm\n--- 출발점 (0, 0) 으로 되돌림 ---\n1 걸음 · 방향 90 · x = 65 y = 0\n…',
            nondeterministic: true
          },

          { type: 'h', text: '토론 — 이런 움직임은 어떻게 알아챌까?' },
          { type: 'p', html: '지금 추적기는 “걸음은 언제나 <b>보드가 보는 쪽으로 앞으로</b> 걷는다”고 믿습니다. 하지만 사람은 옆으로도, 뒤로도 걷고, 제자리에서 돌기도 합니다. 각 상황에서 무엇이 틀리는지, 어떻게 알아채고 줄일 수 있을지 모둠별로 이야기해 봅니다.' },
          { type: 'table', head: ['상황', '추적기가 틀리는 점', '알아채는 방법(생각해 보기)', '줄이는 방법(생각해 보기)'], rows: [
            ['옆걸음 · 뒷걸음', '앞으로 걸은 것으로 계산 → 엉뚱한 쪽으로 이동', '흔들림 모양이 앞걸음과 다른가?', '“옆걸음 모드” 버튼 · 방향에 +90 / +180'],
            ['제자리 회전', '돌면서 몸이 출렁여 걸음으로 잘못 셀 수 있음', '방향이 빨리 바뀌는데 이동은 없음', '방향이 크게 바뀌는 동안은 걸음 세지 않기'],
            ['자석 · 철제 가구 근처', '방향이 틀어짐 → 그 변만 비뚤어짐', '<code>compass.get_field_strength()</code> 가 평소와 다름 (ch02)', '이상할 때는 바로 전 방향을 그대로 쓰기'],
            ['뛰기 · 계단', '보폭이 달라져 거리가 틀림', '케이던스가 높아짐 (ch04)', '케이던스에 따라 보폭 바꾸기 (ch05)']
          ], caption: '표 6-6. 위치가 틀어지는 상황과 해결 아이디어' },
          { type: 'list', items: [
            '💬 이 중 우리 학교 복도에서 <b>가장 자주</b> 일어날 문제는 무엇일까요?',
            '💬 “복도 끝 문 앞”처럼 <b>위치를 확실히 아는 곳</b>을 지나갈 때 버튼을 눌러 위치를 바로잡는다면 오차가 어떻게 될까요?',
            '💬 표의 해결 아이디어 중 하나를 고르고, 어느 함수의 어느 줄을 고치면 될지 말해 보세요.'
          ] },

          { type: 'h', text: '실제 보드 시험 계획' },
          { type: 'p', html: '다음 시간 이후에는 실제 보드를 몸에 달고 걸어 볼 수 있습니다. 미리 계획을 세웁니다. 먼저 <b>어디에 붙일지</b>입니다.' },
          { type: 'figure', html: FIG_WEAR, caption: '그림 6-10. 허리와 가슴 — 어디에 붙여도 보드는 수평으로' },
          { type: 'table', head: ['붙이는 곳', '좋은 점', '아쉬운 점'], rows: [
            ['허리 (벨트 · 허리 가방 위)', '걸음 흔들림이 또렷해 걸음 검출이 잘 됨', '걸을 때 엉덩이가 좌우로 돌아 방향이 출렁임'],
            ['가슴 (목걸이 줄 + 받침)', '몸통이 보는 방향과 같아 방향이 안정적', '흔들림이 약해 기준선(THRESHOLD)을 낮춰야 할 수 있음']
          ], caption: '표 6-7. 보드를 붙이는 곳 비교' },
          { type: 'p', html: '다음은 <b>처음 방향 맞추기</b>입니다. 교실 벽은 정확히 북쪽을 향하지 않는 경우가 많습니다. 그래서 출발할 때 “지금 내가 보는 쪽 = 앞(0°)”으로 정해 두고, 그 뒤의 방향은 그 기준에서 몇 도 돌았는지로 씁니다.' },
          {
            type: 'code', title: '예제 6-15. 처음 방향 맞추기 — 지금 보는 쪽을 0° 로', code: `from microbit import *

base = 0          # 기준 방향 (처음엔 북쪽)

while True:
    if button_a.was_pressed():
        base = compass.heading()        # 지금 보는 쪽 = 앞 (0도)
        display.show(Image.YES)
    rel = (compass.heading() - base) % 360
    print("나침반", compass.heading(), "→ 출발 기준", rel)
    sleep(300)`,
            desc: '<b>A</b> 를 누르는 순간의 방위각을 <code>base</code> 로 기억하고, 그 뒤에는 나침반 값에서 <code>base</code> 를 뺀 값을 씁니다. <code>% 360</code> 은 음수가 되지 않게 0~359 로 맞춰 줍니다. 위치 추적기에서 <code>move()</code> 에 이 값을 넣으면 <b>출발할 때 본 쪽이 지도의 위쪽</b>이 됩니다.',
            hint: '방위각 슬라이더를 30 에 두고 <b>A</b> 를 누른 뒤, 슬라이더를 120 으로 옮겨 보세요. “출발 기준 90”이 나오면 성공입니다.',
            expect: '나침반 30 → 출발 기준 30\n(A 를 누름)\n나침반 30 → 출발 기준 0\n나침반 120 → 출발 기준 90',
            nondeterministic: true
          },
          { type: 'list', ordered: true, items: [
            '<b>붙이기</b>: 허리 또는 가슴에, 받침을 대고 화면이 위 · 로고가 앞을 향하게 수평으로 붙입니다.',
            '<b>보정</b>: 시험 장소에서 <code>compass.calibrate()</code> 를 먼저 합니다. 철제 사물함 · 스마트폰에서 떨어진 곳을 고릅니다.',
            '<b>출발</b>: 바닥에 테이프로 출발점과 사각형 모서리를 표시하고, 앞을 보고 서서 A(처음 방향 · 위치 맞추기)를 누릅니다.',
            '<b>걷기</b>: 평소 걸음으로 사각형을 돕니다. 모서리에서는 멈춰서 몸 전체를 돌립니다.',
            '<b>기록</b>: 도착하면 B 로 차이를 보고 기록표(표 6-5)에 적습니다. 같은 사람이 세 번 걷습니다.'
          ] },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제 보드는 USB 선 대신 <b>배터리 팩</b>으로 전원을 연결해야 자유롭게 걸을 수 있습니다. 콘솔을 볼 수 없으므로 LED 지도와 B 버튼 결과를 보며 시험하고, 기록을 남기려면 ch05 에서 배운 <code>log</code> 모듈을 함께 씁니다. 보드 뒷면 부품이 옷의 금속 단추 · 지퍼에 닿지 않게 합니다.' },
          { type: 'callout', kind: 'warn', title: '안전하게 시험하기', html: '걸으면서 <b>보드 화면만 보지 않습니다</b>. 짝이 옆에서 길을 봐 주고, 복도에서는 뛰지 않습니다. 계단에서는 시험하지 않습니다.' },
          { type: 'callout', kind: 'info', title: '다음 시간 생각하기', html: '우리 교실을 <b>위에서 내려다본 지도</b>로 그린다면 무엇을 꼭 그려 넣어야 할까요? 교실의 가로 · 세로 길이를 걸음으로 어림해 오고, 벽 · 문 · 책상처럼 지나갈 수 없는 곳을 표시한 간단한 그림을 그려 오세요.' }
        ],
        slides: [
          { layout: 'title', title: '움직임으로 위치 추적하기', subtitle: 'Chapter 06 · 걸음과 방향으로 위치 찾기', badge: '2교시', notes: '<p>1교시의 A 버튼 추적기를 다시 띄우고 “버튼을 누르지 않아도 걸으면 저절로 움직이게 하려면?”으로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 출발점과 다른 끝점', lead: '적어 온 원인을 모아 봅시다', bullets: ['걸음: 놓침 · 더 셈', '방향: 기울어짐 · 자석 · 덜 돎', '보폭: 돌 때 짧게 · 뛸 때 길게', '→ 오늘 하나씩 확인'], notes: '<p>칠판에 걸음 · 방향 · 보폭 세 칸을 그리고 학생들이 적어 온 원인을 분류합니다.</p><p>💬 “가장 자주 일어날 것 같은 원인은?” — 대부분 방향을 고릅니다. 오늘 tilt_heading 과 자석 토론으로 이어집니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '조립하기 — 반복문 한 바퀴', html: FIG_LOOP, caption: '걸음 → 방향 → 위치 → 보여 주기', notes: '<p>네 상자가 각각 어느 챕터에서 왔는지 학생들이 말하게 합니다 (ch03 · ch02 · 1교시 · 1교시).</p><p>💬 “걸음이 아닐 때는?” — 아무것도 안 함, 위치 그대로.</p><p>시간: 3분</p>' },
          { layout: 'two', title: '위치 추적기 — 바뀐 곳 두 군데', left: { title: '반복문', code: `while True:
    if is_step(smooth(strength())):
        h = compass.heading()
        x, y = move(x, y, h, STRIDE)
        steps += 1
        show_pos(x, y)
        print(steps, h, round(x), round(y))
    sleep(20)`, run: false }, right: { title: '1교시와 비교', bullets: ['A 버튼 → <code>is_step(...)</code>', '보폭 100 → 내 보폭 65', '본문 <b>예제 6-8</b> ▶ 실행', '조이스틱 위로 살짝 = 걷기'] }, notes: '<p>본문 예제 6-8 을 실행합니다. 준비된 함수가 길어 보여도 우리가 쓴 곳은 반복문뿐임을 강조합니다.</p><p>THRESHOLD 를 각 모둠 값으로 바꾸게 합니다.</p><p>조이스틱이 없으면 흔들기 제스처 + 방위각 슬라이더, 그래도 어려우면 예제 6-5 로 대신합니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '조이스틱 시험표', head: ['조작', '기대하는 변화'], rows: [['가운데', '그대로'], ['위로 살짝 (북)', 'y +65 씩'], ['옆으로 90° 돌기', '그대로'], ['위로 살짝 (동)', 'x +65 씩'], ['위로 끝까지', 'x 빠르게 · 보폭은 65']], lead: '미리 정한 기대와 비교하기', notes: '<p>모둠별로 표 순서대로 조작하며 체크합니다. 기대와 다른 줄이 있으면 손을 들게 합니다.</p><p>💬 “뛸 때 거리가 짧게 나오는 까닭은?” — STRIDE 가 걷기 보폭으로 고정 (ch05 토론과 연결).</p><p>💬 “돌기만 했는데 걸음이 찍혔다면?” — 회전 중 출렁임을 걸음으로 셈. 뒤 토론 주제입니다.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '보드가 기울면 방향이 틀어진다', html: FIG_TILT, caption: '수평일수록 믿을 수 있다', notes: '<p>실제 보드가 있으면 수평일 때와 기울였을 때 방위각을 비교해 보여 줍니다.</p><p>💬 “걸을 때 몸에 단 보드는 수평일까요?” — 계속 출렁이고 기울어짐.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '준비된 함수 tilt_heading()', code: `from microbit import *

TILT_LIMIT = 300
good_heading = 0

def tilt_heading():
    global good_heading
    x, y, z = accelerometer.get_values()
    if abs(x) > TILT_LIMIT or abs(y) > TILT_LIMIT:
        return good_heading              # 많이 기움 → 이전 값
    h = compass.heading()
    diff = (h - good_heading + 540) % 360 - 180
    good_heading = (good_heading + diff // 2) % 360
    return good_heading

while True:
    print(compass.heading(), tilt_heading())
    sleep(300)`, points: ['많이 기울면 이전 값 유지', '수평이면 절반씩 다가가기', 'diff 줄 = 359° ↔ 1° 처리'], notes: '<p>기울기 판을 크게 기울인 채 방위각 슬라이더를 움직여, 오른쪽 숫자가 멈추는 것을 보여 줍니다.</p><p>diff 줄은 셸 예제 6-9 로 “그냥 빼면 −358, 식을 쓰면 2” 만 확인합니다. 초등학생에게는 “북쪽을 넘어갈 때 튀지 않게 해 주는 줄”로 충분합니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '오차가 쌓이는 모습', html: FIG_DRIFT, caption: '한 번 틀어진 위치는 계속 쌓인다', notes: '<p>💬 “한 변에서만 방향이 틀어졌는데 왜 끝점까지 영향을 줄까요?” — 다음 걸음들이 틀어진 위치에서 시작하니까.</p><p>시간: 2분</p>' },
          { layout: 'table', title: '20m 걸은 뒤의 오차', head: ['오차', '1', '2', '5', '10'], rows: [['방향(도) → 옆으로', '35cm', '70cm', '<b>176cm</b>', '350cm'], ['보폭(cm) → 앞뒤로', '31cm', '62cm', '<b>155cm</b>', '310cm']], lead: '예제 6-11 로 직접 계산', notes: '<p>본문 예제 6-11 을 실행해 표의 숫자가 나오는지 확인합니다.</p><p>💬 “40m 를 걸으면?” — 약 두 배. 걸음 수만 바꿔 확인합니다.</p><p>💬 “5도 = 어느 정도?” — 시계 바늘 1분 정도의 작은 각도. 그래도 20m 뒤에는 2m 가까이.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '사각형을 계산으로 걸어 보기', code: `from microbit import *
import math

def move(x, y, heading, stride):
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)

def report(name, route):
    x, y = 0, 0
    for heading, steps in route:
        for i in range(steps):
            x, y = move(x, y, heading, 50)
    print(name, round(x), round(y))

report("완벽", [(90, 10), (0, 6), (270, 10), (180, 6)])
report("모두 5도", [(95, 10), (5, 6), (275, 10), (185, 6)])
report("한 변 20도", [(90, 10), (0, 6), (290, 10), (180, 6)])
report("2걸음 놓침", [(90, 10), (0, 6), (270, 8), (180, 6)])`, points: ['모두 같이 틀리면 → 끝점은 제자리!', '한 변만 틀리면 → 끝점 어긋남', '모서리 위치도 함께 기록'], notes: '<p>실행 전에 “모두 5도”의 끝점을 예측하게 합니다. 대부분 “어긋난다”고 답하지만 결과는 0, 0 입니다.</p><p>💬 “그럼 끝점이 맞으면 추적이 정확한 걸까요?” — 아니다. 사각형 전체가 돌아갔을 수 있다 → 모서리도 기록.</p><p>시간: 3분</p>' },
          { layout: 'two', title: '실습 — 가로 5m · 세로 3m 사각형', left: { title: '설정 (예제 6-13)', bullets: ['<code>CELL = 125</code> (5m = 4칸)', '<code>OX, OY = 0, 4</code> (왼쪽 아래)', '방향은 <code>tilt_heading()</code>', 'B = 출발점과의 차이'] }, right: { title: '순서', bullets: ['동 8걸음 → 북 5걸음', '서 8걸음 → 남 5걸음', 'B → 기록표(표 6-5)', '★★★ A = (0, 0) 되돌리기 (도전 6-14)'] }, notes: '<p>모둠별로 본문 예제 6-13 을 실행하고, 조이스틱으로 사각형을 세 번 걸어 기록표를 채웁니다. 한 번은 일부러 한 변에서 방향을 조금 틀어 걷게 합니다.</p><p>★ 학생: 예제 6-13 으로 한 바퀴 · 기록. ★★ 학생: 세 번 걷고 첫 모서리 좌표까지 기록. ★★★ 학생: 도전 6-14 처럼 A 버튼 되돌리기를 직접 더하기 (정답은 본문 도전 6-14).</p><p>조이스틱이 없으면 방위각 슬라이더 + 흔들기 제스처로 걷습니다.</p><p>시간: 10분</p>' },
          { layout: 'table', title: '토론 — 어떻게 알아챌까?', head: ['상황', '알아채기', '줄이기'], rows: [['옆걸음 · 뒷걸음', '흔들림 모양', '모드 버튼 · +90/+180'], ['제자리 회전', '방향만 빨리 바뀜', '도는 동안 걸음 안 셈'], ['자석 근처', 'field_strength 변화', '이전 방향 유지'], ['뛰기 · 계단', '케이던스 상승', '보폭 바꾸기']], notes: '<p>모둠마다 한 줄을 맡아 “어느 함수의 어느 줄을 고치면 될지”까지 말하게 합니다. 정답을 정하지 않고 아이디어를 모읍니다.</p><p>💬 “문 앞처럼 확실한 곳에서 위치를 바로잡으면?” — 쌓인 오차가 0 으로 돌아감. 도전 6-14 의 A 버튼이 바로 그 생각입니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '실제 보드 시험 계획', html: FIG_WEAR, caption: '허리 · 가슴 — 받침으로 수평 · 로고는 앞', notes: '<p>허리와 가슴의 장단점을 표 6-7 로 정리합니다. 모둠별로 어디에 붙일지 정하게 합니다.</p><p>처음 방향 맞추기: 예제 6-15 로 “A 를 누른 순간 보는 쪽 = 0°”를 시연합니다.</p><p>배터리 팩 · 보정 · 안전(화면만 보며 걷지 않기, 복도 뛰지 않기)을 짚습니다.</p><p>시간: 3분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['걸음 + 방향 + <code>move()</code> = 위치 추적기', '조이스틱 시험표로 기대와 비교', '<code>tilt_heading()</code>: 기울면 이전 방향', '작은 오차도 걸을수록 쌓임', '처음 방향 맞추기 · 보드는 수평으로'], notes: '<p>모둠별 기록표에서 가장 차이가 작았던 시도를 발표합니다.</p><p>다음 시간 “생각하기”: 우리 교실을 위에서 내려다본 지도로 그린다면 무엇을 꼭 넣어야 할까요? 교실 크기를 걸음으로 어림하고 간단한 그림을 그려 오기를 안내합니다.</p><p>시간: 1분</p>' }
        ]
      }
    ]
  });
})();
