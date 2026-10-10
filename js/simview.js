/* 오른쪽 결과 창: micro:bit 보드 그림 + 센서 · 핀 · 부품 · 무선 · 파일 · 로그 조작 패널 */
'use strict';

(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 엣지 커넥터의 실제 배열 (왼쪽 → 오른쪽)
  const EDGE = ['3', '0', '4', '5', '6', '7', '1', '8', '9', '10', '11', '12', '2', '13', '14', '15', '16', '3V', '19', '20', 'GND'];
  const BIG = { '0': 1, '1': 1, '2': 1, '3V': 1, 'GND': 1 };

  const GESTURES = [
    ['up', '위로 기울임'], ['down', '아래로 기울임'], ['left', '왼쪽'], ['right', '오른쪽'],
    ['face up', '앞면 위'], ['face down', '앞면 아래'], ['freefall', '자유낙하'], ['shake', '흔들기'],
    ['3g', '3g'], ['6g', '6g'], ['8g', '8g']
  ];

  class SimView {
    constructor(sim, app) {
      this.sim = sim;
      this.app = app;
      this.tab = 'sensor';
      this.host = document.getElementById('simBoard');
      this.panel = document.getElementById('simPanel');
      this.tabs = document.getElementById('simTabs');
      this.buildBoard();
      this.bindBoard();
      this.bindTabs();
      this.renderPanel();
      sim.onChange((what) => {
        if (what === 'display' || what === 'run') this.paintLeds();
        if (what === 'sound') this.paintSound();
        if (what === 'parts' || what === 'np') this.renderPanel();
        else if (what === 'pin' && this.tab === 'pin') this.softUpdate();
        else if (what === 'radio' && this.tab === 'radio') this.renderPanel();
        else if (what === 'log' && this.tab === 'log') this.renderPanel();
        if (what === 'parts' || what === 'pin' || what === 'np') this.paintParts();
      });
      this.loop();
    }

    /* ─────────────────── 보드 그림 ─────────────────── */
    buildBoard() {
      const led = (i) => {
        const x = 156 + (i % 5) * 34, y = 108 + Math.floor(i / 5) * 30;
        return `<rect class="mb-led" data-led="${i}" x="${x}" y="${y}" width="12" height="20" rx="3"/>`;
      };

      /* 엣지 커넥터: 실제 보드처럼 하단 가장자리(y = BOT)까지 닿는 금도금 패드.
       * 큰 패드 5개(0 · 1 · 2 · 3V · GND)는 넓고 악어클립용 구멍이 뚫려 있다. */
      const BOT = 363;              // 보드 아래 가장자리
      const PAD_X0 = 42;            // 커넥터 시작
      const PAD_SPAN = 376;         // 커넥터 전체 너비
      const W_BIG = 36, W_SMALL = 8;
      const totalPads = EDGE.reduce((a, n) => a + (BIG[n] ? W_BIG : W_SMALL), 0);
      const gap = (PAD_SPAN - totalPads) / (EDGE.length - 1);

      let edge = '', labels = '', x = PAD_X0;
      EDGE.forEach((name) => {
        const big = BIG[name];
        const w = big ? W_BIG : W_SMALL;
        const top = big ? 302 : 318;
        edge += `<g class="mb-pad${big ? ' big' : ''}" data-pad="${name}">
          <title>${esc(padTitle(name))}</title>
          <rect x="${x.toFixed(1)}" y="${top}" width="${w}" height="${BOT - top}" rx="1.5"/>
          ${big ? `<circle class="mb-hole" cx="${(x + w / 2).toFixed(1)}" cy="330" r="12"/>` : ''}
        </g>`;
        if (big) labels += `<text x="${(x + w / 2).toFixed(1)}" y="294" text-anchor="middle">${name}</text>`;
        x += w + gap;
      });

      this.host.innerHTML = `<svg viewBox="0 0 460 377" class="mb-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="mbGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <!-- 보드 (위쪽 모서리는 둥글고, 아래쪽 두 귀퉁이는 비스듬히 잘린 실제 모양) -->
        <path class="mb-body" d="M14 44 Q14 14 44 14 L416 14 Q446 14 446 44 L446 338 L421 ${BOT} L39 ${BOT} L14 338 Z"/>
        <!-- 엣지 커넥터 -->
        <g class="mb-edge">${edge}</g>
        <g class="mb-edge-label">${labels}</g>
        <!-- 로고(터치) -->
        <g class="mb-logo" data-touch="logo"><title>로고 터치 (pin_logo.is_touched())</title>
          <circle cx="212" cy="52" r="10"/><circle cx="248" cy="52" r="10"/>
          <rect x="202" y="63" width="56" height="11" rx="5.5" class="mb-logo-bar"/>
        </g>
        <!-- 마이크 표시등 (V2: 앞면 오른쪽 위) -->
        <g class="mb-ic" id="mbMic"><title>마이크 (microphone)</title><circle cx="400" cy="54" r="13"/><text x="400" y="60" text-anchor="middle">🎙</text></g>
        <!-- 버튼 -->
        <g class="mb-btn" data-btn="A"><title>버튼 A (button_a)</title>
          <rect x="48" y="146" width="58" height="58" rx="10"/><circle cx="77" cy="175" r="16"/>
          <text x="77" y="228" text-anchor="middle">A</text></g>
        <g class="mb-btn" data-btn="B"><title>버튼 B (button_b)</title>
          <rect x="354" y="146" width="58" height="58" rx="10"/><circle cx="383" cy="175" r="16"/>
          <text x="383" y="228" text-anchor="middle">B</text></g>
        <!-- LED 화면 -->
        <g class="mb-screen">${Array.from({ length: 25 }, (_, i) => led(i)).join('')}</g>
        <!-- 스피커 (V2: 뒷면에 있지만 위치를 표시) -->
        <g class="mb-ic" id="mbSpeaker"><title>스피커 (speaker)</title><circle cx="56" cy="256" r="14"/><text x="56" y="262" text-anchor="middle">♪</text></g>
      </svg>
      <div class="mb-parts" id="mbParts"></div>`;
      this.leds = [...this.host.querySelectorAll('[data-led]')];
      this.paintLeds();
    }

    bindBoard() {
      const down = (el, fn) => {
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(true); });
        el.addEventListener('pointerup', () => fn(false));
        el.addEventListener('pointerleave', () => fn(false));
        el.addEventListener('pointercancel', () => fn(false));
      };
      this.host.querySelectorAll('[data-btn]').forEach((el) => {
        down(el, (on) => { this.sim.press(el.dataset.btn, on); el.classList.toggle('on', on); });
      });
      const logo = this.host.querySelector('[data-touch="logo"]');
      down(logo, (on) => { this.sim.setTouch('logo', on); logo.classList.toggle('on', on); });
      this.host.querySelectorAll('.mb-pad').forEach((el) => {
        const name = el.dataset.pad;
        if (!'012'.includes(name) || name.length !== 1) {
          el.addEventListener('click', () => this.app.toast(`${padTitle(name)}`));
          return;
        }
        down(el, (on) => { this.sim.setTouch(+name, on); el.classList.toggle('on', on); });
      });
      // 키보드: A / B 로 버튼 누르기
      const key = (e, on) => {
        if (e.repeat) return;
        const t = e.target;
        if (t && t.closest && (t.closest('.CodeMirror') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        const k = e.key.toLowerCase();
        if (k !== 'a' && k !== 'b') return;
        const K = k.toUpperCase();
        this.sim.press(K, on);
        const el = this.host.querySelector(`[data-btn="${K}"]`);
        if (el) el.classList.toggle('on', on);
      };
      document.addEventListener('keydown', (e) => key(e, true));
      document.addEventListener('keyup', (e) => key(e, false));
    }

    paintLeds() {
      const s = this.sim.s;
      for (let i = 0; i < 25; i++) {
        const v = s.displayOn ? s.leds[i] : 0;
        const el = this.leds[i];
        el.style.opacity = v ? (0.18 + v / 9 * 0.82).toFixed(2) : '';
        el.classList.toggle('on', v > 0);
      }
      this.host.querySelector('.mb-screen').classList.toggle('active', this.sim.running);
    }

    paintSound() {
      const sp = this.host.querySelector('#mbSpeaker');
      if (sp) sp.classList.toggle('on', this.sim.s.tone.freq > 0 && this.sim.s.speakerOn);
    }

    /* ─────────────────── 탭 ─────────────────── */
    bindTabs() {
      this.tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        this.tab = b.dataset.tab;
        this.renderPanel();
      });
    }

    renderPanel() {
      this.tabs.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
      const fn = { sensor: 'sensorPanel', pin: 'pinPanel', part: 'partPanel', radio: 'radioPanel', file: 'filePanel', log: 'logPanel' }[this.tab];
      this.panel.innerHTML = this[fn]();
      this['bind_' + this.tab] && this['bind_' + this.tab]();
      this.paintParts();
    }

    softUpdate() {
      if (this.tab === 'pin') {
        const body = this.panel.querySelector('#pinRows');
        if (body) body.innerHTML = this.pinRows();
      }
    }

    /* ---------- 센서 ---------- */
    sensorPanel() {
      const s = this.sim.s;
      const sl = (id, label, min, max, v, unit, hint) => `<label class="sim-row"><span class="sim-lab">${label}</span>
        <input type="range" data-sensor="${id}" min="${min}" max="${max}" value="${v}">
        <output data-out="${id}">${v}${unit || ''}</output></label>${hint ? `<div class="sim-hint">${hint}</div>` : ''}`;
      return `<div class="sim-sec"><b>🧭 기울기 · 가속도</b>
        <div class="tiltbox"><div class="tiltpad" id="tiltPad"><i></i><span>여기를 끌어 보드를 기울입니다</span></div>
          <div class="tiltvals"><div>x <b data-out="x">${s.accel.x}</b></div><div>y <b data-out="y">${s.accel.y}</b></div><div>z <b data-out="z">${s.accel.z}</b></div>
            <div class="muted">현재 제스처<br><b id="gestNow">-</b></div></div></div>
        <div class="btn-row">${GESTURES.map(([g, ko]) => `<button class="btn tiny" data-gest="${g}">${ko}</button>`).join('')}
          <button class="btn tiny ghost" data-gest="flat">평평하게</button></div>
        <div class="sim-hint">기울기 판을 끌거나 버튼을 누르면 <code>accelerometer</code> 값과 제스처가 바뀝니다. 실제 보드에서는 손으로 기울입니다.</div>
      </div>
      <div class="sim-sec"><b>🧲 나침반 (compass)</b>
        <div class="compassbox"><svg viewBox="0 0 100 100" class="compass" id="compassDial">
            <circle cx="50" cy="50" r="46"/><text x="50" y="14" text-anchor="middle">N</text><text x="50" y="94" text-anchor="middle">S</text>
            <text x="8" y="54" text-anchor="middle">W</text><text x="92" y="54" text-anchor="middle">E</text>
            <g id="needle"><polygon points="50,14 44,54 56,54"/><polygon points="50,86 44,50 56,50" class="tail"/></g></svg>
          <div>${sl('heading', '방위각', 0, 359, s.heading, '°')}</div></div>
      </div>
      <div class="sim-sec"><b>🌡️ 그 밖의 센서</b>
        ${sl('temp', '온도 temperature()', -10, 50, s.temp, ' ℃')}
        ${sl('light', '빛 display.read_light_level()', 0, 255, s.light, '')}
        ${sl('sound', '소리 microphone.sound_level()', 0, 255, s.sound, '')}
        <div class="btn-row"><button class="btn tiny" id="clapBtn">👏 박수 (큰 소리)</button>
          <button class="btn tiny ghost" id="quietBtn">🤫 조용히</button></div>
        <div class="sim-hint">소리 값이 128 을 넘으면 <code>SoundEvent.LOUD</code> 가 됩니다.</div>
      </div>`;
    }

    bind_sensor() {
      const P = this.panel;
      P.querySelectorAll('[data-sensor]').forEach((el) => {
        el.addEventListener('input', () => {
          this.sim.setSensor(el.dataset.sensor, +el.value);
          const o = P.querySelector(`[data-out="${el.dataset.sensor}"]`);
          if (o) o.textContent = el.value + (el.dataset.sensor === 'temp' ? ' ℃' : el.dataset.sensor === 'heading' ? '°' : '');
          this.drawNeedle();
        });
      });
      P.querySelectorAll('[data-gest]').forEach((b) => b.addEventListener('click', () => {
        const g = b.dataset.gest;
        const set = (x, y, z) => { this.sim.setSensor('x', x); this.sim.setSensor('y', y); this.sim.setSensor('z', z); this.syncTilt(); };
        if (g === 'flat') return set(0, 0, -1024);
        if (g === 'left') return set(-900, 0, -400);
        if (g === 'right') return set(900, 0, -400);
        if (g === 'up') return set(0, -900, -400);
        if (g === 'down') return set(0, 900, -400);
        if (g === 'face up') return set(0, 0, -1024);
        if (g === 'face down') return set(0, 0, 1024);
        if (g === 'shake') return this.sim.shake(700);
        this.sim.pulseGesture(g, 600);
      }));
      const pad = P.querySelector('#tiltPad');
      if (pad) {
        const move = (e) => {
          const r = pad.getBoundingClientRect();
          const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
          const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
          this.sim.setSensor('x', nx * 1024);
          this.sim.setSensor('y', ny * 1024);
          this.sim.setSensor('z', -Math.sqrt(Math.max(0, 1024 * 1024 - (nx * 1024) ** 2 - (ny * 1024) ** 2)));
          this.syncTilt();
        };
        pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); pad.dataset.drag = '1'; move(e); });
        pad.addEventListener('pointermove', (e) => { if (pad.dataset.drag) move(e); });
        pad.addEventListener('pointerup', () => { delete pad.dataset.drag; });
      }
      P.querySelector('#clapBtn').addEventListener('click', () => { this.sim.setSensor('sound', 220); this.sync('sound', 220); setTimeout(() => { this.sim.setSensor('sound', 40); this.sync('sound', 40); }, 700); });
      P.querySelector('#quietBtn').addEventListener('click', () => { this.sim.setSensor('sound', 20); this.sync('sound', 20); });
      this.syncTilt();
      this.drawNeedle();
    }

    sync(id, v) {
      const el = this.panel.querySelector(`[data-sensor="${id}"]`), o = this.panel.querySelector(`[data-out="${id}"]`);
      if (el) el.value = v;
      if (o) o.textContent = v;
    }

    syncTilt() {
      const a = this.sim.s.accel;
      ['x', 'y', 'z'].forEach((k) => { const o = this.panel.querySelector(`[data-out="${k}"]`); if (o) o.textContent = Math.round(a[k]); });
      const dot = this.panel.querySelector('#tiltPad i');
      if (dot) { dot.style.left = (50 + a.x / 1024 * 45) + '%'; dot.style.top = (50 + a.y / 1024 * 45) + '%'; }
    }

    drawNeedle() {
      const n = this.panel.querySelector('#needle');
      if (n) n.setAttribute('transform', `rotate(${this.sim.s.heading} 50 50)`);
    }

    /* ---------- 핀 ---------- */
    pinPanel() {
      return `<div class="sim-sec"><b>🔌 핀 상태와 강제 입력</b>
        <div class="sim-hint">프로그램이 핀을 어떻게 쓰고 있는지 보여 줍니다. <b>입력</b> 열의 버튼으로 핀에 0 · 1 을 직접 넣어 볼 수 있습니다(자동 = 연결한 부품 · 풀 저항이 정함).</div>
        <div class="table-wrap"><table class="pin-table"><thead><tr><th>핀</th><th>모드</th><th>값</th><th>입력 강제</th><th>설명</th></tr></thead>
        <tbody id="pinRows">${this.pinRows()}</tbody></table></div></div>`;
    }

    pinRows() {
      const sim = this.sim;
      const MODE = { unused: '—', read_digital: '디지털 입력', write_digital: '디지털 출력', read_analog: '아날로그 입력', write_analog: '아날로그 출력(PWM)' };
      return MB_PINS.map((n) => {
        const st = sim.s.pins[n];
        let val = '—';
        if (st.mode === 'write_digital') val = st.val;
        else if (st.mode === 'write_analog') val = `${st.duty} <span class="muted">(${Math.round(st.duty / 1023 * 100)}%)</span>`;
        else if (st.mode === 'read_analog') val = sim.analogLevel(n);
        else if (st.mode === 'read_digital') val = sim.digitalLevel(n);
        const ov = st.override;
        return `<tr class="${st.mode === 'unused' ? 'dim' : ''}"><td><b>P${n}</b>${MB_ANALOG_PINS.includes(n) ? '<span class="pin-a">A</span>' : ''}</td>
          <td>${MODE[st.mode]}</td><td class="v">${val}</td>
          <td class="ovr"><button class="ov${ov === null ? ' on' : ''}" data-ov="${n}" data-v="">자동</button><button class="ov${ov === 0 ? ' on' : ''}" data-ov="${n}" data-v="0">0</button><button class="ov${ov === 1 ? ' on' : ''}" data-ov="${n}" data-v="1">1</button></td>
          <td class="muted">${esc(MB_PIN_NOTE[n] || '')}</td></tr>`;
      }).join('');
    }

    bind_pin() {
      this.panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ov]');
        if (!b) return;
        this.sim.setPinOverride(+b.dataset.ov, b.dataset.v === '' ? null : +b.dataset.v);
        this.panel.querySelector('#pinRows').innerHTML = this.pinRows();
      });
    }

    /* ---------- 부품 ---------- */
    partPanel() {
      const parts = this.sim.s.parts;
      const opts = MB_PINS.map((n) => `<option value="${n}">P${n}</option>`).join('');
      return `<div class="sim-sec"><b>🧩 부품 연결 (브레드보드)</b>
        <div class="sim-hint">악어클립이나 브레드보드로 micro:bit 핀에 부품을 연결한 상황을 흉내 냅니다. 부품을 추가하고 연결할 핀을 고르세요.</div>
        <div class="btn-row">${Object.entries(MB_PARTS).map(([k, d]) => `<button class="btn tiny" data-add="${k}">${d.icon} ${d.label}</button>`).join('')}</div>
      </div>
      <div class="parts-list">${parts.length ? parts.map((p) => this.partCard(p, opts)).join('') : '<p class="muted">아직 연결한 부품이 없습니다. 위에서 부품을 추가하세요.</p>'}</div>`;
    }

    partCard(p, opts) {
      const d = MB_PARTS[p.type];
      const fields = (d.fields || []).map(([key, label, choices]) => `<label class="pf">${label}
        <select data-field="${p.id}:${key}">${choices.map((c) => {
        const [v, t] = Array.isArray(c) ? c : [c, c];
        return `<option value="${v}"${String(p[key]) === String(v) ? ' selected' : ''}>${t}</option>`;
      }).join('')}</select></label>`).join('');
      const ctl = p.type === 'button' ? `<button class="btn tiny push" data-push="${p.id}">누르기</button>`
        : p.type === 'toggle' ? `<button class="btn tiny${p.on ? ' primary' : ''}" data-toggle="${p.id}">${p.on ? '켜짐' : '꺼짐'}</button>`
          : d.analog ? `<input type="range" min="0" max="1023" value="${p.value}" data-value="${p.id}"><output data-vout="${p.id}">${p.value}</output>` : '';
      return `<div class="part-card" data-part="${p.id}">
        <div class="part-head"><span class="pi">${d.icon}</span><b>${d.label}</b>
          <label class="pf">핀 <select data-field="${p.id}:pin">${opts}</select></label>
          ${fields}<span class="spacer"></span>
          <button class="icon-btn" data-del="${p.id}" title="떼어내기">✕</button></div>
        <div class="part-body"><div class="part-view" data-view="${p.id}"></div><div class="part-ctl">${ctl}</div></div>
        <div class="sim-hint">${d.desc}</div></div>`;
    }

    bind_part() {
      const P = this.panel;
      P.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { this.sim.addPart(b.dataset.add); }));
      P.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => this.sim.removePart(b.dataset.del)));
      P.querySelectorAll('[data-field]').forEach((sel) => {
        const [id, key] = sel.dataset.field.split(':');
        const p = this.sim.s.parts.find((x) => x.id === id);
        if (p) sel.value = p[key];
        sel.addEventListener('change', () => {
          const q = this.sim.s.parts.find((x) => x.id === id);
          if (!q) return;
          q[key] = isNaN(+sel.value) ? sel.value : +sel.value;
          this.sim.emit('parts');
        });
      });
      P.querySelectorAll('[data-push]').forEach((b) => {
        const p = this.sim.s.parts.find((x) => x.id === b.dataset.push);
        const set = (on) => { if (p) { p.on = on; b.classList.toggle('primary', on); this.sim.emit('input'); } };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
        b.addEventListener('pointerup', () => set(false));
        b.addEventListener('pointerleave', () => set(false));
      });
      P.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const p = this.sim.s.parts.find((x) => x.id === b.dataset.toggle);
        if (!p) return;
        p.on = !p.on;
        b.textContent = p.on ? '켜짐' : '꺼짐';
        b.classList.toggle('primary', p.on);
        this.sim.emit('input');
      }));
      P.querySelectorAll('[data-value]').forEach((sl) => sl.addEventListener('input', () => {
        const p = this.sim.s.parts.find((x) => x.id === sl.dataset.value);
        if (!p) return;
        p.value = +sl.value;
        const o = P.querySelector(`[data-vout="${p.id}"]`);
        if (o) o.textContent = sl.value;
      }));
    }

    /** 부품 그림(밝기 · 각도 · 색)을 현재 핀 상태에 맞춰 다시 그린다 */
    paintParts() {
      const sim = this.sim;
      // 보드 아래 요약 줄
      const sum = document.getElementById('mbParts');
      if (sum) {
        sum.innerHTML = sim.s.parts.map((p) => {
          const d = MB_PARTS[p.type];
          const lv = d.kind === 'out' ? sim.outLevel(p.pin) : 0;
          return `<span class="mini-part${lv > 0.02 ? ' live' : ''}" title="${d.label} · P${p.pin}">${d.icon}<i>P${p.pin}</i></span>`;
        }).join('');
      }
      if (this.tab !== 'part') return;
      for (const p of sim.s.parts) {
        const host = this.panel.querySelector(`[data-view="${p.id}"]`);
        if (!host) continue;
        host.innerHTML = this.partView(p);
      }
    }

    partView(p) {
      const sim = this.sim;
      const lv = sim.outLevel(p.pin);
      switch (p.type) {
        case 'led': {
          const col = { red: '#ff4b3e', green: '#4ade80', blue: '#60a5fa', yellow: '#fde047', white: '#f8fafc' }[p.color] || '#ff4b3e';
          return `<svg viewBox="0 0 120 60"><circle cx="34" cy="30" r="16" fill="${col}" opacity="${(0.12 + lv * 0.88).toFixed(2)}" stroke="${col}" stroke-width="2"/>
            <line x1="26" y1="46" x2="26" y2="58" stroke="currentColor"/><line x1="42" y1="46" x2="42" y2="58" stroke="currentColor"/>
            <text x="70" y="27" font-size="12" fill="currentColor">밝기 ${Math.round(lv * 100)}%</text>
            <text x="70" y="44" font-size="11" fill="currentColor" opacity=".65">P${p.pin} → 220Ω → LED → GND</text></svg>`;
        }
        case 'button':
        case 'toggle':
          return `<svg viewBox="0 0 120 60"><rect x="18" y="16" width="34" height="28" rx="5" fill="${p.on ? 'var(--accent)' : 'none'}" stroke="currentColor" stroke-width="2"/>
            <text x="64" y="27" font-size="12" fill="currentColor">읽는 값 ${sim.digitalLevel(p.pin)}</text>
            <text x="64" y="44" font-size="11" fill="currentColor" opacity=".65">${p.wiring === '3v' ? 'P → 버튼 → 3V' : 'P → 버튼 → GND'}</text></svg>`;
        case 'pot':
        case 'ldr':
          return `<svg viewBox="0 0 120 60"><rect x="14" y="22" width="80" height="12" rx="6" fill="none" stroke="currentColor"/>
            <circle cx="${14 + p.value / 1023 * 80}" cy="28" r="9" fill="var(--accent)"/>
            <text x="14" y="52" font-size="12" fill="currentColor">read_analog(P${p.pin}) → ${p.value}</text></svg>`;
        case 'buzzer': {
          const f = sim.s.tone.pin === +p.pin ? sim.s.tone.freq : (sim.s.pins[p.pin].mode === 'write_analog' && sim.s.pins[p.pin].duty > 0 ? sim.s.pins[p.pin].freq : 0);
          return `<svg viewBox="0 0 120 60"><circle cx="32" cy="30" r="17" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="32" cy="30" r="5" fill="currentColor" opacity="${f ? 1 : 0.3}"/>
            ${f ? '<path d="M54 18 q10 12 0 24" fill="none" stroke="var(--ok)" stroke-width="2"/><path d="M62 12 q16 18 0 36" fill="none" stroke="var(--ok)" stroke-width="2"/>' : ''}
            <text x="76" y="34" font-size="12" fill="currentColor">${f ? Math.round(f) + ' Hz' : '무음'}</text></svg>`;
        }
        case 'servo': {
          const a = sim.servoAngle(p.pin);
          const ang = a == null ? 90 : a;
          const rad = (180 - ang) * Math.PI / 180;
          return `<svg viewBox="0 0 120 60"><rect x="18" y="20" width="30" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="33" y1="33" x2="${33 + Math.cos(rad) * 26}" y2="${33 - Math.sin(rad) * 26}" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
            <text x="72" y="30" font-size="12" fill="currentColor">${ang}°</text>
            <text x="72" y="46" font-size="11" fill="currentColor" opacity=".65">듀티 ${sim.s.pins[p.pin].duty}</text></svg>`;
        }
        case 'neopixel': {
          const np = sim.s.np && sim.s.np.pin === +p.pin ? sim.s.np.colors : [];
          const n = Math.max(1, p.count);
          return `<svg viewBox="0 0 ${n * 22 + 8} 34">${Array.from({ length: n }, (_, i) => {
            const c = np[i] || [0, 0, 0];
            return `<rect x="${4 + i * 22}" y="6" width="18" height="18" rx="4" fill="rgb(${c[0]},${c[1]},${c[2]})" stroke="currentColor" stroke-opacity=".4"/>`;
          }).join('')}</svg>`;
        }
        case 'motor':
          return `<svg viewBox="0 0 120 60"><circle cx="32" cy="30" r="18" fill="none" stroke="currentColor" stroke-width="2"/>
            <g style="transform-origin:32px 30px;animation:mbspin ${lv > 0.02 ? (0.2 + (1 - lv) * 1.4).toFixed(2) : 0}s linear infinite">
              <line x1="32" y1="14" x2="32" y2="46" stroke="var(--accent)" stroke-width="3"/></g>
            <text x="60" y="34" font-size="12" fill="currentColor">속도 ${Math.round(lv * 100)}%</text></svg>`;
        default: return '';
      }
    }

    /* ---------- 무선 ---------- */
    radioPanel() {
      const r = this.sim.s.radio;
      return `<div class="sim-sec"><b>📡 무선 통신 (radio)</b>
        <div class="sim-hint">시뮬레이터에는 micro:bit 가 한 대뿐이므로 <b>가상 짝 보드</b>가 대신 대답합니다. 실제 수업에서는 두 대 이상으로 실습하세요.</div>
        <div class="chip-row"><span class="chip">전원 <b>${r.on ? '켜짐' : '꺼짐'}</b></span><span class="chip">채널 <b>${r.channel}</b></span><span class="chip">그룹 <b>${r.group}</b></span></div>
        <label class="sim-row"><span class="sim-lab">짝 보드</span>
          <select id="peerSel"><option value="echo"${r.peer === 'echo' ? ' selected' : ''}>그대로 되돌려줌 (echo)</option>
            <option value="reply"${r.peer === 'reply' ? ' selected' : ''}>re: 를 붙여 답장</option>
            <option value="off"${r.peer === 'off' ? ' selected' : ''}>대답 없음</option></select></label>
        <div class="sim-row"><input type="text" id="radioIn" placeholder="수신함에 직접 넣을 메시지" spellcheck="false">
          <button class="btn tiny primary" id="radioSendBtn">보내기 →</button></div>
        <div class="sim-hint">위 칸의 메시지는 <code>radio.receive()</code> 로 읽힙니다.</div>
      </div>
      <div class="sim-sec"><b>보낸 메시지 (radio.send)</b>
        <div class="radio-log">${r.out.length ? r.out.slice().reverse().map((m) => `<div><span class="t">${new Date(m.t).toLocaleTimeString()}</span> ${esc(m.msg)}</div>`).join('') : '<p class="muted">아직 없습니다.</p>'}</div>
        <div class="muted" style="font-size:12px">수신 대기 중: ${r.inbox.length} 개</div></div>`;
    }

    bind_radio() {
      const P = this.panel;
      P.querySelector('#peerSel').addEventListener('change', (e) => { this.sim.s.radio.peer = e.target.value; });
      const send = () => {
        const el = P.querySelector('#radioIn');
        if (!el.value) return;
        this.sim.s.radio.inbox.push(el.value);
        el.value = '';
        this.sim.emit('radio');
      };
      P.querySelector('#radioSendBtn').addEventListener('click', send);
      P.querySelector('#radioIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    }

    /* ---------- 파일 ---------- */
    filePanel() {
      const files = MbEngine.files();
      return `<div class="sim-sec"><b>💾 micro:bit 파일 시스템</b>
        <div class="sim-hint"><code>open()</code> · <code>os.listdir()</code> 로 만든 파일이 여기에 보입니다. 보드에는 폴더가 없고 파일 이름만 있습니다. 페이지를 새로 고치면 사라집니다.</div>
        <div class="file-list">${files.length ? files.map((f) => `<div class="file-row" data-file="${esc(f.name)}"><span class="fn">📄 ${esc(f.name)}</span><span class="fs">${f.size} B</span>
          <button class="icon-btn" data-rm="${esc(f.name)}" title="지우기">✕</button></div>`).join('') : '<p class="muted">파일이 없습니다.</p>'}</div>
        <div id="fileView"></div>
        <div class="btn-row"><button class="btn tiny ghost" id="fileRefresh">↻ 새로고침</button></div></div>`;
    }

    bind_file() {
      const P = this.panel;
      P.querySelector('#fileRefresh').addEventListener('click', () => this.renderPanel());
      P.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        MbEngine.removeFile(b.dataset.rm);
        this.renderPanel();
      }));
      P.querySelectorAll('[data-file]').forEach((row) => row.addEventListener('click', () => {
        const t = MbEngine.readFile(row.dataset.file);
        P.querySelector('#fileView').innerHTML = `<h4>${esc(row.dataset.file)}</h4><pre class="term">${esc(t == null ? '(읽을 수 없습니다)' : t)}</pre>`;
      }));
    }

    /* ---------- 데이터 로그 ---------- */
    logPanel() {
      const L = this.sim.s.log;
      const head = (L.timestamp ? ['Time (' + L.timestamp + ')'] : []).concat(L.labels);
      return `<div class="sim-sec"><b>📊 데이터 로깅 (log 모듈)</b>
        <div class="sim-hint"><code>log.add({...})</code> 로 기록한 값입니다. 실제 보드에서는 MY_DATA.HTM 파일로 저장됩니다.</div>
        ${L.rows.length ? `<div class="table-wrap"><table class="log-table"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${L.rows.slice(-60).map((r) => `<tr>${(L.timestamp ? [r.t] : []).concat(L.labels.map((k) => r.obj[k] == null ? '' : r.obj[k])).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <div class="btn-row"><button class="btn tiny ghost" id="logCsv">⬇ CSV 내려받기</button><button class="btn tiny ghost" id="logClear">🗑 지우기</button>
          <span class="muted">${L.rows.length} 행</span></div>` : '<p class="muted">아직 기록이 없습니다.</p>'}
      </div>`;
    }

    bind_log() {
      const L = this.sim.s.log;
      const csv = this.panel.querySelector('#logCsv');
      if (csv) csv.addEventListener('click', () => {
        const head = (L.timestamp ? ['Time (' + L.timestamp + ')'] : []).concat(L.labels);
        const rows = L.rows.map((r) => (L.timestamp ? [r.t] : []).concat(L.labels.map((k) => r.obj[k] == null ? '' : r.obj[k])));
        const text = [head, ...rows].map((r) => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
        a.download = 'microbit-log.csv';
        a.click();
      });
      const cl = this.panel.querySelector('#logClear');
      if (cl) cl.addEventListener('click', () => { L.rows = []; this.renderPanel(); });
    }

    /* ---------- 주기적 갱신 ---------- */
    loop() {
      const tick = () => {
        if (this.tab === 'sensor') {
          const g = this.panel.querySelector('#gestNow');
          if (g) g.textContent = this.sim.currentGesture() || '(없음)';
        }
        if (this.tab === 'part') this.paintParts();
        else if (this.tab === 'pin' && this.sim.running) this.softUpdate();
        requestAnimationFrame(() => setTimeout(tick, 120));
      };
      tick();
    }
  }

  function padTitle(name) {
    if (name === '3V') return '3V — 3.3V 전원 출력';
    if (name === 'GND') return 'GND — 접지(0V)';
    const n = +name;
    return `P${n} — ${MB_PIN_NOTE[n] || ''}`;
  }

  window.SimView = SimView;
})();
