/* world.js - scene, terrain, sky, water, seasons, weather, audio */
(function () {
  'use strict';
  var M = Math, PI = M.PI;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function lerp(a, b, t) { return a + (b - a) * t; }

  var QUALITY = { level: 'high' };
  var LOWFX = /[?&]lowfx/.test(location.search);
  try { var savedQ = localStorage.getItem('csq'); if (savedQ) QUALITY.level = savedQ; } catch (e) {}
  if (LOWFX) QUALITY.level = 'low';
  var HQ = function () { return QUALITY.level === 'high'; };

  var TRAIL_LEN = 71, TRAIL_Z0 = 38;

  var LAKE = { x: 7.5, z: 2, r: 9, waterY: -0.15 };
  function terrainNoise(x, z) {
    var h = 0;
    h += M.sin(x * 0.14) * M.cos(z * 0.11) * 1.5;
    h += M.sin(x * 0.05 + 1.7) * M.cos(z * 0.06) * 2.2;
    h *= 0.45;
    var dTrail = M.abs(x);
    if (dTrail < 6) h *= dTrail / 6;
    // carve the lake basin (fades out near the walking trail)
    var dxl = x - LAKE.x, dzl = z - LAKE.z, dl = M.sqrt(dxl * dxl + dzl * dzl);
    if (dl < LAKE.r) {
      var t = 1 - dl / LAKE.r;
      var s = t * t * (3 - 2 * t);
      var w = M.min(1, dTrail / 2.2);
      h = h * (1 - s * w) + (-1.9 * s) * w;
    }
    return h;
  }
  function terrainHeight(x, z) { return terrainNoise(x, z); }
  function trailPos(p) { return { x: 0, z: TRAIL_Z0 - TRAIL_LEN * p }; }

  var scene, renderer, camera, hemi, sun, sunMesh, sunHalo;

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: HQ() });
    renderer.setPixelRatio(HQ() ? M.min(2, window.devicePixelRatio) : 1);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = HQ();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 420);
    camera.position.set(0, 3.4, 44);

    hemi = new THREE.HemisphereLight(0xffffff, 0x557766, 0.85);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2dd, 1.05);
    sun.position.set(18, 30, 10);
    if (HQ()) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -27; sun.shadow.camera.right = 27;
      sun.shadow.camera.top = 27; sun.shadow.camera.bottom = -27;
      sun.shadow.camera.far = 90; sun.shadow.bias = -0.002;
    }
    scene.add(sun); scene.add(sun.target);
    window.WORLD.scene = scene;
    window.WORLD.renderer = renderer;
    window.WORLD.camera = camera;
    window.WORLD.hemi = hemi;
    window.WORLD.sun = sun;

    buildSky();
    buildNight();
    buildTerrain();
    buildPath();
    buildPond();
    buildVegetation();
    buildWeather();
    buildScatter();
    buildWaterfall();
    buildDroplets();
    buildBridge();
    buildCampsite();
    buildMountains();

    scene.fog = new THREE.Fog(0xbcd4e6, 60, 185);
    return { scene: scene, renderer: renderer, camera: camera };
  }

  /* ---------- sky ---------- */
  var skyMat, clouds = [];
  function buildSky() {
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x6fa5d8) },
        bottomColor: { value: new THREE.Color(0xcfe4ee) },
        offset: { value: 22 }, exponent: { value: 0.7 }
      },
      vertexShader: [
        'varying vec3 vWorld;',
        'void main() {',
        '  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 bottomColor;',
        'uniform float offset; uniform float exponent;',
        'varying vec3 vWorld;',
        'void main() {',
        '  float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;',
        '  gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);',
        '}'
      ].join('\n')
    });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 14), skyMat);
    scene.add(dome);
    window.WORLD.sunMesh = sunMesh;

    sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff3cf, fog: false, transparent: true, opacity: 0.95 })
    );
    var sunDir = new THREE.Vector3(18, 30, 10).normalize().multiplyScalar(168);
    sunMesh.position.copy(sunDir);
    scene.add(sunMesh);
    sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(13, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffedbb, fog: false, transparent: true, opacity: 0.22 })
    );
    sunHalo.position.copy(sunDir);
    scene.add(sunHalo);

    var cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    var puffGeo = new THREE.DodecahedronGeometry(1, 0);
    for (var i = 0; i < 12; i++) {
      var g = new THREE.Group();
      var n = 3 + M.floor(M.random() * 3);
      for (var p = 0; p < n; p++) {
        var puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - n / 2) * 2.2 + M.random(), M.random() * 0.8, M.random() * 2 - 1);
        puff.scale.set(2.2 + M.random() * 2.4, 1.1 + M.random() * 0.7, 1.6 + M.random() * 1.2);
        g.add(puff);
      }
      g.position.set((M.random() - 0.5) * 220, 36 + M.random() * 20, TRAIL_Z0 - TRAIL_LEN / 2 + (M.random() - 0.5) * 220);
      g.userData.speed = 0.35 + M.random() * 0.5;
      scene.add(g);
      clouds.push(g);
    }
  }

  /* ---------- terrain with vertex colors ---------- */
  var terrain, pathMat;
  function buildTerrain() {
    var geo = new THREE.PlaneGeometry(170, 170, 110, 110);
    geo.rotateX(-PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var c = new THREE.Color(), cA = new THREE.Color(0x6f9e52), cB = new THREE.Color(0x86ab5e), dirt = new THREE.Color(0xb59a6d);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainNoise(x, z));
      var n = 0.5 + 0.5 * M.sin(x * 0.35 + M.sin(z * 0.31) * 2) * M.cos(z * 0.27);
      c.copy(cA).lerp(cB, n);
      var dTrail = M.abs(x);
      if (dTrail < 3.4) c.lerp(dirt, clamp(1 - (dTrail - 1.9) / 1.5, 0, 1) * 0.85);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    terrain.receiveShadow = HQ();
    scene.add(terrain);
  }

  function buildPath() {
    var g = new THREE.PlaneGeometry(3.2, TRAIL_LEN + 12);
    g.rotateX(-PI / 2);
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 1 }));
    m.position.set(0, 0.02, TRAIL_Z0 - TRAIL_LEN / 2);
    m.receiveShadow = HQ();
    scene.add(m);
    pathMat = m.material;
  }

  /* ---------- night: stars, moon, fireflies ---------- */
  var stars = null, moonMesh = null, fflies = null, ffBase = null;
  function buildNight() {
    var n = 700, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var th = M.random() * PI * 2, ph = M.random() * 0.48 * PI, r = 188;
      pos[i * 3] = M.cos(th) * M.cos(ph) * r;
      pos[i * 3 + 1] = M.sin(ph) * r + 4;
      pos[i * 3 + 2] = M.sin(th) * M.cos(ph) * r;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.35, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    stars.visible = false;
    scene.add(stars);
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xe9eff9, fog: false, transparent: true, opacity: 0 }));
    moonMesh.position.set(-95, 88, -65);
    moonMesh.visible = false;
    scene.add(moonMesh);
    var fn = 42, fp = new Float32Array(fn * 3);
    ffBase = [];
    for (var fi = 0; fi < fn; fi++) {
      var fx = (M.random() - 0.5) * 17, fz = -32 + M.random() * 62;
      var fy = terrainHeight(fx, fz) + 0.5 + M.random() * 1.6;
      ffBase.push({ x: fx, y: fy, z: fz });
      fp[fi * 3] = fx; fp[fi * 3 + 1] = fy; fp[fi * 3 + 2] = fz;
    }
    var fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xd9ff9e, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    fflies.visible = false;
    scene.add(fflies);
  }

  /* ---------- pond ---------- */
  var pondMat, pondUniforms;
  function buildPond() {
    pondUniforms = {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x3f7f9e) },
      uColorB: { value: new THREE.Color(0x7ec2d6) }
    };
    pondMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: pondUniforms,
      vertexShader: [
        'varying vec2 vUv;',
        'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec2 c = vUv - 0.5;',
        '  float d = length(c) * 2.0;',
        '  float w1 = sin(c.x * 42.0 + uTime * 1.4 + sin(c.y * 30.0 + uTime * 0.9) * 1.6);',
        '  float w2 = sin((c.x + c.y) * 26.0 - uTime * 1.1);',
        '  float rip = (w1 + w2) * 0.25 + 0.5;',
        '  vec3 col = mix(uColorA, uColorB, rip * 0.55);',
        '  float edge = smoothstep(0.98, 0.82, d);',
        '  gl_FragColor = vec4(col, 0.88 + rip * 0.08);',
        '  gl_FragColor.a *= edge;',
        '}'
      ].join('\n')
    });
    var pond = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), pondMat);
    pond.rotation.x = -PI / 2;
    pond.position.set(LAKE.x, LAKE.waterY, LAKE.z);
    pond.visible = !HQ();
    scene.add(pond);
    // river outlet: animated strip flowing south from the pond
    var segN = 14, segLen = 2.3;
    for (var rs = 0; rs < segN; rs++) {
      var rz = -4.0 - rs * segLen - segLen / 2;
      var rx = 7.5 - rs * 0.045;
      var seg = new THREE.Mesh(new THREE.PlaneGeometry(1.5 - rs * 0.03, segLen + 0.12), pondMat);
      seg.rotation.x = -PI / 2;
      var y0 = terrainHeight(rx, rz - segLen / 2), y1 = terrainHeight(rx, rz + segLen / 2);
      seg.rotation.y = PI / 2;
      seg.position.set(rx, M.max(y0, y1) + 0.05 + 0.02, rz);
      seg.rotation.x = -PI / 2 + M.atan((y1 - y0) / segLen) * 0.9;
      seg.visible = !HQ();
      scene.add(seg);
    }
    // real reflective water on high quality
    if (HQ()) {
      new THREE.TextureLoader().load('models/waternormals.jpg', function (nt) {
        nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
        water = new THREE.Water(new THREE.PlaneGeometry(11.5, 11.5), {
          textureWidth: 512, textureHeight: 512,
          waterNormals: nt,
          sunDirection: new THREE.Vector3(0.3, 0.9, 0.25).normalize(),
          sunColor: 0xfff2dd, waterColor: 0x1e5666,
          distortionScale: 1.7, fog: true
        });
        water.rotation.x = -PI / 2;
        water.position.set(LAKE.x, LAKE.waterY, LAKE.z);
        water.material.uniforms.size.value = 3.2;
        scene.add(water);
        window.WORLD.water = water;
      });
    }
  }
  var water = null, waterBase = new THREE.Color(0x1e5666);
  var DEEP_COLOR = new THREE.Color(0x134252);

  /* ---------- vegetation ---------- */
  var treeMats, trees = [], bushes = [], flowers = [], butterflies = [];
  function buildVegetation() {
    treeMats = {
      trunk: new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x4d7a35, roughness: 1, flatShading: true })
    };
    var coneGeo = new THREE.ConeGeometry(1.5, 3.4, 7);
    var ballGeo = new THREE.SphereGeometry(1.5, 7, 5);
    var trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
    var placed = 0, guard = 0;
    while (placed < 58 && guard < 4000) {
      guard++;
      var ang = M.random() * PI * 2, rad = 7 + M.random() * 60;
      var x = M.cos(ang) * rad, z = TRAIL_Z0 - TRAIL_LEN / 2 + M.sin(ang) * rad * 0.95;
      if (M.abs(x) < 5.5) continue;
      var px = x - 7.5, pz = z - 2; if (px * px + pz * pz < 10.8 * 10.8) continue;
      var y = terrainNoise(x, z);
      var s = 0.8 + M.random() * 0.7;
      var tree = new THREE.Group();
      var trunk = new THREE.Mesh(trunkGeo, treeMats.trunk);
      trunk.position.y = 0.7;
      var crown = new THREE.Mesh(placed % 2 ? ballGeo : coneGeo, treeMats.leaf);
      crown.position.y = placed % 2 ? 2.5 : 2.9;
      crown.scale.setScalar(s);
      tree.add(trunk, crown);
      tree.position.set(x, y, z);
      tree.rotation.y = M.random() * PI * 2;
      trunk.castShadow = crown.castShadow = HQ();
      scene.add(tree);
      trees.push(crown);
      placed++;
    }
    var bushGeo = new THREE.SphereGeometry(0.55, 7, 5); bushGeo.scale(1, 0.62, 1);
    var bushMat = new THREE.MeshStandardMaterial({ color: 0x4d7a35, roughness: 1, flatShading: true });
    var nb = 0; guard = 0;
    while (nb < 64 && guard < 3000) {
      guard++;
      var ba = M.random() * PI * 2, brad = 4 + M.random() * 52;
      var bx = M.cos(ba) * brad, bz = M.sin(ba) * brad * 1.2 - 4;
      if (M.abs(bx) < 3.2) continue;
      var blx = bx - 7.5, blz = bz - 2; if (blx * blx + blz * blz < 10.5 * 10.5) continue;
      var bcx = bx + 8.5, bcz = bz - 27; if (bcx * bcx + bcz * bcz < 16) continue;
      var b = new THREE.Mesh(bushGeo, bushMat);
      b.position.set(bx, terrainNoise(bx, bz) + 0.18, bz);
      b.scale.setScalar(0.7 + M.random() * 0.8);
      scene.add(b); bushes.push(b); nb++;
    }
    var flGeo = new THREE.SphereGeometry(0.09, 6, 4);
    var flCols = [0xe86a5c, 0xe8b04b, 0xd770a8, 0xf0f0e8];
    for (var fi = 0; fi < 46; fi++) {
      var fa = M.random() * PI * 2, frad = 4.5 + M.random() * 40;
      var fx = M.cos(fa) * frad, fz = M.sin(fa) * frad * 1.15 - 2;
      if (M.abs(fx) < 2.6) { fi--; continue; }
      var fl = new THREE.Mesh(flGeo, new THREE.MeshStandardMaterial({ color: flCols[fi % 4], roughness: 1 }));
      fl.position.set(fx, terrainNoise(fx, fz) + 0.12, fz);
      scene.add(fl); flowers.push(fl);
    }
    // butterflies
    var wingGeo = new THREE.PlaneGeometry(0.16, 0.11);
    var bfCols = [0xe8b04b, 0xd770a8, 0x8fd0ff, 0xe86a5c];
    for (var bi = 0; bi < 7; bi++) {
      var grp = new THREE.Group();
      var mat = new THREE.MeshBasicMaterial({ color: bfCols[bi % 4], side: THREE.DoubleSide });
      var wl = new THREE.Mesh(wingGeo, mat); wl.position.x = -0.08;
      var wr = new THREE.Mesh(wingGeo, mat); wr.position.x = 0.08;
      grp.add(wl, wr);
      grp.userData = {
        cx: (M.random() - 0.5) * 30, cz: 20 - M.random() * 50,
        r: 1.2 + M.random() * 2.2, sp: 0.6 + M.random() * 0.7,
        ph: M.random() * 6.28, h: 0.7 + M.random() * 0.9,
        wl: wl, wr: wr, anchors: null, ai: 0, tSwitch: 0
      };
      scene.add(grp);
      butterflies.push(grp);
    }
  }

  /* ---------- rocks + grass scatter ---------- */
  var rocks = [], grassMesh = null;
  function buildScatter() {
    var rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8d90, roughness: 0.95, flatShading: true });
    var rockGeo = new THREE.DodecahedronGeometry(1, 0);
    var placed = 0, guard = 0;
    while (placed < (HQ() ? 42 : 16) && guard < 900) {
      guard++;
      var rx = (M.random() - 0.5) * 44, rz = -40 + M.random() * 82;
      if (M.abs(rx) < 3.6) continue;
      var rlx = rx - LAKE.x, rlz = rz - LAKE.z; if (rlx * rlx + rlz * rlz < 118) continue;
      var rcx = rx + 8.5, rcz = rz - 27; if (rcx * rcx + rcz * rcz < 22) continue;
      var rock = new THREE.Mesh(rockGeo, rockMat);
      var rs = 0.16 + M.random() * 0.62;
      rock.scale.set(rs * (0.8 + M.random() * 0.5), rs * (0.55 + M.random() * 0.4), rs * (0.8 + M.random() * 0.5));
      rock.position.set(rx, terrainHeight(rx, rz) + rs * 0.18, rz);
      rock.rotation.set(M.random() * 0.4, M.random() * PI * 2, M.random() * 0.4);
      rock.castShadow = HQ();
      scene.add(rock); rocks.push(rock); placed++;
    }
    if (!HQ()) return;
    // grass tufts (instanced)
    var gc = document.createElement('canvas'); gc.width = 128; gc.height = 96;
    var gx = gc.getContext('2d');
    for (var bi = 0; bi < 9; bi++) {
      var bx0 = 14 + bi * 12 + M.random() * 4, bh = 46 + M.random() * 42;
      var grd = gx.createLinearGradient(0, 96, 0, 96 - bh);
      var gcol = ['34,72,30', '48,90,36', '60,104,42'][bi % 3];
      grd.addColorStop(0, 'rgba(' + gcol + ',1)');
      grd.addColorStop(1, 'rgba(' + gcol + ',0)');
      gx.fillStyle = grd;
      gx.beginPath();
      gx.moveTo(bx0, 96);
      gx.quadraticCurveTo(bx0 + (M.random() * 14 - 7), 96 - bh * 0.6, bx0 + (M.random() * 20 - 10), 96 - bh);
      gx.quadraticCurveTo(bx0 + (M.random() * 14 - 7), 96 - bh * 0.6, bx0 + 7, 96);
      gx.fill();
    }
    var gTex = new THREE.CanvasTexture(gc);
    var gMat = new THREE.MeshStandardMaterial({ map: gTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
    var gGeo = new THREE.PlaneGeometry(0.95, 0.6);
    gGeo.translate(0, 0.3, 0);
    var COUNT = 240;
    grassMesh = new THREE.InstancedMesh(gGeo, gMat, COUNT);
    var dummy = new THREE.Object3D();
    var placedG = 0, guardG = 0;
    while (placedG < COUNT && guardG < 3000) {
      guardG++;
      var gxz = (M.random() - 0.5) * 30, gzz = -36 + M.random() * 76;
      if (M.abs(gxz) < 1.9) continue;
      var glx = gxz - LAKE.x, glz = gzz - LAKE.z; if (glx * glx + glz * glz < 105) continue;
      dummy.position.set(gxz, terrainHeight(gxz, gzz), gzz);
      dummy.rotation.set(0, M.random() * PI, 0);
      var gs2 = 0.7 + M.random() * 0.8;
      dummy.scale.set(gs2, gs2 * (0.8 + M.random() * 0.5), gs2);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(placedG, dummy.matrix);
      placedG++;
    }
    grassMesh.count = placedG;
    grassMesh.instanceMatrix.needsUpdate = true;
    scene.add(grassMesh);
  }

  /* ---------- waterfall + cliffs on the lake's east rim ---------- */
  var wfUniforms = null, mist = null;
  function buildWaterfall() {
    var cliffMat = new THREE.MeshStandardMaterial({ color: 0x7d7d85, roughness: 1, flatShading: true });
    // natural boulder crag on the east rim
    var boulders = [
      [13.6, 1.9, 1.7, 2.0, 3.9, 1.9],
      [14.6, 0.8, 1.5, 2.3, 3.2, 1.7],
      [14.3, 3.2, 1.4, 1.9, 3.6, 1.6],
      [13.9, 2.9, 1.2, 1.6, 3.0, 1.4],
      [15.1, 2.1, 1.1, 1.5, 2.5, 1.3]
    ];
    for (var i = 0; i < boulders.length; i++) {
      var b = boulders[i];
      var blk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), cliffMat);
      blk.scale.set(b[2], b[3], b[4]);
      blk.position.set(b[0], terrainHeight(b[0], b[1]) + b[3] * 0.36, b[1]);
      blk.rotation.set(0.15 + M.random() * 0.2, M.random() * PI * 2, (M.random() - 0.5) * 0.15);
      blk.castShadow = blk.receiveShadow = HQ();
      scene.add(blk);
    }
    // waterfall sheet, in front of the crag, dropping into the lake
    wfUniforms = { uTime: { value: 0 } };
    var wfMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: wfUniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform float uTime; varying vec2 vUv;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'void main() {',
        '  float col1 = fract(vUv.y * 7.0 - uTime * 1.5 + hash(vec2(floor(vUv.x * 14.0), 1.0)) * 0.4);',
        '  float col2 = fract(vUv.y * 3.0 - uTime * 2.2 + hash(vec2(3.0, floor(vUv.x * 9.0))) * 0.5);',
        '  float body = 0.40 + 0.22 * sin(col1 * 6.2831) + 0.18 * (1.0 - vUv.y) + 0.12 * sin(col2 * 6.2831);',
        '  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);',
        '  float foam = smoothstep(0.80, 1.0, vUv.y) * 0.85 + smoothstep(0.16, 0.0, vUv.y) * 0.75;',
        '  float alpha = (body + foam * 0.85) * edge;',
        '  vec3 col = mix(vec3(0.62, 0.78, 0.85), vec3(1.0), clamp(foam + 0.3, 0.0, 1.0));',
        '  gl_FragColor = vec4(col, clamp(alpha, 0.25, 0.95));',
        '}'
      ].join('\n')
    });
    var wf = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 4.7, 1, 12), wfMat);
    wf.position.set(12.75, 1.75, 2);
    wf.rotation.y = -PI / 2 + 0.05;
    scene.add(wf);
    // top lip foam
    var lip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xeef7fb, transparent: true, opacity: 0.85 }));
    lip.scale.set(6.5, 0.55, 1.0);
    lip.position.set(12.72, 4.05, 2);
    scene.add(lip);
    // splash rings on the water
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xdff2f8, transparent: true, opacity: 0.5, depthWrite: false });
    for (var ri = 0; ri < 3; ri++) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62 + ri * 0.12, 26), ringMat.clone());
      ring.rotation.x = -PI / 2;
      ring.position.set(12.25, LAKE.waterY + 0.02 + ri * 0.005, 2);
      ring.userData.ph = ri * 2.1;
      scene.add(ring);
      splashRings.push(ring);
    }
    // rising mist
    var mn = 26, mpos = new Float32Array(mn * 3);
    for (var mi = 0; mi < mn; mi++) {
      mpos[mi * 3] = (M.random() - 0.5) * 1.8; mpos[mi * 3 + 1] = M.random() * 3; mpos[mi * 3 + 2] = (M.random() - 0.5) * 1.2;
    }
    var mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
    mist = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xeef6fa, size: 0.34, transparent: true, opacity: 0.28, depthWrite: false }));
    mist.position.set(12.5, LAKE.waterY + 0.15, 2);
    scene.add(mist);
  }
  var splashRings = [];

  /* ---------- wooden bridge over the lake ---------- */
  var bridge = { x0: 1.8, x1: 12.7, z: 2, half: 0.85 };
  function deckY(x) {
    var t = clamp((x - bridge.x0) / (bridge.x1 - bridge.x0), 0, 1);
    var ground = terrainNoise(x, bridge.z) + 0.16;
    var arc = LAKE.waterY + 0.72 + 1.15 * M.sin(PI * t);
    var d = ground - arc;
    return (ground + arc + M.sqrt(d * d + 0.16)) / 2;
  }
  function buildBridge() {
    var wood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
    var woodD = new THREE.MeshStandardMaterial({ color: 0x63472c, roughness: 0.95 });
    var g = new THREE.Group();
    var segs = 24;
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var x = bridge.x0 + (bridge.x1 - bridge.x0) * t;
      var y = deckY(x);
      var plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 1.9), (i % 2 ? wood : woodD));
      plank.position.set(x, y, bridge.z);
      plank.rotation.z = -M.atan((deckY(M.min(bridge.x1, x + 0.45)) - deckY(M.max(bridge.x0, x - 0.45))) / 0.9);
      plank.castShadow = plank.receiveShadow = HQ();
      g.add(plank);
      if (i % 3 === 0) {
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.72, 6), wood);
          post.position.set(x, y + 0.36, bridge.z + s2 * 0.88);
          g.add(post);
        }
      }
    }
    // rails
    for (var rs = -1; rs <= 1; rs += 2) {
      var railGeo = [];
      for (var i2 = 0; i2 <= 24; i2++) {
        var x2 = bridge.x0 + (bridge.x1 - bridge.x0) * (i2 / 24);
        railGeo.push(new THREE.Vector3(x2, deckY(x2) + 0.66, bridge.z + rs * 0.88));
      }
      var rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railGeo), 24, 0.045, 6), wood);
      rail.castShadow = HQ();
      g.add(rail);
    }
    // support posts down into the water
    for (var sp = 0; sp < 3; sp++) {
      var sx = 4.2 + sp * 3.3;
      for (var s3 = -1; s3 <= 1; s3 += 2) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), woodD);
        leg.position.set(sx, deckY(sx) - 1.5, bridge.z + s3 * 0.8);
        g.add(leg);
      }
    }
    scene.add(g);
    window.WORLD.bridge = bridge;
    window.WORLD.deckY = deckY;
  }

  /* ---------- campsite with campfire ---------- */
  var campfire = null;
  function buildCampsite() {
    var cx = -8.5, cz = 27;
    var g = new THREE.Group();
    var tentMat1 = new THREE.MeshStandardMaterial({ color: 0xc46a3a, roughness: 0.95, side: THREE.DoubleSide });
    var tentMat2 = new THREE.MeshStandardMaterial({ color: 0x3a7a8c, roughness: 0.95, side: THREE.DoubleSide });
    function tent(x, z, ry, mat) {
      var t = new THREE.Group();
      var side1 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), mat);
      side1.position.set(0, 0.62, 0.6); side1.rotation.x = 0.42;
      var side2 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), mat);
      side2.position.set(0, 0.62, -0.6); side2.rotation.x = -0.42;
      var back = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.15), new THREE.MeshStandardMaterial({ color: 0x6b4d33, roughness: 1, side: THREE.DoubleSide }));
      back.position.set(-1.12, 0.5, 0); back.rotation.y = -PI / 2;
      t.add(side1, side2, back);
      t.position.set(x, terrainHeight(x, z), z);
      t.rotation.y = ry;
      t.traverse(function (o) { if (o.isMesh) { o.castShadow = HQ(); } });
      return t;
    }
    g.add(tent(cx - 1.9, cz - 0.4, 0.5, tentMat1));
    g.add(tent(cx + 1.2, cz + 1.9, -2.2, tentMat2));
    // fire pit
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8d90, roughness: 1, flatShading: true });
    for (var i = 0; i < 9; i++) {
      var a = (i / 9) * PI * 2;
      var st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), stoneMat);
      st.position.set(cx + M.cos(a) * 0.62, terrainHeight(cx, cz) + 0.06, cz + M.sin(a) * 0.62);
      st.rotation.set(M.random(), M.random(), M.random());
      st.castShadow = HQ();
      g.add(st);
    }
    var logMat = new THREE.MeshStandardMaterial({ color: 0x5c4128, roughness: 1 });
    for (var l2 = 0; l2 < 3; l2++) {
      var log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 7), logMat);
      var la = (l2 / 3) * PI;
      log.position.set(cx + M.cos(la) * 0.28, terrainHeight(cx, cz) + 0.1, cz + M.sin(la) * 0.28);
      log.rotation.set(PI / 2 - 0.25, la, 0);
      log.castShadow = HQ();
      g.add(log);
      // seat logs
      var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 7), logMat);
      var sa = 1.1 + l2 * 1.9;
      seat.position.set(cx + M.cos(sa) * 1.5, terrainHeight(cx + M.cos(sa) * 1.5, cz + M.sin(sa) * 1.5) + 0.17, cz + M.sin(sa) * 1.5);
      seat.rotation.z = PI / 2;
      seat.rotation.y = sa;
      seat.castShadow = HQ();
      g.add(seat);
    }
    // flames (two crossed additive sprites)
    function flameTex() {
      var fc = document.createElement('canvas'); fc.width = 64; fc.height = 96;
      var fx = fc.getContext('2d');
      var fg = fx.createRadialGradient(32, 78, 4, 32, 60, 60);
      fg.addColorStop(0, 'rgba(255,190,80,1)');
      fg.addColorStop(0.35, 'rgba(255,120,30,0.85)');
      fg.addColorStop(0.75, 'rgba(200,60,10,0.35)');
      fg.addColorStop(1, 'rgba(120,20,0,0)');
      fx.fillStyle = fg;
      fx.beginPath(); fx.moveTo(32, 4);
      fx.quadraticCurveTo(58, 60, 44, 88); fx.quadraticCurveTo(32, 96, 20, 88); fx.quadraticCurveTo(6, 60, 32, 4);
      fx.fill();
      return new THREE.CanvasTexture(fc);
    }
    var ft = flameTex();
    var f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f1.position.set(cx, terrainHeight(cx, cz) + 0.6, cz);
    var f2 = f1.clone();
    f2.rotation.y = PI / 2; f2.scale.set(0.75, 0.8, 1); f2.position.y += 0.05;
    g.add(f1, f2);
    var light = new THREE.PointLight(0xff8c3a, 1.2, 11, 2);
    light.position.set(cx, terrainHeight(cx, cz) + 0.9, cz);
    g.add(light);
    // smoke
    var sn = 14, spos = new Float32Array(sn * 3);
    for (var si3 = 0; si3 < sn; si3++) {
      spos[si3 * 3] = (M.random() - 0.5) * 0.2; spos[si3 * 3 + 1] = M.random() * 4; spos[si3 * 3 + 2] = (M.random() - 0.5) * 0.2;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    var smoke = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9a9a9a, size: 0.3, transparent: true, opacity: 0.32, depthWrite: false }));
    smoke.position.set(cx, terrainHeight(cx, cz) + 1, cz);
    g.add(smoke);
    scene.add(g);
    campfire = { light: light, f1: f1, f2: f2, smoke: smoke };
    window.WORLD.campfire = campfire;
  }

  /* ---------- real mountain range + foothills + treeline ---------- */
  function buildMountains() {
    var c = new THREE.Color();
    function ridge(cx, cz, h, br, hue, sat, lit, snow) {
      var geo = new THREE.ConeGeometry(br, h, 8, 7);
      geo.translate(0, h / 2, 0);
      var pos = geo.attributes.position;
      var colors = new Float32Array(pos.count * 3);
      var rock = new THREE.Color().setHSL(hue, sat, lit);
      var rockD = rock.clone().multiplyScalar(0.72);
      var snowC = new THREE.Color(0xf2f6fa);
      var snowLine = h * (0.46 + M.random() * 0.14);
      for (var vi = 0; vi < pos.count; vi++) {
        var vx = pos.getX(vi), vy = pos.getY(vi), vz = pos.getZ(vi);
        var k = M.max(0, 1 - vy / h);
        var d = M.sin(vx * 0.33 + vz * 0.21) + M.sin(vz * 0.41 + 1.7) + M.sin((vx + vz) * 0.24 + 3.1) + M.sin((vx - vz) * 0.55);
        var amp = (0.05 + 0.16 * k) * br * 0.55;
        var rl = M.sqrt(vx * vx + vz * vz) || 1;
        var target = br + amp * d * 0.35;
        pos.setX(vi, vx * (target / rl));
        pos.setZ(vi, vz * (target / rl));
        pos.setY(vi, vy + M.sin(vx * 0.5 + vz * 0.37) * k * br * 0.07);
        c.copy(rock).lerp(rockD, (M.sin(vx * 0.19 + vz * 0.23) + 1) / 2);
        if (snow && vy > snowLine + M.sin(vx * 0.35 + vz * 0.3) * h * 0.04) c.lerp(snowC, clamp((vy - snowLine) / (h * 0.1), 0, 1));
        colors[vi * 3] = c.r; colors[vi * 3 + 1] = c.g; colors[vi * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
      m.position.set(cx, -2.5, cz);
      m.rotation.y = M.random() * PI * 2;
      scene.add(m);
      return m;
    }
    // big peaks around the horizon (lower toward the sun in the south-east)
    for (var i = 0; i < 15; i++) {
      var ang = (i / 15) * PI * 2 + M.random() * 0.2;
      var south = M.sin(ang) > 0.15;
      var h = (south ? 18 : 34) + M.random() * (south ? 16 : 44);
      var rad = 148 + M.random() * 42;
      ridge(M.cos(ang) * rad, 2 + M.sin(ang) * rad * 0.9, h, h * (0.52 + M.random() * 0.2),
        0.58 + M.random() * 0.04, 0.10 + M.random() * 0.05, 0.33 + M.random() * 0.07, true);
    }
    // foothills
    for (var f = 0; f < 12; f++) {
      var fa = M.random() * PI * 2;
      var frad = 104 + M.random() * 28;
      ridge(M.cos(fa) * frad, 2 + M.sin(fa) * frad * 0.9, 5 + M.random() * 10, 9 + M.random() * 11,
        0.34 + M.random() * 0.05, 0.16 + M.random() * 0.08, 0.22 + M.random() * 0.07, false);
    }
    // distant treeline on the foothills
    var treeGeo = new THREE.ConeGeometry(1.6, 4.2, 6);
    var treeMat = new THREE.MeshStandardMaterial({ color: 0x2c4a30, roughness: 1, flatShading: true });
    var COUNT = HQ() ? 170 : 60;
    var tline = new THREE.InstancedMesh(treeGeo, treeMat, COUNT);
    var dummy = new THREE.Object3D();
    for (var t2 = 0; t2 < COUNT; t2++) {
      var ta = M.random() * PI * 2;
      var tr = 88 + M.random() * 40;
      var tx = M.cos(ta) * tr, tz = 2 + M.sin(ta) * tr * 0.9;
      dummy.position.set(tx, 2.5 + M.random() * 3, tz);
      var ts = 0.8 + M.random() * 1.5;
      dummy.scale.set(ts, ts * (0.9 + M.random() * 0.5), ts);
      dummy.rotation.y = M.random() * PI;
      dummy.updateMatrix();
      tline.setMatrixAt(t2, dummy.matrix);
    }
    scene.add(tline);
  }

  /* ---------- weather ---------- */
  var rain, snow, umbrella, umbrellaOn = false, lightningOn = false, flashT = 0;
  function makePrecip(count, color, size) {
    var g = new THREE.BufferGeometry();
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      arr[i * 3] = (M.random() - 0.5) * 70;
      arr[i * 3 + 1] = M.random() * 26;
      arr[i * 3 + 2] = (M.random() - 0.5) * 70;
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    var m = new THREE.PointsMaterial({ color: color, size: size, transparent: true, opacity: 0.8, depthWrite: false });
    var pts = new THREE.Points(g, m);
    pts.visible = false;
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  }
  function buildWeather() {
    rain = makePrecip(HQ() ? 470 : 160, 0xbdd6ee, 0.13);
    snow = makePrecip(HQ() ? 320 : 120, 0xffffff, 0.16);
    umbrella = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }));
    pole.position.y = 0.15;
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.34, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f4a6b, roughness: 0.85, side: THREE.DoubleSide }));
    canopy.position.y = 0.72;
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x22303f }));
    cap.position.y = 0.92;
    umbrella.add(pole, canopy, cap);
    umbrella.visible = false;
    scene.add(umbrella);
  }

  /* ---------- seasons ---------- */
  var SEASONS = {
    summer:  { top: 0x5f9bd4, bot: 0xcfe4ee, fog: 0xbcd4e6, fogN: 70, fogF: 340, hemi: 0.85, sunI: 1.15, terr: 0xffffff, leaf: 0x4d7a35, path: 0xc9b48a, waterA: 0x3f7f9e, waterB: 0x7ec2d6, flowers: true, butterflies: true, rain: 0, snow: 0, sunOp: 0.95, lightning: false, umbrella: false, cloud: 0xffffff, top_tint: 0xffffff, bottom_tint: 0xffffff, rainAudio: 0, windAudio: 0.05 },
    rainy:   { top: 0x5c7085, bot: 0x9fb0ba, fog: 0x8d9dad, fogN: 30, fogF: 240, hemi: 0.72, sunI: 0.55, terr: 0xb9c9bb, leaf: 0x47703a, path: 0xb8a583, waterA: 0x3a6f8a, waterB: 0x6fa9c2, flowers: true, butterflies: false, rain: 260, snow: 0, sunOp: 0, lightning: false, umbrella: true, cloud: 0xb6c2cb, top_tint: 0x9db4c8, bottom_tint: 0x8d99a8, rainAudio: 0.16, windAudio: 0.1 },
    monsoon: { top: 0x46586b, bot: 0x8a98a2, fog: 0x74858f, fogN: 20, fogF: 175, hemi: 0.6, sunI: 0.38, terr: 0x9fb3a0, leaf: 0x3f6a3c, path: 0xa99879, waterA: 0x2f5f78, waterB: 0x5f95ae, flowers: true, butterflies: false, rain: 470, snow: 0, sunOp: 0, lightning: true, umbrella: true, cloud: 0x84929d, top_tint: 0x86a89a, bottom_tint: 0x7d8a95, rainAudio: 0.3, windAudio: 0.16 },
    winter:  { top: 0x93aaba, bot: 0xd8e2e8, fog: 0xc6d2dc, fogN: 40, fogF: 320, hemi: 0.8, sunI: 0.75, terr: 0xe2e8ea, leaf: 0x9fb4a8, path: 0xd9d3c6, waterA: 0x5b7d94, waterB: 0x9fc4d4, flowers: false, butterflies: false, rain: 0, snow: 320, sunOp: 0.75, lightning: false, umbrella: false, cloud: 0xf2f5f8, top_tint: 0xb9c6d8, bottom_tint: 0xa8b2c0, rainAudio: 0, windAudio: 0.12 }
  };
  var curSeason = 'summer';
  var SNt = null, SC = { t: 1 };
  var seasonCallbacks = [];

  /* ---------- time of day ---------- */
  var TIMES = {
    noon:   { night: 0, exp: 1.04 },
    sunset: { night: 0, exp: 0.97, skyTopT: 0xc97845, skyTopA: 0.55, skyBotT: 0xe8b489, skyBotA: 0.45, sunTint: 0xffb066, sunMul: 0.8, hemiMul: 0.85, fogT: 0xd8a87c, fogA: 0.35, terrMul: 0.82, leafMul: 0.85, sunOpMul: 1 },
    night:  { night: 1, exp: 0.8, skyTopT: 0x0a1226, skyTopA: 0.94, skyBotT: 0x16233c, skyBotA: 0.85, sunTint: 0x93a9d8, sunMul: 0.09, hemiMul: 0.24, fogT: 0x0c1626, fogA: 0.8, terrMul: 0.3, leafMul: 0.34, waterMul: 0.3, fogNMul: 0.75, sunOpMul: 0 },
    dawn:   { night: 0, exp: 0.98, skyTopT: 0x7f8fb0, skyTopA: 0.4, skyBotT: 0xf0c09a, skyBotA: 0.5, sunTint: 0xffd9a8, sunMul: 0.65, hemiMul: 0.8, fogT: 0xc0b4c8, fogA: 0.3, terrMul: 0.8, leafMul: 0.85, sunOpMul: 0.85 }
  };
  var curTime = 'noon', nightF = 0, targetNight = 0;
  var autoTime = true, hourNow = 9.4, lastHour = -1;
  var lastTB = { a: 'noon', b: 'noon', k: 0 };
  function presetTargets(t) {
    var d = SEASONS[curSeason];
    function c(baseHex, tintHex, amt, mul) {
      var c0 = new THREE.Color(baseHex);
      if (tintHex !== undefined) c0.lerp(new THREE.Color(tintHex), amt);
      if (mul !== undefined) c0.multiplyScalar(mul);
      return c0;
    }
    return {
      top: c(d.top, t.skyTopT, t.skyTopA), bot: c(d.bot, t.skyBotT, t.skyBotA),
      fog: c(d.fog, t.fogT, t.fogA), hemi: d.hemi * (t.hemiMul || 1), sunI: d.sunI * (t.sunMul || 1),
      terr: c(d.terr, undefined, undefined, t.terrMul), leaf: c(d.leaf, undefined, undefined, t.leafMul),
      path: c(d.path, undefined, undefined, t.terrMul), waterA: c(d.waterA, undefined, undefined, t.waterMul),
      waterB: c(d.waterB, undefined, undefined, t.waterMul), cloud: c(d.cloud, undefined, undefined, t.terrMul || 1),
      fogN: d.fogN * (t.fogNMul || 1), fogF: d.fogF * (t.fogNMul || 1), sunOp: d.sunOp * (t.sunOpMul === undefined ? 1 : t.sunOpMul),
      sunColor: t.sunTint ? new THREE.Color(t.sunTint) : new THREE.Color(0xfff2dd),
      night: t.night
    };
  }
  function computeTargets(tA, tB, k) {
    if (k === undefined) { tB = tA; k = 0; }
    if (tA) lastTB = { a: tA, b: tB, k: k };
    var A = presetTargets(TIMES[(tA || curTime)]), B = presetTargets(TIMES[(tB || tA || curTime)]);
    function mixN(a, b) { return a + (b - a) * k; }
    function mixC(a, b) { return a.clone().lerp(b, k); }
    SNt = {
      top: mixC(A.top, B.top), bot: mixC(A.bot, B.bot),
      fog: mixC(A.fog, B.fog), hemi: mixN(A.hemi, B.hemi), sunI: mixN(A.sunI, B.sunI),
      terr: mixC(A.terr, B.terr), leaf: mixC(A.leaf, B.leaf),
      path: mixC(A.path, B.path), waterA: mixC(A.waterA, B.waterA),
      waterB: mixC(A.waterB, B.waterB), cloud: mixC(A.cloud, B.cloud),
      fogN: mixN(A.fogN, B.fogN), fogF: mixN(A.fogF, B.fogF), sunOp: mixN(A.sunOp, B.sunOp),
      sunColor: mixC(A.sunColor, B.sunColor),
      night: mixN(A.night, B.night)
    };
    targetNight = SNt.night;
    SC.t = 0;
  }
  function applyTime(name) {
    curTime = name;
    autoTime = false;
    var H = { night: 0, dawn: 6, noon: 12, sunset: 18 };
    hourNow = H[name] !== undefined ? H[name] : hourNow;
    computeTargets(name, name, 0);
  }
  function setAutoTime(on) {
    autoTime = !!on;
    if (autoTime) lastHour = -1;
  }
  /* continuous day/night clock: one full day in ~7 minutes */
  var HOUR_SEGS = [[0, 'night'], [6, 'dawn'], [12, 'noon'], [18, 'sunset'], [24, 'night']];
  function advanceClock(dt) {
    if (!autoTime) return;
    hourNow = (hourNow + dt / 17.5) % 24;
    if (M.abs(hourNow - lastHour) < 0.06) return;
    lastHour = hourNow;
    for (var i = 0; i < HOUR_SEGS.length - 1; i++) {
      if (hourNow >= HOUR_SEGS[i][0] && hourNow < HOUR_SEGS[i + 1][0]) {
        var k = (hourNow - HOUR_SEGS[i][0]) / (HOUR_SEGS[i + 1][0] - HOUR_SEGS[i][0]);
        var kk = k * k * (3 - 2 * k);
        computeTargets(HOUR_SEGS[i][1], HOUR_SEGS[i + 1][1], kk);
        curTime = kk < 0.5 ? HOUR_SEGS[i][1] : HOUR_SEGS[i + 1][1];
        return;
      }
    }
  }
  function applySeason(name) {
    curSeason = name;
    var d = SEASONS[name];
    computeTargets(lastTB.a, lastTB.b, lastTB.k);
    flowers.forEach(function (f) { f.visible = d.flowers; });
    butterflies.forEach(function (b) { b.visible = d.butterflies; });
    umbrellaOn = d.umbrella;
    lightningOn = d.lightning;
    for (var i = 0; i < seasonCallbacks.length; i++) seasonCallbacks[i](name, d);
    AudioSys.setSeason(name);
  }
  function setButterflyAnchors(anchorList) {
    /* each butterfly claims one flower; they drift between them over time */
    if (!anchorList || !anchorList.length) return;
    butterflies.forEach(function (bf) {
      bf.userData.anchors = anchorList;
      bf.userData.ai = M.floor(M.random() * anchorList.length);
      bf.userData.tSwitch = 2 + M.random() * 8;
    });
  }

  var droplets = null, dropVel = null;
  function buildDroplets() {
    var N = 42;
    var pos = new Float32Array(N * 3);
    dropVel = [];
    for (var i = 0; i < N; i++) {
      pos[i * 3] = 12.5 + (M.random() - 0.5) * 1.4;
      pos[i * 3 + 1] = -0.1 + M.random() * 2.2;
      pos[i * 3 + 2] = 2.0 + (M.random() - 0.5) * 0.8;
      dropVel.push({ x: (M.random() - 0.5) * 2.2, y: 0.6 + M.random() * 1.8, z: -M.random() * 1.6 });
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: 0xd7ecf5, size: 0.055, transparent: true, opacity: 0.85, sizeAttenuation: true });
    droplets = new THREE.Points(geo, mat);
    droplets.frustumCulled = false;
    scene.add(droplets);
  }
  function tickDroplets(dt) {
    if (!droplets) return;
    var p = droplets.geometry.attributes.position.array;
    for (var i = 0; i < dropVel.length; i++) {
      dropVel[i].y -= 6.5 * dt;
      p[i * 3] += dropVel[i].x * dt;
      p[i * 3 + 1] += dropVel[i].y * dt;
      p[i * 3 + 2] += dropVel[i].z * dt;
      if (p[i * 3 + 1] < -0.35) {
        p[i * 3] = 12.5 + (M.random() - 0.5) * 1.4;
        p[i * 3 + 1] = 1.4 + M.random() * 1.2;
        p[i * 3 + 2] = 2.0 + (M.random() - 0.5) * 0.8;
        dropVel[i].x = (M.random() - 0.5) * 2.2;
        dropVel[i].y = 0.6 + M.random() * 1.8;
        dropVel[i].z = -M.random() * 1.6;
      }
    }
    droplets.geometry.attributes.position.needsUpdate = true;
  }

  function tickSeason(dt, tSec) {
    if (SNt && SC.t < 1) {
      SC.t = M.min(1, SC.t + dt / 1.2);
      var e = SC.t * SC.t * (3 - 2 * SC.t);
      skyMat.uniforms.topColor.value.lerp(SNt.top, e);
      skyMat.uniforms.bottomColor.value.lerp(SNt.bot, e);
      scene.fog.color.lerp(SNt.fog, e);
      terrain.material.color.lerp(SNt.terr, e);
      treeMats.leaf.color.lerp(SNt.leaf, e);
      for (var i = 0; i < bushes.length; i++) bushes[i].material.color.lerp(SNt.leaf, e);
      if (pathMat) pathMat.color.lerp(SNt.path, e);
      pondUniforms.uColorA.value.lerp(SNt.waterA, e);
      pondUniforms.uColorB.value.lerp(SNt.waterB, e);
      for (var ci = 0; ci < clouds.length; ci++) clouds[ci].children[0].material.color.lerp(SNt.cloud, e);
      scene.fog.near = lerp(scene.fog.near, SNt.fogN, e);
      scene.fog.far = lerp(scene.fog.far, SNt.fogF, e);
      hemi.intensity = lerp(hemi.intensity, SNt.hemi, e);
      sun.intensity = lerp(sun.intensity, SNt.sunI, e);
      sun.color.lerp(SNt.sunColor, e);
      sunMesh.material.opacity = lerp(sunMesh.material.opacity, SNt.sunOp, e);
      sunHalo.material.opacity = lerp(sunHalo.material.opacity, SNt.sunOp * 0.24, e);
    }
    tickDroplets(dt);
    if (water) {
      var dS = SEASONS[curSeason];
      waterBase.setHex(dS.waterA).multiplyScalar(0.55).lerp(DEEP_COLOR, 0.35);
      water.material.uniforms.waterColor.value.copy(waterBase).multiplyScalar(1 - nightF * 0.7);
    }
    advanceClock(dt);
    nightF = lerp(nightF, targetNight, M.min(1, dt / 2.2));
    renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, TIMES[curTime].exp, M.min(1, dt / 1.5));
    if (stars) { stars.material.opacity = nightF * 0.9; stars.visible = nightF > 0.02; }
    if (moonMesh) { moonMesh.material.opacity = nightF * 0.95; moonMesh.visible = nightF > 0.02; }
    if (fflies) {
      fflies.visible = nightF > 0.03;
      fflies.material.opacity = nightF;
      if (fflies.visible) {
        var fp = fflies.geometry.attributes.position;
        for (var fi = 0; fi < fp.count; fi++) {
          fp.setY(fi, ffBase[fi].y + M.sin(tSec * 1.9 + fi * 2.1) * 0.35);
          fp.setX(fi, ffBase[fi].x + M.sin(tSec * 0.31 + fi * 1.3) * 0.6);
        }
        fp.needsUpdate = true;
      }
    }
    var d = SEASONS[curSeason];
    flowers.forEach(function (f) { f.visible = d.flowers && nightF < 0.55; });
    butterflies.forEach(function (b) { b.visible = d.butterflies && nightF < 0.55; });
    rain.visible = d.rain > 0;
    snow.visible = d.snow > 0;
    if (rain.visible) {
      var rp = rain.geometry.attributes.position;
      for (var ri = 0; ri < rp.count; ri++) {
        var ry = rp.getY(ri) - dt * 24;
        if (ry < 0) ry = 26;
        rp.setY(ri, ry);
      }
      rp.needsUpdate = true;
    }
    if (snow.visible) {
      var sp = snow.geometry.attributes.position;
      for (var si = 0; si < sp.count; si++) {
        var sy = sp.getY(si) - dt * 2.6;
        if (sy < 0) sy = 26;
        sp.setY(si, sy);
        sp.setX(si, sp.getX(si) + M.sin(tSec * 0.8 + si) * dt * 0.4);
      }
      sp.needsUpdate = true;
    }
    if (lightningOn) {
      flashT -= dt;
      if (flashT <= 0 && M.random() < dt * 0.14) {
        flashT = 0.16 + M.random() * 0.1;
        AudioSys.thunder();
      }
      hemi.intensity = flashT > 0.1 ? 1.7 : SEASONS.monsoon.hemi;
    }
    for (var sri = 0; sri < splashRings.length; sri++) {
      var sr = splashRings[sri];
      var sph = (tSec * 0.5 + sr.userData.ph) % 2;
      sr.scale.setScalar(0.6 + sph * 0.9);
      sr.material.opacity = 0.45 * (1 - sph / 2);
    }
    for (var c2 = 0; c2 < clouds.length; c2++) {
      var cl = clouds[c2];
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 120) cl.position.x = -120;
    }
    pondUniforms.uTime.value = tSec;
    if (water) water.material.uniforms.time.value += dt * 0.55;
    if (wfUniforms) {
      wfUniforms.uTime.value = tSec;
      if (mist) {
        var mp = mist.geometry.attributes.position;
        for (var mi = 0; mi < mp.count; mi++) {
          var my = mp.getY(mi) + dt * 0.55;
          if (my > 3.4) { my = 0.2; mp.setX(mi, (M.random() - 0.5) * 1.8); }
          mp.setY(mi, my);
        }
        mp.needsUpdate = true;
      }
    }
    if (campfire) {
      campfire.light.intensity = (1.15 + M.sin(tSec * 11.3) * 0.22 + M.sin(tSec * 7.1) * 0.18) * (0.65 + nightF * 0.85);
      campfire.f1.scale.set(1 + M.sin(tSec * 9.7) * 0.12, 1 + M.sin(tSec * 13.1) * 0.16, 1);
      campfire.f2.scale.set(1 + M.sin(tSec * 8.3 + 2) * 0.14, 1 + M.sin(tSec * 12.2 + 1) * 0.18, 1);
      campfire.f1.material.opacity = 0.85 + M.sin(tSec * 15.7) * 0.12;
      campfire.f2.material.opacity = 0.7 + M.sin(tSec * 14.1 + 1) * 0.12;
      var sm = campfire.smoke.geometry.attributes.position;
      for (var si2 = 0; si2 < sm.count; si2++) {
        var sy2 = sm.getY(si2) + dt * 0.75;
        if (sy2 > 4.5) { sy2 = 0.1; sm.setX(si2, (M.random() - 0.5) * 0.2); sm.setZ(si2, (M.random() - 0.5) * 0.2); }
        sm.setY(si2, sy2);
        sm.setX(si2, sm.getX(si2) + M.sin(tSec * 0.8 + si2) * dt * 0.22);
      }
      sm.needsUpdate = true;
    }
    for (var b2 = 0; b2 < butterflies.length; b2++) {
      var bf = butterflies[b2];
      if (!bf.visible) continue;
      var u = bf.userData;
      var a = tSec * u.sp + u.ph;
      if (u.anchors && u.anchors.length) {
        /* anchored: hovers around one flower, occasionally drifts to the next */
        u.tSwitch -= dt;
        if (u.tSwitch <= 0) { u.ai = M.floor(M.random() * u.anchors.length); u.tSwitch = 4 + M.random() * 6; u.cx = null; }
        var tgt = u.anchors[u.ai];
        if (u.cx === null || u.cx === undefined) { u.cx = bf.position.x; u.cz = bf.position.z; }
        u.cx += (tgt.x - u.cx) * M.min(1, dt * 0.5);
        u.cz += (tgt.z - u.cz) * M.min(1, dt * 0.5);
        var rr = 0.28;
        bf.position.set(u.cx + M.cos(a * 1.4) * rr, W.terrainHeight(u.cx, u.cz) + u.h * 0.55 + M.sin(tSec * 2.2 + u.ph) * 0.12, u.cz + M.sin(a * 1.4) * rr);
      } else {
        bf.position.set(u.cx + M.cos(a) * u.r, u.h + M.sin(tSec * 2.2 + u.ph) * 0.25, u.cz + M.sin(a * 1.3) * u.r);
      }
      var flap = M.sin(tSec * 18 + u.ph) * 1.05;
      u.wl.rotation.y = flap;
      u.wr.rotation.y = -flap;
      bf.rotation.y = -a + PI / 2;
    }
  }

  /* ---------- audio (all synthesized, no files) ---------- */
  var AudioSys = (function () {
    var ctx = null, master = null, rainG = null, windG = null, enabled = true, noiseBuf = null, started = false;
    function makeNoise() {
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = M.random() * 2 - 1;
      return buf;
    }
    var wfG = null;
    var padOsc = [], padG = null, padChord = 0, padTimer = 0;
    var CHORDS = [[110, 130.81, 164.81], [87.31, 110, 130.81], [98, 123.47, 146.83], [110, 138.59, 164.81]];
    function initPad() {
      padG = ctx.createGain();
      padG.gain.value = 0;
      var padFilt = ctx.createBiquadFilter();
      padFilt.type = 'lowpass'; padFilt.frequency.value = 760; padFilt.Q.value = 0.4;
      padG.connect(master);
      padFilt.connect(padG);
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = CHORDS[0][i];
        var og = ctx.createGain();
        og.gain.value = 0.33;
        o.connect(og); og.connect(padFilt);
        o.start();
        padOsc.push(o);
      }
      // slow breathing on the filter for movement
      var lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.05;
      var lfo2g = ctx.createGain();
      lfo2g.gain.value = 240;
      lfo2.connect(lfo2g); lfo2g.connect(padFilt.frequency);
      lfo2.start();
    }
    function tickPad(dt) {
      if (!padOsc.length) return;
      padTimer += dt;
      if (padTimer > 26) {
        padTimer = 0;
        padChord = (padChord + 1) % CHORDS.length;
        var t2 = ctx.currentTime;
        for (var i = 0; i < padOsc.length; i++) {
          padOsc[i].frequency.cancelScheduledValues(t2);
          padOsc[i].frequency.setValueAtTime(padOsc[i].frequency.value, t2);
          padOsc[i].frequency.linearRampToValueAtTime(CHORDS[padChord][i], t2 + 7);
        }
      }
    }
    function setPadLevel(level) {
      if (!padG) return;
      try { padG.gain.linearRampToValueAtTime(enabled ? level : 0, ctx.currentTime + 2.5); } catch (e) {}
    }
    function init() {
      if (started || !enabled) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        noiseBuf = makeNoise();
        // rain layer
        var rainSrc = ctx.createBufferSource();
        rainSrc.buffer = noiseBuf; rainSrc.loop = true;
        var rainFilt = ctx.createBiquadFilter();
        rainFilt.type = 'bandpass'; rainFilt.frequency.value = 1900; rainFilt.Q.value = 0.45;
        rainG = ctx.createGain(); rainG.gain.value = 0;
        rainSrc.connect(rainFilt); rainFilt.connect(rainG); rainG.connect(master);
        rainSrc.start();
        // wind layer
        var windSrc = ctx.createBufferSource();
        windSrc.buffer = noiseBuf; windSrc.loop = true;
        var windFilt = ctx.createBiquadFilter();
        windFilt.type = 'lowpass'; windFilt.frequency.value = 320;
        windG = ctx.createGain(); windG.gain.value = 0.05;
        windSrc.connect(windFilt); windFilt.connect(windG); windG.connect(master);
        windSrc.start();
        // waterfall layer (spatial: level driven from the game loop)
        var wfSrc = ctx.createBufferSource();
        wfSrc.buffer = noiseBuf; wfSrc.loop = true;
        var wfFilt = ctx.createBiquadFilter();
        wfFilt.type = 'bandpass'; wfFilt.frequency.value = 480; wfFilt.Q.value = 0.55;
        wfG = ctx.createGain(); wfG.gain.value = 0;
        wfSrc.connect(wfFilt); wfFilt.connect(wfG); wfG.connect(master);
        wfSrc.start();
        // slow wind swell
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        var lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
        lfo.connect(lfoG); lfoG.connect(windG.gain);
        lfo.start();
        started = true;
        initPad();
        setPadLevel(0.045);
        setSeason(curSeason);
      } catch (e) { ctx = null; }
    }
    function setSeason(name) {
      if (!ctx || !started) return;
      var d = SEASONS[name];
      try {
        var t = ctx.currentTime;
        rainG.gain.linearRampToValueAtTime(enabled ? d.rainAudio : 0, t + 1.2);
        windG.gain.linearRampToValueAtTime(enabled ? d.windAudio : 0, t + 1.2);
      } catch (e) {}
    }
    function thunder() {
      if (!ctx || !started || !enabled) return;
      try {
        var t = ctx.currentTime;
        var src = ctx.createBufferSource();
        src.buffer = noiseBuf; src.loop = true;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 130;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.55, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t); src.stop(t + 2.3);
      } catch (e) {}
    }
    function setEnabled(on) {
      enabled = on;
      if (ctx && started) {
        var t = ctx.currentTime;
        try {
          rainG.gain.linearRampToValueAtTime(on ? SEASONS[curSeason].rainAudio : 0, t + 0.4);
          windG.gain.linearRampToValueAtTime(on ? SEASONS[curSeason].windAudio : 0, t + 0.4);
        } catch (e) {}
      } else if (on) init();
    }
    function setWaterfall(level) {
      if (!ctx || !started || !wfG) return;
      try { wfG.gain.linearRampToValueAtTime(enabled ? level : 0, ctx.currentTime + 0.5); } catch (e) {}
    }
    function stepSnd(vol, wood) {
      if (!ctx || !started || !enabled) return;
      try {
        var t = ctx.currentTime;
        var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = wood ? 900 : 420; f.Q.value = 1.1;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(M.max(0.004, vol), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t); src.stop(t + 0.13);
      } catch (e) {}
    }
    function chirp() {
      if (!ctx || !started || !enabled) return;
      try {
        var t = ctx.currentTime, base = 1900 + M.random() * 900;
        var o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.linearRampToValueAtTime(base * 1.35, t + 0.07);
        o.frequency.linearRampToValueAtTime(base * 0.8, t + 0.16);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.22);
      } catch (e) {}
    }
    function ding(freq) {
      if (!ctx || !started || !enabled) return;
      try {
        var t = ctx.currentTime;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq || 660, t);
        o.frequency.exponentialRampToValueAtTime((freq || 660) * 1.5, t + 0.09);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.55);
      } catch (e) {}
    }
    return { init: init, setSeason: setSeason, thunder: thunder, setEnabled: setEnabled, ding: ding, isEnabled: function () { return enabled; },
      setWaterfall: setWaterfall, stepSnd: stepSnd, chirp: chirp, tickPad: tickPad, setPadLevel: setPadLevel };
  })();

  window.WORLD = {
    init: init, scene: null, renderer: null, camera: null,
    hemi: null, sun: null, sunMesh: null,
    terrainHeight: terrainHeight, trailPos: trailPos, TRAIL_LEN: TRAIL_LEN, TRAIL_Z0: TRAIL_Z0,
    SEASONS: SEASONS, applySeason: applySeason, tickSeason: tickSeason, setButterflyAnchors: setButterflyAnchors,
    applyTime: applyTime, nightFactor: function () { return nightF; }, timeName: function () { return autoTime ? 'auto' : curTime; },
    setAutoTime: setAutoTime, hour: function () { return hourNow; },
    umbrella: function () { return umbrella; }, umbrellaOn: function () { return umbrellaOn; },
    onSeason: function (cb) { seasonCallbacks.push(cb); },
    AudioSys: AudioSys,
    QUALITY: QUALITY, HQ: HQ,
    clouds: clouds, season: function () { return curSeason; },
    LAKE: LAKE
  };
})();
