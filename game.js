/* ============================================================
   Driving Simulator
   A relaxing top-down drive-around-the-map game.
   Single-file vanilla JS + Canvas. No dependencies.
   ============================================================ */

(() => {
  'use strict';

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');

  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const ms = mini.clientWidth;
    mini.width = ms * DPR;
    mini.height = ms * DPR;
    mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---------- Deterministic RNG (so the map is always the same) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ============================================================
  //  WORLD / MAP
  // ============================================================
  const TILE = 480;         // size of one city block + road
  const ROAD = 130;         // road width
  const GRID = 9;           // GRID x GRID blocks
  const WORLD = TILE * GRID;

  const COLORS = {
    grass: '#3f8a52',
    grassDark: '#37784a',
    road: '#3a4048',
    roadEdge: '#4a5058',
    lane: '#e9d16b',
    curb: '#c9cfd6',
    water: '#4a90c2',
    sand: '#d9c9a3',
    park: '#4aa063',
  };

  const rand = mulberry32(20260716);

  // Build the map data once.
  const buildings = [];
  const trees = [];
  const parks = [];
  const lakes = [];
  const lamps = [];

  function isRoadCoord(v) {
    // roads run along block boundaries
    const m = ((v % TILE) + TILE) % TILE;
    return m < ROAD;
  }

  function buildWorld() {
    // A few parks / lakes at chosen blocks
    const specialBlocks = {};
    specialBlocks['2,2'] = 'lake';
    specialBlocks['6,3'] = 'park';
    specialBlocks['3,6'] = 'park';
    specialBlocks['5,6'] = 'lake';
    specialBlocks['7,7'] = 'park';
    specialBlocks['1,7'] = 'park';

    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        // inner area of the block (inside the surrounding roads)
        const bx = gx * TILE + ROAD;
        const by = gy * TILE + ROAD;
        const bw = TILE - ROAD;
        const bh = TILE - ROAD;
        const key = gx + ',' + gy;
        const pad = 14;
        const ix = bx + pad, iy = by + pad;
        const iw = bw - pad * 2, ih = bh - pad * 2;

        if (specialBlocks[key] === 'lake') {
          lakes.push({ x: ix, y: iy, w: iw, h: ih });
          scatterTrees(ix, iy, iw, ih, 4, true);
          continue;
        }
        if (specialBlocks[key] === 'park') {
          parks.push({ x: ix, y: iy, w: iw, h: ih });
          scatterTrees(ix, iy, iw, ih, 14, false);
          continue;
        }

        // Otherwise fill block with a small cluster of buildings
        fillBlockWithBuildings(ix, iy, iw, ih);
      }
    }

    // Street lamps along road intersections
    for (let gx = 0; gx <= GRID; gx++) {
      for (let gy = 0; gy <= GRID; gy++) {
        const cx = gx * TILE + ROAD / 2;
        const cy = gy * TILE + ROAD / 2;
        if (cx < WORLD && cy < WORLD) lamps.push({ x: cx, y: cy });
      }
    }
  }

  const buildingPalette = [
    ['#c96f6f', '#b45e5e'], ['#6f9ac9', '#5e86b4'], ['#c9a86f', '#b4945e'],
    ['#7fc96f', '#6eb45e'], ['#9a6fc9', '#865eb4'], ['#c9c06f', '#b4ab5e'],
    ['#6fc9b8', '#5eb4a4'], ['#c98fb0', '#b47e9c'], ['#8f96a3', '#7d838f'],
  ];

  function fillBlockWithBuildings(x, y, w, h) {
    // Split the block into 1-2 rows and 1-3 cols of buildings with gaps.
    const cols = 1 + Math.floor(rand() * 3);
    const rows = 1 + Math.floor(rand() * 2);
    const gap = 18;
    const cw = (w - gap * (cols - 1)) / cols;
    const ch = (h - gap * (rows - 1)) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.12) { // occasionally a small yard with a tree instead
          const tx = x + c * (cw + gap) + cw / 2;
          const ty = y + r * (ch + gap) + ch / 2;
          trees.push(makeTree(tx, ty));
          continue;
        }
        const inset = 6 + rand() * 10;
        const bx = x + c * (cw + gap) + inset;
        const by = y + r * (ch + gap) + inset;
        const bw = cw - inset * 2;
        const bh = ch - inset * 2;
        if (bw < 30 || bh < 30) continue;
        const pal = buildingPalette[Math.floor(rand() * buildingPalette.length)];
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          roof: pal[0], side: pal[1],
          height: 6 + rand() * 16, // fake 3D extrusion offset
        });
      }
    }
  }

  function makeTree(x, y) {
    return { x, y, r: 16 + rand() * 12, tone: rand() };
  }

  function scatterTrees(x, y, w, h, n, aroundWater) {
    for (let i = 0; i < n; i++) {
      let tx, ty;
      if (aroundWater) {
        // place around the perimeter
        const edge = Math.floor(rand() * 4);
        if (edge === 0) { tx = x + rand() * w; ty = y - 8; }
        else if (edge === 1) { tx = x + rand() * w; ty = y + h + 8; }
        else if (edge === 2) { tx = x - 8; ty = y + rand() * h; }
        else { tx = x + w + 8; ty = y + rand() * h; }
      } else {
        tx = x + 20 + rand() * (w - 40);
        ty = y + 20 + rand() * (h - 40);
      }
      trees.push(makeTree(tx, ty));
    }
  }

  buildWorld();

  // ============================================================
  //  CAR
  // ============================================================
  const car = {
    x: ROAD / 2,           // start on the top-left road, centered
    y: TILE * 1.5,
    angle: Math.PI / 2,    // facing "down" the vertical road (radians)
    speed: 0,              // signed forward speed (px/s)
    steer: 0,             // current steering angle
    width: 26,
    length: 48,
    // tuning
    maxSpeed: 560,
    maxReverse: -180,
    accel: 360,
    brakePower: 640,
    engineBrake: 150,
    steerSpeed: 3.4,      // how fast wheels turn
    maxSteer: 0.62,       // max wheel angle (radians)
    grip: 1,
  };
  // spawn just below the first intersection, aligned with road
  car.x = ROAD / 2;
  car.y = ROAD + 60;
  car.angle = Math.PI / 2;

  const skidMarks = []; // {x,y,a} recent tire marks
  const MAX_SKIDS = 900;

  // ---------- Car colour ----------
  const CAR_COLORS = ['#e94b3c', '#3c78e9', '#2fb463', '#e9b53c', '#e97f3c',
                      '#8b5ee9', '#2fb4a8', '#eef1f5', '#2b2f36', '#e93c8f'];
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function shade(hex, pct) {
    const { r, g, b } = hexToRgb(hex);
    const t = pct > 0 ? 255 : 0, f = Math.abs(pct) / 100;
    const mix = v => Math.round((t - v) * f + v);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
  function makeColorSet(hex) {
    return { light: shade(hex, 26), mid: hex, dark: shade(hex, -24) };
  }
  let playerColor = '#e94b3c';
  let playerCS = makeColorSet(playerColor);

  // ============================================================
  //  TRAFFIC  (AI cars that drive the road grid on a node graph)
  // ============================================================
  const LANE = 30;              // offset from road centre so cars keep right
  const traffic = [];
  function nodePos(i) {
    const gx = i % GRID, gy = (i / GRID) | 0;
    return { x: gx * TILE + ROAD / 2, y: gy * TILE + ROAD / 2 };
  }
  function neighbors(i) {
    const gx = i % GRID, gy = (i / GRID) | 0, out = [];
    if (gx > 0) out.push(i - 1);
    if (gx < GRID - 1) out.push(i + 1);
    if (gy > 0) out.push(i - GRID);
    if (gy < GRID - 1) out.push(i + GRID);
    return out;
  }
  function spawnTraffic(n) {
    for (let k = 0; k < n; k++) {
      let from;
      do {
        from = Math.floor(rand() * GRID * GRID);
      } while (neighbors(from).length === 0);
      const nb = neighbors(from);
      const to = nb[Math.floor(rand() * nb.length)];
      traffic.push({
        from, to, t: rand(),
        speed: 120 + rand() * 100,
        maxSpeed: 150 + rand() * 130,
        cs: makeColorSet(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]),
        x: 0, y: 0, angle: 0,
      });
    }
  }
  function trafficPos(c) {
    const a = nodePos(c.from), b = nodePos(c.to);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;   // travel dir
    const px = -uy, py = ux;              // perpendicular "right" (screen y-down)
    return {
      x: a.x + dx * c.t + px * LANE,
      y: a.y + dy * c.t + py * LANE,
      angle: Math.atan2(uy, ux),
    };
  }
  function updateTraffic(dt) {
    const gapT = 82 / TILE;
    for (const c of traffic) {
      let blocked = false;
      // don't rear-end another car on the same segment
      for (const o of traffic) {
        if (o === c) continue;
        if (o.from === c.from && o.to === c.to && o.t > c.t && o.t - c.t < gapT) { blocked = true; break; }
      }
      // yield to the player if they're right in front
      const pdx = car.x - c.x, pdy = car.y - c.y;
      if (pdx * pdx + pdy * pdy < 58 * 58) blocked = true;

      if (blocked) c.speed = Math.max(0, c.speed - 280 * dt);
      else c.speed = Math.min(c.maxSpeed, c.speed + 85 * dt);

      c.t += c.speed * dt / TILE;
      if (c.t >= 1) {
        c.t -= 1;
        let choices = neighbors(c.to).filter(x => x !== c.from);   // avoid U-turns
        if (choices.length === 0) choices = neighbors(c.to);
        const next = choices[Math.floor(rand() * choices.length)];
        c.from = c.to; c.to = next;
      }
      const p = trafficPos(c);
      c.x = p.x; c.y = p.y; c.angle = p.angle;
    }
  }

  // ============================================================
  //  CHECKPOINTS / LAP TIMER  (a circuit around the city)
  // ============================================================
  const checkpoints = [];
  function buildCheckpoints() {
    const x1 = 1 * TILE + ROAD / 2, x7 = 7 * TILE + ROAD / 2;
    const y1 = 1 * TILE + ROAD / 2, y7 = 7 * TILE + ROAD / 2;
    const L = (a, b, t) => a + (b - a) * t;
    const add = (x, y, dir) => checkpoints.push({ x, y, dir });
    add(L(x1, x7, 1 / 3), y1, 'h');   // top
    add(L(x1, x7, 2 / 3), y1, 'h');
    add(x7, L(y1, y7, 1 / 3), 'v');   // right
    add(x7, L(y1, y7, 2 / 3), 'v');
    add(L(x1, x7, 2 / 3), y7, 'h');   // bottom
    add(L(x1, x7, 1 / 3), y7, 'h');
    add(x1, L(y1, y7, 2 / 3), 'v');   // left
    add(x1, L(y1, y7, 1 / 3), 'v');
  }
  buildCheckpoints();
  spawnTraffic(16);

  let nextCP = 0, hasStarted = false, lapStart = 0;
  let bestLap = null, lastLap = null, lapCount = 0;
  const CP_RADIUS = 74;

  function updateLaps(now) {
    const cp = checkpoints[nextCP];
    const dx = car.x - cp.x, dy = car.y - cp.y;
    if (dx * dx + dy * dy < CP_RADIUS * CP_RADIUS) {
      if (nextCP === 0) {
        if (!hasStarted) { hasStarted = true; lapStart = now; }
        else {
          lastLap = now - lapStart;
          if (bestLap === null || lastLap < bestLap) bestLap = lastLap;
          lapCount++; lapStart = now;
          flashLap(); lapChime();
        }
      } else {
        checkpointBlip();
      }
      nextCP = (nextCP + 1) % checkpoints.length;
    }
  }

  // ============================================================
  //  INPUT
  // ============================================================
  const keys = {};
  const control = { up: false, down: false, left: false, right: false, brake: false };

  const keyMap = {
    'ArrowUp': 'up', 'KeyW': 'up',
    'ArrowDown': 'down', 'KeyS': 'down',
    'ArrowLeft': 'left', 'KeyA': 'left',
    'ArrowRight': 'right', 'KeyD': 'right',
    'Space': 'brake',
  };

  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code]) { control[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyH') horn();
    if (e.code === 'KeyC') cycleCamera();
    if (e.code === 'KeyR') respawn();
    if (e.code === 'KeyM') toggleMute();
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) { control[keyMap[e.code]] = false; e.preventDefault(); }
    keys[e.code] = false;
  });

  // Touch controls
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');
  document.querySelectorAll('.tbtn').forEach((btn) => {
    const key = btn.dataset.key;
    const set = (v) => (e) => { control[key] = v; e.preventDefault(); };
    btn.addEventListener('touchstart', set(true), { passive: false });
    btn.addEventListener('touchend', set(false), { passive: false });
    btn.addEventListener('touchcancel', set(false), { passive: false });
    btn.addEventListener('mousedown', set(true));
    btn.addEventListener('mouseup', set(false));
    btn.addEventListener('mouseleave', set(false));
  });

  // Help toggle
  const help = document.getElementById('help');
  const helpToggle = document.getElementById('help-toggle');
  helpToggle.addEventListener('click', () => help.classList.toggle('hidden'));
  // auto-hide help after a while
  setTimeout(() => help.classList.add('hidden'), 9000);
  document.getElementById('game').addEventListener('pointerdown', () => {
    // first interaction dismisses help & unlocks audio
    help.classList.add('hidden');
    ensureAudio();
  }, { once: true });

  function respawn() {
    car.x = ROAD / 2; car.y = ROAD + 60; car.angle = Math.PI / 2;
    car.speed = 0; car.steer = 0;
  }

  // Colour picker
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach((sw) => {
    sw.addEventListener('click', () => {
      playerColor = sw.dataset.color;
      playerCS = makeColorSet(playerColor);
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  // Mute button
  const muteBtn = document.getElementById('mute-toggle');
  function toggleMute() {
    setMuted(!muted);
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', muted);
  }
  muteBtn.addEventListener('click', () => { ensureAudio(); toggleMute(); });

  // Lap-timer flash
  const lapsEl = document.getElementById('laps');
  function flashLap() {
    lapsEl.classList.remove('flash');
    void lapsEl.offsetWidth; // reflow to restart animation
    lapsEl.classList.add('flash');
  }

  // ============================================================
  //  AUDIO (engine hum + horn) via WebAudio
  // ============================================================
  let audioCtx = null, engineOsc = null, engineGain = null, engineFilter = null;
  let master = null, skidNoise = null, skidGain = null;
  let muted = false;

  function ensureAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      master = audioCtx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(audioCtx.destination);

      // --- engine (sawtooth through a lowpass) ---
      engineOsc = audioCtx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineFilter = audioCtx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineGain = audioCtx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.frequency.value = 60;
      engineOsc.start();

      // --- tyre screech (filtered noise, gated by skidGain) ---
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      skidNoise = audioCtx.createBufferSource();
      skidNoise.buffer = buf;
      skidNoise.loop = true;
      const skidFilter = audioCtx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1600;
      skidFilter.Q.value = 0.8;
      skidGain = audioCtx.createGain();
      skidGain.gain.value = 0;
      skidNoise.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(master);
      skidNoise.start();
    } catch (e) { audioCtx = null; }
  }

  function setMuted(m) {
    muted = m;
    if (master && audioCtx) master.gain.setTargetAtTime(m ? 0 : 1, audioCtx.currentTime, 0.05);
  }

  function updateEngineSound(skidding) {
    if (!audioCtx) return;
    const spd = Math.abs(car.speed) / car.maxSpeed;
    const target = 55 + spd * 180;
    engineOsc.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(400 + spd * 1400, audioCtx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.015 + spd * 0.05, audioCtx.currentTime, 0.1);
    // tyre screech level
    const screech = skidding ? Math.min(0.09, 0.02 + spd * 0.09) : 0;
    skidGain.gain.setTargetAtTime(screech, audioCtx.currentTime, 0.05);
  }

  // one-shot tone helper
  function tone(type, freq, dur, vol, freqEnd) {
    ensureAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    const t = audioCtx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master || audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function horn() { tone('square', 330, 0.4, 0.06); }
  function checkpointBlip() { tone('sine', 880, 0.14, 0.05, 1320); }
  function lapChime() {
    tone('sine', 660, 0.16, 0.05);
    setTimeout(() => tone('sine', 990, 0.28, 0.055), 130);
  }
  let lastThud = 0;
  function collisionThud() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastThud < 0.15) return; // avoid machine-gun thuds
    lastThud = now;
    tone('triangle', 150, 0.18, 0.07, 60);
  }

  // ============================================================
  //  CAMERA
  // ============================================================
  const cam = { x: car.x, y: car.y, zoom: 1, targetZoom: 1 };
  let cameraMode = 0; // 0 = normal, 1 = far
  function cycleCamera() {
    cameraMode = (cameraMode + 1) % 2;
  }

  // ============================================================
  //  PHYSICS UPDATE
  // ============================================================
  function update(dt, now) {
    // --- steering input ---
    let steerInput = 0;
    if (control.left) steerInput -= 1;
    if (control.right) steerInput += 1;

    // steering eases toward input; sharper at low speed
    const speedFactor = 1 - Math.min(Math.abs(car.speed) / car.maxSpeed, 1) * 0.55;
    const targetSteer = steerInput * car.maxSteer * speedFactor;
    car.steer += (targetSteer - car.steer) * Math.min(car.steerSpeed * dt, 1);
    if (steerInput === 0) car.steer *= (1 - Math.min(6 * dt, 1)); // auto-center

    // --- throttle / brake ---
    const forward = control.up, back = control.down;
    let pedalGas = false, pedalBrake = false;

    if (forward) {
      if (car.speed < 0) { // braking from reverse
        car.speed += car.brakePower * dt; pedalBrake = true;
      } else {
        car.speed += car.accel * dt; pedalGas = true;
      }
    } else if (back) {
      if (car.speed > 0) { // braking from forward
        car.speed -= car.brakePower * dt; pedalBrake = true;
      } else {
        car.speed -= car.accel * 0.6 * dt; pedalBrake = true; // reverse
      }
    } else {
      // engine braking / rolling resistance
      const drag = car.engineBrake * dt;
      if (car.speed > 0) car.speed = Math.max(0, car.speed - drag);
      else if (car.speed < 0) car.speed = Math.min(0, car.speed + drag);
    }

    // handbrake
    let handbraking = false;
    if (control.brake) {
      handbraking = true;
      car.speed *= (1 - Math.min(2.2 * dt, 1));
      if (Math.abs(car.speed) < 6) car.speed = 0;
    }

    // clamp speed
    car.speed = Math.max(car.maxReverse, Math.min(car.maxSpeed, car.speed));

    // --- bicycle model motion ---
    const wheelBase = car.length * 0.7;
    if (Math.abs(car.speed) > 0.5) {
      // slower turning when nearly stopped feels wrong; scale by speed presence
      const turnRate = (car.speed / wheelBase) * Math.tan(car.steer);
      car.angle += turnRate * dt;
    }

    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    let nx = car.x + vx * dt;
    let ny = car.y + vy * dt;

    // --- collisions with buildings, lakes & traffic (simple slide) ---
    const hit = collides(nx, ny);
    if (hit) {
      if (Math.abs(car.speed) > 70) collisionThud();
      // try axis-separated movement so we slide along walls
      if (!collides(nx, car.y)) { ny = car.y; }
      else if (!collides(car.x, ny)) { nx = car.x; }
      else { nx = car.x; ny = car.y; }
      car.speed *= 0.4; // lose momentum on impact
    }

    // world bounds
    nx = Math.max(20, Math.min(WORLD - 20, nx));
    ny = Math.max(20, Math.min(WORLD - 20, ny));
    car.x = nx; car.y = ny;

    // --- skid marks (handbrake or hard turn at speed) ---
    const lateral = Math.abs(car.steer) * Math.abs(car.speed);
    const skidding = (handbraking && Math.abs(car.speed) > 30) || lateral > 220;
    if (skidding) addSkid();

    // update pedal HUD state
    updatePedals(pedalGas, pedalBrake || handbraking);

    // --- camera follow ---
    // look slightly ahead in the direction of travel
    const lead = Math.min(Math.abs(car.speed) / car.maxSpeed, 1) * 120;
    const tx = car.x + Math.cos(car.angle) * lead * Math.sign(car.speed || 1);
    const ty = car.y + Math.sin(car.angle) * lead * Math.sign(car.speed || 1);
    cam.x += (tx - cam.x) * Math.min(4 * dt, 1);
    cam.y += (ty - cam.y) * Math.min(4 * dt, 1);

    cam.targetZoom = cameraMode === 1 ? 0.62 : (1.05 - Math.min(Math.abs(car.speed) / car.maxSpeed, 1) * 0.18);
    cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(3 * dt, 1);

    updateTraffic(dt);
    updateLaps(now);
    updateEngineSound(skidding);
    updateHUD(now);
  }

  const carHalfDiag = Math.hypot(car.width, car.length) / 2;

  function collides(x, y) {
    // Treat car as a small circle for collision (forgiving & smooth)
    const r = car.width * 0.5 + 2;
    // buildings
    for (const b of buildings) {
      if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
      // closest point on rect
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    for (const l of lakes) {
      if (x > l.x && x < l.x + l.w && y > l.y && y < l.y + l.h) return true;
    }
    // other cars
    for (const c of traffic) {
      const dx = x - c.x, dy = y - c.y, rr = r + 15;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  function addSkid() {
    // add a mark under each rear wheel
    const rear = -car.length * 0.32;
    const off = car.width * 0.34;
    const ca = Math.cos(car.angle), sa = Math.sin(car.angle);
    for (const s of [-1, 1]) {
      const lx = rear, ly = s * off;
      skidMarks.push({
        x: car.x + lx * ca - ly * sa,
        y: car.y + lx * sa + ly * ca,
        a: car.angle,
      });
    }
    while (skidMarks.length > MAX_SKIDS) skidMarks.shift();
  }

  // ============================================================
  //  RENDERING
  // ============================================================
  function draw(now) {
    // sky/ground base
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    // camera transform: center on car
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.rotate(0);
    ctx.translate(-cam.x, -cam.y);

    // visible world bounds (for culling)
    const halfW = (W / 2) / cam.zoom;
    const halfH = (H / 2) / cam.zoom;
    const view = {
      x0: cam.x - halfW - 60, y0: cam.y - halfH - 60,
      x1: cam.x + halfW + 60, y1: cam.y + halfH + 60,
    };

    drawGround(view);
    drawRoads(view);
    drawParks(view);
    drawLakes(view);
    drawSkids(view);
    drawCheckpoints(view, now);
    drawTrees(view);
    drawBuildings(view);
    drawLamps(view);
    drawTraffic(view);
    drawCar();

    ctx.restore();

    drawCPArrow();
    drawMinimap();
  }

  function inView(x, y, w, h, v) {
    return !(x + w < v.x0 || x > v.x1 || y + h < v.y0 || y > v.y1);
  }

  function drawGround(v) {
    // grass base with a subtle checker for depth
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);

    // subtle darker patches on alternating blocks
    ctx.fillStyle = COLORS.grassDark;
    const startGX = Math.max(0, Math.floor(v.x0 / TILE));
    const endGX = Math.min(GRID - 1, Math.floor(v.x1 / TILE));
    const startGY = Math.max(0, Math.floor(v.y0 / TILE));
    const endGY = Math.min(GRID - 1, Math.floor(v.y1 / TILE));
    for (let gx = startGX; gx <= endGX; gx++) {
      for (let gy = startGY; gy <= endGY; gy++) {
        if ((gx + gy) % 2 === 0) {
          ctx.fillRect(gx * TILE + ROAD, gy * TILE + ROAD, TILE - ROAD, TILE - ROAD);
        }
      }
    }
  }

  function drawRoads(v) {
    // Draw horizontal + vertical road strips.
    // curbs first (slightly wider), then asphalt, then markings.
    const drawStrip = (x, y, w, h) => {
      if (!inView(x, y, w, h, v)) return;
      ctx.fillStyle = COLORS.curb;
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(x, y, w, h);
    };

    // vertical roads
    for (let gx = 0; gx <= GRID; gx++) {
      const x = gx * TILE;
      if (x >= WORLD) continue;
      drawStrip(x, 0, ROAD, WORLD);
    }
    // horizontal roads
    for (let gy = 0; gy <= GRID; gy++) {
      const y = gy * TILE;
      if (y >= WORLD) continue;
      drawStrip(0, y, WORLD, ROAD);
    }

    // center lane dashes
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 26]);
    ctx.lineCap = 'butt';

    for (let gx = 0; gx <= GRID; gx++) {
      const cx = gx * TILE + ROAD / 2;
      if (cx >= WORLD) continue;
      if (cx < v.x0 - 20 || cx > v.x1 + 20) continue;
      ctx.beginPath();
      ctx.moveTo(cx, Math.max(0, v.y0));
      ctx.lineTo(cx, Math.min(WORLD, v.y1));
      ctx.stroke();
    }
    for (let gy = 0; gy <= GRID; gy++) {
      const cy = gy * TILE + ROAD / 2;
      if (cy >= WORLD) continue;
      if (cy < v.y0 - 20 || cy > v.y1 + 20) continue;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, v.x0), cy);
      ctx.lineTo(Math.min(WORLD, v.x1), cy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // intersections: paint over dashes with solid patch + crosswalks
    for (let gx = 0; gx <= GRID; gx++) {
      for (let gy = 0; gy <= GRID; gy++) {
        const x = gx * TILE, y = gy * TILE;
        if (x >= WORLD || y >= WORLD) continue;
        if (!inView(x, y, ROAD, ROAD, v)) continue;
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(x, y, ROAD, ROAD);
        drawCrosswalks(x, y);
      }
    }
  }

  function drawCrosswalks(x, y) {
    ctx.fillStyle = 'rgba(230,235,240,0.55)';
    const bars = 5, bw = 8, gap = (ROAD - bars * bw) / (bars + 1);
    // top & bottom (horizontal bars)
    for (let i = 0; i < bars; i++) {
      const bx = x + gap + i * (bw + gap);
      ctx.fillRect(bx, y - 22, bw, 16);
      ctx.fillRect(bx, y + ROAD + 6, bw, 16);
      const by = y + gap + i * (bw + gap);
      ctx.fillRect(x - 22, by, 16, bw);
      ctx.fillRect(x + ROAD + 6, by, 16, bw);
    }
  }

  function drawParks(v) {
    for (const p of parks) {
      if (!inView(p.x, p.y, p.w, p.h, v)) continue;
      ctx.fillStyle = COLORS.park;
      roundRect(ctx, p.x, p.y, p.w, p.h, 12);
      ctx.fill();
      // path across
      ctx.strokeStyle = 'rgba(220,205,170,0.6)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(p.x + 6, p.y + p.h * 0.5);
      ctx.lineTo(p.x + p.w - 6, p.y + p.h * 0.5);
      ctx.stroke();
    }
  }

  function drawLakes(v) {
    for (const l of lakes) {
      if (!inView(l.x, l.y, l.w, l.h, v)) continue;
      // sandy shore
      ctx.fillStyle = COLORS.sand;
      roundRect(ctx, l.x - 8, l.y - 8, l.w + 16, l.h + 16, 24);
      ctx.fill();
      // water
      ctx.fillStyle = COLORS.water;
      roundRect(ctx, l.x, l.y, l.w, l.h, 20);
      ctx.fill();
      // highlight ripple
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, l.x + l.w * 0.15, l.y + l.h * 0.18, l.w * 0.4, l.h * 0.12, 10);
      ctx.fill();
    }
  }

  function drawSkids(v) {
    ctx.fillStyle = 'rgba(20,20,24,0.28)';
    for (const s of skidMarks) {
      if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
  }

  function drawTrees(v) {
    for (const t of trees) {
      if (t.x + t.r < v.x0 || t.x - t.r > v.x1 || t.y + t.r < v.y0 || t.y - t.r > v.y1) continue;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // canopy (two tone)
      const g = 90 + Math.floor(t.tone * 40);
      ctx.fillStyle = `rgb(40,${g + 30},60)`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(60,${g + 60},80)`;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(v) {
    for (const b of buildings) {
      if (!inView(b.x, b.y, b.w, b.h, v)) continue;
      const off = b.height;
      // drop shadow / extrusion toward bottom-right
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(ctx, b.x + off, b.y + off, b.w, b.h, 6);
      ctx.fill();
      // side (darker)
      ctx.fillStyle = b.side;
      roundRect(ctx, b.x + off * 0.5, b.y + off * 0.5, b.w, b.h, 6);
      ctx.fill();
      // roof (top face)
      ctx.fillStyle = b.roof;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      // roof detail line
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      roundRect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 4);
      ctx.stroke();
    }
  }

  function drawLamps(v) {
    for (const l of lamps) {
      if (l.x < v.x0 - 20 || l.x > v.x1 + 20 || l.y < v.y0 - 20 || l.y > v.y1 + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(l.x + 3, l.y + 3, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2f36';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Generic vehicle renderer, shared by the player and traffic.
  function drawVehicle(x, y, angle, cs, opt) {
    const L = opt.length, Wc = opt.width, steer = opt.steer || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -L / 2 + 3, -Wc / 2 + 4, L, Wc, 7);
    ctx.fill();

    // wheels
    ctx.fillStyle = '#15181c';
    const wheelW = 10, wheelH = 6;
    roundRect(ctx, -L * 0.34 - wheelW / 2, -Wc / 2 - 2, wheelW, wheelH, 2); ctx.fill();
    roundRect(ctx, -L * 0.34 - wheelW / 2, Wc / 2 - 4, wheelW, wheelH, 2); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(L * 0.32, s * (Wc / 2 - 1));
      ctx.rotate(steer);
      ctx.fillStyle = '#15181c';
      roundRect(ctx, -wheelW / 2, -wheelH / 2, wheelW, wheelH, 2);
      ctx.fill();
      ctx.restore();
    }

    // body gradient
    const grad = ctx.createLinearGradient(0, -Wc / 2, 0, Wc / 2);
    grad.addColorStop(0, cs.light);
    grad.addColorStop(0.5, cs.mid);
    grad.addColorStop(1, cs.dark);
    ctx.fillStyle = grad;
    roundRect(ctx, -L / 2, -Wc / 2, L, Wc, 8);
    ctx.fill();

    // roof / cabin
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    roundRect(ctx, -L * 0.16, -Wc / 2 + 4, L * 0.42, Wc - 8, 5);
    ctx.fill();
    // windshields
    ctx.fillStyle = 'rgba(150,200,230,0.55)';
    roundRect(ctx, L * 0.06, -Wc / 2 + 5, L * 0.14, Wc - 10, 3);
    ctx.fill();
    roundRect(ctx, -L * 0.14, -Wc / 2 + 5, L * 0.1, Wc - 10, 3);
    ctx.fill();

    // hood highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, L * 0.3, -Wc / 2 + 3, L * 0.16, Wc - 6, 4);
    ctx.fill();

    // headlights
    ctx.fillStyle = '#fff4c2';
    roundRect(ctx, L / 2 - 4, -Wc / 2 + 3, 3, 5, 1); ctx.fill();
    roundRect(ctx, L / 2 - 4, Wc / 2 - 8, 3, 5, 1); ctx.fill();
    // tail lights
    ctx.fillStyle = opt.reverse ? '#ff9b9b' : '#8f2b2b';
    roundRect(ctx, -L / 2 + 1, -Wc / 2 + 3, 3, 5, 1); ctx.fill();
    roundRect(ctx, -L / 2 + 1, Wc / 2 - 8, 3, 5, 1); ctx.fill();
    // brake glow
    if (opt.brake) {
      ctx.fillStyle = 'rgba(255,60,60,0.85)';
      roundRect(ctx, -L / 2 - 1, -Wc / 2 + 3, 3, 5, 1); ctx.fill();
      roundRect(ctx, -L / 2 - 1, Wc / 2 - 8, 3, 5, 1); ctx.fill();
    }

    ctx.restore();
  }

  function drawCar() {
    drawVehicle(car.x, car.y, car.angle, playerCS, {
      length: car.length, width: car.width, steer: car.steer,
      brake: control.down || control.brake, reverse: car.speed < -2,
    });
  }

  function drawTraffic(v) {
    for (const c of traffic) {
      if (c.x < v.x0 - 40 || c.x > v.x1 + 40 || c.y < v.y0 - 40 || c.y > v.y1 + 40) continue;
      drawVehicle(c.x, c.y, c.angle, c.cs, {
        length: 44, width: 24, steer: 0, brake: c.speed < 25, reverse: false,
      });
    }
  }

  // ---------- Checkpoints ----------
  function drawCheckpoints(v, now) {
    const pulse = 0.5 + 0.5 * Math.sin((now || 0) * 0.005);
    const half = ROAD / 2 - 6;
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      if (cp.x < v.x0 - 80 || cp.x > v.x1 + 80 || cp.y < v.y0 - 80 || cp.y > v.y1 + 80) continue;
      const isNext = i === nextCP;
      ctx.save();
      ctx.translate(cp.x, cp.y);
      if (cp.dir === 'v') ctx.rotate(Math.PI / 2);
      if (isNext) {
        ctx.fillStyle = `rgba(79,209,197,${0.10 + 0.10 * pulse})`;
        ctx.fillRect(-9, -half, 18, half * 2);
      }
      ctx.strokeStyle = isNext ? `rgba(79,209,197,${0.6 + 0.35 * pulse})` : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = isNext ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(0, -half); ctx.lineTo(0, half);
      ctx.stroke();
      ctx.fillStyle = isNext ? `rgba(79,209,197,${0.75 + 0.25 * pulse})` : 'rgba(255,255,255,0.25)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(0, s * half, isNext ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Screen-space arrow pointing to the next checkpoint when it's off-screen.
  function drawCPArrow() {
    const cp = checkpoints[nextCP];
    const sx = (cp.x - cam.x) * cam.zoom + W / 2;
    const sy = (cp.y - cam.y) * cam.zoom + H / 2;
    const m = 74;
    if (sx > m && sx < W - m && sy > m && sy < H - m) return; // visible already
    const cx = W / 2, cy = H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const rx = Math.min(W - m, Math.max(m, sx));
    const ry = Math.min(H - m, Math.max(m, sy));
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(79,209,197,0.9)';
    ctx.beginPath();
    ctx.moveTo(17, 0); ctx.lineTo(-9, -11); ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- Minimap ----------
  function drawMinimap() {
    const size = mini.clientWidth;
    const scale = size / WORLD;
    mctx.clearRect(0, 0, size, size);
    // ground
    mctx.fillStyle = COLORS.grassDark;
    mctx.fillRect(0, 0, size, size);
    // roads
    mctx.fillStyle = '#2c3138';
    for (let g = 0; g <= GRID; g++) {
      const p = g * TILE * scale;
      if (g * TILE < WORLD) {
        mctx.fillRect(p, 0, ROAD * scale, size);
        mctx.fillRect(0, p, size, ROAD * scale);
      }
    }
    // water
    mctx.fillStyle = COLORS.water;
    for (const l of lakes) mctx.fillRect(l.x * scale, l.y * scale, l.w * scale, l.h * scale);
    // parks
    mctx.fillStyle = COLORS.park;
    for (const p of parks) mctx.fillRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);

    // traffic dots
    mctx.fillStyle = 'rgba(255,220,120,0.85)';
    for (const c of traffic) mctx.fillRect(c.x * scale - 1, c.y * scale - 1, 2.4, 2.4);

    // checkpoints (next one highlighted)
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      mctx.fillStyle = i === nextCP ? '#4fd1c5' : 'rgba(255,255,255,0.4)';
      mctx.beginPath();
      mctx.arc(cp.x * scale, cp.y * scale, i === nextCP ? 3.5 : 2, 0, Math.PI * 2);
      mctx.fill();
    }

    // car dot with heading
    const cx = car.x * scale, cy = car.y * scale;
    mctx.save();
    mctx.translate(cx, cy);
    mctx.rotate(car.angle);
    mctx.fillStyle = '#ff5e4d';
    mctx.beginPath();
    mctx.moveTo(7, 0);
    mctx.lineTo(-4, -4);
    mctx.lineTo(-4, 4);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  // ---------- rounded rect helper ----------
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ============================================================
  //  HUD
  // ============================================================
  const speedEl = document.getElementById('speed');
  const gearEl = document.getElementById('gear');
  const pedalGasEl = document.getElementById('pedal-throttle');
  const pedalBrakeEl = document.getElementById('pedal-brake');
  const lapTimeEl = document.getElementById('lap-time');
  const bestTimeEl = document.getElementById('best-time');
  const lapCountEl = document.getElementById('lap-count');

  function fmtTime(ms) {
    if (ms == null) return '--';
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return m > 0 ? m + ':' + sec.toFixed(2).padStart(5, '0') : sec.toFixed(2);
  }

  function updateHUD(now) {
    // convert px/s to a playful km/h
    const kmh = Math.round(Math.abs(car.speed) * 0.28);
    speedEl.textContent = kmh;
    if (car.speed < -2) {
      gearEl.textContent = 'R';
      gearEl.classList.add('reverse');
    } else {
      gearEl.textContent = 'D';
      gearEl.classList.remove('reverse');
    }
    // lap timer
    lapTimeEl.textContent = fmtTime(hasStarted ? now - lapStart : 0);
    bestTimeEl.textContent = fmtTime(bestLap);
    lapCountEl.textContent = lapCount;
  }

  function updatePedals(gas, brake) {
    pedalGasEl.classList.toggle('active', gas);
    pedalBrakeEl.classList.toggle('active', brake);
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)
    update(dt, now);
    draw(now);
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
