/* BBC micro:bit V2 의 MicroPython 모듈들을 Pyodide 위에서 흉내 낸다.
 * 하드웨어 동작은 모두 JS 모듈 mbhw(= js/hw.js) 를 통해 시뮬레이터로 전달된다.
 */
'use strict';

const PY_MB = {};

/* ==========================================================================
 *  microbit — 화면 · 버튼 · 핀 · 센서
 * ====================================================================== */
PY_MB.microbit = String.raw`# microbit 모듈 (BBC micro:bit V2 시뮬레이션)
import mbhw, _mbrt, asyncio, math

_ANALOG_IN = (0, 1, 2, 3, 4, 10)
_FONT = __FONT__


class MicroBitAnalogDigitalPin:
    NO_PULL = 0
    PULL_UP = 1
    PULL_DOWN = 2

    def __init__(self, n):
        self._n = n
        # P5(버튼 A) · P11(버튼 B) 은 기본 풀업, 나머지는 풀다운
        self._pull = 1 if n in (5, 11) else 2
        self._period = 20000
        self._duty = 0
        self._mode = 'unused'

    def write_digital(self, v):
        if v not in (0, 1, True, False):
            raise ValueError('value must be 0 or 1')
        self._mode = 'write_digital'
        mbhw.pin_init(self._n, 1, -1)
        mbhw.pin_write(self._n, 1 if v else 0)

    def read_digital(self):
        if self._mode != 'read_digital':
            self._mode = 'read_digital'
            mbhw.pin_init(self._n, 0, self._pull)
        return int(mbhw.pin_read(self._n))

    def set_pull(self, p):
        self._pull = p
        self._mode = 'read_digital'
        mbhw.pin_init(self._n, 0, p)

    def get_pull(self):
        return self._pull

    def get_mode(self):
        return self._mode

    def read_analog(self):
        if self._n not in _ANALOG_IN:
            raise ValueError('핀 %d 는 아날로그 입력을 지원하지 않습니다 (P0~P4, P10만 가능)' % self._n)
        self._mode = 'read_analog'
        mbhw.pin_init(self._n, 0, -1)
        return int(mbhw.pin_analog(self._n))

    def write_analog(self, v):
        v = int(v)
        if not 0 <= v <= 1023:
            raise ValueError('아날로그 출력 값은 0 ~ 1023 이어야 합니다')
        self._duty = v
        self._mode = 'write_analog'
        mbhw.pwm_set(self._n, 1000000.0 / self._period, v)

    def set_analog_period(self, ms):
        self.set_analog_period_microseconds(int(ms) * 1000)

    def set_analog_period_microseconds(self, us):
        self._period = max(256, int(us))
        if self._mode == 'write_analog':
            self.write_analog(self._duty)

    def get_analog_period_microseconds(self):
        return self._period

    def __repr__(self):
        return 'MicroBitPin(%d)' % self._n


class MicroBitTouchPin(MicroBitAnalogDigitalPin):
    CAPACITIVE = 1
    RESISTIVE = 2

    def is_touched(self):
        return bool(mbhw.touched(self._n))

    def set_touch_mode(self, m):
        pass


for _i in (0, 1, 2):
    globals()['pin%d' % _i] = MicroBitTouchPin(_i)
for _i in (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20):
    globals()['pin%d' % _i] = MicroBitAnalogDigitalPin(_i)
del _i


class _LogoPin:
    def is_touched(self):
        return bool(mbhw.state().to_py()[7])

    def set_touch_mode(self, m):
        pass


pin_logo = _LogoPin()
pin_speaker = MicroBitAnalogDigitalPin(-1)


# ------------------------------------------------------------------ Image
class Image:
    def __init__(self, *a):
        if not a:
            self._w, self._h, self._p = 5, 5, bytearray(25)
        elif isinstance(a[0], str):
            s = a[0]
            rows = s.split(':') if ':' in s else s.split('\n')
            rows = [r for r in rows if r != '']
            self._h = len(rows)
            self._w = max(len(r) for r in rows) if rows else 0
            self._p = bytearray(self._w * self._h)
            for y, r in enumerate(rows):
                for x, ch in enumerate(r):
                    self._p[y * self._w + x] = int(ch) if ch.isdigit() else 0
        else:
            self._w, self._h = int(a[0]), int(a[1])
            self._p = bytearray(a[2]) if len(a) > 2 else bytearray(self._w * self._h)

    def width(self):
        return self._w

    def height(self):
        return self._h

    def get_pixel(self, x, y):
        if not (0 <= x < self._w and 0 <= y < self._h):
            raise ValueError('index out of bounds')
        return self._p[y * self._w + x]

    def set_pixel(self, x, y, v):
        if not (0 <= x < self._w and 0 <= y < self._h):
            raise ValueError('index out of bounds')
        if not 0 <= int(v) <= 9:
            raise ValueError('밝기는 0 ~ 9 사이여야 합니다')
        self._p[y * self._w + x] = int(v)

    def copy(self):
        return Image(self._w, self._h, bytes(self._p))

    def invert(self):
        return Image(self._w, self._h, bytes(9 - v for v in self._p))

    def fill(self, v):
        for i in range(len(self._p)):
            self._p[i] = max(0, min(9, int(v)))

    def blit(self, src, x, y, w, h, xdest=0, ydest=0):
        for yy in range(h):
            for xx in range(w):
                sx, sy = x + xx, y + yy
                dx, dy = xdest + xx, ydest + yy
                if 0 <= dx < self._w and 0 <= dy < self._h:
                    v = src.get_pixel(sx, sy) if (0 <= sx < src.width() and 0 <= sy < src.height()) else 0
                    self._p[dy * self._w + dx] = v

    def shift_left(self, n):
        return self._shift(n, 0)

    def shift_right(self, n):
        return self._shift(-n, 0)

    def shift_up(self, n):
        return self._shift(0, n)

    def shift_down(self, n):
        return self._shift(0, -n)

    def _shift(self, dx, dy):
        im = Image(self._w, self._h)
        for y in range(self._h):
            for x in range(self._w):
                sx, sy = x + dx, y + dy
                if 0 <= sx < self._w and 0 <= sy < self._h:
                    im._p[y * self._w + x] = self._p[sy * self._w + sx]
        return im

    def crop(self, x, y, w, h):
        im = Image(w, h)
        for yy in range(h):
            for xx in range(w):
                if 0 <= x + xx < self._w and 0 <= y + yy < self._h:
                    im._p[yy * w + xx] = self._p[(y + yy) * self._w + x + xx]
        return im

    def __add__(self, o):
        return Image(self._w, self._h, bytes(min(9, a + b) for a, b in zip(self._p, o._p)))

    def __sub__(self, o):
        return Image(self._w, self._h, bytes(max(0, a - b) for a, b in zip(self._p, o._p)))

    def __mul__(self, k):
        return Image(self._w, self._h, bytes(max(0, min(9, int(a * k))) for a in self._p))

    def __truediv__(self, k):
        return self.__mul__(1.0 / k)

    def __repr__(self):
        return "Image('" + ':'.join(''.join(str(self._p[y * self._w + x]) for x in range(self._w)) for y in range(self._h)) + ":')"

    def __str__(self):
        return self.__repr__()


_IMG = {
    'HEART': '09090:99999:99999:09990:00900', 'HEART_SMALL': '00000:09090:09990:00900:00000',
    'HAPPY': '00000:09090:00000:90009:09990', 'SMILE': '00000:00000:00000:90009:09990', 'SAD': '00000:09090:00000:09990:90009',
    'CONFUSED': '00000:09090:00000:09090:90909', 'ANGRY': '90009:09090:00000:99999:90909', 'ASLEEP': '00000:99099:00000:09990:00000',
    'SURPRISED': '09090:00000:00900:09090:00900', 'SILLY': '90009:00000:99999:00909:00999', 'FABULOUS': '99999:99099:00000:09090:09990',
    'MEH': '09090:00000:00090:00900:09000', 'YES': '00000:00009:00090:90900:09000', 'NO': '90009:09090:00900:09090:90009',
    'ARROW_N': '00900:09990:90909:00900:00900', 'ARROW_NE': '00999:00099:00909:09000:90000', 'ARROW_E': '00900:00090:99999:00090:00900',
    'ARROW_SE': '90000:09000:00909:00099:00999', 'ARROW_S': '00900:00900:90909:09990:00900', 'ARROW_SW': '00009:00090:90900:99000:99900',
    'ARROW_W': '00900:09000:99999:09000:00900', 'ARROW_NW': '99900:99000:90900:00090:00009',
    'SQUARE': '99999:90009:90009:90009:99999', 'SQUARE_SMALL': '00000:09990:09090:09990:00000', 'DIAMOND': '00900:09090:90009:09090:00900',
    'DIAMOND_SMALL': '00000:00900:09090:00900:00000', 'TRIANGLE': '00000:00900:09090:99999:00000', 'TRIANGLE_LEFT': '90000:99000:90900:90090:99999',
    'CHESSBOARD': '09090:90909:09090:90909:09090', 'SKULL': '09990:90909:99999:09990:09990', 'GHOST': '99999:90909:99999:99999:90909',
    'DUCK': '09900:99900:09999:09990:00000', 'TSHIRT': '99099:99999:09990:09990:09990', 'PACMAN': '09999:99090:99900:99990:09999',
    'TARGET': '00900:09990:99099:09990:00900', 'HOUSE': '00900:09990:99999:09990:09090', 'MUSIC_QUAVER': '00900:00990:00909:99900:99900',
    'MUSIC_CROTCHET': '00900:00900:00900:99900:99900', 'MUSIC_QUAVERS': '09999:09009:09009:99099:99099',
    'SNAKE': '99000:99099:09090:09990:00000', 'RABBIT': '90900:90900:99990:99090:99990',
    'BUTTERFLY': '99099:99999:00900:99999:99099', 'SWORD': '00900:00900:00900:09990:00900', 'UMBRELLA': '09990:99999:00900:90900:09900',
    'COW': '90009:90009:99999:09990:00900', 'GIRAFFE': '99000:09000:09000:09990:09090', 'TORTOISE': '00000:09990:99999:09090:00000',
    'STICKFIGURE': '00900:99999:00900:09090:90009', 'ROLLERSKATE': '00099:00099:99999:99999:09090', 'XMAS': '00900:09990:00900:09990:99999',
    'PITCHFORK': '90909:90909:99999:00900:00900', 'SCISSORS': '99009:99090:00900:99090:99009',
}
for _k, _v in _IMG.items():
    setattr(Image, _k, Image(_v))
del _k, _v
Image.ALL_ARROWS = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
                    Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]
_CLOCK = ['00900:00900:00900:00000:00000', '00090:00090:00900:00000:00000', '00000:00099:00900:00000:00000',
          '00000:00000:00999:00000:00000', '00000:00000:00900:00099:00000', '00000:00000:00900:00090:00090',
          '00000:00000:00900:00900:00900', '00000:00000:00900:09000:09000', '00000:00000:00900:99000:00000',
          '00000:00000:99900:00000:00000', '00000:99000:00900:00000:00000', '09000:09000:00900:00000:00000']
for _i, _s in enumerate(_CLOCK):
    setattr(Image, 'CLOCK%d' % (12 if _i == 0 else _i), Image(_s))
Image.ALL_CLOCKS = [getattr(Image, 'CLOCK%d' % n) for n in list(range(1, 13))]
del _i, _s


def _glyph_cols(ch):
    """문자 하나를 5개의 세로 줄(비트) 로 바꾼다"""
    o = ord(ch)
    if o < 32 or o > 126:
        o = 63
    base = (o - 32) * 5
    cols = []
    for c in range(5):
        b = _FONT[base + c]
        v = 0
        for r, rows in enumerate(((0,), (1, 2), (3,), (4, 5), (6,))):
            if any(b & (1 << q) for q in rows):
                v |= 1 << r
        cols.append(v)
    return cols


def _char_img(ch):
    im = Image()
    for x, v in enumerate(_glyph_cols(ch)):
        for y in range(5):
            if v & (1 << y):
                im._p[y * 5 + x] = 9
    return im


# ------------------------------------------------------------------ display
class _Display:
    def __init__(self):
        self._px = bytearray(25)
        self._on = True
        self._task = None
        self._push()

    def _push(self):
        mbhw.display(''.join(str(v) for v in self._px) if self._on else '')

    def _cancel(self):
        if self._task is not None and not self._task.done():
            self._task.cancel()
        self._task = None

    def _bg(self, coro):
        self._task = asyncio.ensure_future(_mbrt._guard(coro))

    def _img(self, im, x0=0):
        for y in range(5):
            for x in range(5):
                xx = x + x0
                self._px[y * 5 + x] = im.get_pixel(xx, y) if (0 <= xx < im.width() and y < im.height()) else 0
        self._push()

    def show(self, v, delay=400, *, wait=True, loop=False, clear=False, monospace=False):
        self._cancel()
        if isinstance(v, Image):
            self._img(v)
            return None
        if isinstance(v, (int, float)):
            v = str(v)
        if isinstance(v, str):
            if len(v) == 1:
                self._img(_char_img(v))
                return None
            frames = [_char_img(c) for c in v]
        else:
            frames = [x if isinstance(x, Image) else _char_img(str(x)[:1] or ' ') for x in v]
        coro = self._frames(frames, delay, loop, clear)
        if wait:
            return coro
        self._bg(coro)

    async def _frames(self, frames, delay, loop, clear):
        while True:
            for f in frames:
                self._img(f)
                await _mbrt.asleep_ms(delay)
            if not loop:
                break
        if clear:
            self.clear()

    def scroll(self, text, delay=150, *, wait=True, loop=False, monospace=False):
        self._cancel()
        cols = [0] * 5
        for ch in str(text):
            g = _glyph_cols(ch)
            if not monospace:
                if ch == ' ':
                    g = [0, 0, 0]
                else:
                    while g and g[0] == 0:
                        g = g[1:]
                    while g and g[-1] == 0:
                        g = g[:-1]
            cols += g + [0]
        cols += [0] * 5
        coro = self._scroll(cols, delay, loop)
        if wait:
            return coro
        self._bg(coro)

    async def _scroll(self, cols, delay, loop):
        while True:
            for i in range(len(cols) - 4):
                for y in range(5):
                    for x in range(5):
                        self._px[y * 5 + x] = 9 if cols[i + x] & (1 << y) else 0
                self._push()
                await _mbrt.asleep_ms(delay)
            if not loop:
                break

    def clear(self):
        self._cancel()
        for i in range(25):
            self._px[i] = 0
        self._push()

    def set_pixel(self, x, y, v):
        if not (0 <= x < 5 and 0 <= y < 5):
            raise ValueError('index out of bounds')
        if not 0 <= int(v) <= 9:
            raise ValueError('밝기(value)는 0 ~ 9 사이여야 합니다')
        self._px[y * 5 + x] = int(v)
        self._push()

    def get_pixel(self, x, y):
        if not (0 <= x < 5 and 0 <= y < 5):
            raise ValueError('index out of bounds')
        return self._px[y * 5 + x]

    def on(self):
        self._on = True
        self._push()

    def off(self):
        self._on = False
        self._push()

    def is_on(self):
        return self._on

    def read_light_level(self):
        return int(mbhw.state().to_py()[4])


display = _Display()


# ------------------------------------------------------------------ 버튼
class _Button:
    def __init__(self, key):
        self._k = key

    def is_pressed(self):
        return bool(mbhw.button(self._k))

    def was_pressed(self):
        return int(mbhw.presses(self._k, True)) > 0

    def get_presses(self):
        return int(mbhw.presses(self._k, True))


button_a = _Button('A')
button_b = _Button('B')


# ------------------------------------------------------------------ 센서
class _Accelerometer:
    def __init__(self):
        self._last = ''
        self._hist = []

    def get_values(self):
        s = mbhw.state().to_py()
        return (int(s[0]), int(s[1]), int(s[2]))

    def get_x(self):
        return self.get_values()[0]

    def get_y(self):
        return self.get_values()[1]

    def get_z(self):
        return self.get_values()[2]

    def get_strength(self):
        x, y, z = self.get_values()
        return int(math.sqrt(x * x + y * y + z * z))

    def current_gesture(self):
        g = mbhw.gesture()
        if g != self._last:
            self._last = g
            if g:
                self._hist.append(g)
                if len(self._hist) > 16:
                    self._hist.pop(0)
        return g

    def is_gesture(self, name):
        return self.current_gesture() == name

    def was_gesture(self, name):
        self.current_gesture()
        if name in self._hist:
            self._hist = []
            return True
        return False

    def get_gestures(self):
        self.current_gesture()
        h = tuple(self._hist)
        self._hist = []
        return h

    def set_range(self, v):
        pass


accelerometer = _Accelerometer()


class _Compass:
    def heading(self):
        return int(mbhw.state().to_py()[6])

    def calibrate(self):
        pass

    def is_calibrated(self):
        return True

    def clear_calibration(self):
        pass

    def get_field_strength(self):
        return 50000

    def get_x(self):
        return int(40000 * math.sin(math.radians(self.heading())))

    def get_y(self):
        return int(40000 * math.cos(math.radians(self.heading())))

    def get_z(self):
        return -20000


compass = _Compass()


class SoundEvent:
    LOUD = 'loud'
    QUIET = 'quiet'

    def __init__(self, name):
        self.name = name


SoundEvent.LOUD = SoundEvent('loud')
SoundEvent.QUIET = SoundEvent('quiet')


class _Microphone:
    def __init__(self):
        self._prev = 'quiet'
        self._hist = []

    def sound_level(self):
        return int(mbhw.state().to_py()[5])

    def current_event(self):
        e = SoundEvent.LOUD if self.sound_level() > 128 else SoundEvent.QUIET
        if e.name != self._prev:
            self._prev = e.name
            self._hist.append(e.name)
        return e

    def was_event(self, ev):
        self.current_event()
        name = ev.name if isinstance(ev, SoundEvent) else str(ev)
        if name in self._hist:
            self._hist = []
            return True
        return False

    def is_event(self, ev):
        name = ev.name if isinstance(ev, SoundEvent) else str(ev)
        return self.current_event().name == name

    def get_events(self):
        self.current_event()
        h = tuple(SoundEvent(n) for n in self._hist)
        self._hist = []
        return h

    def set_threshold(self, ev, v):
        pass


microphone = _Microphone()


class _Speaker:
    def on(self):
        mbhw.speaker(True)

    def off(self):
        mbhw.speaker(False)

    def is_on(self):
        return bool(mbhw.speaker(None))


speaker = _Speaker()


def temperature():
    return int(mbhw.state().to_py()[3])


def running_time():
    return int(mbhw.run_ms())


def sleep(ms):
    _mbrt.busy_wait(ms / 1000)


def set_volume(v):
    if not 0 <= int(v) <= 255:
        raise ValueError('음량은 0 ~ 255 사이여야 합니다')
    mbhw.volume(int(v))


def scale(value, from_, to):
    a, b = from_
    c, d = to
    r = (value - a) * (d - c) / (b - a) + c
    return int(r) if isinstance(c, int) and isinstance(d, int) else r


def panic(n=0):
    mbhw.panic(int(n))
    raise SystemExit('panic(%d)' % n)


def reset():
    raise SystemExit('reset()')


# ------------------------------------------------------------------ 통신(I2C · SPI · UART)
class _I2C:
    def __init__(self):
        self._sda, self._scl = 20, 19

    def init(self, freq=100000, sda=None, scl=None):
        if sda is not None:
            self._sda = sda._n
        if scl is not None:
            self._scl = scl._n

    def scan(self):
        return list(mbhw.i2c_scan().to_py())

    def read(self, addr, n, repeat=False):
        r = mbhw.i2c_read(addr, n)
        if r is None:
            raise OSError(19)
        return bytes(r.to_py())

    def write(self, addr, buf, repeat=False):
        if int(mbhw.i2c_write(addr, list(bytes(buf)))) < 0:
            raise OSError(19)


i2c = _I2C()


class _SPI:
    def init(self, baudrate=1000000, bits=8, mode=0, sclk=None, mosi=None, miso=None):
        pass

    def write(self, buf):
        mbhw.spi_write(list(bytes(buf)))

    def read(self, n, out=0):
        return bytes(n)

    def write_readinto(self, out, inbuf):
        mbhw.spi_write(list(bytes(out)))


spi = _SPI()


class _UART:
    ODD = 1
    EVEN = 0

    def __init__(self):
        self._buf = bytearray()
        self._console = True

    def init(self, baudrate=9600, bits=8, parity=None, stop=1, *, pins=None, tx=None, rx=None):
        self._console = tx is None and rx is None

    def _pull(self):
        s = mbhw.uart_read()
        if s:
            self._buf += bytes(s.to_py())

    def any(self):
        self._pull()
        return len(self._buf) > 0

    def read(self, n=None):
        self._pull()
        if not self._buf:
            return None
        if n is None or n >= len(self._buf):
            d, self._buf = bytes(self._buf), bytearray()
        else:
            d, self._buf = bytes(self._buf[:n]), self._buf[n:]
        return d

    def readall(self):
        return self.read()

    def readline(self):
        self._pull()
        i = self._buf.find(b'\n')
        if i < 0:
            return None
        d, self._buf = bytes(self._buf[:i + 1]), self._buf[i + 1:]
        return d

    def readinto(self, buf, nbytes=None):
        d = self.read(nbytes or len(buf))
        if not d:
            return None
        for i in range(len(d)):
            buf[i] = d[i]
        return len(d)

    def write(self, buf):
        if isinstance(buf, str):
            buf = buf.encode()
        mbhw.uart_write(bytes(buf).decode('utf-8', 'replace'))
        return len(buf)


uart = _UART()

import audio  # noqa: from microbit import audio 가 되도록
from audio import Sound  # noqa
`;

/* ==========================================================================
 *  music — 음악
 * ====================================================================== */
PY_MB.music = String.raw`# music 모듈 (micro:bit)
import mbhw, _mbrt, asyncio

_state = {'ticks': 4, 'bpm': 120, 'task': None}
_N = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

DADADADUM = ['r4:2', 'g', 'g', 'g', 'eb:8', 'r:2', 'f', 'f', 'f', 'd:8']
ENTERTAINER = ['d4:1', 'd#', 'e', 'c5:2', 'e4:1', 'c5:2', 'e4:1', 'c5:3', 'c:1', 'd', 'd#', 'e', 'c', 'd', 'e:2', 'b4:1', 'd5:2', 'c:4']
PRELUDE = ['c4:1', 'e', 'g', 'c5', 'e', 'g4', 'c5', 'e', 'c4', 'e', 'g', 'c5', 'e', 'g4', 'c5', 'e', 'c4', 'd', 'a', 'd5', 'f', 'a4', 'd5', 'f']
ODE = ['e4', 'e', 'f', 'g', 'g', 'f', 'e', 'd', 'c', 'c', 'd', 'e', 'e:6', 'd:2', 'd:8']
NYAN = ['f#5:2', 'g#', 'c#:1', 'd#:2', 'b4:1', 'd5:1', 'c#', 'b4:2', 'b', 'c#5', 'd', 'd:1', 'c#', 'b4:1', 'c#5:1', 'd#', 'f#', 'g#', 'd#', 'f#', 'c#', 'd', 'b4', 'c#5', 'b4']
RINGTONE = ['c4:1', 'd', 'e:2', 'g', 'd:1', 'e', 'f:2', 'a', 'e:1', 'f', 'g:2', 'b', 'c5:4']
FUNK = ['c2:2', 'c', 'd#', 'c:1', 'f:2', 'c:1', 'f:2', 'f#', 'g', 'c', 'c', 'g', 'c:1', 'f#:2', 'c:1', 'f#:2', 'f', 'd#']
BLUES = ['c2:2', 'e', 'g', 'a', 'a#', 'a', 'g', 'e', 'c2:2', 'e', 'g', 'a', 'a#', 'a', 'g', 'e']
BIRTHDAY = ['c4:3', 'c:1', 'd:4', 'c:4', 'f', 'e:8', 'c:3', 'c:1', 'd:4', 'c:4', 'g', 'f:8']
WEDDING = ['c4:4', 'f:3', 'f:1', 'f:8', 'c:4', 'g:3', 'e:1', 'f:8']
FUNERAL = ['c3:4', 'c:3', 'c:1', 'c:4', 'd#:3', 'd:1', 'd:3', 'c:1', 'c:3', 'b2:1', 'c3:4']
PUNCHLINE = ['c4:3', 'g3:1', 'f#', 'g', 'g#:3', 'g', 'r', 'b', 'c4']
PYTHON = ['d5:1', 'b4', 'r', 'b', 'b', 'a#', 'b', 'g5', 'r', 'd', 'd', 'r', 'b4', 'c5', 'r', 'c', 'c', 'r', 'd', 'e:5', 'c:1', 'a4', 'r', 'a', 'a', 'g#', 'a', 'f#5', 'r', 'e', 'e', 'r', 'c', 'b4', 'r', 'b', 'b', 'r', 'c5', 'd:5']
BADDY = ['c3:3', 'r', 'd:2', 'd#', 'r', 'c', 'r', 'f#:8']
CHASE = ['a4:1', 'b', 'c5', 'b4', 'a:2', 'r', 'a:1', 'b', 'c5', 'b4', 'a:2', 'r', 'a:2', 'e5', 'd#', 'e', 'f', 'e', 'd#', 'e', 'b4:1', 'c5', 'd', 'c', 'b4:2', 'r', 'b:1', 'c5', 'd', 'c', 'b4:2', 'r', 'b:2', 'e5', 'd#', 'e', 'f', 'e', 'd#', 'e']
BA_DING = ['b5:1', 'e6:3']
WAWAWAWAA = ['e3:3', 'r:1', 'd#:3', 'r:1', 'd:4', 'r:1', 'c#:8']
JUMP_UP = ['c5:1', 'd', 'e', 'f', 'g']
JUMP_DOWN = ['g5:1', 'f', 'e', 'd', 'c']
POWER_UP = ['g4:1', 'c5', 'e', 'g:2', 'e:1', 'g:3']
POWER_DOWN = ['g5:1', 'd#', 'c', 'g4:2', 'b:1', 'c5:3']


def _parse(seq):
    """['c4:4', 'e', 'g'] 같은 악보를 (주파수, 길이ms) 목록으로 바꾼다"""
    octave, dur, out = 4, 4, []
    for note in seq:
        note = str(note).lower().strip()
        if ':' in note:
            note, d = note.split(':', 1)
            dur = int(d)
        name = note[:1]
        rest = note[1:]
        semi = 0
        if rest.startswith('#'):
            semi, rest = 1, rest[1:]
        elif rest.startswith('b'):
            semi, rest = -1, rest[1:]
        if rest:
            octave = int(rest)
        ms = 60000.0 / _state['bpm'] / _state['ticks'] * dur
        if name == 'r' or name not in _N:
            out.append((0, ms))
        else:
            midi = (octave + 1) * 12 + _N[name] + semi
            out.append((440 * 2 ** ((midi - 69) / 12.0), ms))
    return out


async def _run(seq, pin, loop):
    n = pin._n if pin is not None else 0
    try:
        while True:
            for f, ms in seq:
                mbhw.tone(n, f)
                await _mbrt.asleep_ms(ms * 0.9)
                mbhw.tone(n, 0)
                await _mbrt.asleep_ms(ms * 0.1)
            if not loop:
                break
    finally:
        mbhw.tone(n, 0)


def _go(coro, wait):
    _cancel()
    if wait:
        return coro
    _state['task'] = asyncio.ensure_future(_mbrt._guard(coro))


def _cancel():
    t = _state['task']
    if t is not None and not t.done():
        t.cancel()
    _state['task'] = None


def play(music, pin=None, wait=True, loop=False):
    if isinstance(music, str):
        music = [music]
    return _go(_run(_parse(music), pin, loop), wait)


def pitch(frequency, duration=-1, pin=None, wait=True):
    _cancel()
    n = pin._n if pin is not None else 0
    mbhw.tone(n, frequency)
    if duration < 0:
        return None

    async def _p():
        try:
            await _mbrt.asleep_ms(duration)
        finally:
            mbhw.tone(n, 0)
    if wait:
        return _p()
    _state['task'] = asyncio.ensure_future(_mbrt._guard(_p()))


def stop(pin=None):
    _cancel()
    mbhw.tone(pin._n if pin is not None else 0, 0)


def set_tempo(ticks=4, bpm=120):
    _state['ticks'], _state['bpm'] = ticks, bpm


def get_tempo():
    return (_state['ticks'], _state['bpm'])


def reset():
    set_tempo()
`;

/* ==========================================================================
 *  audio — 내장 효과음 · 오디오 프레임
 * ====================================================================== */
PY_MB.audio = String.raw`# audio 모듈 (micro:bit V2 내장 효과음)
import mbhw, _mbrt, asyncio, math


class AudioFrame:
    def __init__(self):
        self._b = bytearray(32)

    def __len__(self):
        return 32

    def __getitem__(self, i):
        return self._b[i]

    def __setitem__(self, i, v):
        self._b[i] = int(v) & 255

    def copyfrom(self, o):
        for i in range(32):
            self._b[i] = o[i]


class SoundEffect:
    WAVEFORM_SINE = 0
    WAVEFORM_SAWTOOTH = 1
    WAVEFORM_TRIANGLE = 2
    WAVEFORM_SQUARE = 3
    WAVEFORM_NOISE = 4
    SHAPE_LINEAR = 1
    SHAPE_CURVE = 2
    SHAPE_LOG = 18
    FX_NONE = 0
    FX_TREMOLO = 2
    FX_VIBRATO = 1
    FX_WARBLE = 3

    def __init__(self, freq_start=500, freq_end=2500, duration=500, vol_start=255, vol_end=0,
                 waveform=WAVEFORM_SQUARE, fx=FX_NONE, shape=SHAPE_LOG):
        self.freq_start = freq_start
        self.freq_end = freq_end
        self.duration = duration
        self.vol_start = vol_start
        self.vol_end = vol_end
        self.waveform = waveform
        self.fx = fx
        self.shape = shape

    def copy(self):
        return SoundEffect(self.freq_start, self.freq_end, self.duration, self.vol_start,
                           self.vol_end, self.waveform, self.fx, self.shape)

    def _spec(self):
        return (self.freq_start, self.freq_end, self.duration, self.waveform, self.fx)


class _BuiltinSound:
    def __init__(self, name, spec):
        self.name = name
        self._spec_ = spec

    def _spec(self):
        return self._spec_

    def __repr__(self):
        return 'Sound.%s' % self.name


class Sound:
    pass


# (시작 주파수, 끝 주파수, 길이ms, 파형, 효과)
_SOUNDS = {
    'GIGGLE': (400, 1100, 500, 3, 3), 'HAPPY': (500, 1400, 500, 0, 0), 'HELLO': (600, 900, 400, 2, 0),
    'MYSTERIOUS': (800, 300, 900, 0, 1), 'SAD': (700, 250, 900, 2, 0), 'SLIDE': (300, 1500, 400, 1, 0),
    'SOARING': (400, 2000, 900, 0, 1), 'SPRING': (1200, 300, 500, 1, 3), 'TWINKLE': (1800, 2600, 400, 0, 0),
    'YAWN': (300, 700, 900, 2, 1),
}
for _n, _s in _SOUNDS.items():
    setattr(Sound, _n, _BuiltinSound(_n, _s))
del _n, _s

_st = {'task': None, 'playing': False}


async def _play_spec(spec, pin):
    f0, f1, ms, wave, fx = spec
    n = pin._n if pin is not None else 0
    _st['playing'] = True
    try:
        steps = max(6, int(ms / 25))
        for i in range(steps):
            t = i / float(steps - 1) if steps > 1 else 1.0
            f = f0 + (f1 - f0) * t
            if fx in (1, 3):
                f *= 1 + 0.12 * math.sin(t * 28)
            mbhw.tone(n, f, wave)
            await _mbrt.asleep_ms(ms / steps)
    finally:
        mbhw.tone(n, 0)
        _st['playing'] = False


async def _play_frames(frames, pin):
    n = pin._n if pin is not None else 0
    _st['playing'] = True
    try:
        for fr in frames:
            v = sum(fr[i] for i in range(32)) / 32.0
            mbhw.tone(n, 200 + v * 6, 0)
            await _mbrt.asleep_ms(4)
    finally:
        mbhw.tone(n, 0)
        _st['playing'] = False


def play(source, wait=True, pin=None, return_pin=None):
    stop()
    if hasattr(source, '_spec'):
        coro = _play_spec(source._spec(), pin)
    else:
        coro = _play_frames(list(source), pin)
    if wait:
        return coro
    _st['task'] = asyncio.ensure_future(_mbrt._guard(coro))


def is_playing():
    return _st['playing']


def stop():
    t = _st['task']
    if t is not None and not t.done():
        t.cancel()
    _st['task'] = None
    _st['playing'] = False
    mbhw.tone(0, 0)
`;

/* ==========================================================================
 *  speech — 말하기
 * ====================================================================== */
PY_MB.speech = String.raw`# speech 모듈 (micro:bit) — 브라우저 음성 합성으로 흉내 낸다
import mbhw, _mbrt

_PHON = {
    'AA': '아', 'AE': '애', 'AH': '어', 'AO': '오', 'AW': '아우', 'AX': '어', 'AY': '아이',
    'EH': '에', 'ER': '어r', 'EY': '에이', 'IH': '이', 'IY': '이-', 'OW': '오우', 'OY': '오이',
    'UH': '우', 'UW': '우-', 'B': 'ㅂ', 'CH': 'ㅊ', 'D': 'ㄷ', 'DH': 'ㄷ', 'F': 'ㅍ', 'G': 'ㄱ',
    'HH': 'ㅎ', 'JH': 'ㅈ', 'K': 'ㅋ', 'L': 'ㄹ', 'M': 'ㅁ', 'N': 'ㄴ', 'NX': 'ㅇ', 'P': 'ㅍ',
    'R': 'ㄹ', 'S': 'ㅅ', 'SH': 'ㅅ', 'T': 'ㅌ', 'TH': 'ㅅ', 'V': 'ㅂ', 'W': 'ㅜ', 'Y': 'ㅣ',
    'Z': 'ㅈ', 'ZH': 'ㅈ',
}


def translate(words):
    """영어 단어를 대략적인 발음 기호(phoneme) 문자열로 바꾼다"""
    out = []
    for w in str(words).split():
        out.append(mbhw.speech_translate(w))
    return ' '.join(out)


async def _speak(text, pitch, speed, mouth, throat, sing):
    ms = int(mbhw.speech_say(str(text), pitch, speed, mouth, throat, 1 if sing else 0))
    await _mbrt.asleep_ms(ms)


def say(words, pitch=64, speed=72, mouth=128, throat=128):
    return _speak(words, pitch, speed, mouth, throat, False)


def pronounce(phonemes, pitch=64, speed=72, mouth=128, throat=128):
    return _speak(phonemes, pitch, speed, mouth, throat, False)


def sing(phonemes, pitch=64, speed=72, mouth=128, throat=128):
    return _speak(phonemes, pitch, speed, mouth, throat, True)
`;

/* ==========================================================================
 *  radio — 무선 통신 (가상 짝 보드)
 * ====================================================================== */
PY_MB.radio = String.raw`# radio 모듈 (micro:bit) — 시뮬레이터의 '가상 짝 보드' 와 주고받는다
import mbhw

RATE_250KBIT = 0
RATE_1MBIT = 1
RATE_2MBIT = 2

_on = [False]


def on():
    _on[0] = True
    mbhw.radio_on(True)


def off():
    _on[0] = False
    mbhw.radio_on(False)


def config(**kw):
    mbhw.radio_config(int(kw.get('channel', 7)), int(kw.get('group', 0)), int(kw.get('power', 6)))


def reset():
    config(channel=7, group=0, power=6, length=32, queue=3, data_rate=RATE_1MBIT)


def _need_on():
    if not _on[0]:
        raise ValueError('radio is not enabled — radio.on() 을 먼저 부르세요')


def send(msg):
    _need_on()
    mbhw.radio_send(str(msg), True)


def send_bytes(b):
    _need_on()
    mbhw.radio_send(bytes(b).decode('utf-8', 'replace'), False)


def receive():
    _need_on()
    m = mbhw.radio_recv()
    if m is None:
        return None
    return str(m)


def receive_bytes():
    m = receive()
    return None if m is None else m.encode()


def receive_full():
    m = receive()
    if m is None:
        return None
    return (m.encode(), -50, int(mbhw.now_ms() * 1000))


def receive_bytes_into(buf):
    m = receive_bytes()
    if m is None:
        return None
    n = min(len(buf), len(m))
    for i in range(n):
        buf[i] = m[i]
    return len(m)
`;

/* ==========================================================================
 *  neopixel — WS2812 LED 띠
 * ====================================================================== */
PY_MB.neopixel = String.raw`# neopixel 모듈 (micro:bit)
import mbhw


class NeoPixel:
    def __init__(self, pin, n, bpp=3):
        self.pin = pin
        self.n = int(n)
        self.bpp = bpp
        self.buf = [(0, 0, 0)] * self.n
        mbhw.np_attach(pin._n, self.n)

    def __len__(self):
        return self.n

    def __setitem__(self, i, v):
        if i < 0:
            i += self.n
        if not 0 <= i < self.n:
            raise IndexError('index out of bounds')
        self.buf[i] = tuple(int(max(0, min(255, c))) for c in v)

    def __getitem__(self, i):
        if i < 0:
            i += self.n
        return self.buf[i]

    def fill(self, v):
        for i in range(self.n):
            self[i] = v

    def clear(self):
        self.fill((0, 0, 0))
        self.show()

    def show(self):
        flat = []
        for c in self.buf:
            flat += [c[0], c[1], c[2]]
        mbhw.np_show(self.pin._n, flat)

    def write(self):
        self.show()
`;

/* ==========================================================================
 *  log — 데이터 로깅 (micro:bit V2)
 * ====================================================================== */
PY_MB.log = String.raw`# log 모듈 (micro:bit V2 데이터 로깅)
import mbhw

MILLISECONDS = 'milliseconds'
SECONDS = 'seconds'
MINUTES = 'minutes'
HOURS = 'hours'
DAYS = 'days'


def set_labels(*labels, timestamp=SECONDS):
    mbhw.log_labels(list(labels), str(timestamp) if timestamp else '')


def set_mirroring(serial):
    mbhw.log_mirror(bool(serial))


def delete(full=False):
    mbhw.log_delete()


def add(data_dictionary=None, **kwargs):
    d = {}
    if data_dictionary:
        d.update(data_dictionary)
    d.update(kwargs)
    mbhw.log_add([[str(k), '' if v is None else str(v)] for k, v in d.items()])
`;

/* ==========================================================================
 *  power · machine · os 보조
 * ====================================================================== */
PY_MB.power = String.raw`# power 모듈 (micro:bit V2 전원 관리)
import mbhw, _mbrt


def off():
    mbhw.power('off')
    raise SystemExit('power.off()')


def deep_sleep(ms=None, wake_on=None, run_every=True):
    mbhw.power('deep_sleep')
    if ms:
        _mbrt.busy_wait(ms / 1000)
`;

PY_MB.machine = String.raw`# machine 모듈 (micro:bit에서 쓸 수 있는 일부)
import mbhw


def time_pulse_us(pin, level, timeout_us=1000000):
    return int(mbhw.pulse_us(pin._n, 1 if level else 0, timeout_us))


def freq():
    return 64000000


def unique_id():
    return b'\x9a\x1f\x22\x7c\x51\x0e\x33\x40'


def reset():
    raise SystemExit('machine.reset()')


def disable_irq():
    return 0


def enable_irq(state=0):
    pass


class mem:
    def __init__(self, size):
        self.size = size

    def __getitem__(self, addr):
        return 0

    def __setitem__(self, addr, v):
        pass


mem8 = mem(1)
mem16 = mem(2)
mem32 = mem(4)
`;

// micro:bit 폰트를 Python bytes 리터럴로 주입
PY_MB.microbit = PY_MB.microbit.replace('__FONT__', "b'" + FONT5x7.map(b => '\\x' + b.toString(16).padStart(2, '0')).join('') + "'");
