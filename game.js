import * as THREE from './three.module.js';

/* ========== 1. Talking to start.ng (copied from the start.ng docs) ========== */
const START_NG = 'https://start.ng';
let frame;
function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}
async function askStartNg(message, replyType, timeoutMs = 4000) {
  let el;
  try { el = await connectFrame(); } catch { return null; }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return; // always check the origin
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

const $ = (id) => document.getElementById(id);
$('signin').href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;

/* ========== 2. The character, drawn from the player's start.ng style ========== */
const DEFAULT_STYLE = { body: 'male', primaryColor: '#4b7bec', secondaryColor: '#2b2f4a', skinColor: '#8d5524',
  hairColor: '#17120f', hair: 'short', hat: 'none', accessory: 'none' };
const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = (v, fallback) => (HEX.test(v) ? v : fallback);
const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

function makeCharacter(input) {
  const s = { ...DEFAULT_STYLE, ...(input || {}) };
  const topM = mat(pick(s.primaryColor, DEFAULT_STYLE.primaryColor));
  const botM = mat(pick(s.secondaryColor, DEFAULT_STYLE.secondaryColor));
  const skinM = mat(pick(s.skinColor, DEFAULT_STYLE.skinColor));
  const hairM = mat(pick(s.hairColor, DEFAULT_STYLE.hairColor));
  const darkM = mat('#111111');
  const goldM = mat('#f1c40f');
  const g = new THREE.Group();
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  // body: top (primary colour) + legs/skirt (secondary colour)
  add(g, new THREE.BoxGeometry(0.9, 1.0, 0.5), topM, 0, 1.5, 0);
  const female = s.body === 'female';
  const legs = [-0.22, 0.22].map((x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.0, 0); g.add(pivot);
    add(pivot, new THREE.BoxGeometry(0.36, 1.0, 0.36), female ? skinM : botM, 0, -0.5, 0);
    return pivot;
  });
  if (female) add(g, new THREE.CylinderGeometry(0.46, 0.72, 0.6, 16), botM, 0, 0.85, 0);
  const arms = [-0.62, 0.62].map((x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.95, 0); g.add(pivot);
    add(pivot, new THREE.BoxGeometry(0.26, 0.9, 0.26), skinM, 0, -0.4, 0);
    add(pivot, new THREE.BoxGeometry(0.3, 0.4, 0.3), topM, 0, -0.1, 0);
    return pivot;
  });

  // head, eyes
  const head = new THREE.Group(); head.position.set(0, 2.4, 0); g.add(head);
  add(head, new THREE.SphereGeometry(0.45, 20, 16), skinM);
  add(head, new THREE.SphereGeometry(0.06, 8, 8), darkM, -0.16, 0.05, 0.4);
  add(head, new THREE.SphereGeometry(0.06, 8, 8), darkM, 0.16, 0.05, 0.4);

  // hair
  const hairCap = () => {
    const c = add(head, new THREE.SphereGeometry(0.48, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.02, 0);
    c.rotation.x = -0.45; // tilt back so the face stays open
  };
  const hang = (n, len, r, spread) => {
    for (let i = 0; i < n; i++) {
      const x = -spread + (2 * spread * i) / Math.max(1, n - 1);
      add(head, new THREE.CylinderGeometry(r, r * 0.8, len, 8), hairM, x, -0.3 - len / 4, -0.3);
    }
  };
  if (s.hair === 'short') hairCap();
  else if (s.hair === 'afro') add(head, new THREE.SphereGeometry(0.62, 20, 16), hairM, 0, 0.2, -0.2);
  else if (s.hair === 'braids') { hairCap(); hang(6, 0.9, 0.05, 0.33); }
  else if (s.hair === 'dreads') { hairCap(); hang(8, 0.7, 0.07, 0.38); }
  else if (s.hair === 'bun') { hairCap(); add(head, new THREE.SphereGeometry(0.2, 12, 10), hairM, 0, 0.52, -0.2); }
  else if (s.hair === 'ponytail') {
    hairCap();
    const t = add(head, new THREE.CylinderGeometry(0.09, 0.05, 0.8, 8), hairM, 0, -0.1, -0.55); t.rotation.x = 0.35;
  }

  // hat
  if (s.hat === 'cap') {
    add(head, new THREE.CylinderGeometry(0.47, 0.47, 0.2, 20), botM, 0, 0.36, 0);
    add(head, new THREE.BoxGeometry(0.5, 0.04, 0.35), botM, 0, 0.28, 0.45);
  } else if (s.hat === 'beanie') {
    add(head, new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), botM, 0, 0.1, 0);
  } else if (s.hat === 'tophat') {
    add(head, new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), darkM, 0, 0.38, 0);
    add(head, new THREE.CylinderGeometry(0.34, 0.34, 0.6, 20), darkM, 0, 0.7, 0);
    add(head, new THREE.CylinderGeometry(0.35, 0.35, 0.1, 20), topM, 0, 0.5, 0);
  } else if (s.hat === 'crown') {
    add(head, new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16), goldM, 0, 0.5, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(head, new THREE.ConeGeometry(0.08, 0.25, 8), goldM, Math.sin(a) * 0.36, 0.72, Math.cos(a) * 0.36);
    }
  }

  // accessory
  if (s.accessory === 'glasses') {
    add(head, new THREE.TorusGeometry(0.1, 0.02, 8, 16), darkM, -0.16, 0.05, 0.43);
    add(head, new THREE.TorusGeometry(0.1, 0.02, 8, 16), darkM, 0.16, 0.05, 0.43);
    add(head, new THREE.BoxGeometry(0.1, 0.02, 0.02), darkM, 0, 0.05, 0.43);
  } else if (s.accessory === 'earrings') {
    add(head, new THREE.SphereGeometry(0.06, 8, 8), goldM, -0.46, -0.12, 0);
    add(head, new THREE.SphereGeometry(0.06, 8, 8), goldM, 0.46, -0.12, 0);
  } else if (s.accessory === 'beard') {
    const b = add(head, new THREE.SphereGeometry(0.3, 12, 10), hairM, 0, -0.28, 0.22); b.scale.set(1, 0.7, 0.8);
  } else if (s.accessory === 'scarf') {
    const sc = add(g, new THREE.TorusGeometry(0.4, 0.12, 8, 16), botM, 0, 2.0, 0); sc.rotation.x = Math.PI / 2;
  } else if (s.accessory === 'backpack') {
    add(g, new THREE.BoxGeometry(0.7, 0.9, 0.3), botM, 0, 1.5, -0.4);
  }

  g.userData = { legs, arms };
  return g;
}

/* ========== 3. Scene ========== */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9ad7ff');
scene.fog = new THREE.Fog('#9ad7ff', 25, 55);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight('#ffffff', '#4a7a5a', 1.1));
const sun = new THREE.DirectionalLight('#ffffff', 1.2); sun.position.set(6, 12, 8); scene.add(sun);

const LIMIT = 17;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat('#2f9e6b'));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(36, 18, '#ffffff', '#ffffff');
grid.material.transparent = true; grid.material.opacity = 0.15; grid.position.y = 0.01; scene.add(grid);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ========== 4. Who is playing ========== */
let style = DEFAULT_STYLE;
let signedIn = false;
let character = makeCharacter(style);
scene.add(character);

function setCharacter() {
  const { x, z } = character.position, ry = character.rotation.y;
  scene.remove(character);
  character = makeCharacter(style);
  character.position.set(x, 0, z); character.rotation.y = ry;
  scene.add(character);
}

async function refreshPlayer() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  const p = reply?.user ?? reply?.guest; // signed in, or start.ng's guest
  signedIn = !!reply?.user;
  if (p) {
    $('player-face').src = p.face ?? '';
    $('player-name').textContent = p.name ?? 'Guest';
    $('player-account').textContent = reply.user?.account ? `@${reply.user.account}` : 'Not signed in';
    $('player-card').hidden = false;
  }
  $('signin').hidden = signedIn;
  const next = p?.style ?? DEFAULT_STYLE;
  if (JSON.stringify(next) !== JSON.stringify(style)) { style = next; setCharacter(); }
}
refreshPlayer();
addEventListener('focus', refreshPlayer);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPlayer(); });

/* ========== 5. The game ========== */
const ROUND = 45, MAX_COINS = 7, SPEED = 7;
const state = { mode: 'ready', coins: 0, timeLeft: ROUND };
const coinMeshes = [];
const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24).rotateX(Math.PI / 2);
const coinMat = new THREE.MeshLambertMaterial({ color: '#f1c40f', emissive: '#7a5b00' });

function spawnCoin() {
  const m = new THREE.Mesh(coinGeo, coinMat);
  do { m.position.set((Math.random() * 2 - 1) * LIMIT, 1, (Math.random() * 2 - 1) * LIMIT); }
  while (m.position.distanceTo(character.position) < 4);
  scene.add(m); coinMeshes.push(m);
}
function clearCoins() { coinMeshes.splice(0).forEach((m) => scene.remove(m)); }

const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const pointer = { down: false, x: 0, y: 0 };
const setPointer = (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; };
renderer.domElement.addEventListener('pointerdown', (e) => { pointer.down = true; setPointer(e); });
addEventListener('pointermove', (e) => { if (pointer.down) setPointer(e); });
addEventListener('pointerup', () => { pointer.down = false; });

function moveDirection() {
  let dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  let dz = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  if (!dx && !dz && pointer.down) {
    const p = character.position.clone().project(camera);
    dx = pointer.x - p.x; dz = -(pointer.y - p.y);
    if (Math.hypot(dx, dz) < 0.06) dx = dz = 0;
  }
  const len = Math.hypot(dx, dz);
  return len ? { x: dx / len, z: dz / len } : null;
}

function startGame() {
  clearCoins();
  state.mode = 'playing'; state.coins = 0; state.timeLeft = ROUND;
  character.position.set(0, 0, 0);
  for (let i = 0; i < MAX_COINS; i++) spawnCoin();
  $('overlay').hidden = true; $('hud').hidden = false;
}
$('play').addEventListener('click', startGame);

async function showBoard() {
  const reply = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData');
  $('board').replaceChildren(...(reply?.entries ?? []).map((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.name}: ${e.stats?.coins ?? e.score ?? 0} coins`;
    return li;
  }));
}

async function endGame() {
  state.mode = 'over';
  clearCoins();
  $('hud').hidden = true; $('overlay').hidden = false;
  $('title').textContent = 'Time is up!';
  $('info').hidden = true;
  $('play').textContent = 'Play again';
  const base = `You collected ${state.coins} coins.`;
  $('result').textContent = base;
  if (signedIn) {
    const r = await askStartNg({ type: 'startng:score', stats: { coins: state.coins } }, 'startng:scoreSaved');
    $('result').textContent = base + (r?.ok
      ? (r.result.improved ? ` New best! You are #${r.result.rank}.` : ` Your best is ${r.result.best} (#${r.result.rank}).`)
      : ' Your score could not be saved.');
  } else {
    $('result').textContent = base + ' Sign in to save your score.';
  }
  showBoard();
}

/* ========== 6. Main loop ========== */
const clock = new THREE.Clock();
let t = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  const dir = state.mode === 'playing' ? moveDirection() : null;

  if (dir) {
    const p = character.position;
    p.x = Math.max(-LIMIT, Math.min(LIMIT, p.x + dir.x * SPEED * dt));
    p.z = Math.max(-LIMIT, Math.min(LIMIT, p.z + dir.z * SPEED * dt));
    let diff = Math.atan2(dir.x, dir.z) - character.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    character.rotation.y += diff * Math.min(1, dt * 12);
  }
  const { legs, arms } = character.userData;
  const swing = dir ? Math.sin(t * 12) * 0.8 : 0;
  legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
  arms[0].rotation.x = -swing; arms[1].rotation.x = swing;
  character.position.y = dir ? Math.abs(Math.sin(t * 12)) * 0.1 : 0;

  coinMeshes.forEach((m, i) => { m.rotation.y += dt * 3; m.position.y = 1 + Math.sin(t * 3 + i) * 0.12; });

  if (state.mode === 'playing') {
    for (let i = coinMeshes.length - 1; i >= 0; i--) {
      const m = coinMeshes[i];
      if (Math.hypot(m.position.x - character.position.x, m.position.z - character.position.z) < 1.2) {
        scene.remove(m); coinMeshes.splice(i, 1); state.coins++; spawnCoin();
      }
    }
    state.timeLeft -= dt;
    $('coins').textContent = state.coins;
    $('time').textContent = Math.max(0, Math.ceil(state.timeLeft));
    if (state.timeLeft <= 0) endGame();
  }

  const c = character.position;
  camera.position.lerp(new THREE.Vector3(c.x, 14, c.z + 11), Math.min(1, dt * 5));
  camera.lookAt(c.x, 0.5, c.z - 1);
  renderer.render(scene, camera);
});
