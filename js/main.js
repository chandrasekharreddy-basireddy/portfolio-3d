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
  (function () {
    try {
      var tc = document.createElement('canvas');
      var gl = tc.getContext('webgl') || tc.getContext('experimental-webgl');
      if (!gl) throw new Error('no webgl');
    } catch (e) {
      var fb = document.getElementById('fallback');
      if (fb) fb.classList.add('on');
      var ld = document.getElementById('loader');
      if (ld) ld.style.display = 'none';
      throw e;
    }
  })();
  var canvas = document.getElementById('world-canvas');
  var refs = W.init(canvas);
  var scene = refs.scene, camera = refs.camera, renderer = refs.renderer;

  /* ---------- asset loading with real progress ---------- */
  var loaderEl = document.getElementById('loader');
  var barEl = loaderEl.querySelector('.bar i');
  var statusEl = loaderEl.querySelector('.status');
  var ASSET_URLS = {
    walker: 'models/walker.glb',
    fox: 'models/fox.glb',
    horse: 'models/horse.glb',
    flamingo: 'models/flamingo.glb',
    friend: 'models/friend.glb',
    angler: 'models/angler.glb',
    clipsIdle: 'models/clips-idle.json',
    clipsWalk: 'models/clips-walk.json',
    clipsRun: 'models/clips-run.json',
    photo: 'assets/photo.b64',
    face: 'assets/face.b64',
    wolf: 'models/wolf.fbx',
    ironman: 'models/ironman.glb',
    peacock: 'models/peacock.glb',
    toucan: 'models/toucan.glb',
    bird: 'models/bird.glb',
    monkey: 'models/monkey.glb',
    flower: 'models/flower.glb',
    fallroad: 'models/fallroad.glb',
    birch: 'models/birch.glb'
  };
  var ASSETS = { walker: null, friend: null, angler: null, fox: null, horse: null, flamingo: null, clips: null, photo: null, face: null, wolf: null, ironman: null, peacock: null, toucan: null, bird: null, monkey: null, flower: null, fallroad: null, birch: null };
  var LOAD_GROUPS = {
    character: ['walker', 'friend', 'angler', 'photo', 'face'],
    wild: ['fox', 'horse', 'flamingo', 'wolf', 'peacock', 'toucan', 'bird', 'monkey', 'flower'],
    env: ['fallroad', 'birch'],
    anims: ['clipsIdle', 'clipsWalk', 'clipsRun']
  };
  var loadDone = {};
  function markGroup(g, on) {
    var el = loaderEl.querySelector('.li[data-g="' + g + '"]');
    if (el) el.classList.toggle('on', !!on);
  }
  function refreshGroups() {
    for (var g in LOAD_GROUPS) {
      if (LOAD_GROUPS[g].every(function (k) { return loadDone[k]; })) markGroup(g, true);
    }
  }
  var LOAD_TOTAL = 20, loadedCount = 0;
  var loaders = [
    ['walker', ASSET_URLS.walker, 'loading the walker'],
    ['fox', ASSET_URLS.fox, 'waking the fox'],
    ['horse', ASSET_URLS.horse, 'leading out the horse'],
    ['flamingo', ASSET_URLS.flamingo, 'calling the flamingos'],
    ['friend', ASSET_URLS.friend, 'meeting a friend'],
    ['angler', ASSET_URLS.angler, 'greeting the angler'],
    ['clipsIdle', ASSET_URLS.clipsIdle, 'rehearsing movements'],
    ['clipsWalk', ASSET_URLS.clipsWalk, 'rehearsing movements'],
    ['clipsRun', ASSET_URLS.clipsRun, 'rehearsing movements'],
    ['photo', ASSET_URLS.photo, 'framing the photo'],
    ['face', ASSET_URLS.face, 'putting on a face'],
    ['wolf', ASSET_URLS.wolf, 'waking the wolf'],
    ['ironman', ASSET_URLS.ironman, 'raising the armor'],
    ['peacock', ASSET_URLS.peacock, 'calling the peacock'],
    ['toucan', ASSET_URLS.toucan, 'inviting the toucan'],
    ['bird', ASSET_URLS.bird, 'releasing the birds'],
    ['monkey', ASSET_URLS.monkey, 'finding the monkey'],
    ['flower', ASSET_URLS.flower, 'planting the flowers'],
    ['fallroad', ASSET_URLS.fallroad, 'paving the fall road'],
    ['birch', ASSET_URLS.birch, 'planting the birches']
  ];
  var tipEl = document.getElementById('load-tip');
  var tipI = 0, tipTimer = null;
  if (tipEl && window.DATA && DATA.LOADING_TIPS.length) {
    tipEl.textContent = DATA.LOADING_TIPS[0];
    tipTimer = setInterval(function () {
      tipI = (tipI + 1) % DATA.LOADING_TIPS.length;
      tipEl.textContent = DATA.LOADING_TIPS[tipI];
    }, 4200);
  }

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
          step(key);
        }).catch(function () { GAME.errors.push('asset failed: ' + key); step(key); });
      } else if (key === 'face') {
        var chunkUrls = [];
        for (var fi = 1; fi <= 9; fi++) chunkUrls.push(url + '.' + fi);
        Promise.all(chunkUrls.map(function (cu) { return fetch(cu).then(function (r) { return r.arrayBuffer(); }); }))
          .then(function (bufs) {
            if (!bufs.length) throw new Error('face missing');
            var total = 0;
            bufs.forEach(function (b) { total += b.byteLength; });
            var bytes = new Uint8Array(total);
            var off = 0;
            bufs.forEach(function (b) { bytes.set(new Uint8Array(b), off); off += b.byteLength; });
            var img = new Image();
            img.onload = function () { ASSETS.face = img; step(key); };
            img.onerror = function () { step(key); };
            img.src = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
          }).catch(function () { GAME.errors.push('asset failed: ' + key); step(key); });
      } else if (key === 'photo') {
        if (window.__PHOTO_URI) {
          new THREE.TextureLoader().load(window.__PHOTO_URI, function (t) {
            t.encoding = THREE.sRGBEncoding;
            ASSETS.photo = t;
            step(key);
          }, undefined, function () { step(key); });
        } else {
          var parts = [];
          for (var pi = 1; pi <= 8; pi++) parts.push(fetch('assets/photo.b64.' + pi).then(function (r) { return r.text(); }));
          Promise.all(parts).then(function (txts) {
            if (!txts.join('')) throw new Error('photo missing');
            var bin = atob(txts.join(''));
            var bytes = new Uint8Array(bin.length);
            for (var bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
            var blob = new Blob([bytes], { type: 'image/jpeg' });
            new THREE.TextureLoader().load(URL.createObjectURL(blob), function (t) {
              t.encoding = THREE.sRGBEncoding;
              ASSETS.photo = t;
              step(key);
            }, undefined, function () { step(key); });
          }).catch(function () { GAME.errors.push('asset failed: ' + key); step(key); });
        }
      } else {
        fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
          ASSETS[key] = buf;
          step(key);
        }).catch(function () { GAME.errors.push('asset failed: ' + key); step(key); });
      }
    });
    function step(key) {
      if (key) loadDone[key] = true;
      loadedCount++;
      barEl.style.width = M.round(loadedCount / LOAD_TOTAL * 100) + '%';
      refreshGroups();
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
  function makeBoardTexture(title, no, lines) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 320;
    var x = c.getContext('2d');
    x.fillStyle = '#8a643c'; x.fillRect(0, 0, 512, 320);
    x.fillStyle = '#9c7448'; for (var i = 0; i < 7; i++) x.fillRect(0, i * 48 + 4, 512, 4);
    x.fillStyle = '#3a2a18'; x.fillRect(10, 10, 492, 300);
    x.fillStyle = '#e8b04b'; x.font = '600 60px Georgia'; x.textAlign = 'center';
    x.fillText('0' + no, 256, lines ? 100 : 120);
    x.fillStyle = '#f2ead8'; x.font = '72px Georgia';
    x.fillText(title, 256, lines ? 212 : 235);
    if (lines) {
      x.font = 'italic 21px Georgia';
      x.fillStyle = '#d8c9a3';
      lines.forEach(function (ln, i) { x.fillText(ln, 256, 250 + i * 26); });
    }
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
        new THREE.MeshStandardMaterial({ map: makeBoardTexture(st.label, i + 1, st.id === 'projects' ? ['» Survival School', '» Signal-Lite', '» SaiU V2 — Student OS'] : null), roughness: 0.9 })
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
      (function (id) {
        addInteract({ id: 'st-' + id, label: 'READ THE ' + st.label + ' BOARD', pos: st.boardMid, radius: 4.4, action: function () { openCard(id); } });
      })(st.id);
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
      gltfLoader.parse(ASSETS[opts.src || 'walker'], '', function (g) {
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
          if (opts.keepOutfit) { opts.top = undefined; opts.bottom = undefined; }
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
            if (!o.isBone && o.type !== 'Object3D') return;
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
  /* campus students: walk between two world points with idle pauses */
  function spawnCampusWalker(a, b, tint, speed) {
    makeCharacter({ src: 'friend', top: tint.top, bottom: tint.bottom }, function (r) {
      if (!r) return;
      var n = { rig: r, a: a, b: b, t: 0, dir: 1, speed: speed || 0.8, wait: 1 + M.random() * 2 };
      campusNpcs.push(n);
      r.obj.position.set(a.x, W.terrainHeight(a.x, a.z) + 0.04, a.z);
      scene.add(r.obj);
    });
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
          var actions = {};
          if (g.animations && g.animations.length) {
            var clip = null;
            g.animations.forEach(function (a) {
              actions[a.name.split('|')[0]] = mixer.clipAction(a);
              if (!clip && a.name.indexOf(clipName) >= 0) clip = a;
            });
            if (!clip) clip = g.animations[0];
            var act = mixer.clipAction(clip);
            act.play();
            act.setEffectiveTimeScale(speed);
          }
          scene.add(obj);
          onReady({ obj: obj, mixer: mixer, actions: actions });
        } catch (e) { GAME.errors.push('animal: ' + e.message); onReady(null); }
      }, function (e) { GAME.errors.push('animal parse: ' + e); onReady(null); });
    } catch (e) { GAME.errors.push('animal: ' + e.message); onReady(null); }
  }

  var playerRig = null, modelReady = false;
  var player = { pos: new THREE.Vector3(), yaw: PI, vel: 0, hSpeed: 0, lastMx: 0, lastMz: -1 };
  var friendRig = null, anglerRig = null, npcs = [], foxRig = null, horseRig = null, flamingos = [], foxState = null, campusNpcs = [];
  window.__CAMPUS = campusNpcs; /* telemetry for the worldsim harness */
  var lamps = [];

  function buildCharacters() {
    buildClips();
    makeCharacter({ src: 'walker', keepOutfit: true }, function (r) {
      if (!r) return;
      playerRig = r;
      r.obj.traverse(function (o) {
        if (!o.isMesh) return;
        if (o.name === 'Wolf3D_Facewear' || o.name === 'Wolf3D_Headwear') o.visible = false;
        if (o.name === 'Wolf3D_Head' && ASSETS.face && o.material.map) {
          var cv = document.createElement('canvas'); cv.width = cv.height = 512;
          var cc = cv.getContext('2d');
          cc.drawImage(o.material.map.image, 0, 0);
          var tc = document.createElement('canvas'); tc.width = tc.height = 512;
          var tcc = tc.getContext('2d');
          tcc.drawImage(ASSETS.face, 0, 0, ASSETS.face.width, ASSETS.face.height, 95, 28, 320, 380);
          tcc.globalCompositeOperation = 'destination-in';
          tcc.save();
          tcc.translate(255, 218);
          tcc.scale(128 / 152, 1);
          var rg = tcc.createRadialGradient(0, 0, 118, 0, 0, 152);
          rg.addColorStop(0, 'rgba(0,0,0,1)');
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          tcc.fillStyle = rg;
          tcc.fillRect(-160, -160, 320, 320);
          tcc.restore();
          cc.drawImage(tc, 0, 0);
          var ft2 = new THREE.CanvasTexture(cv);
          ft2.flipY = false;
          ft2.encoding = THREE.sRGBEncoding;
          o.material.map = ft2;
          o.material.needsUpdate = true;
        }
      });
      r.obj.rotation.order = 'YXZ';
      r.obj.position.set(0, W.terrainHeight(0, 38) + 0.04, 38);
      r.obj.rotation.y = player.yaw + MODEL_FWD;
      scene.add(r.obj);
      modelReady = true;
      GAME.model = r.obj;
      GAME.modelLoaded = true;
    });
    makeCharacter({ src: 'friend', keepOutfit: true }, function (r) {
      if (!r) return;
      friendRig = r;
      var tk = registerTalker(friendRig, 'friend');
      addInteract({ id: 'npc-friend', label: 'TALK TO THE FRIEND', pos: r.obj.position, radius: 2.7,
        action: function () { if (tk) { tk.line = (tk.line + 1) % 3; tk.t = 0.5; } } });
      r.obj.position.set(-2.6, W.terrainHeight(-2.6, 30.4) + 0.04, 30.4);
      scene.add(r.obj);
    });
    [
      { t0: 0.13, t1: 0.38, x: 1.6, top: 0x6f8a4f, bottom: 0x4a4a4a, speed: 1.05 },
      { t0: 0.60, t1: 0.90, x: -1.6, top: 0xa8685c, bottom: 0x39434f, speed: 0.95 }
    ].forEach(function (w, wi) {
      makeCharacter({ src: wi === 0 ? 'friend' : 'angler', top: w.top, bottom: w.bottom }, function (r) {
        if (!r) return;
        var npc = { rig: r, t: w.t0, dir: 1, x: w.x, t0: w.t0, t1: w.t1, speed: w.speed };
        npcs.push(npc);
        registerTalker(r, npcs.length === 1 ? 'walker' : 'walker2');
        var tp = W.trailPos(npc.t);
        r.obj.position.set(w.x, W.terrainHeight(w.x, tp.z) + 0.04, tp.z);
        scene.add(r.obj);
      });
    });
    makeCharacter({ src: 'angler', keepOutfit: true }, function (r) {
      if (!r) return;
      anglerRig = r;
      var tkA = registerTalker(anglerRig, 'angler');
      addInteract({ id: 'npc-angler', label: 'TALK TO THE ANGLER', pos: r.obj.position, radius: 2.7,
        action: function () { if (tkA) { tkA.line = (tkA.line + 1) % 3; tkA.t = 0.5; } } });
      var ax = 3.7, az = 6.4;
      r.obj.position.set(ax, W.terrainHeight(ax, az) + 0.04, az);
      r.obj.rotation.y = M.atan2(7.5 - ax, 2 - az) + MODEL_FWD;
      var bob = null;
      r.obj.traverse(function (o) { if (o.name === 'Bobber' && !bob) bob = o; });
      if (bob) { bob.userData.y0 = bob.position.y; r.bobber = bob; }
      scene.add(r.obj);
    });
    attachAnimal(ASSETS.fox, 0.0065, 'Walk', 1.0, function (r) {
      if (!r) return;
      foxRig = r;
      for (var k4 in r.actions) {
        r.actions[k4].play();
        if (k4.indexOf('Walk') < 0) r.actions[k4].setEffectiveWeight(0);
      }
      addInteract({ id: 'pet-fox', label: 'PET THE FOX', pos: r.obj.position, radius: 2.6, action: function () { petAnimal('fox'); } });
    });
    attachAnimal(ASSETS.horse, 0.005, 'horse', 0.85, function (r) {
      if (!r) return;
      horseRig = r;
      addInteract({ id: 'pet-horse', label: 'PET THE HORSE', pos: r.obj.position, radius: 3.2, action: function () { petAnimal('horse'); } });
    });
    attachAnimal(ASSETS.flamingo, 0.0032, 'flamingo_flyA_', 1.0, function (r) {
      if (r) flamingos.push({ rig: r, r: 3.4, h: 5.2, phase: 0, speed: 0.5 });
    });
    attachAnimal(ASSETS.flamingo, 0.0038, 'flamingo_flyA_', 1.3, function (r) {
      if (r) flamingos.push({ rig: r, r: 5.2, h: 6.9, phase: 2.4, speed: 0.38 });
    });
    buildWildlife();
  }

  /* ---------- wildlife park (new models) ---------- */
  var WILD = { birds: [], flowers: [], wolf: null, peacock: null, monkey: null, toucan: null, statueRing: null, fish: [] };
  (function buildFish() {
    var bodyGeo = new THREE.ConeGeometry(0.085, 0.32, 5);
    var tailGeo = new THREE.PlaneGeometry(0.14, 0.11);
    var cols = [0xc9884a, 0x7f9fb8, 0xb0c47f, 0xd8c07a, 0x8a7fb8];
    for (var fi = 0; fi < 5; fi++) {
      var mat = new THREE.MeshStandardMaterial({ color: cols[fi], roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
      var g = new THREE.Group();
      var body = new THREE.Mesh(bodyGeo, mat);
      body.rotation.x = PI / 2;
      var tail = new THREE.Mesh(tailGeo, mat);
      tail.position.z = 0.2;
      g.add(body, tail);
      scene.add(g);
      WILD.fish.push({ grp: g, tail: tail, a: fi * 1.26, r: 2.3 + fi * 0.45, sp: 0.3 + (fi % 3) * 0.08, wob: fi * 1.7, dart: 4 + fi * 3 });
    }
  })();
  function loadGltf(key, cb) {
    try {
      gltfLoader.parse(ASSETS[key], '', function (g) { cb(g.scene); },
        function (e) { GAME.errors.push('glb ' + key + ': ' + e); cb(null); });
    } catch (e) { GAME.errors.push('glb ' + key + ': ' + e.message); cb(null); }
  }
  function prepMesh(o) { if (o.isMesh) { o.castShadow = W.HQ(); o.frustumCulled = false; } }
  function buildWildlife() {
    /* Iron Man armor statue at the projects station */
    loadGltf('ironman', function (obj) {
      if (!obj) return;
      var bx = -8.8, bz = -3.6, gy = W.terrainHeight(bx, bz);
      var plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.95 }));
      plinth.position.set(bx, gy + 0.25, bz);
      plinth.castShadow = W.HQ();
      scene.add(plinth);
      obj.traverse(prepMesh);
      obj.position.set(bx, gy + 0.5, bz);
      obj.rotation.y = PI * 0.5;
      scene.add(obj);
      var glow = new THREE.PointLight(0xffc27a, 0.85, 8);
      glow.position.set(bx + 1.5, gy + 2.1, bz + 0.9);
      scene.add(glow);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0x69d2ff }));
      ring.rotation.x = PI / 2;
      ring.position.set(bx, gy + 0.06, bz);
      scene.add(ring);
      WILD.statueRing = ring;
      var sp = new THREE.Vector3(bx, gy + 1.4, bz);
      addInteract({ id: 'statue', label: 'EXAMINE THE ARMOR', pos: sp, radius: 3.6, action: function () { toastMsg('IRON MAN — guarding the projects district'); } });
    });
    /* peacock strutting by the pond */
    loadGltf('peacock', function (obj) {
      if (!obj) return;
      obj.traverse(prepMesh);
      obj.scale.setScalar(1.05);
      scene.add(obj);
      WILD.peacock = { obj: obj, a: 0 };
    });
    /* toucan perched on a post near the pond */
    var tx = 13.9, tz = 6.2, ty = W.terrainHeight(tx, tz);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4128, roughness: 1 }));
    post.position.set(tx, ty + 0.75, tz);
    post.castShadow = W.HQ();
    scene.add(post);
    loadGltf('toucan', function (obj) {
      if (!obj) return;
      obj.traverse(prepMesh);
      obj.scale.setScalar(1.5);
      obj.position.set(tx, ty + 1.46, tz);
      obj.rotation.y = -PI / 2 - 0.3;
      scene.add(obj);
      WILD.toucan = obj;
    });
    /* monkey hopping between three rocks by the trail */
    var rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    var rockMat = new THREE.MeshStandardMaterial({ color: 0x707a83, roughness: 1 });
    [{ x: 3.9, z: 12.6 }, { x: 5.3, z: 14.1 }, { x: 2.9, z: 14.7 }].forEach(function (s) {
      var rk = new THREE.Mesh(rockGeo, rockMat);
      rk.position.set(s.x, W.terrainHeight(s.x, s.z) + 0.3, s.z);
      rk.castShadow = W.HQ();
      scene.add(rk);
    });
    loadGltf('monkey', function (obj) {
      if (!obj) return;
      obj.traverse(prepMesh);
      obj.scale.setScalar(0.95);
      obj.position.set(3.9, W.terrainHeight(3.9, 12.6) + 0.6, 12.6);
      obj.rotation.y = -PI * 0.35;
      scene.add(obj);
      WILD.monkey = { obj: obj, at: 0, t: 2.5, hop: null };
    });
    /* birds flying wide circles above the valley */
    loadGltf('bird', function (obj) {
      if (!obj) return;
      var cfgs = [
        { r: 27, h: 10.5, sp: 0.16, ph: 0, s: 1.6 },
        { r: 34, h: 13.5, sp: 0.12, ph: 2.3, s: 2.1 },
        { r: 21, h: 8.2, sp: 0.2, ph: 4.1, s: 1.3 }
      ];
      cfgs.forEach(function (c, i2) {
        var b = obj.clone();
        b.traverse(prepMesh);
        b.scale.setScalar(c.s);
        scene.add(b);
        WILD.birds.push({ obj: b, r: c.r, h: c.h, sp: c.sp, ph: c.ph, a: c.ph * 6, mode: 'soar', mt: 9, canLand: i2 === 0 });
      });
    });
    /* anemone flowers along the trail */
    loadGltf('flower', function (obj) {
      if (!obj) return;
      var n = W.HQ() ? 16 : 9, seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed % 1000) / 1000; }
      for (var i = 0; i < n; i++) {
        var f = obj.clone();
        f.traverse(prepMesh);
        var side = i % 2 === 0 ? 1 : -1;
        var fx = side * (2.7 + rnd() * 1.1);
        var fz = 30 - rnd() * 56;
        f.position.set(fx, W.terrainHeight(fx, fz) - 0.02, fz);
        f.scale.setScalar(0.8 + rnd() * 0.6);
        f.rotation.y = rnd() * PI * 2;
        scene.add(f);
        WILD.flowers.push({ obj: f, ph: rnd() * PI * 2 });
        if (WILD.flowers.length === n) {
          try { W.setButterflyAnchors(WILD.flowers.map(function (fl2) { return { x: fl2.obj.position.x, z: fl2.obj.position.z }; })); } catch (e) {}
        }
      }
    });
    /* wolf patrolling the far side with its real walk cycle */
    try {
      var wolfMgr = new THREE.LoadingManager();
      wolfMgr.setURLModifier(function (u) {
        var m = /([^\/\\]+)\.(jpg|jpeg|png)$/i.exec(u);
        if (m) return 'models/wolftex/' + m[1] + '.' + m[2];
        return u;
      });
      var fbxLoader = new THREE.FBXLoader(wolfMgr);
      var wolf = fbxLoader.parse(ASSETS.wolf, 'models/');
      wolf.scale.setScalar(1.7);
      wolf.traverse(prepMesh);
      var walk = null;
      (wolf.animations || []).forEach(function (a) { if (!walk && a.name.indexOf('Walk') >= 0) walk = a; });
      var mixer = new THREE.AnimationMixer(wolf);
      if (walk) {
        var act = mixer.clipAction(walk);
        act.play();
        act.setEffectiveTimeScale(1.05);
      }
      scene.add(wolf);
      WILD.wolf = { obj: wolf, mixer: mixer, t: -22, dir: 1 };
    } catch (e) { GAME.errors.push('wolf: ' + e.message); }
    /* the fall road: a misty autumn lane along the east side */
    loadGltf('fallroad', function (obj) {
      if (!obj) return;
      obj.traverse(prepMesh);
      var ys = [];
      for (var z = 36; z >= -32; z -= 4) ys.push(W.terrainHeight(17, z));
      var yMin = M.min.apply(null, ys), yMax = M.max.apply(null, ys);
      obj.position.set(17, (yMin + yMax) / 2 + 0.05, 2.5);
      scene.add(obj);
    });
    loadGltf('birch', function (obj) {
      if (!obj) return;
      var spots = [
        [13.4, 26, 1.05], [21.6, 20, 0.95], [13.4, 9, 1.1], [21.5, 12, 1.0],
        [13.4, -9, 0.92], [21.7, -5, 1.08], [13.5, -26, 1.0], [21.6, -19, 0.96]
      ];
      var seed = 13;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed % 1000) / 1000; }
      spots.forEach(function (s) {
        var t = obj.clone();
        t.traverse(prepMesh);
        t.position.set(s[0], W.terrainHeight(s[0], s[1]) - 0.05, s[1]);
        t.scale.setScalar(s[2] * (0.9 + rnd() * 0.25));
        t.rotation.y = rnd() * PI * 2;
        scene.add(t);
      });
    });
  }
  function tickWildlife(dt, tSec) {
    if (WILD.peacock) {
      var P = WILD.peacock;
      P.a += dt * 0.16;
      var px = 11.2 + M.cos(P.a) * 2.6, pz = 8.5 + M.sin(P.a) * 1.9;
      P.obj.position.set(px, W.terrainHeight(px, pz) + M.abs(M.sin(tSec * 3.1)) * 0.03, pz);
      P.obj.rotation.y = -P.a;
    }
    var midz = W.TRAIL_Z0 - W.TRAIL_LEN / 2;
    for (var b = 0; b < WILD.birds.length; b++) {
      var B = WILD.birds[b];
      if (!B.mode) B.mode = 'fly';
      if (B.mode === 'fly' || B.mode === 'soar') {
        B.a += dt * B.sp;
        var a = B.a;
        B.obj.position.set(M.cos(a) * B.r, B.h + M.sin(tSec * 0.9 + B.ph) * 0.8, midz + M.sin(a) * B.r * 0.85);
        B.obj.rotation.y = -a - PI / 2;
        B.obj.rotation.z = 0.18;
        if (B.canLand) {
          B.mt -= dt;
          if (B.mt <= 0) {
            B.mode = 'land'; B.mt = 0;
            var perches = [{ x: -9.5, z: 27.6 }, { x: 3.9, z: 12.9 }, { x: -4.6, z: 22.7 }];
            B.perch = perches[M.floor(M.random() * perches.length)];
            B.fx = B.obj.position.x; B.fy = B.obj.position.y; B.fz = B.obj.position.z;
          }
        }
      } else if (B.mode === 'land') {
        B.mt += dt;
        var k2 = M.min(1, B.mt / 2.4);
        var e2 = k2 * k2 * (3 - 2 * k2);
        B.obj.position.set(
          B.fx + (B.perch.x - B.fx) * e2,
          B.fy + (W.terrainHeight(B.perch.x, B.perch.z) + 1.15 - B.fy) * e2,
          B.fz + (B.perch.z - B.fz) * e2);
        B.obj.rotation.z = 0.18 * (1 - e2);
        if (k2 >= 1) { B.mode = 'perch'; B.mt = 6 + M.random() * 5; }
      } else if (B.mode === 'perch') {
        B.mt -= dt;
        B.obj.position.y = W.terrainHeight(B.perch.x, B.perch.z) + 1.15 + M.sin(tSec * 2.6) * 0.015;
        B.obj.rotation.y += M.sin(tSec * 0.8 + B.ph) * 0.003;
        if (B.mt <= 0) {
          B.mode = 'takeoff'; B.mt = 0;
          B.fx = B.obj.position.x; B.fy = B.obj.position.y; B.fz = B.obj.position.z;
        }
      } else if (B.mode === 'takeoff') {
        B.mt += dt;
        var k3 = M.min(1, B.mt / 1.8);
        var e3 = k3 * k3;
        B.obj.position.set(B.fx + (M.cos(B.a) * B.r - B.fx) * e3, B.fy + (B.h - B.fy) * e3, B.fz + (midz + M.sin(B.a) * B.r * 0.85 - B.fz) * e3);
        B.obj.rotation.z = 0.18 * k3;
        if (k3 >= 1) { B.mode = 'fly'; B.mt = 14 + M.random() * 10; }
      }
    }
    /* fish: swim laps in the pond, dart occasionally */
    for (var fs = 0; fs < WILD.fish.length; fs++) {
      var F2 = WILD.fish[fs];
      F2.dart -= dt;
      var burst = F2.dart < 0 && F2.dart > -1.1 ? 2.6 : 1;
      if (F2.dart < -1.1) F2.dart = 5 + M.random() * 9;
      F2.a += dt * F2.sp * burst;
      var fr = F2.r + M.sin(tSec * 0.5 + F2.wob) * 0.5;
      F2.grp.position.set(7.5 + M.cos(F2.a) * fr, -0.3 + M.sin(tSec * 0.8 + F2.wob) * 0.06, 2 + M.sin(F2.a) * fr * 0.86);
      F2.grp.rotation.y = -F2.a + (F2.dart < 0 ? M.sin(tSec * 30) * 0.2 : 0);
      F2.tail.rotation.y = M.sin(tSec * (burst > 1 ? 18 : 7) + F2.wob) * 0.5;
    }
    for (var fl = 0; fl < WILD.flowers.length; fl++) {
      var F = WILD.flowers[fl];
      F.obj.rotation.z = M.sin(tSec * 1.3 + F.ph) * 0.045;
    }
    if (WILD.monkey) {
      var MK = WILD.monkey, mobj = MK.obj;
      if (!MK.spots) {
        MK.spots = [{ x: 3.9, z: 12.6 }, { x: 5.3, z: 14.1 }, { x: 2.9, z: 14.7 }].map(function (s) {
          return { x: s.x, z: s.z, y: W.terrainHeight(s.x, s.z) + 0.6 };
        });
      }
      if (MK.hop) {
        MK.hop.k += dt / MK.hop.dur;
        var hk = M.min(1, MK.hop.k);
        mobj.position.x = MK.hop.fx + (MK.hop.tx - MK.hop.fx) * hk;
        mobj.position.z = MK.hop.fz + (MK.hop.tz - MK.hop.fz) * hk;
        mobj.position.y = MK.hop.fy + (MK.hop.ty - MK.hop.fy) * hk + M.sin(hk * PI) * 0.55;
        mobj.rotation.y = M.atan2(MK.hop.tx - MK.hop.fx, MK.hop.tz - MK.hop.fz);
        if (hk >= 1) { MK.at = MK.hop.to; MK.hop = null; MK.t = 3 + M.random() * 4; }
      } else {
        MK.t -= dt;
        mobj.rotation.z = M.sin(tSec * 1.15) * 0.035;
        mobj.rotation.y = -PI * 0.35 + M.sin(tSec * 0.32) * 0.35;
        if (MK.t <= 0) {
          var to = (MK.at + 1 + M.floor(M.random() * (MK.spots.length - 1))) % MK.spots.length;
          var dst = MK.spots[to];
          MK.hop = { fx: mobj.position.x, fy: mobj.position.y, fz: mobj.position.z, tx: dst.x, ty: dst.y, tz: dst.z, k: 0, dur: 0.5, to: to };
        }
      }
    }
    if (WILD.toucan) WILD.toucan.rotation.x = M.sin(tSec * 2.2) * 0.06;
    if (WILD.wolf) {
      var Wf = WILD.wolf;
      Wf.mixer.update(dt);
      Wf.t += Wf.dir * dt * 1.55;
      if (Wf.t > 14) { Wf.dir = -1; }
      if (Wf.t < -26) { Wf.dir = 1; }
      var wx = -10.6, wz = Wf.t;
      Wf.obj.position.set(wx, W.terrainHeight(wx, wz), wz);
      Wf.obj.rotation.y = Wf.dir > 0 ? 0 : PI;
    }
    if (WILD.statueRing) WILD.statueRing.rotation.z += dt * 0.6;
  }

  /* ---------- UI ---------- */
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
    if (el) { el.classList.add('open'); document.body.classList.add('card-open'); }
  }
  document.querySelectorAll('.card .x').forEach(function (x) {
    x.addEventListener('click', function () { document.body.classList.remove('card-open'); });
  });
  document.querySelectorAll('.card .x').forEach(function (x) {
    x.onclick = function () { x.parentElement.classList.remove('open'); };
  });
  document.querySelectorAll('.se-btn').forEach(function (b) {
    b.onclick = function () {
      var sn = b.getAttribute('data-s');
      W.applySeason(sn);
      GAME.season = sn;
      STATE.seeSeason(sn);
      if (['summer', 'rainy', 'monsoon', 'winter'].every(function (x) { return STATE.data.seasonsSeen.indexOf(x) >= 0; })
          && STATE.unlock('weathered')) { toastMsg('ACHIEVEMENT: WEATHERED'); dingSound(880); }
      document.querySelectorAll('.se-btn').forEach(function (x) {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
    };
  });
  var zoom = 1;
  document.getElementById('btn-zoom-in').onclick = function () { zoom = clamp(zoom * 0.78, 0.4, 2.2); };
  document.getElementById('btn-zoom-out').onclick = function () { zoom = clamp(zoom * 1.28, 0.4, 2.2); };

  /* time of day */
  var timeBtn = document.getElementById('btn-time');
  var TIME_SEQ = ['auto', 'noon', 'sunset', 'night', 'dawn'];
  var TIME_LBL = { auto: 'TIME: AUTO', noon: 'NOON', sunset: 'SUNSET', night: 'NIGHT', dawn: 'DAWN' };
  timeBtn.onclick = function () {
    var i = TIME_SEQ.indexOf(W.timeName());
    var next = TIME_SEQ[(i + 1) % TIME_SEQ.length];
    if (next === 'auto') W.setAutoTime(true);
    else { W.setAutoTime(false); W.applyTime(next); }
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
    /* r128 needs explicit material recompile when shadow support toggles */
    scene.traverse(function (o) { if (o.material) { var mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(function (mat) { mat.needsUpdate = true; }); } });
    W.AudioSys.setEnabled(soundOn);
  }
  (function syncQualityUI() {
    var savedQ = null;
    try { savedQ = localStorage.getItem('csq'); } catch (e) {}
    if (savedQ === 'low') {
      document.querySelectorAll('#opt-quality .opt').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-q') === 'low'); });
    }
  })();

  soundBtn.onclick = function () {
    soundOn = !soundOn;
    W.AudioSys.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
  };

  /* ---------- cinematic intro: black -> name -> descend -> press any key ---------- */
  var introT = 0, INTRO_LEN = 16.5;
  var introCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(30, 55, -36),
    new THREE.Vector3(13, 26, -15),
    new THREE.Vector3(16, 9.5, 2),
    new THREE.Vector3(9.5, 5.2, 8),
    new THREE.Vector3(2.5, 3.8, 20),
    new THREE.Vector3(0, 3.1, 43.5)
  ]);
  var introLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 6, 2),
    new THREE.Vector3(5, 3, 2),
    new THREE.Vector3(12.5, 2.5, 2),
    new THREE.Vector3(7.5, 1, 2),
    new THREE.Vector3(0, 1.4, 22),
    new THREE.Vector3(0, 1.4, 37)
  ]);
  var skipBtn = document.getElementById('btn-skip');
  var nameEl = document.getElementById('intro-name');
  var pressEl = document.getElementById('press-any');
  var fadeEl = document.getElementById('fade');
  var pressShown = false;
  function startIntro() {
    GAME.state = 'intro';
    introT = 0;
    pressShown = false;
    document.getElementById('lbx-t').style.height = '11vh';
    document.getElementById('lbx-b').style.height = '11vh';
    skipBtn.style.display = 'block';
    nameEl.style.opacity = '0';
    pressEl.style.display = 'none';
    // open from black
    fadeEl.style.transition = 'none';
    fadeEl.style.opacity = '1';
    void fadeEl.offsetWidth;
    fadeEl.style.transition = '';
    fadeEl.style.opacity = '0';
  }
  function endIntro() {
    if (GAME.state !== 'intro') return;
    GAME.state = 'playing';
    GAME._justLeftIntro = performance.now();
    GAME.startTime = performance.now();
    skipBtn.style.display = 'none';
    document.getElementById('lbx-t').style.height = '0';
    document.getElementById('lbx-b').style.height = '0';
    nameEl.style.opacity = '0';
    pressEl.style.display = 'none';
    pressShown = false;
    showHud();
    camPos.copy(camera.position);
    hint.style.display = 'block';
    hint.textContent = '[ SCROLL TO WALK ]';
    setTimeout(function () { hint.style.display = 'none'; }, 9000);
    toastMsg('Welcome to the trail');
    W.AudioSys.setEnabled(soundOn);
  }
  skipBtn.onclick = endIntro;
  function introAdvance(dt) {
    introT += dt;
    var it = M.min(1, introT / INTRO_LEN);
    var eIt = it * it * (3 - 2 * it);
    introCurve.getPoint(eIt, tmpV);
    camera.position.copy(tmpV);
    introLook.getPoint(eIt, tmpV2);
    camera.lookAt(tmpV2);
    if (modelReady) playerRig.mixer.update(dt);
    W.tickSeason(dt, tSec);
    // name card phases
    if (introT < 0.9) nameEl.style.opacity = '0';
    else if (introT < 4.8) nameEl.style.opacity = '1';
    else if (introT < 5.6) nameEl.style.opacity = String(M.max(0, 1 - (introT - 4.8) / 0.8));
    else nameEl.style.opacity = '0';
    if (introT >= INTRO_LEN && !pressShown) {
      pressShown = true;
      pressEl.style.display = 'block';
    }
  }
  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (evName) {
    window.addEventListener(evName, function (ev) {
      if (GAME.state !== 'intro') return;
      if (!pressShown) { endIntro(); return; } // any input skips
      if (evName === 'pointerdown' && ev.target && ev.target.id === 'btn-skip') return;
      endIntro();
    }, { passive: true });
  });

  /* ---------- pause menu (ESC) ---------- */
  var menuEl = document.getElementById('menu');
  document.getElementById('btn-resume').onclick = function () { togglePause(); };
  document.getElementById('btn-reset').onclick = function () {
    if (confirm('Reset all progress (orbs, stops, achievements)?')) {
      STATE.reset();
      location.reload();
    }
  };
  function togglePause() {
    if (GAME.state === 'playing') {
      GAME.state = 'paused';
      menuEl.classList.add('on');
    } else if (GAME.state === 'paused') {
      GAME.state = 'playing';
      menuEl.classList.remove('on');
      W.AudioSys.setEnabled(soundOn);
    }
  }
  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (GAME.state === 'ending') { finishEnding(); return; }
      if (GAME.state === 'intro') return; /* intro handles its own input */
      if (performance.now() - (GAME._justLeftIntro || 0) < 600) return; /* don't double-fire right after intro */
      if (GAME.state === 'paused') { togglePause(); return; }
      var anyPanel = document.querySelector('.card.open') || document.getElementById('journey').classList.contains('on') ||
        document.getElementById('complete').classList.contains('on') || document.getElementById('dossier').classList.contains('on');
      if (anyPanel) {
        GAME._cardHold = performance.now();
        document.querySelectorAll('.card.open').forEach(function (c) { c.classList.remove('open'); });
        document.body.classList.remove('card-open');
        document.getElementById('journey').classList.remove('on');
        document.getElementById('dossier').classList.remove('on');
        return;
      }
      if (tour.on || photo.on || cinema.on) { exitModes(); return; }
      togglePause();
    }
    var k2 = ev.key.toLowerCase();
    if (GAME.state !== 'playing') return;
    if (k2 === 'p') { if (photo.on) exitModes(); else enterPhoto(); }
    if (k2 === 'c') { if (cinema.on) exitModes(); else enterCinema(); }
    if (k2 === 'f' && photo.on) takePhoto();
  });

  /* ---------- final cinematic ending ---------- */
  var endT = 0;
  var endFrom = new THREE.Vector3(), endFromLook = new THREE.Vector3();
  function startEnding() {
    if (GAME.state !== 'playing') return;
    GAME.state = 'ending';
    endT = 0;
    endFrom.copy(camera.position);
    endFromLook.copy(camLook);
    document.getElementById('lbx-t').style.height = '11vh';
    document.getElementById('lbx-b').style.height = '11vh';
    hint.style.display = 'none';
    if (window.innerWidth > 700) try { W.AudioSys.ding(520); } catch (e) {}
  }
  function finishEnding() {
    GAME.state = 'playing';
    document.getElementById('lbx-t').style.height = '0';
    document.getElementById('lbx-b').style.height = '0';
    var secs = M.round(STATE.data.playSec + (performance.now() - GAME.startTime) / 1000);
    document.getElementById('stat-time').textContent = M.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2);
    document.getElementById('stat-season').textContent = GAME.season.charAt(0).toUpperCase() + GAME.season.slice(1);
    completeEl.classList.add('on');
  }
  document.getElementById('btn-restart').onclick = function () {
    completeEl.classList.remove('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toastMsg('The journey begins again');
  };

  /* share */
  document.getElementById('btn-share').onclick = function () {
    var url = location.origin + location.pathname;
    function ok() { toastMsg('LINK COPIED — SHARE THE TRAIL'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); }
      catch (e) { toastMsg('COPY FAILED — ' + url); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fallback);
    } else { fallback(); }
  };

  function showHud() {
    timeBtn.textContent = TIME_LBL[W.timeName()] || 'TIME: AUTO';
    questEl.style.display = 'block';
    if (mmCanvas) mmCanvas.style.display = 'block';
    hudChip.style.display = 'block';
    seasonsBar.style.display = 'flex';
    soundBtn.style.display = 'block';
    document.getElementById('btn-time').style.display = 'block';
    document.getElementById('btn-walk').style.display = 'block';
    document.getElementById('btn-share').style.display = 'block';
    navrail.style.display = 'flex';
    viewbtns.style.display = 'flex';
  }
  document.getElementById('btn-explore').onclick = function () {
    completeEl.classList.remove('on');
  };

  /* ---------- toasts ---------- */
  var toastEl = document.getElementById('toast');
  var toastQ = [], toastBusy = false;
  function toastMsg(txt) {
    toastQ.push(txt);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    if (!toastQ.length) { toastBusy = false; return; }
    toastBusy = true;
    toastEl.textContent = toastQ.shift();
    toastEl.classList.add('on');
    setTimeout(function () {
      toastEl.classList.remove('on');
      setTimeout(nextToast, 350);
    }, 2100);
  }

  function discover(st) {
    if (GAME.discovered.indexOf(st.id) >= 0) return;
    GAME.discovered.push(st.id);
    STATE.visitStop(st.id);
    try { window.PLACES && PLACES.updateWaystation(STATE, DATA); } catch (e) {}
    refreshQuest(true);
    if (STATE.unlock('first-step')) { toastMsg('ACHIEVEMENT: FIRST STEP'); dingSound(620); }
    document.querySelector('#hud-chip .found').textContent = GAME.discovered.length + ' / 6 stops';
    st.navBtn.classList.add('on');
    stopDots[STATIONS.indexOf(st)].classList.add('on');
    if (GAME.discovered.length === 6) {
      STATE.unlock('explorer');
      STATE.unlock('full-tour');
      STATE.setComplete();
      refreshQuest(true);
      startEnding();
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
  var FRIEND_BASE = ['Hey! Welcome to my little world.', 'Walk to the end of the trail, it is worth it.', 'The fox is friendly, I promise.'];
  var FRIEND_STORY = {
    home: "Let's explore this place together.",
    about: "This is where Chandra tells his story.",
    skills: "Careful - skills grow thick around here.",
    projects: "These are some of Chandra's projects.",
    education: "The university grounds. He studies here.",
    contact: "This is where the trail ends. Talk soon!"
  };
  var NPC_TALK = {
    friend: FRIEND_BASE.slice(),
    angler: ['Shh, the fish are resting.', 'I once caught one this big. True story.', 'Monsoon makes the fish hide.'],
    walker: ['Nice weather for a walk today.', 'The lake view is better up ahead.', 'Have you met the horse yet?'],
    walker2: ['Almost at the projects board!', 'Night time here is magical. Try it.', 'Snow is my favorite season here.']
  };
  var talkers = [], STATION_ZS = null;
  function registerTalker(rig, key) { var t = { rig: rig, key: key, el: null, line: 0, t: 0 }; talkers.push(t); return t; }
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
        if (T.key === 'friend') {
          var story = null;
          if (!STATION_ZS) {
            STATION_ZS = STATIONS.map(function (s2) { return { z: W.trailPos(s2.p).z, id: s2.id }; });
          }
          for (var sI = 0; sI < STATION_ZS.length; sI++) {
            if (M.abs(player.pos.z - STATION_ZS[sI].z) < 7) { story = FRIEND_STORY[STATION_ZS[sI].id]; break; }
          }
          lines = story ? [story].concat(FRIEND_BASE) : FRIEND_BASE;
        }
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

  /* ---------- footprints (pooled, weather-aware) ---------- */
  var FP_POOL = [], FP_MAX = 26;
  (function () {
    var geo = new THREE.CircleGeometry(0.085, 8);
    for (var i = 0; i < FP_MAX; i++) {
      var mat = new THREE.MeshBasicMaterial({ color: 0x2b2318, transparent: true, opacity: 0, depthWrite: false });
      var fp = new THREE.Mesh(geo, mat);
      fp.renderOrder = 2;
      fp.visible = false;
      scene.add(fp);
      FP_POOL.push({ mesh: fp, t: 0, life: 0 });
    }
  })();
  var fpFlip = 1;
  function spawnFootprint(x, z, yaw) {
    var fx2 = M.sin(yaw), fz2 = M.cos(yaw);
    fpFlip = -fpFlip;
    var ox = -fz2 * 0.11 * fpFlip, oz = fx2 * 0.11 * fpFlip;
    var px3 = x + ox - fx2 * 0.05, pz3 = z + oz - fz2 * 0.05;
    var slot = null, oldest = 1e9;
    for (var i = 0; i < FP_POOL.length; i++) {
      var s4 = FP_POOL[i];
      if (!s4.mesh.visible) { slot = s4; break; }
      if (s4.t / s4.life < oldest) { oldest = s4.t / s4.life; slot = s4; }
    }
    var se = W.SEASONS[W.season()];
    slot.life = se && se.snow > 0 ? 22 : (se && se.rain > 0 ? 4 : 9);
    slot.t = 0;
    slot.mesh.visible = true;
    slot.mesh.position.set(px3, W.terrainHeight(px3, pz3) + 0.012, pz3);
    slot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), terrainNormal(px3, pz3));
    slot.mesh.rotation.z = yaw;
    slot.base = se && se.snow > 0 ? 0.5 : 0.34;
    slot.mesh.material.opacity = slot.base;
  }
  function tickFootprints(dt) {
    for (var i = 0; i < FP_POOL.length; i++) {
      var s4 = FP_POOL[i];
      if (!s4.mesh.visible) continue;
      s4.t += dt;
      if (s4.t > s4.life) { s4.mesh.visible = false; continue; }
      s4.mesh.material.opacity = (s4.base || 0.34) * (1 - s4.t / s4.life);
    }
  }

  /* ---------- journey & achievements panel ---------- */
  var journeyEl = document.getElementById('journey');
  function openJourney() {
    var stops = STATE.stopCount(), orbs2 = STATE.orbCount(), ach = STATE.data.ach.length;
    var total = DATA.ACHIEVEMENTS.length;
    document.getElementById('j-loc').textContent = stops + ' / 6';
    document.getElementById('j-orbs').textContent = orbs2 + ' / 10';
    document.getElementById('j-ach').textContent = ach + ' / ' + total;
    var pct = M.round((stops / 6 * 0.5 + orbs2 / 10 * 0.3 + ach / total * 0.2) * 100);
    document.getElementById('j-fill').style.width = pct + '%';
    document.getElementById('j-title').textContent = 'Journey — ' + pct + '%';
    var list = document.getElementById('j-achlist');
    list.innerHTML = '';
    DATA.ACHIEVEMENTS.forEach(function (a) {
      var got = STATE.isUnlocked(a.id);
      var row = document.createElement('div');
      row.className = 'jach' + (got ? ' got' : '');
      row.innerHTML = '<b>' + (got ? a.name : '?????') + '</b><span>' + (got ? a.desc : 'locked') + '</span>';
      list.appendChild(row);
    });
    journeyEl.classList.add('on');
    if (GAME.state === 'paused') { menuEl.classList.remove('on'); GAME.state = 'playing'; }
  }
  document.getElementById('btn-journey').onclick = openJourney;
  document.getElementById('btn-jclose').onclick = function () { journeyEl.classList.remove('on'); };
  hudChip.onclick = openJourney;
  hudChip.style.cursor = 'pointer';
  hudChip.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openJourney(); } });

  /* ---------- game modes: guided tour, photo, cinematic ---------- */
  var HUD_ELS = null;
  function setHudVisible(on) {
    if (!HUD_ELS) {
      HUD_ELS = [hudChip, seasonsBar, soundBtn, timeBtn, walkBtn,
        document.getElementById('btn-share'), navrail, viewbtns, questEl, mmCanvas, promptBtn];
    }
    HUD_ELS.forEach(function (el) { if (el && el.style.display !== (on ? '' : 'none')) el.style.display = on ? '' : 'none'; });
  }
  var tour = { on: false, i: 0, hold: 0 };
  var photo = { on: false, yaw: 0.6, pitch: 0.32, dist: 5.2, drag: false, lx: 0, ly: 0 };
  var snapPending = false;
  var flashEl = null;
  function takePhoto() {
    if (!photo.on) return;
    snapPending = true;
  }
  var cinema = { on: false, yaw: 0.5 };
  function letterbox(on) {
    document.getElementById('lbx-t').style.height = on ? '11vh' : '0';
    document.getElementById('lbx-b').style.height = on ? '11vh' : '0';
  }
  function enterTour() {
    exitModes();
    if (GAME.state === 'paused') GAME.state = 'playing';
    tour.on = true;
    tour.i = 0; tour.hold = 0;
    walkMode = false;
    setHudVisible(false);
    letterbox(true);
    menuEl.classList.remove('on');
    hint.style.display = 'block';
    hint.textContent = '[ GUIDED TOUR — PRESS ESC TO LEAVE ]';
    toastMsg('Guided tour — sit back and enjoy');
  }
  function enterPhoto() {
    exitModes();
    if (GAME.state === 'paused') GAME.state = 'playing';
    photo.on = true;
    photo.yaw = player.yaw + PI; photo.pitch = 0.3; photo.dist = 5.2;
    setHudVisible(false);
    menuEl.classList.remove('on');
    hint.style.display = 'block';
    hint.textContent = '[ PHOTO MODE — DRAG TO FRAME · SCROLL TO ZOOM · F TO SNAP · P TO EXIT ]';
    var sb = document.getElementById('snapbtn');
    if (sb && isTouch()) sb.style.display = 'flex';
  }
  function enterCinema() {
    exitModes();
    if (GAME.state === 'paused') GAME.state = 'playing';
    cinema.on = true;
    cinema.yaw = player.yaw + PI;
    setHudVisible(false);
    letterbox(true);
    menuEl.classList.remove('on');
    hint.style.display = 'block';
    hint.textContent = '[ CINEMATIC — PRESS C TO EXIT ]';
  }
  function exitModes() {
    tour.on = false; photo.on = false; cinema.on = false;
    var sb2 = document.getElementById('snapbtn');
    if (sb2) sb2.style.display = 'none';
    setHudVisible(true);
    letterbox(false);
    showHud();
    hint.style.display = 'none';
  }
  document.getElementById('btn-tour').onclick = function () { enterTour(); };
  document.getElementById('btn-photo').onclick = function () { enterPhoto(); };
  document.getElementById('btn-cinema').onclick = function () { enterCinema(); };
  /* recruiter fast path: quick jump buttons in the pause menu */
  (function () {
    var jumplist = document.getElementById('menu-jump');
    STATIONS.forEach(function (st, i) {
      var b = document.createElement('button');
      b.className = 'jmp';
      b.textContent = st.label;
      b.onclick = function () { togglePause(); gotoStation(i); };
      jumplist.appendChild(b);
    });
  })();
  /* photo controls: drag to frame, wheel to zoom */
  canvas.addEventListener('pointerdown', function (ev) {
    if (!photo.on) return;
    photo.drag = true; photo.lx = ev.clientX; photo.ly = ev.clientY;
  });
  window.addEventListener('pointermove', function (ev) {
    if (!photo.on || !photo.drag) return;
    photo.yaw -= (ev.clientX - photo.lx) * 0.008;
    photo.pitch = clamp(photo.pitch + (ev.clientY - photo.ly) * 0.005, -0.1, 1.2);
    photo.lx = ev.clientX; photo.ly = ev.clientY;
  });
  window.addEventListener('pointerup', function () { photo.drag = false; });
  window.addEventListener('wheel', function (ev) {
    if (photo.on) photo.dist = clamp(photo.dist + (ev.deltaY > 0 ? 0.5 : -0.5), 1.8, 14);
  }, { passive: true });

  /* ---------- quest / objective system ---------- */
  var questEl = document.getElementById('quest');
  var questTextEl = document.getElementById('quest-text');
  function questIsDone(q) {
    if (q.stop) return STATE.data.stops.indexOf(q.stop) >= 0;
    if (q.needOrbs) return STATE.orbCount() >= q.needOrbs;
    if (q.final) return STATE.data.complete;
    return false;
  }
  function refreshQuest(showToast) {
    var next = null;
    for (var i = 0; i < DATA.QUESTS.length; i++) {
      var q = DATA.QUESTS[i];
      if (questIsDone(q)) {
        if (STATE.finishQuest(q.id) && showToast) {
          toastMsg('OBJECTIVE COMPLETE');
          dingSound(700);
        }
      } else if (!next) { next = q; }
    }
    if (next) questTextEl.textContent = next.text;
    else {
      questTextEl.textContent = 'Journey complete — thanks for walking with me';
      questEl.classList.add('done');
    }
  }

  /* ---------- minimap ---------- */
  var mmCanvas = document.getElementById('minimap');
  var mmX = mmCanvas ? mmCanvas.getContext('2d') : null;
  var MM = { minx: -18, maxx: 24, minz: -48, maxz: 44 };
  function mmMX(x) { return (x - MM.minx) / (MM.maxx - MM.minx) * mmCanvas.width; }
  function mmMZ(z) { return (MM.maxz - z) / (MM.maxz - MM.minz) * mmCanvas.height; }
  function drawMinimap() {
    if (!mmX) return;
    var W2 = mmCanvas.width, H2 = mmCanvas.height;
    mmX.clearRect(0, 0, W2, H2);
    // lake
    mmX.fillStyle = 'rgba(63,127,158,.5)';
    mmX.beginPath();
    mmX.ellipse(mmMX(7.5), mmMZ(2), 9 / (MM.maxx - MM.minx) * W2, 9 / (MM.maxz - MM.minz) * H2, 0, 0, PI * 2);
    mmX.fill();
    // waterfall + bridge marks
    mmX.fillStyle = 'rgba(220,240,248,.8)';
    mmX.fillRect(mmMX(12.5) - 1.5, mmMZ(2) - 1.5, 3, 3);
    mmX.fillStyle = 'rgba(180,140,90,.7)';
    mmX.fillRect(mmMX(1.8), mmMZ(2) - 1, mmMX(12.7) - mmMX(1.8), 2);
    // trail
    mmX.strokeStyle = 'rgba(201,180,138,.45)';
    mmX.lineWidth = 2;
    mmX.beginPath();
    mmX.moveTo(mmMX(0), mmMZ(38));
    mmX.lineTo(mmMX(0), mmMZ(-33));
    mmX.stroke();
    // stations
    for (var i = 0; i < STATIONS.length; i++) {
      var st = STATIONS[i];
      var sx = mmMX(0), sz = mmMZ(W.trailPos(st.p).z);
      var found = GAME.discovered.indexOf(st.id) >= 0;
      mmX.save();
      mmX.translate(sx, sz);
      mmX.rotate(PI / 4);
      mmX.fillStyle = found ? '#6fd08a' : 'rgba(255,255,255,.35)';
      mmX.fillRect(-2.6, -2.6, 5.2, 5.2);
      mmX.restore();
    }
    // player
    var px = mmMX(player.pos.x), pz = mmMZ(player.pos.z);
    var ang = M.atan2(-M.cos(player.yaw), M.sin(player.yaw));
    mmX.save();
    mmX.translate(px, pz);
    mmX.rotate(ang);
    mmX.fillStyle = '#e8b04b';
    mmX.beginPath();
    mmX.moveTo(5, 0);
    mmX.lineTo(-3.4, 3);
    mmX.lineTo(-3.4, -3);
    mmX.closePath();
    mmX.fill();
    mmX.restore();
    // frame
    mmX.strokeStyle = 'rgba(255,255,255,.14)';
    mmX.lineWidth = 1;
    mmX.strokeRect(0.5, 0.5, W2 - 1, H2 - 1);
  }

  var DOSSIER_ARCH = {
    'survival-school': [
      ['NEXT.JS UI', 'exams · badges · chat'],
      ['FASTAPI', 'server-authoritative scoring'],
      ['POSTGRES + REDIS', 'data · sessions · queues']
    ],
    'signal-lite': [
      ['NEXT.JS UI', 'conversations · e2e ui'],
      ['FASTAPI', 'OTP · rotating tokens · websockets'],
      ['REDIS + POSTGRES', 'pub/sub fan-out · storage']
    ],
    'saiu-v2': [
      ['PWA + SERVICE WORKER', 'offline-first cache'],
      ['GOOGLE SHEETS', 'live timetable source'],
      ['PLANNER + ICS', 'conflict engine · calendar export']
    ],
    'next': [['PLOT RESERVED', 'the next build starts here']]
  };
  function openProject(id) {
    var P = null;
    for (var i = 0; i < DATA.PORTFOLIO.projects.length; i++) if (DATA.PORTFOLIO.projects[i].id === id) P = DATA.PORTFOLIO.projects[i];
    if (!P) return;
    STATE.openProject(id);
    var d = document.getElementById('dossier');
    document.getElementById('d-no').textContent = P.no;
    document.getElementById('d-name').textContent = P.name;
    document.getElementById('d-tag').textContent = P.tag;
    document.getElementById('d-desc').textContent = P.built;
    var arch = document.getElementById('d-arch');
    arch.innerHTML = '';
    (DOSSIER_ARCH[id] || []).forEach(function (n2, ai) {
      if (ai > 0) { var pipe = document.createElement('div'); pipe.className = 'd-pipe'; pipe.innerHTML = '<i></i>'; arch.appendChild(pipe); }
      var nd = document.createElement('div'); nd.className = 'd-node';
      nd.innerHTML = '<b>' + n2[0] + '</b><span>' + n2[1] + '</span>';
      arch.appendChild(nd);
    });
    var chips = document.getElementById('d-chips');
    chips.innerHTML = '';
    P.tech.forEach(function (t) { var s = document.createElement('span'); s.className = 'chip'; s.textContent = t; chips.appendChild(s); });
    var links = document.getElementById('d-links');
    links.innerHTML = '';
    if (P.live) { var a = document.createElement('a'); a.href = P.live; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'LIVE SITE'; links.appendChild(a); }
    if (P.code) { var g = document.createElement('a'); g.href = P.code; g.target = '_blank'; g.rel = 'noopener'; g.textContent = 'GITHUB'; links.appendChild(g); }
    if (!P.live && !P.code) { var x = document.createElement('span'); x.className = 'd-none'; x.textContent = 'COMING WHEN IT EXISTS'; links.appendChild(x); }
    document.querySelectorAll('.card.open').forEach(function (cc) { cc.classList.remove('open'); });
    document.body.classList.remove('card-open');
    d.classList.add('on');
    document.body.classList.add('card-open');
    dingSound(620);
    if (STATE.data.projectsOpen.length >= DATA.PORTFOLIO.projects.length && STATE.unlock('project-explorer')) {
      toastMsg('ACHIEVEMENT: PROJECT EXPLORER'); dingSound(880);
    }
  }
  (function () {
    document.getElementById('dossier-x').onclick = function () {
      document.getElementById('dossier').classList.remove('on');
      document.body.classList.remove('card-open');
    };
  })();

  /* ---------- interaction system ---------- */
  var promptBtn = document.getElementById('prompt');
  var promptTxt = document.getElementById('prompt-txt');
  var promptKey = document.getElementById('prompt-key');
  var interactItems = [];
  function addInteract(cfg) { interactItems.push(cfg); }
  var currentInteract = null;
  function isTouch() { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }
  function tickInteract() {
    currentInteract = null;
    if (GAME.state !== 'playing') { promptBtn.style.display = 'none'; return; }
    var best = 1e9;
    for (var i = 0; i < interactItems.length; i++) {
      var it = interactItems[i];
      if (it.enabled && !it.enabled()) continue;
      var p = typeof it.pos === 'function' ? it.pos() : it.pos;
      var d = player.pos.distanceTo(p);
      if (d < (it.radius || 3) && d < best) { best = d; currentInteract = it; }
    }
    if (currentInteract) {
      promptTxt.textContent = currentInteract.label;
      promptKey.style.display = isTouch() ? 'none' : 'inline-block';
      promptBtn.style.display = 'flex';
    } else promptBtn.style.display = 'none';
  }
  /* interaction camera: briefly lean toward the target */
  var focusT = 0, focusPos = new THREE.Vector3(), focusLook = new THREE.Vector3();
  function focusOn(target) {
    focusT = 2.6;
    focusLook.copy(target);
    focusPos.copy(camera.position).lerp(target, 0.42);
    focusPos.y = M.min(focusPos.y + 0.4, M.max(focusPos.y, target.y + 1.1));
  }
  function doInteract() {
    if (!currentInteract || GAME.state !== 'playing') return;
    var it = currentInteract;
    var p = typeof it.pos === 'function' ? it.pos() : it.pos;
    if (it.focus !== false) focusOn(p);
    it.action();
  }
  promptBtn.onclick = doInteract;
  (function () {
    var sb3 = document.getElementById('snapbtn');
    if (sb3) sb3.onclick = takePhoto;
  })();
  window.addEventListener('keydown', function (ev) {
    if (ev.key.toLowerCase() === 'e' && GAME.state === 'playing') doInteract();
  });

  /* ---------- loop ---------- */
  var camPos = new THREE.Vector3(0, 3.4, 44), camLook = new THREE.Vector3(0, 1.2, 38);
  var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  var last = performance.now(), tSec = 0, walkPhase = 0;
  var umbrella = W.umbrella();

  var hearts = [];
  var heartTex = (function () {
    var hc = document.createElement('canvas'); hc.width = hc.height = 64;
    var hx = hc.getContext('2d');
    hx.fillStyle = '#ff5f8a';
    hx.beginPath();
    hx.moveTo(32, 56);
    hx.bezierCurveTo(2, 34, 8, 6, 32, 20);
    hx.bezierCurveTo(56, 6, 62, 34, 32, 56);
    hx.fill();
    return new THREE.CanvasTexture(hc);
  })();
  function spawnHearts(pos) {
    for (var i = 0; i < 5; i++) {
      var hm = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
        new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      hm.position.set(pos.x + (M.random() - 0.5) * 0.5, pos.y + 1 + M.random() * 0.4, pos.z + (M.random() - 0.5) * 0.5);
      hm.userData = { t: 0, vy: 0.7 + M.random() * 0.4, vx: (M.random() - 0.5) * 0.3 };
      scene.add(hm);
      hearts.push(hm);
    }
  }
  var petted = { fox: false, horse: false };
  function petAnimal(name) {
    var rig = name === 'fox' ? foxRig : horseRig;
    if (!rig) return;
    spawnHearts(rig.obj.position);
    petted[name] = true;
    var prev = rig._petDone;
    rig._petDone = true;
    toastMsg(prev ? ('The ' + name + ' loves you') : ('You petted the ' + name + '!'));
    dingSound(660);
    if (petted.fox && petted.horse && STATE.unlock('animal-friend')) {
      setTimeout(function () { toastMsg('ACHIEVEMENT: ANIMAL FRIEND'); dingSound(880); }, 2400);
    }
  }
  function dingSound(freq) {
    try {
      W.AudioSys.ding(freq);
    } catch (e) {}
  }

  /* ---------- collectible orbs ---------- */
  var orbs = [], orbCount = STATE.orbCount();
  var ORB_SPOTS = [
    [0.5, 35.5], [-1.5, 28], [1.2, 24], [-0.8, 17], [0.9, 10.5], [-1.2, 4],
    [0.7, -3], [-1, -11], [0.8, -18], [-0.6, -26]
  ];
  function buildOrbs() {
    var geo = new THREE.IcosahedronGeometry(0.17, 1);
    var mat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xe8b04b, emissiveIntensity: 1.5, roughness: 0.3 });
    ORB_SPOTS.forEach(function (sp, i) {
      var o = new THREE.Mesh(geo, mat);
      o.position.set(sp[0], W.terrainHeight(sp[0], sp[1]) + 0.55, sp[1]);
      o.userData.base = o.position.y;
      if (STATE.hasOrb(i)) { o.visible = false; o.userData.got = true; }
      scene.add(o);
      orbs.push(o);
    });
    orbLineEl.textContent = 'ORBS ' + orbCount + '/10';
  }
  var orbLineEl = document.getElementById('orbline');
  function tickOrbs(dt, t) {
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      if (!o.visible) { continue; }
      o.rotation.y += dt * 2.2;
      o.position.y = o.userData.base + M.sin(t * 2.4 + i) * 0.1;
      var s2 = 1 + M.sin(t * 3 + i * 1.7) * 0.12;
      o.scale.setScalar(s2);
      if (M.abs(player.pos.x - o.position.x) < 1.3 && M.abs(player.pos.z - o.position.z) < 1.3) {
        o.visible = false; o.userData.got = true;
        STATE.grabOrb(i);
        orbCount = STATE.orbCount();
        orbLineEl.textContent = 'ORBS ' + orbCount + '/10';
        toastMsg('ORB ' + orbCount + '/10');
        dingSound(520 + orbCount * 40);
        if (orbCount === 10 && STATE.unlock('collector')) {
          setTimeout(function () { toastMsg('ACHIEVEMENT: COLLECTOR'); dingSound(990); }, 2400);
        }
        refreshQuest(true);
        continue;
      }
    }
  }

  var fpsEma = 60, lowFpsT = 0, autoQualityDone = false;
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = M.min(0.05, (now - last) / 1000);
    last = now;
    tSec += dt;
    GAME.cam = camera;
    GAME.frames++;
    /* performance watchdog: step down to Fast once if the device can't hold ~30fps */
    if (GAME.state === 'playing' && !autoQualityDone && tSec > 12) {
      var inst = dt > 0 ? 1 / dt : 60;
      fpsEma += (inst - fpsEma) * 0.05;
      if (fpsEma < 27) lowFpsT += dt; else lowFpsT = M.max(0, lowFpsT - dt * 0.5);
      if (lowFpsT > 6 && W.QUALITY.level === 'high') {
        autoQualityDone = true;
        applyQuality('fast');
        try { localStorage.setItem('csq', 'fast'); } catch (e) {}
        document.querySelectorAll('#opt-quality .opt').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-q') === 'fast'); });
        toastMsg('PERFORMANCE MODE ENABLED');
      }
    }
    GAME._ptAcc = (GAME._ptAcc || 0) + dt;
    if (GAME._ptAcc >= 5) { STATE.addPlayTime(GAME._ptAcc); GAME._ptAcc = 0; }

    if (GAME.state === 'intro') {
      introAdvance(dt);
      renderer.render(scene, camera);
      return;
    }
    if (GAME.state === 'paused') {
      renderer.render(scene, camera);
      return;
    }
    if (GAME.state === 'ending') {
      endT += dt;
      var ek = M.min(1, endT / 8);
      var ee = ek * ek * (3 - 2 * ek);
      tmpV.set(
        endFrom.x + (6.5 - endFrom.x) * ee,
        endFrom.y + (9.2 - endFrom.y) * ee,
        endFrom.z + (-33.5 - endFrom.z) * ee
      );
      camera.position.copy(tmpV);
      tmpV2.set(
        endFromLook.x + (0 - endFromLook.x) * ee,
        endFromLook.y + (2.2 - endFromLook.y) * ee,
        endFromLook.z + (-14 - endFromLook.z) * ee
      );
      camLook.copy(tmpV2);
      camera.lookAt(camLook);
      if (modelReady) { playerRig.mixer.update(dt); headTurn(playerRig, 0); }
      W.tickSeason(dt, tSec);
      renderer.render(scene, camera);
      if (endT >= 8) finishEnding();
      return;
    }

    var om = 5.2, hSpeed;
    if (walkMode) {
      smoothV = 0;
      var mx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0) + joyVec.x;
      var mz = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0) + joyVec.y;
      var mlen = M.sqrt(mx * mx + mz * mz);
      if (mlen > 1) { mx /= mlen; mz /= mlen; mlen = 1; }
      var spd = 2.1 + 2.5 * (keys['shift'] || mlen > 0.92 ? 1 : 0);
      /* physics: velocity integrates toward target speed (accel slower than decel),
         momentum carries the last direction while stopping */
      var targetSpeed = mlen > 0.06 ? mlen * spd : 0;
      var accelK = targetSpeed > player.hSpeed ? 7.5 : 11;
      player.hSpeed += (targetSpeed - player.hSpeed) * (1 - M.exp(-accelK * dt));
      if (player.hSpeed < 0.006) player.hSpeed = 0;
      if (mlen > 0.06) { player.lastMx = mx / mlen; player.lastMz = mz / mlen; }
      hSpeed = player.hSpeed;
      if (player.hSpeed > 0.001) {
        var dm = player.hSpeed * dt;
        var nx = player.pos.x + (player.lastMx || 0) * dm;
        var nz = player.pos.z + (player.lastMz || 0) * dm;
        nx = clamp(nx, -13, 13); nz = clamp(nz, -43, 45);
        var BR = W.bridge;
        var onBridge = M.abs(nz - BR.z) < BR.half && nx > BR.x0 && nx < BR.x1;
        function inWater(x, z) {
          if (M.abs(z - BR.z) < BR.half + 0.4 && x > BR.x0 - 0.4 && x < BR.x1 + 0.4) return false;
          var ddx = x - 7.5, ddz = z - 2;
          if (ddx * ddx + ddz * ddz < 5.4 * 5.4) return true;
          return x > 6.3 && x < 8.7 && z < -3.6 && z > -34; /* the river outlet */
        }
        if (!inWater(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
        else if (!inWater(nx, player.pos.z)) { player.pos.x = nx; }
        else if (!inWater(player.pos.x, nz)) { player.pos.z = nz; }
        if (mlen > 0.06)
          player.yaw = angLerp(player.yaw, M.atan2(-mx, -mz) - MODEL_FWD, M.min(1, dt * (7 + 5 * (1 - M.min(1, player.hSpeed / 3)))));
        var nowBridge = M.abs(player.pos.z - BR.z) < BR.half && player.pos.x > BR.x0 && player.pos.x < BR.x1;
        if (nowBridge) player.pos.y = M.max(W.terrainHeight(player.pos.x, player.pos.z), W.deckY(player.pos.x)) + 0.1;
      }
      var vdeck = (window.PLACES && PLACES.deckAt) ? PLACES.deckAt(player.pos.x, player.pos.z) : null;
      if (vdeck !== null) player.pos.y = vdeck + 0.12;
      if (!(M.abs(player.pos.z - W.bridge.z) < W.bridge.half && player.pos.x > W.bridge.x0 && player.pos.x < W.bridge.x1))
        player.pos.y = W.terrainHeight(player.pos.x, player.pos.z) + 0.04;
      smoothP = clamp((W.TRAIL_Z0 - player.pos.z) / W.TRAIL_LEN, 0, 1);
      GAME.p = smoothP;
    } else {
      if (tour.on) {
        var tst = STATIONS[M.min(tour.i, STATIONS.length - 1)];
        var dtp = tst.p - smoothP;
        targetP = smoothP + clamp(dtp, -dt * 0.085, dt * 0.085);
        if (M.abs(dtp) < 0.004) {
          tour.hold += dt;
          if (tour.hold > 5.5) {
            tour.hold = 0;
            tour.i++;
            if (tour.i >= STATIONS.length) { exitModes(); toastMsg('Tour complete'); }
          }
        }
      }
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
    if (!GAME.animWeights) GAME.animWeights = { idle: 0, walk: 0, run: 0 };
    GAME.animWeights.idle = +(idleW / tot).toFixed(2);
    GAME.animWeights.walk = +(walkW / tot).toFixed(2);
    GAME.animWeights.run = +(runW / tot).toFixed(2);

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
      var stepIdx = M.floor(walkPhase / PI);
      if (stepIdx !== (GAME._step || 0)) {
        GAME._step = stepIdx;
        if (mvBlend > 0.4 && GAME.state === 'playing') {
          var onWood = M.abs(player.pos.z - W.bridge.z) < W.bridge.half && player.pos.x > W.bridge.x0 && player.pos.x < W.bridge.x1;
          W.AudioSys.stepSnd(0.045 + 0.05 * (runW / tot), onWood);
          if (!onWood) spawnFootprint(player.pos.x, player.pos.z, player.yaw);
        }
      }
      var nearSt = null;
      for (var ns = 0; ns < STATIONS.length; ns++) {
        if (M.abs(smoothP - STATIONS[ns].p) < 0.035) { nearSt = STATIONS[ns]; break; }
      }
      var headTarget = 0;
      if (nearSt && idleW > 0.55) {
        tmpV.copy(nearSt.boardMid);
        var local = playerRig.obj.worldToLocal(tmpV);
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
      if (openId && !walkMode && !(GAME._cardHold && performance.now() - GAME._cardHold < 2500)) {
        var cur = document.querySelector('.card.open');
        if (!cur || cur.id !== 'card-' + openId) openCard(openId);
      } else if (!openId) {
        var cur2 = document.querySelector('.card.open');
        if (cur2) { cur2.classList.remove('open'); document.body.classList.remove('card-open'); }
      }
      var pct = clamp(smoothP, 0, 1) * 100;
      trailFill.style.width = pct + '%';
      trailMarker.style.left = pct + '%';
    }

    if (friendRig) {
      friendRig.mixer.update(dt);
      /* companion: follows the player everywhere */
      var fwdX = M.sin(player.yaw), fwdZ = M.cos(player.yaw);
      var tgx, tgz;
      if (walkMode) {
        tgx = player.pos.x - fwdX * 1.75 + fwdZ * 0.85;
        tgz = player.pos.z - fwdZ * 1.75 - fwdX * 0.85;
      } else {
        var fp = W.trailPos(clamp(smoothP - 0.032, 0, 1));
        tgx = fp.x - 1.15; tgz = fp.z;
      }
      tgx = clamp(tgx, -12.5, 16.5); tgz = clamp(tgz, -42, 44);
      // keep the friend out of the lake (unless the player is on the bridge)
      var fdx = tgx - 7.5, fdz = tgz - 2, fdl = M.sqrt(fdx * fdx + fdz * fdz);
      var onBridgeF = M.abs(player.pos.z - W.bridge.z) < W.bridge.half && player.pos.x > W.bridge.x0 && player.pos.x < W.bridge.x1;
      if (fdl < 6.4 && !onBridgeF && fdl > 0.01) { tgx = 7.5 + fdx / fdl * 6.4; tgz = 2 + fdz / fdl * 6.4; }
      var fpx = friendRig.obj.position;
      var dx3 = tgx - fpx.x, dz3 = tgz - fpx.z;
      var dDist = M.sqrt(dx3 * dx3 + dz3 * dz3);
      var fSpd = 0;
      if (dDist > 0.4) {
        fSpd = M.min(dDist > 4.5 ? 3.6 : 2.4, dDist / M.max(dt, 0.001));
        fpx.x += dx3 / dDist * fSpd * dt;
        fpx.z += dz3 / dDist * fSpd * dt;
        friendRig.obj.rotation.y = M.atan2(dx3, dz3) + MODEL_FWD;
      } else if (dDist < 0.4) {
        friendRig.obj.rotation.y = angLerp(friendRig.obj.rotation.y, M.atan2(player.pos.x - fpx.x, player.pos.z - fpx.z) + MODEL_FWD, M.min(1, dt * 5));
      }
      var onBridgeF2 = M.abs(fpx.z - W.bridge.z) < W.bridge.half && fpx.x > W.bridge.x0 && fpx.x < W.bridge.x1;
      fpx.y = (onBridgeF2 ? M.max(W.terrainHeight(fpx.x, fpx.z), W.deckY(fpx.x)) : W.terrainHeight(fpx.x, fpx.z)) + 0.04;
      var fIdle = fSpd < 0.2 ? 1 : 0;
      var fRun = fSpd > 3.0 ? 1 : 0;
      var fWalk = fSpd > 0.2 ? 1 : 0;
      friendRig.actions.idle.setEffectiveWeight(fIdle);
      friendRig.actions.walk.setEffectiveWeight(fWalk * (1 - fRun));
      friendRig.actions.run.setEffectiveWeight(fRun);
      friendRig.phase = (friendRig.phase || 0) + dt * clamp(fSpd, 0, 3.2) * 5.2;
      armSwing(friendRig, friendRig.phase, 0.45 * clamp(fSpd / 1.2, 0, 1));
      var near = player.pos.distanceTo(fpx) < 12;
      if (near) {
        tmpV.copy(player.pos);
        var lp = friendRig.obj.worldToLocal(tmpV);
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
      if (anglerRig.bobber) anglerRig.bobber.position.y = anglerRig.bobber.userData.y0 + M.sin(tSec * 1.8) * 0.045;
    }
    for (var cn = 0; cn < campusNpcs.length; cn++) {
      var CN = campusNpcs[cn];
      CN.rig.mixer.update(dt);
      var dist = M.sqrt((CN.b.x - CN.a.x) * (CN.b.x - CN.a.x) + (CN.b.z - CN.a.z) * (CN.b.z - CN.a.z)) || 1;
      if (CN.wait > 0) {
        CN.wait -= dt;
        var acts = CN.rig.actions || {};
        for (var k5 in acts) acts[k5].setEffectiveWeight(k5 === 'idle' ? 1 : 0);
        CN.rig.obj.rotation.y += M.sin(tSec * 0.4 + cn) * 0.003;
      } else {
        var acts2 = CN.rig.actions || {};
        for (var k6 in acts2) acts2[k6].setEffectiveWeight(k6 === 'walk' ? 1 : 0);
        CN.t += CN.dir * (CN.speed / dist) * dt;
        if (CN.t >= 1) { CN.t = 1; CN.dir = -1; CN.wait = 2 + M.random() * 4; }
        if (CN.t <= 0) { CN.t = 0; CN.dir = 1; CN.wait = 2 + M.random() * 4; }
        var nx2 = CN.a.x + (CN.b.x - CN.a.x) * CN.t, nz2 = CN.a.z + (CN.b.z - CN.a.z) * CN.t;
        CN.rig.obj.position.set(nx2, W.terrainHeight(nx2, nz2) + 0.04, nz2);
        CN.rig.obj.rotation.y = M.atan2(CN.dir > 0 ? CN.b.x - CN.a.x : CN.a.x - CN.b.x, CN.dir > 0 ? CN.b.z - CN.a.z : CN.a.z - CN.b.z);
        armSwing(CN.rig, tSec * CN.speed * 5.4, 0.5);
      }
    }
    if (foxRig) {
      var fd = player.pos.distanceTo(foxRig.obj.position);
      if (!foxState) foxState = { mode: 'wander', t: 4 };
      var fx = foxRig.obj.position.x, fz = foxRig.obj.position.z;
      function foxPlay(name, ts) {
        var acts = foxRig.actions || {};
        for (var k3 in acts) {
          var want = k3.indexOf(name) >= 0 ? 1 : 0;
          var cur = acts[k3].getEffectiveWeight();
          if (cur < 0.005 && want === 1) acts[k3].play();
          acts[k3].setEffectiveWeight(cur + (want - cur) * M.min(1, dt * 4));
        }
        if (ts && acts[name]) acts[name].setEffectiveTimeScale(ts);
      }
      if (walkMode && fd < 8 && fd > 1.6) {
        var dx2 = player.pos.x - fx, dz2 = player.pos.z - fz;
        var dl = M.sqrt(dx2 * dx2 + dz2 * dz2) || 1;
        fx += (dx2 / dl) * 2.6 * dt; fz += (dz2 / dl) * 2.6 * dt;
        foxRig.obj.rotation.y = M.atan2(dx2, dz2);
        foxPlay('Walk', 1);
        foxState.t = 3 + M.random() * 3;
      } else if (walkMode && fd <= 1.6) {
        foxRig.obj.rotation.y = M.atan2(player.pos.x - fx, player.pos.z - fz) + M.sin(tSec * 0.7) * 0.4;
        foxPlay('Survey', 0.9);
      } else if (foxState.mode === 'wander') {
        foxState.t -= dt;
        foxState.a = (foxState.a || 0) + dt * 0.35;
        if (foxState.t <= 0) { foxState.mode = 'idle'; foxState.t = 2.5 + M.random() * 3.5; }
        fx = 1.5 + M.cos(foxState.a) * 5.5; fz = -16 + M.sin(foxState.a) * 4.5;
        foxRig.obj.rotation.y = M.atan2(-M.sin(foxState.a) * 5.5, 0.0001) - PI / 2;
        foxPlay('Walk', 1);
      } else {
        foxState.t -= dt;
        foxRig.obj.rotation.y += M.sin(tSec * 0.5) * 0.004;
        foxPlay('Survey', 0.8);
        if (foxState.t <= 0) { foxState.mode = 'wander'; foxState.t = 4 + M.random() * 5; }
      }
      foxRig.obj.position.set(fx, W.terrainHeight(fx, fz), fz);
      if (!foxRig.blob) foxRig.blob = addBlob(foxRig.obj, 0.55 / foxRig.obj.scale.x, 0.025 / foxRig.obj.scale.x);
      foxRig.mixer.update(dt);
    }
    tickInteract();
    GAME._mmT = (GAME._mmT || 0) + dt;
    if (GAME._mmT > 0.1) { GAME._mmT = 0; drawMinimap(); }
    tickFootprints(dt);
    try { PLACES.tick(dt, tSec, player, GAME); } catch (e) {}

    /* camera: never sink below the terrain (cheap collision clamp) */
    if (!photo.on && !cinema.on) {
      var camGround = W.terrainHeight(camera.position.x, camera.position.z) + 0.34;
      if (camera.position.y < camGround) {
        camera.position.y = camGround;
        camera.lookAt(camLook);
      }
    }
    /* speed feel: slight FOV kick while running */
    var fovT = 52 + 6 * clamp((player.hSpeed - 2.2) / 2.4, 0, 1);
    if (M.abs(camera.fov - fovT) > 0.05) {
      camera.fov = lerpTo(camera.fov, fovT, dt, 3);
      camera.updateProjectionMatrix();
    }

    for (var hi = hearts.length - 1; hi >= 0; hi--) {
      var hm2 = hearts[hi];
      hm2.userData.t += dt;
      hm2.position.y += hm2.userData.vy * dt;
      hm2.position.x += hm2.userData.vx * dt;
      hm2.rotation.y += dt * 2;
      hm2.material.opacity = M.max(0, 1 - hm2.userData.t / 1.4);
      if (hm2.userData.t > 1.4) {
        scene.remove(hm2);
        hm2.geometry.dispose(); hm2.material.dispose();
        hearts.splice(hi, 1);
      }
    }
    tickOrbs(dt, tSec);
    var nf = W.nightFactor();
    if (nf > 0.5 && STATE.unlock('night-owl')) { toastMsg('ACHIEVEMENT: NIGHT OWL'); dingSound(740); }
    /* spatial audio: waterfall louder near it, monsoon swells it */
    GAME._spT = (GAME._spT || 0) + dt;
    if (GAME._spT > 0.3) {
      GAME._spT = 0;
      var wdx = player.pos.x - 12.5, wdz = player.pos.z - 2;
      var wdist = M.sqrt(wdx * wdx + wdz * wdz);
      var rainBoost = 1 + ((W.SEASONS[W.season()] || {}).rain || 0) / 470 * 1.5;
      W.AudioSys.setWaterfall(clamp(1 - wdist / 30, 0, 1) * 0.4 * rainBoost);
    }
    /* birdsong during the day */
    if (nf < 0.4 && M.random() < dt / 11) W.AudioSys.chirp();
    /* ambient music pad drifts between chords */
    try { W.AudioSys.tickPad(dt); } catch (e) {}
    for (var li = 0; li < lamps.length; li++) {
      lamps[li].light.intensity = 0.55 + nf * 1.05;
      lamps[li].bulb.visible = nf > 0.08;
    }
    tickBubbles(dt);
    tickWildlife(dt, tSec);
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
    if (focusT > 0) {
      focusT -= dt;
      camPos.lerp(focusPos, 1 - M.exp(-dt * 2.6));
      camLook.lerp(focusLook, 1 - M.exp(-dt * 3));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    } else if (walkMode) {
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

    if (photo.on) {
      var pcx = player.pos.x + M.sin(photo.yaw) * M.cos(photo.pitch) * photo.dist;
      var pcz = player.pos.z + M.cos(photo.yaw) * M.cos(photo.pitch) * photo.dist;
      var pcy = player.pos.y + M.sin(photo.pitch) * photo.dist + 0.6;
      camera.position.set(pcx, M.max(pcy, W.terrainHeight(pcx, pcz) + 0.3), pcz);
      camera.lookAt(player.pos.x, player.pos.y + 1.2, player.pos.z);
    } else if (cinema.on) {
      cinema.yaw += dt * 0.10;
      var ccx = player.pos.x + M.sin(cinema.yaw) * 6.2;
      var ccz = player.pos.z + M.cos(cinema.yaw) * 6.2;
      camera.position.set(ccx, player.pos.y + 2.6, ccz);
      camera.lookAt(player.pos.x, player.pos.y + 1.3, player.pos.z);
      camPos.copy(camera.position);
      camLook.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
    }

    var sunLight = W.sun;
    sunLight.position.set(player.pos.x + 18, 30, player.pos.z + 10);
    sunLight.target.position.copy(player.pos);

    renderer.render(scene, camera);
    if (photo.on && snapPending) {
      snapPending = false;
      GAME.photoTaken = (GAME.photoTaken || 0) + 1;
      try {
        if (!flashEl) flashEl = document.getElementById('flash');
        var url = renderer.domElement.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'chandras-world-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        if (flashEl) { flashEl.style.opacity = '0.85'; setTimeout(function () { flashEl.style.opacity = '0'; }, 90); }
        toastMsg('PHOTO SAVED');
      } catch (e) { GAME.errors.push('photo capture: ' + e.message); }
    }
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
    try { PLACES.build({ scene: scene, W: W, addInteract: addInteract, openCard: openCard, openProject: openProject, HQ: W.HQ, DATA: DATA, toast: toastMsg, player: player, playerRig: playerRig, openJourney: openJourney, STATE: STATE, STATIONS: STATIONS, spawnCampusWalker: spawnCampusWalker, PROJECT_ARCH: DOSSIER_ARCH }); } catch (e) { GAME.errors.push('places: ' + e.message); }
    try { PLACES.updateWaystation(STATE, DATA); } catch (e) {}
    buildOrbs();
    markGroup('world', true);
    markGroup('audio', true);
    if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
    // resume saved progress
    GAME.discovered = STATE.data.stops.slice();
    refreshQuest(false);
    if (GAME.discovered.length >= 6) toastMsg('WELCOME BACK, TRAVELER');
    else if (GAME.discovered.length > 0) toastMsg('WELCOME BACK — ' + GAME.discovered.length + ' / 6 STOPS FOUND');
    document.querySelector('#hud-chip .found').textContent = GAME.discovered.length + ' / 6 stops';
    STATIONS.forEach(function (st, i) {
      if (GAME.discovered.indexOf(st.id) >= 0) {
        st.navBtn.classList.add('on');
        stopDots[i].classList.add('on');
      }
    });
    loaderEl.style.opacity = '0';
    setTimeout(function () { loaderEl.style.display = 'none'; }, 750);
    startIntro();
  });
  requestAnimationFrame(tick);
})();
