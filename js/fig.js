/* 강의 본문 그림에서 쓰는 micro:bit 보드 그리기 도우미
 * 시뮬레이터(js/simview.js)와 같은 모양·비율을 쓰므로 본문 그림과 실제 화면이 어긋나지 않는다.
 * 사용법:  MB_FIG.board({ x: 400, y: 20, scale: 0.9, leds: '0101…' })
 */
'use strict';

window.MB_FIG = (function () {
  // 엣지 커넥터의 실제 배열 (왼쪽 → 오른쪽)
  const EDGE = ['3', '0', '4', '5', '6', '7', '1', '8', '9', '10', '11', '12', '2', '13', '14', '15', '16', '3V', '19', '20', 'GND'];
  const BIG = { '0': 1, '1': 1, '2': 1, '3V': 1, 'GND': 1 };

  const W = 460, H = 377, BOT = 363;
  const PAD_X0 = 42, PAD_SPAN = 376, W_BIG = 36, W_SMALL = 8;

  /** 패드 배치를 미리 계산해 둔다 → [{name, x, w, cx, big}] */
  const PADS = (() => {
    const total = EDGE.reduce((a, n) => a + (BIG[n] ? W_BIG : W_SMALL), 0);
    const gap = (PAD_SPAN - total) / (EDGE.length - 1);
    let x = PAD_X0;
    return EDGE.map((name) => {
      const big = !!BIG[name];
      const w = big ? W_BIG : W_SMALL;
      const p = { name, x, w, cx: x + w / 2, big };
      x += w + gap;
      return p;
    });
  })();

  /** 보드 좌표계(460 × 377) 안의 주요 위치 — 설명선을 이어 붙일 때 쓴다 */
  const ANCHOR = {
    logo: [230, 52], mic: [400, 54], screen: [230, 178],
    btnA: [77, 175], btnB: [383, 175], speaker: [56, 256],
    edge: [230, 332], edgeTop: [230, 300],
    pad: (name) => { const p = PADS.find((q) => q.name === name); return p ? [p.cx, 332] : [230, 332]; }
  };

  const COLOR = { body: '#0e6b64', edge: '#0a4f4a', ledOn: '#ff2d1a', ledOff: '#4a1a16', gold: '#c9a227', goldBig: '#e2b727', logo: '#d4a017', ic: '#11171c', text: '#cfe9e6' };

  /**
   * micro:bit 보드 한 장을 그린다.
   * @param {object} o
   *   x, y      놓을 위치 (기본 0, 0)
   *   scale     크기 배율 (기본 1)
   *   leds      LED 25칸의 밝기 문자열 '0'~'9' (예: Image.HEART → '09090999999999909990 0900')
   *   labels    엣지 커넥터 번호 표시 여부 (기본 true)
   *   btnLabel  버튼 A · B 글자 표시 여부 (기본 true)
   *   ics       스피커 · 마이크 표시 여부 (기본 true)
   */
  function board(o) {
    o = o || {};
    const leds = String(o.leds || '').replace(/[^0-9]/g, '');
    const labels = o.labels !== false;
    const btnLabel = o.btnLabel !== false;
    const ics = o.ics !== false;

    const screen = Array.from({ length: 25 }, (_, i) => {
      const v = +(leds[i] || 0);
      const x = 156 + (i % 5) * 34, y = 108 + Math.floor(i / 5) * 30;
      return `<rect x="${x}" y="${y}" width="12" height="20" rx="3" fill="${v ? COLOR.ledOn : COLOR.ledOff}"${v && v < 9 ? ` opacity="${(0.2 + v / 9 * 0.8).toFixed(2)}"` : ''}/>`;
    }).join('');

    const edge = PADS.map((p) => {
      const top = p.big ? 302 : 318;
      return `<rect x="${p.x.toFixed(1)}" y="${top}" width="${p.w}" height="${BOT - top}" rx="1.5" fill="${p.big ? COLOR.goldBig : COLOR.gold}"/>` +
        (p.big ? `<circle cx="${p.cx.toFixed(1)}" cy="330" r="12" fill="${COLOR.body}" stroke="#b08f18" stroke-width="1.4"/>` : '');
    }).join('');

    const padText = labels ? PADS.filter((p) => p.big)
      .map((p) => `<text x="${p.cx.toFixed(1)}" y="294" text-anchor="middle" font-size="15" font-weight="bold" fill="#d9f0ed">${p.name}</text>`).join('') : '';

    const icons = ics ? `
  <circle cx="400" cy="54" r="13" fill="${COLOR.ic}"/><text x="400" y="60" text-anchor="middle" font-size="13" fill="#9fd8d3">🎙</text>
  <circle cx="56" cy="256" r="14" fill="${COLOR.ic}"/><text x="56" y="262" text-anchor="middle" font-size="14" fill="#9fd8d3">♪</text>` : '';

    const t = `translate(${o.x || 0} ${o.y || 0})${o.scale && o.scale !== 1 ? ` scale(${o.scale})` : ''}`;
    return `<g transform="${t}" font-family="sans-serif">
  <path d="M14 44 Q14 14 44 14 L416 14 Q446 14 446 44 L446 338 L421 ${BOT} L39 ${BOT} L14 338 Z" fill="${COLOR.body}" stroke="${COLOR.edge}" stroke-width="2"/>
  ${edge}${padText}
  <circle cx="212" cy="52" r="10" fill="${COLOR.logo}"/><circle cx="248" cy="52" r="10" fill="${COLOR.logo}"/>
  <rect x="202" y="63" width="56" height="11" rx="5.5" fill="${COLOR.logo}" opacity=".45"/>
  <rect x="48" y="146" width="58" height="58" rx="10" fill="#101418"/><circle cx="77" cy="175" r="16" fill="#2b3138"/>
  <rect x="354" y="146" width="58" height="58" rx="10" fill="#101418"/><circle cx="383" cy="175" r="16" fill="#2b3138"/>
  ${btnLabel ? `<text x="77" y="228" text-anchor="middle" font-size="22" font-weight="bold" fill="${COLOR.text}">A</text>
  <text x="383" y="228" text-anchor="middle" font-size="22" font-weight="bold" fill="${COLOR.text}">B</text>` : ''}
  ${screen}${icons}
</g>`;
  }

  /** 5 × 5 LED 화면만 따로 그린다 (본문에서 그림 예시를 보일 때) */
  function screen(leds, o) {
    o = o || {};
    const px = String(leds || '').replace(/[^0-9]/g, '');
    const s = o.size || 150;
    return `<svg viewBox="0 0 150 150" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="150" height="150" rx="12" fill="${COLOR.body}"/>
      ${Array.from({ length: 25 }, (_, i) => {
      const v = +(px[i] || 0);
      return `<rect x="${18 + (i % 5) * 26}" y="${16 + Math.floor(i / 5) * 26}" width="14" height="20" rx="3" fill="${v ? COLOR.ledOn : COLOR.ledOff}"${v && v < 9 ? ` opacity="${(0.2 + v / 9 * 0.8).toFixed(2)}"` : ''}/>`;
    }).join('')}
    </svg>`;
  }

  /** 화면 그림 + 설명을 한 덩어리로 (본문 figure 안에서 나란히 배치) */
  function tile(leds, label, size) {
    return `<div style="display:inline-block;text-align:center;margin:6px 9px;vertical-align:top">
      ${screen(leds, { size: size || 110 })}
      ${label ? `<div style="font-size:12.5px;color:var(--muted);margin-top:2px;font-family:var(--mono)">${label}</div>` : ''}</div>`;
  }

  return { board, screen, tile, ANCHOR, PADS, EDGE, BIG, W, H, BOT, COLOR };
})();
