/* =============================================================
   Padel vs Filip — a doodle-style padel game in one canvas.
   No build step, no dependencies. MIT © Filip Stolarski.

   World units are metres. The court is 10 m wide and 20 m long,
   centred on the origin: x ∈ [-5, 5], z ∈ [-10, 10], y is up.
   You play the near half (z > 0), Filip plays the far half.
   ============================================================= */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- constants ----------
  const COURT = { hw: 5, hl: 10, net: 0.92, wall: 3 };
  const CAM = { y: 6.2, z: 18.5 };
  const G = 9.0;                 // gravity (a bit floaty = more fun)
  const BALL_R = 0.13;
  const REACH = 1.05;            // racket half-width you can hit with
  const WIN = 7;
  const INK = '#111';
  const BLUE = '#3D7BF7';

  // ---------- state ----------
  let W = 0, H = 0, DPR = 1, F = 1, CX = 0, Y0 = 0;
  const player = { x: 0, z: 8.4, tx: 0, tz: 8.4, vx: 0, swing: 0 };
  const ai = { x: 0, z: -8.6, vx: 0, skill: 0.72, swing: 0, think: 0 };
  const ball = { x: 0, y: 1, z: 8, vx: 0, vy: 0, vz: 0, live: false, side: 1, bounces: 0, lastHitter: 0, trail: [] };
  const score = { you: 0, ai: 0 };
  let server = 1;                // 1 = you serve, -1 = Filip serves
  let phase = 'serve';           // serve | rally | point | over
  let phaseT = 0;
  let mood = 'neutral';          // face of the opponent
  let bubble = null;             // { text, t }
  let shake = 0;
  let wobbleSeed = 0;
  let particles = [];
  let keys = {};
  let pointer = null;
  let muted = false;

  // ---------- audio (tiny WebAudio blips) ----------
  let actx = null;
  function blip(freq = 440, dur = 0.06, type = 'triangle', vol = 0.25) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio not available */ }
  }
  const sfx = {
    hit: () => blip(520, 0.07, 'square', 0.12),
    smash: () => { blip(220, 0.12, 'sawtooth', 0.18); blip(660, 0.08, 'square', 0.1); },
    bounce: () => blip(300, 0.04, 'triangle', 0.15),
    wall: () => blip(180, 0.05, 'triangle', 0.18),
    point: (good) => { blip(good ? 660 : 220, 0.12, 'triangle', 0.2); setTimeout(() => blip(good ? 880 : 165, 0.16, 'triangle', 0.2), 110); }
  };

  // ---------- projection ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const S = Math.min(W, H * 1.25);
    F = (0.43 * S) * (CAM.z - COURT.hl) / COURT.hw;
    CX = W / 2;
    Y0 = H * 0.9 - CAM.y * F / (CAM.z - COURT.hl);
  }
  function P(x, y, z) {
    const dz = Math.max(0.5, CAM.z - z);
    return { x: CX + (x * F) / dz, y: Y0 + ((CAM.y - y) * F) / dz, s: F / dz };
  }
  function unprojectFloor(sx, sy, y = 1) {
    // screen → world on the plane at height y (used for pointer control)
    const dz = (F * (CAM.y - y)) / Math.max(1, sy - Y0);
    return { x: ((sx - CX) * dz) / F, z: CAM.z - dz };
  }

  // ---------- hand-drawn helpers ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function jitter(i) { const s = Math.sin(i * 12.9898 + wobbleSeed * 78.233) * 43758.5453; return (s - Math.floor(s) - 0.5) * 1.6; }
  function wobblyPath(points, close = false) {
    ctx.beginPath();
    points.forEach((p, i) => { const x = p.x + jitter(i), y = p.y + jitter(i + 99); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (close) ctx.closePath();
  }
  function quad(a, b, c, d) { return [P(...a), P(...b), P(...c), P(...d)]; }

  // ---------- drawing ----------
  function drawCourt() {
    const { hw, hl } = COURT;
    // thickness slab under the court
    const n1 = P(-hw, 0, hl), n2 = P(hw, 0, hl);
    ctx.fillStyle = '#2E63D6';
    ctx.beginPath(); ctx.moveTo(n1.x - 8, n1.y); ctx.lineTo(n2.x + 8, n2.y); ctx.lineTo(n2.x + 8, n2.y + 14); ctx.lineTo(n1.x - 8, n1.y + 14); ctx.closePath(); ctx.fill();
    // turf
    const floor = quad([-hw, 0, hl], [hw, 0, hl], [hw, 0, -hl], [-hw, 0, -hl]);
    ctx.fillStyle = BLUE; wobblyPath(floor, true); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    // white lines: inner outline, service lines, centre line
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    const inset = 0.25;
    wobblyPath(quad([-hw + inset, 0, hl - inset], [hw - inset, 0, hl - inset], [hw - inset, 0, -hl + inset], [-hw + inset, 0, -hl + inset]), true); ctx.stroke();
    [6.95, -6.95].forEach((z) => { const a = P(-hw + inset, 0, z), b = P(hw - inset, 0, z); wobblyPath([a, b]); ctx.stroke(); });
    const c1 = P(0, 0, 6.95), c2 = P(0, 0, -6.95);
    wobblyPath([c1, c2]); ctx.stroke();
  }
  function drawGlass(z, sideOnly) {
    // back wall + side glass panels near the baseline
    const { hw, wall } = COURT;
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    if (!sideOnly) {
      const g = quad([-hw, 0, z], [hw, 0, z], [hw, wall, z], [-hw, wall, z]);
      ctx.fillStyle = 'rgba(170, 205, 255, .28)'; wobblyPath(g, true); ctx.fill(); ctx.stroke();
      for (let i = -hw + 2.5; i < hw; i += 2.5) { const a = P(i, 0, z), b = P(i, wall, z); wobblyPath([a, b]); ctx.stroke(); }
    }
    // side glass, 4 m long from the back wall
    [-hw, hw].forEach((x) => {
      const zz = z > 0 ? z - 4 : z + 4;
      const g = quad([x, 0, z], [x, 0, zz], [x, 2, zz], [x, wall, z]);
      ctx.fillStyle = 'rgba(170, 205, 255, .18)'; wobblyPath(g, true); ctx.fill(); ctx.stroke();
    });
  }
  function drawNet() {
    const { hw, net } = COURT;
    const a = P(-hw - 0.15, 0, 0), b = P(hw + 0.15, 0, 0), c = P(hw + 0.15, net, 0), d = P(-hw - 0.15, net, 0);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let x = a.x; x < b.x; x += 7) { ctx.beginPath(); ctx.moveTo(x, d.y); ctx.lineTo(x, a.y); ctx.stroke(); }
    for (let y = d.y; y < a.y; y += 7) { ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    wobblyPath([d, c]); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; wobblyPath([d, c]); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    [[a, d], [b, c]].forEach(([p, q]) => { ctx.beginPath(); ctx.moveTo(p.x, p.y + 4); ctx.lineTo(q.x, q.y - 6); ctx.stroke(); });
  }
  function drawShadow(x, z, r) {
    const p = P(x, 0, z);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * p.s * 1.4, r * p.s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawBall() {
    if (phase === 'over') return;
    drawShadow(ball.x, ball.z, BALL_R * 2.2);
    ball.trail.forEach((t, i) => {
      const p = P(t.x, t.y, t.z);
      ctx.fillStyle = `rgba(215, 242, 58, ${(i / ball.trail.length) * 0.35})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, BALL_R * p.s * 0.8), 0, Math.PI * 2); ctx.fill();
    });
    const p = P(ball.x, ball.y, ball.z);
    const r = Math.max(3, BALL_R * p.s);
    ctx.fillStyle = '#D7F23A'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x - r * 0.9, p.y, r * 0.9, -0.9, 0.9); ctx.stroke();
  }
  function drawRacket(x, z, scale, color, swing, alpha = 1) {
    const p = P(x, 1.05, z);
    const s = p.s * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(swing * 0.6);
    // shadow on the floor
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    // handle
    ctx.fillStyle = '#F6F2E8';
    ctx.beginPath(); ctx.roundRect(-0.09 * s, 0.18 * s, 0.18 * s, 0.42 * s, 0.06 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-0.09 * s, 0.5 * s, 0.18 * s, 0.05 * s);
    // head (padel rackets are solid, perforated)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, -0.12 * s, 0.33 * s, 0.38 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (i * i + j * j > 6) continue;
      ctx.beginPath(); ctx.arc(i * 0.095 * s, -0.12 * s + j * 0.1 * s, 0.022 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -0.12 * s, 0.25 * s, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
  }
  function drawFace(cx, cy, size) {
    // the opponent: a doodle head that reacts to the score
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 3.2; ctx.strokeStyle = INK; ctx.fillStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = size;
    const head = [];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; head.push({ x: Math.cos(a) * s * (1 + 0.04 * Math.sin(a * 3)), y: Math.sin(a) * s * 0.92 }); }
    wobblyPath(head, true); ctx.fill(); ctx.stroke();
    // hair tuft
    wobblyPath([{ x: -s * 0.2, y: -s * 0.9 }, { x: -s * 0.05, y: -s * 1.18 }, { x: s * 0.08, y: -s * 0.9 }, { x: s * 0.25, y: -s * 1.12 }, { x: s * 0.32, y: -s * 0.86 }]); ctx.stroke();
    const eye = (ex, big) => {
      ctx.beginPath(); ctx.ellipse(ex, -s * 0.18, s * (big ? 0.2 : 0.15), s * (big ? 0.24 : 0.17), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + s * 0.03, -s * 0.14, s * (big ? 0.06 : 0.07), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff';
    };
    const shocked = mood === 'shocked', smug = mood === 'smug', sweat = mood === 'sweat';
    eye(-s * 0.3, shocked); eye(s * 0.22, shocked);
    if (smug) { // half-closed eyelids
      ctx.beginPath(); ctx.moveTo(-s * 0.48, -s * 0.24); ctx.lineTo(-s * 0.12, -s * 0.22); ctx.moveTo(s * 0.05, -s * 0.22); ctx.lineTo(s * 0.4, -s * 0.24); ctx.stroke();
    }
    // mouth
    ctx.beginPath();
    if (shocked) { ctx.ellipse(0, s * 0.42, s * 0.24, s * 0.18, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); ctx.stroke(); }
    else if (smug) { ctx.moveTo(-s * 0.3, s * 0.38); ctx.quadraticCurveTo(0, s * 0.62, s * 0.34, s * 0.3); ctx.stroke(); }
    else if (sweat) { ctx.moveTo(-s * 0.28, s * 0.48); ctx.quadraticCurveTo(0, s * 0.32, s * 0.28, s * 0.48); ctx.stroke(); }
    else { ctx.moveTo(-s * 0.24, s * 0.42); ctx.lineTo(s * 0.24, s * 0.44); ctx.stroke(); }
    if (sweat) { ctx.fillStyle = '#7fc4ff'; ctx.beginPath(); ctx.moveTo(s * 0.78, -s * 0.4); ctx.quadraticCurveTo(s * 0.92, -s * 0.12, s * 0.78, -s * 0.06); ctx.quadraticCurveTo(s * 0.64, -s * 0.12, s * 0.78, -s * 0.4); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function drawBubble() {
    if (!bubble) return;
    const p = P(ai.x, 2.6, ai.z);
    const a = Math.min(1, bubble.t * 4, (2.2 - bubble.t) * 3);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const w = ctx.measureText(bubble.text).width + 24;
    const x = clamp(p.x + 20, 10, W - w - 10), y = p.y - 40;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, 32, 16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, y + 32); ctx.lineTo(x + 6, y + 44); ctx.lineTo(x + 26, y + 31); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(bubble.text, x + 12, y + 21);
    ctx.restore();
  }
  function drawScore() {
    const cx = W / 2, top = Math.max(18, H * 0.05);
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.font = `500 ${Math.round(Math.min(64, H * 0.075))}px "Iowan Old Style", Palatino, Georgia, serif`;
    ctx.fillText(score.you, cx - 46, top + 46);
    ctx.fillText(score.ai, cx + 46, top + 46);
    ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(cx, top + 26, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'; ctx.fillStyle = '#666';
    ctx.fillText('You', cx - 46, top + 66); ctx.fillText('Filip', cx + 46, top + 66);
    ctx.textAlign = 'left';
    const faceY = top + 66 + Math.min(70, H * 0.08);
    drawFace(cx, faceY, Math.min(46, H * 0.05));
  }
  function drawBanner(title, sub) {
    ctx.save();
    ctx.fillStyle = 'rgba(251,251,248,.88)'; ctx.fillRect(0, H * 0.42, W, 110);
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(Math.min(46, W * 0.07))}px "Iowan Old Style", Palatino, Georgia, serif`;
    ctx.fillText(title, W / 2, H * 0.42 + 52);
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'; ctx.fillStyle = '#555';
    ctx.fillText(sub, W / 2, H * 0.42 + 84);
    ctx.restore();
  }
  function drawParticles(dt) {
    particles = particles.filter((p) => (p.t -= dt) > 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    particles.forEach((p) => {
      const a = p.t / p.life;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.a) * (1 - a) * 20, p.y + Math.sin(p.a) * (1 - a) * 20);
      ctx.lineTo(p.x + Math.cos(p.a) * ((1 - a) * 20 + 12), p.y + Math.sin(p.a) * ((1 - a) * 20 + 12)); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  function burst(x, y, z, n = 7) {
    const p = P(x, y, z);
    for (let i = 0; i < n; i++) particles.push({ x: p.x, y: p.y, a: (i / n) * Math.PI * 2 + rnd(-0.2, 0.2), t: 0.35, life: 0.35 });
  }
  function drawCursor() {
    if (!pointer) return;
    // ghost crosshair under the pointer (hidden native cursor)
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 6, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------- game logic ----------
  const SAYINGS = {
    aiScores: ['Vamos!', 'Too easy.', 'Bandeja!', 'Por tres!', 'Is that all?', 'Glass is my friend.'],
    youScore: ['Lucky shot!', 'Wait, what?', 'Nice one…', 'Okay, okay.', 'Ref?!', 'That was in?'],
    rally: ['Hmm.', 'Watch the glass!', 'Chiquita!', 'Close…']
  };
  const say = (list) => { bubble = { text: list[(Math.random() * list.length) | 0], t: 0 }; };

  function placeServe() {
    ball.live = false; ball.bounces = 0; ball.trail = [];
    ball.vx = ball.vy = ball.vz = 0;
    if (server === 1) { ball.x = player.x + 0.4; ball.z = player.z - 0.3; ball.y = 1.1; }
    else { ball.x = ai.x - 0.4; ball.z = ai.z + 0.3; ball.y = 1.1; }
  }
  function launch(fromZ, x, y, z, toward, power = 1, lob = false) {
    // aim at a target on the other half, with an arc that clears the net
    const tz = toward > 0 ? rnd(5.5, 8.8) : rnd(-8.8, -5.5);
    const tx = clamp(x * 0.2 + rnd(-3.6, 3.6), -4.3, 4.3);
    const t = (lob ? 1.55 : rnd(0.95, 1.2)) / power;
    ball.vx = (tx - x) / t;
    ball.vz = (tz - z) / t;
    ball.vy = (-y + 0.5 * G * t * t) / t;
    ball.x = x; ball.y = y; ball.z = z;
    ball.bounces = 0; ball.live = true;
  }
  function serve(who) {
    if (phase !== 'serve' || server !== who) return;
    phase = 'rally';
    ball.lastHitter = who;
    if (who === 1) { player.swing = 1; launch(player.z, ball.x, ball.y, ball.z, -1, 0.9); }
    else { ai.swing = 1; launch(ai.z, ball.x, ball.y, ball.z, 1, 0.9); }
    sfx.hit();
  }
  function pointTo(who, why) {
    if (phase !== 'rally') return;
    phase = 'point'; phaseT = 0;
    if (who === 1) { score.you++; mood = 'shocked'; say(SAYINGS.youScore); ai.skill = Math.min(0.95, ai.skill + 0.03); sfx.point(true); }
    else { score.ai++; mood = 'smug'; say(SAYINGS.aiScores); sfx.point(false); }
    if (score.ai - score.you <= -3) mood = 'sweat';
    lastWhy = why;
    if ((score.you >= WIN || score.ai >= WIN) && Math.abs(score.you - score.ai) >= 2) { phase = 'over'; phaseT = 0; }
  }
  let lastWhy = '';

  function stepBall(dt) {
    if (!ball.live) return;
    const prevZ = ball.z;
    ball.vy -= G * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
    ball.trail.push({ x: ball.x, y: ball.y, z: ball.z });
    if (ball.trail.length > 8) ball.trail.shift();

    // net
    if (Math.sign(prevZ) !== Math.sign(ball.z) && ball.y < COURT.net + BALL_R) {
      ball.z = prevZ; ball.vz *= -0.25; ball.vx *= 0.4; ball.vy = Math.min(ball.vy, 0.5);
      sfx.wall();
    }
    const side = ball.z > 0 ? 1 : -1;
    if (Math.sign(prevZ) !== Math.sign(ball.z)) ball.bounces = 0;

    // floor
    if (ball.y <= BALL_R && ball.vy < 0) {
      ball.y = BALL_R; ball.vy *= -0.72; ball.vx *= 0.92; ball.vz *= 0.92;
      sfx.bounce(); burst(ball.x, 0, ball.z, 5);
      if (side === ball.lastHitter) { pointTo(-ball.lastHitter, 'net'); return; }
      ball.bounces++;
      if (ball.bounces >= 2) { pointTo(ball.lastHitter, 'two bounces'); return; }
    }
    // glass walls
    if (Math.abs(ball.x) > COURT.hw - BALL_R) {
      ball.x = Math.sign(ball.x) * (COURT.hw - BALL_R); ball.vx *= -0.75; sfx.wall();
      if (ball.bounces === 0 && side !== ball.lastHitter) { pointTo(-ball.lastHitter, 'out'); return; }
    }
    if (Math.abs(ball.z) > COURT.hl - BALL_R) {
      ball.z = Math.sign(ball.z) * (COURT.hl - BALL_R); ball.vz *= -0.72; sfx.wall(); shake = Math.max(shake, 3);
      if (ball.bounces === 0 && side !== ball.lastHitter) { pointTo(-ball.lastHitter, 'out'); return; }
      if (ball.y > COURT.wall) { pointTo(-ball.lastHitter, 'over the glass'); return; }
    }
  }

  function tryPlayerHit(prevZ) {
    if (!ball.live || ball.lastHitter === 1 || ball.vz <= 0) return;
    const crossed = prevZ <= player.z && ball.z >= player.z - 0.45;
    if (!crossed) return;
    if (Math.abs(ball.x - player.x) > REACH || ball.y > 2.6) return;
    if (ball.z < 0.4) return;
    const smash = ball.y > 1.7 && player.z < 6;
    ball.lastHitter = 1;
    player.swing = 1;
    const off = (ball.x - player.x) / REACH;
    launch(player.z, ball.x, Math.max(ball.y, 0.6), Math.min(ball.z, player.z), -1, smash ? 1.6 : 1 + Math.abs(player.vx) * 0.02, !smash && Math.random() < 0.12);
    ball.vx += off * 3 + player.vx * 0.15;
    if (smash) { sfx.smash(); shake = 9; burst(ball.x, ball.y, ball.z, 12); }
    else { sfx.hit(); burst(ball.x, ball.y, ball.z); }
    if (Math.random() < 0.15) say(SAYINGS.rally);
  }
  function stepAI(dt) {
    ai.think -= dt;
    // where will the ball be when it reaches our depth?
    let targetX = 0;
    if (ball.live && ball.vz < 0) {
      const t = Math.max(0, (ai.z - ball.z) / ball.vz);
      targetX = ball.x + ball.vx * t * ai.skill;
    } else if (!ball.live && server === -1) targetX = ai.x;
    else targetX = ball.x * 0.4;
    const maxV = 5.5 + ai.skill * 4;
    const want = clamp((targetX - ai.x) * 6, -maxV, maxV);
    ai.vx += (want - ai.vx) * Math.min(1, dt * 8);
    ai.x = clamp(ai.x + ai.vx * dt, -4.4, 4.4);
    if (phase === 'serve' && server === -1 && ai.think <= 0) { ai.think = 99; setTimeout(() => serve(-1), 650); }
    // hit
    if (ball.live && ball.lastHitter === 1 && ball.vz < 0 && ball.z <= ai.z + 0.4 && ball.z > ai.z - 1.2 && ball.y < 2.6) {
      const dist = Math.abs(ball.x - ai.x);
      const speed = Math.hypot(ball.vx, ball.vz);
      const missChance = clamp(0.05 + (speed - 12) * 0.03 - ai.skill * 0.08, 0.02, 0.45);
      if (dist < REACH * (0.8 + ai.skill * 0.3) && Math.random() > missChance) {
        ball.lastHitter = -1; ai.swing = 1;
        launch(ai.z, ball.x, Math.max(ball.y, 0.6), ai.z, 1, 0.9 + ai.skill * 0.3, Math.random() < 0.18);
        sfx.hit(); burst(ball.x, ball.y, ball.z, 5);
      } else ai.skill = Math.max(0.6, ai.skill - 0.01);
    }
  }
  function stepPlayer(dt) {
    let tx = player.tx, tz = player.tz;
    const k = 7.5 * dt;
    if (keys.ArrowLeft || keys.a) tx -= k;
    if (keys.ArrowRight || keys.d) tx += k;
    if (keys.ArrowUp || keys.w) tz -= k;
    if (keys.ArrowDown || keys.s) tz += k;
    player.tx = clamp(tx, -4.5, 4.5); player.tz = clamp(tz, 2.2, 9.6);
    const nx = player.x + (player.tx - player.x) * Math.min(1, dt * 14);
    player.vx = (nx - player.x) / Math.max(dt, 0.001);
    player.x = nx;
    player.z += (player.tz - player.z) * Math.min(1, dt * 14);
    if (phase === 'serve' && server === 1) placeServe();
  }

  // ---------- loop ----------
  let last = performance.now(), wob = 0;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    wob += dt; if (wob > 0.12) { wob = 0; wobbleSeed = Math.random(); }
    if (bubble) { bubble.t += dt; if (bubble.t > 2.2) bubble = null; }
    player.swing = Math.max(0, player.swing - dt * 5);
    ai.swing = Math.max(0, ai.swing - dt * 5);

    if (phase !== 'over') {
      stepPlayer(dt);
      const prevZ = ball.z;
      stepBall(dt);
      tryPlayerHit(prevZ);
      stepAI(dt);
    }
    if (phase === 'point') {
      phaseT += dt;
      if (phaseT > 1.4) {
        phase = 'serve';
        server = (score.you + score.ai) % 2 === 0 ? 1 : -1;
        ai.think = 0;
        if (mood !== 'sweat') mood = 'neutral';
        placeServe();
      }
    }
    if (phase === 'serve' && server === -1) placeServe();

    // render
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) { ctx.translate(rnd(-shake, shake), rnd(-shake, shake)); shake *= 0.85; if (shake < 0.3) shake = 0; }
    drawGlass(-COURT.hl, false);
    drawCourt();
    // far half
    if (ball.z < 0) drawBall();
    drawShadow(ai.x, ai.z, 0.5);
    drawRacket(ai.x, ai.z, 2.2, '#E8412E', -ai.swing);
    drawNet();
    if (ball.z >= 0) drawBall();
    drawGlass(COURT.hl, true);
    drawShadow(player.x, player.z, 0.35);
    drawRacket(player.x, player.z, 1.15, '#E8412E', player.swing, 0.92);
    drawParticles(dt);
    ctx.restore();
    drawScore();
    drawBubble();
    if (phase === 'serve' && server === 1) drawBanner('Your serve', 'Click or press Space');
    if (phase === 'point' && phaseT < 1.2) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (1.2 - phaseT) * 2);
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(lastWhy, W / 2, H * 0.38); ctx.restore();
    }
    if (phase === 'over') drawBanner(score.you > score.ai ? 'You beat Filip! 🏆' : 'Filip wins this time', 'Click or press Space for a rematch');
    drawCursor();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function fromPointer(e) {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    pointer = { x: sx, y: sy };
    const w = unprojectFloor(sx, sy, 1.05);
    player.tx = clamp(w.x, -4.5, 4.5);
    player.tz = clamp(w.z, 2.2, 9.6);
  }
  canvas.addEventListener('pointermove', fromPointer);
  canvas.addEventListener('pointerdown', (e) => { fromPointer(e); action(); });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  function action() {
    if (phase === 'over') { score.you = score.ai = 0; ai.skill = 0.72; mood = 'neutral'; server = 1; phase = 'serve'; placeServe(); return; }
    serve(1);
  }
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); action(); }
    if (e.key.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  const muteBtn = document.getElementById('mute');
  if (muteBtn) muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.textContent = muted ? 'Sound off' : 'Sound on'; muteBtn.setAttribute('aria-pressed', String(muted)); });

  window.addEventListener('resize', resize);
  resize();
  placeServe();
  say(['Ready when you are.']);
  requestAnimationFrame(frame);
})();
