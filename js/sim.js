/* BBC micro:bit V2 시뮬레이터 — 상태 모델과 하드웨어 API(mbhw)
 * 화면 그리기는 js/simview.js 가 맡고, 여기서는 '보드가 어떤 상태인가' 만 다룬다.
 */
'use strict';

const MB_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20];
// 엣지 커넥터에서 겉으로 드러난(악어클립으로 집을 수 있는) 큰 핀
const MB_BIG_PINS = [0, 1, 2];
const MB_ANALOG_PINS = [0, 1, 2, 3, 4, 10];
// 핀별 안내 (보드 안에서 이미 쓰고 있는 핀은 그 사실을 적어 둔다)
const MB_PIN_NOTE = {
  0: '큰 핀 · 아날로그 입력 · 터치 · 스피커 출력', 1: '큰 핀 · 아날로그 입력 · 터치', 2: '큰 핀 · 아날로그 입력 · 터치',
  3: '아날로그 입력 (LED 화면과 공유)', 4: '아날로그 입력 (LED 화면과 공유)', 5: '버튼 A (누르면 0)',
  6: 'LED 화면과 공유', 7: 'LED 화면과 공유', 8: '자유 입출력', 9: 'LED 화면과 공유',
  10: '아날로그 입력 (LED 화면과 공유)', 11: '버튼 B (누르면 0)', 12: '자유 입출력 (접근성 예약)',
  13: 'SPI SCK', 14: 'SPI MISO', 15: 'SPI MOSI', 16: '자유 입출력',
  19: 'I2C SCL', 20: 'I2C SDA'
};

/* ─────────────────────────── 연결할 수 있는 부품 ─────────────────────────── */
const MB_PARTS = {
  led: {
    label: 'LED', icon: '💡', kind: 'out', color: '#ff5f56',
    desc: '핀 → 저항 → LED → GND. 핀을 1(또는 아날로그 값)로 만들면 켜집니다.',
    defaults: { pin: 0, color: 'red' },
    fields: [['color', '색', ['red', 'green', 'blue', 'yellow', 'white']]]
  },
  button: {
    label: '버튼', icon: '🔘', kind: 'in', color: '#61afef',
    desc: '핀 ↔ 버튼 ↔ GND. 풀업이라 평소 1, 누르면 0 이 읽힙니다.',
    defaults: { pin: 1, wiring: 'gnd' },
    fields: [['wiring', '반대쪽', [['gnd', 'GND (누르면 0)'], ['3v', '3V (누르면 1)']]]]
  },
  toggle: {
    label: '토글 스위치', icon: '🎚️', kind: 'in', color: '#56b6c2',
    desc: '한 번 누르면 켜진 상태가 유지되는 스위치입니다.',
    defaults: { pin: 2, wiring: 'gnd' },
    fields: [['wiring', '반대쪽', [['gnd', 'GND (켜면 0)'], ['3v', '3V (켜면 1)']]]]
  },
  pot: {
    label: '가변저항', icon: '🎛️', kind: 'ain', color: '#c678dd',
    desc: '3V ─ 가운데 다리를 핀에 ─ GND. read_analog() 로 0~1023 을 읽습니다.',
    defaults: { pin: 0, value: 512 }, analog: true
  },
  ldr: {
    label: '조도 센서(CdS)', icon: '🔆', kind: 'ain', color: '#e5c07b',
    desc: '밝으면 값이 커집니다. read_analog() 로 읽습니다.',
    defaults: { pin: 1, value: 700 }, analog: true
  },
  buzzer: {
    label: '부저', icon: '🔊', kind: 'out', color: '#e06c75',
    desc: '핀 → 부저 → GND. music.pitch() · write_analog() 로 소리를 냅니다.',
    defaults: { pin: 0 }
  },
  servo: {
    label: '서보 모터', icon: '⚙️', kind: 'out', color: '#98c379',
    desc: 'write_analog() 로 펄스 폭을 바꾸어 0~180° 로 움직입니다. (주기 20ms)',
    defaults: { pin: 2 }
  },
  neopixel: {
    label: 'NeoPixel 띠', icon: '🌈', kind: 'out', color: '#d19a66',
    desc: 'neopixel 모듈로 색을 지정하는 RGB LED 띠입니다.',
    defaults: { pin: 0, count: 8 },
    fields: [['count', '개수', [4, 8, 12, 16, 24]]]
  },
  motor: {
    label: 'DC 모터', icon: '🌀', kind: 'out', color: '#abb2bf',
    desc: '드라이버를 거쳐 연결합니다. write_analog() 값이 속도가 됩니다.',
    defaults: { pin: 8 }
  }
};

/* ─────────────────────────── 시뮬레이터 ─────────────────────────── */
class MicrobitSim {
  constructor(app) {
    this.app = app;
    this.listeners = [];
    this.reset(true);
  }

  onChange(fn) { this.listeners.push(fn); }
  emit(what) { for (const f of this.listeners) { try { f(what, this); } catch (e) { /* 무시 */ } } }

  reset(hard) {
    const keep = hard ? null : this.s;
    this.s = {
      leds: new Uint8Array(25),
      displayOn: true,
      buttons: { A: false, B: false },
      presses: { A: 0, B: 0 },
      logo: false,
      touch: { 0: false, 1: false, 2: false },
      accel: { x: 0, y: 0, z: -1024 },
      shakeUntil: 0,
      gesturePulse: '',
      gestureUntil: 0,
      heading: 0,
      temp: 24,
      light: 128,
      sound: 40,
      volume: 128,
      speakerOn: true,
      tone: { pin: -1, freq: 0, wave: 0 },
      pins: {},
      parts: keep ? keep.parts : [],
      np: {},
      radio: { on: false, channel: 7, group: 0, power: 6, peer: 'echo', out: [], inbox: [] },
      log: { labels: [], rows: [], mirror: false, timestamp: 'seconds' },
      serialOut: '',
      speech: [],
      panic: 0
    };
    for (const n of MB_PINS) this.s.pins[n] = { mode: 'unused', val: 0, pull: (n === 5 || n === 11 ? 1 : 2), duty: 0, freq: 50, period: 20000, override: null, analog: null };
    this.startMs = performance.now();
    this.stopFlag = false;
    this.running = false;
    this.emit('reset');
  }

  start() {
    this.stopFlag = false;
    this.running = true;
    this.startMs = performance.now();
    this.s.leds.fill(0);
    this.s.displayOn = true;
    this.s.presses.A = 0; this.s.presses.B = 0;
    this.s.tone = { pin: -1, freq: 0, wave: 0 };
    this.s.panic = 0;
    this.s.speech = [];
    this.s.radio.out = [];
    this.s.radio.inbox = [];
    MbSound.allOff();
    this.emit('run');
  }

  stop() {
    this.stopFlag = true;
    this.running = false;
    MbSound.allOff();
    this.s.tone = { pin: -1, freq: 0, wave: 0 };
    this.emit('run');
  }

  /* ---------------- 조작 (화면 UI 에서 호출) ---------------- */
  press(key, down) {
    if (this.s.buttons[key] === down) return;
    this.s.buttons[key] = down;
    if (down) this.s.presses[key]++;
    this.emit('input');
  }

  setTouch(which, on) {
    if (which === 'logo') this.s.logo = on; else this.s.touch[which] = on;
    this.emit('input');
  }

  setSensor(name, v) {
    if (name === 'x' || name === 'y' || name === 'z') this.s.accel[name] = Math.round(v);
    else this.s[name] = Math.round(v);
    this.emit('input');
  }

  shake(ms = 600) {
    this.s.shakeUntil = performance.now() + ms;
    this.emit('input');
  }

  pulseGesture(name, ms = 500) {
    this.s.gesturePulse = name;
    this.s.gestureUntil = performance.now() + ms;
    this.emit('input');
  }

  setPinOverride(n, level) {
    this.s.pins[n].override = level;   // null | 0 | 1
    this.emit('input');
  }

  addPart(type) {
    const d = MB_PARTS[type];
    if (!d) return null;
    const p = Object.assign({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000), type, on: false, angle: 90 }, d.defaults);
    this.s.parts.push(p);
    this.emit('parts');
    return p;
  }

  removePart(id) {
    this.s.parts = this.s.parts.filter((p) => p.id !== id);
    this.emit('parts');
  }

  partsOn(pin) { return this.s.parts.filter((p) => +p.pin === +pin); }

  /* ---------------- 핀 계산 ---------------- */
  /** 입력으로 읽었을 때 핀이 보게 되는 논리 레벨 */
  digitalLevel(n) {
    const st = this.s.pins[n];
    if (n === 5) return this.s.buttons.A ? 0 : 1;
    if (n === 11) return this.s.buttons.B ? 0 : 1;
    if (st.override !== null) return st.override;
    for (const p of this.partsOn(n)) {
      if (p.type === 'button' || p.type === 'toggle') {
        const active = p.type === 'button' ? !!p.on : !!p.on;
        if (p.wiring === '3v') return active ? 1 : (st.pull === 1 ? 1 : 0);
        return active ? 0 : (st.pull === 2 ? 0 : 1);
      }
    }
    // 아무것도 연결하지 않으면 풀업/풀다운 저항이 정하는 값
    return st.pull === 1 ? 1 : 0;
  }

  /** 0 ~ 1023 아날로그 입력 값 */
  analogLevel(n) {
    const st = this.s.pins[n];
    for (const p of this.partsOn(n)) {
      if (p.type === 'pot' || p.type === 'ldr') return Math.max(0, Math.min(1023, Math.round(p.value)));
    }
    if (st.analog !== null) return st.analog;
    if (st.override !== null) return st.override ? 1023 : 0;
    // 떠 있는 핀: 살짝 흔들리는 값
    return Math.round(360 + Math.sin(performance.now() / 700 + n) * 90 + Math.random() * 30);
  }

  /** 출력 핀의 세기(0~1) — LED 밝기 · 모터 속도에 쓴다 */
  outLevel(n) {
    const st = this.s.pins[n];
    if (st.mode === 'write_analog') return st.duty / 1023;
    if (st.mode === 'write_digital') return st.val ? 1 : 0;
    if (this.s.tone.pin === n && this.s.tone.freq > 0) return 0.5;
    return 0;
  }

  servoAngle(n) {
    const st = this.s.pins[n];
    if (st.mode !== 'write_analog') return null;
    // 20ms 주기에서 듀티 0~1023 → 펄스 폭 0~20ms, 서보는 1~2ms 를 0~180° 로 읽는다
    const usPulse = st.duty / 1023 * st.period;
    return Math.max(0, Math.min(180, Math.round((usPulse - 500) / 2000 * 180)));
  }

  currentGesture() {
    const now = performance.now();
    if (now < this.s.gestureUntil && this.s.gesturePulse) return this.s.gesturePulse;
    const a = this.s.accel;
    if (now < this.s.shakeUntil) return 'shake';
    const strength = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (strength > 2300) return 'shake';
    if (a.x < -500) return 'left';
    if (a.x > 500) return 'right';
    if (a.y < -500) return 'up';
    if (a.y > 500) return 'down';
    if (a.z < -800) return 'face up';
    if (a.z > 800) return 'face down';
    return '';
  }

  /** 흔들 때는 가속도 값도 요동치게 만든다 */
  accelValues() {
    const a = this.s.accel;
    if (performance.now() < this.s.shakeUntil) {
      const j = () => Math.round((Math.random() - 0.5) * 3600);
      return [j(), j(), j()];
    }
    return [a.x, a.y, a.z];
  }
}

/* ─────────────────────────── 소리 ─────────────────────────── */
const MbSound = {
  ctx: null, osc: new Map(), muted: false, volume: 0.05,
  set(id, freq, on, wave) {
    if (this.muted) on = false;
    let o = this.osc.get(id);
    if (!on || !freq) { if (o) o.g.gain.value = 0; return; }
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!o) {
        const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
        osc.type = 'square'; g.gain.value = 0; osc.connect(g); g.connect(this.ctx.destination); osc.start();
        o = { osc, g }; this.osc.set(id, o);
      }
      o.osc.type = ['sine', 'sawtooth', 'triangle', 'square', 'square'][wave || 0] || 'square';
      o.osc.frequency.value = Math.max(20, Math.min(20000, freq));
      o.g.gain.value = this.volume;
    } catch (e) { /* 오디오를 쓸 수 없는 환경 */ }
  },
  allOff() { for (const o of this.osc.values()) o.g.gain.value = 0; }
};

/* ─────────────────────────── 파이썬에서 부르는 하드웨어 API ─────────────────────────── */
function toArray(x) { return x && x.toJs ? x.toJs() : (x || []); }

function makeMbHwApi(sim) {
  const now = () => performance.now();
  const S = () => sim.s;

  const api = {
    // ---- 시간 · 실행 제어 ----
    now_ms: () => now(),
    now_us: () => now() * 1000,
    run_ms: () => now() - sim.startMs,
    is_stopped: () => sim.stopFlag,

    // ---- LED 화면 ----
    display(s) {
      const leds = S().leds;
      if (!s) { S().displayOn = false; leds.fill(0); }
      else {
        S().displayOn = true;
        for (let i = 0; i < 25; i++) leds[i] = s.charCodeAt(i) - 48;
      }
      sim.emit('display');
    },

    // ---- 버튼 · 터치 ----
    button: (k) => (S().buttons[k] ? 1 : 0),
    presses(k, reset) {
      const v = S().presses[k] || 0;
      if (reset) S().presses[k] = 0;
      return v;
    },
    touched(n) {
      if (n === 'logo') return S().logo ? 1 : 0;
      return S().touch[n] ? 1 : 0;
    },

    // ---- 센서 묶음: [ax, ay, az, 온도, 빛, 소리, 방위, 로고터치] ----
    state() {
      const a = sim.accelValues();
      const s = S();
      return [a[0], a[1], a[2], s.temp, s.light, s.sound, s.heading, s.logo ? 1 : 0];
    },
    gesture: () => sim.currentGesture(),

    // ---- 핀 ----
    pin_init(n, mode, pull) {
      const st = S().pins[n];
      if (!st) return;
      if (mode === 1) st.mode = 'write_digital';
      else if (mode === 0 && st.mode !== 'read_analog') st.mode = 'read_digital';
      if (pull !== undefined && pull !== null && pull >= 0) st.pull = pull;
      sim.emit('pin');
    },
    pin_write(n, v) {
      const st = S().pins[n];
      if (!st) return;
      st.mode = 'write_digital';
      st.val = v ? 1 : 0;
      st.duty = v ? 1023 : 0;
      for (const p of sim.partsOn(n)) {
        if (p.type === 'buzzer') MbSound.set('part:' + p.id, 440, !!v, 3);
      }
      sim.emit('pin');
    },
    pin_read(n) {
      const st = S().pins[n];
      if (!st) return 0;
      st.mode = 'read_digital';
      return sim.digitalLevel(n);
    },
    pin_analog(n) {
      const st = S().pins[n];
      if (!st) return 0;
      st.mode = 'read_analog';
      return sim.analogLevel(n);
    },
    pwm_set(n, freq, duty) {
      const st = S().pins[n];
      if (!st) return;
      st.mode = 'write_analog';
      st.duty = Math.max(0, Math.min(1023, Math.round(duty)));
      st.freq = freq;
      st.period = Math.round(1000000 / freq);
      for (const p of sim.partsOn(n)) {
        if (p.type === 'buzzer') MbSound.set('part:' + p.id, freq, st.duty > 0, 3);
      }
      sim.emit('pin');
    },
    pulse_us(n, level, timeout) {
      // 초음파 센서 등: 시뮬레이터에서는 대략적인 값을 돌려준다
      return Math.round(500 + Math.random() * 12000);
    },

    // ---- 스피커 · 소리 ----
    tone(n, freq, wave) {
      const s = S();
      s.tone = { pin: n, freq: freq > 0 ? freq : 0, wave: wave || 0 };
      const audible = freq > 0 && (s.speakerOn || sim.partsOn(n).some((p) => p.type === 'buzzer'));
      MbSound.set('tone', freq, audible, wave);
      if (freq > 0) {
        const st = s.pins[n];
        if (st) { st.mode = 'write_analog'; st.duty = 512; st.freq = freq; }
      }
      sim.emit('sound');
    },
    speaker(v) {
      if (v === null || v === undefined) return S().speakerOn ? 1 : 0;
      S().speakerOn = !!v;
      if (!v) MbSound.allOff();
      sim.emit('sound');
      return S().speakerOn ? 1 : 0;
    },
    volume(v) {
      S().volume = v;
      MbSound.volume = 0.002 + (v / 255) * 0.09;
      sim.emit('sound');
    },
    panic(n) {
      S().panic = n;
      sim.emit('display');
    },
    power(kind) {
      sim.app.log(`[전원] ${kind === 'off' ? 'power.off() — 보드를 껐습니다 (리셋 버튼으로 켜집니다)' : 'deep_sleep() — 절전 모드'}`, 'info');
    },

    // ---- NeoPixel ----
    np_attach(pin, n) {
      S().np = { pin, n, colors: new Array(n).fill(0).map(() => [0, 0, 0]) };
      if (!sim.partsOn(pin).some((p) => p.type === 'neopixel')) {
        const p = sim.addPart('neopixel');
        p.pin = pin; p.count = n;
      } else {
        sim.partsOn(pin).forEach((p) => { if (p.type === 'neopixel') p.count = n; });
      }
      sim.emit('parts');
    },
    np_show(pin, flat) {
      const a = Array.from(toArray(flat));
      const np = S().np;
      if (!np || np.pin !== pin) S().np = { pin, n: a.length / 3, colors: [] };
      const colors = [];
      for (let i = 0; i + 2 < a.length; i += 3) colors.push([a[i], a[i + 1], a[i + 2]]);
      S().np.colors = colors;
      S().np.n = colors.length;
      sim.emit('np');
    },

    // ---- 무선(radio) ----
    radio_on(on) { S().radio.on = !!on; sim.emit('radio'); },
    radio_config(channel, group, power) {
      Object.assign(S().radio, { channel, group, power });
      sim.emit('radio');
    },
    radio_send(msg, isStr) {
      const r = S().radio;
      r.out.push({ t: Date.now(), msg: String(msg) });
      if (r.out.length > 60) r.out.shift();
      if (r.peer === 'echo') r.inbox.push(String(msg));
      else if (r.peer === 'reply') r.inbox.push('re:' + String(msg));
      sim.emit('radio');
    },
    radio_recv() {
      const r = S().radio;
      return r.inbox.length ? r.inbox.shift() : null;
    },

    // ---- 말하기 ----
    speech_say(text, pitch, speed, mouth, throat, sing) {
      const ms = MbSpeech.say(text, { pitch, speed, mouth, throat, sing });
      S().speech.push(text);
      if (S().speech.length > 20) S().speech.shift();
      sim.app.log('🗣 ' + text, 'speech');
      sim.emit('speech');
      return ms;
    },
    speech_translate: (w) => MbSpeech.translate(w),

    // ---- 데이터 로깅 ----
    log_labels(labels, ts) {
      S().log.labels = Array.from(toArray(labels)).map(String);
      S().log.timestamp = ts || '';
      S().log.rows = [];
      sim.emit('log');
    },
    log_mirror(on) { S().log.mirror = !!on; },
    log_delete() { S().log.rows = []; sim.emit('log'); },
    log_add(pairs) {
      const rows = Array.from(toArray(pairs)).map((p) => Array.from(toArray(p)).map(String));
      const L = S().log;
      const obj = {};
      rows.forEach(([k, v]) => { obj[k] = v; if (!L.labels.includes(k)) L.labels.push(k); });
      const t = L.timestamp ? ((performance.now() - sim.startMs) / (L.timestamp === 'milliseconds' ? 1 : L.timestamp === 'seconds' ? 1000 : L.timestamp === 'minutes' ? 60000 : 3600000)).toFixed(2) : null;
      L.rows.push({ t, obj });
      if (L.rows.length > 500) L.rows.shift();
      if (L.mirror) sim.app.log(JSON.stringify(obj), 'out');
      sim.emit('log');
    },

    // ---- 직렬(UART) · I2C · SPI ----
    uart_write(s) { sim.app.log(String(s), 'out'); },
    uart_read: () => [],
    i2c_scan: () => [],
    i2c_read: () => null,
    i2c_write: () => -1,
    spi_write: () => 0
  };
  return api;
}

/* ─────────────────────────── 말하기(브라우저 음성 합성) ─────────────────────────── */
const MbSpeech = {
  voice: null,
  say(text, o = {}) {
    const words = String(text).trim();
    const ms = Math.max(400, words.length * 75);
    try {
      if (!('speechSynthesis' in window)) return ms;
      const u = new SpeechSynthesisUtterance(words.replace(/[#\/]/g, ' '));
      u.lang = /[가-힣]/.test(words) ? 'ko-KR' : 'en-GB';
      u.pitch = Math.max(0.1, Math.min(2, 2 - (o.pitch || 64) / 64));
      u.rate = Math.max(0.3, Math.min(2, 1.6 - (o.speed || 72) / 100));
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) { /* 음성 합성을 쓸 수 없는 환경 */ }
    return ms;
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ } },
  // 아주 단순한 영어 → phoneme 변환 (교육용 근사)
  RULES: [
    ['tion', 'SHAH0N'], ['ough', 'AH0'], ['ight', 'AYT'], ['ch', 'CH'], ['sh', 'SH'], ['th', 'TH'],
    ['ph', 'F'], ['oo', 'UW'], ['ee', 'IY'], ['ea', 'IY'], ['ou', 'AW'], ['ow', 'OW'], ['ai', 'EY'],
    ['ay', 'EY'], ['oa', 'OW'], ['ck', 'K'], ['ng', 'NX'], ['qu', 'KW'],
    ['a', 'AE'], ['b', 'B'], ['c', 'K'], ['d', 'D'], ['e', 'EH'], ['f', 'F'], ['g', 'G'], ['h', 'HH'],
    ['i', 'IH'], ['j', 'JH'], ['k', 'K'], ['l', 'L'], ['m', 'M'], ['n', 'N'], ['o', 'AO'], ['p', 'P'],
    ['r', 'R'], ['s', 'S'], ['t', 'T'], ['u', 'AH'], ['v', 'V'], ['w', 'W'], ['x', 'KS'], ['y', 'IY'], ['z', 'Z']
  ],
  translate(word) {
    let s = String(word).toLowerCase().replace(/[^a-z]/g, ''), out = '';
    while (s) {
      let hit = null;
      for (const [k, v] of this.RULES) if (s.startsWith(k)) { hit = [k, v]; break; }
      if (!hit) { s = s.slice(1); continue; }
      out += hit[1];
      s = s.slice(hit[0].length);
    }
    return out || 'AE';
  }
};
