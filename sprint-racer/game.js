/* =============================================================
   Sprint Racer — top-down toy cars on a product owner's desk.
   Three laps = three sprints. Rivals: Scope Creep & Tech Debt.
   No build step, no dependencies. MIT © Filip Stolarski.
   ============================================================= */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WORLD = { w: 2600, h: 1700 };
  const HALF = 74;               // track half-width (px)
  const LAPS = 3;
  const CP_COUNT = 16;
  const STORE = 'sprint-racer:v1';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const fmt = (t) => { if (t == null || !isFinite(t)) return '–:––.––'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

  // ---------- track: closed Catmull-Rom spline ----------
  const CTRL = [
    [470, 1340], [1300, 1410], [2050, 1330], [2310, 1060], [2250, 720], [1960, 520], [1600, 560],
    [1360, 800], [1060, 830], [820, 610], [720, 330], [450, 380], [300, 700], [330, 1090]
  ];
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }
  const SAMPLES = [];
  (() => {
    const n = CTRL.length, per = 40;
    for (let i = 0; i < n; i++) {
      const p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i], p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
      for (let k = 0; k < per; k++) { const [x, y] = catmull(p0, p1, p2, p3, k / per); SAMPLES.push({ x, y }); }
    }
    for (let i = 0; i < SAMPLES.length; i++) {
      const a = SAMPLES[i], b = SAMPLES[(i + 1) % SAMPLES.length];
      a.ang = Math.atan2(b.y - a.y, b.x - a.x);
    }
    for (let i = 0; i < SAMPLES.length; i++) {
      // curvature ≈ how much the direction changes over the next stretch
      const a = SAMPLES[i].ang, b = SAMPLES[(i + 12) % SAMPLES.length].ang;
      SAMPLES[i].curve = Math.abs(angDiff(a, b));
    }
  })();
  const N = SAMPLES.length;
  const CPS = Array.from({ length: CP_COUNT }, (_, i) => Math.floor((i / CP_COUNT) * N));

  function nearest(x, y, hint = -1) {
    let best = 0, bd = Infinity;
    const scan = hint < 0 ? N : 60;
    for (let k = 0; k < scan; k++) {
      const i = hint < 0 ? k : (hint - 20 + k + N) % N;
      const s = SAMPLES[i], d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bd) };
  }

  // ---------- static layer: desk, props, track ----------
  const deskCanvas = document.createElement('canvas');
  deskCanvas.width = WORLD.w; deskCanvas.height = WORLD.h;
  const skidCanvas = document.createElement('canvas');
  skidCanvas.width = WORLD.w; skidCanvas.height = WORLD.h;
  const skid = skidCanvas.getContext('2d');

  function drawDesk() {
    const d = deskCanvas.getContext('2d');
    // wood
    d.fillStyle = '#C99A62'; d.fillRect(0, 0, WORLD.w, WORLD.h);
    for (let y = 0; y < WORLD.h; y += 7) {
      d.strokeStyle = `rgba(110, 66, 24, ${0.05 + Math.random() * 0.08})`; d.lineWidth = 1 + Math.random() * 2;
      d.beginPath(); d.moveTo(0, y);
      for (let x = 0; x <= WORLD.w; x += 80) d.lineTo(x, y + Math.sin(x * 0.004 + y * 0.03) * 4);
      d.stroke();
    }
    for (let i = 0; i < 14; i++) { // knots
      const x = Math.random() * WORLD.w, y = Math.random() * WORLD.h;
      d.strokeStyle = 'rgba(90, 50, 15, .18)'; d.lineWidth = 2;
      for (let r = 6; r < 40; r += 7) { d.beginPath(); d.ellipse(x, y, r * 2.4, r, 0, 0, Math.PI * 2); d.stroke(); }
    }
    // coffee rings
    [[1180, 1080], [2420, 250], [160, 1500]].forEach(([x, y]) => {
      d.strokeStyle = 'rgba(80, 40, 10, .25)'; d.lineWidth = 7; d.beginPath(); d.arc(x, y, 62, 0.3, Math.PI * 1.85); d.stroke();
    });
    // sticky notes (infield + outside)
    const note = (x, y, r, c, t1, t2) => {
      d.save(); d.translate(x, y); d.rotate(r);
      d.fillStyle = 'rgba(0,0,0,.18)'; d.fillRect(-82, -76, 170, 170);
      d.fillStyle = c; d.fillRect(-90, -86, 170, 170);
      d.fillStyle = 'rgba(0,0,0,.06)'; d.fillRect(-90, -86, 170, 26);
      d.fillStyle = '#222'; d.font = '700 26px "Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive';
      d.fillText(t1, -74, -6); d.font = '22px "Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive'; d.fillText(t2, -74, 30);
      d.restore();
    };
    note(1700, 1050, -0.12, '#FFD23F', 'SPRINT 1', 'ship the MVP');
    note(1920, 870, 0.1, '#9DB4FF', 'TODO', 'fix the brakes');
    note(560, 820, 0.08, '#FF9EC4', 'RETRO', 'drive faster?');
    note(2420, 1550, -0.2, '#B6F07A', 'DONE', 'lap 1 ✓');
    note(120, 160, 0.15, '#FFD23F', 'BACKLOG', 'more laps');
    note(1150, 140, -0.06, '#F7F4EC', 'DoD', 'cross the line');
    // pencil
    d.save(); d.translate(1350, 1580); d.rotate(-0.05);
    d.fillStyle = '#F5B800'; d.fillRect(-260, -14, 440, 28);
    d.fillStyle = '#E9C9A0'; d.beginPath(); d.moveTo(180, -14); d.lineTo(240, 0); d.lineTo(180, 14); d.fill();
    d.fillStyle = '#333'; d.beginPath(); d.moveTo(226, -4); d.lineTo(240, 0); d.lineTo(226, 4); d.fill();
    d.fillStyle = '#E8806E'; d.fillRect(-300, -14, 40, 28); d.fillStyle = '#bbb'; d.fillRect(-268, -14, 14, 28);
    d.restore();
    // paper clips
    d.strokeStyle = '#9aa4ad'; d.lineWidth = 4;
    [[900, 1180, 0.4], [2350, 380, -0.8]].forEach(([x, y, r]) => { d.save(); d.translate(x, y); d.rotate(r); d.beginPath(); d.roundRect(-30, -9, 60, 18, 9); d.stroke(); d.beginPath(); d.roundRect(-20, -4, 44, 8, 4); d.stroke(); d.restore(); });

    // track: shadow, kerb, edge line, asphalt, centre dashes
    const path = () => { d.beginPath(); SAMPLES.forEach((s, i) => (i ? d.lineTo(s.x, s.y) : d.moveTo(s.x, s.y))); d.closePath(); };
    d.lineJoin = 'round'; d.lineCap = 'round';
    d.save(); d.translate(6, 10); path(); d.strokeStyle = 'rgba(60,30,5,.35)'; d.lineWidth = HALF * 2 + 26; d.stroke(); d.restore();
    path(); d.strokeStyle = '#fff'; d.lineWidth = HALF * 2 + 22; d.stroke();
    path(); d.setLineDash([26, 26]); d.strokeStyle = '#E8412E'; d.lineWidth = HALF * 2 + 22; d.stroke(); d.setLineDash([]);
    path(); d.strokeStyle = '#f2f2f2'; d.lineWidth = HALF * 2 + 6; d.stroke();
    path(); d.strokeStyle = '#3b3d42'; d.lineWidth = HALF * 2; d.stroke();
    // asphalt speckle
    for (let i = 0; i < 2600; i++) {
      const s = SAMPLES[(Math.random() * N) | 0], a = Math.random() * Math.PI * 2, r = Math.random() * HALF;
      d.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; d.fillRect(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 2, 2);
    }
    path(); d.setLineDash([22, 26]); d.strokeStyle = 'rgba(255,255,255,.55)'; d.lineWidth = 3; d.stroke(); d.setLineDash([]);
    // start / finish (checkered)
    const s0 = SAMPLES[0];
    d.save(); d.translate(s0.x, s0.y); d.rotate(s0.ang + Math.PI / 2);
    for (let i = -HALF; i < HALF; i += 12) for (let j = 0; j < 3; j++) { d.fillStyle = ((i / 12 + j) | 0) % 2 ? '#111' : '#fff'; d.fillRect(i, -18 + j * 12, 12, 12); }
    d.restore();
    // grid boxes
    for (let k = 1; k <= 3; k++) {
      const s = SAMPLES[(N - k * 9) % N];
      d.save(); d.translate(s.x, s.y); d.rotate(s.ang);
      d.strokeStyle = 'rgba(255,255,255,.7)'; d.lineWidth = 3;
      d.strokeRect(-14, (k % 2 ? -1 : 1) * 34 - 12, 30, 24);
      d.restore();
    }
  }

  // ---------- cars ----------
  function carSprite(body, stripe) {
    const c = document.createElement('canvas'); c.width = 56; c.height = 34;
    const g = c.getContext('2d');
    g.translate(28, 17);
    g.fillStyle = '#151515'; [[-15, -14], [9, -14], [-15, 9], [9, 9]].forEach(([x, y]) => g.fillRect(x, y, 10, 5));
    g.fillStyle = body; g.strokeStyle = '#151515'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(-22, -11, 44, 22, 7); g.fill(); g.stroke();
    if (stripe) { g.fillStyle = stripe; g.fillRect(-22, -2, 44, 4); }
    g.fillStyle = '#bfe3ff'; g.beginPath(); g.roundRect(2, -8, 9, 16, 3); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(-12, -7, 12, 14, 3); g.fill();
    g.fillStyle = '#FFF6B0'; g.fillRect(19, -9, 3, 5); g.fillRect(19, 4, 3, 5);
    return c;
  }
  function makeCar(name, body, stripe, isAI, skill) {
    return { name, sprite: carSprite(body, stripe), color: body, isAI, skill, x: 0, y: 0, a: 0, vx: 0, vy: 0, steer: 0,
      lap: 0, nextCp: 1, idx: 0, offTrack: false, finished: false, time: null, lapStart: 0, laps: [], prog: 0, bump: 0 };
  }
  const player = makeCar('You', '#E8412E', '#fff', false, 1);
  const rivals = [makeCar('Scope Creep', '#4CAF50', '#1b5e20', true, 0.93), makeCar('Tech Debt', '#8D6E63', '#3e2723', true, 0.88)];
  const cars = [player, ...rivals];

  // ---------- state ----------
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 0, z: 1 };
  let state = 'countdown';          // countdown | race | done
  let clock = 0, raceTime = 0;
  let saved = { bestLap: null, bestRace: null, ghost: null };
  try { saved = { ...saved, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch (e) { /* ignore */ }
  let ghostRec = [], ghostPlay = saved.ghost;
  let particles = [];
  const keys = {};
  let muted = false;

  // ---------- audio ----------
  let actx = null, engine = null;
  function audioOn() {
    if (actx || muted) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0.04;
      o.connect(f); f.connect(g); g.connect(actx.destination); o.start();
      engine = { o, g };
    } catch (e) { /* no audio */ }
  }
  function beep(freq, dur = 0.12, vol = 0.12) {
    if (!actx || muted) return;
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  }

  // ---------- race setup ----------
  function reset() {
    const slots = [[N - 9, -34], [N - 18, 34], [N - 27, -34]];
    const grid = [rivals[0], player, rivals[1]];
    grid.forEach((c, k) => {
      const [si, off] = slots[k];
      const s = SAMPLES[si];
      c.x = s.x + Math.cos(s.ang + Math.PI / 2) * off; c.y = s.y + Math.sin(s.ang + Math.PI / 2) * off;
      c.a = s.ang; c.vx = c.vy = 0; c.steer = 0;
      // lap -1 = still behind the start line; crossing it starts sprint 1
      c.lap = -1; c.nextCp = 0; c.idx = si; c.finished = false; c.time = null; c.laps = []; c.lapStart = 0; c.prog = 0;
    });
    skid.clearRect(0, 0, WORLD.w, WORLD.h);
    state = 'countdown'; clock = 0; raceTime = 0; ghostRec = []; ghostPlay = saved.ghost;
    cam.x = player.x; cam.y = player.y;
  }

  // ---------- physics ----------
  function drive(c, throttle, steerIn, handbrake, dt) {
    const fx = Math.cos(c.a), fy = Math.sin(c.a);
    const rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy;
    let vl = c.vx * rx + c.vy * ry;
    const near = nearest(c.x, c.y, c.idx);
    c.idx = near.i;
    c.offTrack = near.d > HALF + 4;
    const maxF = c.offTrack ? 240 : 640 * (c.isAI ? c.skill : 1);
    const accel = throttle > 0 ? 560 : throttle < 0 ? (vf > 20 ? -900 : -320) : 0;
    vf += accel * dt;
    vf -= vf * (c.offTrack ? 2.4 : 0.45) * dt;
    vf = clamp(vf, -200, maxF);
    const grip = handbrake ? 0.965 : c.offTrack ? 0.9 : 0.86;
    vl *= Math.pow(grip, dt * 60);
    c.steer = lerp(c.steer, steerIn, Math.min(1, dt * 10));
    const turn = c.steer * clamp(Math.abs(vf) / 180, 0, 1) * (handbrake ? 3.6 : 2.9) * Math.sign(vf || 1);
    c.a += turn * dt;
    c.vx = fx * vf + rx * vl; c.vy = fy * vf + ry * vl;
    c.x = clamp(c.x + c.vx * dt, 20, WORLD.w - 20);
    c.y = clamp(c.y + c.vy * dt, 20, WORLD.h - 20);
    // skids & dust
    if (Math.abs(vl) > 70 || (handbrake && Math.abs(vf) > 120)) {
      skid.fillStyle = 'rgba(20,20,20,.22)';
      [-1, 1].forEach((side) => skid.fillRect(c.x - fx * 14 + rx * 9 * side - 2, c.y - fy * 14 + ry * 9 * side - 2, 4, 4));
    }
    if (c.offTrack && Math.abs(vf) > 80 && Math.random() < 0.5) particles.push({ x: c.x - fx * 16, y: c.y - fy * 16, vx: -fx * 30 + (Math.random() - 0.5) * 40, vy: -fy * 30 + (Math.random() - 0.5) * 40, t: 0.6, c: 'rgba(160,110,60,' });
    if (Math.abs(vl) > 110 && Math.random() < 0.6) particles.push({ x: c.x - fx * 16, y: c.y - fy * 16, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, t: 0.5, c: 'rgba(230,230,230,' });
    return vf;
  }
  function checkpoints(c) {
    const cp = SAMPLES[CPS[c.nextCp % CP_COUNT]];
    if (Math.hypot(cp.x - c.x, cp.y - c.y) < HALF * 1.9) {
      if (c.nextCp % CP_COUNT === 0) {
        // crossed the line
        const lapTime = raceTime - c.lapStart;
        const counted = c.lap >= 0;
        if (counted) c.laps.push(lapTime);
        c.lapStart = raceTime; c.lap++;
        if (!counted) { if (!c.isAI) ghostRec = []; c.nextCp = 1; c.prog = c.lap * N + c.idx; return; }
        if (!c.isAI) {
          beep(880, 0.12); setTimeout(() => beep(1320, 0.18), 120);
          if (saved.bestLap == null || lapTime < saved.bestLap) { saved.bestLap = lapTime; saved.ghost = ghostRec; persist(); }
          ghostRec = []; ghostPlay = saved.ghost;
        }
        if (c.lap >= LAPS) { c.finished = true; c.time = raceTime; if (!c.isAI) { if (saved.bestRace == null || raceTime < saved.bestRace) { saved.bestRace = raceTime; persist(); } } }
      }
      c.nextCp = (c.nextCp + 1) % CP_COUNT;
    }
    const along = c.lap < 0 && c.idx > N / 2 ? c.idx - N : c.idx;
    c.prog = c.lap * N + along + (c.lap < 0 ? N : 0) + (c.finished ? 1e6 - c.time * 100 : 0);
  }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) { /* full */ } }
  function aiControl(c, dt) {
    const look = 22 + Math.floor(Math.hypot(c.vx, c.vy) / 40);
    const t = SAMPLES[(c.idx + look) % N];
    const want = Math.atan2(t.y - c.y, t.x - c.x);
    const steer = clamp(angDiff(c.a, want) * 2.2, -1, 1);
    const curve = SAMPLES[(c.idx + look) % N].curve;
    const speed = Math.hypot(c.vx, c.vy);
    // rubber band: a bit faster when behind the player, a bit slower when far ahead
    const gap = (player.prog - c.prog) / N;
    const target = (620 - curve * 520) * c.skill * (1 + clamp(gap * 0.25, -0.12, 0.1));
    const throttle = speed < target ? 1 : speed > target + 60 ? -1 : 0;
    drive(c, throttle, steer, false, dt);
  }
  function collide() {
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = 30;
      if (d > 0 && d < min) {
        const nx = dx / d, ny = dy / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) { a.vx += nx * rel * 0.6; a.vy += ny * rel * 0.6; b.vx -= nx * rel * 0.6; b.vy -= ny * rel * 0.6; }
        if (a === player || b === player) beep(140, 0.05, 0.08);
      }
    }
  }

  // ---------- rendering ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
  }
  function drawCar(c, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.save(); ctx.translate(4, 6); ctx.rotate(c.a); ctx.beginPath(); ctx.roundRect(-22, -11, 44, 22, 7); ctx.fill(); ctx.restore();
    ctx.rotate(c.a);
    ctx.drawImage(c.sprite, -28, -17);
    ctx.restore();
    if (c.isAI && alpha === 1) {
      ctx.save(); ctx.font = '600 13px ui-rounded, "Avenir Next", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(c.name, c.x + 1, c.y - 25); ctx.fillStyle = '#fff'; ctx.fillText(c.name, c.x, c.y - 26); ctx.restore();
    }
  }
  function placeLabel(c) {
    const order = [...cars].sort((a, b) => b.prog - a.prog);
    return order.indexOf(c) + 1;
  }
  function hud() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const pad = 16;
    const panel = (x, y, w, h) => { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke(); };
    panel(pad, pad, 230, 112);
    ctx.fillStyle = '#222'; ctx.font = '800 26px ui-rounded, "Avenir Next", sans-serif';
    ctx.fillText(`Sprint ${clamp(player.lap + 1, 1, LAPS)}/${LAPS}`, pad + 16, pad + 36);
    ctx.font = '600 15px ui-rounded, "Avenir Next", sans-serif';
    ctx.fillText(`Time   ${fmt(raceTime)}`, pad + 16, pad + 62);
    ctx.fillText(`Lap    ${fmt(state === 'race' && player.lap >= 0 ? raceTime - player.lapStart : null)}`, pad + 16, pad + 82);
    ctx.fillStyle = '#7a5'; ctx.fillText(`Best   ${fmt(saved.bestLap)}`, pad + 16, pad + 102);
    // position
    const pos = placeLabel(player);
    panel(W - pad - 120, pad, 120, 76);
    ctx.fillStyle = '#222'; ctx.font = '900 40px ui-rounded, "Avenir Next", sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${pos}${['st', 'nd', 'rd'][pos - 1]}`, W - pad - 16, pad + 52);
    ctx.font = '600 12px ui-rounded, sans-serif'; ctx.fillText(`of ${cars.length}`, W - pad - 16, pad + 68); ctx.textAlign = 'left';
    // speed
    const sp = Math.round(Math.hypot(player.vx, player.vy) / 4);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '900 34px ui-rounded, sans-serif';
    ctx.fillText(`${sp}`, pad + 4, H - 74); ctx.font = '600 13px ui-rounded, sans-serif'; ctx.fillText('km/h (toy scale)', pad + 6, H - 56);
    minimap(W - pad - 180, H - pad - 140 - 46, 180, 120);
    if (state === 'countdown') {
      const steps = ['Planning', 'Refinement', 'Daily', 'GO!'];
      const k = Math.min(3, Math.floor(clock));
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - 170, H * 0.3 - 60, 340, 120, 20); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < k ? (k === 3 ? '#4CAF50' : '#E8412E') : '#ddd'; ctx.beginPath(); ctx.arc(W / 2 - 60 + i * 60, H * 0.3 - 22, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#222'; ctx.font = '900 30px ui-rounded, sans-serif';
      ctx.fillText(steps[k], W / 2, H * 0.3 + 38);
      ctx.textAlign = 'left';
    }
    if (state === 'done') results();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.font = '600 12px ui-rounded, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('←→ steer · ↑ gas · ↓ brake · Space drift · R restart · M mute', W - pad, H - 52); ctx.textAlign = 'left';
  }
  function minimap(x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    const sx = (w - 20) / WORLD.w, sy = (h - 20) / WORLD.h, s = Math.min(sx, sy);
    const ox = x + (w - WORLD.w * s) / 2, oy = y + (h - WORLD.h * s) / 2;
    ctx.beginPath(); SAMPLES.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * s, oy + p.y * s) : ctx.moveTo(ox + p.x * s, oy + p.y * s))); ctx.closePath();
    ctx.strokeStyle = '#3b3d42'; ctx.lineWidth = 6; ctx.stroke();
    cars.forEach((c) => { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(ox + c.x * s, oy + c.y * s, c === player ? 5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); });
  }
  function results() {
    const order = [...cars].sort((a, b) => b.prog - a.prog);
    const bw = Math.min(420, W - 32), bh = 250, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.font = '900 30px ui-rounded, sans-serif'; ctx.fillText('Sprint review', bx + 24, by + 46);
    ctx.font = '600 17px ui-rounded, sans-serif';
    order.forEach((c, i) => {
      ctx.fillStyle = c === player ? '#E8412E' : '#222';
      ctx.fillText(`${i + 1}. ${c.name}`, bx + 24, by + 86 + i * 30);
      ctx.textAlign = 'right'; ctx.fillText(c.finished ? fmt(c.time) : 'still racing…', bx + bw - 24, by + 86 + i * 30); ctx.textAlign = 'left';
    });
    ctx.fillStyle = '#555'; ctx.font = '15px ui-rounded, sans-serif';
    ctx.fillText(`Retro: best lap ${fmt(saved.bestLap)} · best race ${fmt(saved.bestRace)}`, bx + 24, by + 196);
    ctx.fillStyle = '#222'; ctx.font = '700 15px ui-rounded, sans-serif'; ctx.fillText('Press R (or tap) for the next sprint', bx + 24, by + 226);
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    clock += dt;
    const left = keys.ArrowLeft || keys.a || keys.A || touch.left;
    const right = keys.ArrowRight || keys.d || keys.D || touch.right;
    const gas = keys.ArrowUp || keys.w || keys.W || touch.gas;
    const brake = keys.ArrowDown || keys.s || keys.S || touch.brake;
    const hand = keys[' '];

    if (state === 'countdown') {
      const k = Math.floor(clock);
      if (k !== frame.lastK) { frame.lastK = k; if (k < 3) beep(440, 0.15); else if (k === 3) beep(880, 0.3); }
      if (clock >= 3.2) { state = 'race'; raceTime = 0; cars.forEach((c) => (c.lapStart = 0)); }
    }
    if (state === 'race' || state === 'done') {
      raceTime += state === 'race' ? dt : 0;
      if (!player.finished) drive(player, gas ? 1 : brake ? -1 : 0, (right ? 1 : 0) - (left ? 1 : 0), hand, dt);
      else drive(player, 0, 0, false, dt);
      rivals.forEach((r) => (r.finished ? drive(r, 0, 0, false, dt) : aiControl(r, dt)));
      collide();
      cars.forEach(checkpoints);
      if (!player.finished && player.lap >= 0 && clock % 0.05 < dt) ghostRec.push([Math.round(player.x), Math.round(player.y), +player.a.toFixed(2)]);
      if (player.finished && state === 'race') { state = 'done'; beep(660, 0.2); setTimeout(() => beep(990, 0.4), 200); }
    }
    if (engine) {
      const sp = Math.hypot(player.vx, player.vy);
      engine.o.frequency.value = 50 + sp * 0.28;
      engine.g.gain.value = muted ? 0 : 0.025 + Math.min(0.04, sp / 20000);
    }

    // camera
    const speed = Math.hypot(player.vx, player.vy);
    const baseZ = clamp(Math.min(W / 1150, H / 760), 0.45, 1.3);
    cam.z = lerp(cam.z, baseZ * (1 - Math.min(0.12, speed / 6000)), 0.05);
    cam.x = lerp(cam.x, player.x + player.vx * 0.25, 0.1);
    cam.y = lerp(cam.y, player.y + player.vy * 0.25, 0.1);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#b8895a'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
    ctx.drawImage(deskCanvas, 0, 0);
    ctx.drawImage(skidCanvas, 0, 0);
    // ghost
    if (ghostPlay && ghostPlay.length && state === 'race') {
      const gi = player.lap >= 0 ? Math.floor((raceTime - player.lapStart) / 0.05) : -1;
      const g = ghostPlay[Math.min(gi, ghostPlay.length - 1)];
      if (g) drawCar({ x: g[0], y: g[1], a: g[2], sprite: player.sprite, isAI: false }, 0.3);
    }
    particles = particles.filter((p) => (p.t -= dt) > 0);
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; ctx.fillStyle = `${p.c}${(p.t * 0.8).toFixed(2)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (0.6 - p.t) * 14, 0, Math.PI * 2); ctx.fill(); });
    [...cars].sort((a, b) => a.y - b.y).forEach((c) => drawCar(c));
    hud();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  const touch = { left: false, right: false, gas: false, brake: false };
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true; audioOn();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === 'm' || e.key === 'M') { muted = !muted; if (engine) engine.g.gain.value = 0; }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  document.querySelectorAll('#touch [data-k]').forEach((b) => {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('on'); audioOn(); };
    const off = () => { touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  canvas.addEventListener('pointerdown', () => { audioOn(); if (state === 'done') reset(); });

  drawDesk();
  window.addEventListener('resize', resize);
  resize();
  reset();
  requestAnimationFrame(frame);
})();
