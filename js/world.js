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

  function terrainNoise(x, z) {
    var h = 0;
    h += M.sin(x * 0.14) * M.cos(z * 0.11) * 1.5;
    h += M.sin(x * 0.05 + 1.7) * M.cos(z * 0.06) * 2.2;
    h *= 0.45;
    var dTrail = M.abs(x);
    if (dTrail < 6) h *= dTrail / 6;
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
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
      sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
      sun.shadow.camera.far = 90; sun.shadow.bias = -0.002;
    }
    scene.add(sun); scene.add(sun.target);
    window.WORLD.scene = scene;
    window.WORLD.renderer = renderer;
    window.WORLD.camera = camera;
    window.WORLD.hemi = hemi;
    window.WORLD.sun = sun;

    buildSky();
    buildTerrain();
    buildPath();
    buildPond();
    buildVegetation();
    buildWeather();

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
    var pond = new THREE.Mesh(new THREE.CircleGeometry(5.0, 48), pondMat);
    pond.rotation.x = -PI / 2;
    pond.position.set(7.5, 0.045, 2);
    scene.add(pond);
  }

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
      var px = x - 7.5, pz = z - 2; if (px * px + pz * pz < 8.5 * 8.5) continue;
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
        wl: wl, wr: wr
      };
      scene.add(grp);
      butterflies.push(grp);
    }
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
    summer:  { top: 0x5f9bd4, bot: 0xcfe4ee, fog: 0xbcd4e6, fogN: 60, fogF: 190, hemi: 0.85, sunI: 1.15, terr: 0xffffff, leaf: 0x4d7a35, path: 0xc9b48a, waterA: 0x3f7f9e, waterB: 0x7ec2d6, flowers: true, butterflies: true, rain: 0, snow: 0, sunOp: 0.95, lightning: false, umbrella: false, cloud: 0xffffff, top_tint: 0xffffff, bottom_tint: 0xffffff, rainAudio: 0, windAudio: 0.05 },
    rainy:   { top: 0x5c7085, bot: 0x9fb0ba, fog: 0x8d9dad, fogN: 30, fogF: 130, hemi: 0.72, sunI: 0.55, terr: 0xb9c9bb, leaf: 0x47703a, path: 0xb8a583, waterA: 0x3a6f8a, waterB: 0x6fa9c2, flowers: true, butterflies: false, rain: 260, snow: 0, sunOp: 0, lightning: false, umbrella: true, cloud: 0xb6c2cb, top_tint: 0x9db4c8, bottom_tint: 0x8d99a8, rainAudio: 0.16, windAudio: 0.1 },
    monsoon: { top: 0x46586b, bot: 0x8a98a2, fog: 0x74858f, fogN: 20, fogF: 95, hemi: 0.6, sunI: 0.38, terr: 0x9fb3a0, leaf: 0x3f6a3c, path: 0xa99879, waterA: 0x2f5f78, waterB: 0x5f95ae, flowers: true, butterflies: false, rain: 470, snow: 0, sunOp: 0, lightning: true, umbrella: true, cloud: 0x84929d, top_tint: 0x86a89a, bottom_tint: 0x7d8a95, rainAudio: 0.3, windAudio: 0.16 },
    winter:  { top: 0x93aaba, bot: 0xd8e2e8, fog: 0xc6d2dc, fogN: 40, fogF: 155, hemi: 0.8, sunI: 0.75, terr: 0xe2e8ea, leaf: 0x9fb4a8, path: 0xd9d3c6, waterA: 0x5b7d94, waterB: 0x9fc4d4, flowers: false, butterflies: false, rain: 0, snow: 320, sunOp: 0.75, lightning: false, umbrella: false, cloud: 0xf2f5f8, top_tint: 0xb9c6d8, bottom_tint: 0xa8b2c0, rainAudio: 0, windAudio: 0.12 }
  };
  var curSeason = 'summer';
  var SNt = null, SC = { t: 1 };
  var seasonCallbacks = [];
  function applySeason(name) {
    curSeason = name;
    var d = SEASONS[name];
    SNt = {
      top: new THREE.Color(d.top), bot: new THREE.Color(d.bot), fog: new THREE.Color(d.fog),
      hemi: d.hemi, sunI: d.sunI, terr: new THREE.Color(d.terr), leaf: new THREE.Color(d.leaf),
      path: new THREE.Color(d.path), waterA: new THREE.Color(d.waterA), waterB: new THREE.Color(d.waterB),
      cloud: new THREE.Color(d.cloud), fogN: d.fogN, fogF: d.fogF, sunOp: d.sunOp
    };
    SC.t = 0;
    flowers.forEach(function (f) { f.visible = d.flowers; });
    butterflies.forEach(function (b) { b.visible = d.butterflies; });
    umbrellaOn = d.umbrella;
    lightningOn = d.lightning;
    for (var i = 0; i < seasonCallbacks.length; i++) seasonCallbacks[i](name, d);
    AudioSys.setSeason(name);
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
      sunMesh.material.opacity = lerp(sunMesh.material.opacity, SNt.sunOp, e);
      sunHalo.material.opacity = lerp(sunHalo.material.opacity, SNt.sunOp * 0.24, e);
    }
    var d = SEASONS[curSeason];
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
    for (var c2 = 0; c2 < clouds.length; c2++) {
      var cl = clouds[c2];
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 120) cl.position.x = -120;
    }
    pondUniforms.uTime.value = tSec;
    for (var b2 = 0; b2 < butterflies.length; b2++) {
      var bf = butterflies[b2];
      if (!bf.visible) continue;
      var u = bf.userData;
      var a = tSec * u.sp + u.ph;
      bf.position.set(u.cx + M.cos(a) * u.r, u.h + M.sin(tSec * 2.2 + u.ph) * 0.25, u.cz + M.sin(a * 1.3) * u.r);
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
        // slow wind swell
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        var lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
        lfo.connect(lfoG); lfoG.connect(windG.gain);
        lfo.start();
        started = true;
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
    return { init: init, setSeason: setSeason, thunder: thunder, setEnabled: setEnabled, isEnabled: function () { return enabled; } };
  })();

  window.WORLD = {
    init: init, scene: null, renderer: null, camera: null,
    hemi: null, sun: null, sunMesh: null,
    terrainHeight: terrainHeight, trailPos: trailPos, TRAIL_LEN: TRAIL_LEN, TRAIL_Z0: TRAIL_Z0,
    SEASONS: SEASONS, applySeason: applySeason, tickSeason: tickSeason,
    umbrella: function () { return umbrella; }, umbrellaOn: function () { return umbrellaOn; },
    onSeason: function (cb) { seasonCallbacks.push(cb); },
    AudioSys: AudioSys,
    QUALITY: QUALITY, HQ: HQ,
    clouds: clouds, season: function () { return curSeason; }
  };
})();
