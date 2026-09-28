/* places.js - physical content worlds: skills forest, project district,
   university campus, contact terminal, about camp props, secret dev room.
   Built procedurally from DATA (js/data.js). */
(function () {
  'use strict';
  var M = Math, PI = M.PI, TMPV = null;
  var CRYSTALS = [], TREE = null, MAST_LIGHT = null, TERMINAL = null, DEVROOM = null, SIGNS = [];
  var WAYSTATION = null, DECK = null, ID_CARD = null, HOLOS = [], CAMPUS_LAMPS = [];

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
    if (!TMPV && window.THREE) TMPV = new THREE.Vector3();
    var scene = ctx.scene, W = ctx.W, addInteract = ctx.addInteract, openCard = ctx.openCard,
      openProject = ctx.openProject, HQ = ctx.HQ, DATA = ctx.DATA, toast = ctx.toast, player = ctx.player,
      playerRig = ctx.playerRig, openJourney = ctx.openJourney, STATE = ctx.STATE, STATIONS = ctx.STATIONS,
      spawnCampusWalker = ctx.spawnCampusWalker, PROJECT_ARCH = ctx.PROJECT_ARCH;
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

    function projectHologram(id, x, y, z) {
      var arch = (PROJECT_ARCH && PROJECT_ARCH[id]) || [];
      var g = new THREE.Group();
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.3, 3.6, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x69d2ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = -1.9;
      g.add(beam);
      var nodeMat = new THREE.MeshBasicMaterial({ color: 0x9fe4ff, wireframe: true, transparent: true, opacity: 0.85 });
      var lineMat = new THREE.LineBasicMaterial({ color: 0x69d2ff, transparent: true, opacity: 0.5 });
      var prev = null;
      for (var i = 0; i < arch.length; i++) {
        var a = PI * 2 * i / M.max(1, arch.length);
        var node = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), nodeMat);
        node.position.set(M.cos(a) * 0.8, M.sin(i * 1.3) * 0.22, M.sin(a) * 0.8);
        g.add(node);
        var lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.24),
          new THREE.MeshBasicMaterial({ map: labelTex(arch[i][0], null, 512, 96, 'rgba(8,18,28,.55)', '#9fe4ff'), transparent: true, depthWrite: false }));
        lbl.position.copy(node.position).multiplyScalar(1.42);
        lbl.position.y += 0.02;
        g.add(lbl);
        if (prev) {
          var geo = new THREE.BufferGeometry().setFromPoints([prev.position.clone(), node.position.clone()]);
          g.add(new THREE.Line(geo, lineMat));
        }
        prev = node;
      }
      if (prev && arch.length > 2) {
        var geoC = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(prev.position.x, prev.position.y, prev.position.z),
          new THREE.Vector3(M.cos(0) * 0.8, M.sin(0) * 0.22, M.sin(0) * 0.8)]);
        g.add(new THREE.Line(geoC, lineMat));
      }
      g.position.set(x, y + 5.1, z);
      g.userData.holo = true;
      scene.add(g);
      HOLOS.push(g);
    }

    // P01 Survival School - school/lab building
    building(-9.2, -7.0, 4.6, 2.6, 3.2, 'SURVIVAL SCHOOL', 'MCQ learning platform · FastAPI · Next.js');
    projectHologram('survival-school', -9.2, W.terrainHeight(-9.2, -7.0), -7.0);
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
      projectHologram('signal-lite', mx, my, mz);
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
      projectHologram('saiu-v2', sx, sy, sz);
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

    /* ============ player ID card (subtle, on the armor) ============ */
    (function () {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 160;
      var x = c.getContext('2d');
      x.fillStyle = '#e8e2d2'; x.fillRect(0, 0, 256, 160);
      x.fillStyle = '#1a2430'; x.fillRect(0, 0, 256, 34);
      x.fillStyle = '#e8b04b'; x.font = '600 17px Georgia'; x.textAlign = 'center';
      x.fillText('STUDENT ID', 128, 24);
      x.fillStyle = '#1a2430'; x.font = '600 21px Georgia';
      x.fillText('CHANDRA S. REDDY', 128, 78);
      x.font = '15px Georgia'; x.fillStyle = '#3a4a5a';
      x.fillText('SAI UNIVERSITY', 128, 106);
      x.fillText('B.TECH COMPUTER SCIENCE', 128, 128);
      var tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      var card = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.095),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }));
      var holder = playerRig && playerRig.obj ? playerRig.obj : null;
      var bone = null;
      if (holder) holder.traverse(function (o) { if (!bone && o.isBone && /hips/i.test(o.name)) bone = o; });
      if (bone) bone.add(card); else if (holder) holder.add(card);
      card.position.set(0.13, -0.02, 0.16);
      card.rotation.set(0.1, 0.35, 0.12);
      ID_CARD = { mesh: card, seen: false };
    })();

    /* ============ campus quadrangle: library, path, notice board, benches, lamps, students ============ */
    (function () {
      var pathMat = new THREE.MeshStandardMaterial({ color: 0x9d8f74, roughness: 1 });
      var wood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
      function pathStrip(x1, z1, x2, z2, w) {
        var dx = x2 - x1, dz = z2 - z1;
        var len = M.sqrt(dx * dx + dz * dz);
        var seg = new THREE.Mesh(new THREE.PlaneGeometry(w || 1.1, len + 0.4), pathMat);
        seg.rotation.x = -PI / 2;
        seg.rotation.z = -M.atan2(dz, dx);
        var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        seg.position.set(mx, W.terrainHeight(mx, mz) + 0.035, mz);
        seg.receiveShadow = HQ();
        scene.add(seg);
      }
      /* path: trail -> university -> library, plus a spur to the quadrangle */
      pathStrip(-2.4, -17.4, -7.0, -17.5, 1.2);
      pathStrip(-7.0, -17.5, -9.6, -16.9, 1.0);
      pathStrip(-9.6, -16.9, -12.8, -15.6, 1.0);
      pathStrip(-9.6, -16.9, -10.4, -19.4, 0.9);
      /* library block */
      (function () {
        var lx = -13.2, lz = -14.6, ly = W.terrainHeight(lx, lz);
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.6), wallMat);
        body.position.y = 1.15; body.castShadow = body.receiveShadow = HQ();
        var roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 3.0), roofMat);
        roof.position.y = 2.18;
        var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.7),
          new THREE.MeshBasicMaterial({ map: labelTex('LIBRARY & LAB BLOCKS', null, 640, 128) }));
        sign.position.set(0, 2.7, 0.1);
        SIGNS.push(sign);
        g.add(body, roof, sign);
        g.position.set(lx, ly, lz);
        g.rotation.y = 0.42;
        scene.add(g);
      })();
      /* study courtyard between the buildings */
      var qcx = -10.6, qcz = -18.3, qy = W.terrainHeight(qcx, qcz);
      var court = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.4, 0.09, 20), new THREE.MeshStandardMaterial({ color: 0x8d8272, roughness: 1 }));
      court.position.set(qcx, qy + 0.045, qcz);
      court.receiveShadow = HQ();
      scene.add(court);
      /* book piles on the courtyard edge */
      [[0.7, 0.15, 0.5], [1.0, 0.32, 0.3], [-0.8, 0.2, -0.6]].forEach(function (b) {
        var book = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3),
          new THREE.MeshStandardMaterial({ color: [0x7a3b2e, 0x2e4a7a, 0x71582e][(b[1] * 10 | 0) % 3], roughness: 0.85 }));
        book.position.set(qcx + b[0], qy + 0.09 + b[1], qcz + b[2]);
        book.rotation.y = b[0] * 2;
        book.castShadow = HQ();
        scene.add(book);
      });
      /* benches facing the courtyard */
      function bench(px, pz, ry) {
        var g = new THREE.Group();
        var seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.4), wood);
        seat.position.y = 0.4;
        var bk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.36, 0.06), wood);
        bk.position.set(0, 0.64, -0.2);
        g.add(seat, bk);
        [-0.55, 0.55].forEach(function (lx) {
          var lg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.34), wood);
          lg.position.set(lx, 0.2, 0);
          g.add(lg);
        });
        g.position.set(px, W.terrainHeight(px, pz) + 0.02, pz);
        g.rotation.y = ry;
        scene.add(g);
      }
      bench(-9.2, -17.2, -0.6);
      bench(-11.9, -18.9, 2.4);
      bench(-10.2, -20.4, 2.9);
      /* notice board */
      (function () {
        var nx = -7.9, nz = -15.1, ny = W.terrainHeight(nx, nz);
        var g = new THREE.Group();
        [-0.75, 0.75].forEach(function (ox) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 6), wood);
          post.position.set(ox, 1.05, 0);
          post.castShadow = HQ();
          g.add(post);
        });
        var c = document.createElement('canvas');
        c.width = 512; c.height = 384;
        var x = c.getContext('2d');
        x.fillStyle = '#c9b483'; x.fillRect(0, 0, 512, 384);
        x.fillStyle = '#26313d'; x.fillRect(18, 18, 476, 348);
        x.fillStyle = '#e8b04b'; x.font = '600 30px Georgia'; x.textAlign = 'center';
        x.fillText('CS DEPT NOTICEBOARD', 256, 66);
        x.fillStyle = '#dfe9f2'; x.font = '24px Georgia';
        x.fillText('CLASS X — 560 / 600', 256, 140);
        x.fillText('CLASS XII — 975 / 1000', 256, 196);
        x.fillText('B.TECH Y2 CSE — CGPA 9.33', 256, 252);
        x.fillStyle = '#8fa8bc'; x.font = 'italic 20px Georgia';
        x.fillText('Sai University · Bhashyam schools', 256, 322);
        var board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.28),
          new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.85 }));
        board.position.set(0, 1.45, 0.06);
        g.add(board);
        var frame = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.44, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9 }));
        frame.position.set(0, 1.45, 0);
        g.add(frame);
        g.position.set(nx, ny, nz);
        g.rotation.y = 0.85;
        scene.add(g);
        addInteract({
          id: 'noticeboard', label: 'READ THE NOTICE BOARD', pos: new THREE.Vector3(nx, ny + 1.2, nz), radius: 2.6,
          action: function () { openCard('education'); toast('Class X 560/600 · Class XII 975/1000 · B.Tech CGPA 9.33'); }
        });
      })();
      /* campus lamps (warm at night) */
      [[-4.4, -17.4], [-8.1, -16.4], [-11.6, -16.3]].forEach(function (L) {
        var ly = W.terrainHeight(L[0], L[1]);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.9, 6), trimMat);
        pole.position.set(L[0], ly + 1.45, L[1]);
        pole.castShadow = HQ();
        scene.add(pole);
        var lampMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffc46b, emissiveIntensity: 0.25, roughness: 0.5 });
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), lampMat);
        lamp.position.set(L[0], ly + 2.95, L[1]);
        scene.add(lamp);
        if (HQ()) {
          var light = new THREE.PointLight(0xffc46b, 0, 8.5, 2);
          light.position.set(L[0], ly + 2.9, L[1]);
          scene.add(light);
          CAMPUS_LAMPS.push({ light: light, mat: lampMat });
        }
      });
    })();

    /* ============ achievements waystation (between education and contact) ============ */
    (function () {
      var cx = -6.5, cz = -23.5, cy = W.terrainHeight(cx, cz);
      var g = new THREE.Group();
      var obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.3, 4),
        new THREE.MeshStandardMaterial({ color: 0x5b6875, roughness: 0.85, flatShading: true }));
      obelisk.position.y = 1.15;
      obelisk.castShadow = HQ();
      g.add(obelisk);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 1 }));
      base.position.y = 0.15;
      g.add(base);
      var cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      var cx2 = cv.getContext('2d');
      var holo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      holo.position.y = 2.75;
      g.add(holo);
      SIGNS.push(holo);
      g.position.set(cx, cy, cz);
      scene.add(g);
      WAYSTATION = { grp: g, plinths: [], ctx: cx2, tex: holo.material.map };
      STATIONS.forEach(function (st, i) {
        var a = PI * 2 * i / 6 - PI / 2;
        var px = cx + M.cos(a) * 2.7, pz = cz + M.sin(a) * 2.7;
        var py = W.terrainHeight(px, pz);
        var capMat = new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 0.7, emissive: 0xe8b04b, emissiveIntensity: 0 });
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x5d6670, roughness: 1 }));
        stem.position.set(px, py + 0.27, pz);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 8), capMat);
        cap.position.set(px, py + 0.59, pz);
        stem.castShadow = cap.castShadow = HQ();
        scene.add(stem, cap);
        var lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2),
          new THREE.MeshBasicMaterial({ map: labelTex(st.label, null, 512, 96, 'rgba(10,16,24,.85)', '#c2d4e0'), transparent: true }));
        lbl.position.set(px, py + 0.82, pz);
        SIGNS.push(lbl);
        WAYSTATION.plinths.push({ id: st.id, cap: cap, mat: capMat });
      });
      addInteract({
        id: 'waystation', label: 'VIEW YOUR JOURNEY', pos: new THREE.Vector3(cx, cy + 1, cz), radius: 3.6,
        action: function () { if (openJourney) openJourney(); }
      });
    })();

    /* ============ final viewpoint deck (end of the trail) ============ */
    (function () {
      var wood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
      var wood2 = new THREE.MeshStandardMaterial({ color: 0x63472c, roughness: 1 });
      var y0 = W.terrainHeight(0, -30.1);
      var y1 = y0 + 0.85;
      DECK = { y0: y0, y1: y1, x0: -2.1, x1: 2.1, zr0: -30.1, zr1: -31.6, zp0: -31.6, zp1: -34.3 };
      function post(px, py, pz, h) {
        var s = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, h, 6), wood2);
        s.position.set(px, py + h / 2, pz);
        s.castShadow = HQ();
        scene.add(s);
      }
      // ramp
      var rampLen = DECK.zr1 - DECK.zr0;
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, M.sqrt(rampLen * rampLen + (y1 - y0) * (y1 - y0))), wood);
      ramp.position.set(0, (y0 + y1) / 2 - 0.02, (DECK.zr0 + DECK.zr1) / 2);
      ramp.rotation.x = -M.atan((y1 - y0) / -rampLen);
      ramp.receiveShadow = HQ();
      scene.add(ramp);
      // platform
      var plat = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, DECK.zp1 - DECK.zp0), wood);
      plat.position.set(0, y1 - 0.05, (DECK.zp0 + DECK.zp1) / 2);
      plat.receiveShadow = plat.castShadow = HQ();
      scene.add(plat);
      // support posts
      [-1.9, 1.9].forEach(function (pxx) {
        [DECK.zp0 + 0.3, DECK.zp1 - 0.3].forEach(function (pzz) {
          var gy = W.terrainHeight(pxx, pzz);
          post(pxx, gy, pzz, y1 - gy);
        });
        post(pxx, W.terrainHeight(pxx, DECK.zr0) - 0.3, DECK.zr0 - 0.2, 1.1);
      });
      // railings along the platform sides + back
      [-1.95, 1.95].forEach(function (pxx) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, DECK.zp1 - DECK.zp0), wood2);
        rail.position.set(pxx, y1 + 0.62, (DECK.zp0 + DECK.zp1) / 2);
        scene.add(rail);
        for (var zz = DECK.zp0 + 0.35; zz < DECK.zp1; zz += 0.85) post(pxx, y1, zz, 0.62);
      });
      var back = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.05, 0.06), wood2);
      back.position.set(0, y1 + 0.62, DECK.zp1 + 0.02);
      scene.add(back);
      for (var bx = -1.7; bx <= 1.7; bx += 0.85) post(bx, y1, DECK.zp1, 0.62);
      // bench facing the world
      var bench = new THREE.Group();
      var seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.42), wood);
      seat.position.y = 0.42;
      var bk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), wood);
      bk.position.set(0, 0.68, -0.22);
      bench.add(seat, bk);
      [-0.6, 0.6].forEach(function (lx) {
        var lg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.36), wood2);
        lg.position.set(lx, 0.21, 0);
        bench.add(lg);
      });
      bench.position.set(-1.15, y1 + 0.05, DECK.zp1 - 1.1);
      scene.add(bench);
      // brass telescope
      var scope = new THREE.Group();
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.75 }));
      tube.rotation.x = -0.55;
      var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 6), wood2);
      stand.position.y = 0.4;
      tube.position.y = 0.95;
      scope.add(tube, stand);
      scope.position.set(1.5, y1 + 0.05, DECK.zp1 - 1.0);
      scope.rotation.y = 0.5;
      scene.add(scope);
      addInteract({
        id: 'viewpoint', label: 'LOOK OUT OVER THE WORLD', pos: new THREE.Vector3(0, y1 + 1, DECK.zp1 - 1.5), radius: 3.4,
        action: function () { toast('From up here you can see everything you walked through'); }
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
    var lamGlow = 0.25 + W.nightFactor() * 1.5;
    for (var l3 = 0; l3 < CAMPUS_LAMPS.length; l3++) {
      CAMPUS_LAMPS[l3].mat.emissiveIntensity = lamGlow;
      CAMPUS_LAMPS[l3].light.intensity = W.nightFactor() * 1.35;
    }
    for (var h3 = 0; h3 < HOLOS.length; h3++) {
      var H = HOLOS[h3];
      H.rotation.y += dt * 0.22;
      H.position.y += M.sin(tSec * 0.7 + h3 * 2.1) * 0.0006;
    }
    if (ID_CARD && !ID_CARD.seen && ID_CARD.mesh.getWorldPosition) {
      ID_CARD.mesh.getWorldPosition(TMPV);
      if (GAME && GAME.cam && TMPV.distanceTo(GAME.cam.position) < 2.1) {
        ID_CARD.seen = true;
        toast('STUDENT ID — CHANDRA SEKHAR REDDY · SAI UNIVERSITY · B.TECH COMPUTER SCIENCE');
      }
    }
    for (var s3 = 0; s3 < SIGNS.length; s3++) {
      if (SIGNS[s3].userData.float === undefined) SIGNS[s3].userData.float = M.random() * 6.28;
      SIGNS[s3].position.y += M.sin(tSec * 1.6 + SIGNS[s3].userData.float) * 0.0006;
    }
  }

  function updateWaystation(STATE, DATA) {
    if (!WAYSTATION) return;
    var stops = 0;
    WAYSTATION.plinths.forEach(function (P) {
      var got = STATE.data.stops.indexOf(P.id) >= 0;
      P.mat.emissiveIntensity = got ? 0.9 : 0;
      if (got) stops++;
    });
    var x = WAYSTATION.ctx, cv = x.canvas;
    x.clearRect(0, 0, cv.width, cv.height);
    x.fillStyle = 'rgba(8,14,22,.82)';
    x.fillRect(0, 0, cv.width, cv.height);
    x.strokeStyle = 'rgba(105,210,255,.5)';
    x.lineWidth = 3;
    x.strokeRect(6, 6, cv.width - 12, cv.height - 12);
    x.fillStyle = '#8fd0ff';
    x.font = '600 34px Georgia';
    x.textAlign = 'center';
    x.fillText('THE JOURNEY', cv.width / 2, 52);
    x.fillStyle = '#e8b04b';
    x.font = '28px Georgia';
    x.fillText(stops + ' / 6 STOPS  ·  ' + STATE.orbCount() + ' / 10 ORBS', cv.width / 2, 98);
    WAYSTATION.tex.needsUpdate = true;
  }

  function deckAt(x, z) {
    if (!DECK) return null;
    if (x < DECK.x0 || x > DECK.x1) return null;
    if (z <= DECK.zr0 && z >= DECK.zr1) return DECK.y0 + (DECK.zr0 - z) / (DECK.zr0 - DECK.zr1) * (DECK.y1 - DECK.y0);
    if (z < DECK.zr1 && z >= DECK.zp1) return DECK.y1;
    return null;
  }

  window.PLACES = { build: build, tick: tick, updateWaystation: updateWaystation, deckAt: deckAt,
    stats: function () {
      return { crystals: CRYSTALS.length, plinths: WAYSTATION ? WAYSTATION.plinths.length : 0, holograms: HOLOS.length, lamps: CAMPUS_LAMPS.length };
    } };
})();
