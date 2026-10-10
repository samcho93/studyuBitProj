/* 슬라이드 판서(잉크) 레이어
 * - 좌표는 항상 슬라이드 기준(1280 x 720). 화면 크기가 바뀌어도 판서가 같이 확대·축소됩니다.
 * - 캔버스 백버퍼는 슬라이드 좌표의 2배(2560 x 1440)로 두어 선명하게 그립니다.
 * - 획은 슬라이드마다 따로 보관하므로 다음 장에 갔다 와도 그대로 남아 있습니다.
 * - 새로 고치면 지워지고(메모리에만 보관), 고른 도구·색·굵기만 브라우저에 기억합니다.
 */
(function () {
  const store = window.MbRunner.store;
  const W = 1280, H = 720, SCALE = 2, UNDO_MAX = 50;

  /** 점 p 와 선분 ab 사이의 거리 */
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  class InkLayer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      this.strokes = {};      // 슬라이드 키 → 획 목록
      this.history = {};      // 슬라이드 키 → 되돌리기용 이전 목록들
      this.key = '';
      this.cur = null;        // 그리는 중인 획
      this.dirty = false;     // 이번 동작에서 실제로 그리거나 지웠는가
      this.raf = 0;
      this.tool = store.get('mb.inkTool', 'pen');
      this.color = store.get('mb.inkColor', '#e53935');
      this.width = +store.get('mb.inkWidth', '6') || 6;
      this.onChange = null;
    }

    /* ------------------------------------------------------------ 상태 */
    get drawing() { return !!this.cur || this.erasing; }
    list() { return this.strokes[this.key] || []; }
    hasInk() { return this.list().length > 0; }
    hasAnyInk() { return Object.values(this.strokes).some((v) => v.length); }
    canUndo() { return (this.history[this.key] || []).length > 0; }

    setSlide(key) {
      this.key = key;
      this.cur = null;
      this.erasing = false;
      this.render();
      this.changed();
    }

    setTool(t) { this.tool = t; store.set('mb.inkTool', t); this.changed(); }
    setColor(c) { this.color = c; store.set('mb.inkColor', c); this.changed(); }
    setWidth(w) { this.width = w; store.set('mb.inkWidth', String(w)); this.changed(); }
    changed() { if (this.onChange) this.onChange(); }

    /** 되돌리기용으로 현재 상태를 저장한다 (획 객체는 공유하므로 가볍습니다) */
    snapshot() {
      const h = this.history[this.key] || (this.history[this.key] = []);
      h.push(this.list().slice());
      if (h.length > UNDO_MAX) h.shift();
    }

    /* ------------------------------------------------------------ 그리기 */
    begin(x, y) {
      this.dirty = false;
      if (this.tool === 'pointer') return false;
      if (this.tool === 'eraser') {
        this.erasing = true;
        this.eraseAt(x, y, true);
        return true;
      }
      this.snapshot();
      this.cur = { tool: this.tool, color: this.color, width: this.width, pts: [{ x, y }] };
      (this.strokes[this.key] || (this.strokes[this.key] = [])).push(this.cur);
      return true;
    }

    move(x, y) {
      if (this.erasing) { this.eraseAt(x, y, false); return; }
      if (!this.cur) return;
      const p = this.cur.pts[this.cur.pts.length - 1];
      if (Math.hypot(x - p.x, y - p.y) < 1.2) return;   // 너무 촘촘한 점은 건너뜁니다
      this.cur.pts.push({ x, y });
      this.dirty = true;
      this.schedule();
    }

    /** 그리기를 끝낸다. 실제로 획이 남았으면 true */
    end() {
      const drew = this.dirty;
      if (this.cur) {
        // 끌지 않은 단순 클릭은 점을 남기지 않습니다
        if (this.cur.pts.length < 2) {
          const arr = this.strokes[this.key];
          arr.splice(arr.indexOf(this.cur), 1);
          (this.history[this.key] || []).pop();
        }
        this.cur = null;
      }
      this.erasing = false;
      this.render();
      this.changed();
      return drew;
    }

    /** 스친 획을 통째로 지운다 */
    eraseAt(x, y, first) {
      const arr = this.list();
      if (!arr.length) return;
      const r = Math.max(10, this.width * 2);
      const keep = arr.filter((st) => !this.hits(st, x, y, r));
      if (keep.length === arr.length) return;
      if (first || !this.dirty) this.snapshot();
      this.strokes[this.key] = keep;
      this.dirty = true;
      this.schedule();
    }

    hits(st, x, y, r) {
      const p = st.pts;
      const w = (st.tool === 'marker' ? st.width * 3.2 : st.width) / 2;
      for (let i = 1; i < p.length; i++) {
        if (distToSeg(x, y, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y) <= r + w) return true;
      }
      return false;
    }

    /* ------------------------------------------------------------ 정리 */
    undoLast() {
      const h = this.history[this.key];
      if (!h || !h.length) return false;
      this.strokes[this.key] = h.pop();
      this.cur = null;
      this.render();
      this.changed();
      return true;
    }

    clearSlide() {
      if (!this.hasInk()) return false;
      this.snapshot();
      this.strokes[this.key] = [];
      this.render();
      this.changed();
      return true;
    }

    clearAll() {
      if (!this.hasAnyInk()) return false;
      this.snapshot();
      const keep = this.history[this.key];
      this.strokes = {};
      this.history = {};
      this.history[this.key] = keep;      // 현재 장은 한 번 되돌릴 수 있게 둡니다
      this.render();
      this.changed();
      return true;
    }

    /* ------------------------------------------------------------ 그리기(화면) */
    schedule() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
    }

    render() {
      const c = this.ctx;
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      c.clearRect(0, 0, W, H);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const st of this.list()) this.paint(c, st);
      c.globalAlpha = 1;
    }

    paint(c, st) {
      const p = st.pts;
      if (p.length < 2) return;
      c.strokeStyle = st.color;
      if (st.tool === 'marker') { c.globalAlpha = 0.38; c.lineWidth = st.width * 3.2; }
      else { c.globalAlpha = 1; c.lineWidth = st.width; }
      c.beginPath();
      c.moveTo(p[0].x, p[0].y);
      // 가운데 점을 이어 부드러운 곡선으로 그립니다
      for (let i = 1; i < p.length - 1; i++) {
        c.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
      }
      c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
      c.stroke();
    }
  }

  InkLayer.W = W;
  InkLayer.H = H;
  window.InkLayer = InkLayer;
})();
