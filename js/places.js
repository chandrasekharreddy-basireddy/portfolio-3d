/* places.js - physical content worlds: skills forest, project district,
   university campus, contact terminal, about camp props, secret dev room.
   Built procedurally from DATA (js/data.js). */
(function () {
  'use strict';
  var M = Math, PI = M.PI;
  var CRYSTALS = [], TREE = null, MAST_LIGHT = null, TERMINAL = null, DEVROOM = null, SIGNS = [];

  function labelTex(title, sub, w, h, bg, fg) {
    var c = document.createElement('canvas');
    c.width = w || 512; c.height = h || 160;
    var x = c.getContext('2d');
    x.fillStyle = bg || '#141d28'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(232,176,75,.55)'; x.lineWidth = 6; x.strokeRect(4, 4, c.width - 8, c.height - 8);
    x.fillStyle = fg || '#f2ead8';
    x.font = '600 ' + M.round(c.height * 0.24) + 'px Georgia';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(title, c.width / 2, sub ? c.height * 0.36 : c.height * 0.5);
    if (sub) {
      x.font = 'italic ' + M.round(c.height * 0.15) + 'px Georgia';
      x.fillStyle = '#a9c2d4';
      x.fillText(sub, c.width / 2, c.height * 0.72);
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function build(ctx) {
    var scene = ctx.scene, W = ctx.W, addInteract = ctx.addInteract, openCard = ctx.openCard,
      openProject = ctx.openProject, HQ = ctx.HQ, DATA = ctx.DATA, toast = ctx.toast, player = ctx.player;
    var SK = DATA.PORTFOLIO.skills;

    /* ============ SKILLS FOREST (west of the trail, z 8..24) ============ */
    var crystalGeo = new THREE.OctahedronGeometry(0.42, 0);
    var baseGeo = new THREE.CylinderGeometry(0.34, 0.42, 0.22, 7);
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x5d6670, roughness: 1, flatShading: true });
    var positions = [];
    for (var i = 0; i < SK.length; i++) {
      var side = i % 2 === 0 ? -1 : 1;
      var row = M.floor(i / 2);
      var cx = side * (3.1 + ((i * 37) % 10) / 10 * 3.4);
      var cz = 24 - row * 2.3 - ((i * 53) % 10) / 10 * 1.6;
      if (side > 0 && cx > 1.9) cx = 1.9; // keep the trail clear
      positions.push([cx, cz]);
    }
    SK.forEach(function (skill, i) {
      var col = new THREE.Color().setHSL((i * 0.618) % 1, 0.5, 0.55);
      var mat = new THREE.MeshStandardMaterial({
        color: col, roughness: 0.25, metalness: 0.15,
        emissive: col.clone().multiplyScalar(0.18), emissiveIntensity: 0.35
      });
      var grp = new THREE.Group();
      var base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.11;
      base.castShadow = HQ();
      var crystal = new THREE.Mesh(crystalGeo, mat);
      crystal.position.y = 0.85;
      crystal.castShadow = HQ();
      crystal.scale.set(1, 1.35, 1);
      // floating name label
      var lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.42),
        new THREE.MeshBasicMaterial({ map: labelTex(skill.name.toUpperCase(), null, 512, 128, 'rgba(10,16,24,.88)', '#e8dcc2'), transparent: true })
      );
      lbl.position.y = 1.9;
      grp.add(base, crystal, lbl);
      var px = positions[i][0], pz = positions[i][1];
      grp.position.set(px, W.terrainHeight(px, pz), pz);
      grp.rotation.y = ((i * 71) % 10) / 10 * PI * 2;
      scene.add(grp);
      var entry = { grp: grp, crystal: crystal, lbl: lbl, skill: skill, on: false, ph: (i * 1.7) % (PI * 2), pos: new THREE.Vector3(px, W.terrainHeight(px, pz) + 0.9, pz) };
      CRYSTALS.push(entry);
      addInteract({
        id: 'skill-' + i, label: 'INSPECT ' + skill.name.toUpperCase(),
        pos: new THREE.Vector3(px, W.terrainHeight(px, pz) + 0.9, pz), radius: 3.0,
        action: (function (C) {
          return function () {
            if (!C.on) {
              C.on = true;
              var el = document.getElementById('skillpop');
              if (el) {
                el.querySelector('.sp-name').textContent = C.skill.name.toUpperCase();
                el.querySelector('.sp-desc').textContent = C.skill.desc;
                el.classList.add('on');
                clearTimeout(el._t);
                el._t = setTimeout(function () { el.classList.remove('on'); }, 4600);
              }
              var cnt = document.getElementById('skillcount');
              if (cnt) cnt.textContent = 'Skills discovered in the world: ' + CRYSTALS.filter(function (c) { return c.on; }).length + ' / ' + CRYSTALS.length;
              try { window.WORLD && window.WORLD.AudioSys.ding(560 + (C.ph % 6) * 55); } catch (e) {}
            }
          };
        })(entry)
      });
    });

    /* ============ HOLOGRAPHIC SKILL TREE (skills station overlook) ============ */
    (function () {
      var tx = -6.8, tz = 14.2, ty = W.terrainHeight(tx, tz);
      var g = new THREE.Group();
      var nodeGeo = new THREE.SphereGeometry(0.09, 10, 8);
      var lineMat = new THREE.LineBasicMaterial({ color: 0x69d2ff, transparent: true, opacity: 0.55 });
      var nodeMatA = new THREE.MeshBasicMaterial({ color: 0x69d2ff });
      var nodeMatB = new THREE.MeshBasicMaterial({ color: 0xe8b04b });
      // tree structure: core -> five real groups -> leaves (all real skills)
      var nodes = [
        { n: 'CORE CS', c: [0, 1.95, 0], m: nodeMatB, big: 1 },
        { n: 'PROGRAMMING', c: [-1.35, 1.15, 0.1], m: nodeMatB },
        { n: 'WEB', c: [-0.55, 1.15, -0.62], m: nodeMatB },
        { n: 'BACKEND', c: [0.35, 1.15, -0.55], m: nodeMatB },
        { n: 'FULL STACK', c: [1.2, 1.15, 0.1], m: nodeMatB },
        { n: 'DATA / AUTO', c: [1.65, 1.15, 0.85], m: nodeMatB },
        { n: 'C', c: [-1.75, 0.42, -0.35], m: nodeMatA },
        { n: 'Python', c: [-1.45, 0.42, 0.45], m: nodeMatA },
        { n: 'JavaScript', c: [-0.75, 0.42, -0.35], m: nodeMatA },
        { n: 'HTML', c: [-0.35, 0.42, -1.05], m: nodeMatA },
        { n: 'CSS', c: [0.1, 0.42, -0.6], m: nodeMatA },
        { n: 'FastAPI', c: [0.05, 0.42, 0.35], m: nodeMatA },
        { n: 'PostgreSQL', c: [0.75, 0.42, -0.15], m: nodeMatA },
        { n: 'Redis', c: [1.25, 0.42, 0.55], m: nodeMatA },
        { n: 'Next.js', c: [1.6, 0.42, -0.35], m: nodeMatA },
        { n: 'TypeScript', c: [1.95, 0.42, 0.4], m: nodeMatA },
        { n: 'Power BI', c: [2.15, 0.42, 1.25], m: nodeMatA },
        { n: 'n8n', c: [1.35, 0.42, 1.35], m: nodeMatA },
        { n: 'DSA', c: [-2.35, 0.42, 0.35], m: nodeMatA },
        { n: 'Git', c: [-2.1, 1.15, 0.85], m: nodeMatA }
      ];
      var links = [
        [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 19],
        [1, 6], [1, 7], [2, 8], [2, 9], [2, 10], [3, 11], [3, 12], [3, 13], [4, 14], [4, 15], [5, 16], [5, 17], [1, 18]
      ];
      nodes.forEach(function (nd) {
        var m = new THREE.Mesh(nodeGeo, nd.m);
        m.position.set(nd.c[0], nd.c[1], nd.c[2]);
        g.add(m);
        var l = new THREE.Mesh(new THREE.PlaneGeometry(nd.big ? 1.15 : 0.95, nd.m === nodeMatB ? 0.24 : 0.2),
          new THREE.MeshBasicMaterial({ map: labelTex(nd.n, null, 512, 96, 'rgba(10,18,28,.5)', nd.m === nodeMatB ? '#ffd98a' : '#bfe7ff'), transparent: true }));
        l.position.set(nd.c[0], nd.c[1] + (nd.big ? 0.3 : 0.24), nd.c[2]);
        g.add(l);
      });
      links.forEach(function (lk) {
        var a = new THREE.Vector3(nodes[lk[0]].c[0], nodes[lk[0]].c[1], nodes[lk[0]].c[2]);
        var b = new THREE.Vector3(nodes[lk[1]].c[0], nodes[lk[1]].c[1], nodes[lk[1]].c[2]);
        var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        g.add(new THREE.Line(geo, lineMat));
      });
      g.position.set(tx, ty + 0.1, tz);
      g.scale.set(1.25, 1.15, 1.25);
      scene.add(g);
      TREE = { grp: g, ph: 0 };
      addInteract({
        id: 'skilltree', label: 'STUDY THE SKILL TREE', pos: new THREE.Vector3(tx, ty + 1, tz), radius: 3.4,
        action: function () { openCard('skills'); toast('The tree grows as the skills do'); }
      });
    })();

    /* ============ PROJECT DISTRICT (west side, z -11..2) ============ */
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 0.9, flatShading: true });
    var wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc5b2, roughness: 0.95 });
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x4d5a66, roughness: 0.85 });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.9 });

    function building(x, z, w, h, d, title, sub, accent) {
      var gy = W.terrainHeight(x, z);
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h / 2 + 0.3;
      body.castShadow = body.receiveShadow = HQ();
      var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.22, d + 0.5), roofMat);
      roof.position.y = h + 0.41;
      var plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.35, d + 0.7), trimMat);
      plinth.position.y = 0.18;
      g.add(body, roof, plinth);
      // columns
      for (var c = -1; c <= 1; c++) {
        var col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, h * 0.55, 7), trimMat);
        col2.position.set(c * (w / 2 - 0.55), h * 0.275 + 0.3, d / 2 + 0.14);
        col2.castShadow = HQ();
        g.add(col2);
      }
      // sign
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, w * 0.24),
        new THREE.MeshBasicMaterial({ map: labelTex(title, sub, 640, 160, '#10161f', accent || '#ffd98a') }));
      sign.position.set(0, h + 0.75, d / 2 + 0.16);
      g.add(sign);
      SIGNS.push(sign);
      g.position.set(x, gy, z);
      scene.add(g);
      return g;
    }

    // P01 Survival School - school/lab building
    building(-9.2, -7.0, 4.6, 2.6, 3.2, 'SURVIVAL SCHOOL', 'MCQ learning platform · FastAPI · Next.js');
    addInteract({
      id: 'p01', label: 'EXPLORE SURVIVAL SCHOOL', pos: new THREE.Vector3(-9.2, W.terrainHeight(-9.2, -5.2), -5.2), radius: 3.8,
      action: function () { openProject('survival-school'); }
    });
    // P02 Signal-Lite - communication mast
    (function () {
      var mx = -11.8, mz = -1.2, my = W.terrainHeight(mx, mz);
      var g = new THREE.Group();
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.22, 6.4, 6), trimMat);
      mast.position.y = 3.5;
      mast.castShadow = HQ();
      g.add(mast);
      for (var dI = 0; dI < 2; dI++) {
        var dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8, 0, PI * 2, 0, PI / 2.4), stoneMat);
        dish.material = new THREE.MeshStandardMaterial({ color: 0xd9dee4, roughness: 0.6, side: THREE.DoubleSide });
        dish.position.set(0.34 + dI * 0.28, 3.4 + dI * 1.25, 0);
        dish.rotation.y = 1.15;
        dish.rotation.x = PI * 0.62;
        g.add(dish);
      }
      var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
      beacon.position.y = 6.85;
      g.add(beacon);
      MAST_LIGHT = beacon;
      var guy1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.4, 4), trimMat);
      guy1.position.set(-0.8, 1.6, 0); guy1.rotation.z = 0.46; g.add(guy1);
      var guy2 = guy1.clone(); guy2.position.x = 0.8; guy2.rotation.z = -0.46; g.add(guy2);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.56),
        new THREE.MeshBasicMaterial({ map: labelTex('SIGNAL-LITE', 'secure real-time messaging', 640, 160) }));
      sign.position.set(0, 1.1, 0.35);
      g.add(sign);
      SIGNS.push(sign);
      g.position.set(mx, my, mz);
      scene.add(g);
      addInteract({
        id: 'p02', label: 'EXPLORE SIGNAL-LITE', pos: new THREE.Vector3(mx, my + 1, mz), radius: 3.6,
        action: function () { openProject('signal-lite'); }
      });
    })();
    // P03 SaiU V2 - campus block
    (function () {
      var sx = -8.6, sz = 2.8, sy = W.terrainHeight(sx, sz);
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 3.0), wallMat);
      body.position.y = 1.25; body.castShadow = body.receiveShadow = HQ();
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x3d6a7d, roughness: 0.15, metalness: 0.4 }));
      glass.position.set(0, 1.32, 1.51);
      var toproof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 3.4), roofMat);
      toproof.position.y = 2.3;
      var ac = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), trimMat);
      ac.position.set(1.2, 2.56, -0.4);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9),
        new THREE.MeshBasicMaterial({ map: labelTex('SAIU V2 — STUDENT OS', 'offline-first campus PWA', 640, 160) }));
      sign.position.set(0, 3.1, 0.1);
      SIGNS.push(sign);
      g.add(body, glass, toproof, ac, sign);
      g.position.set(sx, sy, sz);
      scene.add(g);
      addInteract({
        id: 'p03', label: 'EXPLORE SAIU V2', pos: new THREE.Vector3(sx, sy + 1, sz + 1.8), radius: 3.6,
        action: function () { openProject('saiu-v2'); }
      });
    })();
    // P04 reserved plot
    (function () {
      var px2 = -7.2, pz2 = -12.0, py = W.terrainHeight(px2, pz2);
      var g = new THREE.Group();
      var slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 3.0), trimMat);
      slab.position.y = 0.1;
      g.add(slab);
      for (var c2 = -1; c2 <= 1; c2 += 2) {
        for (var c3 = -1; c3 <= 1; c3 += 2) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), trimMat);
          post.position.set(c2 * 1.6, 0.62, c3 * 1.3);
          g.add(post);
        }
      }
      var rope = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.014, 4, 40), new THREE.MeshBasicMaterial({ color: 0xe8b04b }));
      rope.rotation.x = PI / 2;
      rope.scale.set(1.6, 1.3, 1);
      rope.position.y = 0.86;
      g.add(rope);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6),
        new THREE.MeshBasicMaterial({ map: labelTex('P04 · NEXT BUILD', 'spot reserved', 512, 128) }));
      sign.position.set(0, 1.35, 0);
      SIGNS.push(sign);
      g.position.set(px2, py, pz2);
      scene.add(g);
      addInteract({
        id: 'p04', label: 'READ THE RESERVED PLOT', pos: new THREE.Vector3(px2, py + 1, pz2), radius: 3.2,
        action: function () { openProject('next'); }
      });
    })();

    /* ============ UNIVERSITY CAMPUS (education station, z ~ -17) ============ */
    (function () {
      var ux = -8.9, uz = -17.6, uy = W.terrainHeight(ux, uz);
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 3.4), wallMat);
      body.position.y = 1.4; body.castShadow = body.receiveShadow = HQ();
      var pediment = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.15, 4), roofMat);
      pediment.rotation.y = PI / 4;
      pediment.scale.set(1.05, 1, 0.72);
      pediment.position.y = 3.05;
      pediment.castShadow = HQ();
      g.add(body, pediment);
      for (var c = -2; c <= 2; c++) {
        var col3 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.9, 7), trimMat);
        col3.position.set(c * 1.05, 1.25, 1.85);
        col3.castShadow = HQ();
        g.add(col3);
      }
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.0),
        new THREE.MeshBasicMaterial({ map: labelTex('SAI UNIVERSITY', 'B.Tech Computer Science · CGPA 9.33', 640, 160) }));
      sign.position.set(0, 4.0, 0.2);
      SIGNS.push(sign);
      g.add(sign);
      // flag pole
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 4.6, 6), trimMat);
      pole.position.set(3.0, 2.3, 0);
      g.add(pole);
      var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.62),
        new THREE.MeshBasicMaterial({ map: labelTex('CS', null, 256, 160, '#e8b04b', '#10161f'), side: THREE.DoubleSide }));
      flag.position.set(3.58, 4.2, 0);
      g.add(flag);
      SIGNS.push(flag);
      g.position.set(ux, uy, uz);
      g.rotation.y = 0.32;
      scene.add(g);
      // school stones (Class X / XII)
      [['CLASS X · BHASHYAM HIGH SCHOOL · 560/600', -6.6, -14.4], ['CLASS XII · BHASHYAM JR COLLEGE · 975/1000', -10.6, -21.0]].forEach(function (s2) {
        var gy = W.terrainHeight(s2[1], s2[2]);
        var stone = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.28), stoneMat);
        stone.position.set(s2[1], gy + 0.45, s2[2]);
        stone.rotation.y = 1.2;
        stone.castShadow = HQ();
        scene.add(stone);
        var plq = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.72),
          new THREE.MeshBasicMaterial({ map: labelTex(s2[0], null, 640, 128) }));
        plq.position.set(0, 0, 0.15);
        stone.add(plq);
      });
      addInteract({
        id: 'univ', label: 'VISIT THE UNIVERSITY', pos: new THREE.Vector3(ux, uy + 1.4, uz + 1.6), radius: 4.2,
        action: function () { openCard('education'); toast('Sai University · Computer Science'); }
      });
    })();

    /* ============ CONTACT TERMINAL (end of the trail) ============ */
    (function () {
      var tx = -2.6, tz = -30.6, ty = W.terrainHeight(tx, tz);
      var g = new THREE.Group();
      var ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), trimMat);
      ped.position.y = 0.53;
      ped.castShadow = HQ();
      var frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.8, 0.07), new THREE.MeshStandardMaterial({ color: 0x232c36, roughness: 0.7 }));
      frame.position.set(0, 1.32, 0.08);
      frame.rotation.x = -0.5;
      var screenCv = document.createElement('canvas');
      screenCv.width = 256; screenCv.height = 160;
      var scx = screenCv.getContext('2d');
      var screenTex = new THREE.CanvasTexture(screenCv);
      var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.66),
        new THREE.MeshBasicMaterial({ map: screenTex }));
      screen.position.set(0, 1.32, 0.125);
      screen.rotation.x = -0.5;
      g.add(ped, frame, screen);
      g.position.set(tx, ty, tz);
      g.rotation.y = -0.5;
      scene.add(g);
      TERMINAL = { cv: screenCv, cx: scx, tex: screenTex, t: 0 };
      addInteract({
        id: 'contact-terminal', label: 'USE THE CONTACT TERMINAL', pos: new THREE.Vector3(tx, ty + 1, tz), radius: 2.8,
        action: function () { openCard('contact'); toast('The terminal hums quietly'); }
      });
    })();

    /* ============ ABOUT CAMP: desk + laptop + ID card ============ */
    (function () {
      var dx = -10.3, dz = 28.6, dy = W.terrainHeight(dx, dz);
      var g = new THREE.Group();
      var top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.75), new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }));
      top.position.y = 0.62;
      for (var l = -1; l <= 1; l += 2) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x63472c, roughness: 1 }));
        leg.position.set(l * 0.65, 0.3, 0);
        g.add(leg);
      }
      var base2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.38), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.5 }));
      base2.position.set(-0.32, 0.685, 0);
      var lid = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.03), new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.5 }));
      lid.position.set(-0.32, 0.86, -0.185); lid.rotation.x = -0.32;
      var code = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshBasicMaterial({ map: labelTex('> npm run build', '> three.js world', 400, 200, '#0a141c', '#7fd08a') }));
      code.position.set(-0.32, 0.865, -0.168); code.rotation.x = -0.32;
      var idcard = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.21),
        new THREE.MeshBasicMaterial({ map: labelTex('CHANDRA S. REDDY', 'SAI UNIVERSITY · B.TECH CSE', 480, 300, '#e8e2d2', '#1a2430') }));
      idcard.rotation.x = -PI / 2;
      idcard.position.set(0.28, 0.672, 0.08);
      idcard.rotation.z = 0.35;
      g.add(top, base2, lid, code, idcard);
      g.position.set(dx, dy, dz);
      g.rotation.y = 0.7;
      scene.add(g);
      addInteract({
        id: 'idcard', label: 'READ THE ID CARD', pos: new THREE.Vector3(dx, dy + 0.8, dz), radius: 2.4,
        action: function () { toast('CHANDRA SEKHAR REDDY · SAI UNIVERSITY · B.TECH COMPUTER SCIENCE'); }
      });
    })();

    /* ============ SECRET DEV ROOM (hidden behind the waterfall) ============ */
    (function () {
      var vx = 16.3, vz = 5.8, vy = W.terrainHeight(vx, vz);
      var g = new THREE.Group();
      var hut = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 1.2), new THREE.MeshStandardMaterial({ color: 0x2b333d, roughness: 0.95 }));
      hut.position.y = 0.6; hut.castShadow = HQ();
      var glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5),
        new THREE.MeshBasicMaterial({ map: labelTex('> _ dev room', 'shh. you found it.', 512, 128, 'rgba(12,20,16,.9)', '#7fd08a'), transparent: true }));
      glow.position.set(0, 0.78, 0.61);
      g.add(hut, glow);
      g.position.set(vx, vy, vz);
      g.rotation.y = -2.3;
      scene.add(g);
      DEVROOM = glow;
      addInteract({
        id: 'devroom', label: 'ACCESS THE DEV ROOM', pos: new THREE.Vector3(vx, vy + 0.8, vz), radius: 2.6,
        action: function () { openCard('devroom'); toast('You found the secret dev room'); }
      });
    })();
  }

  function tick(dt, tSec, player, GAME) {
    /* skill crystals: activate on approach, idle pulse */
    for (var i = 0; i < CRYSTALS.length; i++) {
      var C = CRYSTALS[i];
      var d2 = player.pos.distanceTo(C.pos);
      var near = d2 < 3.6;
      var pulse = C.on ? 1.5 + M.sin(tSec * 2.2 + C.ph) * 0.45
        : near ? 0.85 + M.sin(tSec * 2.6 + C.ph) * 0.22
        : 0.35 + M.sin(tSec * 1.4 + C.ph) * 0.12;
      C.crystal.material.emissiveIntensity = pulse;
      C.crystal.rotation.y += dt * (C.on ? 1.2 : 0.35);
      C.crystal.position.y = 0.85 + M.sin(tSec * 1.1 + C.ph) * 0.06;
    }
    if (TREE) {
      TREE.grp.rotation.y += dt * 0.14;
      TREE.grp.position.y += M.sin(tSec * 1.2) * 0.0005;
    }
    if (MAST_LIGHT) MAST_LIGHT.visible = (tSec % 1.6) < 0.8;
    if (TERMINAL) {
      TERMINAL.t += dt;
      if (TERMINAL.t > 0.28) {
        TERMINAL.t = 0;
        var x = TERMINAL.cx, cv = TERMINAL.cv;
        x.fillStyle = '#04121c'; x.fillRect(0, 0, cv.width, cv.height);
        x.strokeStyle = 'rgba(105,210,255,.14)';
        for (var sy2 = 0; sy2 < cv.height; sy2 += 6) { x.beginPath(); x.moveTo(0, sy2); x.lineTo(cv.width, sy2); x.stroke(); }
        x.fillStyle = '#69d2ff';
        x.font = '13px monospace';
        var lines = ['CHANDRA SEKHAR REDDY', '', 'github.com/chandrasekharreddy-basireddy', 'linkedin.com/in/chandra-sekhar-reddy-basireddy', 'srinivasabasireddy06@gmail.com', '', '> ready_'];
        var scrollOff = M.floor(performance.now() / 700) % 8;
        for (var li = 0; li < lines.length; li++) x.fillText(lines[(li + scrollOff) % lines.length], 14, 24 + li * 19);
        x.fillStyle = '#e8b04b';
        x.fillRect(10 + (performance.now() / 60) % 120, cv.height - 18, 10, 12);
        TERMINAL.tex.needsUpdate = true;
      }
    }
    for (var s3 = 0; s3 < SIGNS.length; s3++) {
      if (SIGNS[s3].userData.float === undefined) SIGNS[s3].userData.float = M.random() * 6.28;
      SIGNS[s3].position.y += M.sin(tSec * 1.6 + SIGNS[s3].userData.float) * 0.0006;
    }
  }

  window.PLACES = { build: build, tick: tick };
})();
