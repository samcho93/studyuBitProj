/* Chapter 02. Hello, World!
 * 원본: MicroPython on the BBC micro:bit — Hello, World!
 */
(function () {
  /* 5x5 LED 화면을 그리는 도우미 */
  const screen = (rows, label) => {
    const px = rows.replace(/[^0-9]/g, '');
    return `<div style="display:inline-block;text-align:center;margin:6px 10px">
      <svg viewBox="0 0 150 150" width="120" height="120"><rect x="0" y="0" width="150" height="150" rx="12" fill="#0e6b64"/>
      ${Array.from({ length: 25 }, (_, i) => {
      const v = +(px[i] || 0);
      return `<rect x="${18 + (i % 5) * 26}" y="${16 + Math.floor(i / 5) * 26}" width="14" height="20" rx="3" fill="${v ? '#ff2d1a' : '#4a1a16'}" opacity="${v ? (0.2 + v / 9 * 0.8).toFixed(2) : 1}"/>`;
    }).join('')}</svg>
      ${label ? `<div style="font-size:13px;color:var(--muted);margin-top:2px">${label}</div>` : ''}</div>`;
  };

  const FIG_SCROLL = `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="640" y="40" text-anchor="middle" font-size="26" font-weight="bold" fill="var(--fg)">display.scroll("HI") — 글자가 오른쪽에서 왼쪽으로 흘러갑니다</text>
  <text x="80" y="90" font-size="20" fill="var(--muted)">보이지 않는 긴 띠 (글자 전체)</text>
  ${(() => {
      // H I 두 글자를 열 단위로 (H: 5열, 공백 1, I: 3열)
      const cols = [0x1f, 0x04, 0x04, 0x04, 0x1f, 0x00, 0x11, 0x1f, 0x11, 0x00, 0, 0, 0, 0, 0];
      return cols.map((c, i) => Array.from({ length: 5 }, (_, y) => `<rect x="${80 + i * 34}" y="${110 + y * 30}" width="16" height="22" rx="3" fill="${(c >> y) & 1 ? '#ff2d1a' : 'var(--line)'}"/>`).join('')).join('\n  ');
    })()}
  <rect x="146" y="102" width="176" height="164" rx="8" fill="none" stroke="var(--accent)" stroke-width="5"/>
  <text x="234" y="296" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--accent)">지금 보이는 5칸</text>
  <path d="M340 184 L560 184" stroke="var(--ok)" stroke-width="5" marker-end="url(#c2a)"/>
  <defs><marker id="c2a" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--ok)"/></marker></defs>
  <text x="450" y="170" text-anchor="middle" font-size="19" fill="var(--ok)">한 칸씩 이동</text>
  <text x="80" y="340" font-size="20" fill="var(--fg)">micro:bit 화면은 <tspan font-weight="bold">5칸</tspan>뿐이라 긴 글자는 한 번에 보여 줄 수 없습니다.</text>
  <text x="80" y="376" font-size="20" fill="var(--fg)">그래서 띠를 한 칸씩 밀면서 보여 줍니다 — 이것이 <tspan font-weight="bold" fill="var(--accent)">스크롤(scroll)</tspan> 입니다.</text>
  <text x="80" y="406" font-size="19" fill="var(--muted)">밀리는 속도는 delay 로 조절합니다. delay 가 클수록 천천히.</text>
</svg>`;

  const FIG_INDENT = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="monospace">
  <text x="40" y="40" font-size="25" font-weight="bold" font-family="sans-serif" fill="var(--ok)">✔ 올바른 들여쓰기</text>
  <rect x="40" y="60" width="560" height="180" rx="10" fill="var(--code-bg)" stroke="var(--ok)" stroke-width="3"/>
  <text x="62" y="96" font-size="21" fill="var(--fg)">while True:</text>
  <rect x="62" y="106" width="46" height="112" fill="var(--ok)" opacity=".18"/>
  <text x="115" y="132" font-size="21" fill="var(--fg)">display.show(Image.HEART)</text>
  <text x="115" y="168" font-size="21" fill="var(--fg)">sleep(500)</text>
  <text x="115" y="204" font-size="21" fill="var(--fg)">display.clear()</text>
  <text x="70" y="270" font-size="18" font-family="sans-serif" fill="var(--muted)">콜론(:) 다음 줄부터 <tspan font-weight="bold">공백 4칸</tspan> — 반복 안에 들어감</text>
  <text x="680" y="40" font-size="25" font-weight="bold" font-family="sans-serif" fill="var(--danger)">✘ 잘못된 들여쓰기</text>
  <rect x="680" y="60" width="560" height="180" rx="10" fill="var(--code-bg)" stroke="var(--danger)" stroke-width="3"/>
  <text x="702" y="96" font-size="21" fill="var(--fg)">while True:</text>
  <text x="755" y="132" font-size="21" fill="var(--fg)">display.show(Image.HEART)</text>
  <text x="702" y="168" font-size="21" fill="var(--danger)">sleep(500)</text>
  <text x="702" y="204" font-size="21" fill="var(--danger)">display.clear()</text>
  <text x="690" y="270" font-size="18" font-family="sans-serif" fill="var(--danger)">들여쓰기가 없어 반복 <tspan font-weight="bold">밖</tspan>으로 나감 → 하트만 계속 보임</text>
  <text x="40" y="340" font-size="20" font-family="sans-serif" fill="var(--fg)">파이썬은 <tspan font-weight="bold">들여쓰기로 "어디까지가 한 덩어리인지"</tspan> 를 판단합니다. 중괄호 {} 대신 공백을 씁니다.</text>
  <text x="40" y="376" font-size="19" font-family="sans-serif" fill="var(--muted)">공백 4칸이 약속입니다. 탭과 공백을 섞으면 TabError 가 납니다.</text>
</svg>`;

  MB_COURSE.addChapter({
    id: 'ch02',
    no: '02',
    title: 'Hello, World!',
    subtitle: 'display.scroll · show · sleep · 주석 · 들여쓰기 · 반복',
    summary: 'micro:bit 에게 처음으로 말을 시켜 봅니다. LED 화면에 글자를 흘려보내는 scroll() 과 한 글자 · 그림을 보여 주는 show() 를 배우고, 기다리게 하는 sleep(), 계속 반복하게 하는 while True: 를 익힙니다. 파이썬에서 가장 중요한 규칙인 들여쓰기와, 오류 메시지를 읽는 방법도 함께 배웁니다.',
    goals: [
      '<code>display.scroll()</code> 과 <code>display.show()</code> 의 차이를 설명하고 쓸 수 있다',
      '<code>sleep()</code> 으로 프로그램의 속도를 조절할 수 있다',
      '<code>while True:</code> 로 끝없이 반복하는 프로그램을 만들 수 있다',
      '주석(<code>#</code>)을 쓰고, 들여쓰기 규칙을 지킬 수 있다',
      '자주 나오는 오류 메시지를 읽고 스스로 고칠 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch02-1',
        title: '첫 프로그램 — 화면에 글자 보내기',
        minutes: 45,
        goals: [
          '<code>from microbit import *</code> 가 무엇을 하는지 설명할 수 있다',
          '<code>display.scroll()</code> 로 글자를 흘려보낼 수 있다',
          '<code>display.show()</code> 로 한 글자 · 숫자 · 그림을 보여 줄 수 있다',
          '<code>delay</code> · <code>wait</code> · <code>loop</code> 옵션을 쓸 수 있다'
        ],
        flow: [['Hello, World! 의 전통', 5], ['scroll() 분해하기', 14], ['show() 와의 차이', 12], ['옵션 실험', 9], ['정리 · 퀴즈', 5]],
        content: [
          { type: 'h', text: '프로그래머의 전통 — Hello, World!' },
          { type: 'p', html: '새로운 프로그래밍 언어나 장치를 배울 때 가장 먼저 만드는 프로그램은 거의 언제나 <b>“Hello, World!” 를 출력하는 것</b>입니다. 1978년 C 언어 교과서에서 시작된 오랜 전통이지요. 아주 간단해 보이지만, 이 한 줄이 돌아간다는 것은 <b>개발 환경이 제대로 갖춰졌다</b>는 뜻이기도 합니다.' },
          {
            type: 'code', title: '예제 2-1. micro:bit 의 Hello, World!', code: `from microbit import *

display.scroll("Hello, World!")`,
            desc: '▶ 실행을 누르면 오른쪽 보드의 LED 화면에 글자가 <b>오른쪽에서 왼쪽으로</b> 흘러갑니다.',
            expect: 'LED 화면에 Hello, World! 가 한 번 흘러갑니다.'
          },

          { type: 'h', text: '코드 한 줄씩 뜯어보기' },
          { type: 'p', html: '단 두 줄이지만 배울 것이 많습니다.' },
          {
            type: 'table', head: ['부분', '뜻'], rows: [
              ['<code>from microbit import *</code>', '“<b>microbit</b> 이라는 도구 상자에서 <b>모든 것(*)</b>을 꺼내 와라.” 이 줄이 있어야 <code>display</code>, <code>Image</code>, <code>sleep</code> 등을 이름 그대로 쓸 수 있습니다.'],
              ['<code>display</code>', 'LED 화면을 뜻하는 <b>이름(객체)</b>. micro:bit 의 화면 담당입니다.'],
              ['<code>.</code> (점)', '“~의”. <code>display.scroll</code> = “화면<b>의</b> scroll 기능”.'],
              ['<code>scroll</code>', '글자를 흘려보내는 <b>기능(함수 · 메서드)</b>.'],
              ['<code>( )</code>', '기능을 <b>실행하라</b>는 표시. 괄호 안에는 필요한 재료를 넣습니다.'],
              ['<code>"Hello, World!"</code>', '큰따옴표로 감싼 <b>문자열</b>. 화면에 보낼 글자입니다.']
            ], caption: '표 2-1. 코드의 각 부분이 하는 일'
          },
          { type: 'callout', kind: 'tip', title: '읽는 법: “디스플레이 점 스크롤”', html: '<code>display.scroll("Hello")</code> 는 “<b>화면아, Hello 를 흘려보내라</b>” 라고 읽으면 됩니다. 파이썬 코드는 영어 문장처럼 읽히도록 만들어져 있습니다.' },
          { type: 'callout', kind: 'warn', title: '따옴표는 꼭 영문 자판으로', html: '<code>"</code> 와 <code>“</code> 는 다른 글자입니다. 한글 워드나 발표 자료에서 복사한 코드에는 둥근 따옴표(<code>“ ”</code>)가 섞여 있어 <code>SyntaxError: invalid character</code> 가 납니다. 코드는 직접 입력하는 습관을 들이세요.' },

          { type: 'h', text: 'scroll() 은 왜 흘러갈까?' },
          { type: 'p', html: 'micro:bit 화면은 가로 <b>5칸</b>뿐입니다. 글자 하나가 5칸을 거의 다 차지하므로 <code>Hello, World!</code> 를 한 번에 보여 줄 수 없습니다. 그래서 글자 전체를 긴 띠로 만들어 두고 <b>한 칸씩 왼쪽으로 밀면서</b> 5칸 창으로 들여다봅니다.' },
          { type: 'figure', html: FIG_SCROLL, caption: '그림 2-1. scroll() 의 원리 — 긴 띠를 5칸 창으로 들여다본다' },
          {
            type: 'code', title: '예제 2-2. 흘러가는 속도 바꾸기', code: `from microbit import *

display.scroll("SLOW", delay=400)
display.scroll("FAST", delay=40)`,
            desc: '<code>delay</code> 는 한 칸 미는 데 걸리는 시간(밀리초)입니다. 기본값은 <b>150</b> 입니다. 숫자가 <b>클수록 천천히</b>, 작을수록 빠르게 흘러갑니다.',
            expect: 'SLOW 가 느리게, FAST 가 빠르게 흘러갑니다.'
          },
          {
            type: 'code', title: '예제 2-3. 끝없이 반복해서 흘리기', code: `from microbit import *

display.scroll("SOS ", delay=100, loop=True)`,
            desc: '<code>loop=True</code> 를 주면 <b>끝없이 반복</b>합니다. 축제 안내판처럼 계속 돌아가야 할 때 씁니다. 멈추려면 <b>■ 정지</b>를 누르세요. 문자열 끝의 <b>빈칸</b>은 반복될 때 글자가 붙지 않게 해 줍니다.',
            expect: 'SOS 가 계속 반복해서 흘러갑니다. (■ 정지로 멈춤)'
          },
          {
            type: 'table', head: ['옵션', '기본값', '뜻'], rows: [
              ['<code>delay</code>', '150', '한 칸 미는 시간(ms). 클수록 느림'],
              ['<code>loop</code>', '<code>False</code>', '<code>True</code> 면 끝없이 반복'],
              ['<code>wait</code>', '<code>True</code>', '<code>False</code> 면 흘러가는 동안 <b>다음 줄이 바로 실행</b>됨'],
              ['<code>monospace</code>', '<code>False</code>', '<code>True</code> 면 모든 글자의 너비를 똑같이']
            ], caption: '표 2-2. scroll() 의 옵션'
          },
          {
            type: 'code', title: '예제 2-4. wait=False — 기다리지 않기', code: `from microbit import *

display.scroll("BACKGROUND", wait=False)
# 글자가 흘러가는 동안에도 아래 줄이 바로 실행된다
for i in range(20):
    print("일하는 중...", i)
    sleep(200)`,
            desc: '<code>wait=False</code> 는 “글자가 다 흘러갈 때까지 기다리지 말라”는 뜻입니다. 화면에는 글자가 흐르면서 <b>동시에</b> 콘솔에 숫자가 찍힙니다. 기본값(<code>wait=True</code>)이면 글자가 다 흐른 뒤에야 다음 줄이 실행됩니다.',
            expect: '일하는 중... 0\n일하는 중... 1\n… (화면에는 BACKGROUND 가 동시에 흐름)'
          },

          { type: 'h', text: 'show() — 한 번에 하나씩 보여 주기' },
          { type: 'p', html: '<code>display.show()</code> 는 흘려보내지 않고 <b>화면에 그대로 띄웁니다</b>. 글자 하나, 숫자, 그림(<code>Image</code>) 을 보여 줄 때 씁니다.' },
          {
            type: 'code', title: '예제 2-5. show() 로 보여 주기', code: `from microbit import *

display.show("A")
sleep(1000)
display.show(7)
sleep(1000)
display.show(Image.HEART)`,
            desc: '<code>show()</code> 에 글자 하나를 주면 <b>그 글자가 그대로 멈춰</b> 있습니다. 숫자도 한 자리면 그대로 보입니다. <code>Image.HEART</code> 같은 그림도 보여 줄 수 있습니다(3장에서 자세히).',
            expect: 'A → 7 → 하트 순서로 1초씩 나타납니다.'
          },
          { type: 'figure', html: `<div style="text-align:center">${screen('00000 09090 00000 90009 09990', 'show(Image.HAPPY)')}${screen('99999 00900 00900 00900 00900', 'show("T")')}${screen('09090 99999 99999 09990 00900', 'show(Image.HEART)')}</div>`, caption: '그림 2-2. show() 는 화면에 그대로 멈춰 있습니다' },
          { type: 'p', html: '그런데 <code>show()</code> 에 <b>여러 글자</b>를 주면 어떻게 될까요? 한 글자씩 차례로 <b>바꿔 가며</b> 보여 줍니다 — 흘러가지 않고 <b>탁, 탁</b> 바뀝니다.' },
          {
            type: 'code', title: '예제 2-6. scroll 과 show 의 차이', code: `from microbit import *

display.scroll("ABC")     # 부드럽게 흘러간다
sleep(500)
display.show("ABC")       # A → B → C 로 탁탁 바뀐다
sleep(500)
display.show("ABC", delay=1000)   # 더 천천히 바뀐다`,
            desc: '두 명령의 차이를 눈으로 확인해 보세요. 긴 문장은 <code>scroll</code>, 한 글자나 그림은 <code>show</code> 가 어울립니다.',
            expect: 'ABC 가 흘러간 뒤, A · B · C 가 차례로 깜빡이듯 바뀝니다.'
          },
          {
            type: 'table', head: ['', '<code>display.scroll()</code>', '<code>display.show()</code>'], rows: [
              ['움직임', '오른쪽 → 왼쪽으로 <b>부드럽게 흐름</b>', '<b>탁 나타남</b> (여러 개면 차례로 바뀜)'],
              ['주로 넣는 것', '긴 문장 · 단어', '글자 하나 · 숫자 · <code>Image</code>'],
              ['기본 delay', '150ms (한 칸)', '400ms (한 장면)'],
              ['끝난 뒤 화면', '꺼짐', '<b>마지막 것이 그대로 남음</b>']
            ]
          },
          { type: 'callout', kind: 'tip', title: '한글은 나오지 않습니다', html: 'micro:bit 의 글꼴에는 <b>영문 · 숫자 · 기호</b>만 들어 있습니다. 한글을 넣으면 <code>?</code> 로 보입니다. 이름은 <code>"MINJUN"</code> 처럼 영문으로 쓰세요.' },
          { type: 'callout', kind: 'board', html: '실제 micro:bit 에서는 LED 25개를 아주 빠르게 번갈아 켜서(멀티플렉싱) 25개가 동시에 켜진 것처럼 보이게 합니다. 그래서 화면을 켜 두면 전류를 꽤 씁니다. 건전지로 오래 쓰려면 <code>display.off()</code> 로 잠시 꺼 두는 것도 방법입니다.' },

          { type: 'h', text: '더 해 보기' },
          {
            type: 'code', title: '더 해 보기 ①. 숫자와 계산 결과 보여 주기', code: `from microbit import *

display.scroll(2026, delay=90)                 # 숫자도 그대로 된다
sleep(300)
display.scroll(3 * 7, delay=90)                # 계산 결과 21
sleep(300)
display.scroll("2 X 7 = " + str(2 * 7), delay=90)`,
            desc: '<code>scroll()</code> 에는 숫자도 바로 넣을 수 있습니다. 다만 <b>글자와 숫자를 <code>+</code> 로 이어 붙일 때</b>는 <code>str()</code> 로 숫자를 글자로 바꿔야 합니다. 3행의 <code>str()</code> 을 지우고 실행해 어떤 오류가 나는지도 확인해 보세요.',
            expect: '2026 → 21 → 2 X 7 = 14 순서로 흘러갑니다.'
          },
          {
            type: 'code', title: '더 해 보기 ②. monospace 옵션 비교', code: `from microbit import *

display.scroll("IIIIIIII", delay=120)                      # 글자 폭이 제각각
sleep(500)
display.scroll("IIIIIIII", delay=120, monospace=True)      # 폭이 모두 같음`,
            desc: '기본은 글자마다 <b>필요한 만큼만</b> 폭을 씁니다(<code>I</code> 는 좁고 <code>M</code> 은 넓습니다). <code>monospace=True</code> 를 주면 모든 글자가 <b>같은 폭</b>이 되어 표처럼 줄이 맞습니다.',
            expect: '같은 글자가 두 번 흐르는데 두 번째가 더 여유 있게 흐릅니다.'
          },
          {
            type: 'code', title: '더 해 보기 ③. show 의 clear 옵션', code: `from microbit import *

# clear=True 면 다 보여 준 뒤 화면을 지운다
display.show([Image.HEART, Image.HAPPY, Image.DUCK], delay=500, clear=True)
print("끝난 뒤 화면은 비어 있습니다")
sleep(1000)

# clear 를 주지 않으면 마지막 그림이 남는다
display.show([Image.HEART, Image.HAPPY, Image.DUCK], delay=500)
print("이번에는 오리가 남아 있습니다")`,
            desc: '<code>clear=True</code> 는 애니메이션이 끝난 뒤 화면을 자동으로 지웁니다. 다음 동작으로 깔끔하게 넘어가고 싶을 때 씁니다.',
            expect: '세 그림이 지나간 뒤 화면이 비고, 두 번째에는 오리가 남습니다.'
          },

          { type: 'h', text: '1교시 요약' },
          {
            type: 'list', items: [
              '모든 micro:bit 프로그램은 <code>from microbit import *</code> 로 시작합니다.',
              '<code>display.scroll("글")</code> — 긴 글자를 오른쪽에서 왼쪽으로 <b>흘려보냅니다</b>.',
              '<code>display.show(값)</code> — 글자 하나 · 숫자 · 그림을 <b>그대로 띄웁니다</b>.',
              '옵션: <code>delay</code>(속도), <code>loop</code>(반복), <code>wait</code>(기다릴지).',
              '문자열은 <b>곧은 따옴표</b>(<code>"</code>)로 감싸고, <b>영문</b>만 나옵니다.'
            ]
          }
        ],
        practice: [
          {
            title: '실습 2-1. 전광판 만들기',
            level: 1,
            desc: '<p>학교 축제 안내 전광판을 만드세요.</p><ul><li>처음에 <code>WELCOME</code> 을 한 번 흘려보냅니다.</li><li>그다음 <code>SCHOOL FESTIVAL 2026 </code> 을 <b>끝없이 반복</b>해서 흘려보냅니다.</li><li>반복되는 글자는 조금 빠르게(<code>delay=80</code>) 흐르게 하세요.</li></ul>',
            hint: '반복은 <code>loop=True</code> 옵션으로 합니다. 끝에 빈칸을 하나 넣으면 반복될 때 글자가 붙지 않습니다.',
            starter: 'from microbit import *\n\n# TODO: WELCOME 을 한 번 흘려보내기\n\n# TODO: SCHOOL FESTIVAL 2026 을 빠르게 끝없이 흘려보내기\n',
            solution: 'from microbit import *\n\ndisplay.scroll("WELCOME")\ndisplay.scroll("SCHOOL FESTIVAL 2026 ", delay=80, loop=True)\n'
          },
          {
            title: '실습 2-2. 카운트다운',
            level: 2,
            desc: '<p><code>5 → 4 → 3 → 2 → 1 → GO!</code> 순서로 보여 주는 카운트다운을 만드세요.</p><ul><li>숫자는 <code>show()</code> 로 1초씩 보여 줍니다.</li><li>마지막 <code>GO!</code> 는 <code>scroll()</code> 로 흘려보냅니다.</li><li>끝나면 <code>Image.HAPPY</code> 를 띄웁니다.</li></ul>',
            hint: '<code>display.show(5)</code> 다음에 <code>sleep(1000)</code> 을 넣습니다. 숫자는 따옴표 없이 써도 됩니다.',
            starter: 'from microbit import *\n\ndisplay.show(5)\nsleep(1000)\n# TODO: 4, 3, 2, 1 이어서 쓰기\n\n# TODO: GO! 흘려보내고 웃는 얼굴 띄우기\n',
            solution: 'from microbit import *\n\ndisplay.show(5)\nsleep(1000)\ndisplay.show(4)\nsleep(1000)\ndisplay.show(3)\nsleep(1000)\ndisplay.show(2)\nsleep(1000)\ndisplay.show(1)\nsleep(1000)\ndisplay.scroll("GO!")\ndisplay.show(Image.HAPPY)\n'
          },
          {
            title: '실습 2-3. 도전! 한 줄로 카운트다운',
            level: 3,
            desc: '<p><code>display.show()</code> 에 <b>여러 값이 담긴 목록</b>을 주면 차례로 바꿔 가며 보여 줍니다. 이 성질을 이용해 카운트다운을 <b>두 줄</b>로 줄여 보세요.</p><pre>display.show([5, 4, 3, 2, 1], delay=1000)</pre><p>여기에 더해, 이 목록 방식으로 <code>Image.HEART</code> 와 <code>Image.HEART_SMALL</code> 을 번갈아 보여 주는 <b>심장 박동</b>도 만들어 보세요. (<code>loop=True</code>)</p>',
            hint: '대괄호 <code>[ ]</code> 안에 쉼표로 나열한 것을 <b>리스트</b>라고 합니다. <code>display.show([Image.HEART, Image.HEART_SMALL], delay=300, loop=True)</code>',
            starter: 'from microbit import *\n\n# TODO: 목록으로 카운트다운\n\n# TODO: 하트 두 개를 번갈아 (심장 박동)\n',
            solution: 'from microbit import *\n\ndisplay.show([5, 4, 3, 2, 1], delay=1000)\ndisplay.show([Image.HEART, Image.HEART_SMALL], delay=300, loop=True)\n'
          }
        ],
        quiz: [
          {
            q: '<code>display.scroll("Hi")</code> 와 <code>display.show("Hi")</code> 의 차이는?', options: ['차이가 없다', 'scroll 은 흘러가고, show 는 H → i 로 바뀐다', 'scroll 은 한 글자만 보여 준다', 'show 는 소리를 낸다'], answer: 1,
            explain: '<code>scroll</code> 은 한 칸씩 밀며 <b>부드럽게</b> 흐르고, <code>show</code> 는 글자를 <b>하나씩 갈아 끼우듯</b> 보여 줍니다.'
          },
          {
            q: '<code>display.scroll("HI", delay=500)</code> 의 결과는?', options: ['기본보다 빠르게 흐른다', '기본보다 느리게 흐른다', '500번 반복한다', '500글자까지만 보여 준다'], answer: 1,
            explain: '<code>delay</code> 는 한 칸 미는 데 걸리는 시간(ms)입니다. 기본값 150 보다 크므로 <b>느리게</b> 흐릅니다.'
          },
          {
            q: '<code>from microbit import *</code> 를 빠뜨리면?', options: ['아무 문제 없다', '<code>NameError: name \'display\' is not defined</code> 가 난다', '화면이 꺼진다', '프로그램이 두 번 실행된다'], answer: 1,
            explain: '<code>display</code> 라는 이름을 어디서도 가져오지 않았으므로 “그런 이름이 없다”는 <b>NameError</b> 가 납니다.'
          },
          {
            q: '글자가 흘러가는 동안에도 다음 줄을 바로 실행하려면?', options: ['<code>loop=True</code>', '<code>wait=False</code>', '<code>delay=0</code>', '<code>monospace=True</code>'], answer: 1,
            explain: '<code>wait=False</code> 는 “다 흐를 때까지 기다리지 말라”는 뜻입니다.'
          },
          {
            q: 'micro:bit LED 화면에 <b>한글</b>을 보내면?', options: ['정상적으로 보인다', '<code>?</code> 로 보인다', '오류가 난다', '보드가 꺼진다'], answer: 1,
            explain: 'micro:bit 글꼴에는 영문 · 숫자 · 기호만 있습니다. 표에 없는 글자는 <code>?</code> 로 표시됩니다.'
          }
        ],
        slides: [
          {
            layout: 'title', title: '첫 프로그램 — 화면에 글자 보내기', subtitle: 'Chapter 02 · Hello, World!', badge: '1교시',
            notes: '<p>이번 시간부터 본격적으로 코드를 씁니다. 모든 학생이 편집기에 직접 입력하게 하세요 — 복사 붙여넣기보다 훨씬 오래 기억합니다.</p><p>시간: 2분</p>'
          },
          {
            layout: 'code', title: 'micro:bit 의 Hello, World!', code: 'from microbit import *\n\ndisplay.scroll("Hello, World!")',
            points: ['새 언어를 배울 때의 오랜 전통 (1978~)', '<code>from microbit import *</code> 로 시작', '<code>scroll</code> = 흘려보내기', '따옴표는 <b>영문 자판</b>으로!'],
            notes: '<p>직접 입력하게 하고, 따옴표 오류가 나는 학생이 있는지 돌아봅니다.</p><p><b>발문</b>: "왜 한 번에 다 안 보이고 흘러갈까요?" → 화면이 5칸뿐이라서.</p><p>시간: 8분</p>'
          },
          {
            layout: 'table', title: '코드 뜯어보기', head: ['부분', '뜻'], rows: [
              ['<code>from microbit import *</code>', '도구 상자에서 모든 것 꺼내기'],
              ['<code>display</code>', 'LED 화면'],
              ['<code>.</code>', '“~의”'],
              ['<code>scroll</code>', '흘려보내는 기능'],
              ['<code>( )</code>', '실행하라'],
              ['<code>"Hello"</code>', '문자열(글자)']],
            notes: '<p>"디스플레이 점 스크롤" 이라고 소리 내어 읽게 하면 구조가 잘 각인됩니다.</p><p>시간: 6분</p>'
          },
          {
            layout: 'diagram', title: 'scroll() 의 원리', html: FIG_SCROLL, caption: '긴 띠를 5칸 창으로 한 칸씩 밀며 들여다본다',
            notes: '<p>손으로 종이에 글씨를 쓰고 5칸 구멍이 뚫린 종이를 밀어 보이면 이해가 빠릅니다.</p><p>시간: 5분</p>'
          },
          {
            layout: 'code', title: '옵션: delay · loop · wait', code: 'from microbit import *\n\ndisplay.scroll("SLOW", delay=400)\ndisplay.scroll("FAST", delay=40)\ndisplay.scroll("SOS ", delay=100, loop=True)',
            points: ['<code>delay</code> = 한 칸 미는 시간(ms), 기본 150', '<code>loop=True</code> = 끝없이 반복', '<code>wait=False</code> = 기다리지 않음', '■ 정지로 멈추기'],
            notes: '<p>학생들이 delay 값을 마음껏 바꿔 보게 합니다. delay=5 로 하면 거의 읽을 수 없다는 것도 재미있는 발견입니다.</p><p>시간: 8분</p>'
          },
          {
            layout: 'code', title: 'show() — 그대로 띄우기', code: 'from microbit import *\n\ndisplay.show("A")\nsleep(1000)\ndisplay.show(7)\nsleep(1000)\ndisplay.show(Image.HEART)',
            points: ['글자 하나 · 숫자 · 그림', '끝난 뒤 <b>마지막 것이 남음</b>', '여러 글자를 주면 차례로 바뀜', '기본 delay 는 400ms'],
            notes: '<p>scroll 과 show 를 나란히 실행해 차이를 보여 줍니다.</p><p>시간: 7분</p>'
          },
          {
            layout: 'table', title: 'scroll vs show', head: ['', 'scroll', 'show'], rows: [
              ['움직임', '부드럽게 흐름', '탁 나타남'],
              ['어울리는 것', '긴 문장', '글자 하나 · 그림'],
              ['기본 delay', '150ms', '400ms'],
              ['끝난 뒤', '꺼짐', '마지막 것이 남음']],
            notes: '<p>"긴 말은 scroll, 한 글자·그림은 show" 로 정리합니다.</p><p>시간: 3분</p>'
          },
          {
            layout: 'practice', title: '실습 2-1. 전광판 만들기', desc: 'WELCOME 을 한 번 흘린 뒤, 축제 안내를 끝없이 반복해 흘려보내세요.',
            starter: 'from microbit import *\n\n# TODO\n',
            solution: 'from microbit import *\n\ndisplay.scroll("WELCOME")\ndisplay.scroll("SCHOOL FESTIVAL 2026 ", delay=80, loop=True)\n',
            notes: '<p>각자 자기 반 이름이나 동아리 이름을 넣게 하면 참여도가 올라갑니다.</p><p>시간: 8분</p>'
          },
          {
            layout: 'summary', title: '1교시 정리', bullets: ['<code>from microbit import *</code> 로 시작', '<code>display.scroll("긴 글")</code> — 흘려보내기', '<code>display.show(값)</code> — 그대로 띄우기', '옵션: delay · loop · wait', '한글은 나오지 않음 · 따옴표는 영문으로'],
            notes: '<p>다음 시간 예고: 주석 · 들여쓰기 · 오류 읽기.</p><p>시간: 3분</p>'
          }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch02-2',
        title: '주석 · 들여쓰기 · 오류 읽기',
        minutes: 45,
        goals: [
          '주석(<code>#</code>)을 써서 코드를 설명하고, 잠시 실행을 막을 수 있다',
          '파이썬의 들여쓰기 규칙을 설명하고 지킬 수 있다',
          '오류 메시지의 구조를 읽고 어느 줄이 문제인지 찾을 수 있다',
          '자주 나오는 오류(NameError · SyntaxError · IndentationError)를 스스로 고칠 수 있다'
        ],
        flow: [['주석', 8], ['들여쓰기', 14], ['오류 메시지 읽기', 14], ['오류 고치기 실습', 6], ['정리 · 퀴즈', 3]],
        content: [
          { type: 'h', text: '주석 (#) — 사람을 위한 메모' },
          { type: 'p', html: '<code>#</code> 뒤에 쓴 내용은 컴퓨터가 <b>완전히 무시</b>합니다. 오로지 <b>사람이 읽기 위한 메모</b>입니다. 나중에 코드를 다시 볼 미래의 나, 그리고 함께 작업할 친구를 위해 씁니다.' },
          {
            type: 'code', title: '예제 2-7. 주석 사용하기', code: `from microbit import *

# ─────────────────────────────
#  작성자: 홍길동
#  만든 날: 2026-03-05
#  하는 일: 응원 메시지를 보여 준다
# ─────────────────────────────

display.scroll("FIGHTING")   # 줄 끝에도 쓸 수 있다
# display.scroll("이 줄은 실행되지 않는다")
display.show(Image.HAPPY)`,
            desc: '<code>#</code> 로 시작하는 줄과 <code>#</code> 뒤의 내용은 실행되지 않습니다. <b>9행</b>의 <code>#</code> 을 지우고 다시 실행해 보세요.',
            expect: 'FIGHTING 이 흘러간 뒤 웃는 얼굴'
          },
          {
            type: 'table', head: ['주석을 쓰는 이유', '예'], rows: [
              ['코드의 목적을 설명', '<code># 버튼 A 를 누르면 점수를 1 올린다</code>'],
              ['복잡한 계산의 뜻을 설명', '<code># 0~1023 을 0~9 밝기로 바꾼다</code>'],
              ['잠시 실행을 막기 (주석 처리)', '<code># display.scroll("디버그용")</code>'],
              ['나중에 할 일 적어 두기', '<code># TODO: 소리도 내기</code>']
            ]
          },
          { type: 'callout', kind: 'tip', title: '단축키로 주석 토글', html: '편집기에서 줄을 선택하고 <kbd>Ctrl</kbd> + <kbd>/</kbd> 를 누르면 <code>#</code> 이 붙었다 떨어집니다. 여러 줄을 한꺼번에 껐다 켤 때 편리합니다.' },
          { type: 'callout', kind: 'warn', title: '주석도 보드의 메모리를 씁니다', html: 'PC 파이썬과 달리, micro:bit 는 소스 코드를 <b>파일 그대로</b> 보드에 저장합니다. 주석이 아주 많으면 30KB 남짓한 파일 공간이 부족해질 수 있습니다. 학습 중에는 마음껏 쓰되, 프로그램이 커지면 정리하세요.' },

          { type: 'h', text: '들여쓰기 — 파이썬의 가장 중요한 규칙' },
          { type: 'p', html: '많은 프로그래밍 언어는 중괄호 <code>{ }</code> 로 “여기부터 여기까지가 한 덩어리”를 표시합니다. 파이썬은 대신 <b>들여쓰기(줄 앞의 공백)</b> 로 표시합니다. 그래서 파이썬에서 공백은 <b>장식이 아니라 문법</b>입니다.' },
          { type: 'figure', html: FIG_INDENT, caption: '그림 2-3. 들여쓰기가 프로그램의 구조를 결정한다' },
          {
            type: 'list', ordered: true, items: [
              '<b>콜론(:)</b> 으로 끝나는 줄 다음에는 반드시 들여쓴 줄이 와야 합니다.',
              '들여쓰기는 <b>공백 4칸</b>이 약속입니다. (편집기에서 <kbd>Tab</kbd> 을 누르면 자동으로 4칸이 들어갑니다)',
              '같은 덩어리 안의 줄들은 <b>모두 같은 칸수</b>로 맞춰야 합니다.',
              '<b>탭과 공백을 섞으면 안 됩니다.</b> 눈에는 같아 보여도 파이썬은 다르게 봅니다.'
            ]
          },
          {
            type: 'code', title: '예제 2-8. 들여쓰기가 바꾸는 결과', code: `from microbit import *

# 안쪽(들여쓴 줄)만 반복된다
for i in range(3):
    display.show(i)
    sleep(400)

display.scroll("END")   # 반복이 끝난 뒤 한 번만 실행`,
            desc: '<code>for i in range(3):</code> 아래 <b>들여쓴 두 줄</b>만 3번 반복합니다. <code>display.scroll("END")</code> 는 들여쓰지 않았으므로 반복이 모두 끝난 뒤 <b>한 번만</b> 실행됩니다.',
            expect: '0 → 1 → 2 가 차례로 보인 뒤 END 가 한 번 흘러갑니다.'
          },
          {
            type: 'code', title: '예제 2-9. END 를 반복 안에 넣으면?', code: `from microbit import *

for i in range(3):
    display.show(i)
    sleep(400)
    display.scroll("END")   # 들여썼으므로 3번 반복된다`,
            desc: '<code>display.scroll("END")</code> 를 한 칸 더 들여쓰면 반복 <b>안</b>으로 들어가 3번 실행됩니다. <b>공백 4칸의 차이가 결과를 완전히 바꿉니다.</b>',
            expect: '0 → END → 1 → END → 2 → END'
          },

          { type: 'h', text: '오류 메시지 읽기' },
          { type: 'p', html: '오류는 실패가 아니라 <b>컴퓨터가 주는 힌트</b>입니다. 오류 메시지는 아래에서 위로 읽으면 좋습니다.' },
          {
            type: 'figure', html: `<div style="background:var(--term-bg);color:var(--term-fg);padding:16px 20px;border-radius:10px;font-family:var(--mono);font-size:14px;line-height:1.8">
<span style="color:#ff7b72">Traceback (most recent call last):</span>
<span style="color:#ff7b72">  File "main.py", line 3, in &lt;module&gt;</span>   <span style="color:#7ee787">← ② 3행이 문제!</span>
<span style="color:#ff7b72">    displey.scroll("Hi")</span>                  <span style="color:#7ee787">← ③ 이 코드</span>
<span style="color:#ff7b72">NameError: name 'displey' is not defined</span>  <span style="color:#7ee787">← ① 먼저 읽기</span>
</div>`, caption: '그림 2-4. 오류 메시지 읽는 순서 — ① 마지막 줄 → ② 줄 번호 → ③ 문제의 코드'
          },
          {
            type: 'list', ordered: true, items: [
              '<b>마지막 줄</b>을 먼저 읽습니다 — <b>어떤 종류</b>의 오류이고 <b>왜</b> 났는지 알려 줍니다.',
              '<b><code>line 3</code></b> — 몇 번째 줄인지 알려 줍니다. (콘솔에서 이 부분을 누르면 편집기의 그 줄로 이동합니다)',
              '그 아래 코드가 실제로 문제가 된 줄입니다.'
            ]
          },
          {
            type: 'code', title: '예제 2-10. NameError — 이름을 모를 때', code: `from microbit import *

displey.scroll("Hi")`, expectError: true,
            desc: '<code>displey</code> 는 <code>display</code> 의 <b>오타</b>입니다. 파이썬은 “그런 이름은 없다”고 알려 줍니다. 오타와 대소문자를 먼저 확인하세요.',
            expect: 'Traceback (most recent call last):\n  File "main.py", line 3, in <module>\n    displey.scroll("Hi")\nNameError: name \'displey\' is not defined'
          },
          {
            type: 'code', title: '예제 2-11. SyntaxError — 괄호를 닫지 않음', code: `from microbit import *

display.scroll("Hi"`, expectError: true,
            desc: '여는 괄호 <code>(</code> 가 닫히지 않았습니다. <b>괄호와 따옴표는 언제나 짝</b>입니다. 편집기에서 괄호에 커서를 두면 짝이 되는 괄호가 표시됩니다.',
            expect: '  File "main.py", line 3\n    display.scroll("Hi"\n                  ^\nSyntaxError: \'(\' was never closed'
          },
          {
            type: 'code', title: '예제 2-12. IndentationError — 들여쓰기가 빠짐', code: `from microbit import *

while True:
display.show(Image.HEART)`, expectError: true,
            desc: '<code>while True:</code> 다음 줄은 반드시 들여써야 합니다. “들여쓴 블록이 필요하다”는 메시지입니다.',
            expect: '  File "main.py", line 4\n    display.show(Image.HEART)\nIndentationError: expected an indented block'
          },
          {
            type: 'code', title: '예제 2-13. IndentationError — 필요 없는 들여쓰기', code: `from microbit import *

display.scroll("A")
    display.scroll("B")`, expectError: true,
            desc: '반대로, 콜론(:) 없이 들여쓰면 “예상치 못한 들여쓰기”가 됩니다. 4행 앞의 공백을 지우면 해결됩니다.',
            expect: '  File "main.py", line 4\n    display.scroll("B")\nIndentationError: unexpected indent'
          },
          {
            type: 'table', head: ['오류 이름', '뜻', '흔한 원인', '고치는 법'], rows: [
              ['<code>NameError</code>', '모르는 이름', '오타, 대소문자 틀림, <code>import</code> 빠짐', '철자 확인, <code>from microbit import *</code> 확인'],
              ['<code>SyntaxError</code>', '문법 오류', '괄호 · 따옴표 짝 안 맞음, 콜론(:) 빠짐', '짝 맞추기, 줄 끝 <code>:</code> 확인'],
              ['<code>IndentationError</code>', '들여쓰기 오류', '들여쓰기 빠짐 · 불필요한 들여쓰기', '공백 4칸으로 통일'],
              ['<code>TypeError</code>', '종류가 안 맞음', '문자열 + 숫자', '<code>str()</code> 로 변환'],
              ['<code>AttributeError</code>', '그런 기능 없음', '<code>display.scrol()</code> 같은 오타', '기능 이름 확인'],
              ['<code>ValueError</code>', '값이 이상함', '밝기 10, 좌표 5 같은 범위 밖 값', '허용 범위 확인']
            ], caption: '표 2-3. 처음 자주 만나는 오류'
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서의 오류', html: '실제 micro:bit 는 화면이 작아서 오류를 <b>슬픈 얼굴 + 짧은 메시지</b>로 흘려보냅니다. 예: <code>NameError: name \'displey\' isn\'t defined</code>. USB 로 연결해 이 강좌의 콘솔에서 보면 줄 번호까지 나와 훨씬 편합니다.' },

          { type: 'h', text: '더 해 보기' },
          {
            type: 'code', title: '더 해 보기 ①. 주석으로 코드를 껐다 켜기', code: `from microbit import *

display.scroll("A", delay=80)
# display.scroll("B", delay=80)
display.scroll("C", delay=80)
# display.scroll("D", delay=80)`,
            desc: '지금은 <code>A</code> 와 <code>C</code> 만 흐릅니다. 4행과 6행의 <code>#</code> 을 지웠다 붙였다 하며 실행해 보세요. 프로그램이 길어지면 <b>일부만 잠시 꺼 두고</b> 문제를 찾는 데 아주 유용합니다. (<kbd>Ctrl</kbd>+<kbd>/</kbd>)',
            expect: 'A 와 C 만 흘러갑니다.'
          },
          {
            type: 'code', title: '더 해 보기 ②. 들여쓰기 두 단계', code: `from microbit import *

for i in range(2):              # 바깥 반복 2번
    display.show(i)
    sleep(300)
    for j in range(3):          # 안쪽 반복 3번 (8칸 들여쓰기)
        display.show(Image.HEART)
        sleep(120)
        display.clear()
        sleep(120)

display.scroll("END", delay=70)`,
            desc: '들여쓰기가 깊어질수록 <b>더 안쪽의 반복</b>입니다. 하트는 <code>2 × 3 = 6</code>번 깜빡입니다. <code>display.clear()</code> 의 들여쓰기를 4칸으로 줄이면 어떻게 되는지도 해 보세요.',
            expect: '0 → 하트 3번 → 1 → 하트 3번 → END'
          },
          {
            type: 'code', title: '더 해 보기 ③. 흔한 오류 네 가지 모아 보기', code: `from microbit import *

# 아래 줄들의 # 을 하나씩 지워 가며 어떤 오류가 나는지 확인하세요.

# display.scrol("오타")                      # AttributeError
# display.show(Image.HERAT)                  # AttributeError
# display.set_pixel(2, 2, 15)                # ValueError (밝기는 0~9)
# display.scroll("닫지 않은 괄호"             # SyntaxError

display.scroll("OK", delay=70)`,
            desc: '오류 메시지의 <b>마지막 줄</b>과 <b>line 번호</b>를 읽는 연습입니다. 콘솔의 줄 번호를 누르면 편집기의 그 줄로 바로 이동합니다. 아래에 나오는 <b>💡 도움말</b> 도 함께 읽어 보세요.',
            expect: 'OK 가 흘러갑니다. (주석을 지우면 각각 다른 오류가 납니다)'
          },

          { type: 'h', text: '2교시 요약' },
          {
            type: 'list', items: [
              '<code>#</code> 뒤는 <b>주석</b>입니다. 컴퓨터는 무시하고 사람만 읽습니다.',
              '파이썬은 <b>들여쓰기</b>로 코드 덩어리를 구분합니다. 콜론(:) 다음 줄은 <b>공백 4칸</b> 들여씁니다.',
              '들여쓰기 하나로 프로그램의 동작이 <b>완전히</b> 달라집니다.',
              '오류 메시지는 <b>마지막 줄 → 줄 번호 → 코드</b> 순서로 읽습니다.',
              '<code>NameError</code>(오타) · <code>SyntaxError</code>(괄호 · 콜론) · <code>IndentationError</code>(들여쓰기)가 가장 흔합니다.'
            ]
          }
        ],
        practice: [
          {
            title: '실습 2-4. 오류 세 군데 고치기',
            level: 2,
            desc: '<p>아래 코드에는 오류가 <b>세 군데</b> 있습니다. 실행 → 오류 메시지 읽기 → 고치기 를 반복해 완성하세요.</p><p>완성하면 <code>START</code> 가 흐른 뒤 0, 1, 2 가 차례로 보이고 마지막에 웃는 얼굴이 나와야 합니다.</p>',
            hint: '① 3행 <code>Display</code> 의 대소문자 ② 5행 줄 끝의 콜론 ③ 7행의 들여쓰기',
            starter: 'from microbit import *\n\nDisplay.scroll("START")\n\nfor i in range(3)\n    display.show(i)\n        sleep(400)\n\ndisplay.show(Image.HAPPY)\n',
            solution: 'from microbit import *\n\ndisplay.scroll("START")\n\nfor i in range(3):\n    display.show(i)\n    sleep(400)\n\ndisplay.show(Image.HAPPY)\n'
          },
          {
            title: '실습 2-5. 주석 달기',
            level: 1,
            desc: '<p>아래 코드는 동작은 하지만 설명이 하나도 없습니다. 다른 사람이 읽어도 알 수 있도록 <b>주석을 붙이세요.</b></p><ul><li>맨 위에 작성자 · 하는 일을 적는 주석 블록</li><li>각 부분이 무엇을 하는지 설명하는 주석</li><li>마지막 줄은 <b>주석 처리</b>해서 실행되지 않게 하기</li></ul>',
            hint: '<kbd>Ctrl</kbd> + <kbd>/</kbd> 로 줄 주석을 켜고 끌 수 있습니다.',
            starter: 'from microbit import *\n\ndisplay.scroll("HELLO")\nfor i in range(3):\n    display.show(Image.HEART)\n    sleep(300)\n    display.clear()\n    sleep(300)\ndisplay.scroll("BYE")\n',
            solution: 'from microbit import *\n\n# ─────────────────────────────\n#  작성자: 홍길동\n#  하는 일: 인사하고 하트를 세 번 깜빡인다\n# ─────────────────────────────\n\ndisplay.scroll("HELLO")   # 시작 인사\n\n# 하트를 3번 깜빡이기\nfor i in range(3):\n    display.show(Image.HEART)\n    sleep(300)\n    display.clear()\n    sleep(300)\n\n# display.scroll("BYE")   # 끝인사 (지금은 사용 안 함)\n'
          }
        ],
        quiz: [
          {
            q: '<code>#</code> 으로 시작하는 줄은?', options: ['오류가 난다', '컴퓨터가 무시한다(주석)', '더 빠르게 실행된다', '화면에 출력된다'], answer: 1,
            explain: '<code>#</code> 뒤는 사람이 읽는 <b>주석</b>입니다. 컴퓨터는 실행하지 않습니다.'
          },
          {
            q: '파이썬에서 코드 덩어리를 구분하는 방법은?', options: ['중괄호 { }', '들여쓰기(줄 앞 공백)', '세미콜론 ;', 'BEGIN … END'], answer: 1,
            explain: '파이썬은 <b>들여쓰기</b>로 블록을 구분합니다. 공백 4칸이 약속입니다.'
          },
          {
            q: '<code>while True:</code> 다음 줄을 들여쓰지 않으면?', options: ['NameError', 'SyntaxError', 'IndentationError: expected an indented block', 'TypeError'], answer: 2,
            explain: '“들여쓴 블록이 필요하다”는 <b>IndentationError</b> 가 납니다.'
          },
          {
            q: '오류 메시지에서 <b>가장 먼저</b> 읽어야 할 곳은?', options: ['첫 줄(Traceback)', '마지막 줄(오류 종류와 이유)', '가운데', '아무 데나'], answer: 1,
            explain: '<b>마지막 줄</b>에 오류의 종류와 이유가 있습니다. 그다음 <code>line 번호</code> 를 봅니다.'
          },
          {
            q: '다음 코드의 결과는?<pre><code>for i in range(2):\n    display.show(i)\ndisplay.scroll("END")</code></pre>', options: ['0, END, 1, END', '0, 1, END', 'END 만 두 번', '오류'], answer: 1,
            explain: '<code>display.scroll("END")</code> 는 들여쓰지 않아 반복 <b>밖</b>에 있으므로 반복이 끝난 뒤 한 번만 실행됩니다.'
          }
        ],
        slides: [
          {
            layout: 'title', title: '주석 · 들여쓰기 · 오류 읽기', subtitle: 'Chapter 02 · Hello, World!', badge: '2교시',
            notes: '<p>이 시간의 내용은 앞으로 모든 수업의 기반이 됩니다. 특히 들여쓰기는 시간을 충분히 쓰세요.</p><p>시간: 1분</p>'
          },
          {
            layout: 'code', title: '주석 (#)', code: 'from microbit import *\n\n# 작성자: 홍길동\n# 하는 일: 응원 메시지 보여 주기\n\ndisplay.scroll("FIGHTING")   # 줄 끝에도 가능\n# display.scroll("이 줄은 실행 안 됨")\ndisplay.show(Image.HAPPY)',
            points: ['<code>#</code> 뒤는 컴퓨터가 <b>무시</b>', '코드 설명 · 잠시 끄기 · 할 일 메모', '<kbd>Ctrl</kbd>+<kbd>/</kbd> 로 토글', '보드 메모리를 쓰니 너무 많이는 금물'],
            notes: '<p>주석을 지우고 실행하면 어떻게 되는지, 주석을 없애고 실행하면 어떤지 비교해 보여 줍니다.</p><p>시간: 7분</p>'
          },
          {
            layout: 'diagram', title: '들여쓰기 — 파이썬의 문법', html: FIG_INDENT, caption: '공백 4칸이 프로그램의 구조를 결정합니다',
            notes: '<p>다른 언어의 중괄호 { } 와 비교해 설명합니다. "파이썬에서 공백은 장식이 아니라 문법" 이라고 강조하세요.</p><p>시간: 8분</p>'
          },
          {
            layout: 'code', title: '들여쓰기 하나가 바꾸는 결과', code: 'for i in range(3):\n    display.show(i)\n    sleep(400)\n\ndisplay.scroll("END")   # 반복 밖 — 한 번만\n\n# ↓ 들여쓰면 반복 안 — 세 번\n#     display.scroll("END")',
            points: ['들여쓴 줄 = 반복 <b>안</b>', '들여쓰지 않은 줄 = 반복 <b>밖</b>', '결과가 완전히 달라짐', '공백 4칸 = <kbd>Tab</kbd>'],
            notes: '<p>두 가지를 모두 실행해 보여 주세요. 차이를 눈으로 본 학생은 잊지 않습니다.</p><p>시간: 8분</p>'
          },
          {
            layout: 'bullets', title: '오류 메시지 읽는 순서',
            bullets: ['① <b>마지막 줄</b> — 오류 종류와 이유', '② <code>line 3</code> — 몇 번째 줄인지', '③ 그 아래 코드 — 실제 문제가 된 줄', '콘솔의 줄 번호를 누르면 편집기로 이동'],
            notes: '<p>오류는 실패가 아니라 힌트라는 점을 반복해서 말해 주세요. 오류를 무서워하지 않는 것이 중요합니다.</p><p>시간: 6분</p>'
          },
          {
            layout: 'table', title: '자주 만나는 오류', head: ['오류', '원인', '고치기'], rows: [
              ['<code>NameError</code>', '오타 · 대소문자', '철자 확인'],
              ['<code>SyntaxError</code>', '괄호 · 따옴표 · 콜론', '짝 맞추기'],
              ['<code>IndentationError</code>', '들여쓰기', '공백 4칸 통일'],
              ['<code>AttributeError</code>', '없는 기능 이름', '이름 확인']],
            notes: '<p>인쇄해서 책상에 붙여 두게 하면 좋습니다.</p><p>시간: 5분</p>'
          },
          {
            layout: 'practice', title: '실습 2-4. 오류 세 군데 고치기', desc: '실행 → 메시지 읽기 → 고치기 를 반복하세요.',
            starter: 'from microbit import *\n\nDisplay.scroll("START")\n\nfor i in range(3)\n    display.show(i)\n        sleep(400)\n\ndisplay.show(Image.HAPPY)\n',
            solution: 'from microbit import *\n\ndisplay.scroll("START")\n\nfor i in range(3):\n    display.show(i)\n    sleep(400)\n\ndisplay.show(Image.HAPPY)\n',
            notes: '<p>정답을 바로 알려 주지 말고, 오류 메시지의 마지막 줄을 소리 내어 읽게 하세요.</p><p>시간: 8분</p>'
          },
          {
            layout: 'summary', title: '2교시 정리', bullets: ['<code>#</code> = 주석, 사람만 읽는 메모', '들여쓰기 = 파이썬의 블록 문법 (공백 4칸)', '콜론(:) 다음 줄은 반드시 들여쓰기', '오류는 마지막 줄부터 읽기', 'NameError · SyntaxError · IndentationError'],
            notes: '<p>다음 시간 예고: sleep 과 while True 로 계속 움직이는 프로그램 만들기.</p><p>시간: 2분</p>'
          }
        ]
      },

      /* ═══════════════════════ 3교시 ═══════════════════════ */
      {
        id: 'ch02-3',
        title: 'sleep 과 반복 — 살아 움직이는 프로그램',
        minutes: 45,
        goals: [
          '<code>sleep()</code> 의 단위와 역할을 설명할 수 있다',
          '<code>while True:</code> 로 끝없이 반복하는 프로그램을 만들 수 있다',
          '<code>for</code> 반복으로 정해진 횟수만큼 반복할 수 있다',
          '<code>display.clear()</code> 와 <code>running_time()</code> 을 활용할 수 있다'
        ],
        flow: [['sleep 다시 보기', 8], ['while True 무한 반복', 14], ['for 반복', 12], ['응용: 깜빡이 · 타이머', 8], ['정리 · 퀴즈', 3]],
        content: [
          { type: 'h', text: 'sleep() — 잠깐 멈추기' },
          { type: 'p', html: 'micro:bit 의 CPU 는 1초에 수천만 번의 명령을 처리합니다. 아무 조치 없이 그림을 바꾸면 <b>너무 빨라서 사람 눈에는 보이지 않습니다</b>. 그래서 사람이 볼 수 있도록 <code>sleep()</code> 으로 잠깐씩 멈춥니다.' },
          {
            type: 'code', title: '예제 2-14. sleep 이 없으면?', code: `from microbit import *

# sleep 없이 빠르게 바꾸면 사람 눈에는 마지막 것만 보인다
display.show(Image.HEART)
display.show(Image.HAPPY)
display.show(Image.SAD)`,
            desc: '세 그림이 모두 나왔지만 순식간에 지나가 <b>마지막 슬픈 얼굴만</b> 보입니다. 각 줄 사이에 <code>sleep(500)</code> 을 넣어 다시 실행해 보세요.',
            expect: '슬픈 얼굴만 보입니다.'
          },
          {
            type: 'table', head: ['쓰고 싶은 시간', '코드'], rows: [
              ['0.1초', '<code>sleep(100)</code>'], ['0.5초', '<code>sleep(500)</code>'], ['1초', '<code>sleep(1000)</code>'],
              ['2초', '<code>sleep(2000)</code>'], ['1분', '<code>sleep(60000)</code>']
            ], caption: '표 2-4. sleep() 의 단위는 밀리초(ms) — 1초 = 1000ms'
          },
          { type: 'callout', kind: 'more', title: '왜 밀리초를 쓸까?', html: '<p>마이크로컨트롤러는 <b>소수 계산이 느리고</b> 메모리도 적습니다. <code>0.5</code> 같은 실수 대신 <code>500</code> 같은 <b>정수</b>를 쓰면 훨씬 빠르고 정확합니다. 그래서 micro:bit 를 비롯한 대부분의 마이크로컨트롤러는 시간을 밀리초 정수로 다룹니다.</p><p><code>running_time()</code> 이 돌려주는 값도 밀리초입니다.</p>' },

          { type: 'h', text: 'while True: — 끝없이 반복' },
          { type: 'p', html: 'micro:bit 프로그램은 대부분 <b>끝나지 않습니다</b>. 전원이 들어와 있는 한 계속 센서를 살피고 화면을 바꿉니다. 이럴 때 쓰는 것이 <code>while True:</code> 입니다.' },
          {
            type: 'code', title: '예제 2-15. 심장 박동', code: `from microbit import *

while True:
    display.show(Image.HEART)
    sleep(200)
    display.show(Image.HEART_SMALL)
    sleep(200)`,
            desc: '<code>while True:</code> 는 “<b>참인 동안 반복하라</b>”인데, <code>True</code> 는 언제나 참이므로 <b>끝없이</b> 반복합니다. 큰 하트와 작은 하트가 번갈아 나와 심장이 뛰는 것처럼 보입니다. <b>■ 정지</b>로 멈추세요.',
            expect: '하트가 커졌다 작아졌다를 반복합니다.'
          },
          {
            type: 'figure', html: `<svg viewBox="0 0 1000 300" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="c2b" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--accent)"/></marker></defs>
  <rect x="60" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="160" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">큰 하트 보이기</text>
  <line x1="260" y1="60" x2="330" y2="60" stroke="var(--accent)" stroke-width="4" marker-end="url(#c2b)"/>
  <rect x="340" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="440" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">0.2초 기다리기</text>
  <line x1="540" y1="60" x2="610" y2="60" stroke="var(--accent)" stroke-width="4" marker-end="url(#c2b)"/>
  <rect x="620" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="720" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">작은 하트 보이기</text>
  <path d="M820 60 L880 60 L880 170 L160 170 L160 110" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#c2b)" stroke-dasharray="8 6"/>
  <text x="520" y="200" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--accent)">다시 처음으로 (끝없이)</text>
  <rect x="340" y="230" width="320" height="52" rx="10" fill="var(--danger)" opacity=".13"/>
  <text x="500" y="263" text-anchor="middle" font-size="19" fill="var(--danger)">■ 정지 / 보드 전원 off 로만 멈춤</text>
</svg>`, caption: '그림 2-5. while True: 의 흐름'
          },
          { type: 'callout', kind: 'warn', title: 'sleep 없는 while True 는 위험합니다', html: '<code>while True:</code> 안에 <code>sleep()</code> 이 하나도 없으면 CPU 가 쉬지 않고 돌아 전력을 많이 쓰고, 실제 보드에서는 버튼 입력이 씹힐 수 있습니다. <b>반복 안에는 되도록 짧은 <code>sleep()</code> 을 하나 넣어 주세요.</b> (예: <code>sleep(50)</code>)' },
          {
            type: 'code', title: '예제 2-16. 센서를 계속 읽는 기본 형태', code: `from microbit import *

while True:
    t = temperature()
    display.show(str(t))
    sleep(1000)`,
            desc: 'micro:bit 프로그램의 가장 흔한 뼈대입니다. <b>① 센서를 읽고 ② 화면에 보여 주고 ③ 잠깐 쉬고 ④ 반복</b>. 오른쪽 <b>🧭 센서</b> 탭에서 온도를 바꿔 보세요. <code>str()</code> 은 숫자를 글자로 바꿔 두 자리 수도 한 글자씩 보여 주게 합니다.',
            expect: '현재 온도가 계속 표시됩니다. (센서 탭에서 값을 바꾸면 따라 바뀝니다)',
            nondeterministic: true
          },

          { type: 'h', text: 'for — 정해진 횟수만큼 반복' },
          { type: 'p', html: '“3번만 깜빡여라”처럼 <b>횟수가 정해진</b> 반복에는 <code>for</code> 를 씁니다.' },
          {
            type: 'code', title: '예제 2-17. for 반복', code: `from microbit import *

for i in range(3):
    display.show(Image.HEART)
    sleep(300)
    display.clear()
    sleep(300)

display.scroll("DONE")`,
            desc: '<code>range(3)</code> 은 <code>0, 1, 2</code> 세 개의 수를 만들어 줍니다. <code>i</code> 에 그 값이 차례로 들어가면서 안쪽 블록이 <b>3번</b> 실행됩니다. 반복이 끝나면 <code>DONE</code> 이 흘러갑니다.',
            expect: '하트가 3번 깜빡인 뒤 DONE'
          },
          {
            type: 'code', title: '예제 2-18. 반복 변수 활용 — 밝아지는 LED', code: `from microbit import *

while True:
    # 밝기 0 부터 9 까지 점점 밝게
    for b in range(10):
        display.set_pixel(2, 2, b)
        sleep(80)
    # 9 부터 0 까지 점점 어둡게
    for b in range(9, -1, -1):
        display.set_pixel(2, 2, b)
        sleep(80)`,
            desc: '<code>display.set_pixel(x, y, 밝기)</code> 는 LED 하나의 밝기를 정합니다. 가운데(<code>2, 2</code>) LED 가 숨 쉬듯 밝아졌다 어두워집니다. <code>range(9, -1, -1)</code> 은 <code>9, 8, …, 1, 0</code> 을 만듭니다.',
            expect: '가운데 LED 가 부드럽게 밝아졌다 어두워지기를 반복합니다.'
          },
          {
            type: 'table', head: ['', '<code>for</code>', '<code>while True</code>'], rows: [
              ['언제 쓰나', '횟수가 <b>정해진</b> 반복', '<b>끝없이</b> 반복'],
              ['예', '3번 깜빡이기, 0~9 밝기 올리기', '센서 계속 읽기, 버튼 계속 확인'],
              ['끝나는가', '정해진 횟수 뒤 끝남', '스스로는 끝나지 않음'],
              ['형태', '<code>for i in range(n):</code>', '<code>while True:</code>']
            ]
          },

          { type: 'h', text: 'display.clear() 와 running_time()' },
          {
            type: 'code', title: '예제 2-19. 켜 둔 시간 재기', code: `from microbit import *

display.scroll("START")
while True:
    # running_time() = 프로그램이 시작된 뒤 지난 시간(ms)
    sec = running_time() // 1000
    display.show(str(sec % 10))
    sleep(500)`,
            desc: '<code>running_time()</code> 은 프로그램이 시작된 뒤 흐른 시간을 <b>밀리초</b>로 돌려줍니다. <code>// 1000</code> 으로 초로 바꾸고, <code>% 10</code> 으로 한 자리만 남겨 보여 줍니다. (<code>//</code> 는 몫, <code>%</code> 는 나머지)',
            expect: '0 → 1 → 2 … 9 → 0 처럼 초가 올라갑니다.',
            nondeterministic: true
          },
          { type: 'callout', kind: 'tip', title: 'display.clear() 를 잊지 마세요', html: '<code>display.show()</code> 로 띄운 그림은 <b>계속 남아 있습니다</b>. 다음 그림을 보여 주기 전이나 프로그램이 끝날 때 <code>display.clear()</code> 로 지워 주면 깔끔합니다.' },

          { type: 'h', text: '더 해 보기' },
          {
            type: 'code', title: '더 해 보기 ①. range() 의 세 가지 모양', code: `from microbit import *

print("range(5):", list(range(5)))              # 0 1 2 3 4
print("range(2, 6):", list(range(2, 6)))        # 2 3 4 5
print("range(0, 10, 3):", list(range(0, 10, 3)))# 0 3 6 9
print("range(4, 0, -1):", list(range(4, 0, -1)))# 4 3 2 1

# 0 부터 4 까지 한 칸씩 점 찍기
for x in range(5):
    display.set_pixel(x, 2, 9)
    sleep(200)`,
            desc: '<code>range(끝)</code> · <code>range(시작, 끝)</code> · <code>range(시작, 끝, 간격)</code> 세 가지가 있습니다. <b>끝 값은 포함하지 않습니다.</b> 간격을 음수로 주면 거꾸로 셉니다.',
            expect: 'range(5): [0, 1, 2, 3, 4]\nrange(2, 6): [2, 3, 4, 5]\nrange(0, 10, 3): [0, 3, 6, 9]\nrange(4, 0, -1): [4, 3, 2, 1]'
          },
          {
            type: 'code', title: '더 해 보기 ②. while 로 조건이 맞는 동안만 반복', code: `from microbit import *

n = 5
while n > 0:                   # n 이 0보다 큰 동안 반복
    display.show(n)
    sleep(600)
    n = n - 1                  # ← 이 줄이 없으면 영원히 반복!

display.show(Image.HAPPY)
print("끝")`,
            desc: '<code>while True:</code> 는 “항상 참” 이라 끝없이 반복하지만, <code>while n &gt; 0:</code> 처럼 <b>조건</b>을 주면 조건이 거짓이 되는 순간 반복을 빠져나옵니다. <code>n = n - 1</code> 을 지우면 절대 끝나지 않으니 주의하세요.',
            expect: '5 → 4 → 3 → 2 → 1 이 보인 뒤 웃는 얼굴'
          },
          {
            type: 'code', title: '더 해 보기 ③. 중첩 반복으로 화면 전체 훑기', code: `from microbit import *

# 왼쪽 위부터 오른쪽 아래까지 한 칸씩 차례로 켠다
display.clear()
for y in range(5):             # 세로 5줄
    for x in range(5):         # 가로 5칸
        display.set_pixel(x, y, 9)
        sleep(60)

sleep(500)

# 거꾸로 하나씩 끈다
for y in range(4, -1, -1):
    for x in range(4, -1, -1):
        display.set_pixel(x, y, 0)
        sleep(60)`,
            desc: '반복 안의 반복으로 <b>모든 칸</b>을 훑습니다. 바깥이 5번, 안쪽이 5번이므로 모두 <code>5 × 5 = 25</code>번 실행됩니다. 화면 전체를 다루는 프로그램의 기본 형태입니다.',
            expect: '왼쪽 위부터 차례로 켜졌다가 오른쪽 아래부터 차례로 꺼집니다.'
          },

          { type: 'h', text: '🚀 응용 예제 — 화면과 반복으로 만드는 것들' },
          { type: 'p', html: '2장에서 배운 <b>scroll · show · sleep · 반복</b> 만으로도 쓸 만한 프로그램을 만들 수 있습니다. 코드를 읽고 실행한 뒤, 맨 위의 설정값을 바꿔 가며 내 것으로 만들어 보세요.' },
          {
            type: 'code', title: '응용 예제 2-1. 초 단위 디지털 시계', code: `from microbit import *

display.scroll("CLOCK", delay=60)

while True:
    t = running_time() // 1000          # 켜진 뒤 지난 초
    m = t // 60                          # 분
    s = t % 60                           # 초

    # 분:초 형태로 흘려보낸다 (예: 2:07)
    display.scroll(str(m) + ":" + str(s // 10) + str(s % 10), delay=80)
    sleep(500)`,
            desc: '<code>//</code> 는 몫, <code>%</code> 는 나머지입니다. <code>s // 10</code> 과 <code>s % 10</code> 으로 십의 자리와 일의 자리를 나눠 <b>07</b> 처럼 두 자리로 맞췄습니다.',
            expect: '0:00 → 0:01 → … 형태로 흐릅니다.',
            nondeterministic: true
          },
          {
            type: 'code', title: '응용 예제 2-2. 모스 부호 송신기', code: `from microbit import *

DOT, DASH = 200, 600         # 점 · 선의 길이(ms)
full = Image("99999:99999:99999:99999:99999")

# 보낼 글자와 모스 부호 (점 = ., 선 = -)
CODE = {
    "S": "...", "O": "---", "A": ".-", "B": "-...",
    "H": "....", "E": ".", "L": ".-..", "P": ".--.",
}
MESSAGE = "SOS"              # ← 바꿔 보세요 (위 표에 있는 글자만)


def signal(mark):
    display.show(full)
    sleep(DASH if mark == "-" else DOT)
    display.clear()
    sleep(DOT)


while True:
    for ch in MESSAGE:
        display.show(ch)
        sleep(400)
        display.clear()
        sleep(200)
        for mark in CODE[ch]:
            signal(mark)
        sleep(500)           # 글자 사이 쉼
    sleep(1500)              # 한 바퀴 끝`,
            desc: '<code>for ch in MESSAGE:</code> 는 문자열에서 <b>글자를 하나씩</b> 꺼냅니다. <code>CODE[ch]</code> 로 그 글자의 모스 부호를 찾아 점(짧게)과 선(길게)으로 깜빡입니다. 글자를 먼저 보여 준 뒤 신호를 보내므로 배우기도 좋습니다.',
            expect: 'S → · · · → O → ─ ─ ─ → S → · · · 를 반복합니다.'
          },
          {
            type: 'code', title: '응용 예제 2-3. 로딩 바 · 진행률 표시', code: `from microbit import *

STEPS = 25               # 25칸 = 화면 전체
DELAY = 120

display.scroll("LOAD", delay=60)

while True:
    display.clear()
    for i in range(STEPS):
        x = i % 5
        y = i // 5
        display.set_pixel(x, y, 9)
        sleep(DELAY)

    # 다 찼으면 세 번 깜빡이고 다시
    for i in range(3):
        display.clear()
        sleep(150)
        display.show(Image("99999:99999:99999:99999:99999"))
        sleep(150)
    sleep(500)`,
            desc: '<code>i % 5</code> 가 가로 위치, <code>i // 5</code> 가 세로 위치입니다. 한 개의 숫자로 <b>2차원 좌표</b>를 만드는 자주 쓰는 방법입니다. 오래 걸리는 작업의 진행률을 보여 줄 때 이렇게 씁니다.',
            expect: '왼쪽 위부터 한 칸씩 차올라 화면이 가득 차면 세 번 깜빡입니다.'
          },
          {
            type: 'code', title: '응용 예제 2-4. 메트로놈 (박자 맞추기)', code: `from microbit import *
import music

BPM = 90                 # 1분에 몇 박 (60~180 사이로 바꿔 보세요)
BEATS = 4                # 몇 박자마다 강박

interval = 60000 // BPM  # 한 박의 길이(ms)
beat = 0

display.scroll(str(BPM), delay=70)

while True:
    beat = beat % BEATS + 1

    if beat == 1:
        display.show(Image("99999:99999:99999:99999:99999"))   # 강박
        music.pitch(1200, 60)
    else:
        display.show(Image("00000:00000:00900:00000:00000"))   # 약박
        music.pitch(800, 40)

    sleep(120)
    display.show(beat)
    sleep(interval - 120)`,
            desc: '<code>60000 // BPM</code> 으로 한 박의 길이를 계산합니다. 첫 박만 크게(강박) 표시하고 나머지는 작게(약박) 합니다. 음악 시간에 바로 쓸 수 있습니다.',
            expect: 'BPM 에 맞춰 “딱 · 딱 · 딱 · 딱” 소리와 함께 1 · 2 · 3 · 4 가 표시됩니다.'
          },
          {
            type: 'code', title: '응용 예제 2-5. 한 글자씩 나타나는 타이핑 전광판', code: `from microbit import *

MESSAGE = "HELLO"
CHAR_MS = 500            # 한 글자를 보여 주는 시간
GAP_MS = 120             # 글자 사이 쉼

while True:
    # ① 한 글자씩 또박또박
    for ch in MESSAGE:
        display.show(ch)
        sleep(CHAR_MS)
        display.clear()
        sleep(GAP_MS)

    sleep(600)

    # ② 같은 문장을 흘려서 한 번 더
    display.scroll(MESSAGE, delay=90)
    sleep(800)`,
            desc: '같은 문장을 <b>두 가지 방식</b>으로 보여 줍니다. 짧은 단어는 ① 방식이, 긴 문장은 ② 방식이 읽기 좋습니다. <code>display.show(MESSAGE, delay=500)</code> 한 줄로도 ①과 거의 같은 효과를 낼 수 있습니다 — 비교해 보세요.',
            expect: 'H · E · L · L · O 가 하나씩 나타난 뒤, 같은 글자가 흘러갑니다.'
          },

          { type: 'h', text: '3교시 · 2장 요약' },
          {
            type: 'list', items: [
              '<code>sleep(밀리초)</code> 로 잠깐 멈춥니다. 1초 = <code>sleep(1000)</code>.',
              '<code>while True:</code> — 전원이 있는 동안 <b>끝없이</b> 반복합니다. 안에 짧은 <code>sleep()</code> 을 넣어 줍니다.',
              '<code>for i in range(n):</code> — <b>n번</b> 반복합니다.',
              'micro:bit 프로그램의 기본 뼈대: <b>센서 읽기 → 판단 → 표현 → 잠깐 쉬기 → 반복</b>',
              '<code>display.clear()</code> 로 화면을 지우고, <code>running_time()</code> 으로 흐른 시간을 읽습니다.'
            ]
          }
        ],
        practice: [
          {
            title: '실습 2-6. 비상등 만들기',
            level: 1,
            desc: '<p>화면 전체가 <b>0.5초 켜지고 0.5초 꺼지기</b>를 반복하는 비상등을 만드세요.</p><p>화면 전체를 켜려면 모든 LED 가 켜진 그림이 필요합니다. <code>Image("99999:99999:99999:99999:99999")</code> 를 쓰거나, 더 간단히 <code>Image.SQUARE</code> 를 활용해 보세요.</p>',
            hint: '<code>full = Image("99999:99999:99999:99999:99999")</code> 처럼 변수에 담아 두면 여러 번 쓰기 편합니다.',
            starter: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\nwhile True:\n    # TODO\n    pass\n',
            solution: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\nwhile True:\n    display.show(full)\n    sleep(500)\n    display.clear()\n    sleep(500)\n'
          },
          {
            title: '실습 2-7. 모스 부호 SOS',
            level: 2,
            desc: '<p>국제 조난 신호 <b>SOS</b> 를 LED 로 보내세요. 모스 부호로 <code>S</code> 는 <b>짧게 3번</b>, <code>O</code> 는 <b>길게 3번</b> 입니다.</p><ul><li>짧게 = 0.2초 켜기, 길게 = 0.6초 켜기</li><li>신호 사이는 0.2초 쉬기, 글자 사이는 0.6초 쉬기</li><li>전체를 끝없이 반복 (한 번 끝나면 1.5초 쉬기)</li></ul><p>짧은 신호와 긴 신호를 만드는 부분은 <code>for</code> 반복으로 묶어 보세요.</p>',
            hint: '<code>for i in range(3):</code> 안에 “켜기 → sleep(길이) → 지우기 → sleep(0.2초)” 를 넣으면 세 번 깜빡입니다. 길이만 다르게 두 번 쓰면 S 와 O 가 됩니다.',
            starter: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\nwhile True:\n    # S: 짧게 3번\n    for i in range(3):\n        display.show(full)\n        sleep(200)\n        display.clear()\n        sleep(200)\n    sleep(400)\n\n    # TODO: O (길게 3번)\n\n    # TODO: S (짧게 3번)\n\n    sleep(1500)\n',
            solution: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\n\ndef signal(times, length):\n    for i in range(times):\n        display.show(full)\n        sleep(length)\n        display.clear()\n        sleep(200)\n\n\nwhile True:\n    signal(3, 200)    # S\n    sleep(400)\n    signal(3, 600)    # O\n    sleep(400)\n    signal(3, 200)    # S\n    sleep(1500)\n'
          },
          {
            title: '실습 2-8. 도전! 60초 타이머',
            level: 3,
            desc: '<p>시작하면 <code>60</code> 부터 <code>0</code> 까지 1초에 하나씩 줄어드는 타이머를 만드세요.</p><ul><li>남은 시간을 <code>display.show(str(남은시간))</code> 으로 보여 줍니다. (두 자리 수는 한 글자씩 지나갑니다)</li><li>10초 이하로 남으면 매초 화면을 한 번 깜빡이게 해 보세요.</li><li>0 이 되면 <code>TIME!</code> 을 흘려보내고 <code>Image.SKULL</code> 을 띄웁니다.</li></ul>',
            hint: '<code>for t in range(60, -1, -1):</code> 로 60 부터 0 까지 셀 수 있습니다. 깜빡임은 <code>if t &lt;= 10:</code> 안에서 처리하세요.',
            starter: 'from microbit import *\n\n# TODO: 60 부터 0 까지 세기\n\ndisplay.scroll("TIME!")\ndisplay.show(Image.SKULL)\n',
            solution: 'from microbit import *\n\nfor t in range(60, -1, -1):\n    display.show(str(t))\n    if t <= 10:\n        sleep(700)\n        display.clear()\n        sleep(300)\n    else:\n        sleep(1000)\n\ndisplay.scroll("TIME!")\ndisplay.show(Image.SKULL)\n'
          }
        ],
        quiz: [
          {
            q: '<code>while True:</code> 안에 <code>sleep()</code> 이 전혀 없으면?', options: ['더 정확해진다', 'CPU 가 쉬지 않아 전력을 많이 쓰고 입력이 씹힐 수 있다', '오류가 난다', '자동으로 멈춘다'], answer: 1,
            explain: '반복이 CPU 를 꽉 채워 돌기 때문에 전력 소모가 크고, 실제 보드에서는 버튼 입력을 놓칠 수 있습니다. 짧은 <code>sleep()</code> 을 넣어 주세요.'
          },
          {
            q: '<code>for i in range(5):</code> 는 몇 번 반복하나요?', options: ['4번', '5번', '6번', '무한'], answer: 1,
            explain: '<code>range(5)</code> 는 <code>0, 1, 2, 3, 4</code> 다섯 개를 만듭니다. 그래서 <b>5번</b> 반복합니다.'
          },
          {
            q: '<code>display.show()</code> 로 띄운 그림을 지우려면?', options: ['<code>display.off()</code>', '<code>display.clear()</code>', '<code>display.reset()</code>', '저절로 사라진다'], answer: 1,
            explain: '<code>display.clear()</code> 가 모든 LED 를 끕니다. <code>display.off()</code> 는 화면 기능 자체를 꺼서 핀을 다른 용도로 쓸 때 씁니다.'
          },
          {
            q: '<code>running_time()</code> 이 돌려주는 값은?', options: ['현재 시각(시:분:초)', '프로그램이 시작된 뒤 지난 밀리초', '남은 배터리', 'CPU 온도'], answer: 1,
            explain: '프로그램이 시작(전원 켜짐)된 뒤 흐른 시간을 <b>밀리초</b>로 돌려줍니다. 1000 으로 나누면 초가 됩니다.'
          },
          {
            q: '다음 코드는 하트를 몇 번 보여 주나요?<pre><code>for i in range(3):\n    for j in range(2):\n        display.show(Image.HEART)\n        sleep(100)</code></pre>', options: ['2번', '3번', '5번', '6번'], answer: 3,
            explain: '바깥이 3번, 그 안에서 2번씩이므로 <b>3 × 2 = 6번</b> 입니다. 이런 것을 <b>중첩 반복</b>이라고 합니다.'
          }
        ],
        slides: [
          {
            layout: 'title', title: 'sleep 과 반복', subtitle: 'Chapter 02 · 살아 움직이는 프로그램', badge: '3교시',
            notes: '<p>이 시간이 끝나면 학생들이 "움직이는" 프로그램을 만들 수 있게 됩니다.</p><p>시간: 1분</p>'
          },
          {
            layout: 'code', title: 'sleep 이 없으면?', code: 'from microbit import *\n\ndisplay.show(Image.HEART)\ndisplay.show(Image.HAPPY)\ndisplay.show(Image.SAD)',
            points: ['CPU 는 1초에 수천만 번 명령 처리', '너무 빨라 마지막 것만 보임', '사람이 보려면 <code>sleep()</code> 필요', '단위는 <b>밀리초</b>'],
            notes: '<p>먼저 실행해서 "왜 슬픈 얼굴만 보일까?" 하고 물어본 뒤 sleep 을 넣어 다시 실행합니다.</p><p>시간: 6분</p>'
          },
          {
            layout: 'diagram', title: 'while True: 의 흐름', html: `<svg viewBox="0 0 1000 300" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs><marker id="s2b" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="var(--accent)"/></marker></defs>
  <rect x="60" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="160" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">큰 하트 보이기</text>
  <line x1="260" y1="60" x2="330" y2="60" stroke="var(--accent)" stroke-width="4" marker-end="url(#s2b)"/>
  <rect x="340" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="440" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">0.2초 기다리기</text>
  <line x1="540" y1="60" x2="610" y2="60" stroke="var(--accent)" stroke-width="4" marker-end="url(#s2b)"/>
  <rect x="620" y="30" width="200" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>
  <text x="720" y="68" text-anchor="middle" font-size="20" fill="var(--fg)">작은 하트 보이기</text>
  <path d="M820 60 L880 60 L880 170 L160 170 L160 110" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#s2b)" stroke-dasharray="8 6"/>
  <text x="520" y="200" text-anchor="middle" font-size="21" font-weight="bold" fill="var(--accent)">다시 처음으로 (끝없이)</text>
</svg>`, caption: '전원이 있는 한 계속 돕니다',
            notes: '<p>"micro:bit 프로그램은 끝나지 않는 것이 정상"이라는 점을 강조합니다.</p><p>시간: 5분</p>'
          },
          {
            layout: 'code', title: '심장 박동', code: 'from microbit import *\n\nwhile True:\n    display.show(Image.HEART)\n    sleep(200)\n    display.show(Image.HEART_SMALL)\n    sleep(200)',
            points: ['<code>True</code> 는 항상 참 → 끝없이 반복', '들여쓴 부분만 반복', '■ 정지로 멈추기', '<code>sleep</code> 값을 바꿔 박동 속도 조절'],
            notes: '<p>sleep 값을 100, 500 등으로 바꿔 보게 합니다.</p><p>시간: 7분</p>'
          },
          {
            layout: 'code', title: '센서를 계속 읽는 기본 뼈대', code: 'from microbit import *\n\nwhile True:\n    t = temperature()\n    display.show(str(t))\n    sleep(1000)',
            points: ['① 센서 읽기 → ② 표현 → ③ 쉬기 → ④ 반복', 'micro:bit 프로그램의 <b>가장 흔한 모습</b>', '🧭 센서 탭에서 값 바꿔 보기', '<code>str()</code> 로 숫자를 글자로'],
            notes: '<p>실행 후 센서 탭의 온도 슬라이더를 움직여 보여 줍니다. 앞으로 거의 모든 프로그램이 이 모양입니다.</p><p>시간: 7분</p>'
          },
          {
            layout: 'table', title: 'for vs while True', head: ['', 'for', 'while True'], rows: [
              ['언제', '횟수가 정해짐', '끝없이'],
              ['예', '3번 깜빡이기', '센서 계속 읽기'],
              ['끝', '정해진 횟수 뒤', '스스로 끝나지 않음'],
              ['형태', '<code>for i in range(n):</code>', '<code>while True:</code>']],
            notes: '<p>"몇 번인지 알면 for, 모르면 while" 로 기억하게 합니다.</p><p>시간: 5분</p>'
          },
          {
            layout: 'code', title: '반복 변수 활용 — 숨 쉬는 LED', code: 'from microbit import *\n\nwhile True:\n    for b in range(10):\n        display.set_pixel(2, 2, b)\n        sleep(80)\n    for b in range(9, -1, -1):\n        display.set_pixel(2, 2, b)\n        sleep(80)',
            points: ['<code>set_pixel(x, y, 밝기)</code>', '밝기 0(꺼짐) ~ 9(가장 밝음)', '<code>range(9, -1, -1)</code> = 9 → 0', '반복 변수 <code>b</code> 를 값으로 사용'],
            notes: '<p>실행하면 반응이 좋은 예제입니다. 가운데가 아니라 다른 좌표로 바꿔 보게 하세요.</p><p>시간: 6분</p>'
          },
          {
            layout: 'practice', title: '실습 2-7. 모스 부호 SOS', desc: 'S(짧게 3번) · O(길게 3번) · S 를 반복하세요.',
            starter: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\nwhile True:\n    for i in range(3):\n        display.show(full)\n        sleep(200)\n        display.clear()\n        sleep(200)\n    sleep(400)\n    # TODO: O, S\n    sleep(1500)\n',
            solution: 'from microbit import *\n\nfull = Image("99999:99999:99999:99999:99999")\n\n\ndef signal(times, length):\n    for i in range(times):\n        display.show(full)\n        sleep(length)\n        display.clear()\n        sleep(200)\n\n\nwhile True:\n    signal(3, 200)\n    sleep(400)\n    signal(3, 600)\n    sleep(400)\n    signal(3, 200)\n    sleep(1500)\n',
            notes: '<p>반복되는 부분을 함수로 묶는 정답 코드를 보여 주면 "같은 코드를 세 번 쓰지 않아도 된다"는 감각이 생깁니다.</p><p>시간: 8분</p>'
          },
          {
            layout: 'summary', title: '2장 정리', bullets: ['<code>display.scroll</code> / <code>show</code> / <code>clear</code>', '주석 <code>#</code> · 들여쓰기 공백 4칸', '오류는 마지막 줄부터 읽기', '<code>sleep(밀리초)</code> — 1초 = 1000', '<code>while True:</code> 끝없이 / <code>for</code> 정해진 횟수'],
            notes: '<p>2장 전체 정리. 다음 장 예고: 이미지 — LED 화면에 그림 그리기.</p><p>과제: 실습 2-8 타이머 도전.</p><p>시간: 3분</p>'
          }
        ]
      }
    ]
  });
})();
