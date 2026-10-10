# 챕터 콘텐츠 작성 가이드 — 마이크로비트 프로젝트

사이트는 **3단 화면** 하나(`index.html`)로 동작합니다.
- 왼쪽: 목차(챕터 → 교시), 학생용/교사용 전환, 검색, 진도
- 가운데: 🎓 학생용 = 문서(개념 · 그림 · 예제 · 실습 · 퀴즈) + 아래 코드 편집기(`main.py`) / 🧑‍🏫 교사용 = **16:9 슬라이드**(판서 · 타이머 · 발표자 창) + 교사 노트
- 오른쪽: **BBC micro:bit V2 시뮬레이터** (5×5 LED · 버튼 A/B · 로고 터치 · 센서 · 핀 · 부품 · 무선 · 파일 · 로그 탭) + **콘솔 · 파이썬 셸(`>>>`)**.
  `🔌 보드` 로 실제 micro:bit 를 USB(Web Serial, Chrome · Edge)에 연결하면 같은 코드를 보드에서 실행합니다.

- 작성 형태: 강좌 · 대상: 초중고 · 수준: 입문 · 1교시 50분
- 문제 구성: 문제 없음
- 문체: 존댓말, 초보자도 이해할 수 있게 그림·예제 중심

각 챕터는 `lessons/<id>.js` 파일 하나이며 `MB_COURSE.addChapter({...})` 를 **한 번** 호출합니다.
평범한 브라우저 스크립트입니다 (import/export 금지, 전역 변수 금지 → `(function(){ ... })();` 안에서 상수 정의).
**형식 예시: `docs/examples/sample-lesson.js`** (다른 강좌의 완성 레슨 — 형식 · 분량 · 그림 스타일만 참고하고 내용은 이 강좌와 무관합니다).
챕터 id · 번호 · 제목 · 아이콘은 `js/course.js` 의 `order` 에 이미 있습니다 (lectureBuilder 가 관리 — 고치지 마세요).

다 쓰면 반드시 `node tools/validate.js <id>` 로 **오류 0** 을 확인합니다 (§9).

---

## 1. 파일 모양

```js
/* Chapter 03. 챕터 제목 */
(function () {
  // 그림은 상수로 먼저 만든다 (본문 figure 와 슬라이드 diagram 에서 같이 쓴다)
  const FIG_X = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif"> … </svg>`;

  MB_COURSE.addChapter({
    id: 'ch03', no: '03',
    title: '챕터 제목',                     // js/course.js 의 order 제목과 같게
    subtitle: '핵심 키워드 · 키워드 · 키워드',
    summary: '챕터 소개 2~4문장 (HTML 가능)',
    goals: ['챕터 학습 목표 4~6개 (HTML 가능)'],
    sections: [ /* 교시 2~4개 */ ]
  });
})();
```

### 교시(section)

```js
{
  id: 'ch03-1',                 // <챕터id>-<번호> — 한 번 정하면 바꾸지 않습니다 (진도 · 저장 코드가 id 에 저장됨)
  title: '교시 제목',
  minutes: 50,
  goals: ['교시 목표 3~4개 (HTML)'],
  flow: [['도입', 5], ['개념', 15], ['예제', 15], ['실습', 7], ['정리', 3]],   // 합 = minutes (교사용에만 보임)
  content: [ /* 본문 블록 */ ],
  practice: [ /* 실습 1~3개 */ ],
  quiz: [ /* 퀴즈 3~5문항 */ ],
  slides: [ /* 슬라이드 7~11장 */ ]
}
```

교시 문서를 열면 **첫 번째 실행 가능한 예제**(`run` ≠ false, `repl` 아님)가 아래 편집기에 자동으로 들어갑니다.

---

## 2. 본문 블록 (`content`)

| type | 필드 | 쓰임 |
|---|---|---|
| `h` | `text` | 소제목 (h3). 교시 안의 단락 제목 (HTML 아님 — 글자 그대로) |
| `p` | `html` | 문단. `<b>` `<code>` `<kbd>` `<br>` 사용 |
| `list` | `items: [html]`, `ordered?` | 목록 |
| `table` | `head: [html]`, `rows: [[html]]`, `caption?` | 표 (모든 줄의 칸 수 = head 칸 수). 캡션은 `'표 3-1. …'` |
| `code` | 아래 표 | 코드 블록 |
| `callout` | `kind`, `title?`, `html` | 강조 상자. kind: `tip`(💡 팁) · `warn`(⚠️ 주의) · `info`(ℹ️ 참고) · `more`(📘 더 알아보기) · `board`(🔌 실제 보드에서는) |
| `figure` | `html`(SVG · HTML), `caption?` | 그림. 캡션은 `'그림 3-1. …'` |

이 외의 type 은 없습니다 (교사 전용 블록 · 인터랙티브 데모 블록 없음).

### 코드 블록 (`type: 'code'`)

| 필드 | 뜻 |
|---|---|
| `title` | `'예제 3-1. 하트 깜빡이기'` (예제 번호 = 챕터-순서). `예제…` 로 시작하면 [예제], `응용…`/`도전…` 은 [응용], `더 해 보기` 가 들어가면 [추가] 꼬리표가 붙습니다 |
| `code` | MicroPython 코드 (공백 4칸 들여쓰기, 탭 금지) |
| `desc?` | 코드 아래 설명 (HTML) — 무엇이 보이는지, 무엇을 바꿔 볼지 |
| `expect?` | **실행 결과 · 화면 예시** (접혀 있는 상자). 콘솔 출력 그대로, 또는 보드 반응을 글로: `'LED 화면에 하트가 0.5초 간격으로 깜빡입니다.'` |
| `hint?` | 실행 중에 무엇을 조작하면 되는지 (HTML) — 예: `'보드 그림의 <b>A 버튼</b>을 눌러 보세요.'` |
| `nondeterministic?` | 값이 매번 달라(난수 · 센서) expect 를 숨길 때 `true` |
| `run: false` | 실행할 수 없는 코드 조각 (설명용) — ▶ 실행 버튼 대신 "설명용 코드 조각" 표시 |
| `expectError: true` | 일부러 오류를 보여 주는 예제 (검사 도구가 문법 오류를 허용) |
| `repl: true` | **파이썬 셸(`>>>`)에서 한 줄씩** 실행하는 예제. `code` 에는 `>>>` 없이 입력할 줄만 씁니다. 블록(`if …:`)은 다음에 빈 줄 |

- 예제마다 **그대로 실행되는 완전한 프로그램** (맨 위 `from microbit import *`, 앞 예제의 변수에 기대지 않기).
- 끝나지 않는 프로그램은 `while True:` + `sleep(ms)` 로 씁니다 (학생이 ■ 중지).
- 주석은 `#` 으로 짧게 한국어.
- JS 템플릿 문자열 안의 파이썬 코드: `${` 금지, 백틱 금지, 파이썬 문자열 안의 `\n` 은 `\\n` 으로.

---

## 3. 실습 · 퀴즈

```js
practice: [{
  title: '실습 3-1. 신호등 만들기', level: 2,          // 난이도 1~3 (★)
  desc: '무엇을 만드는지 HTML 로. 조건 · 순서 · 완성했을 때 보이는 모습을 분명히',
  hint: '접어 두는 힌트 (HTML, 선택)',
  starter: '시작 코드 (# TODO 주석 포함)',
  solution: '정답 코드 (교사용에만 보임)'
}],
quiz: [{
  q: '질문 (HTML)', options: ['보기1', '보기2', '보기3', '보기4'], answer: 1,   // 0부터
  explain: '해설 (HTML)'
}]
```

- `starter` 는 보통 문법 오류 없이 실행되는 뼈대입니다. "오류 고치기" 실습처럼 일부러 틀린 시작 코드는 괜찮습니다 (검사 도구가 경고만 냄).
- 퀴즈는 **객관식만** 지원합니다. 정답 위치를 고르게 섞습니다 (모두 1번이 되지 않게). q 안 코드는 `<code>` 또는 `<pre><code>…</code></pre>` (`<` → `&lt;`).
- 교사용 화면에서만 퀴즈 정답 · 실습 정답 코드가 보입니다.

---

## 4. 슬라이드 (교사용 · 16:9)

교시마다 7~11장. 첫 장 `title`, 마지막 장 `summary`. **학습 목표 + 수업 흐름 슬라이드는 자동으로** 2번째 장에 들어가므로 쓰지 않습니다.
모든 슬라이드에 `notes`(교사 노트, HTML: 말할 내용, 💬 발문과 예상 답, 주의점)를 달고 끝에 `<p>시간: N분</p>` 을 씁니다.

| layout | 필드 |
|---|---|
| `title` | `title`, `subtitle?`(예: `'Chapter 03 · 챕터 제목'`), `badge?`(예: `'1교시'`) |
| `bullets` | `title`, `bullets: [html \| [html, [하위…]]]` (3~6개, 짧게), `lead?` |
| `code` | `title`, `code`(18줄 이하, 실행 가능), `points?: [html 2~4개]`, `repl?` — 슬라이드에서 수정 · ▶ 실행 → 오른쪽 시뮬레이터 |
| `two` | `title`, `left: {title, bullets? \| html? \| code?, run?}`, `right: {...}` — code 가 있으면 칸마다 ▶ 실행 |
| `table` | `title`, `head`, `rows`, `lead?` |
| `diagram` | `title`, `html`(SVG), `caption?` |
| `quiz` | `q`, `options`, `answer`, `explain`, `title?` |
| `practice` | `title`, `desc`, `starter`, `solution` |
| `summary` | `title`(예: `'1교시 정리'`), `bullets` |

- 권장 흐름: `title` → 개념(bullets/diagram) → 예제(code) → … → quiz/practice → `summary`.
- 슬라이드 글은 **본문보다 훨씬 짧게**: 한 줄 25자 안팎, 명사형으로 끝내도 됩니다.
- 교사용 화면이 없는 강좌라면 `slides` · `flow` · `notes` 는 생략합니다.

---

## 5. 그림 (SVG)

- `viewBox="0 0 1280 400"` 안팎의 가로형 SVG. 글자는 18~26px. 본문 `figure` 와 슬라이드 `diagram` 에 같은 상수를 씁니다.
- 색은 CSS 변수로 (라이트/다크 자동): `var(--fg)` `var(--muted)` `var(--line)` `var(--accent)` `var(--accent2)` `var(--ok)` `var(--warn)` `var(--danger)` `var(--more)` `var(--code-bg)`.
  보드 · LED 처럼 실물 색이 의미 있는 것만 고정 색(`#ff2d1a` LED 켜짐, `#0e6b64` 보드)을 씁니다.
- `<marker id>` 등 SVG 안의 id 는 **챕터 접두어로 고유하게** (예: `c3a`). 한 교시 문서 안에 같은 id 가 두 번 나오면 안 됩니다.
- SVG 안의 `<style>` 은 자동으로 그 그림 범위로 한정됩니다.
- **보드 그림 도우미 `MB_FIG`** (js/fig.js — 시뮬레이터와 같은 모양 · 비율):
  - `MB_FIG.board({ x, y, scale, leds, labels, btnLabel, ics })` → SVG `<g>` (1280 폭 SVG 안에 넣음). `leds` = 25자리 밝기 `'0'~'9'`
  - `MB_FIG.screen(leds, { size })` → 5×5 LED 화면만 있는 `<svg>`
  - `MB_FIG.tile(leds, label, size)` → 화면 그림 + 아래 설명 (`figure` 안에 여러 개 나란히)
  - `MB_FIG.ANCHOR` (logo · mic · screen · btnA · btnB · speaker · edge · `pad('0')`) — 설명선 좌표

---

## 6. 시뮬레이터 — 파이썬 API

코드는 브라우저 파이썬(Pyodide) 위의 **micro:bit 시뮬레이션 모듈**로 실행되고, 수정 없이 실제 micro:bit V2 에서도 돌아가야 합니다.

```python
from microbit import *
display.scroll("Hi"); display.show(Image.HEART); display.show("A"); display.clear()
display.set_pixel(x, y, 0~9); display.get_pixel(x, y); display.show(imgs, delay=200, loop=False)
Image("09090:99999:99999:09990:00900"); Image.HAPPY 등 내장 이미지; img.shift_left(1) · invert() · crop()
button_a.is_pressed(); button_a.was_pressed(); button_a.get_presses(); pin_logo.is_touched()
accelerometer.get_x() / get_y() / get_z() / get_values(); accelerometer.current_gesture(); was_gesture('shake')
compass.heading(); compass.calibrate(); compass.get_field_strength()
temperature(); display.read_light_level(); microphone.sound_level(); microphone.current_event()
pin0.write_digital(1); pin0.read_digital(); pin0.write_analog(0~1023); pin0.read_analog(); pin0.is_touched()
pin0.set_pull(pin0.PULL_UP); pin0.set_analog_period(20)           # 서보 50Hz
sleep(ms); running_time(); scale(v, from_=(a, b), to=(c, d)); i2c · spi · uart(일부)
import music      # music.play(music.NYAN), music.pitch(440, 500), music.set_tempo(bpm=120)
import audio      # audio.play(Sound.GIGGLE), SoundEffect(...)   (V2)
import speech     # speech.say("hello")  (브라우저 음성 합성으로 흉내)
import radio      # radio.on(); radio.config(group=7); radio.send("hi"); radio.receive()
import neopixel   # np = neopixel.NeoPixel(pin0, 8); np[0] = (255, 0, 0); np.show()
import log        # log.set_labels('temp'); log.add(temp=temperature())   (V2)
import machine, power, random, math, time, os   # time.ticks_ms() 등 MicroPython 확장 포함
```

- **쓰지 않는 것**: `input()`(micro:bit 에는 키보드 입력이 없음), `threading`, 네트워크(`socket`, `requests`), PC 파일 경로, numpy 등 외부 패키지.
- 시뮬레이터 조작은 `hint` 와 본문에서 안내합니다:
  - 보드 그림의 **A · B 버튼**(키보드 A · B), 금색 **로고**, 큰 단자 **0 · 1 · 2** 터치
  - **🧭 센서** 탭: 기울기 판 · 제스처 버튼 · 온도 · 빛 · 소리 · 방위각 슬라이더
  - **🔌 핀** 탭: 핀별 모드 · 값, 입력을 0/1 로 강제
  - **🧩 부품** 탭: `LED` · `버튼` · `토글 스위치` · `가변저항` · `조도 센서(CdS)` · `부저` · `서보 모터` · `NeoPixel 띠` · `DC 모터` 를 핀에 연결 (NeoPixel 은 코드에서 만들면 자동 추가)
  - **📡 무선**(가상 짝 보드 · 수신함) · **💾 파일**(보드 파일 시스템) · **📊 로그**(log 모듈 표 · CSV)
- 실제 보드와 시뮬레이터가 다른 점(메모리 · 속도 · V1/V2 차이 · 배선 안전)은 `callout kind:'board'` 로 알려 줍니다.
- 위험한 배선(LED 저항 생략, 모터 직결, 전원 단락)은 `callout kind:'warn'` 으로 분명히.

---

## 7. 문체 · 용어

- 한국어 **존댓말, 짧은 문장**. 학생에게 직접 말합니다: "버튼을 누르면 하트가 보이게 해 봅니다."
- 용어는 처음 나올 때 영어를 괄호로 한 번: "풀업 저항(pull-up resistor)".
- 본문 · 버튼 글자에 장식용 이모지는 쓰지 않습니다 (화면 요소를 가리킬 때 `🧩 부품` 탭처럼 UI 이름 그대로 쓰는 것은 괜찮음).
- 숫자 · 단위: `3V`, `220Ω`, `500ms`, `1000` (밀리초).
- 확실하지 않은 수치 · 출시 연도 · 가격은 쓰지 않습니다.

---

## 8. 분량 기준

교시 하나(50분): 본문 블록 25~45개, 실행 예제 6~12개(셸 예제 포함), 그림 1~3개, 실습 1~3개, 퀴즈 3~5문항, 슬라이드 7~11장.
본문은 쉬운 비유 → 정확한 정의 → 그림 → 예제 실행 → 결과 해석 → 바꿔 보기(응용 예제) 순서로 씁니다.

---

## 9. 검사 (필수)

```bash
node tools/validate.js ch03            # 구조 검사 + 모든 코드 문법 검사(로컬 Python 3 의 compile — 실행은 안 함)
node tools/validate.js all             # 모든 챕터
node tools/validate.js ch03 --no-run   # 로컬 파이썬이 없으면 구조만
```

오류 0 이 될 때까지 고칩니다 (경고는 확인 후 괜찮으면 두어도 됨).
검사 도구는 시뮬레이터를 돌리지 않으므로, 동작은 `python server/serve.py` (Windows: `start.bat`) 로 사이트를 열어 **▶ 실행**으로 확인합니다.
