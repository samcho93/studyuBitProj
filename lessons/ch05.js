/* Chapter 05. 보폭 계산과 러닝 데이터 시각화 */
(function () {
  /* ───────── 공통 파이썬 조각 (준비된 함수) ───────── */
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
  const PY_CADENCE = `def cadence_from(times):
    # 준비된 함수: 최근 걸음 시각(ms) 목록 -> 평균 케이던스(spm) (ch04)
    if len(times) < 2:
        return 0
    gap = (times[-1] - times[0]) / (len(times) - 1)
    if gap <= 0:
        return 0
    return int(60000 / gap)
`;
  const PY_BEAT = `next_beat = 0

def beat_due(bpm):
    # 준비된 함수: 지금 박자 소리를 낼 때이면 True (ch04)
    global next_beat
    now = running_time()
    if now < next_beat:
        return False
    gap = 60000 // bpm
    next_beat += gap
    if next_beat < now:
        next_beat = now + gap
    return True
`;
  const PY_STRIDE = `def stride_from_height(height, running=False):
    # 준비된 함수: 키(cm)로 보폭(cm)을 어림하기 (대략값)
    if running:
        return height * 60 // 100    # 달리기: 키의 약 60%
    return height * 41 // 100        # 걷기: 키의 약 41%
`;
  // 걸음 감지 준비물 한 묶음 (상수 + 준비된 함수 세 개)
  const PY_STEP_KIT = `THRESHOLD = 1150   # 기준선 (ch03 에서 정한 우리 모둠 값)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP;

  const PY_ICONS = `READY = Image("09000:09900:09990:09900:09000")   # 대기: A 를 누르면 시작
REC = Image("00000:09990:09990:09990:00000")     # 기록 중
`;

  // 예시 러닝 기록 (걷기 1분 → 뛰기 2분 → 걷기 1분, 10초마다 한 줄)
  const DATA_CAD = [108, 112, 114, 110, 113, 111, 150, 160, 164, 162, 166, 236, 163, 161, 165, 158, 162, 160, 130, 114, 112, 110, 113, 0];
  const DATA_STEPS = [18, 37, 56, 74, 93, 112, 137, 164, 191, 218, 246, 273, 300, 327, 355, 381, 408, 435, 457, 476, 495, 513, 532, 532];
  const DATA_DIST = [11.7, 24.1, 36.4, 48.1, 60.5, 72.8, 95.3, 119.6, 143.9, 168.2, 193.4, 217.7, 242, 266.3, 291.5, 314.9, 339.2, 363.5, 377.8, 390.1, 402.5, 414.2, 426.6, 426.6];
  const PY_DATA = `# 예시 러닝 기록: 10초마다 한 줄 (걷기 1분 → 뛰기 2분 → 걷기 1분)
CAD = [` + DATA_CAD.join(', ') + `]
STEPS = [` + DATA_STEPS.join(', ') + `]
DIST = [` + DATA_DIST.join(', ') + `]
`;

  // LED 아이콘 (25자리: 그림 도우미용)
  const L_READY = '0900009900099900990009000';
  const L_REC = '0000009990099900999000000';
  const L_REC2 = '0000909990099900999000000';
  const L_YES = '0000000009000909090009000';

  /* ───────── 그림 5-1. 보폭이란? — 10걸음 재서 나누기 ───────── */
  const FIG_STRIDE = (() => {
    let feet = '';
    for (let i = 0; i <= 10; i++) {
      const x = 90 + i * 66;
      const y = i % 2 ? 110 : 150;
      feet += `<ellipse cx="${x}" cy="${y}" rx="22" ry="11" fill="${i === 0 ? 'var(--muted)' : 'var(--accent)'}"/>
  <text x="${x}" y="${i % 2 ? 85 : 190}" text-anchor="middle" font-size="16" fill="var(--muted)">${i === 0 ? '출발' : i}</text>`;
    }
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c5sa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="40" y="40" font-size="24" font-weight="bold" fill="var(--fg)">보폭(stride) = 한 발을 디딘 곳에서 다음 발을 디딘 곳까지</text>
  ${feet}
  <path d="M90 230 L156 230" stroke="var(--danger)" stroke-width="4" marker-start="url(#c5sa)" marker-end="url(#c5sa)"/>
  <text x="123" y="262" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--danger)">보폭 1개</text>
  <path d="M90 300 L750 300" stroke="var(--fg)" stroke-width="3" marker-start="url(#c5sa)" marker-end="url(#c5sa)"/>
  <rect x="300" y="282" width="240" height="36" rx="8" fill="var(--warn)" opacity="0.25"/>
  <text x="420" y="308" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">줄자로 잰 거리 6.5m</text>
  <text x="420" y="350" text-anchor="middle" font-size="18" fill="var(--muted)">출발선의 발끝 → 10번째 걸음의 발끝</text>
  <rect x="820" y="90" width="420" height="250" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1030" y="135" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--accent)">보폭 = 거리 ÷ 걸음 수</text>
  <text x="850" y="190" font-size="21" fill="var(--fg)">650cm ÷ 10걸음</text>
  <text x="850" y="235" font-size="26" font-weight="bold" fill="var(--accent)">= 65cm</text>
  <text x="850" y="285" font-size="18" fill="var(--muted)">걸음 수가 많을수록 평균이라</text>
  <text x="850" y="312" font-size="18" fill="var(--muted)">한 걸음 실수가 덜 섞임</text>
</svg>`;
  })();

  /* ───────── 그림 5-2. 걸음 수 · 보폭 · 케이던스로 거리와 속도 구하기 ───────── */
  const FIG_CALC = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c5ca" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--muted)"/></marker></defs>
  <rect x="40" y="40" width="250" height="90" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="165" y="80" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">걸음 수</text>
  <text x="165" y="112" text-anchor="middle" font-size="18" fill="var(--muted)">ch03 만보기 · 1000걸음</text>
  <rect x="40" y="160" width="250" height="90" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="165" y="200" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--warn)">보폭</text>
  <text x="165" y="232" text-anchor="middle" font-size="18" fill="var(--muted)">오늘 실측 · 65cm</text>
  <rect x="40" y="280" width="250" height="90" rx="14" fill="var(--code-bg)" stroke="var(--ok)" stroke-width="3"/>
  <text x="165" y="320" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">케이던스</text>
  <text x="165" y="352" text-anchor="middle" font-size="18" fill="var(--muted)">ch04 · 120 spm</text>
  <path d="M290 85 L520 135" stroke="var(--muted)" stroke-width="3" marker-end="url(#c5ca)"/>
  <path d="M290 205 L520 150" stroke="var(--muted)" stroke-width="3" marker-end="url(#c5ca)"/>
  <path d="M290 205 L520 265" stroke="var(--muted)" stroke-width="3" marker-end="url(#c5ca)"/>
  <path d="M290 325 L520 285" stroke="var(--muted)" stroke-width="3" marker-end="url(#c5ca)"/>
  <rect x="530" y="80" width="700" height="110" rx="14" fill="none" stroke="var(--accent)" stroke-width="3"/>
  <text x="560" y="122" font-size="24" font-weight="bold" fill="var(--fg)">거리 = 걸음 수 × 보폭</text>
  <text x="560" y="166" font-size="21" fill="var(--fg)">1000걸음 × 0.65m = <tspan font-weight="bold" fill="var(--accent)">650m</tspan></text>
  <rect x="530" y="220" width="700" height="130" rx="14" fill="none" stroke="var(--ok)" stroke-width="3"/>
  <text x="560" y="262" font-size="24" font-weight="bold" fill="var(--fg)">속도 = 보폭 × 케이던스 (m/분)</text>
  <text x="560" y="304" font-size="21" fill="var(--fg)">0.65m × 120걸음/분 = <tspan font-weight="bold" fill="var(--ok)">78m/분</tspan></text>
  <text x="560" y="336" font-size="18" fill="var(--muted)">1분 동안 120번 × 한 번에 0.65m 씩 나아감</text>
</svg>`;

  /* ───────── 그림 5-3. log 모듈로 기록하기 ───────── */
  const FIG_LOG = (() => {
    const rows = [[1, 2, 0, 1.3], [2, 4, 118, 2.6], [3, 6, 120, 3.9], [4, 8, 119, 5.2]];
    let r = '';
    rows.forEach((row, i) => {
      row.forEach((v, j) => {
        r += `<text x="${700 + j * 130}" y="${206 + i * 38}" text-anchor="middle" font-size="20" fill="var(--fg)">${v}</text>`;
      });
      r += `<path d="M640 ${218 + i * 38} L1210 ${218 + i * 38}" stroke="var(--line)" stroke-width="1"/>`;
    });
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c5la" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)"/></marker></defs>
  ${MB_FIG.board({ x: 30, y: 70, scale: 0.55, leds: L_REC })}
  <rect x="300" y="60" width="300" height="70" rx="12" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="450" y="92" text-anchor="middle" font-size="19" font-family="monospace" fill="var(--fg)">log.set_labels(...)</text>
  <text x="450" y="118" text-anchor="middle" font-size="16" fill="var(--muted)">처음 한 번: 이름표 정하기</text>
  <rect x="300" y="170" width="300" height="90" rx="12" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="450" y="205" text-anchor="middle" font-size="19" font-family="monospace" fill="var(--fg)">log.add(...)</text>
  <text x="450" y="235" text-anchor="middle" font-size="16" fill="var(--muted)">1초마다: 한 줄 붙이기</text>
  <path d="M600 215 L630 215" stroke="var(--accent)" stroke-width="4" marker-end="url(#c5la)"/>
  <rect x="640" y="40" width="570" height="330" rx="12" fill="none" stroke="var(--fg)" stroke-width="2"/>
  <text x="925" y="72" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">기록 표 (📊 로그 탭 / 보드의 MY_DATA.HTM)</text>
  <rect x="640" y="140" width="570" height="40" fill="var(--accent)" opacity="0.18"/>
  ${['time', 'steps', 'cadence', 'distance'].map((h, j) => `<text x="${700 + j * 130}" y="167" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--accent)">${h}</text>`).join('')}
  <text x="925" y="120" text-anchor="middle" font-size="17" fill="var(--muted)">↓ 이름표 (set_labels)</text>
  ${r}
  <text x="925" y="360" text-anchor="middle" font-size="17" fill="var(--muted)">log.add 한 번 = 아래로 한 줄 · 전원을 꺼도 남아 있음</text>
  <text x="300" y="320" font-size="18" fill="var(--muted)">import log  ← 맨 위에 한 줄</text>
</svg>`;
  })();

  /* ───────── 그림 5-4. 저장 주기와 줄 수 ───────── */
  const FIG_GAP = (() => {
    const row = (y, label, gap, n, color, w) => {
      let ticks = '';
      for (let x = 330; x <= 330 + w; x += gap) ticks += `<path d="M${x} ${y - 18} L${x} ${y + 18}" stroke="${color}" stroke-width="3"/>`;
      return `<text x="40" y="${y + 8}" font-size="22" font-weight="bold" fill="${color}">${label}</text>
  <path d="M330 ${y} L${330 + w} ${y}" stroke="var(--line)" stroke-width="2"/>
  ${ticks}
  <text x="${360 + w}" y="${y + 8}" font-size="21" fill="var(--fg)">${n}</text>`;
    };
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="40" y="45" font-size="23" font-weight="bold" fill="var(--fg)">저장 주기에 따라 1시간 동안 쌓이는 줄 수</text>
  <text x="330" y="85" font-size="17" fill="var(--muted)">눈금 하나 = log.add 한 번 (그림은 줄여서 그림)</text>
  ${row(140, '0.1초마다', 7, '36000줄 — 금방 가득', 'var(--danger)', 560)}
  ${row(220, '1초마다', 28, '3600줄 — 이 강좌의 기본', 'var(--ok)', 560)}
  ${row(300, '10초마다', 140, '360줄 — 넉넉하지만 거침', 'var(--warn)', 560)}
  <text x="40" y="375" font-size="19" fill="var(--muted)">자주 저장할수록 그래프가 자세해지지만, 저장 공간이 빨리 찹니다 → 쓸모 있는 만큼만 자주</text>
</svg>`;
  })();

  /* ───────── LED 아이콘 그림 ───────── */
  const FIG_ICONS = `<div style="text-align:center">${MB_FIG.tile(L_READY, '대기 READY — A 를 누르면 시작')}${MB_FIG.tile(L_REC, '기록 중 REC')}${MB_FIG.tile(L_REC2, '기록 중 — 오른쪽 위 점이 1초마다 깜빡')}</div>`;

  /* ───────── 그림 5-5. 데이터를 꺼내는 두 가지 길 ───────── */
  const FIG_ROUTES = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c5ra" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="40" y="45" font-size="24" font-weight="bold" fill="var(--accent)">① 시뮬레이터</text>
  <rect x="40" y="70" width="250" height="100" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="165" y="112" text-anchor="middle" font-size="20" fill="var(--fg)">조이스틱으로</text>
  <text x="165" y="142" text-anchor="middle" font-size="20" fill="var(--fg)">가상 달리기</text>
  <path d="M290 120 L360 120" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <rect x="370" y="70" width="250" height="100" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="495" y="112" text-anchor="middle" font-size="20" fill="var(--fg)">📊 로그 탭</text>
  <text x="495" y="142" text-anchor="middle" font-size="18" fill="var(--muted)">표로 바로 확인</text>
  <path d="M620 120 L690 120" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <rect x="700" y="70" width="250" height="100" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="825" y="112" text-anchor="middle" font-size="20" fill="var(--fg)">⬇ CSV 내려받기</text>
  <text x="825" y="142" text-anchor="middle" font-size="18" fill="var(--muted)">microbit-log.csv</text>
  <text x="40" y="240" font-size="24" font-weight="bold" fill="var(--warn)">② 실제 보드</text>
  <rect x="40" y="265" width="250" height="110" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="165" y="305" text-anchor="middle" font-size="20" fill="var(--fg)">배터리 달고</text>
  <text x="165" y="335" text-anchor="middle" font-size="20" fill="var(--fg)">운동장 달리기</text>
  <text x="165" y="362" text-anchor="middle" font-size="16" fill="var(--muted)">기록은 보드 안에 저장</text>
  <path d="M290 320 L360 320" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <rect x="370" y="265" width="250" height="110" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="495" y="305" text-anchor="middle" font-size="20" fill="var(--fg)">USB 로 연결</text>
  <text x="495" y="335" text-anchor="middle" font-size="18" fill="var(--muted)">MICROBIT 드라이브의</text>
  <text x="495" y="362" text-anchor="middle" font-size="18" fill="var(--muted)">MY_DATA.HTM 열기</text>
  <path d="M620 320 L690 320" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <rect x="700" y="265" width="250" height="110" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="825" y="305" text-anchor="middle" font-size="20" fill="var(--fg)">웹 브라우저에서</text>
  <text x="825" y="335" text-anchor="middle" font-size="18" fill="var(--muted)">표 · 그래프 미리 보기</text>
  <text x="825" y="362" text-anchor="middle" font-size="18" fill="var(--muted)">· CSV 내려받기</text>
  <path d="M950 120 L1030 200" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <path d="M950 320 L1030 240" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5ra)"/>
  <rect x="1040" y="160" width="210" height="120" rx="14" fill="none" stroke="var(--ok)" stroke-width="4"/>
  <text x="1145" y="205" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--ok)">웹 시각화</text>
  <text x="1145" y="240" text-anchor="middle" font-size="18" fill="var(--fg)">그래프 · 요약 카드</text>
</svg>`;

  /* ───────── 그림 5-6. CSV 한 줄 = 표 한 줄 ───────── */
  const FIG_CSV = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c5va" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="40" y="45" font-size="23" font-weight="bold" fill="var(--fg)">CSV 파일 (글자)</text>
  <rect x="40" y="65" width="470" height="250" rx="12" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="65" y="110" font-size="22" font-family="monospace" font-weight="bold" fill="var(--accent)">time,steps,cadence,distance</text>
  <text x="65" y="155" font-size="22" font-family="monospace" fill="var(--fg)">10,18,108,11.7</text>
  <text x="65" y="195" font-size="22" font-family="monospace" fill="var(--fg)">20,37,112,24.1</text>
  <text x="65" y="235" font-size="22" font-family="monospace" fill="var(--fg)">30,56,114,36.4</text>
  <text x="65" y="285" font-size="18" fill="var(--muted)">첫 줄 = 이름표 · 쉼표(,)로 칸 나누기</text>
  <path d="M520 190 L640 190" stroke="var(--fg)" stroke-width="3" marker-end="url(#c5va)"/>
  <text x="580" y="175" text-anchor="middle" font-size="17" fill="var(--muted)">열면</text>
  <text x="660" y="45" font-size="23" font-weight="bold" fill="var(--fg)">표 (웹 · 스프레드시트)</text>
  <rect x="660" y="65" width="580" height="50" fill="var(--accent)" opacity="0.18"/>
  ${['time', 'steps', 'cadence', 'distance'].map((h, j) => `<text x="${730 + j * 145}" y="98" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--accent)">${h}</text>`).join('')}
  ${[[10, 18, 108, 11.7], [20, 37, 112, 24.1], [30, 56, 114, 36.4]].map((row, i) => row.map((v, j) => `<text x="${730 + j * 145}" y="${150 + i * 42}" text-anchor="middle" font-size="20" fill="var(--fg)">${v}</text>`).join('') + `<path d="M660 ${163 + i * 42} L1240 ${163 + i * 42}" stroke="var(--line)" stroke-width="1"/>`).join('')}
  <rect x="660" y="65" width="580" height="226" fill="none" stroke="var(--fg)" stroke-width="2"/>
  <text x="40" y="365" font-size="20" fill="var(--fg)">CSV = Comma-Separated Values (쉼표로 나눈 값) · 메모장 · 스프레드시트 · 웹 화면 어디서나 열 수 있는 가장 단순한 표</text>
</svg>`;

  /* ───────── 그림 5-7. 웹 시각화 화면 예시 (러닝 대시보드) ───────── */
  const FIG_DASH = (() => {
    const T = DATA_CAD.map((_, i) => (i + 1) * 10);
    const card = (x, label, value, unit, color) => `<rect x="${x}" y="20" width="232" height="100" rx="14" fill="var(--code-bg)" stroke="${color}" stroke-width="3"/>
  <text x="${x + 18}" y="52" font-size="18" fill="var(--muted)">${label}</text>
  <text x="${x + 18}" y="100" font-size="34" font-weight="bold" fill="${color}">${value}<tspan font-size="18" fill="var(--muted)"> ${unit}</tspan></text>`;
    // 왼쪽: 시간-케이던스 선그래프
    const L = { x: 80, y: 170, w: 520, h: 300 };
    const lx = (t) => Math.round(L.x + t * L.w / 240);
    const ly = (c) => Math.round(L.y + L.h - c * L.h / 250);
    let lgrid = '';
    [0, 50, 100, 150, 200, 250].forEach((v) => {
      lgrid += `<path d="M${L.x} ${ly(v)} L${L.x + L.w} ${ly(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L.x - 10}" y="${ly(v) + 6}" text-anchor="end" font-size="15" fill="var(--muted)">${v}</text>`;
    });
    [0, 60, 120, 180, 240].forEach((t) => {
      lgrid += `<text x="${lx(t)}" y="${L.y + L.h + 24}" text-anchor="middle" font-size="15" fill="var(--muted)">${t / 60}분</text>`;
    });
    const lpts = DATA_CAD.map((c, i) => `${lx(T[i])},${ly(c)}`).join(' ');
    const odd = DATA_CAD.indexOf(236);
    // 오른쪽: 누적 걸음 수
    const R = { x: 730, y: 170, w: 500, h: 300 };
    const rx = (t) => Math.round(R.x + t * R.w / 240);
    const ry = (s) => Math.round(R.y + R.h - s * R.h / 600);
    let rgrid = '';
    [0, 200, 400, 600].forEach((v) => {
      rgrid += `<path d="M${R.x} ${ry(v)} L${R.x + R.w} ${ry(v)}" stroke="var(--line)" stroke-width="1"/><text x="${R.x - 10}" y="${ry(v) + 6}" text-anchor="end" font-size="15" fill="var(--muted)">${v}</text>`;
    });
    [0, 60, 120, 180, 240].forEach((t) => {
      rgrid += `<text x="${rx(t)}" y="${R.y + R.h + 24}" text-anchor="middle" font-size="15" fill="var(--muted)">${t / 60}분</text>`;
    });
    const rpts = [`${rx(0)},${ry(0)}`].concat(DATA_STEPS.map((s, i) => `${rx(T[i])},${ry(s)}`)).join(' ');
    return `<svg viewBox="0 0 1280 520" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${card(20, '총 걸음', 532, '걸음', 'var(--accent)')}
  ${card(272, '거리', 426.6, 'm', 'var(--ok)')}
  ${card(524, '평균 케이던스', 141, 'spm', 'var(--warn)')}
  ${card(776, '평균 보폭', 80, 'cm', 'var(--accent2)')}
  ${card(1028, '평균 속도', 106, 'm/분', 'var(--danger)')}
  <rect x="${lx(60)}" y="${L.y}" width="${lx(180) - lx(60)}" height="${L.h}" fill="var(--danger)" opacity="0.08"/>
  <text x="${lx(30)}" y="${L.y + 22}" text-anchor="middle" font-size="16" fill="var(--ok)">걷기</text>
  <text x="${lx(120)}" y="${L.y + 22}" text-anchor="middle" font-size="16" fill="var(--danger)">뛰기</text>
  <text x="${lx(210)}" y="${L.y + 22}" text-anchor="middle" font-size="16" fill="var(--ok)">걷기</text>
  ${lgrid}
  <text x="${L.x}" y="${L.y - 12}" font-size="19" font-weight="bold" fill="var(--fg)">시간 – 케이던스 (spm)</text>
  <polyline points="${lpts}" fill="none" stroke="var(--warn)" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="${lx(T[odd])}" cy="${ly(236)}" r="13" fill="none" stroke="var(--danger)" stroke-width="3"/>
  <text x="${lx(T[odd]) + 20}" y="${ly(236) + 6}" font-size="16" font-weight="bold" fill="var(--danger)">튀는 값 236?</text>
  ${rgrid}
  <text x="${R.x}" y="${R.y - 12}" font-size="19" font-weight="bold" fill="var(--fg)">누적 걸음 수</text>
  <polyline points="${rpts}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"/>
  <text x="${rx(120) + 10}" y="${ry(273) - 16}" font-size="16" fill="var(--muted)">뛸 때 더 가파름</text>
</svg>`;
  })();

  /* ───────── 그림 5-8. 메트로놈을 켰을 때와 껐을 때 ───────── */
  const FIG_METRO = (() => {
    const off = [152, 168, 158, 174, 150, 166, 172, 155, 163, 149, 170, 158];
    const on = [158, 161, 160, 159, 160, 162, 160, 159, 161, 160, 160, 159];
    const panel = (x0, title, vals, color, note) => {
      const X = (i) => Math.round(x0 + 40 + i * 47);
      const Y = (v) => Math.round(330 - (v - 140) * 7);
      const pts = vals.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
      return `<text x="${x0 + 20}" y="50" font-size="22" font-weight="bold" fill="${color}">${title}</text>
  <rect x="${x0 + 40}" y="${Y(165)}" width="${X(11) - X(0)}" height="${Y(155) - Y(165)}" fill="var(--ok)" opacity="0.15"/>
  <path d="M${x0 + 40} ${Y(160)} L${X(11)} ${Y(160)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="${x0 + 30}" y="${Y(160) + 6}" text-anchor="end" font-size="15" fill="var(--muted)">160</text>
  <path d="M${x0 + 40} 340 L${X(11)} 340" stroke="var(--fg)" stroke-width="2"/>
  <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>
  <text x="${x0 + 20}" y="380" font-size="18" fill="var(--fg)">${note}</text>`;
    };
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${panel(20, '메트로놈 끔 (뛰기 2분)', off, 'var(--danger)', '149 ~ 174 사이를 오르내림 — 들쭉날쭉')}
  ${panel(660, '메트로놈 켬 · BPM 160', on, 'var(--ok)', '158 ~ 162 — 초록 띠(±5) 안에서 고름')}
  <text x="640" y="395" text-anchor="middle" font-size="15" fill="var(--muted)">설명을 위해 만든 예시 그래프입니다</text>
</svg>`;
  })();

  /* ───────── 본문 예제 코드 ───────── */
  const PY_RECORDER = `from microbit import *
import math
import log

` + PY_STEP_KIT + `
` + PY_CADENCE + `
STRIDE = 65        # 내 보폭 (cm) — 실측값으로 바꾸기
` + PY_ICONS + `
log.set_labels('time', 'steps', 'cadence', 'distance', timestamp=None)

recording = False
steps = 0
times = []
start = 0
next_save = 0
display.show(READY)

while True:
    now = running_time()
    if button_a.was_pressed() and not recording:    # A: 기록 시작
        recording = True
        steps = 0
        times = []
        start = now
        next_save = now + 1000
        display.show(REC)
    if button_b.was_pressed() and recording:        # B: 기록 정지
        recording = False
        display.show(READY)
    if is_step(smooth(strength())) and recording:
        steps += 1
        times.append(now)
        if len(times) > 5:
            times.pop(0)
    if recording and now >= next_save:              # 1초마다 저장
        next_save += 1000
        if times and now - times[-1] > 2000:
            times = []                              # 2초 동안 걸음 없음
        sec = (now - start) // 1000
        cadence = cadence_from(times)
        distance = round(steps * STRIDE / 100, 1)   # m
        log.add(time=sec, steps=steps, cadence=cadence, distance=distance)
        display.set_pixel(4, 0, 9 * (sec % 2))      # 깜빡이는 점
    sleep(20)`;

  const PY_RECORDER_SPEED = `from microbit import *
import math
import log

` + PY_STEP_KIT + `
` + PY_CADENCE + `
STRIDE = 65        # 내 보폭 (cm)
` + PY_ICONS + `
log.set_labels('time', 'steps', 'cadence', 'distance', 'speed', timestamp=None)

recording = False
steps = 0
times = []
start = 0
next_save = 0
display.show(READY)

while True:
    now = running_time()
    if button_a.was_pressed() and not recording:
        recording = True
        steps = 0
        times = []
        start = now
        next_save = now + 1000
        display.show(REC)
    if button_b.was_pressed() and recording:
        recording = False
        display.show(READY)
    if is_step(smooth(strength())) and recording:
        steps += 1
        times.append(now)
        if len(times) > 5:
            times.pop(0)
    if recording and now >= next_save:
        next_save += 1000
        if times and now - times[-1] > 2000:
            times = []
        sec = (now - start) // 1000
        cadence = cadence_from(times)
        distance = round(steps * STRIDE / 100, 1)
        speed = STRIDE * cadence // 100             # 속도 = 보폭 x 케이던스 (m/분)
        log.add(time=sec, steps=steps, cadence=cadence, distance=distance, speed=speed)
        display.set_pixel(4, 0, 9 * (sec % 2))
    sleep(20)`;

  const PY_SCENARIO = `from microbit import *
import math
import music
import log

` + PY_STEP_KIT + `
` + PY_CADENCE + `
` + PY_BEAT + `
WALK_STRIDE = 65   # 걷기 보폭 (cm)
RUN_STRIDE = 90    # 달리기 보폭 (cm)
BPM = 160          # 메트로놈 박자
` + PY_ICONS + `
log.set_labels('time', 'steps', 'cadence', 'distance', 'speed', 'beat', timestamp=None)

recording = False
metronome = False
logo_before = False
steps = 0
distance = 0       # cm
times = []
start = 0
next_save = 0
display.show(READY)

while True:
    now = running_time()
    if button_a.was_pressed() and not recording:
        recording = True
        steps = 0
        distance = 0
        times = []
        start = now
        next_save = now + 1000
        display.show(REC)
    if button_b.was_pressed() and recording:
        recording = False
        display.show(READY)
    touched = pin_logo.is_touched()                 # 로고: 메트로놈 켜기/끄기
    if touched and not logo_before:
        metronome = not metronome
    logo_before = touched
    if metronome and beat_due(BPM):
        music.pitch(1760, 30, wait=False)
    if is_step(smooth(strength())) and recording:
        steps += 1
        times.append(now)
        if len(times) > 5:
            times.pop(0)
        if cadence_from(times) >= 140:              # 뛰는 중이면 큰 보폭
            distance += RUN_STRIDE
        else:
            distance += WALK_STRIDE
    if recording and now >= next_save:
        next_save += 1000
        if times and now - times[-1] > 2000:
            times = []
        sec = (now - start) // 1000
        cadence = cadence_from(times)
        stride = RUN_STRIDE if cadence >= 140 else WALK_STRIDE
        speed = stride * cadence // 100
        log.add(time=sec, steps=steps, cadence=cadence,
                distance=round(distance / 100, 1), speed=speed,
                beat=1 if metronome else 0)
        display.set_pixel(4, 0, 9 * (sec % 2))
    sleep(20)`;

  MB_COURSE.addChapter({
    id: 'ch05', no: '05',
    title: '보폭 계산과 러닝 데이터 시각화',
    subtitle: '보폭(stride) · 거리 · 속도 · log 모듈 · CSV · 웹 그래프 · 러닝 리포트',
    summary: '줄자로 잰 <b>내 보폭</b>으로 걸음 수를 <b>거리</b>로, 케이던스를 <b>속도</b>로 바꿉니다. 그리고 <code>log</code> 모듈로 시간 · 걸음 수 · 케이던스 · 거리를 1초마다 보드에 저장하는 <b>러닝 기록기</b>를 만듭니다. 2교시에는 시뮬레이터의 📊 로그 탭과 실제 보드의 기록 파일에서 데이터를 <b>CSV</b> 로 꺼내, 웹 화면의 그래프와 요약 카드로 나의 달리기를 분석합니다. 보폭이 바뀌는 문제, 저장 공간, 튀는 값, 개인정보 문제도 미리 토론합니다.',
    goals: [
      '<b>보폭 = 걸은 거리 ÷ 걸음 수</b> 로 내 보폭을 실측하고, 준비된 함수 <code>stride_from_height()</code> 의 어림값과 비교할 수 있다',
      '<b>거리 = 걸음 수 × 보폭</b>, <b>속도 = 보폭 × 케이던스</b> 를 계산할 수 있다',
      '<code>log.set_labels()</code> · <code>log.add()</code> 로 러닝 기록을 1초마다 저장하고 📊 로그 탭에서 확인할 수 있다',
      'A 버튼 시작 · B 버튼 정지 · 기록 중 아이콘이 있는 <b>러닝 기록기</b>를 만들고 저장 주기를 정할 수 있다',
      '시뮬레이터와 실제 보드에서 기록을 <b>CSV</b> 로 꺼내고, 웹 화면의 그래프와 요약 카드를 읽을 수 있다',
      '그래프에서 빨라진 곳 · 느려진 곳 · 튀는 값을 찾고, 건강 데이터의 개인정보 문제를 토론할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch05-1',
        title: '보폭 · 거리 계산과 러닝 기록 저장',
        minutes: 50,
        goals: [
          '줄자로 잰 거리를 걸음 수로 나누어 <b>내 보폭</b>을 정하고, 키로 어림한 값과 비교할 수 있다',
          '걸음 수 · 보폭 · 케이던스로 <b>거리</b>와 <b>속도(m/분)</b>를 계산할 수 있다',
          '<code>import log</code> · <code>log.set_labels()</code> · <code>log.add()</code> 로 1초마다 기록을 저장하고 📊 로그 탭에서 표로 확인할 수 있다',
          'A 시작 · B 정지 러닝 기록기를 만들고, 보폭 변화 · 저장 주기 · 기록 지우기 문제를 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['내 보폭 정하기', 8], ['키로 어림하기', 5], ['거리 · 속도 계산', 8], ['log 로 기록하기', 8], ['러닝 기록기', 9], ['토론: 보폭 · 저장 주기', 5], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>내 한 걸음은 몇 cm 일까요?</b> 복도나 운동장에서 평소처럼 <b>10걸음</b>을 걷고, 출발선부터 마지막 발끝까지의 거리를 줄자로 재어 옵니다. 잰 거리를 10으로 나누면 한 걸음의 길이가 나옵니다. 가능하면 <b>뛰어서 10걸음</b>도 재어 와서 두 숫자를 비교해 보세요.' },
          { type: 'p', html: '모둠에서 재어 온 숫자를 모아 봅니다. 걸을 때는 대략 <b>50~70cm</b>, 뛸 때는 그보다 훨씬 긴 숫자가 나왔을 것입니다. 키가 큰 친구일수록 숫자가 크고, 같은 사람이라도 <b>뛸 때 한 걸음이 길어진다</b>는 것도 보입니다. 오늘은 이 숫자 하나로 걸음 수를 <b>거리</b>로 바꾸고, 달리는 동안의 기록을 보드에 <b>저장</b>합니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 오늘은 어디쯤?', html: '문제 정하기 → 잴 것 정하기 → 센서 읽기 → 계산하기 → <b>저장하기 → 보여 주기</b> → 고치기. ch03 에서 걸음 수를, ch04 에서 케이던스를 계산했으니, 오늘 1교시는 <b>거리 · 속도를 계산하고 저장하는</b> 단계, 2교시는 저장한 기록을 웹으로 <b>보여 주는</b> 단계입니다.' },

          { type: 'h', text: '보폭(stride) — 한 걸음의 길이' },
          { type: 'p', html: '<b>보폭(stride)</b>은 <b>한 발을 디딘 곳에서 다음 발을 디딘 곳까지의 길이</b>입니다. 이 강좌에서는 왼발 → 오른발, 오른발 → 왼발을 각각 한 걸음으로 세었으니(ch03), 보폭도 <b>한 번 디딜 때 나아가는 길이</b>로 정합니다.' },
          { type: 'p', html: '한 걸음만 재면 실수가 크게 섞입니다. 그래서 <b>여러 걸음을 걸은 거리를 재고 걸음 수로 나눕니다</b>. 그러면 평균이 되어 한 걸음 한 걸음의 들쭉날쭉함이 줄어듭니다. ch04 에서 걸음 간격을 평균 낸 것과 같은 생각입니다.' },
          { type: 'figure', html: FIG_STRIDE, caption: '그림 5-1. 보폭 = 걸은 거리 ÷ 걸음 수 (10걸음에 6.5m 이면 65cm)' },
          { type: 'list', ordered: true, items: [
            '바닥에 출발선을 긋고, 발끝을 출발선에 맞춰 섭니다.',
            '<b>평소 걸음</b>으로 10걸음을 걷고 멈춥니다. 일부러 크게 걷지 않습니다.',
            '출발선부터 <b>10번째 걸음의 발끝</b>까지를 줄자로 잽니다.',
            '거리(cm) ÷ 10 = 내 보폭. 두세 번 재서 평균을 내면 더 좋습니다.'
          ] },
          {
            type: 'code', title: '예제 5-1. 셸에서 보폭 · 거리 계산하기', repl: true, code: `650 / 10
my_stride = 65
1000 * my_stride / 100
1000 * my_stride // 100`,
            desc: '셸을 계산기처럼 씁니다. 10걸음에 650cm 이면 보폭은 65cm 입니다. 보폭을 변수 <code>my_stride</code> 에 넣어 두고 1000걸음을 걸었다면 몇 m 인지 구합니다. cm 를 m 로 바꾸려고 <b>100으로 나눕니다</b>. <code>//</code> 를 쓰면 소수점 아래를 버린 정수가 나옵니다.',
            expect: '>>> 650 / 10\n65.0\n>>> my_stride = 65\n>>> 1000 * my_stride / 100\n650.0\n>>> 1000 * my_stride // 100\n650'
          },

          { type: 'h', text: '준비된 함수 stride_from_height() — 키로 어림하기' },
          { type: 'p', html: '줄자가 없거나 친구의 보폭을 미리 짐작하고 싶을 때는 <b>키</b>로 대략 어림할 수 있습니다. 사람들의 걸음을 많이 재 보면 걸을 때 보폭은 <b>키의 40% 안팎</b>, 달릴 때는 그보다 훨씬 길다는 경향이 있습니다. 이 계산을 준비된 함수로 만들어 두었습니다.' },
          {
            type: 'code', title: '준비된 함수 stride_from_height(height, running)', run: false, code: PY_STRIDE,
            desc: '<b>넣는 것</b>: 키(cm), 달리는지 여부(<code>True</code>/<code>False</code>). <b>나오는 것</b>: 보폭(cm, 정수). 곱하는 숫자 41 · 60 은 대략의 값이라 사람마다 꽤 다를 수 있습니다. 그래서 이 값은 <b>실측하기 전의 첫 짐작</b>으로만 씁니다.'
          },
          {
            type: 'code', title: '예제 5-2. 키로 어림한 보폭과 실측 보폭 비교', code: `from microbit import *

` + PY_STRIDE + `
for h in [130, 150, 170]:
    print("키", h, "cm → 걷기", stride_from_height(h), "cm · 달리기", stride_from_height(h, True), "cm")

MY_HEIGHT = 150     # 내 키 (cm)
MY_STRIDE = 63      # 생각하기에서 실측한 보폭 (cm)
guess = stride_from_height(MY_HEIGHT)
print("어림", guess, "cm / 실측", MY_STRIDE, "cm / 차이", MY_STRIDE - guess, "cm")`,
            desc: '세 가지 키로 어림한 보폭을 먼저 보고, 아래에서 <b>내 키와 내 실측 보폭</b>을 넣어 차이를 봅니다. <code>running</code> 을 적지 않으면 <code>False</code>(걷기)로 계산됩니다.',
            hint: '<code>MY_HEIGHT</code> 와 <code>MY_STRIDE</code> 를 내 숫자로 바꿔 ▶ 실행해 보세요. 차이가 몇 cm 인가요?',
            expect: '키 130 cm → 걷기 53 cm · 달리기 78 cm\n키 150 cm → 걷기 61 cm · 달리기 90 cm\n키 170 cm → 걷기 69 cm · 달리기 102 cm\n어림 61 cm / 실측 63 cm / 차이 2 cm'
          },
          { type: 'callout', kind: 'warn', title: '어림값보다 실측값을 믿습니다', html: '키가 같아도 다리 길이 · 신발 · 걷는 습관에 따라 보폭은 달라집니다. 어림값과 실측값이 10cm 넘게 차이 나는 일도 흔합니다. 이 강좌의 기록기에는 <b>여러분이 직접 잰 보폭</b>을 넣습니다.' },

          { type: 'h', text: '거리와 속도 계산하기' },
          { type: 'p', html: '보폭을 알면 이미 만들어 둔 두 숫자 — <b>걸음 수</b>(ch03)와 <b>케이던스</b>(ch04) — 로 새 숫자 두 개를 얻습니다.' },
          { type: 'list', items: [
            '<b>거리 = 걸음 수 × 보폭</b> — 한 걸음에 0.65m 씩 1000번 나아가면 650m 입니다.',
            '<b>속도 = 보폭 × 케이던스</b> — 케이던스는 1분 동안의 걸음 수이므로, 1분 동안 0.65m 씩 120번 나아가면 <b>78m/분</b>입니다.'
          ] },
          { type: 'figure', html: FIG_CALC, caption: '그림 5-2. 걸음 수 · 보폭 · 케이던스 → 거리와 속도' },
          {
            type: 'code', title: '예제 5-3. 걸은 거리 알려 주기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
STRIDE = 65        # 내 보폭 (cm)
steps = 0

while True:
    if is_step(smooth(strength())):
        steps += 1
    if button_a.was_pressed():
        meters = steps * STRIDE // 100        # cm → m
        print(steps, "걸음 →", meters, "m")
        display.scroll(str(meters) + "m")
    if button_b.was_pressed():
        steps = 0
        display.show(Image.YES)
    sleep(20)`,
            desc: 'ch03 의 만보기에 보폭을 곱하는 줄만 더했습니다. 걸음은 계속 세다가 <b>A 버튼</b>을 누르면 지금까지 걸은 거리를 m 로 보여 주고, <b>B 버튼</b>을 누르면 0 부터 다시 셉니다.',
            hint: '<b>B</b> 를 누른 뒤 움직임 조이스틱으로 가상의 사람을 20걸음쯤 걷게 하고 <b>A</b> 를 눌러 보세요. 20걸음 × 0.65m ≈ 13m 가 나오나요?',
            expect: '20 걸음 → 13 m\n(LED 에 13m 가 흘러갑니다)',
            nondeterministic: true
          },
          { type: 'p', html: '속도는 숫자가 어떻게 바뀌는지 표로 보면 감이 잘 옵니다. 아래 예제는 보폭은 그대로 두고 케이던스만 바꿔 가며 속도와 <b>1km 를 가는 데 걸리는 시간</b>을 계산표로 찍습니다.' },
          {
            type: 'code', title: '예제 5-4. 케이던스별 속도 계산표', code: `from microbit import *

STRIDE = 65        # 보폭 (cm)

print("케이던스 | 속도(m/분) | 1km 시간(분)")
for cadence in [100, 120, 140, 160, 180]:
    speed = STRIDE * cadence // 100      # 보폭(m) x 케이던스
    minutes = 1000 // speed              # 1000m 를 가는 데 몇 분?
    print(cadence, "|", speed, "|", minutes)`,
            desc: '<code>STRIDE * cadence // 100</code> 은 “보폭(cm) × 케이던스 ÷ 100” 으로, 보폭을 m 로 바꿔 곱한 것과 같습니다. 1km 시간은 1000m 를 속도로 나눈 몫입니다.',
            hint: '<code>STRIDE</code> 를 뛸 때 보폭(예: 90)으로 바꿔 다시 실행해 보세요. 같은 케이던스인데 속도가 어떻게 바뀌나요?',
            expect: '케이던스 | 속도(m/분) | 1km 시간(분)\n100 | 65 | 15\n120 | 78 | 12\n140 | 91 | 10\n160 | 104 | 9\n180 | 117 | 8'
          },
          {
            type: 'table', caption: '표 5-1. 계산 연습 — 빈칸을 채워 보세요 (첫 줄은 예시)',
            head: ['걸음 수', '보폭', '케이던스', '거리', '속도'],
            rows: [
              ['1000걸음', '65cm', '120 spm', '650m', '78m/분'],
              ['2000걸음', '60cm', '110 spm', '(    )m', '(    )m/분'],
              ['1500걸음', '90cm', '160 spm', '(    )m', '(    )m/분'],
              ['(    )걸음', '50cm', '100 spm', '500m', '(    )m/분']
            ]
          },
          { type: 'callout', kind: 'more', title: 'm/분 을 km/h 로 바꾸려면', html: '1시간은 60분이므로 m/분 에 <b>60을 곱하면 m/h</b>, 다시 <b>1000으로 나누면 km/h</b> 입니다. 78m/분 × 60 ÷ 1000 ≈ 4.7km/h — 보통 걷는 빠르기입니다.' },

          { type: 'h', text: 'log 모듈로 기록 저장하기' },
          { type: 'p', html: '지금까지는 숫자를 LED 나 콘솔에 <b>보여 주기만</b> 했습니다. 하지만 운동장을 달리는 동안에는 화면을 볼 수 없고, 콘솔에 연결된 컴퓨터도 들고 뛸 수 없습니다. 그래서 숫자를 보드 안에 <b>저장</b>해 두었다가 나중에 꺼내 봅니다. micro:bit V2 에는 이를 위한 <b>log 모듈</b>이 있습니다.' },
          { type: 'list', items: [
            '<code>import log</code> — 기록 도구를 가져옵니다.',
            '<code>log.set_labels(\'time\', \'steps\', ...)</code> — 표의 <b>이름표(열 제목)</b>를 처음에 한 번 정합니다. <code>timestamp=None</code> 을 붙이면 보드가 자동으로 붙이는 시간 열을 빼고, 우리가 만든 <code>time</code> 열만 씁니다.',
            '<code>log.add(time=1, steps=2, ...)</code> — 표에 <b>한 줄</b>을 붙입니다. <code>이름표=값</code> 모양으로 적습니다.'
          ] },
          { type: 'figure', html: FIG_LOG, caption: '그림 5-3. set_labels 로 이름표를 정하고 add 로 한 줄씩 붙이기' },
          {
            type: 'code', title: '예제 5-5. log 맛보기 — 가짜 기록 10줄', code: `from microbit import *
import log

log.set_labels('time', 'steps', timestamp=None)

steps = 0
for sec in range(1, 11):
    steps += 2                      # 1초에 2걸음씩 걷는다고 가정
    log.add(time=sec, steps=steps)  # 표에 한 줄 붙이기
    display.show(sec % 10)
    sleep(1000)

display.show(Image.YES)
print("기록 끝! 로그 탭을 열어 보세요")`,
            desc: '센서 없이 숫자만 만들어 기록해 봅니다. 10초 동안 1초마다 한 줄씩, 모두 10줄이 쌓입니다. 실행이 끝나면 시뮬레이터의 <b>📊 로그</b> 탭을 열어 표를 확인합니다.',
            hint: '실행 후 시뮬레이터 위쪽의 <b>📊 로그</b> 탭을 눌러 보세요. 한 번 더 실행하면 줄이 어떻게 되나요?',
            expect: 'LED 에 1, 2, … 9, 0 이 1초 간격으로 보이고 체크 표시로 끝납니다.\n기록 끝! 로그 탭을 열어 보세요\n(📊 로그 탭: time 1~10, steps 2~20 의 10줄)'
          },
          { type: 'callout', kind: 'info', title: '기록은 쌓입니다', html: '예제를 다시 실행하면 앞의 기록 아래에 <b>이어서</b> 붙습니다. 처음부터 깨끗하게 보고 싶으면 📊 로그 탭의 <b>🗑 지우기</b>를 누르거나, 코드에서 <code>log.delete()</code> 를 부릅니다 (조금 뒤에 다룹니다).' },
          {
            type: 'code', title: '예제 5-6. 1초마다 걸음 수와 거리 기록하기', code: `from microbit import *
import math
import log

` + PY_STEP_KIT + `
STRIDE = 65        # 내 보폭 (cm)
log.set_labels('time', 'steps', 'distance', timestamp=None)

steps = 0
start = running_time()
next_save = start + 1000          # 다음에 저장할 시각

while True:
    if is_step(smooth(strength())):
        steps += 1
    now = running_time()
    if now >= next_save:          # 1초가 지났으면 저장
        next_save += 1000
        sec = (now - start) // 1000
        log.add(time=sec, steps=steps, distance=round(steps * STRIDE / 100, 1))
        print(sec, "초", steps, "걸음")
    sleep(20)`,
            desc: '이번에는 진짜 걸음을 셉니다. 걸음 감지는 0.02초마다 하고, 저장은 <b>1초마다</b> 합니다. <code>sleep(1000)</code> 으로 1초를 기다리면 그동안 걸음을 놓치기 때문에(ch04), <b>“다음에 저장할 시각”</b>을 정해 두고 그 시각이 지났는지만 확인합니다.',
            hint: '조이스틱으로 걷기 → 멈춤 → 뛰기를 해 본 뒤 ■ 중지하고 📊 로그 탭에서 걸음 수가 늘어나는 빠르기를 비교해 보세요.',
            expect: '1 초 2 걸음\n2 초 4 걸음\n3 초 6 걸음 …\n(📊 로그 탭에 time · steps · distance 가 1초에 한 줄씩)',
            nondeterministic: true
          },

          { type: 'h', text: '러닝 기록기 — A 로 시작, B 로 정지' },
          { type: 'p', html: '예제 5-6 은 켜자마자 기록을 시작해서, 준비하는 동안의 움직임까지 기록됩니다. 실제 러닝 앱처럼 <b>시작 · 정지 버튼</b>을 만들고, 지금 기록 중인지 LED 로 알 수 있게 합니다.' },
          { type: 'figure', html: FIG_ICONS, caption: '그림 5-4. 러닝 기록기의 LED 아이콘 — 대기 · 기록 중 · 깜빡이는 점' },
          { type: 'list', items: [
            '<b>A 버튼</b>: 걸음 수 · 시각을 0 으로 하고 기록 시작. 기록 중 아이콘이 보입니다.',
            '<b>B 버튼</b>: 기록 정지. 대기 아이콘으로 돌아갑니다.',
            '기록 중에는 <b>오른쪽 위 점이 1초마다 깜빡</b>여 “저장하고 있어요” 를 알려 줍니다.',
            '케이던스는 ch04 의 준비된 함수 <code>cadence_from(times)</code> 로 구하고, 2초 동안 걸음이 없으면 0 이 되게 합니다.'
          ] },
          {
            type: 'code', title: '예제 5-7. 러닝 기록기 — 시간 · 걸음 수 · 케이던스 · 거리', code: PY_RECORDER,
            desc: '앞에서 만든 조각을 모두 모은 러닝 기록기입니다. <code>recording</code> 이 <code>True</code> 일 때만 걸음을 세고 저장합니다. 걸음 감지 <code>is_step(...)</code> 은 기록 중이 아니어도 매번 불러야 걸음 감지의 상태가 어긋나지 않습니다 — 그래서 <code>and recording</code> 을 <b>뒤에</b> 적었습니다.',
            hint: '<b>A</b> 를 누르고 조이스틱으로 걷기 30초 → 뛰기 30초를 한 뒤 <b>B</b> 를 누르세요. 📊 로그 탭에서 cadence 가 언제 커졌는지 찾아봅니다.',
            expect: 'A: 기록 중 아이콘(네모) + 오른쪽 위 점이 1초마다 깜빡\nB: 대기 아이콘(오른쪽 화살표)\n📊 로그 탭: time · steps · cadence · distance 가 1초에 한 줄씩',
            nondeterministic: true
          },
          { type: 'callout', kind: 'tip', title: '시작 · 정지를 여러 번 하면', html: 'A 를 다시 누르면 걸음 수와 time 은 0 부터 다시 시작하지만, 기록 표는 <b>앞의 기록 아래에 이어</b> 붙습니다. 표에서 time 이 다시 1 로 돌아간 곳이 “새 달리기”의 시작입니다.' },
          {
            type: 'code', title: '도전 5-8. 속도도 함께 저장하기 (★★★)', code: PY_RECORDER_SPEED,
            desc: '예제 5-7 에 <code>speed</code> 열을 하나 더했습니다. 이름표에 <code>\'speed\'</code> 를 넣고, 저장할 때 <b>속도 = 보폭 × 케이던스</b> 를 계산해 함께 붙입니다. 바뀐 줄은 <code>set_labels</code> 와 <code>speed = ...</code>, <code>log.add(...)</code> 세 군데뿐입니다.',
            hint: '걷기와 뛰기로 기록한 뒤 📊 로그 탭의 speed 열을 비교하세요.',
            expect: '📊 로그 탭: time · steps · cadence · distance · speed\n예) 30 · 58 · 116 · 37.7 · 75',
            nondeterministic: true
          },

          { type: 'h', text: '토론 — 미리 생각해 볼 문제' },
          { type: 'p', html: '<b>문제 ① 달릴수록 보폭이 바뀝니다.</b> 생각하기에서 재어 본 것처럼 뛸 때는 한 걸음이 훨씬 깁니다. 그런데 기록기에는 보폭이 <code>STRIDE = 65</code> 하나뿐이라, 뛰는 동안의 거리가 <b>실제보다 짧게</b> 계산됩니다. 어떻게 하면 좋을까요?' },
          { type: 'list', items: [
            '생각 1: 걷기 보폭과 달리기 보폭을 <b>따로</b> 재어 두고, 케이던스가 크면(뛰는 중이면) 큰 보폭을 씁니다.',
            '생각 2: 운동장 한 바퀴처럼 <b>거리를 아는 길</b>을 달린 뒤, 거리 ÷ 걸음 수로 그날의 평균 보폭을 다시 구합니다.',
            '생각 3: 케이던스에 따라 보폭이 조금씩 길어지는 계산식을 만듭니다 (어렵지만 더 정확).'
          ] },
          {
            type: 'code', title: '응용 5-9. 걷기 · 달리기 보폭 따로 쓰기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_CADENCE + `
WALK_STRIDE = 65   # 걷기 보폭 (cm)
RUN_STRIDE = 90    # 달리기 보폭 (cm)
distance = 0       # cm
times = []

while True:
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        if cadence_from(times) >= 140:     # 뛰는 중
            distance += RUN_STRIDE
        else:
            distance += WALK_STRIDE
        print("거리", distance / 100, "m")
    sleep(20)`,
            desc: '생각 1 을 코드로 옮겼습니다. 걸음이 생길 때마다 지금 케이던스를 보고, 140 이상이면 달리기 보폭을, 아니면 걷기 보폭을 거리에 더합니다. 140 은 ch04 의 걷기 · 조깅 경계(130)와 달리기(160) 사이에서 정한 약속입니다.',
            hint: '조이스틱으로 걷다가 뛰게 하면서 거리가 늘어나는 폭이 0.65 에서 0.9 로 바뀌는지 보세요.',
            expect: '거리 0.65 m\n거리 1.3 m\n… (뛰기로 바꾸면)\n거리 12.1 m\n거리 13.0 m …',
            nondeterministic: true
          },
          { type: 'p', html: '<b>문제 ② 너무 자주 저장하면 저장 공간이 가득 찹니다.</b> 0.1초마다 저장하면 그래프는 자세해지지만, 1시간이면 36000줄이 쌓입니다. 반대로 10초마다 저장하면 빨라졌다 느려진 순간을 놓칩니다. 러닝 기록에는 <b>1초마다</b>가 알맞은 타협점입니다.' },
          { type: 'figure', html: FIG_GAP, caption: '그림 5-5. 저장 주기에 따라 1시간 동안 쌓이는 줄 수' },
          {
            type: 'code', title: '예제 5-10. 1시간 동안 몇 줄이 쌓일까?', repl: true, code: `60 * 60 // 1
60 * 60 * 10
60 * 60 // 10`,
            desc: '1시간은 3600초입니다. 1초마다 저장하면 3600줄, 0.1초마다(1초에 10번)면 36000줄, 10초마다면 360줄입니다.',
            expect: '>>> 60 * 60 // 1\n3600\n>>> 60 * 60 * 10\n36000\n>>> 60 * 60 // 10\n360'
          },
          {
            type: 'code', title: '예제 5-11. 저장 주기 정하기와 기록 지우기', code: `from microbit import *
import log

SAVE_GAP = 2000     # 저장 주기 (ms) — 1000, 5000 으로 바꿔 보기
log.set_labels('time', 'temp', timestamp=None)

start = running_time()
next_save = start
count = 0

while True:
    now = running_time()
    if now >= next_save:
        next_save += SAVE_GAP
        log.add(time=(now - start) // 1000, temp=temperature())
        count += 1
        print("저장", count, "줄")
    if pin_logo.is_touched():            # 로고: 기록 모두 지우기
        log.delete()
        count = 0
        display.show(Image.NO)
        sleep(500)
        display.clear()
        print("기록을 모두 지웠습니다")
    sleep(20)`,
            desc: '저장 주기를 <code>SAVE_GAP</code> 변수 하나로 정해 두면 숫자 하나만 바꿔 실험할 수 있습니다. 여기서는 걸음 대신 온도를 기록해 주기만 살펴봅니다. 금색 <b>로고</b>를 만지면 <code>log.delete()</code> 로 기록을 모두 지웁니다.',
            hint: '10초쯤 기다린 뒤 📊 로그 탭을 보고, 보드 그림의 금색 <b>로고</b>를 눌러 기록이 사라지는지 확인하세요.',
            expect: '저장 1 줄\n저장 2 줄\n저장 3 줄 …\n(로고를 누르면) 기록을 모두 지웠습니다',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제 micro:bit V2 에서 log 기록은 보드 안의 <b>MY_DATA.HTM</b> 파일에 저장되어, 전원을 꺼도 남아 있습니다. 저장 공간이 가득 차면 더 이상 기록할 수 없고 오류가 날 수 있으니, 달리기 전에 이전 기록을 꺼내 두고 지우는 습관을 들입니다. <code>log.delete()</code> 는 되돌릴 수 없으므로 <b>로고처럼 실수로 누르기 쉬운 곳</b>에 연결할 때는 조심합니다.' },
          { type: 'callout', kind: 'tip', title: '1교시 정리', html: '보폭 = 거리 ÷ 걸음 수 → 거리 = 걸음 수 × 보폭 → 속도 = 보폭 × 케이던스. 그리고 <code>log.set_labels()</code> 로 이름표를 정하고 <code>log.add()</code> 로 1초마다 한 줄씩 저장했습니다. 다음 교시에는 이 기록을 꺼내 <b>그래프</b>로 봅니다.' }
        ],
        slides: [
          { layout: 'title', title: '보폭 · 거리 계산과 러닝 기록 저장', subtitle: 'Chapter 05 · 보폭 계산과 러닝 데이터 시각화', badge: '1교시', notes: '<p>ch04 의 페이스 메이커를 떠올리게 합니다. “걸음 수와 케이던스는 알았는데, 그래서 몇 m 를 얼마나 빠르게 갔을까요?”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 내 한 걸음은 몇 cm?', lead: '재어 온 숫자를 모아 봅시다', bullets: ['10걸음 거리: ___ cm', '÷ 10 = 내 보폭 ___ cm', '뛰어서 10걸음: ___ cm', '→ 키 · 빠르기에 따라 달라짐'], notes: '<p>모둠별로 걷기 · 뛰기 보폭을 칠판 표에 적습니다. 재어 오지 못한 학생은 교실 뒤에서 바로 10걸음을 재게 합니다 (줄자 준비).</p><p>💬 “왜 한 걸음만 재지 않고 10걸음을 재서 나눌까요?” — 한 걸음은 실수가 크다, 평균을 내면 줄어든다.</p><p>💬 “뛸 때 보폭은 어떻게 되었나요?” — 길어진다. 오늘 토론의 실마리.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '보폭 = 거리 ÷ 걸음 수', html: FIG_STRIDE, caption: '10걸음에 6.5m → 65cm', notes: '<p>출발선의 발끝부터 10번째 걸음의 발끝까지 잰다는 점을 짚습니다. 첫 발은 출발선에 서 있는 발이라 세지 않습니다.</p><p>💬 “일부러 성큼성큼 걸으면?” — 평소 보폭이 아니므로 기록기가 틀린 거리를 냄.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '셸에서 계산해 보기', repl: true, code: `650 / 10
my_stride = 65
1000 * my_stride / 100
1000 * my_stride // 100`, points: ['cm → m : <code>÷ 100</code>', '<code>/</code> 소수 · <code>//</code> 정수', '내 보폭으로 바꿔 보기'], notes: '<p>한 줄씩 셸에서 실행합니다. 학생은 자기 보폭으로 바꿔 1000걸음의 거리를 구합니다.</p><p>💬 “만 보를 걸으면 몇 km 일까요?” — 보폭 65cm 면 6.5km.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '준비된 함수 stride_from_height()', code: `from microbit import *

def stride_from_height(height, running=False):
    # 키(cm)로 보폭(cm) 어림하기
    if running:
        return height * 60 // 100
    return height * 41 // 100

MY_HEIGHT = 150
MY_STRIDE = 63      # 실측
guess = stride_from_height(MY_HEIGHT)
print("어림", guess, "실측", MY_STRIDE)`, points: ['넣는 것: 키 · 달리기 여부', '나오는 것: 보폭(cm)', '첫 짐작용 — 실측이 더 정확'], notes: '<p>함수 안의 41 · 60 은 “대략 이렇다”는 경향일 뿐이라는 점을 강조합니다. 이 숫자를 외울 필요는 없습니다.</p><p>학생마다 자기 키와 실측 보폭을 넣어 차이를 말하게 합니다.</p><p>💬 “어림이 잘 맞지 않는 까닭은?” — 다리 길이 · 신발 · 습관 · 재는 실수.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '거리와 속도', html: FIG_CALC, caption: '거리 = 걸음 수 × 보폭 · 속도 = 보폭 × 케이던스', notes: '<p>속도 식이 어려운 학생에게는 “1분 동안 120번 디디고, 한 번에 0.65m 씩 간다”로 풀어 줍니다.</p><p>💬 “같은 케이던스인데 더 빨리 가려면?” — 보폭을 늘린다.</p><p>본문 예제 5-3 · 5-4 를 실행하게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '계산 표 연습', head: ['걸음 수', '보폭', '케이던스', '거리', '속도'], rows: [['1000', '65cm', '120', '650m', '78m/분'], ['2000', '60cm', '110', '', ''], ['1500', '90cm', '160', '', ''], ['', '50cm', '100', '500m', '']], lead: '빈칸을 채워 봅시다', notes: '<p>정답: 2000걸음 → 1200m · 66m/분 / 1500걸음 → 1350m · 144m/분 / 1000걸음 · 50m/분.</p><p>셸을 계산기로 써도 좋다고 안내합니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: 'log 맛보기', code: `from microbit import *
import log

log.set_labels('time', 'steps', timestamp=None)

steps = 0
for sec in range(1, 11):
    steps += 2
    log.add(time=sec, steps=steps)
    display.show(sec % 10)
    sleep(1000)

display.show(Image.YES)`, points: ['<code>set_labels</code> = 이름표 (한 번)', '<code>add</code> = 한 줄 붙이기', '📊 로그 탭에서 확인'], notes: '<p>▶ 실행 후 📊 로그 탭을 함께 엽니다. 다시 실행하면 줄이 이어 붙는다는 것을 보여 줍니다.</p><p><code>timestamp=None</code>: 보드가 자동으로 붙이는 시간 열을 빼는 옵션. 우리가 time 을 직접 기록하므로 뺍니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '보드 안에 표가 쌓인다', html: FIG_LOG, caption: 'log.add 한 번 = 한 줄', notes: '<p>💬 “왜 화면에 보여 주기만 하지 않고 저장할까요?” — 달리는 동안엔 화면도 컴퓨터도 볼 수 없다.</p><p>예제 5-6 에서 <code>sleep(1000)</code> 대신 “다음 저장 시각”을 쓰는 까닭(걸음을 놓치지 않으려고)을 ch04 와 연결합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: 'A 시작 · B 정지 · 기록 중 표시', html: FIG_ICONS, caption: '예제 5-7 러닝 기록기', notes: '<p>학생 화면에서 예제 5-7 을 실행하게 합니다. A → 조이스틱 걷기 30초 → 뛰기 30초 → B.</p><p>💬 “기록 중인지 왜 보여 줘야 할까요?” — 기록을 깜빡 안 켰는데 달리면 헛수고.</p><p><code>is_step(...) and recording</code> 순서의 까닭은 깊이 들어가지 않고 “걸음 감지는 늘 돌아가야 한다”고만 말합니다.</p><p>시간: 3분</p>' },
          { layout: 'practice', title: '실습 — 러닝 기록기', desc: '★ 예제 5-7 실행 · 📊 로그 탭 확인<br>★★ STRIDE 를 내 실측 보폭으로<br>★★★ 속도 열도 저장 (도전 5-8)', starter: `from microbit import *
import log

STRIDE = 65
log.set_labels('time', 'steps', 'distance', timestamp=None)
steps = 0
start = running_time()
next_save = start + 1000

while True:
    if accelerometer.was_gesture("shake"):   # 걸음 대신
        steps += 1
    # TODO: 1초마다 time · steps · distance 를 log.add 로 저장
    sleep(20)`, solution: `from microbit import *
import log

STRIDE = 65
log.set_labels('time', 'steps', 'distance', timestamp=None)
steps = 0
start = running_time()
next_save = start + 1000

while True:
    if accelerometer.was_gesture("shake"):   # 걸음 대신
        steps += 1
    now = running_time()
    if now >= next_save:
        next_save += 1000
        sec = (now - start) // 1000
        log.add(time=sec, steps=steps, distance=round(steps * STRIDE / 100, 1))
    sleep(20)`, notes: '<p>슬라이드 시작 코드는 걸음 대신 흔들기 제스처를 쓰는 짧은 뼈대입니다. 실제 실습은 본문 예제 5-7 · 도전 5-8 로 합니다.</p><p>★ 학생은 5-7 실행 → 로그 확인, ★★ 학생은 자기 보폭 넣기, ★★★ 학생은 속도 열 추가.</p><p>시간: 6분</p>' },
          { layout: 'bullets', title: '토론 — 미리 생각해 볼 문제', bullets: ['① 뛰면 보폭이 길어지는데 STRIDE 는 하나', ['걷기 · 달리기 보폭 따로 (응용 5-9)', '거리를 아는 길로 다시 재기'], '② 너무 자주 저장하면 공간이 가득', '③ 기록 지우기 <code>log.delete()</code> — 되돌릴 수 없음'], notes: '<p>💬 “뛰는 동안 거리가 짧게 나오는 까닭은?” — 걷기 보폭으로 계산하니까.</p><p>💬 “걷는지 뛰는지는 무엇으로 알 수 있나요?” — 케이던스(ch04).</p><p>💬 “기록 지우기 버튼은 어디에 두면 좋을까요?” — 실수로 누르기 어려운 곳, 또는 두 번 확인.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '저장 주기 정하기', html: FIG_GAP, caption: '자세함 ↔ 저장 공간 — 1초마다로 타협', notes: '<p>예제 5-10(셸)로 줄 수를 계산해 봅니다.</p><p>💬 “마라톤처럼 몇 시간 달린다면 주기를 어떻게?” — 5초나 10초로 늘린다.</p><p>시간: 2분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['보폭 = 거리 ÷ 걸음 수 (실측)', '거리 = 걸음 수 × 보폭', '속도 = 보폭 × 케이던스 (m/분)', '<code>log.set_labels</code> · <code>log.add</code> 로 1초마다 저장', 'A 시작 · B 정지 · 깜빡이는 점'], notes: '<p>모둠별로 기록기의 로그 표를 보여 주며 몇 줄이 쌓였는지 말하게 합니다.</p><p>다음 시간 “생각하기”: 러닝 앱 화면에는 어떤 그래프와 숫자가 나오나요? 가장 쓸모 있어 보이는 화면 하나를 골라 오기 를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch05-2',
        title: '웹으로 러닝 데이터 보기',
        minutes: 50,
        goals: [
          '시뮬레이터의 📊 로그 탭과 실제 보드의 기록 파일에서 데이터를 <b>CSV</b> 로 꺼낼 수 있다',
          'CSV 의 첫 줄은 이름표, 다음 줄부터 쉼표로 나눈 값임을 알고, <code>print</code> 로 직접 CSV 를 출력할 수 있다',
          '웹 시각화 화면의 선그래프 · 누적 걸음 수 · 요약 카드를 읽고, 빨라진 곳 · 느려진 곳 · 튀는 값을 찾을 수 있다',
          '걷기 → 뛰기 → 걷기 시나리오를 기록해 분석하고, 건강 데이터의 개인정보 문제를 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['데이터 꺼내는 두 길', 7], ['CSV 이해하기', 7], ['웹 화면 읽기', 8], ['그래프 해석하기', 6], ['움직임 시나리오 기록', 9], ['토론', 5], ['러닝 리포트 · 정리', 3]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '러닝 앱이나 스마트워치 운동 기록 화면에는 <b>어떤 그래프와 숫자</b>가 나오나요? 가족의 휴대폰을 빌리거나 인터넷 그림을 찾아보고, <b>가장 쓸모 있어 보이는 화면 하나</b>를 골라 오세요. 그 화면이 “무엇을 알려 주는지” 한 문장으로 적어 옵니다.' },
          { type: 'p', html: '골라 온 화면을 모아 보면 대개 비슷한 것들이 나옵니다. 맨 위에 <b>큰 숫자 몇 개</b>(거리 · 시간 · 평균 페이스)가 있고, 아래에 <b>시간에 따라 바뀌는 선그래프</b>(빠르기 · 심박 · 케이던스)가 있습니다. 큰 숫자는 “한눈에 결과”, 그래프는 “언제 어떻게 바뀌었나”를 알려 줍니다. 오늘은 1교시에 저장한 기록으로 이런 화면을 만들어 읽어 봅니다.' },

          { type: 'h', text: '데이터를 꺼내는 두 가지 길' },
          { type: 'p', html: '1교시의 러닝 기록기는 기록을 보드 안에 저장했습니다. 이 기록을 컴퓨터로 가져와야 그래프를 그릴 수 있습니다. 길은 두 가지입니다.' },
          { type: 'figure', html: FIG_ROUTES, caption: '그림 5-6. ① 시뮬레이터 📊 로그 탭의 CSV ② 실제 보드를 USB 로 연결해 기록 파일 열기' },
          { type: 'list', ordered: true, items: [
            '<b>① 시뮬레이터</b> — 조이스틱으로 가상의 사람을 달리게 해서 기록한 뒤, <b>📊 로그</b> 탭에서 표를 보고 <b>⬇ CSV 내려받기</b>를 누르면 <code>microbit-log.csv</code> 파일이 저장됩니다.',
            '<b>② 실제 보드</b> — 보드에 기록기를 올리고 배터리를 달아 직접 달립니다. 돌아와서 USB 로 컴퓨터에 연결하면 <b>MICROBIT</b> 드라이브가 보이고, 그 안의 <b>MY_DATA.HTM</b> 파일을 웹 브라우저로 열면 기록이 표로 보입니다. 이 화면에서 CSV 로 내려받거나 간단한 그래프 미리 보기를 볼 수 있습니다.'
          ] },
          { type: 'callout', kind: 'board', title: '실제 보드에서 기록 가져오기 순서', html: '① 🔌 보드로 러닝 기록기(예제 5-7)를 보드에 올립니다. ② USB 를 빼고 배터리 상자를 연결한 뒤, 보드를 허리나 발목에 단단히 고정합니다. ③ A 로 기록 시작 → 달리기 → B 로 정지. ④ 다시 USB 로 연결하고 파일 탐색기에서 <b>MICROBIT</b> 드라이브의 <b>MY_DATA.HTM</b> 을 Chrome · Edge 로 엽니다. ⑤ 표와 내려받기 버튼을 확인합니다. 화면의 버튼 이름은 보드 펌웨어에 따라 조금 다를 수 있습니다.' },
          { type: 'callout', kind: 'warn', title: '달리기 전에 꼭', html: '보드와 배터리를 <b>단단히</b> 고정하지 않으면 달리다 떨어져 다치거나 보드가 망가질 수 있습니다. 운동장에서는 앞을 보고 달리고, 달리는 중에 LED 를 들여다보지 않습니다.' },

          { type: 'h', text: 'CSV — 쉼표로 나눈 표' },
          { type: 'p', html: '내려받은 파일은 <b>CSV</b>(Comma-Separated Values, 쉼표로 나눈 값) 형식입니다. 메모장으로 열어 보면 그냥 글자인데, 규칙이 두 가지뿐입니다.' },
          { type: 'list', items: [
            '<b>첫 줄은 이름표</b>입니다. 1교시의 <code>log.set_labels()</code> 에 적은 이름이 그대로 나옵니다.',
            '<b>다음 줄부터는 값</b>입니다. 한 줄이 <code>log.add()</code> 한 번이고, 칸과 칸 사이는 <b>쉼표(,)</b>로 나눕니다.'
          ] },
          { type: 'figure', html: FIG_CSV, caption: '그림 5-7. CSV 의 글자 한 줄이 표의 한 줄이 됩니다' },
          { type: 'p', html: '규칙이 이렇게 단순하니 <b>print 로 직접 CSV 를 만들 수도</b> 있습니다. 첫 줄에 이름표를, 다음 줄부터 값을 쉼표로 이어 붙여 찍으면 콘솔 내용 그대로가 CSV 입니다. 실제 보드를 🔌 보드로 연결해 둔 채 기록할 때 쓸 수 있는 또 하나의 방법입니다.' },
          {
            type: 'code', title: '예제 5-12. print 로 CSV 직접 출력하기', code: `from microbit import *

` + PY_DATA + `
print("time,steps,cadence,distance")          # 첫 줄: 이름표
for i in range(6):
    t = (i + 1) * 10
    print(str(t) + "," + str(STEPS[i]) + "," + str(CAD[i]) + "," + str(DIST[i]))`,
            desc: '예시 러닝 기록(10초마다 한 줄)의 앞 6줄을 CSV 모양으로 찍습니다. 숫자를 <code>str()</code> 로 글자로 바꾸고 <code>","</code> 로 이어 붙였습니다. 콘솔에 나온 글자를 복사해 메모장에 붙이고 <code>.csv</code> 로 저장하면 그대로 표가 됩니다.',
            hint: '<code>range(6)</code> 을 <code>range(24)</code> 로 바꾸면 4분 기록 전체가 나옵니다.',
            expect: 'time,steps,cadence,distance\n10,18,108,11.7\n20,37,112,24.1\n30,56,114,36.4\n40,74,110,48.1\n50,93,113,60.5\n60,112,111,72.8'
          },
          {
            type: 'code', title: '예제 5-13. CSV 한 줄을 칸으로 나누기', repl: true, code: `line = "120,273,236,217.7"
parts = line.split(",")
parts
int(parts[2])`,
            desc: '웹 화면이 CSV 를 읽는 방법도 같습니다. 한 줄을 쉼표로 <b>쪼개면(split)</b> 칸별 글자 목록이 되고, 그 가운데 필요한 칸을 숫자로 바꿔 그래프에 씁니다. <code>parts[2]</code> 는 세 번째 칸, 곧 cadence 입니다.',
            expect: '>>> line = "120,273,236,217.7"\n>>> parts = line.split(",")\n>>> parts\n[\'120\', \'273\', \'236\', \'217.7\']\n>>> int(parts[2])\n236'
          },
          { type: 'callout', kind: 'more', title: '기록하면서 콘솔에도 보기 — log.set_mirroring()', html: '<code>log.set_mirroring(True)</code> 를 한 줄 넣으면 <code>log.add()</code> 한 기록이 저장과 함께 <b>콘솔(시리얼)</b>에도 찍힙니다. 실제 보드를 🔌 보드로 연결해 두고 기록이 잘 되는지 바로 확인할 때 편리합니다.' },

          { type: 'h', text: '웹 시각화 화면 읽기' },
          { type: 'p', html: 'CSV 를 웹 시각화 화면에 불러오면 러닝 앱과 비슷한 화면이 됩니다. 아래 그림은 <b>걷기 1분 → 뛰기 2분 → 걷기 1분</b>을 기록한 예시 데이터(10초마다 한 줄)를 웹 화면으로 그린 것입니다. 위에는 <b>요약 카드</b>, 아래에는 <b>그래프 두 개</b>가 있습니다.' },
          { type: 'figure', html: FIG_DASH, caption: '그림 5-8. 웹 시각화 화면 예시 — 요약 카드 · 시간-케이던스 선그래프 · 누적 걸음 수' },
          {
            type: 'table', caption: '표 5-2. 웹 화면의 각 부분이 알려 주는 것',
            head: ['화면 부분', '어떻게 계산했나', '알려 주는 것'],
            rows: [
              ['총 걸음', '마지막 줄의 steps', '얼마나 많이 움직였나'],
              ['거리', '마지막 줄의 distance', '얼마나 멀리 갔나'],
              ['평균 케이던스', '0 이 아닌 cadence 의 평균', '평소 발 디딤 박자'],
              ['평균 보폭', '거리 ÷ 총 걸음', '한 걸음에 평균 몇 cm'],
              ['평균 속도', '거리 ÷ 걸린 시간(분)', '1분에 평균 몇 m'],
              ['시간-케이던스 선그래프', '가로 time · 세로 cadence', '언제 빨라지고 느려졌나'],
              ['누적 걸음 수', '가로 time · 세로 steps', '기울기가 가파를수록 빠름']
            ]
          },
          { type: 'p', html: '요약 카드의 숫자는 표의 값만 있으면 직접 계산할 수 있습니다. 아래 예제는 웹 화면이 하는 계산을 파이썬으로 그대로 따라 합니다. 평균 케이던스를 낼 때 <b>0(멈춤)은 빼고</b> 계산한다는 점을 눈여겨봅니다.' },
          {
            type: 'code', title: '예제 5-14. 요약 카드 계산하기', code: `from microbit import *

` + PY_DATA + `
total = STEPS[-1]                        # 마지막 줄 = 총 걸음
meters = DIST[-1]                        # 마지막 줄 = 거리
moving = [c for c in CAD if c > 0]       # 멈춤(0)은 빼기
avg_cad = sum(moving) // len(moving)
avg_stride = int(meters * 100 / total)   # cm
minutes = len(CAD) * 10 / 60             # 10초마다 한 줄
speed = int(meters / minutes)

print("총 걸음", total, "걸음")
print("거리", meters, "m")
print("평균 케이던스", avg_cad, "spm")
print("평균 보폭", avg_stride, "cm")
print("평균 속도", speed, "m/분")`,
            desc: '<code>STEPS[-1]</code> 은 목록의 <b>마지막</b> 값입니다. 걸음 수와 거리는 계속 쌓이는(누적) 값이라 마지막 줄이 곧 합계입니다. <code>[c for c in CAD if c > 0]</code> 은 “CAD 에서 0 보다 큰 것만 모은 목록”이라는 뜻입니다.',
            expect: '총 걸음 532 걸음\n거리 426.6 m\n평균 케이던스 141 spm\n평균 보폭 80 cm\n평균 속도 106 m/분'
          },
          { type: 'callout', kind: 'info', title: '평균 보폭이 65 도 90 도 아닌 80cm 인 까닭', html: '예시 데이터는 응용 5-9 처럼 걷기 65cm · 달리기 90cm 를 나눠 거리를 계산했습니다. 4분 가운데 2분을 뛰었으니 평균 보폭은 그 사이 어딘가(80cm)가 됩니다. 보폭을 하나만 쓴 기록기라면 평균 보폭은 늘 그 숫자 그대로 나옵니다.' },

          { type: 'h', text: '그래프 해석하기' },
          { type: 'p', html: '그래프는 <b>모양</b>을 읽습니다. 시간-케이던스 선그래프에서 선이 <b>위로 올라간 곳은 빨라진 곳</b>, 내려간 곳은 느려진 곳입니다. 그림 5-8 에서는 1분쯤에 선이 110 근처에서 160 근처로 뛰어오르고(뛰기 시작), 3분쯤에 다시 내려옵니다(걷기). 마지막에 0 으로 떨어진 곳은 멈춘 곳입니다.' },
          { type: 'p', html: '누적 걸음 수 그래프는 늘 올라가기만 합니다. 대신 <b>기울기</b>를 봅니다. 같은 시간에 걸음이 더 많이 쌓이면 선이 가파르고, 그것이 곧 빠르다는 뜻입니다. 1~3분 사이가 가장 가파릅니다.' },
          {
            type: 'code', title: '예제 5-15. 콘솔에 막대그래프 그리기', code: `from microbit import *

` + PY_DATA + `
for i in range(len(CAD)):
    t = (i + 1) * 10
    bar = "#" * (CAD[i] // 10)           # 10 spm 마다 # 하나
    print(t, "초", bar, CAD[i])`,
            desc: '웹 화면이 없어도 그래프의 원리는 같습니다. 케이던스를 10 으로 나눈 만큼 <code>#</code> 을 찍으면 콘솔에 옆으로 누운 막대그래프가 생깁니다. 막대가 길어지는 곳이 빨라진 곳입니다.',
            hint: '콘솔을 보며 가장 긴 막대 하나를 찾아보세요. 정말 그렇게 빨리 달렸을까요?',
            expect: '10 초 ########## 108\n20 초 ########### 112\n…\n70 초 ############### 150\n80 초 ################ 160\n…\n120 초 ####################### 236\n…\n240 초  0'
          },
          { type: 'p', html: '<b>메트로놈을 켰을 때 케이던스가 고르게 되었는지</b>도 그래프로 확인할 수 있습니다. ch04 의 페이스 메이커처럼 목표 박자(BPM)를 들으며 달리면, 선이 목표 숫자 근처에서 <b>좁게</b> 오르내립니다. 메트로놈 없이 달리면 위아래 폭이 넓습니다.' },
          { type: 'figure', html: FIG_METRO, caption: '그림 5-9. 메트로놈을 껐을 때와 켰을 때의 케이던스 그래프 (예시)' },

          { type: 'h', text: '움직임 시뮬레이션 — 걷기 1분 → 뛰기 2분 → 걷기 1분' },
          { type: 'p', html: '이제 직접 기록을 만들어 봅니다. 시뮬레이터의 <b>움직임 조이스틱</b>으로 가상의 사람을 정해진 순서대로 움직이게 하고, 아래 기록기로 저장합니다. 이 기록기는 1교시의 기록기에 <b>걷기 · 달리기 보폭 나누기</b>(응용 5-9), <b>속도</b>(도전 5-8), 그리고 ch04 의 <b>메트로놈</b>을 더한 것입니다. 금색 로고를 만지면 메트로놈이 켜지고 꺼지며, 켜져 있는지는 <code>beat</code> 열(1/0)에 함께 저장됩니다.' },
          {
            type: 'table', caption: '표 5-3. 시나리오 — 조이스틱 조작 순서',
            head: ['시간', '조이스틱', '할 일'],
            rows: [
              ['시작', '가운데 (멈춤)', 'A 버튼 — 기록 시작'],
              ['0:00 ~ 1:00', '살짝 위 (걷기)', '편하게 걷기'],
              ['1:00 ~ 2:00', '끝까지 위 (뛰기)', '메트로놈 끈 채로 뛰기'],
              ['2:00 ~ 3:00', '끝까지 위 (뛰기)', '로고를 만져 메트로놈 켜고 뛰기'],
              ['3:00 ~ 4:00', '살짝 위 (걷기)', '로고로 메트로놈 끄고 걷기'],
              ['끝', '가운데 (멈춤)', 'B 버튼 — 기록 정지 · 📊 로그 탭 · CSV 내려받기']
            ]
          },
          {
            type: 'code', title: '예제 5-16. 시나리오 러닝 기록기 (속도 · 메트로놈 포함)', code: PY_SCENARIO,
            desc: '코드는 길지만 새로 배운 것은 없습니다. 위에서부터 <b>준비된 함수</b>(걸음 · 케이던스 · 박자) → <b>설정 숫자</b>(보폭 두 개 · BPM) → <b>버튼 · 로고</b> → <b>걸음마다 거리 더하기</b> → <b>1초마다 저장</b> 순서입니다. 저장하는 열은 time · steps · cadence · distance · speed · beat 여섯 개입니다.',
            hint: '표 5-3 순서대로 조이스틱을 움직이세요. 실제 4분이 길면 각 구간을 15초씩으로 줄여도 됩니다. 끝나면 📊 로그 탭에서 ⬇ CSV 내려받기를 누릅니다.',
            expect: '로고를 만지면 “틱” 소리가 0.375초마다 납니다 (BPM 160).\n📊 로그 탭 예) 75 · 152 · 158 · 123.4 · 142 · 0\n           150 · 351 · 161 · 302.9 · 144 · 1',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 운동장에서 해 볼 때', html: '같은 코드를 실제 보드에 올려 운동장을 달릴 수 있습니다. 메트로놈 소리는 보드의 작은 스피커에서 나므로 바람이 불거나 시끄러우면 잘 들리지 않을 수 있습니다(ch04 토론). 운동장 한 바퀴처럼 <b>거리를 아는 길</b>을 달리면, 웹 화면의 거리와 실제 거리를 비교해 내 보폭 설정이 맞는지도 확인할 수 있습니다.' },

          { type: 'h', text: '토론 — 튀는 값, 개인정보, 다음 단계' },
          { type: 'p', html: '<b>문제 ① 튀는 값(이상값, outlier).</b> 그림 5-8 의 2분쯤에 케이던스가 갑자기 <b>236</b> 으로 솟았다가 바로 160 으로 돌아옵니다. 사람이 1초 사이에 그렇게 빨라졌다 느려질 수는 없으니, 측정이 잘못된 값입니다. 왜 생길까요?' },
          { type: 'list', items: [
            '보드가 헐겁게 매달려 한 걸음에 두 번 흔들렸습니다 → 걸음 사이 간격이 짧게 재어짐.',
            '발을 헛디디거나 점프를 했습니다 → 봉우리가 짧은 시간에 두 번 생김.',
            '보드를 손으로 만지거나 고쳐 달았습니다 → 걸음이 아닌 흔들림.'
          ] },
          {
            type: 'code', title: '응용 5-17. 튀는 값 걸러 내기', code: `from microbit import *

` + PY_DATA + `
LIMIT = 220            # 사람이 내기 어려운 케이던스

clean = []
for c in CAD:
    if c > LIMIT and len(clean) > 0:
        print("튀는 값", c, "→", clean[-1], "로 바꿈")
        c = clean[-1]            # 바로 앞 값으로 바꾸기
    clean.append(c)

moving = [c for c in clean if c > 0]
print("고친 평균 케이던스", sum(moving) // len(moving), "spm")`,
            desc: '220 보다 큰 케이던스는 사람이 내기 어려운 값으로 보고, <b>바로 앞의 값</b>으로 바꿉니다. 그러면 평균 케이던스가 141 에서 138 로 바뀝니다. 값 하나가 평균을 얼마나 흔드는지 보입니다.',
            hint: '<code>LIMIT</code> 을 160 으로 낮추면 어떻게 될까요? 너무 낮게 잡으면 진짜 빠른 값까지 지워 버립니다.',
            expect: '튀는 값 236 → 166 로 바꿈\n고친 평균 케이던스 138 spm'
          },
          { type: 'callout', kind: 'warn', title: '건강 · 운동 데이터도 개인정보입니다', html: '걸음 수 · 달린 시간 · 빠르기 같은 기록에서도 <b>언제 어디서 운동하는지</b>, 몸 상태가 어떤지 짐작할 수 있습니다. 나중에 위치까지 함께 기록하면 집과 학교 사이의 길도 드러날 수 있습니다. 리포트를 친구와 나눌 때는 <b>이름 대신 별명</b>을 쓰고, 다른 사람의 기록은 허락 없이 퍼뜨리지 않습니다. 다 쓴 기록은 <code>log.delete()</code> 로 지우는 습관도 들입니다.' },
          { type: 'p', html: '<b>다음 단계 아이디어.</b> 지금 기록기는 걸음 · 케이던스 · 거리 · 속도를 기록합니다. 여기에 무엇을 더하면 좋을까요? 예를 들어 <b>심박 센서</b>를 핀에 연결해 심장 박동도 함께 기록하거나, <b>무선(radio)</b>으로 달리는 동안의 숫자를 다른 micro:bit 에 보내 코치가 실시간으로 보게 할 수 있습니다. 어떤 문제가 생길지(배터리 · 무선 거리 · 센서 고정)도 함께 이야기해 봅니다.' },
          {
            type: 'table', caption: '표 5-4. 나의 러닝 리포트 — 3줄 쓰기 예시',
            head: ['줄', '쓸 내용', '예시'],
            rows: [
              ['1', '한눈에 결과 (요약 카드)', '4분 동안 532걸음, 약 427m 를 움직였다.'],
              ['2', '그래프에서 찾은 변화', '1분쯤 뛰기 시작해 케이던스가 110 → 160 으로 올랐고, 메트로놈을 켠 뒤로 선이 고르게 되었다.'],
              ['3', '이상한 점 · 다음에 할 것', '2분쯤 236 이 튀었는데 보드가 헐거워서인 것 같다. 다음엔 밴드로 단단히 고정하겠다.']
            ]
          },
          { type: 'callout', kind: 'tip', title: '2교시 정리', html: '기록은 <b>📊 로그 탭의 CSV</b> 또는 <b>실제 보드의 MY_DATA.HTM</b> 으로 꺼냅니다. CSV 는 첫 줄 이름표 + 쉼표로 나눈 값입니다. 웹 화면에서는 요약 카드로 결과를, 선그래프로 변화를 읽고, 튀는 값은 원인을 찾아 걸러 냅니다. 다음 챕터부터는 걸음에 <b>방향</b>을 더해 “어디로 갔나”를 알아봅니다.' }
        ],
        slides: [
          { layout: 'title', title: '웹으로 러닝 데이터 보기', subtitle: 'Chapter 05 · 보폭 계산과 러닝 데이터 시각화', badge: '2교시', notes: '<p>1교시에 만든 기록기의 📊 로그 표를 다시 띄우고 “숫자만 가득한 표로는 내가 어떻게 달렸는지 한눈에 보이나요?”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 러닝 앱 화면', lead: '골라 온 화면을 소개해 봅시다', bullets: ['위: 큰 숫자 (거리 · 시간 · 페이스)', '아래: 시간에 따른 선그래프', '지도 · 구간 기록', '→ 한눈에 결과 + 언제 바뀌었나'], notes: '<p>두세 명이 골라 온 화면을 소개합니다. 칠판에 “숫자” · “그래프” 두 칸으로 나눠 적습니다.</p><p>💬 “숫자와 그래프는 각각 무엇을 알려 주나요?” — 숫자는 결과, 그래프는 변화.</p><p>지도는 다음 챕터들(실내 경로)에서 다룬다고만 말합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '데이터를 꺼내는 두 가지 길', html: FIG_ROUTES, caption: '① 📊 로그 탭 CSV ② 보드의 MY_DATA.HTM', notes: '<p>시뮬레이터에서 📊 로그 탭의 ⬇ CSV 내려받기를 직접 눌러 보여 줍니다.</p><p>실제 보드가 있으면 미리 기록해 둔 보드를 연결해 MY_DATA.HTM 을 열어 보여 줍니다. 버튼 이름은 펌웨어마다 조금 다를 수 있습니다.</p><p>시간: 3분</p>' },
          { layout: 'bullets', title: '실제 보드에서 가져오기', bullets: ['① 🔌 보드로 기록기 올리기', '② 배터리 · 단단히 고정', '③ A 시작 → 달리기 → B 정지', '④ USB 연결 → MICROBIT 드라이브', '⑤ MY_DATA.HTM 을 브라우저로'], notes: '<p>💬 “달리는 동안 USB 를 꽂고 있을 수 없는데, 기록은 어디에 있나요?” — 보드 안 저장 공간.</p><p>보드 고정 · 안전(앞 보고 달리기)을 꼭 짚습니다.</p><p>💬 “기록을 꺼내기 전에 무엇을 하면 안 될까요?” — 기록 지우기 · 다른 실험으로 기록 덮어 섞기.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: 'CSV — 쉼표로 나눈 표', html: FIG_CSV, caption: '첫 줄 이름표 · 한 줄 = log.add 한 번', notes: '<p>내려받은 CSV 를 메모장으로 열어 실제 글자를 보여 주면 좋습니다.</p><p>💬 “왜 이렇게 단순한 형식을 쓸까요?” — 어떤 프로그램에서도 열 수 있어서.</p><p>시간: 3분</p>' },
          { layout: 'code', title: 'print 로 CSV 만들기', code: `from microbit import *

CAD = [108, 112, 114, 110]
STEPS = [18, 37, 56, 74]

print("time,steps,cadence")
for i in range(4):
    t = (i + 1) * 10
    print(str(t) + "," + str(STEPS[i]) + "," + str(CAD[i]))`, points: ['첫 줄 = 이름표', '<code>str()</code> 로 글자 · <code>","</code> 로 잇기', '콘솔 복사 → .csv 저장'], notes: '<p>▶ 실행 후 콘솔 글자를 복사해 메모장에 붙여 보는 시범을 보입니다.</p><p>본문 예제 5-12 는 같은 방법으로 네 칸을 찍습니다.</p><p>시간: 2분</p>' },
          { layout: 'code', title: '한 줄을 칸으로 쪼개기', repl: true, code: `line = "120,273,236,217.7"
parts = line.split(",")
parts
int(parts[2])`, points: ['<code>split(",")</code> = 쉼표로 쪼개기', '<code>parts[2]</code> = 세 번째 칸', '웹 화면도 이렇게 읽음'], notes: '<p>셸에서 한 줄씩 실행합니다. 번호가 0 부터 시작한다는 것을 다시 짚습니다.</p><p>💬 “236 은 무엇일까요?” — cadence. 조금 뒤 ‘튀는 값’ 토론에서 다시 봅니다.</p><p>시간: 2분</p>' },
          { layout: 'diagram', title: '웹 시각화 화면 읽기', html: FIG_DASH, caption: '요약 카드 · 시간-케이던스 · 누적 걸음 수', notes: '<p>위의 카드부터 하나씩 읽고, 아래 그래프 두 개를 읽습니다.</p><p>💬 “언제 뛰기 시작했나요?” — 1분쯤. 💬 “누적 걸음 그래프에서 뛰는 구간은 어떻게 보이나요?” — 더 가파름.</p><p>💬 “이상한 곳은?” — 2분쯤 236. 토론에서 다룬다고 표시해 둡니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '요약 카드는 어떻게 계산할까?', head: ['카드', '계산'], rows: [['총 걸음', '마지막 steps'], ['거리', '마지막 distance'], ['평균 케이던스', '0 을 뺀 cadence 평균'], ['평균 보폭', '거리 ÷ 총 걸음'], ['평균 속도', '거리 ÷ 걸린 분']], lead: '예제 5-14 로 직접 계산', notes: '<p>학생 화면에서 예제 5-14 를 실행해 그림의 카드 숫자와 같은지 확인하게 합니다.</p><p>💬 “평균 케이던스에서 0 을 빼는 까닭은?” — 멈춘 시간은 걸음 박자가 아니니까. 빼지 않으면 평균이 낮아짐.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '그래프 해석 — 메트로놈 효과', html: FIG_METRO, caption: '켰을 때 선이 목표 근처에서 좁게', notes: '<p>선의 높이(빠르기)와 위아래 폭(고른 정도)을 나눠 읽게 합니다.</p><p>💬 “메트로놈을 켰을 때 폭이 좁아지는 까닭은?” — 박자에 발을 맞추니까 (ch04).</p><p>본문 예제 5-15 로 콘솔 막대그래프도 그려 보게 합니다. 가장 긴 막대(236)에 주목.</p><p>시간: 6분</p>' },
          { layout: 'table', title: '시나리오 — 조이스틱으로 연출', head: ['시간', '조이스틱', '할 일'], rows: [['시작', '멈춤', 'A — 기록 시작'], ['0~1분', '걷기', ''], ['1~2분', '뛰기', '메트로놈 끔'], ['2~3분', '뛰기', '로고 → 메트로놈 켬'], ['3~4분', '걷기', '로고 → 끔'], ['끝', '멈춤', 'B → CSV 내려받기']], lead: '예제 5-16 시나리오 러닝 기록기', notes: '<p>모둠별 역할: 조이스틱 담당 · 시간 재기 담당 · 로고 · 버튼 담당.</p><p>시간이 부족하면 구간마다 15초로 줄여도 됩니다.</p><p>기록이 끝나면 웹 화면(또는 MY_DATA.HTM 미리 보기 · 스프레드시트 그래프)에 CSV 를 불러와 그래프를 확인합니다. beat 열이 1 인 구간과 0 인 구간의 케이던스 폭을 비교하게 합니다.</p><p>시간: 9분</p>' },
          { layout: 'bullets', title: '토론 — 튀는 값 · 개인정보 · 다음 단계', bullets: ['튀는 값 236 은 왜 생겼을까?', ['헐거운 보드 · 점프 · 손으로 만짐', '걸러 내기: 응용 5-17'], '운동 기록도 개인정보 — 별명 · 허락 · 지우기', '다음: 심박 센서 · 무선으로 실시간 전송'], notes: '<p>💬 “236 을 그냥 지우면 될까요, 바꾸면 될까요?” — 앞 값으로 바꾸기, 빼고 평균 내기 등 여러 방법. 너무 많이 지우면 진짜 값까지 사라짐.</p><p>💬 “내 걸음 기록으로 남이 알 수 있는 것은?” — 운동 시간 · 습관 · 몸 상태, 위치가 더해지면 집 · 학교.</p><p>💬 “무엇을 더 재 보고 싶나요?” — 자유롭게.</p><p>시간: 5분</p>' },
          { layout: 'practice', title: '실습 — 나의 러닝 리포트 3줄', desc: '① 한눈에 결과 (요약 카드)<br>② 그래프에서 찾은 변화<br>③ 이상한 점 · 다음에 할 것', starter: `from microbit import *

CAD = [108, 112, 160, 164, 236, 162, 112, 0]
STEPS = [18, 37, 64, 91, 118, 145, 164, 164]
DIST = [11.7, 24.1, 48.4, 72.7, 97.0, 121.3, 133.7, 133.7]

total = STEPS[-1]
# TODO: 0 을 뺀 평균 케이던스, 평균 보폭(cm) 계산
print("총 걸음", total)`, solution: `from microbit import *

CAD = [108, 112, 160, 164, 236, 162, 112, 0]
STEPS = [18, 37, 64, 91, 118, 145, 164, 164]
DIST = [11.7, 24.1, 48.4, 72.7, 97.0, 121.3, 133.7, 133.7]

total = STEPS[-1]
moving = [c for c in CAD if c > 0]
avg_cad = sum(moving) // len(moving)
avg_stride = int(DIST[-1] * 100 / total)
print("총 걸음", total)
print("평균 케이던스", avg_cad)
print("평균 보폭", avg_stride, "cm")`, notes: '<p>시나리오 기록이 있는 모둠은 자기 CSV 로, 없는 모둠은 본문 예시 데이터(그림 5-8)로 리포트를 씁니다.</p><p>★ 표 5-4 의 예시를 따라 3줄 쓰기, ★★ 예제 5-14 로 자기 카드 숫자 계산, ★★★ 응용 5-17 로 튀는 값을 걸러 다시 계산.</p><p>시간: 2분 (나머지는 과제로)</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['꺼내기: 📊 로그 탭 CSV · 보드의 MY_DATA.HTM', 'CSV = 첫 줄 이름표 + 쉼표로 나눈 값', '요약 카드 = 결과 · 선그래프 = 변화', '튀는 값은 원인 찾고 걸러 내기', '운동 기록도 개인정보'], notes: '<p>두세 모둠이 리포트 1줄씩 발표합니다.</p><p>다음 시간 “생각하기”(ch06): 눈을 감고 교실 문까지 걸어가야 한다면, 무엇을 세고 무엇을 기억하며 걸을까요? 를 안내합니다.</p><p>시간: 1분</p>' }
        ]
      }
    ]
  });
})();
