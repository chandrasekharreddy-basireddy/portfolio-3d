/* main.js - loading, characters, stations, UI, game loop */
(function () {
  'use strict';
  var W = window.WORLD;
  var M = Math, PI = M.PI;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function angLerp(a, b, t) { var d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * t; }
  function lerpTo(a, b, dt, k) { return a + (b - a) * (1 - M.exp(-k * dt)); }

  var GAME = window.__GAME = { state: 'loading', p: 0, discovered: [], season: 'summer', frames: 0, errors: [], animWeights: null, modelLoaded: false, startTime: 0 };

  /* ---------- boot ---------- */
  var canvas = document.getElementById('world-canvas');
  var refs = W.init(canvas);
  var scene = refs.scene, camera = refs.camera, renderer = refs.renderer;

  /* ---------- asset loading with real progress ---------- */
  var loaderEl = document.getElementById('loader');
  var barEl = loaderEl.querySelector('.bar i');
  var statusEl = loaderEl.querySelector('.status');
  var startBtn = document.getElementById('btn-start');
  var ASSET_URLS = {
    avatar: 'https://raw.githubusercontent.com/nartc/ngt-lipsync/4dfb6de6b8c99aa6b16efba4a65377e29a2bc483/public/67219b35aa658e812daccbd7.glb',
    fox: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb',
    horse: 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/models/gltf/Horse.glb',
    flamingo: 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/models/gltf/Flamingo.glb',
    clipsIdle: 'models/clips-idle.json',
    clipsWalk: 'models/clips-walk.json',
    clipsRun: 'models/clips-run.json',
    photo: 'assets/profile.jpg'
  };
  var ASSETS = { avatar: null, fox: null, horse: null, flamingo: null, clips: null, photo: null };
  var LOAD_TOTAL = 8, loadedCount = 0;
  var loaders = [
    ['avatar', ASSET_URLS.avatar, 'loading the walker'],
    ['fox', ASSET_URLS.fox, 'waking the fox'],
    ['horse', ASSET_URLS.horse, 'leading out the horse'],
    ['flamingo', ASSET_URLS.flamingo, 'calling the flamingos'],
    ['clipsIdle', ASSET_URLS.clipsIdle, 'rehearsing movements'],
    ['clipsWalk', ASSET_URLS.clipsWalk, 'rehearsing movements'],
    ['clipsRun', ASSET_URLS.clipsRun, 'rehearsing movements'],
    ['photo', ASSET_URLS.photo, 'framing the photo']
  ];
  function loadAll(done) {
    loaders.forEach(function (item) {
      var key = item[0], url = item[1], label = item[2];
      statusEl.textContent = label;
      if (key === 'clipsIdle' || key === 'clipsWalk' || key === 'clipsRun') {
        fetch(url).then(function (r) { return r.json(); }).then(function (j) {
          ASSETS[key] = j;
          if (ASSETS.clipsIdle && ASSETS.clipsWalk && ASSETS.clipsRun) {
            ASSETS.clips = [ASSETS.clipsIdle, ASSETS.clipsWalk, ASSETS.clipsRun];
          }
          step();
        });
      } else if (key === 'photo') {
        if (window.__PHOTO_URI) {
          new THREE.TextureLoader().load(window.__PHOTO_URI, function (t) {
            t.encoding = THREE.sRGBEncoding;
            ASSETS.photo = t;
            step();
          });
        } else {
          var parts = [];
          for (var pi = 1; pi <= 8; pi++) parts.push(fetch('assets/photo.b64.' + pi).then(function (r) { return r.text(); }));
          Promise.all(parts).then(function (txts) {
            var bin = atob(txts.join(''));
            var bytes = new Uint8Array(bin.length);
            for (var bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
            var blob = new Blob([bytes], { type: 'image/jpeg' });
            new THREE.TextureLoader().load(URL.createObjectURL(blob), function (t) {
              t.encoding = THREE.sRGBEncoding;
              ASSETS.photo = t;
              step();
            });
          });
        }
      } else {
        fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
          ASSETS[key] = buf;
          step();
        });
      }
    });
    function step() {
      loadedCount++;
      barEl.style.width = M.round(loadedCount / LOAD_TOTAL * 100) + '%';
      if (loadedCount >= LOAD_TOTAL) {
        statusEl.textContent = 'ready';
        setTimeout(function () { done(); }, 350);
      }
    }
  }

  /* ---------- stations + boards ---------- */
  var STATIONS = [
    { id: 'home', label: 'HOME', p: 0.04 },
    { id: 'about', label: 'ABOUT', p: 0.215 },
    { id: 'skills', label: 'SKILLS', p: 0.40 },
    { id: 'projects', label: 'PROJECTS', p: 0.585 },
    { id: 'education', label: 'EDUCATION', p: 0.77 },
    { id: 'contact', label: 'CONTACT', p: 0.955 }
  ];
  function makeBoardTexture(title, no) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 320;
    var x = c.getContext('2d');
    x.fillStyle = '#8a643c'; x.fillRect(0, 0, 512, 320);
    x.fillStyle = '#9c7448'; for (var i = 0; i < 7; i++) x.fillRect(0, i * 48 + 4, 512, 4);
    x.fillStyle = '#3a2a18'; x.fillRect(10, 10, 492, 300);
    x.fillStyle = '#e8b04b'; x.font = '600 60px Georgia'; x.textAlign = 'center';
    x.fillText('0' + no, 256, 120);
    x.fillStyle = '#f2ead8'; x.font = '72px Georgia';
    x.fillText(title, 256, 235);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  function buildStations() {
    STATIONS.forEach(function (st, i) {
      var tp = W.trailPos(st.p);
      var grp = new THREE.Group();
      var board = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 2.1, 0.16),
        new THREE.MeshStandardMaterial({ map: makeBoardTexture(st.label, i + 1), roughness: 0.9 })
      );
      board.position.y = 2.5;
      board.castShadow = W.HQ();
      var postL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x5c4128, roughness: 1 }));
      postL.position.set(-1.2, 1.7, -0.02);
      var postR = postL.clone(); postR.position.x = 1.2;
      var roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x5c4128, roughness: 1 }));
      roof.position.y = 3.62;
      grp.add(board, postL, postR, roof);
      var bx = -4.6, bz = tp.z;
      grp.position.set(bx, W.terrainHeight(bx, bz), bz);
      grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), terrainNormal(bx, bz));
      grp.rotateY(PI / 2 - 0.4);
      addBlob(grp, 1.55, 0.03);
      scene.add(grp);
      st.board = grp;
      st.boardMid = new THREE.Vector3(bx, W.terrainHeight(bx, bz) + 2.4, bz);
      var light = new THREE.PointLight(0xffd9a0, 0.55, 9);
      light.position.set(bx + 1.6, W.terrainHeight(bx, bz) + 3.4, bz + 1.4);
      scene.add(light);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 1 }));
      pole.position.set(bx + 1.6, W.terrainHeight(bx, bz) + 2.85, bz + 1.4);
      scene.add(pole);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.copy(pole.position); bulb.position.y += 0.62;
      bulb.visible = false;
      scene.add(bulb);
      lamps.push({ light: light, bulb: bulb });
    });
    // photo on home board
    var frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 })
    );
    var photo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshStandardMaterial({ map: ASSETS.photo, roughness: 0.75 })
    );
    photo.position.z = 0.045;
    frame.add(photo);
    frame.position.set(0, -0.15, 0.1);
    frame.rotation.x = -0.08;
    STATIONS[0].board.add(frame);
  }

  /* ---------- characters ---------- */
  var gltfLoader = new THREE.GLTFLoader();
  var MODEL_FWD = PI;
  var charClips = null;
  function buildClips() {
    charClips = ASSETS.clips.map(function (c) {
      var tracks = c.tracks.map(function (t) {
        if (t.name.indexOf('.quaternion') >= 0) return new THREE.QuaternionKeyframeTrack(t.name, t.times, t.values);
        return new THREE.VectorKeyframeTrack(t.name, t.times, t.values);
      });
      return new THREE.AnimationClip(c.name, c.duration, tracks);
    });
  }
  var blobTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  function addBlob(obj, r, y) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -PI / 2;
    m.position.y = y;
    m.renderOrder = 1;
    obj.add(m);
    return m;
  }
  function poseHands(obj) {
    var HP = window.__HANDP || { axis: 'x', sign: 1, amp: 1 };
    var e = new THREE.Euler(), q = new THREE.Quaternion();
    obj.traverse(function (o) {
      if (!o.isBone) return;
      var m = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)([1-4])$/.exec(o.name);
      if (!m) return;
      var base = { Thumb: 0.48, Index: 0.58, Middle: 0.6, Ring: 0.62, Pinky: 0.64 }[m[2]];
      var amt = HP.sign * base * HP.amp * (m[3] === '1' ? 0.72 : 1);
      if (HP.axis === 'x') e.set(amt, 0, 0); else if (HP.axis === 'y') e.set(0, amt, 0); else e.set(0, 0, amt);
      q.setFromEuler(e);
      o.quaternion.copy(q);
    });
  }
  var swingE = new THREE.Euler(), swingQ = new THREE.Quaternion();
  function armSwing(rig, phase, amp) {
    if (!rig.armL || !rig.armR) return;
    var s = M.sin(phase) * amp;
    swingE.set(s, 0, 0); swingQ.setFromEuler(swingE);
    rig.armL.quaternion.multiply(swingQ);
    swingE.set(-s, 0, 0); swingQ.setFromEuler(swingE);
    rig.armR.quaternion.multiply(swingQ);
    if (rig.spine) {
      swingE.set(amp * 0.2, -M.cos(phase) * amp * 0.3, 0); swingQ.setFromEuler(swingE);
      rig.spine.quaternion.multiply(swingQ);
    }
  }
  function terrainNormal(x, z) {
    var e2 = 0.6;
    var n = new THREE.Vector3(
      W.terrainHeight(x - e2, z) - W.terrainHeight(x + e2, z),
      2 * e2,
      W.terrainHeight(x, z - e2) - W.terrainHeight(x, z + e2)
    );
    return n.normalize();
  }
  function makeCharacter(opts, onReady) {
    try {
      gltfLoader.parse(ASSETS.avatar, '', function (g) {
        try {
          var obj = g.scene;
          var mats = {};
          obj.traverse(function (o) {
            if (o.isMesh || o.isSkinnedMesh) {
              o.castShadow = W.HQ();
              o.frustumCulled = false;
              if (o.material && o.material.map) {
                o.material = o.material.clone();
                var key = o.name;
                if (key.indexOf('Outfit_Top') >= 0) mats.top = o.material;
                if (key.indexOf('Outfit_Bottom') >= 0) mats.bottom = o.material;
                if (key.indexOf('Outfit_Footwear') >= 0) mats.shoes = o.material;
              }
            }
          });
          if (mats.top && opts.top !== undefined) mats.top.color.setHex(opts.top);
          if (mats.bottom && opts.bottom !== undefined) mats.bottom.color.setHex(opts.bottom);
          var mixer = new THREE.AnimationMixer(obj);
          var actions = {};
          charClips.forEach(function (c) {
            var a = mixer.clipAction(c);
            a.play();
            a.setEffectiveWeight(c.name === 'Idle' ? 1 : 0);
            actions[c.name.toLowerCase()] = a;
          });
          var head = null, hand = null, armL = null, armR = null, spine = null;
          obj.traverse(function (o) {
            if (!o.isBone) return;
            if (o.name === 'Head' && !head) head = o;
            if (o.name === 'RightHand' && !hand) hand = o;
            if (o.name === 'LeftArm' && !armL) armL = o;
            if (o.name === 'RightArm' && !armR) armR = o;
            if (o.name === 'Spine1' && !spine) spine = o;
          });
          poseHands(obj);
          addBlob(obj, 0.62, -0.02);
          onReady({ obj: obj, mixer: mixer, actions: actions, mats: mats, head: head, hand: hand, armL: armL, armR: armR, spine: spine, _headAdd: 0 });
        } catch (e) { GAME.errors.push('character: ' + e.message); onReady(null); }
      }, function (e) { GAME.errors.push('character parse: ' + e); onReady(null); });
    } catch (e) { GAME.errors.push('character: ' + e.message); onReady(null); }
  }
  function headTurn(rig, add) {
    if (!rig.head) return;
    rig.head.rotation.y -= rig._headAdd;
    rig.head.rotation.y += add;
    rig._headAdd = add;
  }
  function attachAnimal(buffer, scale, clipName, speed, onReady) {
    try {
      gltfLoader.parse(buffer, '', function (g) {
        try {
          var obj = g.scene;
          obj.scale.setScalar(scale);
          obj.traverse(function (o) {
            if (o.isMesh || o.isSkinnedMesh) { o.castShadow = W.HQ(); o.frustumCulled = false; }
          });
          var mixer = new THREE.AnimationMixer(obj);
          if (g.animations && g.animations.length) {
            var clip = null;
            g.animations.forEach(function (a) { if (!clip && a.name.indexOf(clipName) >= 0) clip = a; });
            if (!clip) clip = g.animations[0];
            var act = mixer.clipAction(clip);
            act.play();
            act.setEffectiveTimeScale(speed);
          }
          scene.add(obj);
          onReady({ obj: obj, mixer: mixer });
        } catch (e) { GAME.errors.push('animal: ' + e.message); onReady(null); }
      }, function (e) { GAME.errors.push('animal parse: ' + e); onReady(null); });
    } catch (e) { GAME.errors.push('animal: ' + e.message); onReady(null); }
  }

  var playerRig = null, modelReady = false;
  var player = { pos: new THREE.Vector3(), yaw: PI, vel: 0 };
  var friendRig = null, anglerRig = null, npcs = [], foxRig = null, horseRig = null, flamingos = [];
  var lamps = [];

  function buildCharacters() {
    buildClips();
    makeCharacter({ top: 0xffffff, bottom: 0xffffff }, function (r) {
      if (!r) return;
      playerRig = r;
      r.obj.rotation.order = 'YXZ';
      r.obj.position.set(0, W.terrainHeight(0, 38) + 0.04, 38);
      r.obj.rotation.y = player.yaw + MODEL_FWD;
      scene.add(r.obj);
      modelReady = true;
      GAME.model = r.obj;
      GAME.modelLoaded = true;
    });
    makeCharacter({ top: 0x8a5f4a, bottom: 0x3d4652 }, function (r) {
      if (!r) return;
      friendRig = r;
      registerTalker(friendRig, 'friend');
      r.obj.position.set(-2.6, W.terrainHeight(-2.6, 30.4) + 0.04, 30.4);
      scene.add(r.obj);
    });
    [
      { t0: 0.13, t1: 0.38, x: 1.6, top: 0x6f8a4f, bottom: 0x4a4a4a, speed: 1.05 },
      { t0: 0.60, t1: 0.90, x: -1.6, top: 0xa8685c, bottom: 0x39434f, speed: 0.95 }
    ].forEach(function (w) {
      makeCharacter({ top: w.top, bottom: w.bottom }, function (r) {
        if (!r) return;
        var npc = { rig: r, t: w.t0, dir: 1, x: w.x, t0: w.t0, t1: w.t1, speed: w.speed };
        npcs.push(npc);
        registerTalker(r, npcs.length === 1 ? 'walker' : 'walker2');
        var tp = W.trailPos(npc.t);
        r.obj.position.set(w.x, W.terrainHeight(w.x, tp.z) + 0.04, tp.z);
        scene.add(r.obj);
      });
    });
    makeCharacter({ top: 0x5d6b4f, bottom: 0x4a4034 }, function (r) {
      if (!r) return;
      anglerRig = r;
      registerTalker(anglerRig, 'angler');
      var ax = 3.7, az = 6.4;
      r.obj.position.set(ax, W.terrainHeight(ax, az) + 0.04, az);
      r.obj.rotation.y = M.atan2(7.5 - ax, 2 - az) + MODEL_FWD;
      scene.add(r.obj);
      var hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }));
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xd4b478, roughness: 1 }));
      var hgrp = new THREE.Group(); hgrp.add(hat, brim);
      r.obj.add(hgrp);
      var hh = null;
      r.obj.traverse(function (o) { if (o.isBone && o.name === 'Head' && !hh) hh = o; });
      if (hh) { hgrp.position.y = 0.14; hh.add(hgrp); }
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }));
      rod.rotation.z = 0.62;
      rod.position.set(0.05, 1.15, 0.25);
      r.obj.add(rod);
      var lineG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.95, 2.0, 0.25), new THREE.Vector3(2.15, 0.35, 1.0)]);
      var line = new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: 0xdddddd }));
      r.obj.add(line);
      var bobber = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd23c3c }));
      bobber.position.set(2.15, 0.18, 1.0);
      r.obj.add(bobber);
      r.bobber = bobber;
    });
    attachAnimal(ASSETS.fox, 0.0065, 'Walk', 1.0, function (r) { foxRig = r; });
    attachAnimal(ASSETS.horse, 0.005, 'horse', 0.85, function (r) { horseRig = r; });
    attachAnimal(ASSETS.flamingo, 0.0032, 'flamingo_flyA_', 1.0, function (r) {
      if (r) flamingos.push({ rig: r, r: 3.4, h: 5.2, phase: 0, speed: 0.5 });
    });
    attachAnimal(ASSETS.flamingo, 0.0038, 'flamingo_flyA_', 1.3, function (r) {
      if (r) flamingos.push({ rig: r, r: 5.2, h: 6.9, phase: 2.4, speed: 0.38 });
    });
  }

  /* ---------- UI ---------- */
  var menu = document.getElementById('menu');
  var hudChip = document.getElementById('hud-chip');
  var hint = document.getElementById('hint');
  var navrail = document.getElementById('navrail');
  var viewbtns = document.getElementById('viewbtns');
  var seasonsBar = document.getElementById('seasons');
  var soundBtn = document.getElementById('btn-sound');
  var trailFill = document.getElementById('trail-fill');
  var trailMarker = document.getElementById('trail-marker');
  var stopDots = document.querySelectorAll('#hud-chip .trailbar u.stop');
  var completeEl = document.getElementById('complete');

  STATIONS.forEach(function (st, i) {
    var b = document.createElement('button');
    b.className = 'nv';
    b.textContent = (i + 1) + ' ' + st.label;
    b.onclick = function () { gotoStation(i); };
    navrail.appendChild(b);
    st.navBtn = b;
  });
  function gotoStation(i) {
    var st = STATIONS[i];
    var max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo({ top: M.floor(max * st.p), behavior: 'smooth' });
  }
  function openCard(id) {
    document.querySelectorAll('.card.open').forEach(function (c) { c.classList.remove('open'); });
    var el = document.getElementById('card-' + id);
    if (el) el.classList.add('open');
  }
  document.querySelectorAll('.card .x').forEach(function (x) {
    x.onclick = function () { x.parentElement.classList.remove('open'); };
  });
  document.querySelectorAll('.se-btn').forEach(function (b) {
    b.onclick = function () {
      W.applySeason(b.getAttribute('data-s'));
      GAME.season = b.getAttribute('data-s');
      document.querySelectorAll('.se-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
    };
  });
  var zoom = 1;
  document.getElementById('btn-zoom-in').onclick = function () { zoom = clamp(zoom * 0.78, 0.4, 2.2); };
  document.getElementById('btn-zoom-out').onclick = function () { zoom = clamp(zoom * 1.28, 0.4, 2.2); };

  /* time of day */
  var timeBtn = document.getElementById('btn-time');
  var TIME_SEQ = ['noon', 'sunset', 'night', 'dawn'];
  var TIME_LBL = { noon: 'NOON', sunset: 'SUNSET', night: 'NIGHT', dawn: 'DAWN' };
  timeBtn.onclick = function () {
    var i = TIME_SEQ.indexOf(W.timeName());
    W.applyTime(TIME_SEQ[(i + 1) % TIME_SEQ.length]);
    timeBtn.textContent = TIME_LBL[W.timeName()];
  };

  /* free walk mode */
  var walkBtn = document.getElementById('btn-walk');
  var joyEl = document.getElementById('joy');
  var joyKnob = document.getElementById('joy-knob');
  var walkMode = false, joyVec = { x: 0, y: 0 }, keys = {};
  walkBtn.onclick = function () {
    walkMode = !walkMode;
    walkBtn.textContent = 'WALK: ' + (walkMode ? 'ON' : 'OFF');
    joyEl.style.display = walkMode ? 'block' : 'none';
    hint.style.display = 'block';
    hint.textContent = walkMode ? '[ WASD / JOYSTICK TO WALK ]' : '[ SCROLL TO WALK ]';
    setTimeout(function () { hint.style.display = 'none'; }, 4000);
    if (!walkMode) {
      smoothP = clamp((W.TRAIL_Z0 - player.pos.z) / W.TRAIL_LEN, 0, 1);
      targetP = smoothP; smoothV = 0;
    }
  };
  window.addEventListener('keydown', function (ev) {
    if (!walkMode) return;
    var k = ev.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) {
      keys[k] = true;
      if (k !== ' ') ev.preventDefault();
    }
  });
  window.addEventListener('keyup', function (ev) { keys[ev.key.toLowerCase()] = false; });
  (function () {
    var pid = null, R = 42;
    function setKnob() {
      joyKnob.style.transform = 'translate(' + (joyVec.x * R) + 'px,' + (joyVec.y * R) + 'px)';
    }
    joyEl.addEventListener('pointerdown', function (ev) {
      pid = ev.pointerId; joyEl.setPointerCapture(pid); ev.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (ev) {
      if (ev.pointerId !== pid) return;
      var r = joyEl.getBoundingClientRect();
      var dx = (ev.clientX - (r.left + r.width / 2)) / R, dy = (ev.clientY - (r.top + r.height / 2)) / R;
      var len = M.sqrt(dx * dx + dy * dy);
      if (len > 1) { dx /= len; dy /= len; }
      joyVec.x = dx; joyVec.y = dy;
      setKnob();
    });
    function end(ev) {
      if (ev.pointerId !== pid) return;
      pid = null; joyVec.x = 0; joyVec.y = 0; setKnob();
    }
    joyEl.addEventListener('pointerup', end);
    joyEl.addEventListener('pointercancel', end);
  })();

  // menu options
  document.querySelectorAll('#opt-quality .opt').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('#opt-quality .opt').forEach(function (x) { x.classList.toggle('on', x === b); });
      var q = b.getAttribute('data-q');
      W.QUALITY.level = q;
      try { localStorage.setItem('csq', q); } catch (e) {}
      applyQuality(q);
    };
  });
  var soundOn = true;
  document.querySelectorAll('#opt-sound .opt').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('#opt-sound .opt').forEach(function (x) { x.classList.toggle('on', x === b); });
      soundOn = b.getAttribute('data-a') === '1';
    };
  });
  function applyQuality(q) {
    renderer.setPixelRatio(q === 'high' ? M.min(2, window.devicePixelRatio) : 1);
    renderer.shadowMap.enabled = q === 'high';
    W.AudioSys.setEnabled(soundOn);
  }

  soundBtn.onclick = function () {
    soundOn = !soundOn;
    W.AudioSys.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
  };

  startBtn.onclick = function () {
    if (GAME.state !== 'menu') return;
    GAME.state = 'playing';
    GAME.startTime = performance.now();
    W.AudioSys.setEnabled(soundOn);
    menu.classList.remove('on');
    hudChip.style.display = 'block';
    seasonsBar.style.display = 'flex';
    soundBtn.style.display = 'block';
    document.getElementById('btn-time').style.display = 'block';
    document.getElementById('btn-walk').style.display = 'block';
    navrail.style.display = 'flex';
    viewbtns.style.display = 'flex';
    hint.style.display = 'block';
    setTimeout(function () { hint.style.display = 'none'; }, 9000);
  };
  document.getElementById('btn-explore').onclick = function () {
    completeEl.classList.remove('on');
  };

  function discover(st) {
    if (GAME.discovered.indexOf(st.id) >= 0) return;
    GAME.discovered.push(st.id);
    document.querySelector('#hud-chip .found').textContent = GAME.discovered.length + ' / 6 stops';
    st.navBtn.classList.add('on');
    stopDots[STATIONS.indexOf(st)].classList.add('on');
    if (GAME.discovered.length === 6) {
      var secs = M.round((performance.now() - GAME.startTime) / 1000);
      document.getElementById('stat-time').textContent = M.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2);
      document.getElementById('stat-season').textContent = GAME.season.charAt(0).toUpperCase() + GAME.season.slice(1);
      completeEl.classList.add('on');
    }
  }

  /* ---------- scroll ---------- */
  var targetP = 0, smoothP = 0, smoothV = 0;
  function readScroll() {
    var max = document.documentElement.scrollHeight - innerHeight;
    targetP = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  /* ---------- telemetry for testing ---------- */
  window.__NPC = function () {
    function pp(r) { return r && r.obj ? [+r.obj.position.x.toFixed(2), +r.obj.position.y.toFixed(2), +r.obj.position.z.toFixed(2)] : null; }
    return {
      player: pp(playerRig), friend: pp(friendRig), angler: pp(anglerRig),
      walkers: npcs.map(function (n) { return pp(n.rig); }),
      fox: pp(foxRig), horse: pp(horseRig), flamingos: flamingos.map(function (f) { return pp(f.rig); }),
      modelReady: modelReady
    };
  };

  /* ---------- NPC speech bubbles ---------- */
  var bubblesEl = document.getElementById('bubbles');
  var NPC_TALK = {
    friend: ['Hey! Welcome to my little world.', 'Walk to the end of the trail, it is worth it.', 'The fox is friendly, I promise.'],
    angler: ['Shh, the fish are resting.', 'I once caught one this big. True story.', 'Monsoon makes the fish hide.'],
    walker: ['Nice weather for a walk today.', 'The lake view is better up ahead.', 'Have you met the horse yet?'],
    walker2: ['Almost at the projects board!', 'Night time here is magical. Try it.', 'Snow is my favorite season here.']
  };
  var talkers = [];
  function registerTalker(rig, key) { talkers.push({ rig: rig, key: key, el: null, line: 0, t: 0 }); }
  var tmpV3 = new THREE.Vector3();
  function tickBubbles(dt) {
    for (var i = 0; i < talkers.length; i++) {
      var T = talkers[i];
      if (!T.rig || !T.rig.head) continue;
      var d = player.pos.distanceTo(T.rig.obj.position);
      var inRange = d < 5.5;
      if (inRange) {
        T.t += dt;
        if (!T.el) {
          T.el = document.createElement('div');
          T.el.className = 'bub';
          bubblesEl.appendChild(T.el);
          T.line = M.floor(M.random() * 3); T.t = 0;
        }
        if (T.t > 4.2) { T.t = 0; T.line = (T.line + 1) % 3; }
        var lines = NPC_TALK[T.key];
        if (T.el.textContent !== lines[T.line]) T.el.textContent = lines[T.line];
        T.rig.head.getWorldPosition(tmpV3);
        tmpV3.y += 0.32;
        tmpV3.project(camera);
        if (tmpV3.z < 1 && tmpV3.z > -1) {
          T.el.style.display = 'block';
          T.el.style.left = ((tmpV3.x * 0.5 + 0.5) * innerWidth) + 'px';
          T.el.style.top = ((-tmpV3.y * 0.5 + 0.5) * innerHeight) + 'px';
        } else T.el.style.display = 'none';
      } else if (T.el) {
        T.el.style.display = 'none';
      }
    }
  }

  /* ---------- loop ---------- */
  var camPos = new THREE.Vector3(0, 3.4, 44), camLook = new THREE.Vector3(0, 1.2, 38);
  var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  var last = performance.now(), tSec = 0, walkPhase = 0;
  var umbrella = W.umbrella();

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = M.min(0.05, (now - last) / 1000);
    last = now;
    tSec += dt;
    GAME.frames++;

    var om = 5.2, hSpeed;
    if (walkMode) {
      smoothV = 0;
      var mx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0) + joyVec.x;
      var mz = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0) + joyVec.y;
      var mlen = M.sqrt(mx * mx + mz * mz);
      if (mlen > 1) { mx /= mlen; mz /= mlen; mlen = 1; }
      var spd = 2.1 + 2.5 * (keys['shift'] || mlen > 0.92 ? 1 : 0);
      hSpeed = mlen * spd;
      if (mlen > 0.06) {
        var nx = player.pos.x + mx * spd * dt;
        var nz = player.pos.z + mz * spd * dt;
        nx = clamp(nx, -13, 13); nz = clamp(nz, -43, 45);
        function inPond(x, z) { var ddx = x - 7.5, ddz = z - 2; return ddx * ddx + ddz * ddz < 5.8 * 5.8; }
        if (!inPond(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
        else if (!inPond(nx, player.pos.z)) { player.pos.x = nx; }
        else if (!inPond(player.pos.x, nz)) { player.pos.z = nz; }
        player.yaw = angLerp(player.yaw, M.atan2(-mx, -mz) - MODEL_FWD, M.min(1, dt * 8));
      }
      player.pos.y = W.terrainHeight(player.pos.x, player.pos.z) + 0.04;
      smoothP = clamp((W.TRAIL_Z0 - player.pos.z) / W.TRAIL_LEN, 0, 1);
      GAME.p = smoothP;
    } else {
      smoothV += ((targetP - smoothP) * om * om - 2 * om * smoothV) * dt;
      smoothP += smoothV * dt;
      smoothP = clamp(smoothP, -0.02, 1.02);
      GAME.p = smoothP;
      hSpeed = M.abs(smoothV) * W.TRAIL_LEN;
      var tp = W.trailPos(clamp(smoothP, 0, 1));
      player.pos.z = tp.z;
      player.pos.x = lerpTo(player.pos.x, tp.x, dt, 2.5);
      player.pos.y = W.terrainHeight(player.pos.x, player.pos.z) + 0.04;
      if (M.abs(smoothV) > 0.0005) {
        var dirYaw = smoothV > 0 ? PI : 0;
        player.yaw = angLerp(player.yaw, dirYaw, M.min(1, dt * 8));
      }
    }

    var idleW = clamp(1 - hSpeed / 0.85, 0, 1);
    var runW = clamp((hSpeed - 1.5) / 2.2, 0, 1);
    var walkW = clamp(hSpeed / 1.25, 0, 1) * (1 - runW);
    var tot = M.max(0.001, idleW + walkW + runW);
    GAME.animWeights = { idle: +(idleW / tot).toFixed(2), walk: +(walkW / tot).toFixed(2), run: +(runW / tot).toFixed(2) };

    if (modelReady) {
      playerRig.obj.position.copy(player.pos);
      playerRig.obj.rotation.y = player.yaw + MODEL_FWD;
      playerRig.obj.rotation.x = 0.05 * (runW / tot);
      playerRig.actions.idle.setEffectiveWeight(idleW / tot);
      playerRig.actions.walk.setEffectiveWeight(walkW / tot);
      playerRig.actions.run.setEffectiveWeight(runW / tot);
      playerRig.mixer.update(dt);
      var mvBlend = clamp((walkW + runW) / tot, 0, 1);
      walkPhase += dt * clamp(hSpeed, 0, 3.2) * (5.2 + 2.2 * (runW / tot));
      armSwing(playerRig, walkPhase, 0.5 * mvBlend * clamp(hSpeed / 1.2, 0, 1));
      var nearSt = null;
      for (var ns = 0; ns < STATIONS.length; ns++) {
        if (M.abs(smoothP - STATIONS[ns].p) < 0.035) { nearSt = STATIONS[ns]; break; }
      }
      var headTarget = 0;
      if (nearSt && idleW > 0.55) {
        tmpV.copy(nearSt.boardMid);
        var local = playerRig.obj.worldToLocal(tmpV.clone());
        headTarget = clamp(M.atan2(-local.x, -local.z), -0.9, 0.9) * 0.55;
      }
      headTurn(playerRig, headTarget);
      if (W.umbrellaOn() && GAME.state === 'playing') {
        umbrella.visible = true;
        if (playerRig.hand) {
          playerRig.hand.getWorldPosition(tmpV2);
          umbrella.position.set(tmpV2.x - 0.1, tmpV2.y - 0.05, tmpV2.z);
          umbrella.rotation.y = playerRig.obj.rotation.y;
        }
      } else umbrella.visible = false;
    }

    if (GAME.state === 'playing') {
      var openId = null;
      for (var i2 = 0; i2 < STATIONS.length; i2++) {
        var st = STATIONS[i2];
        if (M.abs(smoothP - st.p) < 0.035) {
          discover(st);
          openId = st.id;
        }
      }
      if (openId) {
        var cur = document.querySelector('.card.open');
        if (!cur || cur.id !== 'card-' + openId) openCard(openId);
      } else {
        var cur2 = document.querySelector('.card.open');
        if (cur2) cur2.classList.remove('open');
      }
      var pct = clamp(smoothP, 0, 1) * 100;
      trailFill.style.width = pct + '%';
      trailMarker.style.left = pct + '%';
    }

    if (friendRig) {
      friendRig.mixer.update(dt);
      var near = player.pos.distanceTo(friendRig.obj.position) < 12;
      if (near) {
        tmpV.copy(player.pos);
        var lp = friendRig.obj.worldToLocal(tmpV.clone());
        headTurn(friendRig, clamp(M.atan2(lp.x, -lp.z), -0.8, 0.8) * 0.6);
      } else {
        headTurn(friendRig, M.sin(tSec * 0.4) * 0.25);
      }
    }
    for (var w = 0; w < npcs.length; w++) {
      var N = npcs[w];
      N.t += N.dir * N.speed * dt / W.TRAIL_LEN;
      if (N.t > N.t1) { N.t = N.t1; N.dir = -1; }
      if (N.t < N.t0) { N.t = N.t0; N.dir = 1; }
      var wp = W.trailPos(N.t);
      N.rig.obj.position.set(N.x, W.terrainHeight(N.x, wp.z) + 0.04, wp.z);
      N.rig.obj.rotation.y = (N.dir > 0 ? PI : 0) + MODEL_FWD;
      N.rig.actions.idle.setEffectiveWeight(0);
      N.rig.actions.walk.setEffectiveWeight(1);
      N.rig.actions.run.setEffectiveWeight(0);
      N.rig.mixer.update(dt);
      N.phase = (N.phase || 0) + dt * N.speed * 5.4;
      armSwing(N.rig, N.phase, 0.5);
    }
    if (anglerRig) {
      anglerRig.mixer.update(dt);
      if (anglerRig.bobber) anglerRig.bobber.position.y = 0.18 + M.sin(tSec * 1.8) * 0.045;
    }
    if (foxRig) {
      var fa = tSec * 0.35;
      var fx = 1.5 + M.cos(fa) * 5.5, fz = -16 + M.sin(fa) * 4.5;
      var fd = player.pos.distanceTo(foxRig.obj.position);
      if (walkMode && fd < 8 && fd > 1.3) {
        var dx2 = player.pos.x - foxRig.obj.position.x, dz2 = player.pos.z - foxRig.obj.position.z;
        var dl = M.sqrt(dx2 * dx2 + dz2 * dz2) || 1;
        fx = foxRig.obj.position.x + (dx2 / dl) * 2.6 * dt;
        fz = foxRig.obj.position.z + (dz2 / dl) * 2.6 * dt;
        foxRig.obj.rotation.y = M.atan2(dx2, dz2);
      } else if (walkMode && fd <= 1.3) {
        fx = foxRig.obj.position.x; fz = foxRig.obj.position.z;
        foxRig.obj.rotation.y = M.atan2(player.pos.x - fx, player.pos.z - fz);
      } else {
        foxRig.obj.rotation.y = M.atan2(-M.sin(fa) * 5.5, 0.0001) - PI / 2;
      }
      foxRig.obj.position.set(fx, W.terrainHeight(fx, fz), fz);
      if (!foxRig.blob) foxRig.blob = addBlob(foxRig.obj, 0.55 / foxRig.obj.scale.x, 0.025 / foxRig.obj.scale.x);
      foxRig.mixer.update(dt);
    }
    var nf = W.nightFactor();
    for (var li = 0; li < lamps.length; li++) {
      lamps[li].light.intensity = 0.55 + nf * 1.05;
      lamps[li].bulb.visible = nf > 0.08;
    }
    tickBubbles(dt);
    if (horseRig) {
      var ha = tSec * 0.3;
      var hx = 5.5 + M.cos(ha) * 3.5, hz = 19 + M.sin(ha) * 2.6;
      horseRig.obj.position.set(hx, W.terrainHeight(hx, hz) + 0.29, hz);
      if (!horseRig.blob) horseRig.blob = addBlob(horseRig.obj, 1.05 / horseRig.obj.scale.x, -0.26 / horseRig.obj.scale.x);
      horseRig.obj.rotation.y = -ha;
      horseRig.mixer.update(dt);
    }
    for (var f = 0; f < flamingos.length; f++) {
      var F = flamingos[f];
      var pa = tSec * F.speed + F.phase;
      var px2 = 7.5 + M.cos(pa) * F.r, pz2 = 2 + M.sin(pa) * F.r;
      F.rig.obj.position.set(px2, F.h + M.sin(tSec * 1.3 + F.phase) * 0.35, pz2);
      F.rig.obj.rotation.y = -pa + PI / 2;
      F.rig.mixer.update(dt);
    }

    W.tickSeason(dt, tSec);

    var camDist = 4.6 * zoom, camH = 2.1 + 0.35 * (zoom - 1);
    if (walkMode) {
      var fr = player.yaw + MODEL_FWD;
      var fx2 = -M.sin(fr), fz2 = -M.cos(fr);
      tmpV.set(player.pos.x - fx2 * camDist, player.pos.y + camH, player.pos.z - fz2 * camDist);
      camPos.lerp(tmpV, 1 - M.exp(-dt * 4.5));
      camera.position.copy(camPos);
      camLook.lerp(tmpV2.set(player.pos.x + fx2 * 2, player.pos.y + 1.25, player.pos.z + fz2 * 2), 1 - M.exp(-dt * 5));
    } else {
      tmpV.set(player.pos.x, player.pos.y + camH, player.pos.z + camDist);
      camPos.lerp(tmpV, 1 - M.exp(-dt * 4.5));
      camera.position.copy(camPos);
      camLook.lerp(tmpV2.set(player.pos.x, player.pos.y + 1.25, player.pos.z - 2), 1 - M.exp(-dt * 5));
    }
    camera.lookAt(camLook);

    var sunLight = W.sun;
    sunLight.position.set(player.pos.x + 18, 30, player.pos.z + 10);
    sunLight.target.position.copy(player.pos);

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    readScroll();
  });

  /* ---------- go ---------- */
  loadAll(function () {
    buildCharacters();
    buildStations();
    GAME.state = 'menu';
    startBtn.disabled = false;
    startBtn.textContent = 'START WALKING';
    loaderEl.style.opacity = '0';
    setTimeout(function () { loaderEl.style.display = 'none'; }, 750);
    menu.classList.add('on');
  });
  requestAnimationFrame(tick);
})();
