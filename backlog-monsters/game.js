/* =============================================================
   Backlog Monsters — a pixel-art creature collector.
   Walk through Backlog Valley, step into tall grass, catch all
   eight monsters with well-timed sticky notes.
   240×160 internal resolution, 16 px tiles, zero dependencies.
   MIT © Filip Stolarski.
   ============================================================= */
(() => {
  'use strict';

  const screen = document.getElementById('screen');
  const out = screen.getContext('2d');
  const VW = 240, VH = 160, T = 16;
  const SAVE = 'backlog-monsters:v1';
  out.imageSmoothingEnabled = false;

  // ---------- 5×7 bitmap font ----------
  const GLYPHS = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
    Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
    3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
    6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
    9: '01110100011000101111000010001001100',
    '.': '00000000000000000000000000110001100', ',': '00000000000000000000011000010001000', '!': '00100001000010000100001000000000100',
    '?': '01110100010000100010001000000000100', "'": '00100001000100000000000000000000000', '-': '00000000000000011111000000000000000',
    ':': '00000011000110000000011000110000000', '/': '00001000100001000100010000100010000', '(': '00010001000100001000010000010000010',
    ')': '01000001000001000010000100010001000', '>': '01000001000001000001000100010001000', '+': '00000001000010011111001000010000000',
    '&': '01100100101010001000101011001001101', '#': '01010010101111101010111110101001010', '*': '00000001001010101110101010010000000',
    ' ': '00000000000000000000000000000000000'
  };
  function text(g, str, x, y, color = '#202020', shadow = null) {
    const s = String(str).toUpperCase();
    let cx = x;
    for (const ch of s) {
      const bits = GLYPHS[ch] || GLYPHS['?'];
      for (let i = 0; i < 35; i++) {
        if (bits[i] !== '1') continue;
        const px = cx + (i % 5), py = y + Math.floor(i / 5);
        if (shadow) { g.fillStyle = shadow; g.fillRect(px + 1, py + 1, 1, 1); }
        g.fillStyle = color; g.fillRect(px, py, 1, 1);
      }
      cx += 6;
    }
    return cx - x;
  }
  function wrap(str, maxChars) {
    const words = str.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
      else line += ' ' + w;
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  // ---------- sprites ----------
  function sprite(rows, palette, scale = 1) {
    const c = document.createElement('canvas');
    c.width = 16 * scale; c.height = 16 * scale;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      const r = row.padEnd(16, '.').slice(0, 16);
      for (let x = 0; x < 16; x++) {
        const k = r[x];
        if (k === '.' || !palette[k]) continue;
        g.fillStyle = palette[k]; g.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return c;
  }
  function silhouette(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#3a3950'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const MONSTERS = [
    { id: 'mvp', name: 'MVP', rarity: 1, zone: 'meadow', desc: 'Small, fragile and full of potential. Hatches into a real product if you ship it.',
      pal: { k: '#202020', w: '#F8F4E8', a: '#F5C542', b: '#D8D0BC' },
      rows: ['', '......kkkk', '.....kwwwwk', '....kwwwwwwk', '...kwwawwwwwk', '...kwwwwwwawk', '..kwwkwwwkwwwk', '..kwwkwwwkwwwk', '..kwwwwwwwwwwk', '..kwawwwkkwwak', '..kwwwwwwwwwwk', '...kwwwwwwwwk', '...kbwwwwwwbk', '....kbbbbbbk', '.....kkkkkk'] },
    { id: 'bug', name: 'Bugzilla', rarity: 1, zone: 'meadow', desc: 'Appears right after every release. Loves Friday deployments.',
      pal: { k: '#202020', a: '#E8412E', b: '#3A2A2A', c: '#202020', w: '#FFFFFF' },
      rows: ['...k........k', '....k......k', '.....kkkkkk', '....kbbbbbbk', '...kbwkbbwkbk', '...kbkkbbkkbk', '..kaaaakkaaaak', '.kaacaakkaacaak', '.kaaaaakkaaaaak', '.kacaaakkaaacak', '.kaaaaakkaaaaak', '..kaaacakkaaak', '..kkaaaakkaakk', '.k..kkkkkkkk..k', 'k..k...kk...k..k'] },
    { id: 'creep', name: 'Scope Creep', rarity: 1, zone: 'meadow', desc: 'Looks harmless. Grows one tiny feature at a time until the sprint is gone.',
      pal: { k: '#202020', a: '#7BC95A', b: '#4E9A3A', c: '#B6F07A', w: '#FFFFFF' },
      rows: ['', '..........kk', '.........kcck', '........kccck', '.......kkcck', '......kaak', '.....kaaaak', '....kawkawk', '....kakkakk', '...kaaaaaaak', '..kaaaaaaaaak', '.kaaabaaabaaak', 'kaabbbbbbbbbaak', 'kkbbbbbbbbbbbkk', '.kkkkkkkkkkkkk'] },
    { id: 'hotfix', name: 'Hotfix', rarity: 2, zone: 'east', desc: 'Burns bright at 2 a.m. Solves the problem, usually creates a new one.',
      pal: { k: '#202020', a: '#FF7A1A', c: '#FFD23F', w: '#FFFFFF' },
      rows: ['.......k', '......kak', '.....kaak..k', '....kaaak.kak', '...kaaacakaak', '...kaacccaaak', '..kaaccccccaak', '..kacckwcckwak', '..kacckkcckkak', '..kaccccccccak', '..kaaccwwwccak', '...kaacccccak', '...kkaaaaaakk', '....kkkkkkkk'] },
    { id: 'velocity', name: 'Velocity', rarity: 2, zone: 'east', desc: 'Fast, but only measures itself against itself. Do not compare across teams.',
      pal: { k: '#202020', a: '#6FB7FF', b: '#3D7BF7', c: '#FFFFFF', w: '#FFFFFF' },
      rows: ['...kk....kk', '..kak...kak', '..kak...kak', '..kak...kak', '..kabk.kbak', '...kaakaak', '..kaaaaaaak', '.kawkaaawkak', '.kakkaaakkak', '.kaaaacaaaak.c', '..kaaaaaaak.c', '..kaawwwaak..c', '...kaaaaak', '..kak...kak', '..kk.....kk'] },
    { id: 'debt', name: 'Tech Debt', rarity: 2, zone: 'south', desc: 'Slow and patient. Every shortcut you take makes its shell a little heavier.',
      pal: { k: '#202020', a: '#A0805A', b: '#D8C8A8', c: '#B5452F', w: '#FFFFFF' },
      rows: ['', '....kkkkkkkk', '...kcbcbbcbck', '..kbcccbcccbbk', '..kcbbcbbcbbck', '.kbcccbcccbccbk', '.kkkkkkkkkkkkkk', 'kaakwkaaaakwkaak', 'kaakkkaaaakkkaak', '.kaaaaakkaaaaak', '..kaaaaaaaaaak', '.kak.kaaaak.kak', '.kk..kk..kk..kk'] },
    { id: 'stake', name: 'Stakeholder', rarity: 3, zone: 'south', desc: 'Wise, important and always has one more requirement. Approach with a roadmap.',
      pal: { k: '#202020', a: '#8D6E63', b: '#5D4A44', w: '#FFFFFF', c: '#FFB000', r: '#E8412E' },
      rows: ['..k..........k', '..kk........kk', '..kakkkkkkkkak', '..kaaaaaaaaaak', '.kawwwaaaawwwak', '.kawkwaaaawkwak', '.kawwwaccawwwak', '..kaaaacaaaaak', '..kabbbbbbbbak', '..kbbbbrbbbbbk', '..kbbbrrrbbbbk', '..kbbbbrbbbbbk', '...kbbbrbbbbk', '....kkkkkkkk', '....ck....kc'] },
    { id: 'retro', name: 'Retro', rarity: 3, zone: 'any', desc: 'Shows up at the end of every sprint and asks how everyone feels. Surprisingly helpful.',
      pal: { k: '#202020', w: '#EDEBFF', b: '#C8C2FF' },
      rows: ['', '.....kkkkkk', '....kwwwwwwk', '...kwwwwwwwwk', '..kwwkkwwkkwwk', '..kwwkkwwkkwwk', '..kwwwwwwwwwwk', '..kwwwwkkwwwwk', '..kwwwwkkwwwwk', '..kwwwwwwwwwwk', '..kbwwwwwwwwbk', '..kbbwwwwwwbbk', '..kwkwwkwwkwwk', '..kk.kk.kk.kkk'] }
  ];
  MONSTERS.forEach((m) => { m.img = sprite(m.rows, m.pal); m.big = sprite(m.rows, m.pal, 3); m.shadow = silhouette(m.img); m.bigShadow = silhouette(m.big); });

  // ---------- player & NPC sprites (drawn in code) ----------
  function personSprite(dir, frame, colors) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const { cap, shirt, skin = '#F2C29B', hair = '#5A3A22', pants = '#2E3A66' } = colors;
    // legs (walk cycle)
    const off = frame ? 1 : 0;
    R(5, 12, 2, 3 + (frame ? -1 : 0), pants); R(9, 12, 2, 3 + (frame ? 0 : -1), pants);
    R(4 + (frame ? 0 : 0), 15 - off, 3, 1, '#202020'); R(9, 15 - (1 - off), 3, 1, '#202020');
    // body
    R(4, 8, 8, 5, shirt); R(3, 9, 1, 3, skin); R(12, 9, 1, 3, skin);
    R(4, 8, 8, 1, '#00000022');
    // head
    R(4, 2, 8, 6, skin);
    R(4, 2, 8, 2, hair);
    if (cap) { R(3, 1, 10, 2, cap); if (dir === 'down') R(4, 3, 8, 1, cap); if (dir === 'left') R(1, 3, 4, 1, cap); if (dir === 'right') R(11, 3, 4, 1, cap); if (dir === 'up') R(4, 3, 8, 2, cap); }
    if (dir === 'down') { R(5, 5, 1, 1, '#202020'); R(10, 5, 1, 1, '#202020'); R(7, 7, 2, 1, '#C47B5A'); }
    if (dir === 'left') { R(5, 5, 1, 1, '#202020'); R(4, 6, 1, 1, skin); }
    if (dir === 'right') { R(10, 5, 1, 1, '#202020'); }
    if (dir === 'up') R(4, 4, 8, 3, hair);
    // outline-ish shadow
    g.globalCompositeOperation = 'destination-over'; R(3, 15, 10, 1, '#00000040');
    return c;
  }
  const PLAYER = {};
  ['down', 'up', 'left', 'right'].forEach((d) => { PLAYER[d] = [0, 1].map((f) => personSprite(d, f, { cap: '#3D7BF7', shirt: '#E8412E' })); });
  const FILIP = personSprite('down', 0, { cap: null, shirt: '#F4F4F4', hair: '#4A2E1C' });
  // parrots on Filip's shirt
  (() => { const g = FILIP.getContext('2d'); g.fillStyle = '#E8412E'; g.fillRect(5, 9, 1, 1); g.fillRect(9, 11, 1, 1); g.fillStyle = '#3D7BF7'; g.fillRect(10, 9, 1, 1); g.fillRect(6, 11, 1, 1); })();

  // ---------- tiles ----------
  const TILE = {};
  function tile(fn) { const c = document.createElement('canvas'); c.width = 16; c.height = 16; fn(c.getContext('2d')); return c; }
  const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const seeded = (n) => { let s = n; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  TILE.grass = tile((g) => { g.fillStyle = '#7CCB55'; g.fillRect(0, 0, 16, 16); const r = seeded(3); for (let i = 0; i < 10; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, '#69B544'); px(g, 3, 4, '#9BDF6E'); px(g, 11, 12, '#9BDF6E'); });
  TILE.tall = tile((g) => { g.drawImage(TILE.grass, 0, 0); for (let x = 0; x < 16; x += 4) for (let y = 2; y < 16; y += 5) { g.fillStyle = '#3E8E2E'; g.fillRect(x + 1, y, 1, 4); g.fillRect(x + 2, y - 1, 1, 5); g.fillStyle = '#56A83C'; g.fillRect(x + 3, y + 1, 1, 3); } });
  TILE.path = tile((g) => { g.fillStyle = '#E3C68A'; g.fillRect(0, 0, 16, 16); const r = seeded(7); for (let i = 0; i < 8; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, '#C9A86A'); for (let i = 0; i < 4; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, '#F2DCA8'); });
  TILE.sand = tile((g) => { g.fillStyle = '#F0DFA8'; g.fillRect(0, 0, 16, 16); const r = seeded(11); for (let i = 0; i < 6; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, '#D9C48A'); });
  TILE.water = [0, 1].map((f) => tile((g) => { g.fillStyle = '#4A90F0'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#7DB4FF'; for (let y = 3; y < 16; y += 6) { g.fillRect((f * 4 + y) % 16, y, 4, 1); g.fillRect((f * 4 + y + 8) % 16, y + 2, 3, 1); } }));
  TILE.tree = tile((g) => { g.drawImage(TILE.grass, 0, 0); g.fillStyle = '#6B4A2A'; g.fillRect(6, 11, 4, 5); g.fillStyle = '#2F7A2F'; g.beginPath(); g.arc(8, 7, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3F9A3A'; g.beginPath(); g.arc(6, 5, 4, 0, Math.PI * 2); g.fill(); px(g, 5, 4, '#6CC65A'); px(g, 6, 3, '#6CC65A'); });
  TILE.flower = tile((g) => { g.drawImage(TILE.grass, 0, 0); [[3, 4, '#FF6B8A'], [11, 3, '#FFD23F'], [6, 11, '#FFFFFF'], [12, 12, '#FF6B8A']].forEach(([x, y, c]) => { px(g, x, y - 1, c); px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y + 1, c); px(g, x, y, '#FFD23F'); }); });
  TILE.rock = tile((g) => { g.drawImage(TILE.grass, 0, 0); g.fillStyle = '#8E8E9A'; g.beginPath(); g.ellipse(8, 10, 6, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#B4B4C0'; g.fillRect(5, 7, 4, 2); g.fillStyle = '#5E5E6A'; g.fillRect(4, 13, 9, 1); });
  TILE.fence = tile((g) => { g.drawImage(TILE.grass, 0, 0); g.fillStyle = '#C08A4E'; g.fillRect(0, 6, 16, 2); g.fillRect(0, 10, 16, 2); g.fillRect(2, 4, 2, 10); g.fillRect(12, 4, 2, 10); });
  TILE.sign = tile((g) => { g.drawImage(TILE.path, 0, 0); g.fillStyle = '#6B4A2A'; g.fillRect(7, 9, 2, 6); g.fillStyle = '#C08A4E'; g.fillRect(2, 3, 12, 7); g.fillStyle = '#8A5E30'; g.fillRect(2, 9, 12, 1); g.fillStyle = '#5A3A1A'; g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1); });

  // house (3×3 tiles) drawn as one 48×48 image
  const HOUSE = (() => {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48; const g = c.getContext('2d');
    g.fillStyle = '#C2304F'; g.fillRect(0, 4, 48, 18); g.fillStyle = '#9E2240'; for (let y = 6; y < 22; y += 4) g.fillRect(0, y, 48, 1);
    g.fillStyle = '#F4EBD8'; g.fillRect(3, 22, 42, 24); g.fillStyle = '#D8CBB0'; g.fillRect(3, 44, 42, 2);
    g.fillStyle = '#5B3DF5'; g.fillRect(19, 30, 10, 16); g.fillStyle = '#FFD23F'; g.fillRect(26, 38, 2, 2);
    g.fillStyle = '#9DD7FF'; g.fillRect(7, 28, 8, 7); g.fillRect(33, 28, 8, 7); g.fillStyle = '#ffffff'; g.fillRect(8, 29, 2, 2); g.fillRect(34, 29, 2, 2);
    g.fillStyle = '#202020'; g.fillRect(0, 22, 48, 1);
    return c;
  })();

  // ---------- map ----------
  const MAP_SRC = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T,,,,,,..TTT....*....TT,,,,,,T',
    'T,,,,,,,..T.=========.T,,,,,,T',
    'T,,,TT,,....=HHH=*...,,,,TT,,T',
    'T,,,,,,,....=HHH=....,,,,,,,,T',
    'T..,,,,.....=HHH=.......,,,..T',
    'T....*......==S==....*.......T',
    'T...........=====............T',
    'T.*....============.....R....T',
    'T......=.......*...=.........T',
    'TTTT...=..ssssss...=...,,,,,,T',
    'T,,,...=..s~~~~s...=...,,,,,,T',
    'T,,,,..=..s~~~~~s..=..,,,,,,,T',
    'T,,,,,.=..s~~~~~s..=..,,TT,,,T',
    'T,,,,,.=...s~~~s...=..,,,,,,,T',
    'T,,,,..=....sss....=...,,,,,,T',
    'T......=============.........T',
    'T..TT.......*.........TT.....T',
    'T,,,,,,,,....R....,,,,,,,,,,,T',
    'T,,,,,,,,,......,,,,,,,,,,,,,T',
    'T,,,,,,,,,,,..,,,,,,,,,,,,,,,T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
  ].map((r) => r.padEnd(30, 'T').slice(0, 30));
  const MW = 30, MH = MAP_SRC.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 'T' : MAP_SRC[y][x]);
  const SOLID = new Set(['T', '~', 'H', 'R', '#', 'S']);
  const NPC = { x: 17, y: 5, name: 'Filip' };
  const zoneOf = (x, y) => (y >= 17 ? 'south' : x >= 18 ? 'east' : 'meadow');

  // ---------- state ----------
  let caught = new Set();
  try { (JSON.parse(localStorage.getItem(SAVE) || '[]')).forEach((id) => caught.add(id)); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(SAVE, JSON.stringify([...caught])); } catch (e) { /* ignore */ } };
  const P = { x: 14, y: 8, px: 14 * T, py: 8 * T, dir: 'down', moving: false, t: 0, fromX: 0, fromY: 0, step: 0 };
  let mode = 'title';          // title | world | dialog | trans | battle | dex | win
  let dialog = null;           // { lines, page, then }
  let battle = null;
  let dexSel = 0;
  let clock = 0, flash = 0;
  const held = {};
  const pressed = {};

  // ---------- sound ----------
  let actx = null;
  function note(freq, dur = 0.08, type = 'square', vol = 0.06, when = 0) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + when;
      o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  const tune = (seq, step = 0.09) => seq.forEach((f, i) => f && note(f, step * 0.9, 'square', 0.05, i * step));
  const SFX = {
    blip: () => note(880, 0.04, 'square', 0.04),
    bump: () => note(110, 0.06, 'square', 0.05),
    encounter: () => tune([523, 0, 523, 659, 784, 1046], 0.07),
    throw: () => tune([392, 494, 587], 0.05),
    wobble: () => note(220, 0.08, 'triangle', 0.08),
    caught: () => tune([523, 659, 784, 1046, 0, 784, 1046], 0.08),
    miss: () => tune([392, 330, 262], 0.09),
    win: () => tune([523, 523, 784, 784, 880, 880, 784, 0, 698, 698, 659, 659, 587, 587, 523], 0.12)
  };

  // ---------- dialog ----------
  function say(lines, then) { dialog = { pages: lines.flatMap((l) => chunk(wrap(l, 36))), page: 0, then }; mode = 'dialog'; SFX.blip(); }
  function chunk(lines) { const out = []; for (let i = 0; i < lines.length; i += 2) out.push(lines.slice(i, i + 2)); return out; }
  function drawBox(g, x, y, w, h) {
    g.fillStyle = '#F8F8F0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#202020'; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    g.fillStyle = '#5B3DF5'; g.fillRect(x + 2, y + 2, w - 4, 1); g.fillRect(x + 2, y + h - 3, w - 4, 1); g.fillRect(x + 2, y + 2, 1, h - 4); g.fillRect(x + w - 3, y + 2, 1, h - 4);
  }
  function drawDialog(g) {
    if (!dialog) return;
    drawBox(g, 4, 118, 232, 38);
    dialog.pages[dialog.page].forEach((l, i) => text(g, l, 12, 126 + i * 11));
    if (Math.floor(clock * 3) % 2) { g.fillStyle = '#E8412E'; g.fillRect(224, 147, 5, 3); g.fillRect(225, 150, 3, 1); }
  }
  function advanceDialog() {
    SFX.blip();
    dialog.page++;
    if (dialog.page >= dialog.pages.length) { const then = dialog.then; dialog = null; mode = 'world'; if (then) then(); }
  }

  // ---------- world ----------
  function tryMove(dx, dy, dir) {
    P.dir = dir;
    const nx = P.x + dx, ny = P.y + dy;
    if (SOLID.has(at(nx, ny)) || (nx === NPC.x && ny === NPC.y)) { if (!P.bumped) { SFX.bump(); P.bumped = true; } return; }
    P.bumped = false;
    P.moving = true; P.t = 0; P.fromX = P.x; P.fromY = P.y; P.x = nx; P.y = ny;
  }
  function onStep() {
    P.step++;
    if (at(P.x, P.y) === ',' && Math.random() < 0.13) startEncounter();
  }
  function interact() {
    const dx = { left: -1, right: 1, up: 0, down: 0 }[P.dir], dy = { up: -1, down: 1, left: 0, right: 0 }[P.dir];
    const tx = P.x + dx, ty = P.y + dy;
    if (tx === NPC.x && ty === NPC.y) {
      const left = MONSTERS.length - caught.size;
      if (left === 0) say(['FILIP: You caught all eight! The backlog has never looked this groomed.', 'If you want to talk products for real, my contact details are on my portfolio. Thanks for playing!']);
      else if (caught.size === 0) say(['FILIP: Welcome to Backlog Valley! Eight monsters live in the tall grass.', 'Walk into the grass, then throw a sticky note when the marker hits the green zone. Press X to open your Backlogdex.']);
      else say([`FILIP: ${caught.size} down, ${left} to go. Rare ones hide in the south and east.`, 'Tip: Retro shows up anywhere, but only once in a while.']);
      return;
    }
    if (at(tx, ty) === 'S') say(['SIGN: PRODUCT STUDIO. Discovery first, then delivery. Please wipe your feet.']);
    else if (at(tx, ty) === '~') say(['The pond is calm. Somewhere below, a legacy system sleeps.']);
    else if (at(tx, ty) === 'H') say(['The door is locked. A sticky note says: BACK AFTER THE SPRINT REVIEW.']);
  }
  function drawWorld(g) {
    const camX = Math.max(0, Math.min(MW * T - VW, P.px + 8 - VW / 2));
    const camY = Math.max(0, Math.min(MH * T - VH, P.py + 8 - VH / 2));
    const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    const wf = Math.floor(clock * 2) % 2;
    for (let y = y0; y <= y0 + VH / T + 1; y++) for (let x = x0; x <= x0 + VW / T + 1; x++) {
      const k = at(x, y), sx = x * T - camX, sy = y * T - camY;
      const img = k === 'T' ? TILE.tree : k === ',' ? TILE.tall : k === '=' ? TILE.path : k === 's' ? TILE.sand : k === '~' ? TILE.water[wf] : k === '*' ? TILE.flower : k === 'R' ? TILE.rock : k === '#' ? TILE.fence : k === 'S' ? TILE.sign : k === 'H' ? TILE.path : TILE.grass;
      g.drawImage(img, Math.round(sx), Math.round(sy));
    }
    g.drawImage(HOUSE, 13 * T - camX, 3 * T - camY - 6);
    // NPC + player, y-sorted
    const bob = Math.floor(clock * 2) % 2;
    const ents = [
      { y: NPC.y * T, draw: () => g.drawImage(FILIP, NPC.x * T - camX, NPC.y * T - camY - bob) },
      { y: P.py, draw: () => {
        const frame = P.moving ? Math.floor(P.t * 4) % 2 : 0;
        g.drawImage(PLAYER[P.dir][frame], Math.round(P.px - camX), Math.round(P.py - camY) - 2);
        if (at(P.x, P.y) === ',' && !P.moving) { g.drawImage(TILE.tall, 0, 10, 16, 6, Math.round(P.px - camX), Math.round(P.py - camY) + 10, 16, 6); }
      } }
    ];
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    // HUD chip
    g.fillStyle = 'rgba(32,32,32,.7)'; g.fillRect(4, 4, 70, 11);
    text(g, `DEX ${caught.size}/${MONSTERS.length}`, 7, 6, '#FFD23F');
  }
  function updateWorld(dt) {
    if (P.moving) {
      P.t += dt / 0.16;
      if (P.t >= 1) { P.t = 1; P.moving = false; }
      P.px = (P.fromX + (P.x - P.fromX) * P.t) * T; P.py = (P.fromY + (P.y - P.fromY) * P.t) * T;
      if (!P.moving) onStep();
      return;
    }
    if (mode !== 'world') return;
    if (held.ArrowUp || held.w) tryMove(0, -1, 'up');
    else if (held.ArrowDown || held.s) tryMove(0, 1, 'down');
    else if (held.ArrowLeft || held.a) tryMove(-1, 0, 'left');
    else if (held.ArrowRight || held.d) tryMove(1, 0, 'right');
  }

  // ---------- encounters & battle ----------
  function pickMonster() {
    const zone = zoneOf(P.x, P.y);
    if (Math.random() < 0.06) return MONSTERS.find((m) => m.id === 'retro');
    const pool = MONSTERS.filter((m) => m.zone === zone || (zone !== 'meadow' && m.zone === 'meadow' && Math.random() < 0.3));
    const weighted = pool.flatMap((m) => Array(m.rarity === 1 ? 6 : m.rarity === 2 ? 3 : 1).fill(m));
    return weighted[(Math.random() * weighted.length) | 0];
  }
  function startEncounter() {
    const m = pickMonster();
    SFX.encounter();
    mode = 'trans'; flash = 0;
    battle = { m, phase: 'intro', t: 0, menu: 0, bar: 0, dir: 1, msg: [`A wild ${m.name.toUpperCase()} appeared!`], wobble: 0, tries: 0, note: null };
  }
  function battleText(lines, then) { battle.msg = lines; battle.after = then; battle.phase = 'text'; }
  function battleAction() {
    const b = battle;
    if (b.phase === 'intro' || b.phase === 'text') {
      SFX.blip();
      if (b.phase === 'intro') { b.phase = 'menu'; return; }
      const then = b.after; b.after = null; if (then) then(); else b.phase = 'menu';
      return;
    }
    if (b.phase === 'menu') {
      SFX.blip();
      if (b.menu === 0) { b.phase = 'aim'; b.bar = 0; b.dir = 1; }
      else battleText(['You got away safely.'], () => endBattle());
      return;
    }
    if (b.phase === 'aim') {
      const zone = zoneFor(b.m);
      const hit = Math.abs(b.bar - 0.5) < zone / 2;
      b.tries++;
      SFX.throw();
      b.phase = 'throw'; b.t = 0; b.hit = hit;
    }
  }
  const zoneFor = (m) => (m.rarity === 1 ? 0.3 : m.rarity === 2 ? 0.19 : 0.12);
  function endBattle() { battle = null; mode = 'world'; }
  function updateBattle(dt) {
    const b = battle;
    b.t += dt;
    if (b.phase === 'aim') {
      const speed = b.m.rarity === 1 ? 0.9 : b.m.rarity === 2 ? 1.3 : 1.8;
      b.bar += b.dir * speed * dt;
      if (b.bar > 1) { b.bar = 1; b.dir = -1; } if (b.bar < 0) { b.bar = 0; b.dir = 1; }
    }
    if (b.phase === 'throw' && b.t > 0.6) {
      if (b.hit) { b.phase = 'wobble'; b.t = 0; b.wobble = 0; }
      else {
        SFX.miss();
        const flee = Math.random() < 0.35 + b.tries * 0.1;
        battleText(flee ? ['Missed!', `${b.m.name.toUpperCase()} slipped back into the backlog.`] : ['Missed! The sticky note fell off.'], flee ? () => endBattle() : null);
      }
    }
    if (b.phase === 'wobble') {
      const w = Math.floor(b.t / 0.45);
      if (w !== b.wobble && w <= 3) { b.wobble = w; if (w < 3) SFX.wobble(); }
      if (b.t > 1.6) {
        const isNew = !caught.has(b.m.id);
        caught.add(b.m.id); save(); SFX.caught();
        battleText([`Gotcha! ${b.m.name.toUpperCase()} was added to the Backlogdex.`, isNew ? b.m.desc : 'You already had one. It goes to the icebox.'], () => {
          endBattle();
          if (caught.size === MONSTERS.length) { mode = 'win'; SFX.win(); }
        });
      }
    }
  }
  function drawBattle(g) {
    const b = battle, m = b.m;
    // sky + ground
    g.fillStyle = '#F8F0D8'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#E8DCB8'; for (let y = 0; y < 110; y += 4) g.fillRect(0, y, VW, 1);
    // platforms
    g.fillStyle = '#A8D88A'; g.beginPath(); g.ellipse(175, 72, 46, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8CC46E'; g.beginPath(); g.ellipse(175, 74, 40, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#A8D88A'; g.beginPath(); g.ellipse(62, 114, 54, 12, 0, 0, Math.PI * 2); g.fill();
    // monster
    const slide = b.phase === 'intro' ? Math.max(0, 1 - b.t * 1.6) : 0;
    let mx = 151 + slide * 140, my = 26 + Math.round(Math.sin(clock * 4) * 1.5);
    if (b.phase === 'wobble') {
      // the monster is "inside" the sticky note now
      const w = b.t % 0.45 < 0.2 ? Math.sin(b.t * 30) * 3 : 0;
      g.save(); g.translate(175 + w, 62);
      g.fillStyle = '#FFD23F'; g.fillRect(-12, -12, 24, 24); g.fillStyle = '#E8BE2A'; g.fillRect(-12, -12, 24, 5); g.fillStyle = '#202020'; g.fillRect(-12, 12, 24, 1);
      text(g, 'TODO', -11, -3, '#202020');
      g.restore();
    } else {
      g.drawImage(m.big, Math.round(mx), my);
    }
    if (b.phase === 'throw') {
      const t = Math.min(1, b.t / 0.6);
      const sx = 60 + (175 - 60) * t, sy = 100 - Math.sin(t * Math.PI) * 60 + (62 - 100) * t;
      g.save(); g.translate(sx, sy); g.rotate(t * 8); g.fillStyle = '#FFD23F'; g.fillRect(-5, -5, 10, 10); g.fillStyle = '#202020'; g.fillRect(-5, 4, 10, 1); g.restore();
    }
    // trainer (back view)
    g.drawImage(PLAYER.up[0], 0, 0, 16, 16, 40, 76, 32, 32);
    // name card
    drawBox(g, 6, 8, 104, 26);
    text(g, m.name, 12, 13);
    text(g, caught.has(m.id) ? 'CAUGHT BEFORE' : `RARITY ${'*'.repeat(m.rarity)}`, 12, 23, '#5B3DF5');
    // bottom panel
    if (b.phase === 'intro' || b.phase === 'text') {
      drawBox(g, 4, 118, 232, 38);
      const lines = b.msg.flatMap((l) => wrap(l, 36)).slice(0, 3);
      lines.forEach((l, i) => text(g, l, 12, 124 + i * 10));
    } else if (b.phase === 'menu') {
      drawBox(g, 4, 118, 120, 38); text(g, 'WHAT WILL', 12, 126); text(g, 'YOU DO?', 12, 137);
      drawBox(g, 126, 118, 110, 38);
      ['THROW NOTE', 'RUN'].forEach((o, i) => { text(g, o, 142, 126 + i * 12); if (b.menu === i) text(g, '>', 133, 126 + i * 12, '#E8412E'); });
    } else if (b.phase === 'aim') {
      drawBox(g, 4, 118, 232, 38);
      text(g, 'PRESS A WHEN IN THE GREEN!', 12, 123);
      const bx = 14, bw = 212, by = 136, z = zoneFor(m);
      g.fillStyle = '#E0D8C8'; g.fillRect(bx, by, bw, 12);
      g.fillStyle = '#7CCB55'; g.fillRect(bx + bw * (0.5 - z / 2), by, bw * z, 12);
      g.fillStyle = '#202020'; g.fillRect(bx + bw * b.bar - 1, by - 3, 3, 18);
    } else if (b.phase === 'throw' || b.phase === 'wobble') {
      drawBox(g, 4, 118, 232, 38);
      text(g, b.phase === 'throw' ? 'YOU THREW A STICKY NOTE!' : '...', 12, 128);
    }
  }

  // ---------- dex ----------
  function drawDex(g) {
    g.fillStyle = '#2B2A3F'; g.fillRect(0, 0, VW, VH);
    text(g, 'BACKLOGDEX', 8, 6, '#FFD23F');
    text(g, `${caught.size}/${MONSTERS.length} CAUGHT`, 160, 6, '#C8C2FF');
    MONSTERS.forEach((m, i) => {
      const x = 8 + (i % 4) * 58, y = 18 + Math.floor(i / 4) * 52;
      g.fillStyle = i === dexSel ? '#5B3DF5' : '#3A3950'; g.fillRect(x, y, 54, 48);
      const has = caught.has(m.id);
      g.drawImage(has ? m.img : m.shadow, 0, 0, 16, 16, x + 11, y + 4, 32, 32);
      text(g, has ? m.name.slice(0, 8) : '???', x + 3, y + 39, has ? '#FFFFFF' : '#8A88A8');
    });
    const m = MONSTERS[dexSel];
    drawBox(g, 4, 124, 232, 32);
    const has = caught.has(m.id);
    wrap(has ? m.desc : 'Not caught yet. Look for it in the tall grass.', 36).slice(0, 2).forEach((l, i) => text(g, l, 10, 129 + i * 11));
  }

  // ---------- title & win ----------
  function drawTitle(g) {
    g.fillStyle = '#5B3DF5'; g.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect((i * 37 + clock * 20) % VW, (i * 53) % VH, 2, 2); }
    const title = 'BACKLOG';
    g.save(); g.scale(2, 2); text(g, title, (VW / 2 - title.length * 6) / 2, 10, '#FFD23F', '#202020'); text(g, 'MONSTERS', (VW / 2 - 8 * 6) / 2, 20, '#FFFFFF', '#202020'); g.restore();
    MONSTERS.forEach((m, i) => g.drawImage(m.img, 12 + i * 28, 82 + Math.round(Math.sin(clock * 3 + i) * 3)));
    if (Math.floor(clock * 2) % 2) text(g, 'PRESS SPACE OR TAP', (VW - 18 * 6) / 2, 118, '#FFFFFF');
    text(g, 'A TINY GAME BY FILIP STOLARSKI', (VW - 30 * 6) / 2, 146, '#C8C2FF');
  }
  function drawWin(g) {
    g.fillStyle = '#202020'; g.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 60; i++) { g.fillStyle = ['#FFD23F', '#E8412E', '#7CCB55', '#6FB7FF'][i % 4]; g.fillRect((i * 41) % VW, (i * 29 + clock * 40 * (1 + (i % 3))) % VH, 2, 2); }
    text(g, 'BACKLOG GROOMED!', (VW - 16 * 6) / 2, 24, '#FFD23F');
    MONSTERS.forEach((m, i) => g.drawImage(m.img, 24 + i * 25, 50 + Math.round(Math.sin(clock * 4 + i) * 3)));
    wrap('You caught all eight backlog monsters. Inbox zero. Sprint goal met.', 36).forEach((l, i) => text(g, l, 12, 84 + i * 11, '#FFFFFF'));
    text(g, 'PRESS SPACE TO KEEP EXPLORING', (VW - 29 * 6) / 2, 138, '#C8C2FF');
  }

  // ---------- loop ----------
  const buf = document.createElement('canvas'); buf.width = VW; buf.height = VH;
  const g = buf.getContext('2d');
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    const A = pressed[' '] || pressed.Enter || pressed.z, X = pressed.x || pressed.X;
    if (mode === 'title') { if (A) { mode = 'world'; if (!caught.size) say(['FILIP: Oh, hi! Come talk to me - I am standing by the studio.']); } drawTitle(g); }
    else if (mode === 'world' || mode === 'dialog') {
      updateWorld(dt);
      if (mode === 'world' && !P.moving) { if (A) interact(); else if (X) { mode = 'dex'; SFX.blip(); } }
      else if (mode === 'dialog' && A) advanceDialog();
      drawWorld(g); drawDialog(g);
    } else if (mode === 'trans') {
      flash += dt;
      drawWorld(g);
      if (Math.floor(flash * 10) % 2) { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, VW, VH); }
      const k = Math.min(1, Math.max(0, (flash - 0.5) / 0.4));
      g.fillStyle = '#202020'; g.fillRect(0, 0, VW, VH * k / 2); g.fillRect(0, VH - VH * k / 2, VW, VH * k / 2);
      if (flash > 0.95) { mode = 'battle'; battle.t = 0; }
    } else if (mode === 'battle') {
      if (battle.phase === 'menu') { if (pressed.ArrowUp || pressed.ArrowDown || pressed.w || pressed.s) { battle.menu = 1 - battle.menu; SFX.blip(); } }
      if (A) battleAction();
      if (mode === 'battle') { updateBattle(dt); if (battle) drawBattle(g); }
      if (mode === 'world') drawWorld(g);
    } else if (mode === 'dex') {
      if (pressed.ArrowRight || pressed.d) dexSel = (dexSel + 1) % 8;
      if (pressed.ArrowLeft || pressed.a) dexSel = (dexSel + 7) % 8;
      if (pressed.ArrowDown || pressed.s || pressed.ArrowUp || pressed.w) dexSel = (dexSel + 4) % 8;
      if (X || A || pressed.Escape) { mode = 'world'; SFX.blip(); }
      drawDex(g);
    } else if (mode === 'win') { if (A) mode = 'world'; drawWin(g); }
    for (const k in pressed) delete pressed[k];
    out.imageSmoothingEnabled = false;
    out.drawImage(buf, 0, 0);
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  const keyName = (k) => (k.length === 1 ? k.toLowerCase() : k);
  window.addEventListener('keydown', (e) => {
    const k = keyName(e.key);
    if (!held[k]) pressed[k] = true;
    held[k] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { held[keyName(e.key)] = false; });
  screen.addEventListener('pointerdown', () => { pressed[' '] = true; });
  document.querySelectorAll('.pad [data-k]').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed[k] = true; held[k] = true; b.classList.add('on'); });
    const up = () => { held[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });

  requestAnimationFrame(frame);
})();
