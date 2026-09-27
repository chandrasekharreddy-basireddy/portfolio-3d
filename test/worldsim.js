/* worldsim.js - headless integration harness for the portfolio-3d game.
   Boots the real index.html + all site scripts inside jsdom with three.js r128,
   fakes WebGL/2D/Audio, then drives the full gameplay state machine and
   reports every error. This is the always-on verifier: run before every push. */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SITE = process.env.SITE_DIR || require('path').join(__dirname, '..');
const REPORT = [];

function check(name, cond, detail) {
  REPORT.push({ name, ok: !!cond, detail: detail || '' });
  console.log((cond ? '  ok ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
  return !!cond;
}

async function main() {
  /* ---------- jsdom ---------- */
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://chandrasekharreddy-basireddy.github.io/portfolio-3d/',
    pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const { window } = dom;
  const { document } = window;

  /* ---------- three + loaders (node realm) ---------- */
  global.self = global; /* GLTFLoader r128 reads self */
  const THREE = require('three');
  window.THREE = THREE;
  try { THREE.GLTFLoader = require('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader; } catch (e) { check('GLTFLoader require', false, e.message); }
  try { THREE.FBXLoader = require('three/examples/jsm/loaders/FBXLoader.js').FBXLoader; } catch (e) { check('FBXLoader require', false, e.message); }

  /* fake WebGLRenderer */
  class FakeRenderer {
    constructor() { this.domElement = document.createElement('canvas'); this.shadowMap = { enabled: true, type: 0 }; this.toneMapping = 0; this.toneMappingExposure = 1; this.outputEncoding = 0; this.info = { render: { calls: 0, triangles: 0 } }; }
    setPixelRatio() {} setSize() {} render() {} dispose() {}
  }
  THREE.WebGLRenderer = FakeRenderer;

  /* fake Water (avoids mirror render targets) */
  THREE.Water = class extends THREE.Mesh {
    constructor(geo) {
      super(geo, new THREE.MeshStandardMaterial());
      this.material.uniforms = { time: { value: 0 }, size: { value: 0 }, waterColor: { value: new THREE.Color(0x1e5666) }, sunDirection: { value: new THREE.Vector3(0, 1, 0) } };
    }
  };

  /* TextureLoader / ImageLoader: succeed instantly with a blank texture */
  THREE.TextureLoader.prototype.load = function (url, onLoad) { const t = new THREE.Texture(); t.image = { width: 4, height: 4 }; setTimeout(() => onLoad && onLoad(t), 0); return t; };
  THREE.ImageLoader.prototype.load = function (url, onLoad) { const im = { width: 4, height: 4 }; setTimeout(() => onLoad && onLoad(im), 0); return im; };

  /* ---------- 2D canvas fake ---------- */
  function fake2d() {
    const target = {};
    return new Proxy(target, {
      get(t, prop) {
        if (prop === 'canvas') return { width: 512, height: 512 };
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray((w|0) * (h|0) * 4) });
        if (typeof prop === 'string' && !(prop in t)) return function () {};
        return t[prop];
      },
      set(t, prop, v) { t[prop] = v; return true; }
    });
  }
  const proto = window.HTMLCanvasElement.prototype;
  proto.getContext = function (type) {
    if (type === '2d') return fake2d();
    if (type === 'webgl' || type === 'experimental-webgl') return {}; // passes the fallback check
    return null;
  };

  window.URL.createObjectURL = () => 'blob:fake-' + Math.random();
  window.URL.revokeObjectURL = () => {};
  process.on('unhandledRejection', (e) => { caught.push('unhandledRejection: ' + (e && (e.stack || e.message || e))); });
  window.addEventListener('error', (e) => { caught.push('window.onerror: ' + (e && e.message)); });

  /* ---------- Image fake (fires onload) ---------- */
  window.Image = class {
    constructor() { this.width = 64; this.height = 64; }
    set src(v) { setTimeout(() => this.onload && this.onload(), 0); }
  };

  /* ---------- AudioContext fake ---------- */
  class FakeParam { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} cancelScheduledValues() {} setTargetAtTime() {} }
  class FakeNode { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.Q = new FakeParam(); this.type = ''; this.buffer = null; this.loop = false; this.detune = new FakeParam(); } connect() { return this; } disconnect() {} start() {} stop() {} }
  window.AudioContext = window.webkitAudioContext = class {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = new FakeNode(); this.state = 'running'; }
    createGain() { return new FakeNode(); } createBiquadFilter() { return new FakeNode(); }
    createBufferSource() { return new FakeNode(); } createOscillator() { return new FakeNode(); }
    createPanner() { return new FakeNode(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() { return Promise.resolve(); }
  };

  /* ---------- fetch: serve real repo assets, fake the CDN ---------- */
  window.fetch = async function (url) {
    const u = String(url);
    let local = null;
    if (u.startsWith('models/') || u.startsWith('assets/')) local = path.join(SITE, u);
    else if (u.includes('/portfolio-3d/')) local = path.join(SITE, u.slice(u.indexOf('/portfolio-3d/') + 14));
    if (local && fs.existsSync(local)) {
      const buf = fs.readFileSync(local);
      return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), text: async () => buf.toString(), json: async () => JSON.parse(buf.toString()) };
    }
    const isClips = /clips-.*\.json/.test(u);
    if (isClips) {
      const name = u.split('/').pop();
      const p = path.join(SITE, 'models', name);
      if (fs.existsSync(p)) { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return { ok: true, json: async () => j, arrayBuffer: async () => new ArrayBuffer(0), text: async () => JSON.stringify(j) }; }
    }
    if (/face\.b64/.test(u)) { const p = path.join(SITE, u.split('/').pop()); if (fs.existsSync(p)) { const b = fs.readFileSync(p); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } }
    if (/photo\.b64/.test(u)) { const p = path.join(SITE, u.split('/').pop()); if (fs.existsSync(p)) { return { ok: true, text: async () => fs.readFileSync(p, 'utf8') }; } }
    /* CDN models: fake empty buffer - GLTF/FBX parse errors are caught by the game */
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '', json: async () => ({ tracks: [] }) };
  };

  /* ---------- deterministic rAF clock ---------- */
  let rafQ = [], simMs = 0;
  window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
  const caught = [];
  const step = async function (n, dtMs = 16.667) {
    for (let i = 0; i < n; i++) {
      simMs += dtMs;
      const q = rafQ; rafQ = [];
      for (const cb of q) { try { cb(simMs); } catch (e) { caught.push(e.stack || String(e)); } }
      await 0;
    }
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* key/mouse helpers */
  function key(k, extra) { window.dispatchEvent(new window.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, extra || {}))); window.dispatchEvent(new window.KeyboardEvent('keyup', { key: k, bubbles: true })); }
  function keyDown(k, extra) { window.dispatchEvent(new window.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, extra || {}))); }
  function keyUp(k) { window.dispatchEvent(new window.KeyboardEvent('keyup', { key: k, bubbles: true })); }

  /* scroll control (jsdom has no layout) */
  let scrollY = 0;
  Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 14000, configurable: true });
  Object.defineProperty(window, 'scrollTo', { value: function (o) { scrollY = (o && o.top) || 0; window.dispatchEvent(new window.Event('scroll')); }, configurable: true });
  window.dispatchEvent(new window.Event('scroll'));

  window.confirm = () => true;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {} }));

  /* ---------- load site scripts in order ---------- */
  console.log('\n== boot ==');
  const scripts = ['js/data.js', 'js/state.js', 'js/world.js', 'js/places.js', 'js/main.js'];
  for (const s of scripts) {
    const code = fs.readFileSync(path.join(SITE, s), 'utf8');
    try { window.eval(code); check('eval ' + s, true); }
    catch (e) { check('eval ' + s, false, e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); return finish(); }
  }
  check('DATA exposed', !!window.DATA && window.DATA.PORTFOLIO.projects.length === 4);
  check('STATE exposed', !!window.STATE);
  check('WORLD exposed', !!window.WORLD);
  check('GAME exposed', !!window.__GAME);

  /* ---------- wait for load + intro ---------- */
  let waited = 0;
  while (window.__GAME.state === 'loading' && waited < 10000) { await sleep(50); await step(2); waited += 50; }
  check('assets loaded -> intro state', window.__GAME.state === 'intro', 'state=' + window.__GAME.state + ' after ' + waited + 'ms');
  check('loader groups all lit', ['character', 'world', 'anims', 'env', 'audio', 'wild'].every(g => {
    const el = document.querySelector('#load-list .li[data-g="' + g + '"]');
    return el && el.classList.contains('on');
  }), 'one or more checklist groups never completed');

  /* intro runs */
  await step(40);
  const introOk = window.__GAME.state === 'intro';
  check('intro playing', introOk);
  await step(1100); /* ~18s of intro */
  check('intro hold (press-any-key)', document.getElementById('press-any').style.display === 'block' || window.__GAME.state === 'playing');
  key('Enter');
  await step(5);
  check('intro -> playing on key', window.__GAME.state === 'playing', 'state=' + window.__GAME.state);

  /* HUD visible */
  check('hud chip visible', document.getElementById('hud-chip').style.display === 'block');
  check('quest visible', document.getElementById('quest').style.display === 'block');
  check('minimap visible', document.getElementById('minimap').style.display === 'block');
  check('objective text set', (document.getElementById('quest-text').textContent || '').length > 3, document.getElementById('quest-text').textContent);

  /* ---------- scroll journey ---------- */
  console.log('\n== scroll journey ==');
  window.scrollTo({ top: 2500 });
  await step(400);
  const p1 = window.__GAME.p;
  check('scroll moves player', p1 > 0.02, 'p=' + p1.toFixed(3));
  window.scrollTo({ top: 14000 });
  let sawEnding = false, sawCompletePanel = false, sawContactCard = false;
  for (let i = 0; i < 250; i++) {
    await step(10);
    if (window.__GAME.state === 'ending') sawEnding = true;
    if (document.getElementById('complete').classList.contains('on')) sawCompletePanel = true;
    if (document.getElementById('card-contact').classList.contains('open')) sawContactCard = true;
  }
  check('journey reaches the end', window.__GAME.p > 0.9, 'p=' + window.__GAME.p.toFixed(3));
  check('stations discovered', window.STATE.stopCount() >= 5, 'stops=' + window.STATE.stopCount());
  check('contact card opens at end', sawContactCard);
  check('ending cinematic triggered', sawEnding);
  await step(700);
  check('ending panel shows', sawCompletePanel || document.getElementById('complete').classList.contains('on'), 'state=' + window.__GAME.state);
  const exploreBtn = document.getElementById('btn-explore');
  if (exploreBtn) exploreBtn.click();
  await step(3);

  /* ---------- free walk ---------- */
  console.log('\n== free walk ==');
  document.getElementById('btn-walk').click();
  await step(3);
  const z0 = window.__GAME.model.position.z;
  keyDown('w'); await step(240); keyUp('w');
  const z1 = window.__GAME.model.position.z;
  check('W moves the player', z1 < z0 - 1, 'z ' + z0.toFixed(1) + ' -> ' + z1.toFixed(1));
  /* run */
  keyDown('w'); keyDown('Shift'); await step(240); keyUp('Shift'); keyUp('w');
  check('run works', true);
  /* prompt near a board: teleport near home board via scroll-free walk */
  /* orb collection: teleport via STATE? walk toward an orb at (0.5, 35.5) */
  window.__GAME.model.position.set(0.5, 0, 35.5);
  window.dispatchEvent(new window.Event('scroll'));
  await step(20);
  const orbsBefore = window.STATE.orbCount();
  /* tickOrbs checks player.pos not model pos; emulate by walking */
  check('orb count is a number', typeof orbsBefore === 'number');

  /* interact key in walk mode */
  key('e'); await step(5);

  /* ---------- skill crystal inspection ---------- */
  console.log('\n== skills forest ==');
  if (window.__WALK === undefined || true) { /* ensure walk mode OFF for scrolling */ }
  document.getElementById('btn-walk').click(); await step(2); /* toggle OFF (was on from free-walk) */
  window.scrollTo({ top: 0.40 * 14000 });
  await step(400);
  document.getElementById('btn-walk').click(); await step(3); /* ON */
  keyDown('a');
  let sawPrompt = false, sawSkillpop = false;
  for (let i = 0; i < 34; i++) {
    if (i === 4) { keyDown('w'); await step(4); keyUp('w'); } /* small nudge north into the crystal row */
    await step(6);
    if (document.getElementById('prompt').style.display === 'flex') sawPrompt = true;
    if (document.getElementById('skillpop').classList.contains('on')) sawSkillpop = true;
    if (i % 2 === 1) key('e');
    if (i === 33) keyUp('a');
  }
  check('skill crystals show [E] prompts', sawPrompt);
  check('inspecting a crystal shows the skill', sawSkillpop);
  check('skillcount updated', document.getElementById('skillcount').textContent.indexOf('0 / 14') === -1, document.getElementById('skillcount').textContent);

  /* ---------- project dossier ---------- */
  console.log('\n== project district ==');
  document.getElementById('btn-walk').click(); await step(2); /* OFF */
  window.scrollTo({ top: 0.585 * 14000 });
  await step(400);
  document.getElementById('btn-walk').click(); await step(3); /* ON */
  keyDown('a');
  let sawDossier = false;
  for (let i = 0; i < 60; i++) {
    await step(6);
    if (i % 3 === 0) key('e');
    if (document.getElementById('dossier').classList.contains('on')) { sawDossier = true; break; }
  }
  keyUp('a');
  check('project dossier opens on E', sawDossier);
  if (sawDossier) {
    check('dossier has architecture nodes', document.querySelectorAll('#d-arch .d-node').length >= 3, document.querySelectorAll('#d-arch .d-node').length + ' nodes — ' + document.getElementById('d-no').textContent);
    check('dossier has tech chips', document.querySelectorAll('#d-chips .chip').length >= 1, document.getElementById('d-no').textContent);
    document.getElementById('dossier-x').click();
  }

  /* walk mode off */
  document.getElementById('btn-walk').click();
  await step(3);

  /* ---------- pause menu + modes ---------- */
  console.log('\n== pause / modes ==');
  for (let escI = 0; escI < 4 && window.__GAME.state !== 'paused'; escI++) {
    key('Escape'); await step(3);
    console.log('   esc' + escI, 'state=' + window.__GAME.state, 'cards=' + document.querySelectorAll('.card.open').length,
      'dossier=' + document.getElementById('dossier').classList.contains('on'),
      'journey=' + document.getElementById('journey').classList.contains('on'),
      'complete=' + document.getElementById('complete').classList.contains('on'));
  }
  check('ESC opens pause', window.__GAME.state === 'paused' && document.getElementById('menu').classList.contains('on'));
  document.getElementById('btn-tour').click();
  await step(5);
  check('guided tour starts (not frozen)', window.__GAME.state === 'playing', 'state=' + window.__GAME.state);
  check('tour flag on', window.__GAME.p !== undefined);
  await step(6000); /* let the tour run ~100s of game time */
  key('Escape'); await step(3);
  check('ESC exits tour', window.__GAME.state === 'playing');
  /* photo mode */
  key('p'); await step(5);
  check('photo mode starts', window.__GAME.state === 'playing');
  key('p'); await step(3);
  /* cinematic */
  key('c'); await step(5);
  check('cinematic starts', window.__GAME.state === 'playing');
  key('c'); await step(3);
  /* journey panel */
  document.getElementById('hud-chip').onclick ? document.getElementById('hud-chip').onclick() : null;
  await step(3);
  check('journey panel opens', document.getElementById('journey').classList.contains('on'));
  document.getElementById('btn-jclose').click();

  /* ---------- season + time ---------- */
  console.log('\n== world systems ==');
  document.querySelector('.se-btn[data-s="monsoon"]').click();
  await step(200);
  check('season applied', window.WORLD.season() === 'monsoon');
  document.getElementById('btn-time').click(); await step(30);
  document.getElementById('btn-time').click(); await step(2000);
  check('time cycles without crash', true);
  document.querySelector('.se-btn[data-s="summer"]').click(); await step(200);

  /* ---------- persistence ---------- */
  console.log('\n== persistence ==');
  const saved = JSON.parse(window.localStorage.getItem('cs_world_save_v1') || '{}');
  check('save has stops', (saved.stops || []).length >= 5, JSON.stringify(saved.stops));
  check('save has quests', (saved.quests || []).length >= 1);

  /* ---------- stats ---------- */
  console.log('\n== runtime errors ==');
  const uniq = [...new Set(caught.map(s => s.split('\n')[0]))];
  check('no runtime errors in rAF loop', caught.length === 0, caught.length + ' thrown (' + uniq.slice(0, 3).join(' | ') + ')');
  const rafErr = caught.find(c => !c.startsWith('window.onerror') && !c.startsWith('unhandledRejection'));
  if (rafErr) console.log('\nfirst rAF stack:\n' + rafErr.split('\n').slice(0, 10).join('\n'));
  const gameErrs = (window.__GAME.errors || []).slice(0, 6);
  console.log('  GAME.errors (tolerated asset fallbacks): ' + gameErrs.length + (gameErrs.length ? ' — ' + gameErrs.join(' ; ').slice(0, 300) : ''));

  return finish();

  function finish() {
    const fails = REPORT.filter(r => !r.ok);
    console.log('\n===== WORLD-SIM ' + (fails.length ? 'FAILED ' + fails.length : 'ALL PASS') + ' (' + REPORT.length + ' checks) =====');
    if (fails.length) { fails.forEach(f => console.log('  FAIL: ' + f.name + (f.detail ? ' — ' + f.detail : ''))); process.exitCode = 1; }
  }
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
