/* Chapter 01. 마이크로비트와 프로젝트 준비 */
(function () {
  /* ───────── 그림 1-1. micro:bit V2 앞면 · 뒷면 ───────── */
  const FIG_BOARD = (() => {
    const bx = 170, by = 52, s = 0.78;
    const P = (a) => [Math.round(bx + a[0] * s), Math.round(by + a[1] * s)];
    const A = MB_FIG.ANCHOR;
    const line = (from, to, color) => `<path d="M${from[0]} ${from[1]} L${to[0]} ${to[1]}" stroke="${color || 'var(--accent)'}" stroke-width="2.5"/><circle cx="${to[0]}" cy="${to[1]}" r="5" fill="${color || 'var(--accent)'}"/>`;
    const logo = P(A.logo), mic = P(A.mic), scr = P(A.screen), ba = P(A.btnA), bb = P(A.btnB), spk = P(A.speaker), pad = P(A.pad('1'));
    return `<svg viewBox="0 0 1280 440" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="350" y="30" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">앞면 — 보이고 만질 수 있는 것</text>
  ${MB_FIG.board({ x: bx, y: by, scale: s, leds: '0909099999999990999000900' })}
  ${line([60, 104], [scr[0] - 70, scr[1] - 50])}<text x="20" y="96" font-size="19" font-weight="bold" fill="var(--fg)">5×5 LED 화면</text>
  ${line([60, 186], ba)}<text x="20" y="178" font-size="19" font-weight="bold" fill="var(--fg)">A 버튼</text>
  ${line([60, 268], spk)}<text x="20" y="260" font-size="19" font-weight="bold" fill="var(--fg)">스피커</text>
  ${line([640, 70], mic)}<text x="560" y="62" font-size="19" font-weight="bold" fill="var(--fg)">마이크</text>
  ${line([640, 186], bb)}<text x="570" y="178" font-size="19" font-weight="bold" fill="var(--fg)">B 버튼</text>
  ${line([logo[0], 70], logo, 'var(--accent2)')}<text x="${logo[0] + 10}" y="66" font-size="19" font-weight="bold" fill="var(--accent2)">로고 (터치)</text>
  ${line([640, 400], pad, 'var(--muted)')}<text x="520" y="425" font-size="18" fill="var(--muted)">큰 단자 0 · 1 · 2 · 3V · GND</text>

  <text x="960" y="30" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">뒷면 — 숨어 있는 센서들 (간단히 그림)</text>
  <path d="M790 82 Q790 58 814 58 L1106 58 Q1130 58 1130 82 L1130 316 L1110 336 L810 336 L790 316 Z" fill="#0e6b64" stroke="#0a4f4a" stroke-width="2"/>
  <rect x="900" y="58" width="56" height="24" rx="4" fill="#9aa4ad"/><text x="928" y="104" text-anchor="middle" font-size="15" fill="#d9f0ed">USB 단자</text>
  <rect x="1050" y="64" width="40" height="26" rx="3" fill="#e9e9e9"/><text x="1070" y="110" text-anchor="middle" font-size="15" fill="#d9f0ed">배터리 단자</text>
  <rect x="925" y="160" width="70" height="70" rx="6" fill="#11171c"/><text x="960" y="250" text-anchor="middle" font-size="15" fill="#d9f0ed">프로세서(두뇌)</text>
  <rect x="830" y="240" width="40" height="40" rx="4" fill="#11171c" stroke="var(--warn)" stroke-width="4"/>
  <circle cx="830" cy="100" r="14" fill="#2b3138"/><text x="830" y="135" text-anchor="middle" font-size="15" fill="#d9f0ed">리셋</text>
  ${line([760, 380], [850, 260], 'var(--warn)')}
  <text x="640" y="372" font-size="20" font-weight="bold" fill="var(--warn)">가속도 센서 + 지자기(나침반) 센서</text>
  <text x="660" y="400" font-size="18" fill="var(--muted)">→ 움직임 · 기울기 · 방향을 잽니다 (이 강좌의 주인공)</text>
</svg>`;
  })();

  /* ───────── 그림 1-2. 강좌 화면 구성 ───────── */
  const FIG_SCREEN = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="20" y="20" width="1240" height="380" rx="14" fill="none" stroke="var(--line)" stroke-width="3"/>
  <rect x="40" y="40" width="200" height="340" rx="10" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="140" y="80" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">① 목차</text>
  <text x="60" y="124" font-size="18" fill="var(--muted)">01 준비</text>
  <text x="80" y="154" font-size="17" fill="var(--accent)">· 1교시</text>
  <text x="80" y="182" font-size="17" fill="var(--muted)">· 2교시</text>
  <text x="60" y="214" font-size="18" fill="var(--muted)">02 센서 …</text>
  <text x="60" y="300" font-size="17" fill="var(--muted)">학생용 / 교사용</text>
  <text x="60" y="326" font-size="17" fill="var(--muted)">검색 · 진도</text>

  <rect x="260" y="40" width="560" height="200" rx="10" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="540" y="80" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">② 문서 (설명 · 그림 · 예제)</text>
  <rect x="290" y="104" width="500" height="18" rx="4" fill="var(--line)"/>
  <rect x="290" y="134" width="420" height="18" rx="4" fill="var(--line)"/>
  <rect x="290" y="168" width="500" height="50" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
  <text x="306" y="200" font-size="18" font-family="monospace" fill="var(--accent)">예제 코드 → 편집기로</text>
  <rect x="260" y="252" width="560" height="128" rx="10" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="280" y="284" font-size="22" font-weight="bold" fill="var(--fg)">③ 편집기 main.py</text>
  <text x="280" y="320" font-size="18" font-family="monospace" fill="var(--muted)">from microbit import *</text>
  <text x="280" y="348" font-size="18" font-family="monospace" fill="var(--muted)">display.scroll("Hi")</text>
  <rect x="690" y="264" width="112" height="38" rx="8" fill="var(--accent)"/><text x="746" y="290" text-anchor="middle" font-size="19" font-weight="bold" fill="#fff">▶ 실행</text>

  <rect x="840" y="40" width="400" height="200" rx="10" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/>
  <text x="860" y="76" font-size="22" font-weight="bold" fill="var(--fg)">④ 시뮬레이터</text>
  <rect x="1050" y="54" width="34" height="30" rx="6" fill="var(--danger)"/><text x="1067" y="76" text-anchor="middle" font-size="18" fill="#fff">■</text>
  <rect x="1094" y="54" width="130" height="30" rx="6" fill="none" stroke="var(--accent2)" stroke-width="2"/><text x="1159" y="76" text-anchor="middle" font-size="18" fill="var(--accent2)">🔌 보드</text>
  ${MB_FIG.board({ x: 870, y: 96, scale: 0.3, labels: false, btnLabel: false, ics: false, leds: '0000009090000009000101110' })}
  <text x="1030" y="130" font-size="17" fill="var(--muted)">LED · 버튼 · 로고</text>
  <text x="1030" y="158" font-size="17" fill="var(--muted)">센서 · 핀 · 부품</text>
  <text x="1030" y="186" font-size="17" fill="var(--muted)">무선 · 파일 · 로그</text>
  <text x="1030" y="214" font-size="17" fill="var(--accent2)">움직임(사람 · 조이스틱)</text>
  <rect x="840" y="252" width="400" height="128" rx="10" fill="#11171c" stroke="var(--line)" stroke-width="2"/>
  <text x="860" y="284" font-size="22" font-weight="bold" fill="#e6edf3">⑤ 콘솔 · 파이썬 셸</text>
  <text x="860" y="320" font-size="18" font-family="monospace" fill="#9fd8d3">print() 결과 · 오류</text>
  <text x="860" y="356" font-size="18" font-family="monospace" fill="#ffd166">&gt;&gt;&gt; 한 줄씩 실행</text>
</svg>`;

  /* ───────── 그림 1-3. 앞으로 만들 두 프로젝트 ───────── */
  const FIG_PROJECTS = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="320" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">프로젝트 1 · 러닝 데이터 측정기</text>
  <rect x="30" y="56" width="580" height="340" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <rect x="54" y="78" width="164" height="78" rx="10" fill="none" stroke="var(--line)" stroke-width="2"/>
  <text x="136" y="108" text-anchor="middle" font-size="17" fill="var(--muted)">걸음 수</text>
  <text x="136" y="142" text-anchor="middle" font-size="26" font-weight="bold" fill="var(--fg)">1,234</text>
  <rect x="238" y="78" width="164" height="78" rx="10" fill="none" stroke="var(--line)" stroke-width="2"/>
  <text x="320" y="108" text-anchor="middle" font-size="17" fill="var(--muted)">케이던스(걸음/분)</text>
  <text x="320" y="142" text-anchor="middle" font-size="26" font-weight="bold" fill="var(--accent)">168</text>
  <rect x="422" y="78" width="164" height="78" rx="10" fill="none" stroke="var(--line)" stroke-width="2"/>
  <text x="504" y="108" text-anchor="middle" font-size="17" fill="var(--muted)">보폭</text>
  <text x="504" y="142" text-anchor="middle" font-size="26" font-weight="bold" fill="var(--fg)">0.9 m</text>
  <path d="M60 360 L580 360 M60 180 L60 360" stroke="var(--line)" stroke-width="2"/>
  <path d="M60 330 L110 300 L160 260 L210 240 L260 236 L310 228 L360 232 L410 226 L460 240 L510 270 L560 300" fill="none" stroke="var(--accent)" stroke-width="4"/>
  <text x="70" y="200" font-size="16" fill="var(--muted)">시간에 따른 케이던스 그래프</text>
  <text x="330" y="386" font-size="17" fill="var(--muted)">+ 메트로놈 비트음 (삐 · 삐 · 삐)</text>

  <text x="960" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">프로젝트 2 · 실내 이동 경로 지도</text>
  <rect x="670" y="56" width="580" height="340" rx="14" fill="var(--code-bg)" stroke="var(--accent2)" stroke-width="3"/>
  <rect x="700" y="80" width="520" height="290" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <path d="M900 80 L900 200 M900 260 L900 370 M1060 230 L1220 230" stroke="var(--fg)" stroke-width="5"/>
  <text x="790" y="110" font-size="17" fill="var(--muted)">교실</text>
  <text x="1110" y="110" font-size="17" fill="var(--muted)">복도</text>
  <text x="1110" y="270" font-size="17" fill="var(--muted)">도서실</text>
  <path d="M760 330 L760 230 L940 230 L1010 160 L1140 160 L1140 300" fill="none" stroke="var(--accent2)" stroke-width="4" stroke-dasharray="10 7" marker-end="url(#c1p)"/>
  <defs><marker id="c1p" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--accent2)"/></marker></defs>
  <circle cx="760" cy="330" r="10" fill="var(--ok)"/><text x="776" y="356" font-size="17" fill="var(--ok)">출발</text>
  <text x="1150" y="340" font-size="17" fill="var(--accent2)">도착</text>
</svg>`;

  /* ───────── 그림 1-4. 단계별 개발 계단 ───────── */
  const FIG_STAIRS = (() => {
    const steps = [
      ['① 문제 정하기', '무엇이 궁금한가?'],
      ['② 잴 것 정하기', '걸음 수? 방향?'],
      ['③ 센서 읽기', '숫자 받아 오기'],
      ['④ 계산하기', '걸음 · 거리 구하기'],
      ['⑤ 저장하기', '기록을 남기기'],
      ['⑥ 보여 주기', '그래프 · 지도'],
      ['⑦ 고치기', '더 정확하게']
    ];
    const w = 170, h = 44;
    return `<svg viewBox="0 0 1280 440" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${steps.map((st, i) => {
      const x = 30 + i * w, y = 380 - (i + 1) * h;
      return `<rect x="${x}" y="${y}" width="${w - 6}" height="${380 - y}" rx="6" fill="${i === 6 ? 'var(--ok)' : 'var(--accent)'}" opacity="${(0.25 + i * 0.1).toFixed(2)}"/>
  <text x="${x + (w - 6) / 2}" y="${y - 40}" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">${st[0]}</text>
  <text x="${x + (w - 6) / 2}" y="${y - 14}" text-anchor="middle" font-size="16" fill="var(--muted)">${st[1]}</text>`;
    }).join('\n  ')}
  <path d="M1010 80 Q1090 30 1170 60" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#c1s)"/>
  <path d="M1190 90 Q1240 220 1150 300" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#c1s)"/>
  <defs><marker id="c1s" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--warn)"/></marker></defs>
  <text x="1080" y="250" text-anchor="end" font-size="18" fill="var(--warn)">고친 뒤 다시 ③부터</text>
  <text x="30" y="420" font-size="20" fill="var(--fg)">한 칸 오를 때마다 <tspan font-weight="bold" fill="var(--accent)">실행해서 확인</tspan>합니다. 문제가 생기면 <tspan font-weight="bold">방금 올라온 칸</tspan>만 보면 됩니다.</text>
</svg>`;
  })();

  /* ───────── 그림 1-5. 함수 = 도구 상자 ───────── */
  const FIG_FUNC = `<svg viewBox="0 0 1280 380" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c1f" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--fg)"/></marker></defs>
  <text x="170" y="60" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">넣는 것 (입력)</text>
  <rect x="60" y="90" width="220" height="70" rx="10" fill="none" stroke="var(--accent)" stroke-width="3"/>
  <text x="170" y="134" text-anchor="middle" font-size="22" fill="var(--accent)">걸음 수 = 1000</text>
  <rect x="60" y="180" width="220" height="70" rx="10" fill="none" stroke="var(--accent)" stroke-width="3"/>
  <text x="170" y="224" text-anchor="middle" font-size="22" fill="var(--accent)">보폭 = 0.7 m</text>
  <path d="M290 170 L420 170" stroke="var(--fg)" stroke-width="4" marker-end="url(#c1f)"/>
  <rect x="440" y="70" width="400" height="200" rx="18" fill="var(--code-bg)" stroke="var(--fg)" stroke-width="4"/>
  <rect x="440" y="70" width="400" height="56" rx="18" fill="var(--accent2)" opacity=".85"/>
  <text x="640" y="108" text-anchor="middle" font-size="22" font-weight="bold" fill="#fff" font-family="monospace">distance(steps, stride)</text>
  <text x="640" y="180" text-anchor="middle" font-size="44" fill="var(--muted)">?</text>
  <text x="640" y="240" text-anchor="middle" font-size="18" fill="var(--muted)">안의 계산은 몰라도 괜찮아요</text>
  <path d="M850 170 L980 170" stroke="var(--fg)" stroke-width="4" marker-end="url(#c1f)"/>
  <text x="1110" y="60" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">나오는 것 (결과)</text>
  <rect x="1000" y="130" width="220" height="80" rx="10" fill="none" stroke="var(--ok)" stroke-width="3"/>
  <text x="1110" y="180" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--ok)">700 m</text>
  <text x="640" y="330" text-anchor="middle" font-size="21" fill="var(--fg)">약속 두 가지만 기억합니다: <tspan font-weight="bold" fill="var(--accent)">무엇을 넣으면</tspan> → <tspan font-weight="bold" fill="var(--ok)">무엇이 나오는가</tspan></text>
</svg>`;

  /* ───────── 그림 1-6. 예상 문제 카드 ───────── */
  const FIG_CARD = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="260" y="20" width="760" height="360" rx="16" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="4"/>
  <rect x="260" y="20" width="760" height="60" rx="16" fill="var(--warn)" opacity=".9"/>
  <text x="640" y="60" text-anchor="middle" font-size="26" font-weight="bold" fill="#fff">예상 문제 카드</text>
  <text x="290" y="122" font-size="20" font-weight="bold" fill="var(--muted)">단계</text>
  <text x="440" y="122" font-size="21" fill="var(--fg)">④ 계산하기 — 버튼으로 수 세기</text>
  <text x="290" y="172" font-size="20" font-weight="bold" fill="var(--muted)">이렇게 하면</text>
  <text x="440" y="172" font-size="21" fill="var(--fg)">버튼을 아주 빠르게 여러 번 누르면?</text>
  <text x="290" y="222" font-size="20" font-weight="bold" fill="var(--danger)">생길 문제</text>
  <text x="440" y="222" font-size="21" fill="var(--fg)">눌린 횟수보다 적게 / 많게 셀 수 있다</text>
  <text x="290" y="272" font-size="20" font-weight="bold" fill="var(--ok)">해결 아이디어</text>
  <text x="440" y="272" font-size="21" fill="var(--fg)">was_pressed() 쓰기, sleep 시간 줄이기</text>
  <text x="290" y="322" font-size="20" font-weight="bold" fill="var(--muted)">확인 방법</text>
  <text x="440" y="322" font-size="21" fill="var(--fg)">10번 눌러 보고 화면 숫자와 비교</text>
</svg>`;

  MB_COURSE.addChapter({
    id: 'ch01', no: '01',
    title: '마이크로비트와 프로젝트 준비',
    subtitle: 'micro:bit V2 · 강좌 화면 · 버튼 입력 · 실제 보드 · 단계별 개발 · 함수 도구 상자',
    summary: '이 강좌에서는 micro:bit 로 <b>러닝 데이터 측정기</b>와 <b>실내 이동 경로 지도</b>, 두 가지 프로젝트를 만듭니다. 첫 챕터에서는 보드와 강좌 화면(편집기 · 시뮬레이터 · 움직임 조이스틱 · 파이썬 셸)을 익히고, 같은 코드를 실제 보드에서도 실행해 봅니다. 그리고 큰 프로젝트를 <b>한 계단씩</b> 만들고, 생길 문제를 <b>미리 토론</b>하는 방법을 배웁니다.',
    goals: [
      'micro:bit V2 의 LED · 버튼 · 로고 · 센서 · 스피커 · 마이크 위치를 말할 수 있다',
      '강좌 화면에서 코드를 실행 · 중지하고, 파이썬 셸로 한 줄씩 실험할 수 있다',
      '<code>display.scroll()</code> · <code>display.show()</code> · <code>button_a.was_pressed()</code> 로 첫 프로그램을 만들 수 있다',
      '실제 micro:bit 를 USB 로 연결해 같은 프로그램을 실행할 수 있다',
      '프로젝트를 7단계 계단으로 나누어 만들고, 단계마다 예상 문제를 토론할 수 있다',
      '함수(<code>def</code>)를 “넣는 것 → 나오는 것” 이 정해진 도구로 이해하고 쓸 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch01-1',
        title: '시뮬레이터와 실제 보드 둘러보기',
        minutes: 50,
        goals: [
          'micro:bit V2 의 주요 부품과 위치를 그림에서 찾을 수 있다',
          '강좌 화면의 목차 · 문서 · 편집기 · 시뮬레이터 · 셸을 쓸 수 있다',
          '<code>scroll</code> · <code>show</code> · <code>sleep</code> · <code>while True:</code> · <code>was_pressed()</code> 로 프로그램을 만들 수 있다',
          '움직임 조이스틱과 실제 보드로 같은 코드를 실행해 볼 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['보드 둘러보기', 8], ['화면 구성 · 첫 프로그램', 12], ['버튼 입력', 8], ['움직임 맛보기', 5], ['실제 보드 연결', 7], ['실습 · 프로젝트 미리보기', 5]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '스마트워치나 휴대폰은 내가 <b>몇 걸음 걸었는지</b> 어떻게 알까요? 떠오르는 방법을 <b>한 가지</b> 적어 오세요. 정답이 없어도 괜찮습니다. “팔을 흔드는 횟수를 센다”, “몸이 위아래로 흔들리는 것을 느낀다”처럼 내 생각을 그대로 쓰면 됩니다.' },
          { type: 'p', html: '수업을 시작하며 적어 온 생각을 짝과 나눠 봅니다. 많은 기기는 몸이 흔들리는 것을 느끼는 <b>센서(sensor)</b>를 씁니다. 걸을 때마다 몸이 “쿵” 하고 한 번씩 흔들리니까, 그 흔들림을 세면 걸음 수가 됩니다. 우리 micro:bit 에도 바로 그 센서가 들어 있습니다.' },

          { type: 'h', text: 'micro:bit V2 한눈에 보기' },
          { type: 'p', html: 'micro:bit 는 손바닥보다 작은 <b>컴퓨터</b>입니다. 작지만 화면, 버튼, 스피커, 마이크, 그리고 여러 센서가 다 들어 있어서 따로 부품을 사지 않아도 많은 것을 만들 수 있습니다. 이 강좌는 그중 <b>V2</b>(두 번째 버전) 보드를 씁니다.' },
          { type: 'figure', html: FIG_BOARD, caption: '그림 1-1. micro:bit V2 의 앞면과 뒷면' },
          {
            type: 'table', head: ['부품', '하는 일', '이 강좌에서 쓰는 곳'], rows: [
              ['5×5 LED 화면', '빨간 불 25개로 글자 · 그림을 보여 줌', '걸음 수 · 방향 표시'],
              ['A · B 버튼', '눌렀는지 알려 줌', '측정 시작 · 멈춤, 기록 지우기'],
              ['로고(터치)', '손가락을 대면 알아챔', '추가 버튼으로 쓰기'],
              ['가속도 센서', '흔들림 · 기울기를 잼', '걸음 세기, 걷기 · 뛰기 구분'],
              ['지자기(나침반) 센서', '북쪽이 어디인지 잼', '실내에서 어느 쪽으로 가는지'],
              ['스피커', '소리를 냄', '메트로놈 비트음'],
              ['마이크', '주변 소리 크기를 잼', '(이 강좌에서는 조금만)']
            ], caption: '표 1-1. micro:bit V2 의 주요 부품'
          },
          { type: 'callout', kind: 'tip', title: '센서는 “숫자를 만드는 눈 · 귀”', html: '센서는 세상의 변화를 <b>숫자</b>로 바꿔 줍니다. 흔들림이 크면 큰 숫자, 작으면 작은 숫자가 나옵니다. 프로그램은 이 숫자를 보고 판단합니다. 센서가 내는 숫자는 다음 챕터에서 자세히 살펴봅니다.' },

          { type: 'h', text: '강좌 화면 구성' },
          { type: 'p', html: '이 강좌 화면은 세 칸으로 나뉩니다. 왼쪽에서 공부할 곳을 고르고, 가운데에서 읽고 코드를 고치고, 오른쪽에서 결과를 봅니다.' },
          { type: 'figure', html: FIG_SCREEN, caption: '그림 1-2. 강좌 화면 — 목차 · 문서와 편집기 · 시뮬레이터와 셸' },
          {
            type: 'list', ordered: true, items: [
              '<b>목차</b>: 챕터와 교시를 고릅니다. 다 본 교시는 진도에 표시됩니다.',
              '<b>문서</b>: 지금 읽고 있는 설명입니다. 예제 코드 옆의 <b>▶ 실행</b>을 누르면 바로 돌아갑니다.',
              '<b>편집기(<code>main.py</code>)</b>: 코드를 직접 고치는 곳입니다. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 또는 <b>▶ 실행</b>.',
              '<b>시뮬레이터</b>: 화면 속 가상의 micro:bit 입니다. 버튼을 마우스로 누를 수 있고, 아래 탭에서 센서 · 핀 · 부품을 조작합니다.',
              '<b>콘솔 · 파이썬 셸</b>: <code>print()</code> 결과와 오류가 나옵니다. 맨 아래 <code>&gt;&gt;&gt;</code> 칸에는 파이썬을 한 줄씩 넣어 볼 수 있습니다.'
            ]
          },
          { type: 'callout', kind: 'warn', title: '끝나지 않는 프로그램은 ■ 중지로', html: '<code>while True:</code> 가 들어간 프로그램은 스스로 끝나지 않습니다. 다른 예제를 실행하기 전에 <b>■ 중지</b>를 누르세요. ▶ 실행을 다시 누르면 앞 프로그램은 멈추고 새로 시작합니다.' },
          { type: 'callout', kind: 'tip', title: '같은 예제를 블록으로도 볼 수 있습니다', html: '예제 옆의 <b>🧩 블록</b>을 누르면 그 코드가 MakeCode 와 같은 모양의 블록으로 바뀝니다. 블록을 끌어다 고치고 <b>▶ 실행</b>하면 오른쪽 시뮬레이터(또는 연결한 보드)에서 돌아갑니다. <b>💾 MakeCode 파일</b>로 저장한 뒤 makecode.microbit.org 의 <b>가져오기 → 파일 가져오기</b>로 열면 MakeCode 에서도 같은 블록으로 이어서 할 수 있습니다. 블록으로 바꿀 수 없는 줄은 회색 <b>파이썬</b> 블록으로 남습니다.' },

          { type: 'h', text: '첫 프로그램 — 화면에 인사하기' },
          { type: 'p', html: 'micro:bit 에게 처음으로 말을 시켜 봅니다. 아래 예제의 <b>▶ 실행</b>을 누르고 오른쪽 보드 화면을 보세요.' },
          {
            type: 'code', title: '예제 1-1. Hi 흘려보내기', code: `from microbit import *

display.scroll("Hi")`,
            desc: '<code>from microbit import *</code> 는 “micro:bit 도구를 모두 꺼내 와라”라는 뜻으로, <b>모든 프로그램의 첫 줄</b>에 씁니다. <code>display.scroll()</code> 은 화면(<code>display</code>)에 글자를 <b>오른쪽에서 왼쪽으로 흘려보냅니다</b>. 화면이 5칸뿐이라 긴 글자는 흘려야 다 보입니다.',
            expect: 'LED 화면에 Hi 가 오른쪽에서 왼쪽으로 한 번 흘러갑니다.'
          },
          {
            type: 'code', title: '예제 1-2. 그림 보여 주고 기다리기', code: `from microbit import *

display.show(Image.HEART)   # 하트 그림
sleep(1000)                 # 1000ms = 1초 기다리기
display.show(Image.HAPPY)   # 웃는 얼굴
sleep(1000)
display.clear()             # 화면 끄기`,
            desc: '<code>display.show()</code> 는 그림이나 글자 하나를 <b>그대로 멈춰서</b> 보여 줍니다. <code>sleep(1000)</code> 은 1000밀리초(=1초) 동안 기다립니다. <code>#</code> 뒤는 <b>주석</b>이라 컴퓨터가 읽지 않는 메모입니다.',
            expect: '하트가 1초, 웃는 얼굴이 1초 보인 뒤 화면이 꺼집니다.'
          },
          { type: 'figure', html: `<div style="text-align:center">${MB_FIG.tile('0909099999999990999000900', 'Image.HEART')}${MB_FIG.tile('0000009090000009000909990', 'Image.HAPPY')}${MB_FIG.tile('0000009090000000999090009', 'Image.SAD')}${MB_FIG.tile('9000909090009000909090009', 'Image.NO')}${MB_FIG.tile('0000000009000909090009000', 'Image.YES')}</div>`, caption: '그림 1-3. 자주 쓰는 내장 그림(Image)' },
          {
            type: 'code', title: '예제 1-3. 하트 깜빡이기 — while True:', code: `from microbit import *

while True:
    display.show(Image.HEART)
    sleep(500)
    display.clear()
    sleep(500)`,
            desc: '<code>while True:</code> 는 “<b>계속 반복해라</b>”라는 뜻입니다. 콜론(<code>:</code>) 다음 줄부터 <b>공백 4칸 들여쓴 줄</b>이 반복됩니다. <code>sleep()</code> 숫자를 <code>100</code> 으로 바꾸면 빨리, <code>1000</code> 으로 바꾸면 천천히 깜빡입니다.',
            expect: '하트가 0.5초 간격으로 계속 깜빡입니다. (■ 중지로 멈춤)'
          },
          { type: 'callout', kind: 'tip', title: '들여쓰기 = 한 덩어리 표시', html: '파이썬은 <b>들여쓰기</b>로 “어디까지 반복하는지”를 알아봅니다. 공백 4칸이 약속입니다. 들여쓰기를 빼먹으면 그 줄은 반복 밖으로 나가 버립니다.' },
          { type: 'p', html: '코드를 한 줄씩 바로 확인하고 싶을 때는 <b>파이썬 셸</b>을 씁니다. 콘솔 아래 <code>&gt;&gt;&gt;</code> 칸에 한 줄씩 입력하고 <kbd>Enter</kbd> 를 누르세요.' },
          {
            type: 'code', title: '예제 1-4. 셸에서 한 줄씩 실험하기', repl: true, code: `display.show(Image.HEART)
display.scroll("OK")
temperature()
3 * 60`,
            desc: '셸에서는 <code>from microbit import *</code> 가 이미 되어 있습니다. <code>temperature()</code> 처럼 값을 돌려주는 줄은 결과가 바로 찍힙니다. 셸은 계산기처럼도 쓸 수 있습니다.',
            expect: '>>> temperature()\n20  (보드 온도 — 🧭 센서 탭에서 바꿀 수 있음)\n>>> 3 * 60\n180',
            nondeterministic: true
          },

          { type: 'h', text: '버튼 입력 — 누르면 바뀌는 그림' },
          { type: 'p', html: '이제 micro:bit 가 우리 말을 <b>들을</b> 차례입니다. <code>button_a.was_pressed()</code> 는 “지난번에 물어본 뒤로 A 버튼이 <b>눌린 적 있니?</b>”를 묻고 <code>True</code>(예) 또는 <code>False</code>(아니요)로 답합니다.' },
          {
            type: 'code', title: '예제 1-5. A 는 하트, B 는 웃는 얼굴', code: `from microbit import *

while True:
    if button_a.was_pressed():
        display.show(Image.HEART)
    if button_b.was_pressed():
        display.show(Image.HAPPY)
    sleep(20)`,
            desc: '<code>while True:</code> 로 계속 버튼을 살피다가 눌린 버튼에 맞는 그림을 보여 줍니다. 맨 끝 <code>sleep(20)</code> 은 0.02초 쉬는 것으로, 보드가 너무 바쁘지 않게 해 줍니다.',
            hint: '보드 그림의 <b>A 버튼</b>, <b>B 버튼</b>을 마우스로 누르거나 키보드 <kbd>A</kbd> · <kbd>B</kbd> 를 눌러 보세요.',
            expect: 'A 를 누르면 하트, B 를 누르면 웃는 얼굴이 나타납니다.'
          },
          {
            type: 'table', head: ['방법', '묻는 것', '어울리는 때'], rows: [
              ['<code>button_a.was_pressed()</code>', '그동안 <b>한 번이라도 눌렸니?</b>', '누를 때마다 한 번씩 반응 (그림 바꾸기, 수 세기)'],
              ['<code>button_a.is_pressed()</code>', '<b>지금</b> 누르고 있니?', '누르고 있는 동안 계속 반응 (누르는 동안만 불 켜기)']
            ], caption: '표 1-2. was_pressed() 와 is_pressed() 의 차이'
          },
          {
            type: 'code', title: '예제 1-6. 누르고 있는 동안만 하트', code: `from microbit import *

while True:
    if button_a.is_pressed():
        display.show(Image.HEART)
    else:
        display.clear()
    sleep(20)`,
            desc: '<code>is_pressed()</code> 는 <b>지금 이 순간</b>을 봅니다. 누르고 있으면 하트, 손을 떼면 <code>else:</code>(그렇지 않으면) 쪽이 실행되어 화면이 꺼집니다.',
            hint: '보드의 <b>A 버튼</b>을 꾹 누르고 있다가 떼 보세요.',
            expect: 'A 를 누르고 있는 동안만 하트가 보입니다.'
          },

          { type: 'h', text: '움직임 시뮬레이션 맛보기' },
          { type: 'p', html: '이 강좌의 두 프로젝트는 모두 <b>사람이 움직일 때</b> 보드가 무엇을 느끼는지가 핵심입니다. 그런데 교실에서 매번 뛰어다닐 수는 없겠지요? 그래서 시뮬레이터에 <b>가상의 사람</b>과 <b>움직임 조이스틱</b>을 넣었습니다. 가상의 사람이 보드를 차고 <b>멈춤 · 걷기 · 뛰기 · 방향 전환</b>을 하면, 보드도 실제처럼 흔들리고 방향이 바뀝니다.' },
          {
            type: 'code', title: '예제 1-7. 얼마나 세게 움직이나? (맛보기)', code: `from microbit import *
import math

def move_power():
    # 흔들림의 세기를 숫자 하나로 (지금은 몰라도 됩니다)
    x, y, z = accelerometer.get_values()
    return math.sqrt(x * x + y * y + z * z)

while True:
    p = move_power()
    if p > 1600:
        display.show(Image.SURPRISED)   # 뛰기
    elif p > 1150:
        display.show(Image.HAPPY)       # 걷기
    else:
        display.show(Image.ASLEEP)      # 멈춤
    sleep(100)`,
            desc: '<code>move_power()</code> 는 흔들림의 세기를 숫자 하나로 알려 주는 <b>미리 만든 도구(함수)</b>입니다. 안의 계산은 지금 몰라도 됩니다. 숫자가 크면 뛰는 중, 중간이면 걷는 중, 작으면 멈춘 것으로 보고 얼굴을 바꿉니다. 기준 숫자(<code>1600</code>, <code>1150</code>)는 대략 정한 값이라 다음 챕터에서 직접 재서 다시 정합니다.',
            hint: '시뮬레이터의 <b>움직임 조이스틱</b>으로 가상의 사람을 멈춤 → 걷기 → 뛰기로 바꿔 보세요. 조이스틱을 옆으로 밀면 방향이 바뀝니다.',
            expect: '멈춤이면 자는 얼굴, 걷기면 웃는 얼굴, 뛰기면 놀란 얼굴이 됩니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '움직임 조이스틱 대신 <b>🧭 센서</b> 탭의 <b>기울기 판</b>을 마우스로 흔들거나 <b>흔들기(shake)</b> 제스처 버튼을 눌러도 비슷한 실험을 할 수 있습니다.' },
          { type: 'callout', kind: 'tip', title: '어려운 계산은 함수로 감싸 둡니다', html: '이 강좌에서는 어려운 계산을 <code>move_power()</code> 처럼 <b>함수 하나로 감싸서</b> 드립니다. 여러분은 “무엇을 넣으면 무엇이 나오는지”만 알면 됩니다. 이 약속은 2교시에서 더 자세히 배웁니다.' },

          { type: 'h', text: '실제 보드 연결하기' },
          { type: 'p', html: '시뮬레이터에서 잘 되면 <b>진짜 micro:bit</b> 에서도 똑같이 실행해 봅니다. 몸에 차고 직접 걷거나 뛰는 실험은 실제 보드로만 할 수 있습니다.' },
          {
            type: 'list', ordered: true, items: [
              'micro:bit 와 컴퓨터를 <b>USB 케이블</b>로 연결합니다. 보드 뒷면의 노란 불이 켜지면 전원이 들어온 것입니다.',
              '<b>Chrome</b> 또는 <b>Edge</b> 브라우저에서 시뮬레이터 위쪽의 <b>🔌 보드</b> 버튼을 누릅니다.',
              '목록에서 micro:bit(이름에 <code>mbed</code> 나 <code>micro:bit</code> 가 들어간 장치)를 고르고 <b>연결</b>을 누릅니다.',
              '실행 대상이 <b>시뮬레이터 → 보드</b>로 바뀐 것을 확인하고 <b>▶ 실행</b>을 누릅니다. 코드는 보드에 <code>main.py</code> 로 저장되어, USB 를 빼고 배터리를 연결해도 계속 돌아갑니다.'
            ]
          },
          {
            type: 'table', head: ['증상', '확인할 것'], rows: [
              ['🔌 보드를 눌러도 목록이 비어 있음', '<b>케이블</b>: 충전 전용 케이블은 데이터가 안 갑니다. 다른 케이블로 바꿔 보세요.'],
              ['버튼을 눌러도 아무 창이 안 뜸', '<b>브라우저</b>: Chrome · Edge 만 됩니다(Web Serial). 주소가 <code>localhost</code> 또는 <code>https</code> 인지 확인합니다.'],
              ['연결은 되는데 “응답하지 않습니다”', '<b>펌웨어</b>: 보드에 MicroPython 이 깔려 있어야 합니다. python.microbit.org 에서 한 번 설치합니다.'],
              ['잘 되다가 갑자기 끊김', '케이블이 흔들렸는지, 다른 프로그램(다른 탭)이 보드를 쓰고 있는지 확인합니다.']
            ], caption: '표 1-3. 보드 연결이 안 될 때'
          },
          { type: 'callout', kind: 'board', html: '실제 보드에서는 <b>시뮬레이터보다 조금 느리거나 빠르게</b> 느껴질 수 있고, 센서 값도 매번 조금씩 다릅니다. 진짜 세상의 숫자는 늘 조금씩 흔들립니다. 이 “흔들림”을 다루는 방법이 앞으로 우리 프로젝트의 중요한 숙제입니다.' },

          { type: 'h', text: '수업 실습 — 내 이름과 버튼 그림' },
          { type: 'p', html: '<b>★ 그대로 따라 하기</b>: 아래 예제의 <code>"MINJI"</code> 를 <b>내 이름(영문)</b>으로 바꾸고 시뮬레이터에서 실행합니다. 그다음 🔌 보드로 실제 보드에서도 실행합니다. <b>★★ 값 바꿔 보기</b>: 그림을 다른 내장 그림으로 바꿔 봅니다. <b>★★★ 기능 더하기</b>: 로고를 만지면 이름이 다시 흐르게 만들어 봅니다.' },
          {
            type: 'code', title: '예제 1-8. 내 이름 + 버튼 그림', code: `from microbit import *

display.scroll("MINJI")      # 내 이름으로 바꾸기

while True:
    if button_a.was_pressed():
        display.show(Image.HEART)
    if button_b.was_pressed():
        display.show(Image.HAPPY)
    sleep(20)`,
            desc: '처음에 이름이 한 번 흐른 뒤, 버튼을 기다립니다. 이름이 다 흐를 때까지는 다음 줄로 넘어가지 않는다는 것도 확인해 보세요.',
            hint: '이름이 다 흐른 뒤 <b>A</b> · <b>B</b> 버튼을 눌러 보세요.',
            expect: '이름이 흐른 뒤, A 를 누르면 하트, B 를 누르면 웃는 얼굴이 나타납니다.'
          },
          {
            type: 'code', title: '도전 1-9. 로고를 만지면 이름 다시 보기 (★★★)', code: `from microbit import *

display.scroll("MINJI")

while True:
    if button_a.was_pressed():
        display.show(Image.HEART)
    if button_b.was_pressed():
        display.show(Image.HAPPY)
    if pin_logo.is_touched():
        display.scroll("MINJI")
    sleep(20)`,
            desc: '<code>pin_logo.is_touched()</code> 는 금색 로고를 손가락으로 만지고 있는지 알려 줍니다. 로고 터치는 V2 보드에만 있는 기능입니다.',
            hint: '보드 그림 위쪽의 금색 <b>로고</b>를 눌러 보세요.',
            expect: '로고를 만지면 이름이 다시 흘러갑니다.'
          },

          { type: 'h', text: '앞으로 만들 두 프로젝트' },
          { type: 'p', html: '이 강좌가 끝나면 아래 두 화면을 직접 만들게 됩니다. 지금 배운 <b>화면 · 버튼 · 반복</b>이 모두 그 바탕이 됩니다.' },
          { type: 'figure', html: FIG_PROJECTS, caption: '그림 1-4. 러닝 데이터 측정기(왼쪽)와 실내 이동 경로 지도(오른쪽)' },
          {
            type: 'list', items: [
              '<b>프로젝트 1 · 러닝 데이터 측정기</b>: 달리는 동안 걸음 수, 1분에 몇 걸음 뛰는지(<b>케이던스</b>), 한 걸음의 길이(<b>보폭</b>)를 재고, 일정한 박자로 “삐” 소리를 내 주는 <b>메트로놈</b>도 만듭니다. 기록은 웹 화면에서 그래프로 봅니다.',
              '<b>프로젝트 2 · 실내 이동 경로 지도</b>: GPS 가 잘 안 되는 건물 안에서, 걸음 수와 나침반 방향으로 <b>어디로 얼마나 갔는지</b> 추적합니다. 가상의 교실 · 복도를 직접 그려서 그 위에 이동 경로를 표시합니다.'
            ]
          },
          { type: 'callout', kind: 'more', title: '왜 실내에서는 GPS 가 어려울까요?', html: 'GPS 는 하늘의 인공위성 신호를 받아 위치를 알아냅니다. 지붕과 벽이 있는 건물 안에서는 신호가 약해지거나 막힙니다. 그래서 실내에서는 <b>내 몸의 움직임</b>으로 위치를 짐작하는 방법을 씁니다. 이것이 프로젝트 2 의 아이디어입니다.' }
        ],
        slides: [
          { layout: 'title', title: '시뮬레이터와 실제 보드 둘러보기', subtitle: 'Chapter 01 · 마이크로비트와 프로젝트 준비', badge: '1교시', notes: '<p>강좌 첫 시간입니다. 반갑게 인사하고, 오늘은 보드와 화면을 익히고 첫 프로그램을 만든다고 안내합니다.</p><p>💬 “micro:bit 를 본 적 있는 사람?” — 손을 들게 해 경험 수준을 파악합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 걸음 수는 어떻게 셀까?', lead: '적어 온 생각을 짝과 나눠 봅시다', bullets: ['팔을 흔드는 횟수?', '몸이 위아래로 흔들리는 것?', '발이 땅에 닿는 충격?', '→ 흔들림을 느끼는 <b>센서</b>'], notes: '<p>수업 전 “생각하기” 답을 2~3명 발표시킵니다.</p><p>💬 “휴대폰을 주머니에 넣고 걸어도 걸음이 세어지던데 왜일까요?” — 예상 답: 흔들려서, 센서가 있어서.</p><p>정답을 주기보다 “흔들림을 센다”는 공통점으로 모아 줍니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: 'micro:bit V2 한눈에 보기', html: FIG_BOARD, caption: '앞면: 화면 · 버튼 · 로고 · 스피커 · 마이크 / 뒷면: 센서', notes: '<p>실물 보드를 들고 앞면 · 뒷면을 함께 보여 줍니다.</p><p>💬 “걸음을 세는 데 필요한 부품은 어디 있을까요?” — 예상 답: 뒷면 센서.</p><p>가속도 센서와 지자기 센서가 이 강좌의 주인공이라고 강조합니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '부품과 프로젝트의 연결', head: ['부품', '프로젝트에서'], rows: [['가속도 센서', '걸음 세기 · 걷기/뛰기'], ['지자기 센서', '가는 방향'], ['스피커', '메트로놈 비트음'], ['A · B 버튼', '시작 · 멈춤'], ['LED 화면', '결과 보기']], notes: '<p>표를 보며 “왜 이 부품이 필요한지”를 프로젝트와 연결합니다.</p><p>💬 “메트로놈 소리는 어느 부품이 낼까요?” — 스피커.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '강좌 화면 구성', html: FIG_SCREEN, notes: '<p>실제 화면을 띄워 ①~⑤ 를 차례로 가리킵니다. 특히 <b>▶ 실행</b>, <b>■ 중지</b>, <b>&gt;&gt;&gt; 셸</b> 위치를 꼭 짚어 줍니다.</p><p>주의: 반복 프로그램은 ■ 중지 후 다음 예제를 실행하도록 안내합니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '첫 프로그램', code: `from microbit import *

display.scroll("Hi")
display.show(Image.HEART)
sleep(1000)
display.show(Image.HAPPY)`, points: ['<code>from microbit import *</code> — 첫 줄 약속', '<code>scroll</code> 흘리기 · <code>show</code> 멈춰 보이기', '<code>sleep(1000)</code> = 1초 기다리기'], notes: '<p>슬라이드에서 바로 ▶ 실행해 보여 줍니다. 학생들도 따라 실행합니다.</p><p>💬 “sleep 숫자를 3000 으로 바꾸면?” — 3초 기다림.</p><p>따옴표 · 괄호는 영문 자판으로 입력하도록 주의를 줍니다.</p><p>시간: 5분</p>' },
          { layout: 'code', title: '계속 반복 — while True:', code: `from microbit import *

while True:
    display.show(Image.HEART)
    sleep(500)
    display.clear()
    sleep(500)`, points: ['콜론(:) 다음 줄 <b>공백 4칸</b>', '들여쓴 줄만 반복', '멈출 때는 ■ 중지'], notes: '<p>들여쓰기를 일부러 지운 버전도 보여 주면 효과적입니다 (sleep(500) 한 줄을 내어 쓰면 반복이 깨짐).</p><p>💬 “빨리 깜빡이게 하려면?” — sleep 숫자를 줄인다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '버튼 입력 — was_pressed()', code: `from microbit import *

while True:
    if button_a.was_pressed():
        display.show(Image.HEART)
    if button_b.was_pressed():
        display.show(Image.HAPPY)
    sleep(20)`, points: ['<code>was_pressed()</code>: 눌린 적 있니?', '<code>is_pressed()</code>: 지금 누르고 있니?', '<code>if</code> — 맞을 때만 실행'], notes: '<p>키보드 A · B 로도 누를 수 있다고 알려 줍니다.</p><p>💬 “is_pressed 로 바꾸면 무엇이 달라질까요?” — 누르는 동안만 반응. 표 1-2 로 정리합니다.</p><p>시간: 8분</p>' },
          { layout: 'code', title: '움직임 맛보기 — 조이스틱', code: `from microbit import *
import math

def move_power():
    x, y, z = accelerometer.get_values()
    return math.sqrt(x * x + y * y + z * z)

while True:
    p = move_power()
    if p > 1600:
        display.show(Image.SURPRISED)
    elif p > 1150:
        display.show(Image.HAPPY)
    else:
        display.show(Image.ASLEEP)
    sleep(100)`, points: ['조이스틱: 멈춤 · 걷기 · 뛰기 · 방향', '<code>move_power()</code> = 미리 만든 도구', '자세한 원리는 다음 챕터'], notes: '<p>조이스틱을 직접 조작하며 얼굴이 바뀌는 것을 보여 줍니다. 원리 설명은 하지 않습니다 (ch02 에서 다룸).</p><p>💬 “걸을 때와 뛸 때 무엇이 다를까요?” — 흔들림의 세기.</p><p>조이스틱이 보이지 않으면 🧭 센서 탭의 흔들기 제스처로 대신합니다.</p><p>시간: 5분</p>' },
          { layout: 'bullets', title: '실제 보드 연결', bullets: ['USB 케이블로 연결', 'Chrome · Edge → <b>🔌 보드</b>', '장치 고르고 연결 → ▶ 실행', ['안 되면?', ['케이블(충전 전용 X)', '브라우저 · 주소(localhost)', '펌웨어(MicroPython)']]], notes: '<p>교사 보드로 먼저 시연한 뒤 모둠별로 연결합니다.</p><p>주의: 충전 전용 케이블이 가장 흔한 원인입니다. 여분 케이블을 준비해 두세요. 펌웨어는 수업 전에 미리 설치해 두는 것을 권장합니다.</p><p>시간: 7분</p>' },
          { layout: 'practice', title: '실습 — 내 이름과 버튼 그림', desc: '내 이름을 스크롤하고, A 는 하트 · B 는 웃는 얼굴. 시뮬레이터와 실제 보드 모두에서 실행하기. (★★★ 로고를 만지면 이름 다시)', starter: `from microbit import *

display.scroll("NAME")   # 내 이름으로

while True:
    # TODO: A 는 하트, B 는 웃는 얼굴
    sleep(20)`, solution: `from microbit import *

display.scroll("MINJI")

while True:
    if button_a.was_pressed():
        display.show(Image.HEART)
    if button_b.was_pressed():
        display.show(Image.HAPPY)
    if pin_logo.is_touched():
        display.scroll("MINJI")
    sleep(20)`, notes: '<p>★ 학생은 예제 1-8 을 그대로, ★★ 학생은 그림 바꾸기, ★★★ 학생은 로고 터치를 더합니다.</p><p>보드에서 실행한 모둠은 손을 들게 해 확인합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '앞으로 만들 두 프로젝트', html: FIG_PROJECTS, notes: '<p>두 프로젝트의 완성 모습을 보여 주며 기대감을 줍니다.</p><p>💬 “건물 안에서 GPS 가 잘 안 되는 이유는?” — 지붕 · 벽이 신호를 막음.</p><p>시간: 1분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['micro:bit V2: 화면 · 버튼 · 로고 · 센서 · 스피커 · 마이크', '<code>scroll</code> · <code>show</code> · <code>sleep</code> · <code>while True:</code>', '<code>was_pressed()</code> 로 버튼 입력', '조이스틱으로 움직임 시뮬레이션', '🔌 보드로 같은 코드를 실제 보드에서'], notes: '<p>오늘 배운 다섯 가지를 함께 읽습니다.</p><p>다음 시간 “생각하기”: 큰 프로그램을 한 번에 만들었는데 동작하지 않으면 어디가 잘못됐는지 어떻게 찾을까요? 를 미리 안내합니다.</p><p>시간: 1분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch01-2',
        title: '프로젝트를 만드는 방법 — 단계별 개발과 토론',
        minutes: 50,
        goals: [
          '프로젝트를 7단계 계단으로 나누고, 단계마다 실행해 확인하는 까닭을 말할 수 있다',
          '변수 · 계산 · <code>if/elif/else</code> · <code>while True:</code> · <code>print()</code> 를 쓸 수 있다',
          '함수(<code>def</code>)를 만들고, 미리 만든 함수를 “넣는 것 → 나오는 것”으로 쓸 수 있다',
          '예상 문제 카드를 쓰고 모둠에서 해결 아이디어를 나눌 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['단계별 개발 계단', 8], ['파이썬 기초 빠르게', 12], ['함수 = 도구 상자', 8], ['버튼 카운터 실습', 10], ['예상 문제 토론 · 정리', 7]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '큰 프로그램을 한 번에 다 만들고 처음 실행했더니 <b>동작하지 않습니다</b>. 어디가 잘못됐는지 어떻게 찾을까요? 내가 쓸 방법을 한 가지 적어 오세요.' },
          { type: 'p', html: '100줄을 한꺼번에 쓰고 처음 실행했는데 안 된다면, 잘못된 곳은 100줄 중 어디에나 있을 수 있습니다. 그런데 <b>10줄 쓰고 실행, 또 10줄 쓰고 실행</b>했다면? 문제는 <b>방금 쓴 10줄</b> 안에 있습니다. 이것이 오늘 배울 <b>단계별 개발</b>의 핵심입니다.' },

          { type: 'h', text: '단계별 개발 — 7칸 계단' },
          { type: 'p', html: '이 강좌의 두 프로젝트는 모두 아래 <b>7칸 계단</b>을 한 칸씩 올라가며 만듭니다. 한 칸을 오를 때마다 <b>실행해서 확인</b>하고, 잘 되면 다음 칸으로 갑니다.' },
          { type: 'figure', html: FIG_STAIRS, caption: '그림 1-5. 단계별 개발 계단 — 한 칸 오를 때마다 실행해서 확인' },
          {
            type: 'table', head: ['단계', '러닝 데이터 측정기에서', '실내 이동 경로 지도에서'], rows: [
              ['① 문제 정하기', '나는 얼마나 일정하게 뛸까?', '나는 건물 안에서 어디로 갔을까?'],
              ['② 잴 것 정하기', '걸음 수 · 케이던스 · 보폭', '걸음 수 · 방향'],
              ['③ 센서 읽기', '가속도 센서', '가속도 센서 + 지자기 센서'],
              ['④ 계산하기', '1분당 걸음 수, 거리', '한 걸음마다 위치 옮기기'],
              ['⑤ 저장하기', '시간별 기록', '지나간 점들의 기록'],
              ['⑥ 보여 주기', '웹 화면 그래프', '웹 화면 지도'],
              ['⑦ 고치기', '잘못 센 걸음 줄이기', '방향 오차 줄이기']
            ], caption: '표 1-4. 두 프로젝트를 7단계로 나누면'
          },
          { type: 'callout', kind: 'tip', title: '확인은 print() 로', html: '단계마다 <code>print()</code> 로 값을 콘솔에 찍어 보면 “지금 숫자가 제대로 나오는지” 바로 알 수 있습니다. 개발자들이 가장 많이 쓰는 확인 방법입니다.' },

          { type: 'h', text: '프로젝트에 필요한 파이썬 기초 — 빠르게' },
          { type: 'p', html: '<b>변수(variable)</b>는 값을 담아 두는 <b>이름표 붙은 상자</b>입니다. <code>steps = 0</code> 은 “steps 라는 상자에 0 을 넣어라”라는 뜻입니다. <code>=</code> 는 “같다”가 아니라 “<b>넣어라</b>”입니다.' },
          {
            type: 'code', title: '예제 1-10. 변수와 계산', code: `from microbit import *

steps = 0                # 걸음 수 상자
steps = steps + 1        # 하나 늘리기
steps = steps + 1
print("걸음 수:", steps)

stride = 0.7             # 보폭 0.7m
distance = steps * stride
print("거리(m):", distance)`,
            desc: '<code>steps = steps + 1</code> 은 “지금 값에 1 을 더해서 다시 넣어라”입니다. 걸음을 셀 때 계속 쓰게 될 모양입니다. <code>print()</code> 는 쉼표로 여러 값을 이어서 콘솔에 찍습니다.',
            expect: '걸음 수: 2\n거리(m): 1.4'
          },
          {
            type: 'code', title: '예제 1-11. 셸을 계산기로', repl: true, code: `7 + 3
10 / 4
10 // 4
120 * 60`,
            desc: '<code>/</code> 는 소수까지 나누기, <code>//</code> 는 <b>몫만</b> 구하기입니다. <code>*</code> 는 곱하기입니다.',
            expect: '>>> 7 + 3\n10\n>>> 10 / 4\n2.5\n>>> 10 // 4\n2\n>>> 120 * 60\n7200'
          },
          { type: 'p', html: '<b>조건문</b> <code>if / elif / else</code> 는 “만약 ~라면”을 나타냅니다. 위에서부터 차례로 살펴 <b>처음으로 맞는 하나만</b> 실행합니다.' },
          {
            type: 'code', title: '예제 1-12. 걷기 · 뛰기 나누기', code: `from microbit import *

spm = 150   # 1분에 걸은 걸음 수 (바꿔 보세요)

if spm >= 140:
    print("뛰는 중")
    display.show("R")
elif spm >= 60:
    print("걷는 중")
    display.show("W")
else:
    print("쉬는 중")
    display.show("S")`,
            desc: '<code>spm</code> 값을 <code>40</code>, <code>100</code>, <code>170</code> 으로 바꿔 실행해 보세요. 비교에는 <code>&gt;=</code>(크거나 같다), <code>&lt;</code>(작다), <code>==</code>(같다)를 씁니다. <code>=</code> 하나는 “넣어라”, <code>==</code> 둘은 “같니?”입니다.',
            expect: '뛰는 중  (화면에 R)'
          },
          { type: 'callout', kind: 'warn', title: '기준 숫자는 예시입니다', html: '140, 60 같은 기준은 이해를 돕기 위한 예시입니다. 사람마다 다르기 때문에, 실제 프로젝트에서는 <b>직접 재어 본 숫자</b>로 기준을 정합니다.' },
          {
            type: 'code', title: '예제 1-13. 1초마다 세기 — while True: + print()', code: `from microbit import *

count = 0
while True:
    count = count + 1
    print("시간(초):", count)
    display.show(count % 10)   # 화면에는 끝자리만
    sleep(1000)`,
            desc: '반복할 때마다 <code>count</code> 가 1 씩 늘고 콘솔에 찍힙니다. <code>%</code> 는 나눈 <b>나머지</b>라서 <code>count % 10</code> 은 끝자리 숫자입니다. 나중에 “1분 동안 몇 걸음?”을 셀 때 이 모양을 다시 씁니다.',
            expect: '시간(초): 1\n시간(초): 2\n시간(초): 3\n… (■ 중지로 멈춤)'
          },

          { type: 'h', text: '함수(def) = 도구 상자' },
          { type: 'p', html: '<b>함수(function)</b>는 자주 쓰는 일을 묶어 이름을 붙인 <b>도구</b>입니다. 가위를 쓸 때 가위 안의 구조를 몰라도 “종이를 넣으면 잘린다”만 알면 되지요. 함수도 <b>무엇을 넣으면(입력) 무엇이 나오는지(결과)</b>만 알면 쓸 수 있습니다.' },
          { type: 'figure', html: FIG_FUNC, caption: '그림 1-6. 함수는 “넣는 것 → 나오는 것”이 정해진 도구' },
          {
            type: 'code', title: '예제 1-14. 함수 만들고 쓰기', code: `from microbit import *

def distance(steps, stride):
    # 걸음 수와 보폭을 넣으면 거리(m)가 나온다
    return steps * stride

print(distance(1000, 0.7))
print(distance(2000, 0.8))`,
            desc: '<code>def 이름(넣는 것):</code> 으로 함수를 만들고, <code>return</code> 뒤에 <b>나오는 것</b>을 씁니다. 한 번 만들어 두면 숫자만 바꿔 몇 번이고 다시 쓸 수 있습니다.',
            expect: '700.0\n1600.0'
          },
          {
            type: 'table', head: ['부분', '뜻'], rows: [
              ['<code>def</code>', '“함수를 만든다”는 표시'],
              ['<code>distance</code>', '함수 이름 (하는 일을 알 수 있게)'],
              ['<code>(steps, stride)</code>', '<b>넣는 것</b> — 매개변수'],
              ['<code>return ...</code>', '<b>나오는 것</b> — 돌려주는 값'],
              ['<code>distance(1000, 0.7)</code>', '함수 <b>쓰기(호출)</b>']
            ], caption: '표 1-5. 함수의 각 부분'
          },
          { type: 'callout', kind: 'info', title: '이 강좌의 약속', html: '걸음 찾기, 방향 계산처럼 어려운 계산은 <b>미리 만든 함수</b>로 드립니다. 함수 위의 설명에는 항상 <b>넣는 것</b>과 <b>나오는 것</b>을 적어 둡니다. 안의 계산이 궁금한 사람은 📘 더 알아보기에서 살펴보면 됩니다.' },
          {
            type: 'code', title: '예제 1-15. 넣는 것이 없는 함수', code: `from microbit import *

def smile():
    # 넣는 것: 없음 / 하는 일: 웃는 얼굴 0.5초
    display.show(Image.HAPPY)
    sleep(500)
    display.clear()

smile()
smile()
print("두 번 웃었습니다")`,
            desc: '함수는 값을 돌려주지 않고 <b>일만 하는</b> 것도 있습니다. <code>smile()</code> 두 줄로 같은 일을 두 번 시켰습니다.',
            expect: '웃는 얼굴이 두 번 깜빡이고, 콘솔에 "두 번 웃었습니다" 가 찍힙니다.'
          },

          { type: 'h', text: '버튼 카운터 — 단계별로 만들기' },
          { type: 'p', html: '오늘의 실습은 <b>A 버튼을 누를 때마다 1 씩 늘고, B 버튼을 누르면 0 이 되는 카운터</b>입니다. 만보기의 아주 작은 모형이지요. 계단을 따라 한 칸씩 만들어 봅니다.' },
          {
            type: 'code', title: '예제 1-16. 1단계 — A 버튼으로 세기만', code: `from microbit import *

count = 0
while True:
    if button_a.was_pressed():
        count = count + 1
        print(count)
    sleep(20)`,
            desc: '먼저 <b>세는 것만</b> 만들고 <code>print()</code> 로 확인합니다. 콘솔 숫자가 누른 횟수와 같은지 꼭 확인하고 다음 단계로 갑니다.',
            hint: '<b>A 버튼</b>을 5번 눌러 콘솔 숫자를 확인하세요.',
            expect: '1\n2\n3\n4\n5'
          },
          {
            type: 'code', title: '예제 1-17. 2단계 — 함수로 나누고 화면에 보이기', code: `from microbit import *

def add_one(n):
    # 넣는 것: 지금 수 / 나오는 것: 1 큰 수
    return n + 1

def reset():
    # 넣는 것: 없음 / 나오는 것: 0
    return 0

count = 0
display.show(count)
while True:
    if button_a.was_pressed():
        count = add_one(count)
        display.show(count)
    if button_b.was_pressed():
        count = reset()
        display.show(count)
    sleep(20)`,
            desc: '<code>add_one()</code> 과 <code>reset()</code> 두 도구로 나눴습니다. 함수가 돌려준 값을 <code>count = ...</code> 로 다시 상자에 넣는 모양을 잘 보세요. 숫자가 10 이상이면 <code>display.show()</code> 가 숫자를 흘려서 보여 줍니다.',
            hint: '<b>A</b> 를 여러 번 누른 뒤 <b>B</b> 를 눌러 보세요.',
            expect: 'A 를 누를 때마다 1, 2, 3 … 이 보이고, B 를 누르면 0 이 됩니다.'
          },
          {
            type: 'code', title: '응용 1-18. 문제 찾기 — is_pressed() 로 바꾸면?', code: `from microbit import *

count = 0
while True:
    if button_a.is_pressed():     # was_pressed 대신
        count = count + 1
        print(count)
    sleep(20)`,
            desc: '버튼을 <b>한 번</b> 꾹 눌렀다 뗐을 뿐인데 숫자가 수십씩 늘어납니다. 누르고 있는 동안 0.02초마다 “지금 눌려 있네!”라고 판단하기 때문입니다. 이렇게 <b>예상하지 못한 문제</b>를 미리 생각해 보는 것이 다음 활동입니다.',
            hint: '<b>A 버튼</b>을 1초쯤 꾹 누르고 있어 보세요.',
            expect: '1\n2\n3\n… (한 번 눌렀는데 수십까지 올라감)'
          },

          { type: 'h', text: '예상 문제 토론 — 문제 카드 쓰기' },
          { type: 'p', html: '좋은 개발자는 만들기 <b>전에</b> “이렇게 하면 어떤 문제가 생길까?”를 먼저 생각합니다. 이 강좌에서는 단계마다 <b>예상 문제 카드</b>를 쓰고 모둠에서 해결 아이디어를 나눕니다.' },
          { type: 'figure', html: FIG_CARD, caption: '그림 1-7. 예상 문제 카드 예시' },
          {
            type: 'list', ordered: true, items: [
              '혼자서 카드 한 장을 씁니다 (<b>단계 · 이렇게 하면 · 생길 문제</b>).',
              '모둠에서 돌려 읽고, 다른 친구 카드에 <b>해결 아이디어</b>를 한 줄씩 덧붙입니다.',
              '가장 그럴듯한 아이디어를 골라 <b>직접 실행해서 확인</b>합니다.',
              '확인한 결과를 카드 아래에 적어 둡니다 (“해결됨”, “아직 남음”).'
            ]
          },
          {
            type: 'list', items: [
              '버튼을 <b>아주 빠르게</b> 여러 번 누르면 다 셀 수 있을까?',
              '숫자가 <b>10 을 넘으면</b> 화면에 어떻게 보일까?',
              '실제 보드를 <b>흔들면서</b> 누르면 어떻게 될까?',
              '전원을 껐다 켜면 <b>센 숫자</b>는 남아 있을까?'
            ]
          },
          { type: 'callout', kind: 'tip', title: '틀린 예상도 좋은 예상', html: '예상이 빗나가도 괜찮습니다. “생각했던 것과 다르다”는 것을 확인한 것만으로도 큰 배움입니다. 카드에 그대로 적어 두세요.' },
          { type: 'callout', kind: 'board', html: '실제 보드는 전원을 끄면 <code>count</code> 같은 변수 값이 <b>사라집니다</b>. 기록을 남기려면 보드 안에 <b>저장</b>해야 하는데, 이것은 계단의 ⑤ 저장하기 단계에서 배웁니다.' },

          { type: 'h', text: '난이도 표시 읽는 법' },
          {
            type: 'table', head: ['표시', '뜻', '이렇게 하면 됩니다'], rows: [
              ['★', '그대로 따라 하기', '예제를 그대로 입력하고 실행해 결과 확인'],
              ['★★', '값 바꿔 보기', '숫자 · 그림 · 기준값을 바꿔 결과가 어떻게 달라지는지 확인'],
              ['★★★', '기능 더하기', '새 버튼 · 새 화면 · 새 조건을 스스로 더해 보기']
            ], caption: '표 1-6. 실습 난이도 표시'
          },
          { type: 'p', html: '모든 실습은 ★ 부터 시작합니다. ★ 가 끝나면 ★★, 시간이 남으면 ★★★ 에 도전하세요. 자기 속도에 맞게 고르면 됩니다.' },
          {
            type: 'code', title: '도전 1-19. 로고를 만지면 지금 수를 흘려 보기 (★★★)', code: `from microbit import *

def add_one(n):
    return n + 1

def reset():
    return 0

count = 0
while True:
    if button_a.was_pressed():
        count = add_one(count)
        display.show(Image.YES)
    if button_b.was_pressed():
        count = reset()
        display.show(Image.NO)
    if pin_logo.is_touched():
        display.scroll(str(count))
    sleep(20)`,
            desc: 'A · B 를 누르면 그림으로만 알려 주고, 수는 <b>로고를 만질 때</b> 흘려서 보여 줍니다. <code>str()</code> 은 숫자를 글자로 바꿉니다. 이렇게 기능을 하나씩 더하는 것이 ★★★ 실습의 모습입니다.',
            hint: '<b>A</b> 를 몇 번 누른 뒤 금색 <b>로고</b>를 눌러 보세요.',
            expect: 'A 는 체크 표시, B 는 X 표시가 나오고, 로고를 만지면 지금 수가 흘러갑니다.'
          }
        ],
        slides: [
          { layout: 'title', title: '프로젝트를 만드는 방법', subtitle: 'Chapter 01 · 단계별 개발과 토론', badge: '2교시', notes: '<p>1교시에 만든 프로그램을 떠올리게 하고, 오늘은 “큰 프로그램을 잘 만드는 방법”을 배운다고 안내합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 어디가 잘못됐을까?', lead: '한 번에 100줄 vs 10줄씩', bullets: ['100줄 한꺼번에 → 어디든 의심', '10줄씩 실행 → <b>방금 쓴 10줄</b>만 보면 됨', 'print() 로 값 확인', '→ <b>단계별 개발</b>'], notes: '<p>적어 온 방법을 2~3명 발표시킵니다.</p><p>💬 “레고 큰 작품을 만들 때 설명서 없이 한 번에 조립하면?” — 예상 답: 어디서 틀렸는지 모름.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '단계별 개발 — 7칸 계단', html: FIG_STAIRS, notes: '<p>계단을 하나씩 짚으며 읽습니다. ⑦ 고치기 후에는 다시 ③으로 돌아가 반복한다는 것을 강조합니다.</p><p>💬 “만보기를 만든다면 ② 잴 것은?” — 걸음 수.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '두 프로젝트를 계단으로', head: ['단계', '러닝', '실내 경로'], rows: [['① 문제', '얼마나 일정하게 뛸까?', '건물 안에서 어디로?'], ['② 잴 것', '걸음 수 · 케이던스 · 보폭', '걸음 수 · 방향'], ['③ 센서', '가속도', '가속도 + 지자기'], ['④ 계산', '케이던스 · 거리', '위치 옮기기'], ['⑤ 저장', '시간별 기록', '지나간 점들'], ['⑥ 보여 주기', '그래프', '지도'], ['⑦ 고치기', '잘못 센 걸음', '방향 오차']], notes: '<p>표 1-4 를 간추린 것입니다. 두 프로젝트가 같은 계단을 따른다는 것을 보여 줍니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '변수와 계산', code: `from microbit import *

steps = 0
steps = steps + 1
steps = steps + 1
print("걸음 수:", steps)

stride = 0.7
print("거리(m):", steps * stride)`, points: ['<code>=</code> 는 “넣어라”', '<code>steps + 1</code> → 하나 늘리기', '<code>print()</code> 로 확인'], notes: '<p>칠판에 상자 그림을 그려 steps 상자에 0 → 1 → 2 가 들어가는 모습을 보여 줍니다(판서 펜 활용).</p><p>💬 “steps = steps + 1 은 수학으로는 틀린 식인데 왜 될까?” — = 가 넣기이기 때문.</p><p>시간: 4분</p>' },
          { layout: 'code', title: 'if / elif / else', code: `from microbit import *

spm = 150

if spm >= 140:
    display.show("R")
elif spm >= 60:
    display.show("W")
else:
    display.show("S")`, points: ['위에서부터 차례로', '처음 맞는 <b>하나만</b> 실행', '<code>=</code> 넣기 · <code>==</code> 같니?'], notes: '<p>spm 값을 40 · 100 · 170 으로 바꿔 가며 실행합니다.</p><p>💬 “spm 이 140 이면 어디로 갈까?” — R (>= 이므로).</p><p>시간: 4분</p>' },
          { layout: 'code', title: 'while True: + print()', code: `from microbit import *

count = 0
while True:
    count = count + 1
    print("시간(초):", count)
    sleep(1000)`, points: ['반복마다 1 씩 늘기', '콘솔로 값 확인', '■ 중지 잊지 않기'], notes: '<p>콘솔에 숫자가 찍히는 것을 함께 봅니다. 나중에 “1분 동안 걸음 수”를 셀 때 이 모양을 쓴다고 예고만 합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '함수 = 도구 상자', html: FIG_FUNC, notes: '<p>가위 · 계산기 비유로 설명합니다. 안의 구조를 몰라도 넣는 것과 나오는 것만 알면 쓸 수 있습니다.</p><p>💬 “자판기에 넣는 것과 나오는 것은?” — 돈 · 버튼 → 음료.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '함수 만들고 쓰기', code: `from microbit import *

def distance(steps, stride):
    return steps * stride

print(distance(1000, 0.7))
print(distance(2000, 0.8))`, points: ['<code>def</code> 이름(넣는 것):', '<code>return</code> 나오는 것', '숫자만 바꿔 다시 쓰기'], notes: '<p>이 강좌의 약속: 어려운 계산은 미리 만든 함수로 준다. 설명에는 항상 넣는 것 / 나오는 것을 적는다.</p><p>시간: 5분</p>' },
          { layout: 'practice', title: '실습 — 버튼 카운터', desc: 'A 를 누를 때마다 1 씩 늘고, B 를 누르면 0. 함수 <code>add_one()</code> · <code>reset()</code> 로 나눠 만들기. 1단계(세기만, print 확인) → 2단계(함수 · 화면).', starter: `from microbit import *

def add_one(n):
    # TODO: 1 큰 수 돌려주기
    return n

def reset():
    # TODO: 0 돌려주기
    return 99

count = 0
while True:
    # TODO: A → add_one, B → reset
    sleep(20)`, solution: `from microbit import *

def add_one(n):
    return n + 1

def reset():
    return 0

count = 0
display.show(count)
while True:
    if button_a.was_pressed():
        count = add_one(count)
        display.show(count)
    if button_b.was_pressed():
        count = reset()
        display.show(count)
    sleep(20)`, notes: '<p>★: 예제 1-17 따라 하기 · ★★: 2씩 늘게 바꾸기 · ★★★: 로고로 수 흘리기(도전 1-19).</p><p>시작 코드의 add_one() · reset() 은 일부러 틀린 값을 돌려줍니다 — print() 로 값을 찍어 고칠 곳을 찾게 합니다.</p><p>시간: 10분</p>' },
          { layout: 'code', title: '예상 문제 — is_pressed() 라면?', code: `from microbit import *

count = 0
while True:
    if button_a.is_pressed():
        count = count + 1
        print(count)
    sleep(20)`, points: ['한 번 눌렀는데 수십 증가', '0.02초마다 “눌려 있네!”', '→ 미리 생각했다면?'], notes: '<p>실행해서 A 를 꾹 눌러 보여 줍니다. 학생들이 놀라는 순간을 토론으로 이어 갑니다.</p><p>💬 “어떻게 고칠 수 있을까요?” — was_pressed() 쓰기, 손을 뗄 때까지 기다리기.</p><p>시간: 2분</p>' },
          { layout: 'diagram', title: '예상 문제 카드', html: FIG_CARD, notes: '<p>카드 쓰는 방법: 혼자 쓰기 → 모둠 돌려 읽기 → 해결 아이디어 덧붙이기 → 실행해서 확인.</p><p>카드 주제 예: 아주 빠르게 누르면? 10 이 넘으면? 흔들면서 누르면? 전원을 끄면?</p><p>시간: 3분</p>' },
          { layout: 'table', title: '난이도 표시', head: ['표시', '뜻'], rows: [['★', '그대로 따라 하기'], ['★★', '값 바꿔 보기'], ['★★★', '기능 더하기']], notes: '<p>모든 학생이 ★ 부터 시작하고, 자기 속도에 맞게 올라가도록 안내합니다. 빨리 끝난 학생은 ★★★ 로 이끕니다.</p><p>시간: 1분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['7칸 계단: 한 칸씩 만들고 실행해서 확인', '변수 · 계산 · if/elif/else · while True: · print()', '함수 = 넣는 것 → 나오는 것', '예상 문제 카드로 미리 토론', '★ → ★★ → ★★★ 자기 수준에 맞게'], notes: '<p>예상 문제 카드를 한 장씩 제출받습니다.</p><p>다음 챕터 예고: “센서로 움직임 읽기” — 가속도 센서가 내는 숫자를 직접 봅니다.</p><p>시간: 1분</p>' }
        ]
      }
    ]
  });
})();
