/* MicroPython 시뮬레이터 공통 런타임 (Pyodide 위에서 동작)
 * - _mbrt      : 사용자 코드를 비동기 코루틴으로 바꿔 브라우저를 멈추지 않고 실행한다
 * - time_patch : 표준 time 모듈에 MicroPython 확장(ticks_ms 등)을 붙인다
 * - micropython: micropython 모듈(const 등)
 */
'use strict';

// micro:bit 문자 폰트 (ASCII 0x20~0x7E, 열 단위, LSB = 위쪽)
const FONT5x7_HEX =
  '0000000000' + '00005f0000' + '0007000700' + '147f147f14' + '242a7f2a12' + '2313086462' + '3649552250' + '0005030000' +
  '001c224100' + '0041221c00' + '082a1c2a08' + '08083e0808' + '0050300000' + '0808080808' + '0060600000' + '2010080402' +
  '3e5149453e' + '00427f4000' + '4261514946' + '2141454b31' + '1814127f10' + '2745454539' + '3c4a494930' + '0171090503' +
  '3649494936' + '064949291e' + '0036360000' + '0056360000' + '0008142241' + '1414141414' + '4122140800' + '0201510906' +
  '3249794141' + '7e1111117e' + '7f49494936' + '3e41414122' + '7f4141221c' + '7f49494941' + '7f09090101' + '3e41415132' +
  '7f0808087f' + '00417f4100' + '2040413f01' + '7f08142241' + '7f40404040' + '7f0204027f' + '7f0408107f' + '3e4141413e' +
  '7f09090906' + '3e4151215e' + '7f09192946' + '4649494931' + '01017f0101' + '3f4040403f' + '1f2040201f' + '7f2018207f' +
  '6314081463' + '0304780403' + '6151494543' + '00007f4141' + '0204081020' + '41417f0000' + '0402010204' + '4040404040' +
  '0001020400' + '2054545478' + '7f48444438' + '3844444420' + '384444487f' + '3854545418' + '087e090102' + '081454543c' +
  '7f08040478' + '00447d4000' + '2040443d00' + '007f102844' + '00417f4000' + '7c04180478' + '7c08040478' + '3844444438' +
  '7c14141408' + '081414187c' + '7c08040408' + '4854545420' + '043f444020' + '3c4040207c' + '1c2040201c' + '3c4030403c' +
  '4428102844' + '0c5050503c' + '4464544c44' + '0008364100' + '00007f0000' + '0041360800' + '0201020402';
const FONT5x7 = (() => { const a = []; for (let i = 0; i < FONT5x7_HEX.length; i += 2) a.push(parseInt(FONT5x7_HEX.substr(i, 2), 16)); return a; })();

const PY_LIB = {};

PY_LIB._mbrt = String.raw`# 강좌 런타임: 사용자 코드를 비동기로 바꿔 브라우저에서 실행한다
import ast, sys, asyncio, traceback, linecache
import mbhw

_last = [0.0]
_sync = [0]


def _check():
    if mbhw.is_stopped():
        raise KeyboardInterrupt()


def __mb_ny():
    _check()
    return _sync[0] == 0 and mbhw.now_ms() - _last[0] > 25


async def __mb_yield():
    await asyncio.sleep(0)
    _last[0] = mbhw.now_ms()


def busy_wait(sec):
    end = mbhw.now_ms() + sec * 1000
    n = 0
    while mbhw.now_ms() < end:
        n += 1
        if n & 255 == 0:
            _check()


async def __mb_sleep(kind, v):
    s = v if kind == 'sleep' else (v / 1000 if kind == 'sleep_ms' else v / 1e6)
    _check()
    if s <= 0:
        if __mb_ny():
            await __mb_yield()
        return
    if s < 0.003 or _sync[0]:
        busy_wait(s)
        return
    end = mbhw.now_ms() + s * 1000
    while True:
        rem = end - mbhw.now_ms()
        if rem <= 0:
            break
        await asyncio.sleep(min(rem, 40) / 1000)
        _check()
    _last[0] = mbhw.now_ms()


async def asleep_ms(ms):
    await __mb_sleep('sleep_ms', ms)


async def __mb_aw(x):
    if asyncio.iscoroutine(x):
        return await x
    return x


def __mb_sync(x):
    if not asyncio.iscoroutine(x):
        return x
    _sync[0] += 1
    try:
        x.send(None)
    except StopIteration as e:
        return e.value
    finally:
        _sync[0] -= 1
    x.close()
    raise RuntimeError('이 위치(동기 함수나 람다 안)에서는 기다리는 동작을 쓸 수 없습니다')


_HIDE = ('_mbrt.py', 'mbcompat.py')


def report():
    et, ev, tb = sys.exc_info()
    out = ['Traceback (most recent call last):']
    for fs in traceback.extract_tb(tb):
        fn = fs.filename
        if fn in ('main.py', '<stdin>') or (fn.startswith('/mblib/') and not fn.endswith(_HIDE)):
            out.append('  File "%s", line %d, in %s' % (fn.replace('/mblib/', ''), fs.lineno, fs.name))
            if fs.line:
                out.append('    ' + fs.line.strip())
    out.append('%s: %s' % (et.__name__, ev) if str(ev) else et.__name__)
    print('\n'.join(out), file=sys.stderr)


async def _guard(c):
    try:
        await c
    except KeyboardInterrupt:
        pass
    except asyncio.CancelledError:
        pass
    except Exception:
        report()


def spawn(fn, args=()):
    try:
        r = fn(*args)
        if asyncio.iscoroutine(r):
            asyncio.ensure_future(_guard(r))
    except Exception:
        report()


def _tasks():
    try:
        cur = asyncio.current_task()
    except RuntimeError:
        cur = None
    try:
        return [t for t in asyncio.all_tasks() if t is not cur and not t.done()]
    except RuntimeError:
        return []


def pending():
    """main.py 가 끝난 뒤에도 남아 있는 백그라운드 작업(애니메이션 · 음악) 수"""
    return len(_tasks())


def cancel_all():
    for t in _tasks():
        t.cancel()


SLEEPS = ('sleep', 'sleep_ms', 'sleep_us')


def _has_yield(fn):
    for node in ast.walk(fn):
        if isinstance(node, (ast.Yield, ast.YieldFrom)):
            return True
    return False


class _Collect(ast.NodeVisitor):
    """사용자 코드에서 '기다릴 수 있는' 이름들을 모은다"""

    def __init__(self):
        self.funcs = set()
        self.time_mods = set()
        self.sleep_names = set()
        self.asyncio_names = set()
        self.mb_mods = set()
        self.music_mods = set()
        self.speech_mods = set()
        self.audio_mods = set()

    def visit_FunctionDef(self, node):
        if not node.name.startswith('__') and not _has_yield(node):
            self.funcs.add(node.name)
        self.generic_visit(node)

    def visit_Import(self, node):
        for a in node.names:
            n, asn = a.name, (a.asname or a.name)
            if n in ('time', 'utime'):
                self.time_mods.add(asn)
            if n in ('asyncio', 'uasyncio'):
                self.asyncio_names.add(asn)
            if n == 'microbit':
                self.mb_mods.add(asn)
            if n == 'music':
                self.music_mods.add(asn)
            if n == 'speech':
                self.speech_mods.add(asn)
            if n == 'audio':
                self.audio_mods.add(asn)

    def visit_ImportFrom(self, node):
        if node.module in ('time', 'utime'):
            for a in node.names:
                if a.name in SLEEPS:
                    self.sleep_names.add((a.asname or a.name, a.name))
        if node.module == 'microbit':
            for a in node.names:
                if a.name in ('*', 'sleep'):
                    self.sleep_names.add((a.asname or 'sleep', 'sleep_ms'))
                if a.name in ('*', 'audio'):
                    self.audio_mods.add('audio')


class _Tx(ast.NodeTransformer):
    """sleep / 애니메이션 호출을 await 로 바꾸고, 반복문에 양보 지점을 심는다"""

    def __init__(self, col):
        self.c = col
        self.ctx = ['async']
        self.sleep_map = dict(col.sleep_names)

    def _async(self):
        return self.ctx[-1] == 'async'

    def visit_FunctionDef(self, node):
        if node.name in self.c.funcs:
            self.ctx.append('async')
            self.generic_visit(node)
            self.ctx.pop()
            fields = {f: getattr(node, f) for f in node._fields}
            new = ast.AsyncFunctionDef(**fields)
            return ast.copy_location(new, node)
        self.ctx.append('sync')
        self.generic_visit(node)
        self.ctx.pop()
        return node

    def visit_AsyncFunctionDef(self, node):
        self.ctx.append('async')
        self.generic_visit(node)
        self.ctx.pop()
        return node

    def visit_Lambda(self, node):
        self.ctx.append('sync')
        self.generic_visit(node)
        self.ctx.pop()
        return node

    def visit_ClassDef(self, node):
        self.ctx.append('sync')
        self.generic_visit(node)
        self.ctx.pop()
        return node

    def _gen_comp(self, node):
        self.ctx.append('sync')
        self.generic_visit(node)
        self.ctx.pop()
        return node

    visit_GeneratorExp = _gen_comp

    def visit_Import(self, node):
        for a in node.names:
            if a.name == 'uasyncio':
                a.name = 'asyncio'
        return node

    def visit_ImportFrom(self, node):
        if node.module == 'uasyncio':
            node.module = 'asyncio'
        return node

    def visit_Await(self, node):
        if isinstance(node.value, ast.Call):
            call = node.value
            call.func = self.visit(call.func)
            call.args = [self.visit(a) for a in call.args]
            for kw in call.keywords:
                kw.value = self.visit(kw.value)
            return node
        self.generic_visit(node)
        return node

    def _sleep_kind(self, f):
        if isinstance(f, ast.Attribute) and f.attr in SLEEPS and isinstance(f.value, ast.Name) and f.value.id in self.c.time_mods:
            return f.attr
        if isinstance(f, ast.Name) and f.id in self.sleep_map:
            return self.sleep_map[f.id]
        if isinstance(f, ast.Attribute) and f.attr == 'sleep' and isinstance(f.value, ast.Name) and f.value.id in self.c.mb_mods:
            return 'sleep_ms'
        return None

    def _blocking(self, f):
        # 끝날 때까지 기다리는 micro:bit 함수들 (코루틴을 돌려준다)
        if not isinstance(f, ast.Attribute):
            return False
        v = f.value
        name = v.id if isinstance(v, ast.Name) else (v.attr if isinstance(v, ast.Attribute) else '')
        if f.attr in ('show', 'scroll') and name == 'display':
            return True
        if f.attr in ('play', 'pitch') and (name in self.c.music_mods or name == 'music'):
            return True
        if f.attr == 'play' and (name in self.c.audio_mods or name == 'audio'):
            return True
        if f.attr in ('say', 'pronounce', 'sing') and (name in self.c.speech_mods or name == 'speech'):
            return True
        return False

    def visit_Call(self, node):
        self.generic_visit(node)
        f = node.func
        if not self._async():
            if (isinstance(f, ast.Name) and f.id in self.c.funcs) or (isinstance(f, ast.Attribute) and f.attr in self.c.funcs) or self._blocking(f):
                return ast.copy_location(ast.Call(func=ast.Name('__mb_sync', ast.Load()), args=[node], keywords=[]), node)
            return node
        if isinstance(f, ast.Attribute) and f.attr == 'run' and isinstance(f.value, ast.Name) and f.value.id in self.c.asyncio_names and node.args:
            return ast.copy_location(ast.Await(value=node.args[0]), node)
        k = self._sleep_kind(f)
        if k and node.args:
            call = ast.Call(func=ast.Name('__mb_sleep', ast.Load()), args=[ast.Constant(k), node.args[0]], keywords=[])
            return ast.copy_location(ast.Await(value=call), node)
        if (isinstance(f, ast.Name) and f.id in self.c.funcs) or (isinstance(f, ast.Attribute) and f.attr in self.c.funcs) or self._blocking(f):
            call = ast.Call(func=ast.Name('__mb_aw', ast.Load()), args=[node], keywords=[])
            return ast.copy_location(ast.Await(value=call), node)
        return node

    def _loop(self, node):
        self.generic_visit(node)
        if self._async():
            chk = ast.parse('if __mb_ny():\n    await __mb_yield()').body[0]
        else:
            chk = ast.parse('__mb_chk()').body[0]
        for n in ast.walk(chk):
            ast.copy_location(n, node)
        node.body.insert(0, chk)
        return node

    visit_While = _loop
    visit_For = _loop
    visit_AsyncFor = _loop


def transform(src, name='main.py', interactive=False):
    tree = ast.parse(src, name)
    col = _Collect()
    col.visit(tree)
    tree = _Tx(col).visit(tree)
    ast.fix_missing_locations(tree)
    # 대화형 모드에서는 'single' 로 컴파일해야 값이 자동으로 출력된다
    if interactive:
        return compile(ast.Interactive(body=tree.body), name, 'single', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    return compile(tree, name, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)


def _purge():
    for k in list(sys.modules):
        m = sys.modules.get(k)
        f = getattr(m, '__file__', '') or ''
        if f.startswith('/mblib/') and k not in ('_mbrt', 'time_patch'):
            del sys.modules[k]


def globals_dict():
    return {'__name__': '__main__', '__mb_sleep': __mb_sleep, '__mb_aw': __mb_aw, '__mb_sync': __mb_sync,
            '__mb_ny': __mb_ny, '__mb_yield': __mb_yield, '__mb_chk': _check}


async def run(src):
    _purge()
    _repl_refresh()
    import microbit  # noqa: 화면 · 핀 초기화
    _last[0] = mbhw.now_ms()
    linecache.cache['main.py'] = (len(src), None, src.splitlines(True), 'main.py')
    try:
        code = transform(src)
    except SyntaxError as e:
        print('  File "main.py", line %s\n    %s\nSyntaxError: %s' % (e.lineno, (e.text or '').rstrip(), e.msg), file=sys.stderr)
        return 'error'
    g = globals_dict()
    try:
        r = eval(code, g)
        if asyncio.iscoroutine(r):
            await r
    except KeyboardInterrupt:
        return 'stopped'
    except SystemExit:
        return 'done'
    except BaseException:
        report()
        return 'error'
    return 'done'


# ---------------- 대화형 모드(REPL) ----------------
_repl_g = [None]


def repl_reset():
    _repl_g[0] = None


def _repl_refresh():
    """모듈을 새로 불러온 뒤에도 셸이 같은 이름을 쓰도록 다시 들여온다 (사용자 변수는 유지)"""
    g = _repl_g[0]
    if g is not None:
        try:
            exec('from microbit import *', g)
        except Exception:
            _repl_g[0] = None


async def repl(line):
    """REPL 한 줄(또는 블록)을 실행하고, 값이 있으면 그대로 출력한다."""
    if _repl_g[0] is None:
        _purge()
        g = globals_dict()
        g['__name__'] = '__console__'
        # 실제 micro:bit REPL 과 같이 microbit 모듈을 미리 들여와 둔다
        exec('from microbit import *', g)
        _repl_g[0] = g
    g = _repl_g[0]
    _last[0] = mbhw.now_ms()
    linecache.cache['<stdin>'] = (len(line), None, line.splitlines(True), '<stdin>')
    try:
        code = transform(line, '<stdin>', interactive=True)
    except SyntaxError as e:
        print('  File "<stdin>", line %s\n    %s\nSyntaxError: %s' % (e.lineno, (e.text or '').rstrip(), e.msg), file=sys.stderr)
        return 'error'
    try:
        r = eval(code, g)
        if asyncio.iscoroutine(r):
            await r
    except KeyboardInterrupt:
        print('KeyboardInterrupt', file=sys.stderr)
        return 'stopped'
    except SystemExit:
        return 'done'
    except BaseException:
        report()
        return 'error'
    return 'done'
`;

PY_LIB.time_patch = String.raw`# 표준 time 모듈에 MicroPython 확장(ticks_ms 등)을 추가한다
import time, sys, mbhw, _mbrt
_P = 0x40000000


def ticks_ms():
    return int(mbhw.now_ms()) & (_P - 1)


def ticks_us():
    return int(mbhw.now_us()) & (_P - 1)


def ticks_cpu():
    return ticks_us()


def ticks_diff(a, b):
    d = (a - b) & (_P - 1)
    return d - _P if d >= _P // 2 else d


def ticks_add(a, d):
    return (a + d) & (_P - 1)


def sleep(s):
    _mbrt.busy_wait(s)


def sleep_ms(ms):
    _mbrt.busy_wait(ms / 1000)


def sleep_us(us):
    _mbrt.busy_wait(us / 1e6)


for _n in ('ticks_ms', 'ticks_us', 'ticks_cpu', 'ticks_diff', 'ticks_add', 'sleep', 'sleep_ms', 'sleep_us'):
    setattr(time, _n, globals()[_n])
sys.modules['utime'] = time

import gc
if not hasattr(gc, 'mem_free'):
    gc.mem_free = lambda: 86704
    gc.mem_alloc = lambda: 11600
    gc.threshold = lambda *a: 0
`;

PY_LIB.micropython = String.raw`# micropython 모듈 (micro:bit에서 쓸 수 있는 일부)


def const(x):
    return x


def native(f):
    return f


viper = native
asm_thumb = native


def alloc_emergency_exception_buf(n):
    pass


def schedule(fn, arg):
    fn(arg)


def mem_info(*a):
    print('stack: 532 out of 7936')
    print('GC: total: 98304, used: 11600, free: 86704')


def opt_level(*a):
    return 0


def kbd_intr(n):
    pass


def heap_lock():
    pass


def heap_unlock():
    pass
`;
