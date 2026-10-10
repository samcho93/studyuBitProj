/* Chapter 04. 케이던스와 메트로놈 비트음 */
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
    # 준비된 함수: 최근 걸음 시각(ms) 목록 -> 평균 케이던스(spm)
    if len(times) < 2:
        return 0
    gap = (times[-1] - times[0]) / (len(times) - 1)   # 평균 간격
    if gap <= 0:
        return 0
    return int(60000 / gap)
`;
  const PY_BEAT = `next_beat = 0

def beat_due(bpm):
    # 준비된 함수: 지금 박자 소리를 낼 때이면 True
    global next_beat
    now = running_time()
    if now < next_beat:
        return False
    gap = 60000 // bpm
    next_beat += gap
    if next_beat < now:          # 너무 뒤처졌으면 지금부터 다시
        next_beat = now + gap
    return True
`;
  // 걸음 감지 준비물 한 묶음 (상수 + 준비된 함수 세 개)
  const PY_STEP_KIT = `THRESHOLD = 1150   # 기준선 (ch03 에서 정한 우리 모둠 값)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP;

  // LED 아이콘 (25자리: 그림 도우미용 / 콜론: 파이썬 Image 용)
  const L_WALK = '0090009990009000909009090';
  const L_JOG = '0090009990009000909090009';
  const L_RUN = '0099099900009090909090009';
  const L_UP = '0090009990909090090000900';
  const L_YES = '0000000009000909090009000';
  const L_DOWN = '0090000900909090999000900';
  const PY_ICONS = `WALK = Image("00900:09990:00900:09090:09090")   # 걷기
JOG = Image("00900:09990:00900:09090:90009")    # 조깅
RUN = Image("00990:99900:00909:09090:90009")    # 달리기
`;

  /* ───────── 그림 4-1. 케이던스와 움직임 구간 ───────── */
  const FIG_SPM = (() => {
    const X = (v) => Math.round(420 + (v - 60) * 800 / 140);
    const mark = (v, label, color) => `
  <path d="M${X(v)} 250 L${X(v)} 290" stroke="${color}" stroke-width="4"/>
  <text x="${X(v)}" y="320" text-anchor="middle" font-size="19" font-weight="bold" fill="${color}">${v}</text>
  <text x="${X(v)}" y="348" text-anchor="middle" font-size="18" fill="var(--muted)">${label}</text>`;
    let ticks = '';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ticks += `<path d="M${Math.round(180 + Math.sin(a) * 96)} ${Math.round(200 - Math.cos(a) * 96)} L${Math.round(180 + Math.sin(a) * 110)} ${Math.round(200 - Math.cos(a) * 110)}" stroke="var(--fg)" stroke-width="4"/>`;
    }
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <circle cx="180" cy="200" r="120" fill="none" stroke="var(--fg)" stroke-width="5"/>
  ${ticks}
  <path d="M180 200 L180 120" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/>
  <text x="180" y="240" text-anchor="middle" font-size="30" font-weight="bold" fill="var(--accent)">1분</text>
  <text x="180" y="360" text-anchor="middle" font-size="20" fill="var(--fg)">이 동안 발을 디딘 횟수</text>
  <text x="180" y="390" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--accent)">= 케이던스 (spm)</text>
  <text x="820" y="60" text-anchor="middle" font-size="25" font-weight="bold" fill="var(--fg)">케이던스로 보는 움직임 (대략)</text>
  <rect x="${X(60)}" y="150" width="${X(130) - X(60)}" height="80" fill="var(--ok)" opacity="0.25"/>
  <rect x="${X(130)}" y="150" width="${X(160) - X(130)}" height="80" fill="var(--warn)" opacity="0.3"/>
  <rect x="${X(160)}" y="150" width="${X(200) - X(160)}" height="80" fill="var(--danger)" opacity="0.25"/>
  <text x="${(X(60) + X(130)) / 2}" y="200" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--ok)">걷기</text>
  <text x="${(X(130) + X(160)) / 2}" y="200" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--warn)">조깅</text>
  <text x="${(X(160) + X(200)) / 2}" y="200" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--danger)">달리기</text>
  <path d="M${X(60)} 250 L${X(200)} 250" stroke="var(--fg)" stroke-width="3"/>
  ${mark(100, '천천히 걷기', 'var(--ok)')}
  ${mark(130, '', 'var(--muted)')}
  ${mark(160, '', 'var(--muted)')}
  ${mark(180, '빠른 달리기', 'var(--danger)')}
  <text x="${X(60)}" y="130" font-size="18" fill="var(--muted)">느림 ←</text>
  <text x="${X(200)}" y="130" text-anchor="end" font-size="18" fill="var(--muted)">→ 빠름</text>
  <text x="820" y="392" text-anchor="middle" font-size="18" fill="var(--muted)">구간을 나누는 130 · 160 은 이 강좌의 약속입니다 (사람마다 다를 수 있음)</text>
</svg>`;
  })();

  /* ───────── 그림 4-2. 케이던스를 구하는 두 가지 방법 ───────── */
  const FIG_TWO = (() => {
    let feet = '';
    for (let i = 0; i < 18; i++) {
      const x = Math.round(80 + (i + 0.5) * 660 / 18);
      feet += `<rect x="${x - 7}" y="${i % 2 ? 92 : 112}" width="14" height="22" rx="7" fill="var(--accent)"/>`;
    }
    return `<svg viewBox="0 0 1280 410" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c4ta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="40" y="40" font-size="24" font-weight="bold" fill="var(--accent)">방법 ① 정해진 시간 동안 세기</text>
  <path d="M80 150 L740 150" stroke="var(--line)" stroke-width="3"/>
  ${feet}
  <path d="M80 170 L740 170" stroke="var(--fg)" stroke-width="2" marker-start="url(#c4ta)" marker-end="url(#c4ta)"/>
  <text x="410" y="198" text-anchor="middle" font-size="20" fill="var(--fg)">10초 동안 18걸음</text>
  <rect x="790" y="60" width="450" height="140" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="815" y="102" font-size="24" font-weight="bold" fill="var(--accent)">18 × 6 = 108 spm</text>
  <text x="815" y="140" font-size="19" fill="var(--fg)">10초 × 6 = 60초 (1분) 이니까 × 6</text>
  <text x="815" y="176" font-size="19" fill="var(--muted)">쉽고 정확 · 하지만 10초를 기다려야 함</text>
  <text x="40" y="250" font-size="24" font-weight="bold" fill="var(--warn)">방법 ② 걸음 사이 간격으로 계산</text>
  <path d="M80 340 L740 340" stroke="var(--line)" stroke-width="3"/>
  <rect x="223" y="300" width="14" height="22" rx="7" fill="var(--warn)"/>
  <rect x="463" y="280" width="14" height="22" rx="7" fill="var(--warn)"/>
  <path d="M232 365 L468 365" stroke="var(--fg)" stroke-width="2" marker-start="url(#c4ta)" marker-end="url(#c4ta)"/>
  <text x="350" y="395" text-anchor="middle" font-size="20" fill="var(--fg)">간격 500ms</text>
  <rect x="790" y="250" width="450" height="140" rx="14" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="815" y="292" font-size="24" font-weight="bold" fill="var(--warn)">60000 ÷ 500 = 120 spm</text>
  <text x="815" y="330" font-size="19" fill="var(--fg)">1분 = 60000ms 안에 500ms 가 몇 번?</text>
  <text x="815" y="366" font-size="19" fill="var(--muted)">걸음마다 바로 · 하지만 값이 들쭉날쭉</text>
</svg>`;
  })();

  /* ───────── 그림 4-3. cadence_from(times) 가 하는 일 ───────── */
  const FIG_AVG = (() => {
    const t = [3000, 3520, 4010, 4530, 5020];
    const X = (v) => Math.round(110 + (v - 3000) * 0.31);
    let s = '';
    t.forEach((v, i) => {
      s += `<rect x="${X(v) - 50}" y="80" width="100" height="50" rx="10" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="${X(v)}" y="114" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--accent)">${v}</text>
  <path d="M${X(v)} 130 L${X(v)} 165" stroke="var(--accent)" stroke-width="3"/>
  <circle cx="${X(v)}" cy="175" r="9" fill="var(--accent)"/>`;
      if (i) s += `<text x="${(X(v) + X(t[i - 1])) / 2}" y="215" text-anchor="middle" font-size="19" fill="var(--muted)">${v - t[i - 1]}</text>`;
    });
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="40" y="45" font-size="23" font-weight="bold" fill="var(--fg)">times = 최근 걸음 5개의 시각 (running_time, ms)</text>
  <path d="M60 175 L800 175" stroke="var(--line)" stroke-width="3"/>
  ${s}
  <text x="430" y="250" text-anchor="middle" font-size="19" fill="var(--muted)">간격: 520 · 490 · 520 · 490 — 조금씩 다름</text>
  <rect x="60" y="280" width="760" height="100" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="85" y="320" font-size="21" fill="var(--fg)">평균 간격 = (5020 − 3000) ÷ 4 = <tspan font-weight="bold" fill="var(--accent)">505ms</tspan></text>
  <text x="85" y="360" font-size="21" fill="var(--fg)">케이던스 = 60000 ÷ 505 ≈ <tspan font-weight="bold" fill="var(--accent)">118 spm</tspan></text>
  <rect x="870" y="70" width="370" height="310" rx="14" fill="none" stroke="var(--accent)" stroke-width="3"/>
  <text x="1055" y="112" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--accent)">cadence_from(times)</text>
  <text x="895" y="160" font-size="20" fill="var(--fg)">넣는 것: 걸음 시각 목록</text>
  <text x="895" y="198" font-size="20" fill="var(--fg)">나오는 것: 케이던스 (정수)</text>
  <text x="895" y="250" font-size="19" fill="var(--muted)">걸음이 1개뿐이면 → 0</text>
  <text x="895" y="295" font-size="19" fill="var(--muted)">여러 간격을 평균 내므로</text>
  <text x="895" y="323" font-size="19" fill="var(--muted)">한 번 튀어도 크게 안 흔들림</text>
</svg>`;
  })();

  /* ───────── 그림 4-4. 멈췄는데 케이던스가 남아 있는 문제 ───────── */
  const FIG_STOP = (() => {
    let feet = '';
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * 55;
      feet += `<rect x="${x - 7}" y="${i % 2 ? 70 : 88}" width="14" height="22" rx="7" fill="var(--accent)"/>`;
    }
    const nums = (y, vals, color) => vals.map((v, i) => `<text x="${150 + i * 105}" y="${y}" text-anchor="middle" font-size="24" font-weight="bold" fill="${v[1] || color}">${v[0]}</text>`).join('');
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="610" y="50" width="560" height="80" fill="var(--line)" opacity="0.35"/>
  <text x="890" y="100" text-anchor="middle" font-size="22" fill="var(--muted)">멈춰 서 있음 (걸음 없음)</text>
  ${feet}
  <text x="350" y="40" text-anchor="middle" font-size="20" fill="var(--accent)">걷는 중</text>
  <path d="M80 140 L1180 140" stroke="var(--fg)" stroke-width="2"/>
  <text x="1180" y="165" text-anchor="end" font-size="18" fill="var(--muted)">시간 →</text>
  <text x="40" y="225" font-size="21" font-weight="bold" fill="var(--danger)">고치기 전</text>
  ${nums(265, [['120'], ['120'], ['120'], ['120'], ['120'], ['120'], ['120'], ['120'], ['120'], ['120']], 'var(--danger)')}
  <text x="890" y="300" text-anchor="middle" font-size="19" fill="var(--danger)">계속 120 — 멈췄는데도 걷고 있는 것처럼 보임</text>
  <text x="40" y="345" font-size="21" font-weight="bold" fill="var(--ok)">고친 뒤</text>
  ${nums(385, [['120'], ['120'], ['120'], ['120'], ['120'], ['120', 'var(--muted)'], ['0'], ['0'], ['0'], ['0']], 'var(--ok)')}
  <path d="M610 320 L610 395 M820 320 L820 395" stroke="var(--warn)" stroke-width="3" stroke-dasharray="6 5"/>
  <text x="715" y="335" text-anchor="middle" font-size="18" fill="var(--warn)">2초 기다림</text>
</svg>`;
  })();

  /* ───────── 그림 4-5. 비트 하나에 한 걸음 ───────── */
  const FIG_BPM = (() => {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const x = 110 + i * 90;
      s += `<circle cx="${x}" cy="110" r="16" fill="var(--danger)"/><text x="${x}" y="70" text-anchor="middle" font-size="18" fill="var(--danger)">틱</text>
  <path d="M${x} 130 L${x} 205" stroke="var(--line)" stroke-width="2" stroke-dasharray="5 5"/>
  <rect x="${x - 8}" y="${i % 2 ? 212 : 232}" width="16" height="26" rx="8" fill="var(--accent)"/>`;
    }
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c4ba" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--fg)"/></marker></defs>
  <text x="30" y="116" font-size="20" font-weight="bold" fill="var(--danger)">비트</text>
  <text x="30" y="246" font-size="20" font-weight="bold" fill="var(--accent)">발</text>
  ${s}
  <path d="M110 300 L200 300" stroke="var(--fg)" stroke-width="2" marker-start="url(#c4ba)" marker-end="url(#c4ba)"/>
  <text x="155" y="330" text-anchor="middle" font-size="19" fill="var(--fg)">박자 간격</text>
  <text x="440" y="380" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--fg)">비트 하나 = 한 걸음 → BPM 과 케이던스(spm)는 같은 단위</text>
  <rect x="860" y="40" width="380" height="280" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1050" y="80" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">박자 간격 = 60000 ÷ BPM</text>
  <text x="900" y="135" font-size="21" fill="var(--fg)">BPM 120 → 500ms</text>
  <text x="900" y="185" font-size="21" fill="var(--fg)">BPM 150 → 400ms</text>
  <text x="900" y="235" font-size="21" fill="var(--fg)">BPM 180 → 333ms</text>
  <text x="900" y="290" font-size="18" fill="var(--muted)">BPM 이 클수록 간격이 짧아짐</text>
</svg>`;
  })();

  /* ───────── 그림 4-6. sleep() 으로 기다리기 vs beat_due() 로 확인하기 ───────── */
  const FIG_SLEEP = (() => {
    let a = '', b = '';
    for (let i = 0; i < 3; i++) {
      const x = 160 + i * 250;
      a += `<circle cx="${x}" cy="110" r="13" fill="var(--danger)"/>
  <rect x="${x + 18}" y="92" width="220" height="36" rx="8" fill="var(--line)" opacity="0.6"/>
  <text x="${x + 128}" y="117" text-anchor="middle" font-size="17" fill="var(--muted)">sleep — 센서 못 읽음</text>`;
      b += `<circle cx="${x}" cy="290" r="13" fill="var(--danger)"/>`;
    }
    for (let x = 160; x < 900; x += 22) b += `<path d="M${x} 312 L${x} 326" stroke="var(--accent)" stroke-width="3"/>`;
    const peaks = [250, 515, 765];
    peaks.forEach((x) => {
      a += `<text x="${x}" y="170" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--danger)">✕</text>`;
      b += `<text x="${x}" y="360" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--ok)">✔</text>`;
    });
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="40" y="50" font-size="23" font-weight="bold" fill="var(--danger)">sleep() 으로 박자 맞추기</text>
  ${a}
  <text x="40" y="200" font-size="18" fill="var(--muted)">✕ = 자는 동안 지나간 걸음 → 놓침</text>
  <text x="40" y="240" font-size="23" font-weight="bold" fill="var(--ok)">beat_due() 로 “지금 소리 낼 때인가?” 확인하기</text>
  ${b}
  <text x="40" y="392" font-size="18" fill="var(--muted)">파란 눈금 = 0.02초마다 센서 읽기 + 박자 확인 → 걸음도 소리도 놓치지 않음</text>
  <circle cx="1000" cy="110" r="13" fill="var(--danger)"/><text x="1025" y="117" font-size="19" fill="var(--fg)">틱 소리</text>
  <text x="1000" y="170" font-size="24" font-weight="bold" fill="var(--ok)">✔</text><text x="1030" y="168" font-size="19" fill="var(--fg)">센 걸음</text>
</svg>`;
  })();

  /* ───────── LED 아이콘 그림 ───────── */
  const FIG_ICONS = `<div style="text-align:center">${MB_FIG.tile(L_WALK, '130 미만 · 걷기 WALK')}${MB_FIG.tile(L_JOG, '130~159 · 조깅 JOG')}${MB_FIG.tile(L_RUN, '160 이상 · 달리기 RUN')}</div>`;
  const FIG_PACE = `<div style="text-align:center">${MB_FIG.tile(L_UP, '느려요 → 더 빨리 (ARROW_N)')}${MB_FIG.tile(L_YES, '목표 ±5 안 → 좋아요 (YES)')}${MB_FIG.tile(L_DOWN, '빨라요 → 천천히 (ARROW_S)')}</div>`;

  MB_COURSE.addChapter({
    id: 'ch04', no: '04',
    title: '케이던스와 메트로놈 비트음',
    subtitle: '케이던스(spm) · cadence_from() · BPM · music.pitch() · beat_due() · 페이스 메이커',
    summary: '1분 동안 걸음 수인 <b>케이던스(cadence)</b>를 두 가지 방법으로 구하고, 준비된 함수 <code>cadence_from()</code> 으로 실시간 케이던스 측정기를 만듭니다. 2교시에는 목표 <b>BPM</b> 에 맞춰 “틱” 소리를 내는 메트로놈을 만들고, 측정한 케이던스와 비교해 화살표로 알려 주는 <b>러닝 페이스 메이커</b>를 완성합니다. 멈췄는데 값이 남는 문제, <code>sleep()</code> 때문에 걸음을 놓치는 문제, 야외에서 소리가 안 들리는 문제를 미리 토론합니다.',
    goals: [
      '케이던스가 <b>1분당 걸음 수(spm)</b>임을 알고, 걷기와 달리기의 케이던스 차이를 말할 수 있다',
      '“10초 걸음 수 × 6” 과 “60000 ÷ 걸음 간격” 두 방법을 비교하고, 준비된 함수 <code>cadence_from()</code> 으로 평균 케이던스를 구할 수 있다',
      '케이던스 구간에 따라 LED 에 걷기 · 조깅 · 달리기 아이콘을 보이고, 멈추면 0 이 되게 고칠 수 있다',
      'BPM 과 케이던스가 같은 단위임을 알고 <code>music.pitch()</code> 로 메트로놈 “틱” 소리를 낼 수 있다',
      '<code>sleep()</code> 대신 준비된 함수 <code>beat_due()</code> 를 써서 걸음을 세면서 박자 소리를 낼 수 있다',
      '측정 케이던스와 목표 BPM 을 비교해 화살표로 알려 주는 <b>러닝 페이스 메이커</b>를 만들고, 소리 · 배터리 · 주변 배려 문제를 토론할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch04-1',
        title: '케이던스 측정하기',
        minutes: 50,
        goals: [
          '케이던스(cadence)가 1분당 걸음 수(spm)임을 설명하고, 걷기 · 조깅 · 달리기의 차이를 말할 수 있다',
          '“10초 걸음 수 × 6” 과 “60000 ÷ 간격” 두 방법의 장단점을 그림으로 비교할 수 있다',
          '준비된 함수 <code>cadence_from(times)</code> 로 평균 케이던스를 구해 LED 에 숫자와 아이콘으로 보일 수 있다',
          '멈췄는데 케이던스가 남아 있는 문제를 찾고, 2초 동안 걸음이 없으면 0 으로 만드는 방법을 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['케이던스란?', 6], ['두 가지 측정 방법', 9], ['cadence_from()', 8], ['LED 숫자 · 아이콘', 8], ['움직임 시뮬레이션', 5], ['토론: 멈췄는데 남는 값', 5], ['실습 · 정리', 4]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>1분 동안</b> 걸을 때와 달릴 때, 각각 발을 몇 번 디딜까요? 친구와 짝을 지어 한 명은 걷거나 제자리에서 뛰고, 한 명은 시계를 보며 발이 땅에 닿는 횟수를 세어 옵니다. 1분을 다 세기 힘들면 <b>15초만 세고 4를 곱해도</b> 됩니다. 걷기 · 달리기 숫자를 적어 오세요.' },
          { type: 'p', html: '세어 온 숫자를 모둠에서 모아 봅니다. 걸을 때는 대략 <b>100번 안팎</b>, 달릴 때는 그보다 훨씬 많은 숫자가 나왔을 것입니다. 사람마다 숫자가 조금씩 다르지만, <b>빨리 움직일수록 숫자가 커진다</b>는 점은 같습니다. 오늘은 이 숫자를 micro:bit 가 대신 세도록 만듭니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 오늘은 어디쯤?', html: '<b>문제 정하기 → 잴 것 정하기 → 센서 읽기 → 계산하기</b> → 저장하기 → 보여 주기 → 고치기. ch03 에서 걸음을 세었으니, 오늘은 걸음에 <b>시간</b>을 더해 새 숫자를 <b>계산</b>하고 LED 로 <b>보여 주는</b> 단계입니다.' },

          { type: 'h', text: '케이던스(cadence) — 1분 동안 몇 걸음?' },
          { type: 'p', html: '<b>케이던스(cadence)</b>는 <b>1분 동안 디딘 걸음 수</b>입니다. 단위는 <b>spm</b>(steps per minute, 걸음/분)이라고 씁니다. “케이던스 120” 이라면 1분에 120걸음, 1초에 두 걸음을 디딘다는 뜻입니다.' },
          { type: 'p', html: '걸음 수가 “얼마나 많이 걸었나”를 알려 준다면, 케이던스는 “<b>얼마나 빠른 박자로</b> 걷고 있나”를 알려 줍니다. 천천히 걸으면 작고, 뛰면 커집니다. 그래서 러닝 앱은 케이던스를 보고 지금 걷는지 달리는지, 얼마나 리듬 있게 달리는지 알려 줍니다.' },
          { type: 'figure', html: FIG_SPM, caption: '그림 4-1. 케이던스(spm)와 움직임 구간 — 이 강좌의 약속' },
          {
            type: 'table', caption: '표 4-1. 이 강좌에서 쓰는 케이던스 구간 (대략)',
            head: ['구간', '케이던스', '느낌'],
            rows: [
              ['걷기', '130 미만', '편하게 이야기하며 걸을 수 있음'],
              ['조깅', '130 ~ 159', '가볍게 뛰기'],
              ['달리기', '160 이상', '발을 빠르게 굴러 달리기']
            ]
          },
          { type: 'callout', kind: 'warn', title: '구간 숫자는 약속일 뿐입니다', html: '130 · 160 은 수업에서 쓰려고 정한 숫자입니다. 키가 크거나 다리가 긴 사람은 같은 빠르기로 달려도 케이던스가 낮을 수 있습니다. 실습에서는 우리 모둠의 숫자에 맞게 바꿔 봅니다.' },

          { type: 'h', text: '케이던스를 구하는 두 가지 방법' },
          { type: 'p', html: '1분을 꼬박 기다려 걸음을 세면 가장 확실하지만, 너무 오래 걸립니다. 그래서 짧은 시간만 재고 계산으로 1분 값을 구합니다. 방법은 두 가지입니다.' },
          { type: 'list', ordered: true, items: [
            '<b>방법 ① 정해진 시간 동안 세기</b> — 10초 동안 걸음 수를 세고 <b>× 6</b> 을 합니다. 10초 × 6 = 60초(1분)이기 때문입니다.',
            '<b>방법 ② 걸음 사이 간격으로 계산</b> — 한 걸음과 다음 걸음 사이 시간(ms)을 재고 <b>60000 ÷ 간격</b> 을 합니다. 1분은 60000ms 이니, 그 안에 그 간격이 몇 번 들어가는지 세는 것입니다.'
          ] },
          { type: 'figure', html: FIG_TWO, caption: '그림 4-2. 방법 ① 10초 걸음 수 × 6 과 방법 ② 60000 ÷ 간격' },
          {
            type: 'code', title: '예제 4-1. 셸에서 두 방법 계산해 보기', repl: true, code: `18 * 6
60000 / 500
60000 / 350
60000 // 350`,
            desc: '셸을 계산기처럼 써 봅니다. 10초에 18걸음이면 108 spm, 간격이 500ms 이면 120 spm, 350ms 이면 약 171 spm 입니다. <code>/</code> 는 소수점까지, <code>//</code> 는 <b>몫(정수)</b>만 구합니다. LED 에 보일 때는 정수가 보기 좋습니다.',
            expect: '>>> 18 * 6\n108\n>>> 60000 / 500\n120.0\n>>> 60000 / 350\n171.42857142857142\n>>> 60000 // 350\n171'
          },
          {
            type: 'code', title: '예제 4-2. A 버튼으로 박자 두드려 케이던스 재기', code: `from microbit import *

last = running_time()

while True:
    if button_a.was_pressed():
        now = running_time()
        gap = now - last             # 지난번과의 간격 (ms)
        last = now
        print("간격", gap, "ms → 케이던스", 60000 // gap)
    sleep(10)`,
            desc: '걸음 대신 <b>A 버튼</b>을 일정한 박자로 눌러 봅니다. 누를 때마다 지난번과의 간격을 재서 방법 ② 로 케이던스를 계산합니다. 첫 번째 줄은 프로그램 시작부터 잰 간격이라 숫자가 엉뚱하니 무시합니다.',
            hint: '보드 그림의 <b>A 버튼</b>(키보드 A)을 “하나, 둘, 하나, 둘” 걷는 박자로 눌러 보고, 다음에는 뛰는 박자로 빠르게 눌러 보세요.',
            expect: '간격 3120 ms → 케이던스 19\n간격 512 ms → 케이던스 117\n간격 498 ms → 케이던스 120\n간격 361 ms → 케이던스 166 …',
            nondeterministic: true
          },
          { type: 'p', html: '버튼을 거의 같은 박자로 눌러도 간격이 498, 512, 505 … 처럼 <b>조금씩 다르게</b> 나옵니다. 걸음도 마찬가지입니다. 이 들쭉날쭉함을 어떻게 다룰지가 오늘의 중요한 고민입니다.' },
          {
            type: 'code', title: '예제 4-3. 방법 ① — 10초 동안 걸음 세어 × 6', code: `from microbit import *
import math

` + PY_STEP_KIT + `
display.show("A")

while True:
    if button_a.was_pressed():
        display.show(Image.SQUARE_SMALL)     # 재는 중
        steps = 0
        start = running_time()
        while running_time() - start < 10000:   # 10초 동안
            if is_step(smooth(strength())):
                steps += 1
            sleep(20)
        cadence = steps * 6
        print("10초 걸음", steps, "→ 케이던스", cadence, "spm")
        display.scroll(cadence)
        display.show("A")
    sleep(50)`,
            desc: 'ch03 의 준비된 함수(<code>strength</code> · <code>smooth</code> · <code>is_step</code>)를 그대로 가져왔습니다. <b>A 버튼</b>을 누르면 작은 네모가 보이는 10초 동안 걸음을 세고, 끝나면 <b>걸음 수 × 6</b> 을 LED 에 흘려 줍니다.',
            hint: '움직임 조이스틱으로 가상의 사람을 걷게 한 뒤 <b>A 버튼</b>을 누르고 10초 기다리세요. 다음에는 뛰게 해서 다시 재 봅니다.',
            expect: '10초 걸음 18 → 케이던스 108 spm\n10초 걸음 27 → 케이던스 162 spm',
            nondeterministic: true
          },
          {
            type: 'code', title: '예제 4-4. 방법 ② — 걸음마다 간격으로 케이던스', code: `from microbit import *
import math

` + PY_STEP_KIT + `
last = 0

while True:
    if is_step(smooth(strength())):
        now = running_time()
        gap = now - last             # 앞 걸음과의 간격
        last = now
        print("간격", gap, "ms → 케이던스", 60000 // gap)
    sleep(20)`,
            desc: '걸음이 감지될 때마다 바로 케이던스를 찍습니다. 10초를 기다리지 않아도 되지만, 숫자가 걸음마다 <b>위아래로 출렁입니다</b>.',
            hint: '조이스틱으로 일정하게 걷게 하고 콘솔 숫자가 얼마나 흔들리는지 보세요. 걷다가 뛰기로 바꾸면 숫자가 곧바로 커지는지도 확인합니다.',
            expect: '간격 2480 ms → 케이던스 24\n간격 530 ms → 케이던스 113\n간격 470 ms → 케이던스 127\n간격 545 ms → 케이던스 110 …',
            nondeterministic: true
          },
          {
            type: 'table', caption: '표 4-2. 두 방법 비교',
            head: ['', '방법 ① 10초 × 6', '방법 ② 60000 ÷ 간격'],
            rows: [
              ['계산', '아주 쉬움', '나눗셈 한 번'],
              ['결과가 나오는 때', '10초마다 한 번', '걸음마다 바로'],
              ['값의 흔들림', '적음', '큼 (걸음마다 출렁)'],
              ['빠르기가 바뀌면', '늦게 알아챔', '바로 알아챔'],
              ['값의 단위', '6 씩 커짐 (108, 114 …)', '아무 숫자나 가능']
            ]
          },

          { type: 'h', text: '준비된 함수 cadence_from(times) — 최근 걸음 몇 개로 평균 내기' },
          { type: 'p', html: '두 방법의 좋은 점만 모을 수 없을까요? 걸음마다 바로 계산하되(방법 ②), 한 걸음 간격만 보지 말고 <b>최근 걸음 몇 개의 간격을 평균</b> 내면 됩니다. ch03 의 <code>smooth()</code> 가 값을 평균 내서 부드럽게 만든 것과 같은 생각입니다.' },
          { type: 'p', html: '그래서 걸음이 생길 때마다 그 <b>시각</b>(<code>running_time()</code>)을 목록 <code>times</code> 에 적어 둡니다. 목록에는 최근 5개만 남깁니다. 그리고 준비된 함수 <code>cadence_from(times)</code> 에 목록을 넣으면 평균 케이던스가 나옵니다.' },
          { type: 'figure', html: FIG_AVG, caption: '그림 4-3. cadence_from(times) — 처음과 마지막 시각으로 평균 간격 구하기' },
          {
            type: 'code', title: '준비된 함수 cadence_from(times)', run: false, code: PY_CADENCE,
            desc: '맨 처음 시각과 맨 마지막 시각의 차이를 <b>간격 개수</b>(시각 개수 − 1)로 나누면 평균 간격입니다. 그다음은 방법 ② 와 같이 60000 ÷ 평균 간격. 걸음 시각이 1개뿐이면 간격을 알 수 없으니 0 을 돌려줍니다. 함수 속은 몰라도 괜찮고, <b>넣는 것 · 나오는 것</b>만 기억하면 됩니다.'
          },
          {
            type: 'code', title: '예제 4-5. 셸에서 cadence_from() 시험하기', repl: true, code: `def cadence_from(times):
    if len(times) < 2:
        return 0
    gap = (times[-1] - times[0]) / (len(times) - 1)
    if gap <= 0:
        return 0
    return int(60000 / gap)

cadence_from([3000, 3520, 4010, 4530, 5020])
cadence_from([0, 350, 700, 1050, 1400])
cadence_from([5000])`,
            desc: '그림 4-3 의 시각을 넣으면 118 이 나옵니다. 350ms 간격 다섯 걸음은 171, 걸음이 하나뿐이면 0 입니다. 목록 숫자를 직접 바꿔 넣어 보세요.',
            hint: '<code>def</code> 줄부터 <code>return int(...)</code> 까지 입력한 뒤 빈 줄에서 Enter 를 한 번 더 눌러야 함수가 완성됩니다.',
            expect: '>>> cadence_from([3000, 3520, 4010, 4530, 5020])\n118\n>>> cadence_from([0, 350, 700, 1050, 1400])\n171\n>>> cadence_from([5000])\n0'
          },
          {
            type: 'code', title: '예제 4-6. 최근 5걸음 평균으로 케이던스 찍기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_CADENCE + `
times = []          # 최근 걸음 시각 (ms)

while True:
    if is_step(smooth(strength())):
        times.append(running_time())    # 걸음 시각 적기
        if len(times) > 5:
            times.pop(0)                # 가장 오래된 것 버리기
        print("케이던스", cadence_from(times), "spm")
    sleep(20)`,
            desc: '걸음마다 시각을 적고, 5개가 넘으면 가장 오래된 시각을 버립니다. 예제 4-4 보다 숫자가 <b>훨씬 덜 출렁이고</b>, 빠르기가 바뀌면 몇 걸음 안에 따라갑니다.',
            hint: '예제 4-4 와 4-6 을 번갈아 실행하며 조이스틱으로 같은 빠르기로 걷게 해 보세요. 어느 쪽 숫자가 더 차분한가요?',
            expect: '케이던스 0 spm\n케이던스 24 spm\n케이던스 81 spm\n케이던스 112 spm\n케이던스 116 spm\n케이던스 118 spm …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '왜 5개일까요?', html: '목록에 남기는 개수를 늘리면 숫자가 더 차분해지지만, 걷다가 뛰기로 바꾸었을 때 <b>늦게</b> 따라갑니다. 줄이면 빨리 따라가지만 출렁입니다. <code>smooth()</code> 의 4개와 같은 고민입니다. 5 를 3 이나 10 으로 바꿔 비교해 보세요.' },
          { type: 'p', html: '처음 몇 걸음은 숫자가 낮게 나옵니다. 처음 <code>last_step</code> 이 0 이어서 첫 걸음까지의 긴 시간이 섞이기 때문입니다. 걸음이 5개 쌓이면 제대로 된 값이 나오니, <b>처음 몇 걸음은 “준비 운동”</b>이라고 생각하면 됩니다.' },

          { type: 'h', text: 'LED 에 케이던스 숫자와 움직임 아이콘 보이기' },
          { type: 'p', html: '콘솔은 컴퓨터에 연결했을 때만 볼 수 있습니다. 달리면서 보려면 LED 에 보여야 합니다. 두 가지를 보이겠습니다. <b>A 버튼</b>을 누르면 케이던스 숫자를 흘려 보이고, 평소에는 케이던스 구간에 맞는 <b>아이콘</b>을 보입니다.' },
          { type: 'figure', html: FIG_ICONS, caption: '그림 4-4. 케이던스 구간별 LED 아이콘' },
          {
            type: 'code', title: '예제 4-7. 실시간 케이던스 측정기 — 아이콘과 숫자', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_CADENCE + `
` + PY_ICONS + `
times = []
cadence = 0

while True:
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        cadence = cadence_from(times)
        if cadence >= 160:
            display.show(RUN)
        elif cadence >= 130:
            display.show(JOG)
        else:
            display.show(WALK)
    if button_a.was_pressed():
        display.scroll(cadence)          # 숫자로 보기
    sleep(20)`,
            desc: '걸음이 생길 때마다 케이던스를 새로 계산하고, <code>if</code> · <code>elif</code> · <code>else</code> 로 구간을 나눠 아이콘을 바꿉니다. 160 을 먼저 검사하는 까닭은, 170 은 “130 이상”이기도 하므로 <b>큰 쪽부터</b> 물어야 바르게 나뉘기 때문입니다.',
            hint: '조이스틱을 살짝 밀어 걷기 → 조금 더 밀어 조깅 → 끝까지 밀어 달리기로 바꾸며 아이콘이 바뀌는지 보세요. 중간에 <b>A 버튼</b>으로 숫자도 확인합니다.',
            expect: '걸을 때는 걷는 사람, 조금 빨라지면 다리를 벌린 사람, 빠르게 뛰면 팔다리를 크게 벌린 아이콘이 보입니다. A 를 누르면 “118” 처럼 케이던스가 흐릅니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'warn', title: '숫자가 흐르는 동안은 걸음을 못 셉니다', html: 'ch03 에서처럼 <code>display.scroll()</code> 은 글자가 다 흐를 때까지 기다립니다. 그동안 지나간 걸음은 놓치고, 다음 걸음의 간격이 길게 잡혀 케이던스가 잠깐 낮아집니다. 숫자는 가끔만 확인합니다.' },

          { type: 'h', text: '움직임 시뮬레이션 — 걷기에서 뛰기로' },
          { type: 'p', html: '예제 4-7 을 실행해 둔 채로 가상의 사람을 <b>천천히 걷기 → 빠르게 걷기 → 뛰기 → 다시 걷기</b> 순서로 움직여 봅니다. 빠르기를 바꾼 뒤 아이콘이 바뀌기까지 <b>몇 걸음</b>이 걸리는지 세어 보세요.' },
          {
            type: 'table', caption: '표 4-3. 움직임 시뮬레이션 기록표 (예시 값 — 직접 채워 보세요)',
            head: ['조이스틱', '케이던스 (A 버튼)', '아이콘', '바뀌기까지 걸음 수'],
            rows: [
              ['살짝 (천천히 걷기)', '104', '걷기', '—'],
              ['절반 (빠르게 걷기)', '', '', ''],
              ['끝까지 (뛰기)', '', '', ''],
              ['다시 살짝', '', '', '']
            ]
          },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '움직임 조이스틱 대신 <b>🧭 센서</b> 탭의 <b>흔들기(shake)</b> 버튼을 일정한 박자로 눌러도 걸음이 생깁니다. 천천히 누르면 걷기, 빠르게 누르면 뛰기입니다. 예제 4-2 처럼 박자를 일정하게 맞추는 연습이 됩니다.' },

          { type: 'h', text: '토론 — 멈췄는데 케이던스가 남아 있어요' },
          { type: 'p', html: '예제 4-7 에서 걷다가 조이스틱을 놓아 <b>멈춰</b> 봅니다. 그리고 <b>A 버튼</b>을 눌러 보세요. 멈춰 서 있는데도 케이던스가 118 처럼 <b>마지막 값 그대로</b> 남아 있고, 아이콘도 걷는 사람 그대로입니다.' },
          { type: 'figure', html: FIG_STOP, caption: '그림 4-5. 멈췄는데 값이 남는 문제와 2초 뒤 0 으로 만드는 방법' },
          { type: 'p', html: '까닭은 간단합니다. 우리 프로그램은 <b>걸음이 생길 때만</b> 케이던스를 새로 계산합니다. 멈추면 걸음이 생기지 않으니 계산도 하지 않고, 마지막 값이 계속 남습니다.' },
          { type: 'list', items: [
            '💬 실제 러닝 앱에서 신호등 앞에서 멈췄는데 케이던스가 계속 120 으로 보이면 어떤 문제가 생길까요?',
            '💬 “멈췄다”는 것을 micro:bit 는 어떻게 알 수 있을까요? (힌트: 마지막 걸음 시각 <code>times[-1]</code> 과 지금 시각)',
            '💬 몇 초 동안 걸음이 없으면 멈춘 것으로 볼까요? 너무 짧으면, 너무 길면 어떤 일이 생길까요?',
            '💬 다시 걷기 시작할 때 예전 걸음 시각이 목록에 남아 있으면 어떻게 될까요?'
          ] },
          { type: 'p', html: '토론에서 나온 생각을 정리하면 이렇습니다. 지금 시각에서 마지막 걸음 시각을 뺀 값이 <b>2000ms(2초)보다 크면</b> 멈춘 것으로 보고 케이던스를 0 으로 만듭니다. 그리고 목록도 비워서, 다시 걸을 때 예전 시각이 섞이지 않게 합니다.' },
          {
            type: 'code', title: '설명용 — 멈춤을 알아보는 조건', run: false, code: `if len(times) > 0 and running_time() - times[-1] > 2000:
    cadence = 0      # 2초 동안 걸음이 없으면 0
    times = []       # 예전 걸음 시각 지우기`,
            desc: '<code>len(times) > 0</code> 을 먼저 묻는 까닭은 목록이 비어 있으면 <code>times[-1]</code> 이 오류를 내기 때문입니다. <code>and</code> 는 앞 조건이 거짓이면 뒤 조건을 보지 않습니다.'
          },

          { type: 'h', text: '실습 — 실시간 케이던스 측정기 만들기' },
          { type: 'list', ordered: true, items: [
            '★ 예제 4-7 을 실행하고 표 4-3 을 채웁니다.',
            '★★ 구간 숫자 130 · 160 을 우리 모둠의 생각하기 기록(걷기 · 달리기 숫자)에 맞게 바꿔 봅니다.',
            '★★★ 2초 동안 걸음이 없으면 케이던스를 0 으로 만들고 LED 에 <b>0</b> 을 보이는 조건을 더합니다 (도전 4-8).'
          ] },
          {
            type: 'code', title: '도전 4-8. 멈추면 0 이 되는 케이던스 측정기 (★★★)', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_CADENCE + `
` + PY_ICONS + `
STOP_TIME = 2000    # 이만큼 걸음이 없으면 멈춘 것 (ms)
times = []
cadence = 0

while True:
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        cadence = cadence_from(times)
        if cadence >= 160:
            display.show(RUN)
        elif cadence >= 130:
            display.show(JOG)
        else:
            display.show(WALK)
    if len(times) > 0 and running_time() - times[-1] > STOP_TIME:
        cadence = 0
        times = []
        display.show("0")                # 멈춤
    if button_a.was_pressed():
        display.scroll(cadence)
    sleep(20)`,
            desc: '예제 4-7 에 멈춤 조건 세 줄을 더했습니다. 멈추고 2초가 지나면 LED 에 <b>0</b> 이 보이고, <b>A 버튼</b>을 눌러도 0 이 나옵니다. 다시 걸으면 목록이 비어 있으므로 몇 걸음 동안 “준비 운동”을 한 뒤 바른 값이 나옵니다.',
            hint: '조이스틱으로 걷다가 놓고 2초를 세어 보세요. <code>STOP_TIME</code> 을 1000, 5000 으로 바꾸면 어떤 차이가 있는지도 확인합니다.',
            expect: '걷는 동안 아이콘이 보이다가, 멈추고 약 2초 뒤 LED 에 0 이 보입니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '예제 4-7 이나 도전 4-8 을 <b>🔌 보드</b>로 올리고, 배터리 팩을 연결해 허리에 단단히 고정한 뒤 걸어 봅니다. 친구가 10초 동안 걸음을 세어 × 6 을 한 값과 <b>A 버튼</b>으로 본 값을 비교하면 우리 측정기가 얼마나 정확한지 알 수 있습니다. USB 케이블을 꽂은 채 걷지 않습니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: '케이던스 = 1분당 걸음 수(spm). 방법 ① 10초 걸음 × 6, 방법 ② 60000 ÷ 간격. 준비된 함수 <code>cadence_from(times)</code> 는 최근 걸음 시각으로 <b>평균</b> 케이던스를 구합니다. 걸음이 있을 때만 계산하므로, 멈춤은 “마지막 걸음 뒤 2초”로 따로 알아봅니다.' }
        ],
        slides: [
          { layout: 'title', title: '케이던스 측정하기', subtitle: 'Chapter 04 · 케이던스와 메트로놈 비트음', badge: '1교시', notes: '<p>ch03 에서 만든 만보기를 떠올리게 합니다. “걸음 수는 셀 수 있게 되었으니, 오늘은 <b>얼마나 빠르게</b> 걷는지를 숫자로 만듭니다.”</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 1분에 몇 걸음?', lead: '세어 온 숫자를 모아 봅시다', bullets: ['걷기: 약 ___ 걸음', '달리기: 약 ___ 걸음', '15초 × 4 로 세어도 OK', '→ 빠를수록 숫자가 커진다'], notes: '<p>모둠별 걷기 · 달리기 숫자를 칠판 표에 적습니다.</p><p>💬 “같은 걷기인데 왜 사람마다 숫자가 다를까요?” — 키 · 다리 길이 · 걷는 습관.</p><p>💬 “1분을 다 세지 않고 1분 값을 알 방법은?” — 짧게 세고 곱하기. 오늘 방법 ① 로 이어집니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '케이던스 = 1분당 걸음 수 (spm)', html: FIG_SPM, caption: '걷기 &lt; 130 · 조깅 130~159 · 달리기 160 이상', notes: '<p>spm = steps per minute. 케이던스 120 = 1초에 두 걸음.</p><p>130 · 160 은 수업용 약속임을 분명히 말합니다. 정확한 기준이 있는 것이 아닙니다.</p><p>💬 “우리 반 달리기 숫자는 어느 구간에 들어가나요?”</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '두 가지 방법', html: FIG_TWO, caption: '① 10초 × 6 · ② 60000 ÷ 간격', notes: '<p>방법 ①: 10초 × 6 = 60초. 방법 ②: 1분 = 60000ms 안에 간격이 몇 번 들어가나.</p><p>💬 “간격이 400ms 이면 케이던스는?” — 150.</p><p>💬 “간격이 1초(1000ms)이면?” — 60.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '버튼으로 박자 두드리기', code: `from microbit import *

last = running_time()

while True:
    if button_a.was_pressed():
        now = running_time()
        gap = now - last
        last = now
        print("간격", gap, "ms →", 60000 // gap)
    sleep(10)`, points: ['A 버튼 = 한 걸음', '<code>60000 // gap</code> = 방법 ②', '같은 박자인데 값이 조금씩 다름'], notes: '<p>▶ 실행 후 학생 한 명에게 걷는 박자 · 뛰는 박자로 A 를 눌러 보게 합니다.</p><p>첫 줄은 시작부터 잰 값이라 엉뚱하다는 것을 짚습니다.</p><p>💬 “같은 박자로 눌렀는데 왜 숫자가 다를까요?” — 사람은 완벽하게 일정하지 않음. 걸음도 그렇다.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '두 방법 비교', head: ['', '① 10초 × 6', '② 60000 ÷ 간격'], rows: [['결과', '10초마다', '걸음마다'], ['흔들림', '적음', '큼'], ['빠르기 변화', '늦게', '바로']], lead: '예제 4-3 · 4-4 를 실행해 비교', notes: '<p>학생 화면에서 예제 4-3, 4-4 를 차례로 실행하게 합니다.</p><p>💬 “달리면서 보는 시계라면 어느 쪽이 좋을까요?” — 바로 알려 주는 ② 가 좋지만 흔들림이 문제 → 다음 장의 평균으로 해결.</p><p>시간: 2분</p>' },
          { layout: 'diagram', title: '준비된 함수 cadence_from(times)', html: FIG_AVG, caption: '최근 5걸음 시각 → 평균 간격 → 케이던스', notes: '<p>“smooth() 처럼 평균을 낸다”로 연결합니다.</p><p>(마지막 − 처음) ÷ 간격 개수 = 평균 간격. 간격 개수는 시각 개수보다 하나 적다는 점을 손가락 사이 틈으로 보여 줍니다 (손가락 5개, 틈 4개).</p><p>시간: 4분</p>' },
          { layout: 'code', title: '걸음 시각 적기', code: `from microbit import *

def cadence_from(times):
    if len(times) < 2:
        return 0
    gap = (times[-1] - times[0]) / (len(times) - 1)
    return int(60000 / gap)

times = []
while True:
    if accelerometer.was_gesture("shake"):   # 걸음 대신
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        print(cadence_from(times))
    sleep(20)`, points: ['걸음마다 <code>times.append(지금 시각)</code>', '5개 넘으면 <code>pop(0)</code>', '흔들기 버튼으로 연습'], notes: '<p>슬라이드에는 준비된 함수가 길어 걸음 대신 흔들기 제스처를 씁니다. ▶ 실행 후 🧭 센서 탭의 흔들기 버튼을 일정한 박자로 누릅니다.</p><p>학생들은 본문 예제 4-5(셸) → 4-6 순서로 실행합니다.</p><p>💬 “처음 몇 번은 왜 숫자가 작을까요?” — 목록이 덜 찼고, 첫 간격이 길어서.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '구간별 아이콘', html: FIG_ICONS, caption: '큰 쪽(160)부터 if → elif → else', notes: '<p>예제 4-7 을 실행하고 조이스틱으로 걷기 → 뛰기를 보여 줍니다.</p><p>💬 “130 을 먼저 검사하면 어떻게 될까요?” — 170 도 130 이상이라 조깅 아이콘이 나옴. 큰 쪽부터.</p><p>A 버튼 scroll 중에는 걸음을 놓친다는 점도 짚습니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '움직임 시뮬레이션', head: ['조이스틱', '케이던스', '아이콘', '바뀌기까지'], rows: [['살짝', '', '', '—'], ['절반', '', '', ''], ['끝까지', '', '', ''], ['다시 살짝', '', '', '']], lead: '빠르기를 바꾸고 몇 걸음 뒤에 아이콘이 바뀌나?', notes: '<p>모둠별로 조이스틱 담당 · 기록 담당을 정해 표 4-3 을 채웁니다.</p><p>💬 “왜 바로 바뀌지 않고 몇 걸음 늦을까요?” — 최근 5걸음을 평균 내기 때문. 개수를 줄이면 빨라지지만 출렁임.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '토론 — 멈췄는데 120?', html: FIG_STOP, caption: '걸음이 있을 때만 계산하기 때문', notes: '<p>예제 4-7 에서 걷다 멈추고 A 를 눌러 보여 줍니다.</p><p>💬 “멈춘 것을 어떻게 알 수 있을까?” — 마지막 걸음 시각과 지금 시각의 차이.</p><p>💬 “몇 초를 기다릴까?” — 너무 짧으면 천천히 걸을 때도 0 이 됨, 너무 길면 늦게 0 이 됨. 이 강좌는 2초.</p><p>💬 “예전 시각을 남겨 두면?” — 다시 걸을 때 긴 공백이 평균에 섞여 값이 낮게 나옴 → 목록 비우기.</p><p>시간: 5분</p>' },
          { layout: 'practice', title: '실습 — 실시간 케이던스 측정기', desc: '★ 예제 4-7 실행 · 표 4-3 채우기<br>★★ 구간 숫자를 우리 모둠 값으로<br>★★★ 2초 동안 걸음이 없으면 0 표시 (도전 4-8)', starter: `from microbit import *

times = []
cadence = 0
while True:
    if accelerometer.was_gesture("shake"):   # 걸음 대신
        times.append(running_time())
        cadence = 120                         # (계산 생략)
        display.show(Image.HAPPY)
    # TODO: 2초 동안 걸음이 없으면 cadence = 0, "0" 보이기
    sleep(20)`, solution: `from microbit import *

times = []
cadence = 0
while True:
    if accelerometer.was_gesture("shake"):
        times.append(running_time())
        cadence = 120
        display.show(Image.HAPPY)
    if len(times) > 0 and running_time() - times[-1] > 2000:
        cadence = 0
        times = []
        display.show("0")
    sleep(20)`, notes: '<p>슬라이드의 시작 코드는 멈춤 조건만 연습하는 뼈대입니다. 실제 실습은 본문 예제 4-7 · 도전 4-8 로 합니다.</p><p><code>len(times) > 0</code> 을 빠뜨리면 목록이 빌 때 IndexError 가 난다는 점을 정답 설명 때 짚습니다.</p><p>시간: 3분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['케이던스 = 1분당 걸음 수 (spm)', '① 10초 × 6 · ② 60000 ÷ 간격', '<code>cadence_from(times)</code> = 최근 걸음 평균', '구간별 아이콘: 큰 쪽부터 검사', '멈춤 = 마지막 걸음 뒤 2초 → 0'], notes: '<p>모둠별로 걷기 · 달리기 케이던스를 발표하게 합니다.</p><p>다음 시간 “생각하기”: 좋아하는 노래 박자에 맞춰 걸으면 왜 걷기가 편해질까요? 를 안내하고, 걷기 좋은 노래 한 곡을 골라 오게 합니다.</p><p>시간: 1분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch04-2',
        title: '메트로놈 비트음으로 페이스 맞추기',
        minutes: 50,
        goals: [
          'BPM(beats per minute)과 케이던스가 같은 단위임을 알고, 박자 간격 = 60000 ÷ BPM 을 계산할 수 있다',
          '<code>music.pitch()</code> 로 짧은 “틱” 소리를 내고, <code>sleep()</code> 으로 박자를 맞추면 걸음을 놓치는 까닭을 설명할 수 있다',
          '준비된 함수 <code>beat_due()</code> 와 A · B 버튼으로 목표 BPM 을 바꾸는 메트로놈을 만들 수 있다',
          '측정 케이던스와 목표 BPM 을 비교해 화살표로 알려 주는 러닝 페이스 메이커를 만들고, 소리와 관련된 문제를 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['BPM = 케이던스', 5], ['music.pitch() 틱 소리', 7], ['sleep 의 문제 · beat_due()', 9], ['A · B 로 목표 BPM', 5], ['비교 화살표 · 페이스 메이커', 7], ['토론: 소리 문제', 6], ['실습 · 정리', 6]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '좋아하는 노래 박자에 맞춰 걸으면 왜 걷기가 편해질까요? 골라 온 노래를 틀어 놓고 박자에 맞춰 걸어 보고, <b>노래 없이 걸을 때</b>와 무엇이 다른지 한 줄로 적어 오세요. 박자가 빠른 노래와 느린 노래로 각각 해 보면 더 좋습니다.' },
          { type: 'p', html: '친구들의 답을 모아 보면 “발을 언제 디딜지 생각하지 않아도 된다”, “일정한 빠르기로 오래 걸을 수 있다”, “빠른 노래는 저절로 빨리 걷게 된다” 같은 이야기가 나옵니다. 박자는 우리 몸에 <b>언제 발을 디딜지</b> 알려 주는 신호가 됩니다. 운동선수들이 연습할 때 <b>메트로놈(metronome)</b>, 곧 일정한 박자로 “틱, 틱” 소리를 내는 기계를 쓰는 것도 이 때문입니다.' },
          { type: 'p', html: '오늘은 micro:bit 로 메트로놈을 만들고, 1교시의 케이던스 측정기와 합쳐 <b>러닝 페이스 메이커</b>를 완성합니다. 페이스 메이커(pacemaker)는 달리기 대회에서 정해진 빠르기로 앞에서 달려 주는 사람을 말합니다. 우리 페이스 메이커는 소리와 화살표로 빠르기를 알려 줍니다.' },

          { type: 'h', text: 'BPM 과 케이던스는 같은 단위' },
          { type: 'p', html: '음악의 빠르기는 <b>BPM</b>(beats per minute, 1분당 박자 수)으로 나타냅니다. BPM 120 인 노래는 1분에 120번 “쿵” 하는 박자가 있습니다. 케이던스도 1분당 걸음 수였지요. 그래서 <b>비트 하나에 한 걸음</b>을 디디면 BPM 이 곧 케이던스가 됩니다.' },
          { type: 'figure', html: FIG_BPM, caption: '그림 4-6. 비트 하나에 한 걸음 — 박자 간격 = 60000 ÷ BPM' },
          { type: 'p', html: '메트로놈을 만들려면 소리와 소리 사이를 몇 ms 로 할지 알아야 합니다. 1교시 방법 ② 를 거꾸로 쓰면 됩니다. <b>박자 간격(ms) = 60000 ÷ BPM</b>. BPM 120 이면 500ms 마다, BPM 150 이면 400ms 마다 한 번씩 소리를 내면 됩니다.' },
          {
            type: 'table', caption: '표 4-4. 목표 BPM 과 박자 간격',
            head: ['목표 BPM', '박자 간격 (60000 ÷ BPM)', '움직임 (이 강좌의 구간)'],
            rows: [
              ['100', '600ms', '천천히 걷기'],
              ['120', '500ms', '걷기'],
              ['150', '400ms', '조깅'],
              ['170', '352ms', '달리기']
            ]
          },

          { type: 'h', text: 'import music — 짧은 “틱” 소리 만들기' },
          { type: 'p', html: '소리를 내려면 <code>import music</code> 으로 음악 모듈을 불러옵니다. <code>music.pitch(주파수, 길이)</code> 는 정한 높이의 소리를 정한 시간(ms)만큼 냅니다. <b>주파수(frequency)</b>는 소리의 높이로, 숫자가 클수록 높은 소리입니다. 440 은 “라” 음입니다.' },
          { type: 'p', html: '메트로놈 소리는 <b>짧고 높을수록</b> 또렷하게 들립니다. 1760 정도의 높은 소리를 30ms 만 내면 “틱” 하는 짧은 소리가 됩니다.' },
          {
            type: 'code', title: '예제 4-9. 셸에서 소리 높이 · 길이 바꿔 보기', repl: true, code: `import music
music.pitch(440, 300)
music.pitch(1760, 30)
music.pitch(880, 30)
60000 // 120
60000 // 170`,
            desc: '“라” 음을 0.3초 낸 뒤, 높은 소리를 짧게 내 봅니다. 숫자를 바꿔 가며 가장 “틱”처럼 들리는 소리를 찾아보세요. 마지막 두 줄은 BPM 120 · 170 의 박자 간격입니다.',
            hint: '소리가 안 들리면 컴퓨터 음량과, 시뮬레이터의 소리 켜기 버튼을 확인하세요.',
            expect: '>>> 60000 // 120\n500\n>>> 60000 // 170\n352'
          },
          {
            type: 'code', title: '예제 4-10. sleep() 으로 만드는 메트로놈', code: `from microbit import *
import music

BPM = 120
gap = 60000 // BPM            # 박자 간격 (ms)

while True:
    music.pitch(1760, 30)     # 짧은 '틱'
    display.show(Image.SQUARE_SMALL)
    sleep(gap - 30)           # 소리 낸 시간만큼 빼고 기다리기
    display.clear()`,
            desc: '소리를 30ms 내고, 남은 <code>gap - 30</code> ms 를 기다립니다. 소리 길이를 빼지 않으면 박자가 조금씩 느려집니다. 작은 네모가 박자에 맞춰 보입니다. <code>BPM</code> 을 바꿔 걷기 · 달리기 박자를 들어 보세요.',
            hint: '소리에 맞춰 책상을 손가락으로 두드려 보세요. <code>BPM = 170</code> 으로 바꾸면 얼마나 빨라지나요?',
            expect: '0.5초마다 “틱” 소리가 나고, LED 가운데 작은 네모가 보였다 사라지기를 되풀이합니다.'
          },
          {
            type: 'code', title: '응용 4-11. 네 박자마다 높은 소리', code: `from microbit import *
import music

BPM = 120
gap = 60000 // BPM
beat = 0

while True:
    if beat % 4 == 0:
        music.pitch(2093, 30)   # 첫 박자는 더 높게
    else:
        music.pitch(1568, 30)
    beat += 1
    sleep(gap - 30)`,
            desc: '음악처럼 <b>네 박자마다 첫 박자</b>를 더 높은 소리로 냅니다. ch03 에서 배운 나머지 <code>%</code> 를 씁니다. 박자를 세기 쉬워집니다.',
            expect: '“틱(높게) 틱 틱 틱, 틱(높게) 틱 틱 틱 …” 이 되풀이됩니다.'
          },

          { type: 'h', text: 'sleep() 으로 박자를 맞추면 생기는 문제' },
          { type: 'p', html: '이제 메트로놈과 1교시의 걸음 세기를 합치면 될 것 같습니다. 그런데 그대로 합치면 큰 문제가 생깁니다. 예제 4-12 를 실행해 보세요.' },
          {
            type: 'code', title: '예제 4-12. sleep() 메트로놈 + 걸음 세기 — 걸음을 놓칩니다', code: `from microbit import *
import math
import music

` + PY_STEP_KIT + `
BPM = 120
gap = 60000 // BPM
steps = 0

while True:
    music.pitch(1760, 30)
    sleep(gap - 30)           # 이 동안 센서를 못 읽음!
    if is_step(smooth(strength())):
        steps += 1
        print("걸음", steps)`,
            desc: '소리는 박자에 맞게 잘 나지만, 걸음 수가 거의 올라가지 않습니다. <code>sleep(470)</code> 동안 micro:bit 는 <b>눈을 감고 자는 것</b>과 같습니다. 센서는 0.5초에 한 번만 읽으니, 그 사이에 지나간 봉우리는 볼 수 없습니다.',
            hint: '조이스틱으로 20걸음쯤 걷게 하고 콘솔의 걸음 수와 비교해 보세요.',
            expect: '걸음 1\n걸음 2   (20걸음을 걸었는데 몇 걸음밖에 세지 못합니다)',
            nondeterministic: true
          },
          { type: 'figure', html: FIG_SLEEP, caption: '그림 4-7. sleep() 으로 기다리면 걸음을 놓치고, beat_due() 로 확인하면 둘 다 할 수 있다' },
          { type: 'p', html: '해결 방법은 <b>오래 자지 않는 것</b>입니다. 반복은 ch03 처럼 0.02초마다 짧게 돌면서 센서를 읽고, 그때마다 “<b>지금 소리 낼 때인가?</b>”만 시계(<code>running_time()</code>)를 보고 확인합니다. 때가 되었으면 “틱”, 아니면 그냥 넘어갑니다. 주방 타이머를 맞춰 두고 다른 일을 하다가, 가끔 타이머를 힐끗 보는 것과 같습니다.' },
          {
            type: 'code', title: '준비된 함수 beat_due(bpm)', run: false, code: PY_BEAT,
            desc: '넣는 것은 <b>목표 BPM</b>, 나오는 것은 <b>True</b>(지금 소리 낼 때) 또는 <b>False</b>(아직). 다음 박자 시각 <code>next_beat</code> 을 기억해 두었다가, 지금 시각이 그것을 지나면 True 를 돌려주고 다음 박자 시각을 박자 간격만큼 뒤로 미룹니다. 함수 속은 몰라도 괜찮습니다.'
          },
          {
            type: 'code', title: '예제 4-13. beat_due() 로 만드는 메트로놈', code: `from microbit import *
import music

` + PY_BEAT + `
BPM = 120
lit = 0             # 점을 켠 시각

while True:
    if beat_due(BPM):
        music.pitch(1760, 30, wait=False)   # 틀어 놓고 바로 다음 일
        display.set_pixel(2, 2, 9)
        lit = running_time()
    if running_time() - lit > 100:          # 0.1초 뒤 점 끄기
        display.set_pixel(2, 2, 0)
    sleep(20)`,
            desc: '예제 4-10 과 똑같이 들리지만 속은 다릅니다. 반복은 0.02초마다 돌고, <code>beat_due()</code> 가 True 일 때만 소리를 냅니다. <code>wait=False</code> 는 ch03 에서처럼 “소리를 틀어 놓고 기다리지 말라”는 뜻입니다. 점을 끄는 것도 <code>sleep</code> 대신 시각을 비교해서 합니다.',
            hint: '<code>BPM</code> 을 100, 150, 170 으로 바꿔 박자가 바르게 바뀌는지 들어 보세요.',
            expect: '0.5초마다 “틱” 소리와 함께 LED 가운데 점이 짧게 깜빡입니다.'
          },
          {
            type: 'code', title: '예제 4-14. 박자를 내면서 걸음도 세기', code: `from microbit import *
import math
import music

` + PY_STEP_KIT + `
` + PY_BEAT + `
BPM = 120
steps = 0

while True:
    if beat_due(BPM):
        music.pitch(1760, 30, wait=False)
    if is_step(smooth(strength())):
        steps += 1
        print("걸음", steps)
    sleep(20)`,
            desc: '예제 4-12 와 비교해 보세요. 이번에는 걸음을 하나도 놓치지 않습니다. 반복 안에 <b>“소리 낼 때인가?”</b>와 <b>“걸음인가?”</b> 두 질문을 나란히 두고 0.02초마다 묻기 때문입니다.',
            hint: '조이스틱으로 20걸음쯤 걷게 하고 예제 4-12 와 콘솔 걸음 수를 비교하세요.',
            expect: '걸음 1\n걸음 2\n걸음 3 … (박자 소리가 나는 동안에도 걸음을 빠짐없이 셉니다)',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '왜 next_beat 에 간격을 더할까요?', html: '“지금 시각 + 간격” 으로 다음 박자를 정하면, 반복이 0.02초 늦게 확인할 때마다 그 늦음이 쌓여 박자가 조금씩 느려집니다. <code>beat_due()</code> 는 <b>원래 박자 시각 + 간격</b>으로 정해서 늦음이 쌓이지 않게 합니다. 너무 많이 뒤처졌을 때만 지금부터 다시 맞춥니다.' },

          { type: 'h', text: 'A · B 버튼으로 목표 BPM 바꾸기' },
          { type: 'p', html: '달리는 사람마다 편한 빠르기가 다르니, 목표 BPM 을 버튼으로 바꿀 수 있게 합니다. <b>A 버튼</b>은 5 내리기, <b>B 버튼</b>은 5 올리기입니다. 너무 느리거나 빠른 값이 되지 않도록 <b>60 ~ 200</b> 사이로 막습니다.' },
          {
            type: 'code', title: '예제 4-15. 목표 BPM 을 버튼으로 바꾸는 메트로놈', code: `from microbit import *
import music

` + PY_BEAT + `
target = 120        # 목표 BPM

while True:
    if beat_due(target):
        music.pitch(1760, 30, wait=False)
    if button_a.was_pressed() and target > 60:
        target -= 5
        display.scroll(target, delay=80, wait=False)
    if button_b.was_pressed() and target < 200:
        target += 5
        display.scroll(target, delay=80, wait=False)
    sleep(20)`,
            desc: '버튼을 누를 때마다 목표가 5씩 바뀌고 LED 에 새 숫자가 흐릅니다. <code>wait=False</code> 를 주면 숫자가 흐르는 동안에도 박자가 끊기지 않습니다. <code>and target > 60</code> 은 “60 보다 클 때만 내리기”라는 뜻입니다.',
            hint: '<b>B 버튼</b>을 여러 번 눌러 박자가 빨라지는 것을, <b>A 버튼</b>으로 느려지는 것을 들어 보세요.',
            expect: 'B 를 누르면 “125”, “130” … 이 흐르고 박자가 빨라집니다. A 를 누르면 느려집니다.'
          },

          { type: 'h', text: '측정 케이던스와 목표 BPM 비교하기' },
          { type: 'p', html: '이제 두 숫자가 있습니다. 1교시에 만든 <b>측정 케이던스</b>와 지금 만든 <b>목표 BPM</b>. 둘을 빼서 차이를 보면 지금 빠르기를 알려 줄 수 있습니다. 숫자가 딱 맞기는 어려우니 <b>±5 안이면 맞음</b>으로 약속합니다.' },
          { type: 'figure', html: FIG_PACE, caption: '그림 4-8. 케이던스와 목표 비교 — 화살표로 알려 주기' },
          {
            type: 'table', caption: '표 4-5. 비교 규칙 (차이 = 측정 케이던스 − 목표 BPM)',
            head: ['차이', '뜻', 'LED'],
            rows: [
              ['−5 보다 작음 (예: 110 − 120 = −10)', '목표보다 느림 → 더 빨리', '위 화살표 <code>Image.ARROW_N</code>'],
              ['−5 ~ +5', '목표와 맞음', '체크 표시 <code>Image.YES</code>'],
              ['+5 보다 큼 (예: 130 − 120 = +10)', '목표보다 빠름 → 천천히', '아래 화살표 <code>Image.ARROW_S</code>']
            ]
          },
          {
            type: 'code', title: '예제 4-16. 케이던스와 목표 비교 화살표 (소리 없이)', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_CADENCE + `
target = 120
times = []

while True:
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        diff = cadence_from(times) - target
        if diff < -5:
            display.show(Image.ARROW_N)   # 느려요
        elif diff > 5:
            display.show(Image.ARROW_S)   # 빨라요
        else:
            display.show(Image.YES)       # 좋아요
    sleep(20)`,
            desc: '걸음마다 <b>차이 = 케이던스 − 목표</b>를 구하고 세 갈래로 나눕니다. 목표 120 에 맞춰 걷고 있다면 체크 표시가 보입니다.',
            hint: '조이스틱을 살짝 밀어 천천히 걷게 하면 위 화살표, 끝까지 밀면 아래 화살표가 보입니다. 체크 표시가 나오는 조이스틱 위치를 찾아보세요.',
            expect: '천천히 걸으면 위 화살표, 너무 빠르면 아래 화살표, 120 근처면 체크 표시가 보입니다.',
            nondeterministic: true
          },

          { type: 'h', text: '러닝 페이스 메이커 완성' },
          { type: 'p', html: '지금까지 만든 것을 모두 합칩니다. 반복 안에서 네 가지를 차례로 묻습니다. ① 소리 낼 때인가? ② 걸음인가? (걸음이면 비교 화살표) ③ 버튼이 눌렸나? ④ 2초 동안 멈췄나? 질문마다 몇 줄씩이라 길어 보이지만, 모두 앞에서 한 번씩 실행해 본 코드입니다.' },
          {
            type: 'code', title: '예제 4-17. 러닝 페이스 메이커', code: `from microbit import *
import math
import music

` + PY_STEP_KIT + `
` + PY_CADENCE + `
` + PY_BEAT + `
target = 120        # 목표 BPM
times = []

while True:
    # ① 박자 소리
    if beat_due(target):
        music.pitch(1760, 30, wait=False)
    # ② 걸음이면 케이던스와 목표 비교
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        diff = cadence_from(times) - target
        if diff < -5:
            display.show(Image.ARROW_N)
        elif diff > 5:
            display.show(Image.ARROW_S)
        else:
            display.show(Image.YES)
    # ③ 목표 BPM 바꾸기
    if button_a.was_pressed() and target > 60:
        target -= 5
        display.scroll(target, delay=80, wait=False)
    if button_b.was_pressed() and target < 200:
        target += 5
        display.scroll(target, delay=80, wait=False)
    # ④ 2초 동안 걸음이 없으면 멈춤
    if len(times) > 0 and running_time() - times[-1] > 2000:
        times = []
        display.clear()
    sleep(20)`,
            desc: '“틱” 소리에 맞춰 걸으면 체크 표시가 보이고, 박자보다 느리거나 빠르면 화살표가 알려 줍니다. 멈추면 2초 뒤 화면이 꺼집니다. 이것이 오늘의 <b>러닝 페이스 메이커</b>입니다.',
            hint: '<b>B 버튼</b>으로 목표를 150 으로 올리고, 조이스틱으로 체크 표시가 나오도록 빠르기를 맞춰 보세요.',
            expect: '박자 소리가 계속 나고, 걸음마다 위 화살표 · 체크 · 아래 화살표 중 하나가 보입니다. A · B 를 누르면 목표 숫자가 흐릅니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: 'micro:bit V2 는 뒷면 스피커로 소리를 냅니다. 같은 소리가 <b>0번 핀과 GND</b> 에도 나오므로, 집게 전선으로 이어폰이나 부저를 연결할 수 있습니다. 보드에 올린 뒤 배터리 팩을 연결하고, 걸으면서 화살표가 잘 보이도록 보드를 손목이나 손에 듭니다.' },

          { type: 'h', text: '토론 — 소리와 관련된 문제' },
          { type: 'p', html: '페이스 메이커를 들고 밖에서 달린다고 생각해 봅니다. 교실에서는 잘 되던 것이 밖에서는 문제가 될 수 있습니다. 표 4-6 의 상황 카드를 모둠별로 하나씩 맡아 이야기해 봅니다.' },
          {
            type: 'table', caption: '표 4-6. 소리 문제 — 토론 카드',
            head: ['상황', '예상되는 문제', '해결 아이디어 (예)'],
            rows: [
              ['야외 · 바람 · 차 소리', '작은 스피커 소리가 안 들림', '핀0 에 이어폰 · 부저 연결'],
              ['도서관 · 밤 · 공원', '다른 사람에게 방해되는 소리', '소리 끄고 LED 깜빡임만, 이어폰'],
              ['오래 달리기', '소리 · LED 가 배터리를 빨리 씀', '소리를 짧게, 화면 밝기 낮추기'],
              ['이어폰을 꽂고 달리기', '주변 소리(차 · 자전거)를 못 들음', '한쪽 귀만, 작은 소리로'],
              ['달리면서 화면 보기', 'LED 가 작고 흔들려 잘 안 보임', '소리 높이로 빠르기 알려 주기 (도전 4-19)']
            ]
          },
          { type: 'list', items: [
            '💬 우리 페이스 메이커는 <b>소리</b>와 <b>LED</b> 중 무엇을 꼭 써야 할까요? 둘 다 꺼야 할 때는 언제일까요?',
            '💬 “틱” 소리 길이를 30ms 에서 10ms 로 줄이면 배터리에 어떤 도움이 될까요? 너무 짧으면 어떤 문제가 생길까요?',
            '💬 소리 대신 쓸 수 있는 신호는 또 무엇이 있을까요? (LED 깜빡임, 진동 모터 …)'
          ] },
          {
            type: 'code', title: '응용 4-18. 로고를 터치해 소리 켜고 끄기', code: `from microbit import *
import music

` + PY_BEAT + `
target = 120
sound_on = True
lit = 0

while True:
    if pin_logo.is_touched():
        sound_on = not sound_on              # 켜짐 ↔ 꺼짐
        print("소리", sound_on)
        sleep(300)                           # 한 번 터치를 여러 번으로 세지 않게
    if beat_due(target):
        if sound_on:
            music.pitch(1760, 30, wait=False)
        display.show(Image.SQUARE)           # 소리가 꺼져도 LED 로 박자
        lit = running_time()
    if running_time() - lit > 80:
        display.clear()
    sleep(20)`,
            desc: '금색 <b>로고</b>를 터치하면 소리가 꺼지고 LED 깜빡임만 남습니다. 다시 터치하면 소리가 켜집니다. <code>not</code> 은 True 와 False 를 뒤집습니다. 큰 네모를 깜빡여 소리 없이도 박자를 볼 수 있습니다.',
            hint: '보드 그림의 금색 <b>로고</b>를 눌러 소리를 껐다 켜 보세요.',
            expect: '처음에는 “틱” 소리와 네모 깜빡임이 함께 나오고, 로고를 터치하면 네모 깜빡임만 남습니다.'
          },
          { type: 'callout', kind: 'board', title: '이어폰으로만 듣기', html: '실제 V2 보드에서 <code>speaker.off()</code> 를 한 번 실행하면 보드 스피커는 꺼지고 <b>0번 핀으로만</b> 소리가 나갑니다. 이어폰을 연결해 혼자만 들을 때 씁니다. 이어폰은 소리가 크게 날 수 있으니 <b>귀에 꽂기 전에 먼저 작게 들어 보고</b>, 핀과 이어폰 사이를 단단히 연결합니다.' },
          { type: 'callout', kind: 'warn', title: '안전하게 달리기', html: '달리면서 LED 화면을 계속 보면 앞을 못 봅니다. 화면은 <b>멈춰서</b> 확인하고, 달리는 동안에는 소리로 박자를 맞춥니다. 이어폰은 한쪽만 쓰고, 차와 자전거가 다니는 곳에서는 소리를 작게 합니다.' },

          { type: 'h', text: '실습 — 러닝 페이스 메이커 만들기' },
          { type: 'list', ordered: true, items: [
            '★ 예제 4-17 을 실행하고, 목표 120 · 150 에서 각각 체크 표시가 나오도록 조이스틱 빠르기를 맞춰 봅니다.',
            '★★ 응용 4-18 의 로고 터치(소리 켜고 끄기)를 예제 4-17 에 더해 봅니다.',
            '★★★ 목표와 차이가 클수록 소리 높이를 다르게 해서, 화면을 보지 않고도 빠르기를 알 수 있게 합니다 (도전 4-19).'
          ] },
          {
            type: 'code', title: '도전 4-19. 차이에 따라 소리 높이가 바뀌는 페이스 메이커 (★★★)', code: `from microbit import *
import math
import music

` + PY_STEP_KIT + `
` + PY_CADENCE + `
` + PY_BEAT + `
target = 120
times = []
diff = 0

while True:
    if beat_due(target):
        tone = 1760 + diff * 30          # 빠르면 높게, 느리면 낮게
        if tone < 400:
            tone = 400
        if tone > 3500:
            tone = 3500
        music.pitch(tone, 30, wait=False)
    if is_step(smooth(strength())):
        times.append(running_time())
        if len(times) > 5:
            times.pop(0)
        diff = cadence_from(times) - target
    if button_a.was_pressed() and target > 60:
        target -= 5
    if button_b.was_pressed() and target < 200:
        target += 5
    if len(times) > 0 and running_time() - times[-1] > 2000:
        times = []
        diff = 0
    sleep(20)`,
            desc: '차이가 0 이면 늘 듣던 1760 소리, 목표보다 10 빠르면 2060 으로 높아지고, 10 느리면 1460 으로 낮아집니다. 차이가 클수록 소리가 더 많이 달라집니다. 너무 낮거나 높은 소리는 400 ~ 3500 사이로 막았습니다. <code>30</code> 을 바꾸면 소리가 바뀌는 정도를 조절할 수 있습니다.',
            hint: '눈을 감고 소리만 들으면서 조이스틱으로 빠르기를 바꿔 보세요. 소리가 “늘 듣던 높이”가 되도록 맞추면 목표 빠르기입니다.',
            expect: '목표에 맞게 걸으면 같은 높이의 “틱”, 빨라지면 점점 높은 소리, 느려지면 점점 낮은 소리가 납니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: 'BPM 과 케이던스는 같은 단위 — 비트 하나에 한 걸음. 박자 간격 = 60000 ÷ BPM. <code>sleep()</code> 으로 오래 기다리면 센서를 못 읽어 걸음을 놓치므로, 준비된 함수 <code>beat_due()</code> 로 “지금 소리 낼 때인가?”만 확인합니다. 차이 = 케이던스 − 목표, ±5 안이면 체크.' }
        ],
        slides: [
          { layout: 'title', title: '메트로놈 비트음으로 페이스 맞추기', subtitle: 'Chapter 04 · 케이던스와 메트로놈 비트음', badge: '2교시', notes: '<p>1교시의 케이던스 측정기를 떠올리게 합니다. “오늘은 소리로 빠르기를 알려 주는 페이스 메이커를 만듭니다.”</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 노래에 맞춰 걸으면?', lead: '왜 걷기가 편해질까?', bullets: ['언제 발을 디딜지 생각 안 해도 됨', '일정한 빠르기로 오래', '빠른 노래 → 저절로 빨리', '→ 박자 = 발 디딤 신호 (메트로놈)'], notes: '<p>학생들이 골라 온 노래 한두 곡의 일부를 틀고 박자에 맞춰 제자리 걸음을 해 봅니다.</p><p>💬 “빠른 노래와 느린 노래에서 걸음은 어떻게 달랐나요?”</p><p>페이스 메이커 = 대회에서 정해진 빠르기로 앞에서 달려 주는 사람.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: 'BPM = 케이던스', html: FIG_BPM, caption: '비트 하나에 한 걸음 · 간격 = 60000 ÷ BPM', notes: '<p>BPM = beats per minute. 단위가 “1분당 ○○ 수”로 같다는 점을 강조합니다.</p><p>💬 “BPM 150 이면 몇 ms 마다 소리를 낼까요?” — 400ms.</p><p>💬 “1교시 방법 ② 와 무엇이 같나요?” — 같은 식을 거꾸로 씀.</p><p>시간: 5분</p>' },
          { layout: 'code', title: 'music.pitch() 로 “틱”', code: `from microbit import *
import music

BPM = 120
gap = 60000 // BPM

while True:
    music.pitch(1760, 30)
    display.show(Image.SQUARE_SMALL)
    sleep(gap - 30)
    display.clear()`, points: ['<code>music.pitch(주파수, 길이)</code>', '높고 짧게 = 또렷한 틱', '<code>gap - 30</code>: 소리 낸 시간 빼기'], notes: '<p>▶ 실행하고 박자에 맞춰 학생들이 책상을 두드리게 합니다.</p><p>BPM 을 170 으로 바꿔 다시 실행합니다.</p><p>💬 “30 을 빼지 않으면?” — 박자가 조금씩 느려짐 (530ms 마다).</p><p>시간: 5분</p>' },
          { layout: 'code', title: '합치면? — 걸음을 놓쳐요', code: `from microbit import *
import music

BPM = 120
gap = 60000 // BPM
steps = 0

while True:
    music.pitch(1760, 30)
    sleep(gap - 30)          # 이 동안 못 봄!
    if accelerometer.was_gesture("shake"):
        steps += 1
        print("걸음", steps)`, points: ['sleep 동안 = 눈 감고 자기', '0.5초에 한 번만 센서 확인', '본문 예제 4-12 로 실제 확인'], notes: '<p>슬라이드 코드는 걸음 대신 흔들기 제스처를 씁니다. 실제 걸음 감지로는 본문 예제 4-12 를 실행합니다.</p><p>예제 4-12 를 실행해 20걸음 걷게 했는데 몇 걸음밖에 안 세는 것을 보여 줍니다.</p><p>💬 “왜 걸음을 놓칠까요?” — sleep 동안 센서를 안 읽어서.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: 'sleep() vs beat_due()', html: FIG_SLEEP, caption: '오래 자지 말고 “지금 소리 낼 때인가?”만 확인', notes: '<p>주방 타이머 비유: 타이머를 맞춰 두고 다른 일(걸음 세기)을 하다가 가끔 힐끗 본다.</p><p>beat_due() 는 넣는 것 = BPM, 나오는 것 = True/False 만 강조합니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: 'beat_due() 메트로놈', code: `from microbit import *
import music

next_beat = 0
def beat_due(bpm):
    global next_beat
    now = running_time()
    if now < next_beat:
        return False
    next_beat = now + 60000 // bpm
    return True

while True:
    if beat_due(120):
        music.pitch(1760, 30, wait=False)
    sleep(20)`, points: ['0.02초마다 “때가 됐나?”', '<code>wait=False</code> = 틀어 놓고 바로 다음', '본문 함수는 늦음이 쌓이지 않게 다듬음'], notes: '<p>슬라이드의 beat_due() 는 짧게 줄인 판입니다. 본문의 준비된 함수는 next_beat 에 간격을 더해 늦음이 쌓이지 않게 한 것이라고만 말해 줍니다.</p><p>학생 화면에서는 예제 4-13 → 4-14 를 실행해 걸음을 놓치지 않는 것을 확인합니다.</p><p>시간: 3분</p>' },
          { layout: 'bullets', title: 'A · B 로 목표 BPM', bullets: ['A = 5 내리기 · B = 5 올리기', '<code>and target > 60</code> = 60 ~ 200 사이로', '<code>display.scroll(target, wait=False)</code>', '숫자가 흐르는 동안에도 박자 계속'], notes: '<p>예제 4-15 를 실행해 B 를 여러 번 눌러 빨라지는 박자를 들려줍니다.</p><p>💬 “wait=False 를 빼면 어떻게 될까요?” — 숫자가 흐르는 동안 박자가 끊김. 직접 빼고 실행해 보게 해도 좋습니다.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '케이던스 vs 목표', html: FIG_PACE, caption: '차이 = 케이던스 − 목표, ±5 안이면 체크', notes: '<p>💬 “케이던스 110, 목표 120 이면?” — 차이 −10 → 위 화살표(더 빨리).</p><p>💬 “케이던스 123, 목표 120 이면?” — +3 → 체크.</p><p>예제 4-16 을 실행해 조이스틱으로 체크가 나오는 위치를 찾게 합니다.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '러닝 페이스 메이커', head: ['순서', '묻는 것', '쓰는 함수'], rows: [['①', '소리 낼 때인가?', '<code>beat_due()</code>'], ['②', '걸음인가? → 비교 화살표', '<code>is_step()</code> · <code>cadence_from()</code>'], ['③', '버튼이 눌렸나?', 'A −5 · B +5'], ['④', '2초 동안 멈췄나?', '<code>times[-1]</code>']], lead: '예제 4-17 = 지금까지 만든 것 합치기', notes: '<p>예제 4-17 을 ①~④ 주석을 따라 읽고 실행합니다.</p><p>💬 “새로 배운 코드가 있나요?” — 없음. 모두 앞에서 실행해 본 조각.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '토론 — 소리 문제', head: ['상황', '문제', '아이디어'], rows: [['야외', '안 들림', '핀0 이어폰 · 부저'], ['도서관 · 밤', '방해됨', 'LED 깜빡임만'], ['오래 달리기', '배터리', '소리 짧게'], ['이어폰', '주변 소리 못 들음', '한쪽 · 작게']], lead: '모둠별로 상황 카드 하나씩', notes: '<p>모둠별로 표 4-6 의 카드 하나를 맡아 1분 토론 후 발표합니다.</p><p>💬 “소리 대신 쓸 수 있는 신호는?” — LED 깜빡임, 진동 모터 등.</p><p>⚠️ 달리면서 화면 보지 않기, 이어폰은 먼저 작게 들어 보기.</p><p>응용 4-18(로고로 소리 끄기)을 실행해 보여 줍니다.</p><p>시간: 6분</p>' },
          { layout: 'practice', title: '실습 — 러닝 페이스 메이커', desc: '★ 예제 4-17 실행 · 목표 120 · 150 맞추기<br>★★ 로고 터치로 소리 켜고 끄기 더하기<br>★★★ 차이가 클수록 소리 높이 다르게 (도전 4-19)', starter: `from microbit import *
import music

diff = 0            # 케이던스 - 목표 (A, B 로 흉내)

while True:
    if button_a.was_pressed():
        diff -= 5
    if button_b.was_pressed():
        diff += 5
    tone = 1760     # TODO: diff 가 클수록 높게, 작을수록 낮게
    music.pitch(tone, 30)
    sleep(470)`, solution: `from microbit import *
import music

diff = 0

while True:
    if button_a.was_pressed():
        diff -= 5
    if button_b.was_pressed():
        diff += 5
    tone = 1760 + diff * 30
    if tone < 400:
        tone = 400
    if tone > 3500:
        tone = 3500
    music.pitch(tone, 30)
    sleep(470)`, notes: '<p>슬라이드 시작 코드는 A · B 로 차이를 흉내 내서 소리 높이 식만 연습하는 뼈대입니다. 실제 실습은 본문 예제 4-17 · 응용 4-18 · 도전 4-19 로 합니다.</p><p>★★★ 모둠에게는 “400 · 3500 으로 막지 않으면 어떤 소리가 날까?”를 묻습니다.</p><p>시간: 5분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['BPM = 케이던스 (비트 하나에 한 걸음)', '박자 간격 = 60000 ÷ BPM', '<code>sleep()</code> 은 센서를 못 읽게 함', '<code>beat_due()</code> = 지금 소리 낼 때인가?', '차이 ±5 → 위 화살표 · 체크 · 아래 화살표'], notes: '<p>모둠별로 페이스 메이커를 시연하게 하고, 토론에서 나온 아이디어 하나씩을 발표합니다.</p><p>다음 차시 예고: 걸음 수와 케이던스에 이어 한 걸음의 길이(보폭)를 다룬다고만 알려 줍니다.</p><p>시간: 1분</p>' }
        ]
      }
    ]
  });
})();
