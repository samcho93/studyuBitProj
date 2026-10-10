import io
p = 'D:/Work/Web/studyuBitProj/js/custom.js'
s = io.open(p, encoding='utf8').read()


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


rep("""  function persist() {
    if (!ws) return;
    const state = Blockly.serialization.workspaces.save(ws);
    if (cur.key) store.set('mb.blk.' + cur.key, JSON.stringify(state));
    store.set('mb.blk.last', JSON.stringify({ key: cur.key, title: cur.title, original: cur.original, state }));
  }
  function loadState(state) {
    Blockly.Events.disable();
    try { ws.clear(); Blockly.serialization.workspaces.load(state, ws); } finally { Blockly.Events.enable(); }
    ws.cleanUp();
    ws.scrollCenter();
    const first = ws.getTopBlocks(true)[0];
    if (first) { const xy = first.getRelativeToSurfaceXY(); ws.scroll(-xy.x * ws.scale + 40, -xy.y * ws.scale + 20); }
    refreshCode();
    persist();
  }""", """  // 고친 블록은 예제마다 저장 (저장 공간을 아끼려고 최근 30개까지만)
  function persist(edited) {
    if (!ws) return;
    const state = Blockly.serialization.workspaces.save(ws);
    if (edited && cur.key) {
      let keys = [];
      try { keys = JSON.parse(store.get('mb.blk.keys') || '[]'); } catch (e) { keys = []; }
      keys = keys.filter((k) => k !== cur.key).concat(cur.key);
      while (keys.length > 30) store.set('mb.blk.' + keys.shift(), null);
      store.set('mb.blk.keys', JSON.stringify(keys));
      store.set('mb.blk.' + cur.key, JSON.stringify(state));
    }
    store.set('mb.blk.last', JSON.stringify({ key: cur.key, title: cur.title, original: cur.original, state }));
  }
  function loadState(state) {
    // 불러오고 정리하는 동안은 '고침'으로 치지 않는다
    Blockly.Events.disable();
    try { ws.clear(); Blockly.serialization.workspaces.load(state, ws); ws.cleanUp(); } finally { Blockly.Events.enable(); }
    ws.scrollCenter();
    const first = ws.getTopBlocks(true)[0];
    if (first) { const xy = first.getRelativeToSurfaceXY(); ws.scroll(-xy.x * ws.scale + 40, -xy.y * ws.scale + 20); }
    refreshCode();
    persist(false);
  }""")
rep("""    saveTimer = setTimeout(persist, 600);""", """    saveTimer = setTimeout(() => persist(true), 600);""")
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
