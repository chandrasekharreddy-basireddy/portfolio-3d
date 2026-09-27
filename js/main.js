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
    walker: 'models/walker.glb',
    fox: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb',
    horse: 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/models/gltf/Horse.glb',
    flamingo: 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/models/gltf/Flamingo.glb',
    friend: 'models/friend.glb',
    angler: 'models/angler.glb',
    clipsIdle: 'models/clips-idle.json',
    clipsWalk: 'models/clips-walk.json',
    clipsRun: 'models/clips-run.json',
    photo: 'assets/profile.jpg',
    face: 'assets/face.b64',
    wolf: 'models/wolf.fbx',
    ironman: 'models/ironman.glb',
    peacock: 'models/peacock.glb',
    toucan: 'models/toucan.glb',
    bird: 'models/bird.glb',
    monkey: 'models/monkey.glb',
    flower: 'models/flower.glb'
  };
  var ASSETS = { walker: null, friend: null, angler: null, fox: null, horse: null, flamingo: null, clips: null, photo: null, face: null, wolf: null, ironman: null, peacock: null, toucan: null, bird: null, monkey: null, flower: null, fallroad: null, birch: null };
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
      } else if (key === 'face') {
        var chunkUrls = [];
        for (var fi = 1; fi <= 9; fi++) chunkUrls.push(url + '.' + fi);
        Promise.all(chunkUrls.map(function (cu) { return fetch(cu).then(function (r) { return r.arrayBuffer(); }); }))
          .then(function (bufs) {
            var total = 0;
            bufs.forEach(function (b) { total += b.byteLength; });
            var bytes = new Uint8Array(total);
            var off = 0;
            bufs.forEach(function (b) { bytes.set(new Uint8Array(b), off); off += b.byteLength; });
            var img = new Image();
            img.onload = function () { ASSETS.face = img; step(); };
            img.src = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
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
      registerTalker(friendRig, 'friend');
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
      registerTalker(anglerRig, 'angler');
      var ax = 3.7, az = 6.4;
      r.obj.position.set(ax, W.terrainHeight(ax, az) + 0.04, az);
      r.obj.rotation.y = M.atan2(7.5 - ax, 2 - az) + MODEL_FWD;
      var bob = null;
      r.obj.traverse(function (o) { if (o.name === 'Bobber' && !bob) bob = o; });
      if (bob) { bob.userData.y0 = bob.position.y; r.bobber = bob; }
      scene.add(r.obj);
    });
    attachAnimal(ASSETS.fox, 0.0065, 'Walk', 1.0, function (r) { foxRig = r; });
    attachAnimal(ASSETS.horse, 0.005, 'horse', 0.85, function (r) { horseRig = r; });
    attachAnimal(ASSETS.flamingo, 0.0032, 'flamingo_flyA_', 1.0, function (r) {
      if (r) flamingos.push({ rig: r, r: 3.4, h: 5.2, phase: 0, speed: 0.5 });
    });
    attachAnimal(ASSETS.flamingo, 0.0038, 'flamingo_flyA_', 1.3, function (r) {
      if (r) flamingos.push({ rig: r, r: 5.2, h: 6.9, phase: 2.4, speed: 0.38 });
    });
    buildWildlife();
  }

  /* ---------- wildlife park (new models) ---------- */
  var WILD = { birds: [], flowers: [], wolf: null, peacock: null, monkey: null, toucan: null, statueRing: null };
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
    /* monkey on a rock by the trail */
    var mx = 3.9, mz = 12.6, my = W.terrainHeight(mx, mz);
    var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: 0x707a83, roughness: 1 }));
    rock.position.set(mx, my + 0.3, mz);
    rock.castShadow = W.HQ();
    scene.add(rock);
    loadGltf('monkey', function (obj) {
      if (!obj) return;
      obj.traverse(prepMesh);
      obj.scale.setScalar(0.95);
      obj.position.set(mx, my + 0.6, mz);
      obj.rotation.y = -PI * 0.35;
      scene.add(obj);
      WILD.monkey = obj;
    });
    /* birds flying wide circles above the valley */
    loadGltf('bird', function (obj) {
      if (!obj) return;
      var cfgs = [
        { r: 27, h: 10.5, sp: 0.16, ph: 0, s: 1.6 },
        { r: 34, h: 13.5, sp: 0.12, ph: 2.3, s: 2.1 },
        { r: 21, h: 8.2, sp: 0.2, ph: 4.1, s: 1.3 }
      ];
      cfgs.forEach(function (c) {
        var b = obj.clone();
        b.traverse(prepMesh);
        b.scale.setScalar(c.s);
        scene.add(b);
        WILD.birds.push({ obj: b, r: c.r, h: c.h, sp: c.sp, ph: c.ph });
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
      var a = tSec * B.sp + B.ph;
      B.obj.position.set(M.cos(a) * B.r, B.h + M.sin(tSec * 0.9 + B.ph) * 0.8, midz + M.sin(a) * B.r * 0.85);
      B.obj.rotation.y = -a - PI / 2;
      B.obj.rotation.z = 0.18;
    }
    for (var fl = 0; fl < WILD.flowers.length; fl++) {
      var F = WILD.flowers[fl];
      F.obj.rotation.z = M.sin(tSec * 1.3 + F.ph) * 0.045;
    }
    if (WILD.monkey) {
      WILD.monkey.rotation.z = M.sin(tSec * 1.15) * 0.035;
      WILD.monkey.rotation.y = -PI * 0.35 + M.sin(tSec * 0.32) * 0.35;
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

  var introT = 0, INTRO_LEN = 13;
  var introCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(13.5, 9.5, 9.0),
    new THREE.Vector3(7.5, 6.2, 2.0),
    new THREE.Vector3(2.5, 5.2, 7.5),
    new THREE.Vector3(-1.0, 4.6, 16.0),
    new THREE.Vector3(-8.5, 4.4, 27.0),
    new THREE.Vector3(-3.0, 4.0, 33.0),
    new THREE.Vector3(0, 3.0, 41.0)
  ]);
  var introLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(7.5, 0.5, 2.0),
    new THREE.Vector3(7.5, 0.5, 2.0),
    new THREE.Vector3(0, 1.2, 2.0),
    new THREE.Vector3(0, 1.2, 8.0),
    new THREE.Vector3(-8.5, 0.8, 27.0),
    new THREE.Vector3(0, 1.2, 30.0),
    new THREE.Vector3(0, 1.4, 37.0)
  ]);
  var skipBtn = document.getElementById('btn-skip');
  function endIntro() {
    if (GAME.state !== 'intro') return;
    GAME.state = 'playing';
    GAME.startTime = performance.now();
    skipBtn.style.display = 'none';
    document.getElementById('lbx-t').style.height = '0';
    document.getElementById('lbx-b').style.height = '0';
    document.getElementById('intro-title').style.display = 'none';
    showHud();
    camPos.copy(camera.position);
    hint.style.display = 'block';
    hint.textContent = '[ SCROLL TO WALK ]';
    setTimeout(function () { hint.style.display = 'none'; }, 9000);
    toastMsg('Welcome to the trail');
  }
  skipBtn.onclick = endIntro;
  startBtn.onclick = function () {
    if (GAME.state !== 'menu') return;
    GAME.state = 'intro';
    introT = 0;
    document.getElementById('lbx-t').style.height = '11vh';
    document.getElementById('lbx-b').style.height = '11vh';
    document.getElementById('intro-title').style.display = 'block';
    skipBtn.style.display = 'block';
    W.AudioSys.setEnabled(soundOn);
    menu.classList.remove('on');
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

  var petBtn = document.getElementById('btn-pet');
  var petTarget = null, hearts = [];
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
  function tryPet() {
    if (!petTarget) return;
    var name = petTarget === foxRig ? 'fox' : 'horse';
    if (petTarget === foxRig) { spawnHearts(foxRig.obj.position); petted.fox = true; }
    else { spawnHearts(horseRig.obj.position); petted.horse = true; }
    var prev = petTarget._petDone;
    petTarget._petDone = true;
    toastMsg(prev ? (name === 'fox' ? 'The fox loves you' : 'The horse loves you') : 'You petted the ' + name + '!');
    dingSound(660);
    if (petted.fox && petted.horse && !tryPet._ach) {
      tryPet._ach = true;
      setTimeout(function () { toastMsg('ACHIEVEMENT: ANIMAL FRIEND'); dingSound(880); }, 2400);
    }
  }
  petBtn.onclick = tryPet;
  window.addEventListener('keydown', function (ev) {
    if (ev.key.toLowerCase() === 'e' && petTarget && GAME.state === 'playing') tryPet();
  });
  function dingSound(freq) {
    try {
      W.AudioSys.ding(freq);
    } catch (e) {}
  }

  /* ---------- collectible orbs ---------- */
  var orbs = [], orbCount = 0;
  var ORB_SPOTS = [
    [0.5, 35.5], [-1.5, 28], [1.2, 24], [-0.8, 17], [0.9, 10.5], [-1.2, 4],
    [0.7, -3], [-1, -11], [0.8, -18], [-0.6, -26]
  ];
  function buildOrbs() {
    var geo = new THREE.IcosahedronGeometry(0.17, 1);
    var mat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xe8b04b, emissiveIntensity: 1.5, roughness: 0.3 });
    ORB_SPOTS.forEach(function (sp) {
      var o = new THREE.Mesh(geo, mat);
      o.position.set(sp[0], W.terrainHeight(sp[0], sp[1]) + 0.55, sp[1]);
      o.userData.base = o.position.y;
      scene.add(o);
      orbs.push(o);
    });
  }
  var orbLineEl = document.getElementById('orbline');
  function tickOrbs(dt, t) {
    var collectedAll = true;
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      if (!o.visible) { if (!o.userData.got) collectedAll = false; continue; }
      o.rotation.y += dt * 2.2;
      o.position.y = o.userData.base + M.sin(t * 2.4 + i) * 0.1;
      var s2 = 1 + M.sin(t * 3 + i * 1.7) * 0.12;
      o.scale.setScalar(s2);
      if (M.abs(player.pos.x - o.position.x) < 1.3 && M.abs(player.pos.z - o.position.z) < 1.3) {
        o.visible = false; o.userData.got = true;
        orbCount++;
        orbLineEl.textContent = 'ORBS ' + orbCount + '/10';
        toastMsg('ORB ' + orbCount + '/10');
        dingSound(520 + orbCount * 40);
        if (orbCount === 10 && !tickOrbs._ach) {
          tickOrbs._ach = true;
          setTimeout(function () { toastMsg('ACHIEVEMENT: PATHFINDER'); dingSound(990); }, 2400);
        }
        continue;
      }
      if (!o.userData.got) collectedAll = false;
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = M.min(0.05, (now - last) / 1000);
    last = now;
    tSec += dt;
    GAME.frames++;

    if (GAME.state === 'intro') {
      introT += dt;
      var it = M.min(1, introT / INTRO_LEN);
      var eIt = it * it * (3 - 2 * it);
      introCurve.getPoint(eIt, tmpV);
      camera.position.copy(tmpV);
      introLook.getPoint(eIt, tmpV2);
      camera.lookAt(tmpV2);
      if (modelReady) playerRig.mixer.update(dt);
      W.tickSeason(dt, tSec);
      renderer.render(scene, camera);
      if (introT >= INTRO_LEN) endIntro();
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
      hSpeed = mlen * spd;
      if (mlen > 0.06) {
        var nx = player.pos.x + mx * spd * dt;
        var nz = player.pos.z + mz * spd * dt;
        nx = clamp(nx, -13, 13); nz = clamp(nz, -43, 45);
        var BR = W.bridge;
        var onBridge = M.abs(nz - BR.z) < BR.half && nx > BR.x0 && nx < BR.x1;
        function inWater(x, z) {
          if (M.abs(z - BR.z) < BR.half + 0.4 && x > BR.x0 - 0.4 && x < BR.x1 + 0.4) return false;
          var ddx = x - 7.5, ddz = z - 2;
          return ddx * ddx + ddz * ddz < 5.4 * 5.4;
        }
        if (!inWater(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
        else if (!inWater(nx, player.pos.z)) { player.pos.x = nx; }
        else if (!inWater(player.pos.x, nz)) { player.pos.z = nz; }
        player.yaw = angLerp(player.yaw, M.atan2(-mx, -mz) - MODEL_FWD, M.min(1, dt * 8));
        var nowBridge = M.abs(player.pos.z - BR.z) < BR.half && player.pos.x > BR.x0 && player.pos.x < BR.x1;
        if (nowBridge) player.pos.y = M.max(W.terrainHeight(player.pos.x, player.pos.z), W.deckY(player.pos.x)) + 0.1;
      }
      if (!(M.abs(player.pos.z - W.bridge.z) < W.bridge.half && player.pos.x > W.bridge.x0 && player.pos.x < W.bridge.x1))
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
      if (anglerRig.bobber) anglerRig.bobber.position.y = anglerRig.bobber.userData.y0 + M.sin(tSec * 1.8) * 0.045;
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
    // petting proximity
    petTarget = null;
    if (walkMode && GAME.state === 'playing') {
      if (foxRig && player.pos.distanceTo(foxRig.obj.position) < 2.6) petTarget = foxRig;
      else if (horseRig && player.pos.distanceTo(horseRig.obj.position) < 3.2) petTarget = horseRig;
    }
    if (petTarget) {
      petBtn.style.display = 'block';
      petBtn.textContent = 'PET THE ' + (petTarget === foxRig ? 'FOX' : 'HORSE');
    } else petBtn.style.display = 'none';
    for (var hi = hearts.length - 1; hi >= 0; hi--) {
      var hm2 = hearts[hi];
      hm2.userData.t += dt;
      hm2.position.y += hm2.userData.vy * dt;
      hm2.position.x += hm2.userData.vx * dt;
      hm2.rotation.y += dt * 2;
      hm2.material.opacity = M.max(0, 1 - hm2.userData.t / 1.4);
      if (hm2.userData.t > 1.4) { scene.remove(hm2); hearts.splice(hi, 1); }
    }
    tickOrbs(dt, tSec);
    var nf = W.nightFactor();
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
    buildOrbs();
    GAME.state = 'menu';
    startBtn.disabled = false;
    startBtn.textContent = 'START WALKING';
    loaderEl.style.opacity = '0';
    setTimeout(function () { loaderEl.style.display = 'none'; }, 750);
    menu.classList.add('on');
  });
  requestAnimationFrame(tick);
})();
