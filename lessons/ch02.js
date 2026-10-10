/* Chapter 02. 센서로 움직임 읽기 */
(function () {
  /* ───────── 그림 2-1. 상자 안에 매달린 공 ───────── */
  const FIG_BALL = (() => {
    const box = (x, title, sub, bx, by, arrow) => `
  <rect x="${x}" y="70" width="300" height="250" rx="14" fill="var(--code-bg)" stroke="var(--line)" stroke-width="3"/>
  <path d="M${x + 150} 70 L${bx} ${by}" stroke="var(--muted)" stroke-width="3"/>
  <circle cx="${bx}" cy="${by}" r="26" fill="var(--accent)"/>
  ${arrow}
  <text x="${x + 150}" y="45" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">${title}</text>
  <text x="${x + 150}" y="360" text-anchor="middle" font-size="19" fill="var(--muted)">${sub}</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c2ba" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--warn)"/></marker></defs>
  ${box(60, '① 가만히 있을 때', '공이 바로 아래로 — 중력만 느낌', 210, 240, '')}
  ${box(490, '② 오른쪽으로 출발', '공이 왼쪽으로 쏠림 → x 값 변화', 590, 228, '<path d="M680 300 L760 300" stroke="var(--warn)" stroke-width="6" marker-end="url(#c2ba)"/><text x="720" y="290" text-anchor="middle" font-size="18" fill="var(--warn)">출발</text>')}
  ${box(920, '③ 위로 출발 (엘리베이터)', '공이 아래로 더 눌림 → 무거운 느낌', 1070, 280, '<path d="M1240 280 L1240 120" stroke="var(--warn)" stroke-width="6" marker-end="url(#c2ba)"/><text x="1196" y="110" font-size="18" fill="var(--warn)">위로</text><path d="M1070 160 L1070 230" stroke="var(--danger)" stroke-width="4" stroke-dasharray="6 5"/>')}
</svg>`;
  })();

  /* ───────── 그림 2-2. x · y · z 세 방향 ───────── */
  const FIG_AXES = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>
    <marker id="c2ax" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker>
    <marker id="c2ay" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--ok)"/></marker>
    <marker id="c2az" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)"/></marker>
  </defs>
  <text x="330" y="34" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">보드를 책상에 눕혀 놓고 볼 때</text>
  ${MB_FIG.board({ x: 170, y: 70, scale: 0.6, labels: false, leds: '0000000000009000000000000' })}
  <path d="M120 230 L560 230" stroke="var(--danger)" stroke-width="5" marker-start="url(#c2ax)" marker-end="url(#c2ax)"/>
  <text x="580" y="238" font-size="24" font-weight="bold" fill="var(--danger)">x 좌우</text>
  <path d="M330 52 L330 400" stroke="var(--ok)" stroke-width="5" marker-start="url(#c2ay)" marker-end="url(#c2ay)"/>
  <text x="345" y="60" font-size="24" font-weight="bold" fill="var(--ok)">y 앞뒤</text>
  <circle cx="330" cy="230" r="18" fill="none" stroke="var(--accent)" stroke-width="5"/>
  <circle cx="330" cy="230" r="5" fill="var(--accent)"/>
  <text x="360" y="200" font-size="24" font-weight="bold" fill="var(--accent)">z 위아래</text>

  <text x="960" y="34" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">옆에서 본 모습</text>
  <rect x="800" y="230" width="320" height="18" rx="4" fill="#0e6b64"/>
  <path d="M960 220 L960 100" stroke="var(--accent)" stroke-width="5" marker-end="url(#c2az)"/>
  <text x="975" y="110" font-size="22" font-weight="bold" fill="var(--accent)">z (위쪽이 +)</text>
  <path d="M800 230 L1120 230" stroke="var(--danger)" stroke-width="3" stroke-dasharray="8 6"/>
  <path d="M960 260 L960 360" stroke="var(--muted)" stroke-width="4" stroke-dasharray="6 5" marker-end="url(#c2az)"/>
  <text x="975" y="350" font-size="20" fill="var(--muted)">중력이 아래로 당김</text>
  <text x="960" y="400" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--fg)">→ 가만히 두면 z ≈ -1000</text>
</svg>`;

  /* ───────── 그림 2-3. 세 화살표를 하나로 — strength() ───────── */
  const FIG_STRENGTH = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c2sx" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker><marker id="c2sy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--ok)"/></marker><marker id="c2sz" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)"/></marker><marker id="c2sw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--warn)"/></marker></defs>
  <text x="300" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">세 화살표를 이어 붙이면</text>
  <path d="M90 340 L330 340" stroke="var(--danger)" stroke-width="6" marker-end="url(#c2sx)"/>
  <text x="200" y="378" text-anchor="middle" font-size="22" fill="var(--danger)">x</text>
  <path d="M330 340 L430 260" stroke="var(--ok)" stroke-width="6" marker-end="url(#c2sy)"/>
  <text x="400" y="320" font-size="22" fill="var(--ok)">y</text>
  <path d="M430 260 L430 90" stroke="var(--accent)" stroke-width="6" marker-end="url(#c2sz)"/>
  <text x="445" y="180" font-size="22" fill="var(--accent)">z</text>
  <path d="M90 340 L428 94" stroke="var(--warn)" stroke-width="8" marker-end="url(#c2sw)"/>
  <text x="140" y="200" font-size="24" font-weight="bold" fill="var(--warn)">합친 길이</text>
  <text x="140" y="230" font-size="22" font-weight="bold" fill="var(--warn)">= strength()</text>

  <text x="930" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">strength() 값의 모양 (예)</text>
  <path d="M640 360 L1240 360 M640 70 L640 360" stroke="var(--line)" stroke-width="2"/>
  <path d="M640 250 L1240 250" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 6"/>
  <text x="630" y="256" text-anchor="end" font-size="17" fill="var(--muted)">1000</text>
  <path d="M650 250 L700 251 L740 249 L780 250" fill="none" stroke="var(--ok)" stroke-width="4"/>
  <text x="715" y="232" text-anchor="middle" font-size="19" fill="var(--ok)">멈춤</text>
  <path d="M800 250 L820 205 L840 285 L860 250 L880 205 L900 285 L920 250 L940 205 L960 285 L980 250" fill="none" stroke="var(--accent)" stroke-width="4"/>
  <text x="890" y="190" text-anchor="middle" font-size="19" fill="var(--accent)">걷기</text>
  <path d="M1000 250 L1015 110 L1030 330 L1045 250 L1060 110 L1075 330 L1090 250 L1105 110 L1120 330 L1135 250 L1150 110 L1165 330 L1180 250 L1195 110 L1210 330 L1225 250" fill="none" stroke="var(--danger)" stroke-width="4"/>
  <text x="1110" y="96" text-anchor="middle" font-size="19" fill="var(--danger)">뛰기</text>
  <text x="940" y="395" text-anchor="middle" font-size="18" fill="var(--muted)">시간 →  (출렁임이 크고 빠를수록 세게 움직이는 중)</text>
</svg>`;

  /* ───────── 그림 2-4. 방위각과 8방향 ───────── */
  const FIG_ROSE = (() => {
    const cx = 330, cy = 215, r = 160;
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const ko = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a1 = (i * 45 - 22.5 - 90) * Math.PI / 180, a2 = (i * 45 + 22.5 - 90) * Math.PI / 180;
      const p = (a, rr) => `${Math.round(cx + rr * Math.cos(a))} ${Math.round(cy + rr * Math.sin(a))}`;
      s += `<path d="M${cx} ${cy} L${p(a1, r)} A${r} ${r} 0 0 1 ${p(a2, r)} Z" fill="${i % 2 ? 'var(--code-bg)' : 'none'}" stroke="var(--line)" stroke-width="2"/>`;
      const am = (i * 45 - 90) * Math.PI / 180;
      const [tx, ty] = p(am, r - 52).split(' ');
      s += `<text x="${tx}" y="${+ty + 8}" text-anchor="middle" font-size="22" font-weight="bold" fill="${i === 0 ? 'var(--danger)' : 'var(--fg)'}">${names[i]}</text>`;
      const [ux, uy] = p(am, r + 26).split(' ');
      s += `<text x="${ux}" y="${+uy + 7}" text-anchor="middle" font-size="18" fill="var(--muted)">${i * 45}°</text>`;
      s += `<text x="${Math.round(cx + (r - 90) * Math.cos(am))}" y="${Math.round(cy + (r - 90) * Math.sin(am)) + 6}" text-anchor="middle" font-size="15" fill="var(--muted)">${ko[i]}</text>`;
    }
    return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${s}
  <circle cx="${cx}" cy="${cy}" r="6" fill="var(--fg)"/>
  <text x="900" y="70" text-anchor="middle" font-size="25" font-weight="bold" fill="var(--fg)">compass.heading() → 0 ~ 359</text>
  <text x="700" y="125" font-size="21" fill="var(--fg)">· 보드 <tspan font-weight="bold">위쪽(로고 쪽)</tspan>이 가리키는 방향의 각도</text>
  <text x="700" y="165" font-size="21" fill="var(--fg)">· 0 = 북, 90 = 동, 180 = 남, 270 = 서</text>
  <text x="700" y="205" font-size="21" fill="var(--fg)">· 시계 방향으로 돌수록 숫자가 커집니다</text>
  <rect x="700" y="240" width="460" height="120" rx="12" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="930" y="280" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">direction8(heading)</text>
  <text x="930" y="318" text-anchor="middle" font-size="20" fill="var(--fg)">한 조각 = 45°  →  'N' 'NE' 'E' …</text>
  <text x="930" y="346" text-anchor="middle" font-size="18" fill="var(--muted)">예) 100° → 'E' ,  350° → 'N'</text>
</svg>`;
  })();

  /* ───────── 그림 2-5. 북쪽 화살표가 반대로 도는 까닭 ───────── */
  const FIG_NEEDLE = (() => {
    const panel = (x, title, rot, ledArrow, note) => `
  <text x="${x + 150}" y="40" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--fg)">${title}</text>
  <g transform="rotate(${rot} ${x + 150} 210)">
    <rect x="${x + 70}" y="110" width="160" height="200" rx="16" fill="#0e6b64"/>
    <path d="M${x + 150} 92 L${x + 140} 110 L${x + 160} 110 Z" fill="var(--accent2)"/>
  </g>
  <g transform="translate(${x + 100} 160)">${ledArrow}</g>
  <text x="${x + 150}" y="372" text-anchor="middle" font-size="19" fill="var(--muted)">${note}</text>`;
    const arr = (leds) => MB_FIG.screen(leds, { size: 100 });
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c2na" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker></defs>
  <path d="M40 360 L40 80" stroke="var(--danger)" stroke-width="5" marker-end="url(#c2na)"/>
  <text x="54" y="96" font-size="24" font-weight="bold" fill="var(--danger)">북</text>
  ${panel(110, '보드가 북쪽을 볼 때 (0°)', 0, arr('0090009990909090090000900'), '화살표: 위 ↑ (그대로 북쪽)')}
  ${panel(500, '보드가 동쪽을 볼 때 (90°)', 90, arr('0090009000999990900000900'), '북쪽은 보드의 왼쪽 → 화살표 ←')}
  ${panel(890, '보드가 남쪽을 볼 때 (180°)', 180, arr('0090000900909090999000900'), '북쪽은 보드의 뒤쪽 → 화살표 ↓')}
</svg>`;
  })();

  /* ───────── 그림 2-6. 방향을 틀어지게 하는 것들 ───────── */
  const FIG_NOISE = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="640" y="36" text-anchor="middle" font-size="24" font-weight="bold" fill="var(--fg)">작은 나침반을 헷갈리게 하는 것들</text>
  ${MB_FIG.board({ x: 548, y: 120, scale: 0.42, labels: false, btnLabel: false, leds: '0090009990909090090000900' })}
  <rect x="60" y="80" width="250" height="110" rx="12" fill="var(--code-bg)" stroke="var(--danger)" stroke-width="3"/>
  <text x="185" y="125" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">철제 책상 · 의자</text>
  <text x="185" y="160" text-anchor="middle" font-size="18" fill="var(--muted)">쇠가 자기장을 휘게 함</text>
  <rect x="60" y="240" width="250" height="110" rx="12" fill="var(--code-bg)" stroke="var(--danger)" stroke-width="3"/>
  <text x="185" y="285" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--danger)">스마트폰 · 스피커</text>
  <text x="185" y="320" text-anchor="middle" font-size="18" fill="var(--muted)">속에 자석이 있음</text>
  <rect x="970" y="80" width="250" height="110" rx="12" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="1095" y="125" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--warn)">보드 기울어짐</text>
  <text x="1095" y="160" text-anchor="middle" font-size="18" fill="var(--muted)">평평할 때가 가장 정확</text>
  <rect x="970" y="240" width="250" height="110" rx="12" fill="var(--code-bg)" stroke="var(--warn)" stroke-width="3"/>
  <text x="1095" y="285" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--warn)">보정 안 함</text>
  <text x="1095" y="320" text-anchor="middle" font-size="18" fill="var(--muted)">calibrate() 먼저!</text>
  <path d="M310 135 L540 190 M310 295 L540 250" stroke="var(--danger)" stroke-width="3" stroke-dasharray="8 6"/>
  <path d="M970 135 L740 190 M970 295 L740 250" stroke="var(--warn)" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="640" y="385" text-anchor="middle" font-size="19" fill="var(--muted)">→ 방향이 10° ~ 수십° 틀어지거나, 갑자기 튈 수 있습니다</text>
</svg>`;

  MB_COURSE.addChapter({
    id: 'ch02', no: '02',
    title: '센서로 움직임 읽기',
    subtitle: '가속도 센서 · mg · strength() · 지자기 센서 · heading · 8방향',
    summary: '가속도 센서로 흔들림을 <b>숫자</b>로 읽고, 지자기 센서로 보드가 <b>어느 방향</b>을 보는지 알아냅니다. 두 센서는 앞으로 만들 <b>러닝 데이터 측정기</b>와 <b>실내 이동 경로 지도</b>의 눈과 귀가 됩니다. 어려운 계산은 <code>strength()</code> · <code>direction8()</code> 같은 준비된 함수로 감싸서 쓰고, 센서 값이 틀어질 수 있는 상황을 미리 토론합니다.',
    goals: [
      '가속도 센서의 x · y · z 세 방향과 단위 mg 를 그림으로 설명할 수 있다',
      '<code>accelerometer.get_x()</code> · <code>get_y()</code> · <code>get_z()</code> 로 값을 읽고 셸에서 확인할 수 있다',
      '준비된 함수 <code>strength()</code> 로 멈춤 · 걷기 · 뛰기의 흔들림 세기를 비교할 수 있다',
      '<code>compass.calibrate()</code> 와 <code>compass.heading()</code> 으로 보드가 보는 방향을 알아낼 수 있다',
      '준비된 함수 <code>direction8()</code> 과 화살표 그림으로 방향을 LED 에 표시할 수 있다',
      '보드 위치 · 자석 간섭 · 기울어짐 때문에 생기는 문제를 미리 토론할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch02-1',
        title: '가속도 센서 — 흔들림을 숫자로',
        minutes: 50,
        goals: [
          '상자 속 공 비유로 가속도 센서가 무엇을 느끼는지 말할 수 있다',
          'x · y · z 값을 읽고, 가만히 있을 때 z 가 약 -1000 인 까닭을 설명할 수 있다',
          '<code>strength()</code> 로 멈춤 · 걷기 · 뛰기의 숫자 패턴을 비교할 수 있다',
          '<code>strength()</code> 값으로 LED 막대가 움직이는 흔들림 미터를 만들 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['가속도 센서 비유 · 세 방향', 8], ['값 읽기 · 셸', 9], ['strength() · 움직임 비교', 10], ['토론: 보드 위치', 6], ['실습: 흔들림 미터', 10], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '엘리베이터가 <b>올라가기 시작할 때</b> 몸이 잠깐 무거워지는 느낌이 듭니다. 반대로 <b>멈추려고 할 때</b>는 잠깐 가벼워지지요. 왜 그럴까요? 내 생각을 한두 문장으로 적어 오세요. “바닥이 나를 밀어서”, “몸이 제자리에 있으려고 해서”처럼 떠오르는 대로 쓰면 됩니다.' },
          { type: 'p', html: '적어 온 생각을 짝과 나눠 봅니다. 우리 몸은 <b>원래 하던 대로 있으려는 성질</b>이 있습니다. 엘리베이터가 갑자기 위로 출발하면, 몸은 제자리에 있으려 하고 바닥은 몸을 위로 밀어 올립니다. 그래서 발바닥이 더 세게 눌리고 무겁게 느껴집니다. 이렇게 <b>빠르기가 바뀔 때</b> 생기는 느낌을 재는 장치가 오늘 배울 <b>가속도 센서(accelerometer)</b>입니다.' },

          { type: 'h', text: '가속도 센서는 무엇을 느낄까요?' },
          { type: 'p', html: '가속도 센서를 <b>작은 상자 안에 실로 매달린 공</b>이라고 생각해 봅니다. 상자를 가만히 두면 공은 바로 아래로 늘어집니다. 상자를 오른쪽으로 홱 움직이면 공은 왼쪽으로 쏠리고, 위로 확 올리면 공은 아래로 더 눌립니다. 센서는 이 <b>공이 얼마나, 어느 쪽으로 쏠렸는지</b>를 숫자로 알려 줍니다.' },
          { type: 'figure', html: FIG_BALL, caption: '그림 2-1. 상자 안에 매달린 공 — 움직임에 따라 쏠리는 모습' },
          { type: 'p', html: '<b>가속도(acceleration)</b>는 “빠르기가 얼마나 빨리 바뀌는가”입니다. 출발할 때 · 멈출 때 · 방향을 바꿀 때 가속도가 생깁니다. 일정한 빠르기로 쭉 가는 동안에는 가속도가 거의 없습니다. 그래서 엘리베이터도 <b>출발과 멈춤</b> 순간에만 무겁거나 가볍게 느껴집니다.' },
          { type: 'p', html: '센서는 한 방향만 재지 않고 <b>세 방향</b>을 따로 잽니다. 보드를 책상에 눕혀 놓고 볼 때 <b>x 는 좌우</b>, <b>y 는 앞뒤</b>, <b>z 는 위아래</b>입니다.' },
          { type: 'figure', html: FIG_AXES, caption: '그림 2-2. 가속도 센서의 세 방향 x(좌우) · y(앞뒤) · z(위아래)' },
          {
            type: 'table', caption: '표 2-1. 세 방향과 값이 바뀌는 때',
            head: ['축', '방향', '이렇게 하면 값이 크게 바뀝니다'],
            rows: [
              ['<b>x</b>', '좌우', '보드를 왼쪽 · 오른쪽으로 기울이거나 옆으로 흔들 때'],
              ['<b>y</b>', '앞뒤', '보드를 앞 · 뒤로 기울이거나 앞뒤로 흔들 때'],
              ['<b>z</b>', '위아래', '보드를 뒤집거나 위아래로 들썩일 때 (걸을 때 몸이 위아래로 출렁임!)']
            ]
          },

          { type: 'h', text: '센서 값 읽기 — get_x() · get_y() · get_z()' },
          { type: 'p', html: '세 방향의 값은 <code>accelerometer.get_x()</code>, <code>accelerometer.get_y()</code>, <code>accelerometer.get_z()</code> 로 읽습니다. 단위는 <b>mg(밀리지)</b>입니다. 어렵게 생각하지 말고 <b>1000 ≈ 지구가 당기는 힘(중력) 1배</b>라고 기억하면 됩니다. 2000 이면 중력의 2배만큼 세게 쏠린 것입니다.' },
          {
            type: 'code', title: '예제 2-1. x · y · z 값 찍어 보기', code: `from microbit import *

while True:
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    z = accelerometer.get_z()
    print(x, y, z)
    sleep(500)`,
            desc: '0.5초마다 세 숫자를 콘솔에 찍습니다. 처음에는 가만히 두고 숫자를 읽은 뒤, 보드를 여러 방향으로 기울여 봅니다. 어느 숫자가 크게 바뀌는지 살펴보세요.',
            hint: '<b>🧭 센서</b> 탭의 <b>기울기 판</b>에서 점을 마우스로 끌어 보드를 기울여 보세요. 점을 오른쪽으로 끌면 x 가, 위아래로 끌면 y 가 바뀝니다.',
            expect: '0 0 -1024\n0 0 -1024\n(기울이면) 512 0 -887 …',
            nondeterministic: true
          },
          { type: 'p', html: '가만히 두었는데 <b>z 가 약 -1000</b> 입니다. 움직이지 않는데 왜 0 이 아닐까요? 그림 2-1 의 ① 처럼, 상자를 가만히 두어도 공은 <b>중력</b> 때문에 아래로 늘어져 있기 때문입니다. 센서는 언제나 중력 1배(1000)를 느끼고, 보드가 평평하게 누워 있으면 그 힘이 z 방향에 모두 담깁니다. 부호(−)는 “아래쪽”이라는 뜻으로 보면 됩니다.' },
          {
            type: 'table', caption: '표 2-2. 보드 자세에 따른 값 (대략)',
            head: ['보드 자세', 'x', 'y', 'z'],
            rows: [
              ['화면이 위를 보게 책상에 눕힘', '0', '0', '약 -1000'],
              ['화면이 아래를 보게 뒤집음', '0', '0', '약 +1000'],
              ['오른쪽으로 세움 (오른쪽 모서리가 아래)', '약 +1000', '0', '0'],
              ['로고가 위로 오게 세움', '0', '약 -1000', '0']
            ]
          },
          { type: 'callout', kind: 'tip', title: '중력 1배가 어느 쪽에 담기나 보기', html: '보드를 어떻게 기울이든 세 숫자 중 어딘가에 <b>중력 1000</b> 이 나뉘어 담깁니다. 그래서 가만히 있는 보드로는 <b>기울기</b>를 알 수 있고, 움직이는 보드로는 <b>흔들림</b>을 알 수 있습니다. 프로젝트에서는 주로 흔들림을 씁니다.' },

          { type: 'h', text: '셸(>>>)에서 바로 확인하기' },
          { type: 'p', html: '프로그램을 다 쓰지 않고 한 줄씩 값을 확인하고 싶을 때는 아래 <b>파이썬 셸</b>을 씁니다. 한 줄을 입력하고 Enter 를 누를 때마다 답이 바로 나옵니다. 센서 탭에서 기울기를 바꾼 뒤 같은 줄을 다시 실행하면 값이 바뀐 것을 볼 수 있습니다.' },
          {
            type: 'code', title: '예제 2-2. 셸에서 센서 값 물어보기', repl: true, code: `from microbit import *
accelerometer.get_z()
accelerometer.get_x()
accelerometer.get_values()`,
            desc: '<code>get_values()</code> 는 x · y · z 세 값을 <b>한꺼번에</b> 묶어서 <code>(x, y, z)</code> 로 돌려줍니다. 괄호로 묶인 값 세 개를 <b>튜플(tuple)</b>이라고 부릅니다.',
            hint: '셸에서 <kbd>↑</kbd> 키를 누르면 앞서 입력한 줄을 다시 불러올 수 있습니다.',
            expect: '>>> accelerometer.get_z()\n-1024\n>>> accelerometer.get_x()\n0\n>>> accelerometer.get_values()\n(0, 0, -1024)',
            nondeterministic: true
          },
          {
            type: 'code', title: '예제 2-3. 세 값을 한 번에 받기', code: `from microbit import *

while True:
    x, y, z = accelerometer.get_values()
    print("x:", x, " y:", y, " z:", z)
    sleep(300)`,
            desc: '<code>x, y, z = …</code> 처럼 쓰면 묶인 세 값이 차례대로 세 변수에 들어갑니다. 앞으로 이 모양을 자주 씁니다.',
            hint: '<b>🧭 센서</b> 탭의 기울기 판을 천천히 한 바퀴 돌려 보세요.',
            expect: 'x: 0  y: 0  z: -1024\nx: 300  y: -150  z: -930 …',
            nondeterministic: true
          },

          { type: 'h', text: '움직임의 세기를 숫자 하나로 — strength()' },
          { type: 'p', html: '숫자가 세 개면 비교하기가 불편합니다. 보드를 손에 쥐는 방향이 조금만 달라져도 흔들림이 x 에 담기기도, z 에 담기기도 하니까요. 그래서 세 값을 <b>하나로 합친 길이</b>를 씁니다. 그림 2-3 처럼 x · y · z 세 화살표를 이어 붙였을 때, 처음부터 끝까지 곧게 이은 화살표의 길이입니다. 이렇게 하면 보드가 어느 쪽을 보고 있든 <b>얼마나 세게 움직이는지</b>만 알 수 있습니다.' },
          { type: 'figure', html: FIG_STRENGTH, caption: '그림 2-3. 세 화살표를 하나로 합친 길이 = strength() / 움직임에 따른 값의 모양' },
          {
            type: 'code', title: '예제 2-4. 준비된 함수 strength() 써 보기', code: `from microbit import *
import math

def strength():
    # 세 화살표를 하나로 합친 길이 (단위 mg)
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

while True:
    print(strength())
    sleep(200)`,
            desc: '<code>strength()</code> 는 <b>준비된 함수</b>입니다. 넣는 것은 없고, 나오는 것은 “지금 흔들림의 세기(숫자 하나)”입니다. 가만히 두면 기울여도 <b>약 1000</b> 근처에 머무는 것을 확인해 보세요. 중력 1배만 느끼고 있기 때문입니다.',
            hint: '기울기 판을 이리저리 기울여도 값이 1000 근처에 머무는지 보고, <b>흔들기(shake)</b> 제스처 버튼을 눌러 값이 튀는 것도 확인해 보세요.',
            expect: '1024\n1024\n1023\n(흔들면) 1830 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'more', title: '함수 안에서는 무슨 계산을 하나요?', html: '<code>math.sqrt()</code> 는 <b>제곱근</b>을 구하는 계산입니다. 직각삼각형의 빗변 길이를 구하는 방법(피타고라스의 정리)을 세 방향으로 늘린 것이지요. 중학교 수학에서 배우게 됩니다. 지금은 “세 화살표를 하나로 합친 길이”라고만 알면 충분합니다.' },

          { type: 'h', text: '움직임 시뮬레이션으로 멈춤 · 걷기 · 뛰기 비교하기' },
          { type: 'p', html: '이제 시뮬레이터의 <b>가상의 사람</b>에게 보드를 채우고 움직여 봅니다. <b>움직임 조이스틱</b>을 가운데 두면 멈춤, 살짝 밀면 걷기, 끝까지 밀면 뛰기입니다. <code>strength()</code> 값을 계속 찍으면서 세 경우의 <b>숫자 패턴</b>을 비교해 봅니다. 아래 예제는 값을 <code>*</code> 막대로도 그려 주어 모양을 보기 쉽습니다.' },
          {
            type: 'code', title: '예제 2-5. 흔들림 세기를 별 막대로 찍기', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

while True:
    s = strength()
    # 100 마다 별 하나
    print(s, "*" * (s // 100))
    sleep(100)`,
            desc: '<code>"*" * 10</code> 은 별 10개를 이어 붙인 글자입니다. 값이 1000 이면 별 10개, 2000 이면 별 20개가 찍혀서 콘솔이 그래프처럼 보입니다.',
            hint: '<b>움직임 조이스틱</b>으로 멈춤 → 걷기 → 뛰기를 각각 5초씩 해 보며 별 막대의 모양을 비교하세요.',
            expect: '1024 **********\n1180 ***********\n 860 ********\n1420 ************** …',
            nondeterministic: true
          },
          {
            type: 'table', caption: '표 2-3. 세 가지 움직임의 숫자 패턴 (예 — 직접 재서 채워 보세요)',
            head: ['움직임', 'strength() 값의 범위 (예)', '패턴', '내가 잰 값'],
            rows: [
              ['멈춤', '약 1000 근처', '거의 그대로', ''],
              ['걷기', '약 800 ~ 1500', '규칙적으로 출렁임', ''],
              ['뛰기', '약 500 ~ 2500', '크고 빠르게 출렁임', '']
            ]
          },
          { type: 'p', html: '걷기와 뛰기는 값이 <b>1000 위아래로 출렁입니다</b>. 발이 땅에 닿는 순간에는 “쿵” 하고 값이 커지고, 몸이 떠오르는 순간에는 값이 작아집니다. 이 출렁임 한 번 한 번이 바로 <b>걸음</b>입니다. 다음 챕터에서 이 출렁임을 세어 만보기를 만듭니다.' },
          {
            type: 'code', title: '예제 2-6. 1초 동안 가장 큰 값 찾기', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

while True:
    biggest = 0
    for i in range(20):        # 0.05초 x 20번 = 1초
        s = strength()
        if s > biggest:
            biggest = s
        sleep(50)
    print("1초 최고:", biggest)`,
            desc: '값이 빠르게 출렁여서 읽기 어려우면 <b>1초 동안 가장 큰 값</b>만 찍어 봅니다. <code>biggest</code> 보다 큰 값이 나오면 바꿔 적는 방법으로 가장 큰 값을 기억합니다. 멈춤 · 걷기 · 뛰기의 차이가 훨씬 또렷하게 보입니다.',
            hint: '조이스틱을 멈춤 · 걷기 · 뛰기로 바꾸면서 “1초 최고” 값을 표 2-3 에 적어 보세요.',
            expect: '1초 최고: 1030\n1초 최고: 1520\n1초 최고: 2380 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '움직임 조이스틱 대신 <b>🧭 센서</b> 탭의 <b>기울기 판</b>을 마우스로 빠르게 흔들거나 <b>흔들기(shake)</b> 제스처 버튼을 눌러도 비슷한 실험을 할 수 있습니다. 다만 걷기 · 뛰기처럼 규칙적인 출렁임은 조이스틱 쪽이 더 잘 보입니다.' },

          { type: 'h', text: '토론 — 보드를 어디에 달까요?' },
          { type: 'p', html: '같은 걸음이라도 보드를 <b>어디에 다느냐</b>에 따라 값이 크게 달라집니다. 프로젝트를 만들기 전에 모둠별로 예상해 보고, 실제 보드로 확인해 봅니다.' },
          {
            type: 'table', caption: '표 2-4. 보드 위치에 따라 달라지는 값 — 토론 카드',
            head: ['위치', '예상되는 값', '좋은 점', '생길 수 있는 문제'],
            rows: [
              ['손에 들기', '팔 흔들림이 섞여 들쭉날쭉', '바로 화면을 볼 수 있음', '팔만 흔들어도 걸음처럼 보임'],
              ['주머니에 넣기', '중간 크기, 조금 무딤', '편하고 잘 안 떨어짐', '주머니 안에서 보드가 굴러 방향이 바뀜'],
              ['신발에 묶기', '발이 닿을 때 아주 큰 “쿵”', '걸음이 가장 또렷함', '한쪽 발만 재므로 걸음 수가 절반, 충격이 너무 큼']
            ]
          },
          { type: 'list', items: [
            '💬 우리 모둠은 러닝 데이터 측정기를 <b>어디에</b> 달고 싶나요? 이유는 무엇인가요?',
            '💬 손에 들고 뛰면, 팔 흔들림과 발걸음을 어떻게 구별할 수 있을까요?',
            '💬 신발에 달면 걸음 수를 어떻게 고쳐서 세면 될까요?'
          ] },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제로 걸으며 실험할 때는 <b>배터리 팩</b>을 연결하고 보드를 <b>고무줄이나 벨크로로 단단히 고정</b>합니다. 헐겁게 매달면 보드가 따로 흔들려서 값이 엉망이 됩니다. USB 케이블을 꽂은 채 걷거나 뛰지 않습니다.' },

          { type: 'h', text: '실습 — 흔들림 미터 만들기' },
          { type: 'p', html: '<code>strength()</code> 값에 따라 LED 화면에 <b>막대 1~5칸</b>이 아래부터 차오르는 “흔들림 미터”를 만듭니다. 기준값 목록 <code>levels</code> 의 숫자를 하나 넘을 때마다 막대가 한 칸씩 올라갑니다. 자기 수준에 맞게 ★ → ★★ → ★★★ 순서로 도전해 봅니다.' },
          {
            type: 'code', title: '예제 2-7. 흔들림 미터 (★ 그대로 실행)', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def show_bar(n):
    # 아래부터 n 줄을 켠 그림 보이기 (n = 1~5)
    rows = ["00000"] * (5 - n) + ["99999"] * n
    display.show(Image(":".join(rows)))

levels = [1200, 1500, 1800, 2200]

while True:
    s = strength()
    n = 1
    for v in levels:
        if s > v:
            n = n + 1
    show_bar(n)
    sleep(100)`,
            desc: '가만히 있으면 막대 1칸, 기준값을 하나 넘을 때마다 한 칸씩 늘어 최대 5칸입니다. <code>show_bar()</code> 는 그림을 그려 주는 준비된 함수입니다.',
            hint: '조이스틱으로 멈춤 · 걷기 · 뛰기를 바꾸며 막대 높이를 보세요.',
            expect: '멈춤이면 맨 아래 1줄, 걷기면 2~3줄, 뛰기면 4~5줄까지 막대가 출렁이며 켜집니다.',
            nondeterministic: true
          },
          {
            type: 'code', title: '응용 2-8. 기준값 바꾸기 (★★)', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def show_bar(n):
    rows = ["00000"] * (5 - n) + ["99999"] * n
    display.show(Image(":".join(rows)))

# 내가 잰 값(표 2-3)에 맞게 네 숫자를 바꿔 보세요
levels = [1100, 1300, 1600, 2000]

while True:
    s = strength()
    n = 1
    for v in levels:
        if s > v:
            n = n + 1
    show_bar(n)
    print(s, n)
    sleep(100)`,
            desc: '걷기만 해도 막대가 5칸까지 올라가면 너무 예민한 것이고, 뛰어도 2칸이면 너무 둔한 것입니다. 표 2-3 에 적은 값을 보고 <code>levels</code> 네 숫자를 고쳐서 <b>걷기 = 2~3칸, 뛰기 = 4~5칸</b>이 되게 맞춰 봅니다. 숫자는 작은 것부터 차례로 적습니다.',
            hint: '콘솔에 찍히는 <code>s</code> 값과 칸 수 <code>n</code> 을 함께 보며 기준값을 고르세요.',
            nondeterministic: true
          },
          {
            type: 'code', title: '도전 2-9. 가장 큰 값 기억해서 B 버튼으로 보기 (★★★)', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def show_bar(n):
    rows = ["00000"] * (5 - n) + ["99999"] * n
    display.show(Image(":".join(rows)))

levels = [1200, 1500, 1800, 2200]
best = 0

while True:
    s = strength()
    if s > best:
        best = s              # 가장 큰 값 기억
    if button_b.was_pressed():
        display.scroll(best)
    if button_a.was_pressed():
        best = 0              # 다시 시작
    n = 1
    for v in levels:
        if s > v:
            n = n + 1
    show_bar(n)
    sleep(100)`,
            desc: '<code>best</code> 에 지금까지 가장 큰 값을 기억합니다. <b>B 버튼</b>을 누르면 그 값을 스크롤하고, <b>A 버튼</b>을 누르면 0 으로 되돌려 새로 잽니다. “누가 가장 세게 뛰었나” 대결에 써 볼 수 있습니다.',
            hint: '조이스틱으로 뛰기를 잠깐 했다가 멈춘 뒤 <b>B 버튼</b>을 눌러 보세요.',
            expect: 'B 를 누르면 지금까지 가장 큰 값(예: 2480)이 흐르고, A 를 누르면 기록이 지워집니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'warn', title: '실제 보드를 흔들 때는', html: '보드를 세게 흔들다 놓치면 떨어져 부서질 수 있습니다. <b>손목 끈이나 고무줄</b>로 묶고, 주변 친구와 거리를 두고 실험합니다. 책상 모서리에 부딪히지 않게 조심합니다.' },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 제스처', html: 'micro:bit 는 흔들림을 미리 몇 가지 모양으로 알아보는 기능도 있습니다. <code>accelerometer.current_gesture()</code> 는 <code>"shake"</code>(흔들기) · <code>"face up"</code>(화면 위) · <code>"freefall"</code>(떨어짐) 같은 글자를 돌려줍니다. 편리하지만 “얼마나 세게”는 알 수 없어서, 이 강좌의 프로젝트에서는 <code>strength()</code> 숫자를 씁니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: '가속도 센서 = 상자 속 공. 세 방향 x · y · z, 단위 mg(1000 ≈ 중력 1배), 가만히 두면 z ≈ -1000. 흔들림 세기는 <code>strength()</code> 하나로 보고, <b>출렁임</b>이 걸음의 신호입니다.' }
        ],
        slides: [
          { layout: 'title', title: '가속도 센서 — 흔들림을 숫자로', subtitle: 'Chapter 02 · 센서로 움직임 읽기', badge: '1교시', notes: '<p>지난 시간 조이스틱으로 얼굴이 바뀌던 예제를 떠올리게 합니다. “그 숫자가 어디서 나왔을까요?”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 엘리베이터', lead: '올라가기 시작할 때 왜 무거울까요?', bullets: ['몸: 제자리에 있으려 함', '바닥: 몸을 위로 밀어 올림', '→ 발바닥이 더 눌림 = 무거운 느낌', '<b>빠르기가 바뀔 때</b> 생기는 느낌'], notes: '<p>적어 온 생각을 2~3명 발표시킵니다.</p><p>💬 “멈출 때는 어떤 느낌일까요?” — 예상 답: 잠깐 가벼워짐.</p><p>💬 “일정하게 올라가는 중간에는?” — 아무 느낌 없음. 가속도는 빠르기가 바뀔 때만 생긴다는 점을 강조합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '상자 속에 매달린 공', html: FIG_BALL, caption: '움직이면 공이 반대쪽으로 쏠림', notes: '<p>실이 달린 물건(열쇠고리 등)을 들고 직접 출발 · 멈춤을 보여 주면 좋습니다.</p><p>💬 “상자를 왼쪽으로 출발시키면 공은?” — 오른쪽으로 쏠림.</p><p>①의 공이 가만히 있어도 아래로 늘어진 것(중력)을 꼭 짚어 둡니다. 뒤에서 z ≈ -1000 의 근거가 됩니다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '세 방향 x · y · z', html: FIG_AXES, notes: '<p>실물 보드를 책상에 눕히고 손가락으로 좌우(x) · 앞뒤(y) · 위아래(z)를 가리킵니다.</p><p>💬 “걸을 때 몸은 주로 어느 방향으로 흔들릴까요?” — 위아래(z) + 앞뒤(y).</p><p>시간: 3분</p>' },
          { layout: 'code', title: 'x · y · z 읽기', code: `from microbit import *

while True:
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    z = accelerometer.get_z()
    print(x, y, z)
    sleep(500)`, points: ['단위 <b>mg</b>: 1000 ≈ 중력 1배', '가만히 두면 <b>z ≈ -1000</b>', '🧭 센서 탭 기울기 판으로 바꿔 보기'], notes: '<p>▶ 실행 후 기울기 판을 끌어 숫자가 바뀌는 것을 보여 줍니다.</p><p>💬 “움직이지 않는데 왜 z 가 0 이 아닐까요?” — 중력(상자 속 공 ①).</p><p>시간: 5분</p>' },
          { layout: 'table', title: '자세에 따른 값 (대략)', head: ['보드 자세', 'x', 'y', 'z'], rows: [['화면 위로 눕힘', '0', '0', '-1000'], ['뒤집음', '0', '0', '+1000'], ['오른쪽으로 세움', '+1000', '0', '0'], ['로고 위로 세움', '0', '-1000', '0']], notes: '<p>실물 보드로 네 자세를 보여 주고, 학생은 기울기 판으로 확인합니다.</p><p>중력 1000 이 세 숫자에 “나뉘어 담긴다”는 표현을 씁니다. 부호는 깊게 다루지 않습니다.</p><p>시간: 2분</p>' },
          { layout: 'code', title: '셸(>>>)에서 바로 확인', repl: true, code: `from microbit import *
accelerometer.get_z()
accelerometer.get_values()`, points: ['한 줄 입력 → 바로 답', '<code>get_values()</code> = (x, y, z) 한꺼번에', '<kbd>↑</kbd> 로 앞 줄 다시 부르기'], notes: '<p>셸은 “센서에게 질문하기”라고 소개합니다.</p><p>기울기를 바꾼 뒤 같은 줄을 다시 실행해 값이 바뀌는 것을 보여 줍니다.</p><p>시간: 2분</p>' },
          { layout: 'diagram', title: '세 화살표를 하나로 — strength()', html: FIG_STRENGTH, caption: '방향과 상관없이 “얼마나 세게”만', notes: '<p>제곱근 · 피타고라스는 말하지 않거나 “중학교에서 배울 계산” 정도로만 언급합니다.</p><p>💬 “가만히 있으면 strength() 는 얼마일까요?” — 약 1000 (중력 1배).</p><p>오른쪽 그래프: 걷기 · 뛰기는 1000 위아래로 출렁인다는 것만 짚습니다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '멈춤 · 걷기 · 뛰기 비교', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

while True:
    s = strength()
    print(s, "*" * (s // 100))
    sleep(100)`, points: ['조이스틱: 가운데 멈춤 · 살짝 걷기 · 끝까지 뛰기', '별 막대 = 콘솔 그래프', '표 2-3 에 내가 잰 값 적기'], notes: '<p>조이스틱을 5초씩 멈춤 → 걷기 → 뛰기로 바꿉니다. 학생들은 각자 값을 표에 적습니다.</p><p>💬 “걷기와 뛰기는 무엇이 다른가요?” — 출렁임의 크기와 빠르기.</p><p>조이스틱이 보이지 않으면 흔들기 제스처로 대신합니다.</p><p>시간: 5분</p>' },
          { layout: 'table', title: '토론 — 보드를 어디에 달까?', head: ['위치', '좋은 점', '문제'], rows: [['손에 들기', '화면 보기 쉬움', '팔 흔들림이 섞임'], ['주머니', '편함', '보드가 굴러 방향 바뀜'], ['신발', '걸음이 또렷', '한쪽 발 → 절반, 큰 충격']], notes: '<p>모둠별로 한 위치를 맡아 예상 값과 문제를 1분 동안 이야기한 뒤 발표합니다.</p><p>💬 “신발에 달면 걸음 수를 어떻게 고칠까요?” — ×2.</p><p>💬 “손에 들고 팔만 흔들면?” — 걸음으로 잘못 셀 수 있음. 다음 챕터 만보기에서 다시 다룹니다.</p><p>시간: 6분</p>' },
          { layout: 'practice', title: '실습 — 흔들림 미터', desc: '<code>strength()</code> 값에 따라 LED 막대 1~5칸. ★ 그대로 · ★★ levels 바꾸기 · ★★★ 가장 큰 값 기억해 B 로 보기', starter: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def show_bar(n):
    rows = ["00000"] * (5 - n) + ["99999"] * n
    display.show(Image(":".join(rows)))

levels = [1200, 1500, 1800, 2200]

while True:
    s = strength()
    n = 1
    # TODO: levels 의 값을 넘을 때마다 n 을 1 늘리기
    show_bar(n)
    sleep(100)`, solution: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def show_bar(n):
    rows = ["00000"] * (5 - n) + ["99999"] * n
    display.show(Image(":".join(rows)))

levels = [1200, 1500, 1800, 2200]
best = 0

while True:
    s = strength()
    if s > best:
        best = s
    if button_b.was_pressed():
        display.scroll(best)
    n = 1
    for v in levels:
        if s > v:
            n = n + 1
    show_bar(n)
    sleep(100)`, notes: '<p>★ 학생은 예제 2-7 을 그대로 실행하고 조이스틱으로 확인합니다. ★★ 학생은 자기가 잰 값으로 levels 를 고칩니다. ★★★ 학생은 best 와 B 버튼을 더합니다.</p><p>levels 숫자는 작은 것부터 적어야 한다는 점을 돌아다니며 확인합니다.</p><p>시간: 10분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['가속도 센서 = 상자 속 공', 'x 좌우 · y 앞뒤 · z 위아래, 단위 mg', '가만히 두면 z ≈ -1000 (중력)', '<code>strength()</code> = 세 화살표를 합친 길이', '걷기 · 뛰기 = 1000 위아래로 출렁임'], notes: '<p>다섯 가지를 함께 읽습니다.</p><p>다음 시간 “생각하기”: 건물 안이나 철제 책상 위에서 나침반 바늘이 엉뚱한 곳을 가리키는 까닭은 무엇일까요? 를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch02-2',
        title: '지자기 센서 — 방향 알아내기',
        minutes: 50,
        goals: [
          '지자기 센서를 “보드 속 작은 나침반”으로 설명할 수 있다',
          '<code>compass.calibrate()</code> 로 보정하고 <code>compass.heading()</code> 으로 방위각(0~359)을 읽을 수 있다',
          '준비된 함수 <code>direction8()</code> 과 화살표 그림으로 방향을 LED 에 표시할 수 있다',
          '방향이 틀어지는 원인(자석 · 쇠 · 기울어짐 · 보정 안 함)을 토론하고 북쪽 화살표 나침반을 만들 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['지자기 센서 · 방위각', 7], ['보정 · heading 읽기', 8], ['8방향 · 화살표', 8], ['방향 전환 시뮬레이션', 5], ['토론: 방향이 틀어지는 원인', 6], ['실습: 화살표 나침반', 9], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '건물 안이나 <b>철제 책상 위</b>에 나침반을 놓으면 바늘이 엉뚱한 곳을 가리킬 때가 있습니다. 왜 그럴까요? 나침반 바늘이 무엇으로 만들어졌는지 떠올리며 내 생각을 한두 문장으로 적어 오세요.' },
          { type: 'p', html: '적어 온 생각을 나눠 봅니다. 나침반 바늘은 <b>아주 가벼운 자석</b>입니다. 지구 전체가 커다란 자석이라서 바늘이 북쪽을 가리키지요. 그런데 바로 옆에 <b>쇠나 다른 자석</b>이 있으면, 멀리 있는 지구 자석보다 가까운 쪽에 더 크게 끌립니다. 그래서 바늘이 엉뚱한 곳을 가리킵니다. 오늘 배울 센서도 똑같은 약점을 가지고 있습니다.' },

          { type: 'h', text: '보드 속 작은 나침반 — 지자기 센서' },
          { type: 'p', html: '지구가 가진 자석의 힘을 <b>지자기(geomagnetism)</b>라고 합니다. micro:bit 뒷면에는 이 힘을 느끼는 <b>지자기 센서(magnetometer)</b>가 있습니다. 바늘은 없지만, 지구 자석이 어느 쪽으로 당기는지를 숫자로 재서 <b>보드가 어느 방향을 보고 있는지</b> 알려 줍니다. micro:bit 에서는 이 센서를 <code>compass</code>(나침반)라는 이름으로 씁니다.' },
          { type: 'p', html: '방향은 <code>compass.heading()</code> 으로 읽습니다. 이 값을 <b>방위각(heading)</b>이라고 하고, 보드의 <b>위쪽(로고 쪽)</b>이 가리키는 방향을 <b>0 ~ 359 도</b>로 알려 줍니다. 북쪽이 0, 시계 방향으로 돌아서 동쪽이 90, 남쪽이 180, 서쪽이 270 입니다.' },
          { type: 'figure', html: FIG_ROSE, caption: '그림 2-4. 방위각 0~359 도와 8방향' },
          {
            type: 'table', caption: '표 2-5. 방위각과 8방향',
            head: ['방위각(대략)', '방향 글자', '뜻'],
            rows: [
              ['0', 'N', '북'], ['45', 'NE', '북동'], ['90', 'E', '동'], ['135', 'SE', '남동'],
              ['180', 'S', '남'], ['225', 'SW', '남서'], ['270', 'W', '서'], ['315', 'NW', '북서']
            ]
          },

          { type: 'h', text: '먼저 보정하기 — compass.calibrate()' },
          { type: 'p', html: '센서는 공장마다, 보드마다, 놓인 장소마다 조금씩 다르게 느낍니다. 그래서 처음 쓸 때 “여기서는 이렇게 느끼는 거야” 하고 맞춰 주는 <b>보정(calibration)</b>이 필요합니다. <code>compass.calibrate()</code> 를 실행하면 화면에 안내가 나오고, 보드를 기울여 <b>LED 점을 모두 채우면</b> 보정이 끝납니다.' },
          { type: 'list', ordered: true, items: [
            '화면에 <code>TILT TO FILL SCREEN</code> 이라는 글자가 흐릅니다.',
            '보드를 천천히 이리저리 기울이면 가운데 점이 움직이며 지나간 자리의 LED 가 켜집니다.',
            '25칸을 모두 채우면 웃는 얼굴이 잠깐 나오고 보정이 끝납니다.',
            '보정은 한 번 하면 전원을 끌 때까지 유지됩니다. <code>heading()</code> 을 처음 부를 때 보정이 안 되어 있으면 보정이 저절로 시작되기도 합니다.'
          ] },
          {
            type: 'code', title: '예제 2-10. 보정하고 방위각 찍기', code: `from microbit import *

compass.calibrate()          # 처음에 한 번 보정

while True:
    h = compass.heading()
    print("방위각:", h)
    sleep(500)`,
            desc: '보정이 끝나면 0.5초마다 방위각이 찍힙니다. 실제 보드라면 몸을 천천히 한 바퀴 돌며 숫자가 0 → 90 → 180 → 270 → 359 → 0 으로 바뀌는지 확인합니다.',
            hint: '<b>🧭 센서</b> 탭의 <b>방위각 슬라이더</b>를 움직여 보세요.',
            expect: '방위각: 0\n방위각: 45\n방위각: 90 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '시뮬레이터는 보정을 흉내만 내고 바로 넘어갑니다. <b>실제 보드</b>에서는 보정 화면이 나오니 끝까지 점을 채워야 다음 줄이 실행됩니다. 보정은 <b>철제 책상에서 떨어진 곳</b>에서, 실제로 쓸 장소에서 하는 것이 좋습니다.' },
          {
            type: 'code', title: '예제 2-11. 셸에서 방향 물어보기', repl: true, code: `from microbit import *
compass.heading()
compass.is_calibrated()`,
            desc: '<code>is_calibrated()</code> 는 보정이 되어 있으면 <code>True</code>, 아니면 <code>False</code> 를 돌려줍니다.',
            hint: '방위각 슬라이더를 옮긴 뒤 <code>compass.heading()</code> 을 다시 입력해 보세요.',
            expect: '>>> compass.heading()\n0\n>>> compass.is_calibrated()\nTrue',
            nondeterministic: true
          },

          { type: 'h', text: '숫자를 8방향 글자로 — direction8()' },
          { type: 'p', html: '“지금 137도”라고 하면 바로 와닿지 않습니다. 그래서 0~359 도를 <b>45도씩 8조각</b>으로 나눠 <code>\'N\'</code>, <code>\'NE\'</code>, <code>\'E\'</code> … 같은 글자로 바꾸는 <b>준비된 함수</b> <code>direction8(heading)</code> 을 씁니다. 넣는 것은 방위각 숫자, 나오는 것은 방향 글자입니다. 그림 2-4 의 조각 중 어디에 들어가는지 찾아 주는 함수라고 생각하면 됩니다.' },
          {
            type: 'code', title: '예제 2-12. 8방향 글자로 보이기', code: `from microbit import *

def direction8(heading):
    # 0~359 도를 8조각 중 하나의 글자로
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return names[((heading + 22) // 45) % 8]

compass.calibrate()

while True:
    h = compass.heading()
    d = direction8(h)
    print(h, d)
    display.scroll(d)
    sleep(200)`,
            desc: '<code>direction8(100)</code> 은 <code>"E"</code>, <code>direction8(350)</code> 은 <code>"N"</code> 입니다. 북쪽 조각은 337~359 도와 0~22 도 두 곳에 걸쳐 있는데, 함수가 알아서 처리합니다.',
            hint: '방위각 슬라이더를 0 → 90 → 180 → 270 으로 옮기며 글자를 확인하세요.',
            expect: '100 E\n175 S\n350 N …',
            nondeterministic: true
          },
          { type: 'p', html: '글자 대신 <b>화살표 그림</b>으로 보여 줄 수도 있습니다. micro:bit 에는 <code>Image.ARROW_N</code>(위쪽 ↑), <code>Image.ARROW_E</code>(오른쪽 →) 처럼 8방향 화살표 그림이 들어 있습니다. 방향 글자와 같은 순서로 목록을 만들어 두면 같은 번호로 꺼내 쓸 수 있습니다.' },
          {
            type: 'code', title: '예제 2-13. 내가 보는 방향을 화살표로', code: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    # 0~359 도 → 0~7 번 조각
    return ((heading + 22) // 45) % 8

while True:
    i = index8(compass.heading())
    display.show(ARROWS[i])
    sleep(200)`,
            desc: '보드가 북쪽을 보면 ↑, 동쪽을 보면 → 가 나옵니다. 이것은 “<b>내가 어느 쪽을 보고 있는지</b>”를 지도 위 방향으로 보여 주는 화살표입니다. 진짜 나침반처럼 <b>북쪽을 가리키는</b> 화살표는 실습에서 만듭니다.',
            hint: '방위각 슬라이더를 천천히 한 바퀴 돌려 보세요.',
            expect: '방위각이 0 이면 ↑, 90 이면 →, 180 이면 ↓, 270 이면 ← 화살표가 보입니다.',
            nondeterministic: true
          },

          { type: 'h', text: '움직임 시뮬레이션 — 방향 틀기' },
          { type: 'p', html: '이번에는 <b>움직임 조이스틱</b>을 <b>옆으로</b> 밀어 가상의 사람이 몸을 돌리게 합니다. 사람이 오른쪽으로 돌면 방위각이 커지고, 왼쪽으로 돌면 작아집니다. 걸으면서 돌 때 방향 값과 흔들림 값이 함께 어떻게 바뀌는지 봅니다. 실내 이동 경로 프로젝트에서는 바로 이 두 값으로 “어느 쪽으로 몇 걸음”을 알아냅니다.' },
          {
            type: 'code', title: '예제 2-14. 걸으며 방향 바꾸기 관찰', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

def direction8(heading):
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return names[((heading + 22) // 45) % 8]

while True:
    h = compass.heading()
    print("방향", h, direction8(h), " 세기", strength())
    sleep(300)`,
            desc: '방위각 · 8방향 글자 · 흔들림 세기를 한 줄에 찍습니다. 방향은 <b>돌 때만</b> 바뀌고, 세기는 <b>걸을 때</b> 출렁이는 것을 구별해 보세요.',
            hint: '조이스틱을 위로 밀어 걷게 한 뒤, 옆으로 밀어 오른쪽 · 왼쪽으로 돌게 해 보세요.',
            expect: '방향 0 N  세기 1180\n방향 32 NE  세기 870\n방향 91 E  세기 1310 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '조이스틱이 안 보이면', html: '<b>🧭 센서</b> 탭의 <b>방위각 슬라이더</b>로 방향을 바꾸면 됩니다. 걷는 흔들림은 흔들기 제스처나 기울기 판으로 대신합니다.' },

          { type: 'h', text: '토론 — 방향이 틀어지는 원인' },
          { type: 'p', html: '“생각하기”에서 나온 나침반의 약점은 지자기 센서에도 그대로 있습니다. 실내 이동 경로를 그릴 때 방향이 10도만 틀려도 긴 복도를 지나면 경로가 옆방으로 새어 버립니다. 무엇이 방향을 틀어지게 하는지, 어떻게 줄일 수 있는지 모둠별로 이야기해 봅니다.' },
          { type: 'figure', html: FIG_NOISE, caption: '그림 2-6. 지자기 센서를 헷갈리게 하는 것들' },
          {
            type: 'table', caption: '표 2-6. 방향이 틀어지는 원인과 줄이는 방법 — 토론 카드',
            head: ['원인', '왜 틀어질까요?', '줄이는 방법 (생각해 보기)'],
            rows: [
              ['철제 책상 · 의자 · 철문', '쇠가 지구 자석의 힘을 휘게 함', '쇠에서 30cm 이상 떨어져 재기'],
              ['스마트폰 · 스피커 · 자석 필통', '속에 든 자석이 더 가깝고 셈', '보드 근처에 두지 않기'],
              ['보드가 기울어짐', '센서가 평평할 때를 기준으로 계산', '보드를 평평하게 고정하기'],
              ['보정을 안 함', '보드마다 · 장소마다 느낌이 다름', '쓰기 전에 그 장소에서 calibrate()']
            ]
          },
          {
            type: 'code', title: '예제 2-15. 자석 세기 살펴보기', code: `from microbit import *

while True:
    f = compass.get_field_strength()
    print("자석 세기:", f)
    sleep(500)`,
            desc: '<code>get_field_strength()</code> 는 보드가 느끼는 <b>자석의 힘의 크기</b>입니다. 주변에 방해물이 없으면 거의 일정합니다. 갑자기 크게 바뀌면 “근처에 자석이나 쇠가 있다”는 신호이므로, 그때 잰 방향은 믿지 않는 편이 좋습니다.',
            hint: '시뮬레이터에서는 값이 일정하게 나옵니다. 실제 보드라면 스마트폰이나 자석을 가까이 가져가 보세요.',
            expect: '자석 세기: 50000\n자석 세기: 50000 …',
            nondeterministic: true
          },
          { type: 'callout', kind: 'board', title: '실제 보드로 꼭 해 볼 실험', html: '실제 보드로 예제 2-15 를 실행하고 <b>철제 책상 위</b> · <b>나무 책상 위</b> · <b>스마트폰 옆</b>에서 값을 비교해 봅니다. 시뮬레이터는 방해물이 없는 깨끗한 세상이라 이 차이가 보이지 않습니다. 자석은 보드에 직접 붙이지 말고 천천히 가까이 가져갑니다.' },
          { type: 'list', items: [
            '💬 교실에서 방향을 재기 <b>가장 나쁜 곳</b>과 <b>가장 좋은 곳</b>은 어디일까요?',
            '💬 보드를 신발에 달면 방향 재기에는 좋을까요, 나쁠까요? (발이 기울어진다는 점을 떠올려 보세요)',
            '💬 방향이 갑자기 튀었을 때 프로그램은 어떻게 하면 좋을까요?'
          ] },

          { type: 'h', text: '실습 — 항상 북쪽을 가리키는 화살표 나침반' },
          { type: 'p', html: '진짜 나침반은 내가 어느 쪽을 보든 바늘이 <b>북쪽</b>을 가리킵니다. 예제 2-13 의 화살표는 “내가 보는 방향”이었지요. 북쪽을 가리키게 하려면 화살표를 <b>반대로</b> 돌려야 합니다. 보드가 동쪽(90도)을 보면 북쪽은 보드의 <b>왼쪽</b>에 있으니 화살표는 ← 가 되어야 합니다.' },
          { type: 'figure', html: FIG_NEEDLE, caption: '그림 2-5. 보드가 돌면 북쪽 화살표는 반대로 돈다' },
          { type: 'p', html: '계산은 간단합니다. 방위각이 <code>h</code> 라면 북쪽은 보드 기준으로 <code>360 - h</code> 도 쪽에 있습니다. 이 각도를 8방향 번호로 바꿔 화살표를 꺼내면 됩니다.' },
          {
            type: 'code', title: '예제 2-16. 화살표 나침반 (기본)', code: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    return ((heading + 22) // 45) % 8

compass.calibrate()

while True:
    h = compass.heading()
    north = (360 - h) % 360      # 보드 기준 북쪽 각도
    display.show(ARROWS[index8(north)])
    sleep(100)`,
            desc: '방위각이 0 이면 ↑, 90 이면 ←, 180 이면 ↓, 270 이면 → 가 나옵니다. <code>% 360</code> 은 360 을 0 으로 되돌려 주는 계산입니다.',
            hint: '방위각 슬라이더를 오른쪽으로 옮길수록 화살표가 반대(왼쪽)로 도는지 확인하세요.',
            expect: '방위각 0 → ↑,  90 → ←,  180 → ↓,  270 → →',
            nondeterministic: true
          },
          {
            type: 'code', title: '응용 2-17. 8방향 글자 표시 추가 (★★)', code: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    return ((heading + 22) // 45) % 8

def direction8(heading):
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return names[index8(heading)]

compass.calibrate()

while True:
    h = compass.heading()
    if button_a.was_pressed():
        display.scroll(direction8(h))     # 내가 보는 방향 글자
    north = (360 - h) % 360
    display.show(ARROWS[index8(north)])
    sleep(100)`,
            desc: '평소에는 북쪽 화살표를 보이다가, <b>A 버튼</b>을 누르면 내가 보고 있는 방향을 <code>"NE"</code> 같은 글자로 흘려 줍니다.',
            hint: '방위각 슬라이더를 옮긴 뒤 <b>A 버튼</b>을 눌러 보세요.',
            expect: '방위각 100 에서 A 를 누르면 “E” 가 흐른 뒤 다시 화살표가 보입니다.',
            nondeterministic: true
          },
          {
            type: 'code', title: '도전 2-18. 지금 방향을 기억하고 얼마나 돌았는지 보기 (★★★)', code: `from microbit import *

def turned(start, now):
    # 시작 방향에서 얼마나 돌았나: -180 ~ 180 (오른쪽 +, 왼쪽 -)
    d = (now - start) % 360
    if d > 180:
        d = d - 360
    return d

compass.calibrate()
start = compass.heading()
display.show(Image.YES)

while True:
    if button_a.was_pressed():
        start = compass.heading()      # 지금 방향 기억
        display.show(Image.YES)
    if button_b.was_pressed():
        display.scroll(turned(start, compass.heading()))
    sleep(50)`,
            desc: '<b>A 버튼</b>으로 지금 방향을 기억하고, 몸을 돌린 뒤 <b>B 버튼</b>을 누르면 몇 도 돌았는지 보여 줍니다. 오른쪽으로 돌면 +, 왼쪽으로 돌면 − 입니다. 준비된 함수 <code>turned()</code> 는 350도 → 10도처럼 북쪽을 지나갈 때도 “20도 돌았다”고 바르게 계산해 줍니다.',
            hint: '<b>A</b> 를 누르고, 방위각 슬라이더(또는 조이스틱)로 방향을 바꾼 뒤 <b>B</b> 를 눌러 보세요.',
            expect: '방위각 350 에서 A, 10 으로 옮긴 뒤 B → “20”,  다시 300 으로 옮긴 뒤 B → “-50”',
            nondeterministic: true
          },
          { type: 'callout', kind: 'tip', title: '“얼마나 돌았나”가 왜 중요할까요?', html: '실내에서는 “북쪽”보다 “아까보다 오른쪽으로 90도 돌았다”가 더 쓸모 있을 때가 많습니다. 방해물 때문에 북쪽이 조금 틀어져 있어도, <b>같은 장소에서 잰 두 값의 차이</b>는 비교적 믿을 만하기 때문입니다. 이 아이디어는 실내 이동 경로 프로젝트에서 다시 씁니다.' },
          { type: 'callout', kind: 'tip', title: '오늘의 핵심', html: '지자기 센서 = 보드 속 작은 나침반. 먼저 <code>compass.calibrate()</code>, 방향은 <code>compass.heading()</code>(0 = 북, 90 = 동). 8방향은 <code>direction8()</code>, 화살표는 <code>Image.ARROW_N</code> …. 쇠 · 자석 · 기울어짐 · 보정 안 함이 방향을 틀어지게 합니다.' }
        ],
        slides: [
          { layout: 'title', title: '지자기 센서 — 방향 알아내기', subtitle: 'Chapter 02 · 센서로 움직임 읽기', badge: '2교시', notes: '<p>1교시는 “얼마나 세게”, 2교시는 “어느 쪽으로”라고 연결합니다. 두 값을 합치면 이동 경로가 된다고 예고만 합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 엉뚱한 나침반', lead: '철제 책상 위에서 바늘이 왜 엉뚱할까?', bullets: ['바늘 = 가벼운 자석', '지구 = 커다란 자석 → 북쪽', '가까운 쇠 · 자석에 더 크게 끌림', '→ 우리 센서도 같은 약점'], notes: '<p>적어 온 생각을 발표시킵니다. 가능하면 실제 나침반을 철제 책상 위 · 아래에 두고 바늘이 바뀌는 것을 보여 줍니다.</p><p>💬 “스마트폰을 나침반 옆에 두면?” — 바늘이 움직임.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '방위각 0 ~ 359 와 8방향', html: FIG_ROSE, caption: '0 = 북, 90 = 동, 시계 방향으로 커짐', notes: '<p>교실의 북쪽을 미리 확인해 두고 손으로 가리키며 설명합니다.</p><p>💬 “남쪽은 몇 도일까요?” — 180. “북서쪽은?” — 315.</p><p>보드의 <b>위쪽(로고 쪽)</b>이 가리키는 방향이라는 점을 강조합니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '보정하고 방위각 읽기', code: `from microbit import *

compass.calibrate()

while True:
    h = compass.heading()
    print("방위각:", h)
    sleep(500)`, points: ['<code>calibrate()</code>: 기울여서 점 25칸 채우기', '<code>heading()</code>: 0 ~ 359', '🧭 센서 탭 방위각 슬라이더'], notes: '<p>실제 보드로 보정 화면(TILT TO FILL SCREEN)을 먼저 시연합니다. 시뮬레이터는 보정을 바로 넘어갑니다.</p><p>주의: 보정은 철제 책상에서 떨어져서 합니다.</p><p>시간: 6분</p>' },
          { layout: 'code', title: '셸에서 방향 묻기', repl: true, code: `from microbit import *
compass.heading()
compass.is_calibrated()`, points: ['슬라이더 옮기고 다시 묻기', '<code>True</code> = 보정 완료'], notes: '<p>짧게 시연하고 넘어갑니다.</p><p>시간: 2분</p>' },
          { layout: 'code', title: '8방향 글자 — direction8()', code: `from microbit import *

def direction8(heading):
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return names[((heading + 22) // 45) % 8]

while True:
    h = compass.heading()
    print(h, direction8(h))
    display.scroll(direction8(h))
    sleep(200)`, points: ['넣는 것: 방위각 → 나오는 것: 방향 글자', '45도씩 8조각', '안의 계산은 몰라도 OK'], notes: '<p>함수 안의 계산식은 설명하지 않습니다. “그림 2-4 의 조각을 찾아 주는 도구”라고만 합니다.</p><p>💬 “direction8(200) 은?” — S (180~202 사이는 S, 203 부터 SW). 학생이 직접 슬라이더로 확인하게 합니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '내가 보는 방향을 화살표로', code: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    return ((heading + 22) // 45) % 8

while True:
    display.show(ARROWS[index8(compass.heading())])
    sleep(200)`, points: ['<code>Image.ARROW_N</code> ↑ · <code>ARROW_E</code> → …', '글자 목록과 같은 순서', '“내가 보는 방향” 화살표'], notes: '<p>💬 “이 화살표는 북쪽을 가리키나요?” — 아니요, 내가 보는 방향. 실습에서 북쪽 화살표로 바꿉니다.</p><p>시간: 4분</p>' },
          { layout: 'code', title: '걸으며 방향 바꾸기', code: `from microbit import *
import math

def strength():
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))

while True:
    print("방향", compass.heading(), " 세기", strength())
    sleep(300)`, points: ['조이스틱 위: 걷기 · 옆: 돌기', '방향은 돌 때만, 세기는 걸을 때', '두 값 = 이동 경로의 재료'], notes: '<p>조이스틱으로 걷다가 오른쪽으로 90도 돌기를 보여 줍니다.</p><p>💬 “어느 쪽으로 몇 걸음 갔는지 알면 무엇을 그릴 수 있을까요?” — 이동 경로(뒤 챕터 예고만).</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '방향이 틀어지는 원인', html: FIG_NOISE, notes: '<p>모둠별로 원인 하나씩 맡아 “왜?”와 “줄이는 방법”을 토론합니다.</p><p>💬 “교실에서 방향 재기 가장 나쁜 곳은?” — 철제 사물함 · 칠판 옆 · 스피커 옆.</p><p>💬 “10도 틀리면 문제가 될까요?” — 긴 복도를 지나면 경로가 옆방으로 샘.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '원인과 줄이는 방법', head: ['원인', '줄이는 방법'], rows: [['철제 책상 · 철문', '30cm 이상 떨어지기'], ['스마트폰 · 스피커', '보드 근처에 두지 않기'], ['기울어짐', '평평하게 고정'], ['보정 안 함', '그 장소에서 calibrate()']], notes: '<p>토론 결과를 표로 정리합니다. 실제 보드가 있으면 <code>get_field_strength()</code> 로 스마트폰을 가까이 댈 때 값이 바뀌는 것을 보여 줍니다 (예제 2-15).</p><p>시간: 2분</p>' },
          { layout: 'diagram', title: '북쪽 화살표는 반대로 돈다', html: FIG_NEEDLE, notes: '<p>실물 보드를 들고 몸을 동쪽으로 돌리며 “북쪽은 어디?” 하고 묻습니다 — 내 왼쪽.</p><p>그래서 북쪽 각도 = 360 − h 라는 것을 이끌어 냅니다.</p><p>시간: 2분</p>' },
          { layout: 'practice', title: '실습 — 화살표 나침반', desc: '항상 북쪽을 가리키는 화살표. ★★ A 버튼으로 8방향 글자 · ★★★ A 로 지금 방향 기억, B 로 돈 각도 보기', starter: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    return ((heading + 22) // 45) % 8

compass.calibrate()

while True:
    h = compass.heading()
    north = 0       # TODO: 보드 기준 북쪽 각도 계산
    display.show(ARROWS[index8(north)])
    sleep(100)`, solution: `from microbit import *

ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

def index8(heading):
    return ((heading + 22) // 45) % 8

def turned(start, now):
    d = (now - start) % 360
    if d > 180:
        d = d - 360
    return d

compass.calibrate()
start = compass.heading()

while True:
    h = compass.heading()
    if button_a.was_pressed():
        start = h
    if button_b.was_pressed():
        display.scroll(turned(start, h))
    north = (360 - h) % 360
    display.show(ARROWS[index8(north)])
    sleep(100)`, notes: '<p>★ 학생은 예제 2-16 을 실행하고 슬라이더로 확인합니다. ★★ 학생은 응용 2-17, ★★★ 학생은 도전 2-18 을 합칩니다.</p><p>실제 보드가 있는 모둠은 교실을 한 바퀴 돌며 화살표가 창문 쪽(북쪽)을 계속 가리키는지 확인합니다.</p><p>시간: 9분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['지자기 센서 = 보드 속 작은 나침반', '먼저 <code>calibrate()</code>, 방향은 <code>heading()</code>', '0 = 북 · 90 = 동, <code>direction8()</code> 로 8방향', '북쪽 화살표 = 360 − h', '쇠 · 자석 · 기울어짐 · 보정 안 함 주의'], notes: '<p>다섯 가지를 함께 읽고, 1교시 strength() 와 2교시 heading() 이 두 프로젝트의 재료라는 것을 정리합니다.</p><p>다음 챕터 “생각하기”를 안내합니다: 걸을 때 출렁이는 strength() 값에서 “한 걸음”을 어떻게 골라낼 수 있을까요?</p><p>시간: 2분</p>' }
        ]
      }
    ]
  });
})();
