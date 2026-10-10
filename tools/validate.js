#!/usr/bin/env node
/* 레슨 검사 도구 (lectureBuilder hw-lab 엔진용)
 *
 *   node tools/validate.js ch03            # 구조 검사 + 모든 MicroPython 코드 문법 검사(로컬 파이썬)
 *   node tools/validate.js all             # js/course.js 의 order 에 있는 모든 차시
 *   node tools/validate.js ch03 --no-run   # 구조만 (파이썬 없이)
 *
 * 브라우저와 같은 순서(js/fig.js → js/course.js → lessons/<id>.js)로 불러와
 * 엔진(js/app.js · js/slides.js)이 실제로 읽는 필드를 확인합니다.
 * 코드는 실행하지 않습니다 — micro:bit 시뮬레이터는 브라우저에서만 동작하므로
 * 동작 확인은 사이트에서 ▶ 실행으로 합니다. 문법 검사는 Python 3 의 compile() 을 씁니다.
 * 종료 코드: 오류가 있으면 1, 경고만 있으면 0.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const ri = args.indexOf('--root');
const ROOT = ri >= 0 ? path.resolve(args[ri + 1]) : path.resolve(__dirname, '..');
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');
const noRun = flag('--no-run');
if (!target) {
  console.error('사용법: node tools/validate.js <차시id | all> [--no-run]');
  process.exit(2);
}

const BLOCKS = { h: ['text'], p: ['html'], list: ['items'], table: ['head', 'rows'], code: ['code'], callout: ['kind', 'html'], figure: ['html'] };
const CALLOUTS = ['tip', 'warn', 'info', 'more', 'board'];
const LAYOUTS = {
  title: ['title'], goals: ['goals'], bullets: ['title', 'bullets'], summary: ['title', 'bullets'], code: ['title', 'code'],
  two: ['title', 'left', 'right'], table: ['title', 'head', 'rows'], diagram: ['title', 'html'],
  quiz: ['q', 'options', 'answer'], practice: ['title', 'desc', 'starter'],
};

function load() {
  const ctx = { console, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.self = ctx;
  ctx.document = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } };
  ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['js/fig.js', 'js/course.js']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  if (!ctx.MB_COURSE) throw new Error('js/course.js 에서 MB_COURSE 를 찾지 못했습니다');
  return ctx;
}

function checkChapter(id, ctx) {
  const errors = [], warns = [], snippets = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  const C = ctx.MB_COURSE;
  const file = path.join(ROOT, 'lessons', id + '.js');
  if (!fs.existsSync(file)) return { errors: [`lessons/${id}.js 없음`], warns, snippets, stats: '' };

  const src = fs.readFileSync(file, 'utf8');
  const calls = [];
  const orig = C.addChapter;
  C.addChapter = function (ch) { calls.push(ch); return orig.call(this, ch); };
  try { vm.runInContext(src, ctx, { filename: `lessons/${id}.js` }); } catch (e) {
    C.addChapter = orig;
    return { errors: [`스크립트 오류: ${e.message}`], warns, snippets, stats: '' };
  }
  C.addChapter = orig;
  if (calls.length !== 1) E(`MB_COURSE.addChapter 호출 ${calls.length}번 (정확히 1번이어야 함)`);
  const ch = calls[0];
  if (!ch) return { errors, warns, snippets, stats: '' };

  const o = (C.order || []).find((x) => x.id === ch.id);
  if (ch.id !== id) E(`chapter id '${ch.id}' ≠ 파일 이름 '${id}'`);
  if (!o) W(`js/course.js 의 order 에 '${ch.id}' 가 없습니다 (목차에 나오지 않음)`);
  else if (o.title !== ch.title) W(`제목이 course.js order 와 다름: '${ch.title}' ≠ '${o.title}'`);
  for (const k of ['no', 'title', 'summary']) if (!ch[k]) E(`chapter.${k} 없음`);
  if (!Array.isArray(ch.goals) || !ch.goals.length) W('chapter.goals 없음');
  if (!Array.isArray(ch.sections) || !ch.sections.length) { E('sections 가 비어 있음'); return { errors, warns, snippets, stats: '' }; }

  const secIds = new Set();
  let nCode = 0, nSlides = 0, nQuiz = 0, nPractice = 0;
  ch.sections.forEach((s, si) => {
    const at = `[${s.id || '교시 ' + (si + 1)}]`;
    if (!s.id) E(`${at} id 없음`);
    else {
      if (secIds.has(s.id)) E(`${at} section id 중복`);
      secIds.add(s.id);
      if (!new RegExp('^' + ch.id + '-\\d+$').test(s.id)) W(`${at} section id 는 '${ch.id}-번호' 형식 권장`);
    }
    if (!s.title) E(`${at} title 없음`);
    if (typeof s.minutes !== 'number') W(`${at} minutes 없음 (기본 50분으로 표시)`);
    if (!Array.isArray(s.goals) || !s.goals.length) W(`${at} goals 없음`);
    if (Array.isArray(s.flow) && s.flow.length) {
      const bad = s.flow.find((f) => !Array.isArray(f) || typeof f[0] !== 'string' || typeof f[1] !== 'number');
      if (bad) E(`${at} flow 는 [['단계', 분], ...] 형식`);
      else {
        const sum = s.flow.reduce((a, f) => a + f[1], 0);
        if (typeof s.minutes === 'number' && sum !== s.minutes) W(`${at} flow 합계 ${sum}분 ≠ minutes ${s.minutes}`);
      }
    }
    if (!Array.isArray(s.content)) { E(`${at} content 배열 없음`); return; }

    // 본문 블록
    s.content.forEach((b, bi) => {
      const bat = `${at} content[${bi}]`;
      if (!b || !BLOCKS[b.type]) { E(`${bat} 알 수 없는 type '${b && b.type}' (h · p · list · table · code · callout · figure)`); return; }
      for (const k of BLOCKS[b.type]) if (b[k] == null || b[k] === '') E(`${bat} ${b.type}.${k} 없음`);
      if (b.type === 'list' && !Array.isArray(b.items)) E(`${bat} list.items 는 배열`);
      if (b.type === 'table') checkTable(b, bat, E);
      if (b.type === 'callout' && !CALLOUTS.includes(b.kind)) E(`${bat} callout.kind '${b.kind}' (tip · warn · info · more · board)`);
      if (b.type === 'code') {
        nCode++;
        codeCheck(b.code, bat, E, W);
        if (!b.title) W(`${bat} code.title 없음 ('예제 N-M. …')`);
        if (b.run !== false && !b.expectError) snippets.push({ at: `${bat} ${b.title || ''}`, code: b.code, repl: !!b.repl });
      }
    });

    // 실습
    (s.practice || []).forEach((p, pi) => {
      const pat = `${at} practice[${pi}]`;
      nPractice++;
      for (const k of ['title', 'desc']) if (!p[k]) E(`${pat} ${k} 없음`);
      if (typeof p.starter !== 'string') E(`${pat} starter(문자열) 없음`);
      if (!p.solution) W(`${pat} solution 없음 (교사용 정답 코드)`);
      if (p.level != null && ![1, 2, 3].includes(p.level)) E(`${pat} level 은 1~3`);
      if (p.starter) { codeCheck(p.starter, pat, E, W); snippets.push({ at: `${pat} starter`, code: p.starter, soft: true }); }
      if (p.solution) { codeCheck(p.solution, pat, E, W); snippets.push({ at: `${pat} solution`, code: p.solution }); }
    });

    // 퀴즈
    (s.quiz || []).forEach((q, qi) => { nQuiz++; checkQuiz(q, `${at} quiz[${qi}]`, E, W); });

    // 슬라이드
    const sl = s.slides || [];
    if (!sl.length) W(`${at} slides 없음 (교사용 화면에 제목 · 학습 목표만 나옴)`);
    sl.forEach((x, xi) => {
      const xat = `${at} slides[${xi}]`;
      nSlides++;
      if (!LAYOUTS[x.layout]) { E(`${xat} 알 수 없는 layout '${x.layout}'`); return; }
      for (const k of LAYOUTS[x.layout]) if (x[k] == null || x[k] === '') E(`${xat} ${x.layout}.${k} 없음`);
      if (!x.notes) W(`${xat} notes(교사 노트) 없음`);
      if (x.layout === 'code') {
        codeCheck(x.code, xat, E, W);
        if (String(x.code || '').split('\n').length > 18) W(`${xat} 코드 ${String(x.code).split('\n').length}줄 (슬라이드는 18줄 이하 권장)`);
        snippets.push({ at: `${xat} ${x.title || ''}`, code: x.code, repl: !!x.repl });
      }
      if (x.layout === 'practice') {
        if (x.starter) snippets.push({ at: `${xat} starter`, code: x.starter, soft: true });
        if (x.solution) snippets.push({ at: `${xat} solution`, code: x.solution });
      }
      if (x.layout === 'two') {
        for (const side of ['left', 'right']) {
          const c = x[side];
          if (c && typeof c !== 'object') E(`${xat} ${side} 는 {title, bullets | html | code} 객체`);
          if (c && c.code && c.run !== false) snippets.push({ at: `${xat} ${side}`, code: c.code, repl: !!c.repl });
        }
      }
      if (x.layout === 'table') checkTable(x, xat, E);
      if (x.layout === 'quiz') checkQuiz(x, xat, E, W);
      if ((x.layout === 'bullets' || x.layout === 'summary') && !Array.isArray(x.bullets)) E(`${xat} bullets 는 배열`);
    });
    if (sl.length && sl[0].layout !== 'title') W(`${at} 첫 슬라이드는 layout 'title' 권장 (없으면 자동으로 추가됨)`);
    if (sl.length && sl[sl.length - 1].layout !== 'summary') W(`${at} 마지막 슬라이드는 layout 'summary' 권장`);

    // 한 교시 문서 안의 SVG id 중복 (marker 등이 엉뚱하게 연결됨)
    const html = JSON.stringify(s.content);
    const ids = {};
    for (const m of html.matchAll(/\bid=\\"([^"\\]+)\\"/g)) ids[m[1]] = (ids[m[1]] || 0) + 1;
    const dup = Object.keys(ids).filter((k) => ids[k] > 1);
    if (dup.length) W(`${at} 본문 SVG id 중복: ${dup.slice(0, 5).join(', ')}`);
  });

  const stats = `교시 ${ch.sections.length} · 예제 ${nCode} · 실습 ${nPractice} · 퀴즈 ${nQuiz} · 슬라이드 ${nSlides}`;
  return { errors, warns, snippets, stats };
}

function checkTable(b, at, E) {
  if (!Array.isArray(b.head) || !Array.isArray(b.rows)) { E(`${at} table 의 head · rows 는 배열`); return; }
  b.rows.forEach((r, i) => {
    if (!Array.isArray(r)) E(`${at} rows[${i}] 는 배열`);
    else if (r.length !== b.head.length) E(`${at} rows[${i}] 칸 수 ${r.length} ≠ head ${b.head.length}`);
  });
}

function checkQuiz(q, at, E, W) {
  if (!q.q) E(`${at} q(질문) 없음`);
  if (!Array.isArray(q.options) || q.options.length < 2) { E(`${at} options 는 2개 이상인 배열`); return; }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) E(`${at} answer 는 0 ~ ${q.options.length - 1} 정수 (0부터)`);
  if (!q.explain) W(`${at} explain(해설) 없음`);
}

function codeCheck(code, at, E, W) {
  if (typeof code !== 'string' || !code.trim()) { E(`${at} 코드가 비어 있음`); return; }
  if (/\t/.test(code)) W(`${at} 코드에 탭 문자 (공백 4칸 권장)`);
  if (/[“”‘’]/.test(code.replace(/#.*$/gm, '').replace(/(['"])(?:\\.|(?!\1).)*\1/g, ''))) W(`${at} 코드에 한글 따옴표(“ ” ‘ ’)`);
}

/* 로컬 Python 3 로 문법만 검사 (실행하지 않음) */
function findPython() {
  for (const c of [['python'], ['python3'], ['py', '-3']]) {
    const r = spawnSync(c[0], c.slice(1).concat(['-c', 'import sys; print(sys.version_info[0])']), { encoding: 'utf8' });
    if (r.status === 0 && /3/.test(r.stdout)) return c;
  }
  return null;
}

const PY_CHECK = `
import sys, json, ast
items = json.loads(sys.stdin.buffer.read().decode('utf-8'))
out = []
for i, it in enumerate(items):
    src = it['code']
    try:
        compile(src, '<code>', 'exec', flags=ast.PyCF_ONLY_AST)
    except SyntaxError as e:
        ok = False
        if it.get('repl'):
            # 셸 예제: 한 줄씩 입력되므로 줄 단위로 다시 확인
            ok = True
            buf = []
            for line in src.split('\\n') + ['']:
                if line.strip() == '' and buf:
                    try: compile('\\n'.join(buf) + '\\n', '<repl>', 'exec', flags=ast.PyCF_ONLY_AST)
                    except SyntaxError: ok = False
                    buf = []
                elif line.strip():
                    if buf or line.rstrip().endswith(':'): buf.append(line)
                    else:
                        try: compile(line, '<repl>', 'exec', flags=ast.PyCF_ONLY_AST)
                        except SyntaxError: ok = False
        if not ok:
            out.append([i, '%s (줄 %s)' % (e.msg, e.lineno)])
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;

function syntaxCheck(snippets, py) {
  const env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });
  const r = spawnSync(py[0], py.slice(1).concat(['-c', PY_CHECK]), { input: JSON.stringify(snippets), encoding: 'utf8', env, maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error('파이썬 문법 검사 실패: ' + (r.stderr || '').trim().split('\n').slice(-2).join(' '));
  const res = { errors: [], warns: [] };
  for (const [i, msg] of JSON.parse(r.stdout || '[]')) {
    // 실습 시작 코드는 '오류 고치기' 과제처럼 일부러 틀릴 수 있으므로 경고
    if (snippets[i].soft) res.warns.push(`${snippets[i].at} — 문법 오류(시작 코드라 경고): ${msg}`);
    else res.errors.push(`${snippets[i].at} — 문법 오류: ${msg}`);
  }
  return res;
}

// ---------------------------------------------------------------- 실행
let ctx;
try { ctx = load(); } catch (e) { console.error('✖ ' + e.message); process.exit(1); }
const ids = target === 'all' ? ctx.MB_COURSE.order.map((o) => o.id).filter((i) => fs.existsSync(path.join(ROOT, 'lessons', i + '.js'))) : [target];
let py = null;
if (!noRun) {
  py = findPython();
  if (!py) console.log('⚠ 로컬 Python 3 가 없어 문법 검사를 건너뜁니다 (구조만 검사)');
}

let totalE = 0, totalW = 0;
for (const id of ids) {
  const r = checkChapter(id, ctx);
  if (py && r.snippets.length) {
    try { const s = syntaxCheck(r.snippets, py); r.errors.push(...s.errors); r.warns.push(...s.warns); } catch (e) { r.warns.push(e.message); }
  }
  totalE += r.errors.length; totalW += r.warns.length;
  console.log(`${r.errors.length ? '✖' : '✔'} ${id}  ${r.stats}${py ? ` · 코드 ${r.snippets.length}개 문법 검사` : ''}`);
  r.errors.forEach((m) => console.log('  오류  ' + m));
  r.warns.forEach((m) => console.log('  경고  ' + m));
}
console.log(`\n오류 ${totalE} · 경고 ${totalW}${noRun ? ' (구조만 검사)' : ''}`);
process.exit(totalE ? 1 : 0);
