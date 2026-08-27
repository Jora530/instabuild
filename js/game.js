/* ============================================================
   InstaBuild 3D — "Ndërto Shtëpinë Tënde"
   Stili "Hometopia": vendosje e LIRË pa rrjetë, rrotullim 360°,
   themele + kate shumëkatëshe, rrotë ngjyrash + tekstura materialesh,
   mobilie të bollshme, pamje 3D/2D, ecje brenda, ruaj/ngarko dhe Co-op.
   ============================================================ */
(function () {
  'use strict';

  var SAVE_KEY = 'instabuild_game_v2';
  var FLOOR_H = 3.0;      // lartësia e një kati
  var WALL_H = 2.7;       // lartësia standarde e murit
  var SNAP_STEP = 0.5;    // hapi i snap-it (kur aktivizohet)

  var state = { env: 'plot', currentFloor: 0, floorCount: 1 };
  var allParts = [];      // të gjitha pjesët e vendosura (mure, pllaka, mobilie, etj.)
  var undoStack = [];
  var redoStack = [];

  /* ---------------- Three.js ---------------- */
  var canvas = document.getElementById('game-canvas');
  var renderer, scene, camera, controls, raycaster, pointer;
  var sun, hemi, gridHelper, nightLight, skyDome, insideLight;
  var clock = new THREE.Clock();
  var keys = {};

  function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc3e0);
    scene.fog = new THREE.Fog(0x9fc3e0, 180, 340);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(18, 14, 22);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 3;
    controls.maxDistance = 140;
    controls.target.set(0, 2, 0);

    hemi = new THREE.HemisphereLight(0xffffff, 0x7a8f4f, 0.95);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff5e0, 1.15);
    sun.position.set(25, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

    gridHelper = new THREE.GridHelper(80, 160, 0x6b8e23, 0xc9d3b8);
    gridHelper.position.y = 0.02;
    gridHelper.visible = false;
    scene.add(gridHelper);

    skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(260, 24, 12),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false })
    );
    skyDome.name = 'sky';
    skyDome.renderOrder = -10;
    scene.add(skyDome);

    nightLight = new THREE.PointLight(0xffd9a0, 0, 45, 1);
    nightLight.position.set(0, 4, 0);
    scene.add(nightLight);

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshLambertMaterial({
      color: color,
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1
    });
  }

  function hexColor(hex) { return parseInt(hex.replace('#', ''), 16); }

  /* ============================================================
     NDRICIMI DITË / NATË (si në Home Design 3D)
     ============================================================ */
  var DAY_STATES = [
    { h: 5, elev: -12, azim: 55, sun: 0x3a4a6a, sunI: 0.0, sky: 0x26324e, hSky: 0x35456a, hGround: 0x0d1520, hI: 0.35 },
    { h: 7, elev: 14, azim: 80, sun: 0xffc37a, sunI: 0.85, sky: 0x9fc3e0, hSky: 0xffffff, hGround: 0x7a8f4f, hI: 0.9 },
    { h: 12, elev: 70, azim: 170, sun: 0xfff5e0, sunI: 1.15, sky: 0x9fc3e0, hSky: 0xffffff, hGround: 0x7a8f4f, hI: 0.95 },
    { h: 18, elev: 12, azim: 265, sun: 0xff8c42, sunI: 0.9, sky: 0xe8a06a, hSky: 0xffd9b0, hGround: 0x6b5a4a, hI: 0.72 },
    { h: 21, elev: -14, azim: 300, sun: 0x334455, sunI: 0.0, sky: 0x1a2340, hSky: 0x2a3550, hGround: 0x0a0e18, hI: 0.35 }
  ];
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(c1, c2, t) {
    var a = new THREE.Color(c1), b = new THREE.Color(c2);
    return new THREE.Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
  }
  function hourLabel(hour) {
    if (hour < 6 || hour > 19) return '🌙 Natë';
    if (hour < 10) return '🌅 Mëngjes';
    if (hour < 16) return '☀️ Mesditë';
    return '🌇 Perëndim';
  }
  function setTimeOfDay(v) {
    if (!sun || !hemi || !scene) return;
    var hour = v / 100 * 24;
    var i = 0;
    while (i < DAY_STATES.length - 1 && DAY_STATES[i + 1].h < hour) i++;
    var A = DAY_STATES[i], B = DAY_STATES[Math.min(i + 1, DAY_STATES.length - 1)];
    var t = (hour - A.h) / Math.max(0.001, B.h - A.h);
    t = Math.max(0, Math.min(1, t));
    var elev = lerp(A.elev, B.elev, t) * Math.PI / 180;
    var azim = lerp(A.azim, B.azim, t) * Math.PI / 180;
    var R = 80;
    sun.position.set(R * Math.cos(elev) * Math.sin(azim), R * Math.sin(elev), R * Math.cos(elev) * Math.cos(azim));
    sun.color = lerpColor(A.sun, B.sun, t);
    sun.intensity = lerp(A.sunI, B.sunI, t);
    hemi.color = lerpColor(A.hSky, B.hSky, t);
    hemi.groundColor = lerpColor(A.hGround, B.hGround, t);
    hemi.intensity = lerp(A.hI, B.hI, t);
    scene.background = lerpColor(A.sky, B.sky, t);
    if (scene.fog) scene.fog.color = lerpColor(A.sky, B.sky, t);
    if (nightLight) nightLight.intensity = (hour < 6 || hour > 19) ? 1.4 : 0;
    var hl = hourLabel(hour);
    var lbl = document.getElementById('daynight-label');
    if (lbl) lbl.textContent = hl;
    updateSky(hl);
  }

  var lastSkyLabel = null;
  function makeSkyTexture(top, horizon) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#' + new THREE.Color(top).getHexString());
    g.addColorStop(0.55, '#' + new THREE.Color(horizon).getHexString());
    g.addColorStop(1, '#' + new THREE.Color(horizon).getHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  }
  function updateSky(label) {
    if (label === lastSkyLabel || !skyDome) return;
    lastSkyLabel = label;
    var sky = {
      '🌙 Natë': [0x0a1020, 0x1c2740],
      '🌅 Mëngjes': [0x5f9ad0, 0xdcebf5],
      '☀️ Mesditë': [0x3f8fd0, 0xcfe6f5],
      '🌇 Perëndim': [0x5a6ab0, 0xf5c08a]
    }[label] || [0x3f8fd0, 0xcfe6f5];
    if (skyDome.material.map) skyDome.material.map.dispose();
    skyDome.material.map = makeSkyTexture(sky[0], sky[1]);
    skyDome.material.needsUpdate = true;
  }

  /* ============================================================
     NGJYRAT + TEKSTURAT E MATERIALEVE
     ============================================================ */
  var selectedColor = '#f2efe6';
  var selectedMaterial = 'plaster'; // 'plaster' | 'wood' | 'brick' | 'stone' | 'tile' | 'concrete' | 'metal' | 'glass' | 'smooth'

  function hsvToRgb(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  function rgbToHex(r, g, b) {
    function hx(n) { n = Math.max(0, Math.min(255, n)); return ('0' + n.toString(16)).slice(-2); }
    return '#' + hx(r) + hx(g) + hx(b);
  }
  function hexToRgb(hex) {
    var n = hexColor(hex);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var texCache = {};
  function makeTex(name, draw) {
    if (texCache[name]) return texCache[name];
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    draw(c.getContext('2d'), 256);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    texCache[name] = tex;
    return tex;
  }
  function getTexture(name) {
    if (name === 'wood') {
      return makeTex('wood', function (ctx, S) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);
        var plankH = 40;
        for (var y = 0; y < S; y += plankH) {
          ctx.fillStyle = 'rgba(120,110,95,' + (0.12 + Math.random() * 0.08) + ')';
          ctx.fillRect(0, y, S, 2);
          for (var i = 0; i < 40; i++) {
            ctx.fillStyle = 'rgba(90,80,70,' + (0.05 + Math.random() * 0.08) + ')';
            var gx = Math.random() * S, gy = y + Math.random() * plankH;
            ctx.fillRect(gx, gy, 1 + Math.random() * 2, 2 + Math.random() * 8);
          }
        }
      });
    }
    if (name === 'brick') {
      return makeTex('brick', function (ctx, S) {
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, S, S); // llaç
        var bw = 40, bh = 20;
        for (var y = 0; y < S; y += bh) {
          var off = (Math.floor(y / bh) % 2) * (bw / 2);
          for (var x = -bw; x < S; x += bw) {
            ctx.fillStyle = 'rgba(90,90,95,' + (0.75 + Math.random() * 0.2) + ')';
            ctx.fillRect(x + off, y, bw - 4, bh - 4);
          }
        }
      });
    }
    if (name === 'stone') {
      return makeTex('stone', function (ctx, S) {
        ctx.fillStyle = '#cfcfcf'; ctx.fillRect(0, 0, S, S);
        var rows = 6;
        for (var r = 0; r < rows; r++) {
          var y0 = r * (S / rows);
          var off = (r % 2) * 40;
          for (var x = -80; x < S; x += 85) {
            ctx.fillStyle = 'rgba(95,95,100,' + (0.55 + Math.random() * 0.3) + ')';
            ctx.beginPath();
            var w = 70 + Math.random() * 20, h = (S / rows) - 3;
            ctx.rect(x + off, y0 + 1, w, h);
            ctx.fill();
          }
        }
      });
    }
    if (name === 'tile') {
      return makeTex('tile', function (ctx, S) {
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, S, S);
        var t = 64;
        for (var y = 0; y < S; y += t) for (var x = 0; x < S; x += t) {
          ctx.fillStyle = 'rgba(90,90,95,' + (0.8 + Math.random() * 0.12) + ')';
          ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(x + 2, y + 2, t - 4, 3);
        }
      });
    }
    if (name === 'plaster') {
      return makeTex('plaster', function (ctx, S) {
        ctx.fillStyle = '#f5f2ea'; ctx.fillRect(0, 0, S, S);
        for (var i = 0; i < 2200; i++) {
          ctx.fillStyle = 'rgba(120,120,110,' + (0.03 + Math.random() * 0.05) + ')';
          ctx.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
      });
    }
    if (name === 'concrete') {
      return makeTex('concrete', function (ctx, S) {
        ctx.fillStyle = '#e2e2e2'; ctx.fillRect(0, 0, S, S);
        for (var i = 0; i < 900; i++) {
          ctx.fillStyle = 'rgba(90,90,90,' + (0.04 + Math.random() * 0.07) + ')';
          ctx.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 1 + Math.random() * 3);
        }
      });
    }
    if (name === 'metal') {
      return makeTex('metal', function (ctx, S) {
        var g = ctx.createLinearGradient(0, 0, S, 0);
        g.addColorStop(0, '#e8e8e8'); g.addColorStop(0.5, '#f8f8f8'); g.addColorStop(1, '#d4d4d4');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        for (var i = 0; i < 40; i++) {
          ctx.fillStyle = 'rgba(160,160,160,0.3)';
          ctx.fillRect(0, Math.random() * S, S, 1);
        }
      });
    }
    return makeTex('smooth', function (ctx, S) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S); });
  }

  function makePartMaterial(colorHex, matId) {
    if (matId === 'glass') return mat(hexColor(colorHex || '#bfe3f5'), { transparent: true, opacity: 0.45 });
    if (!matId || matId === 'smooth') return mat(hexColor(colorHex || '#e8e4d8'));
    var tex = getTexture(matId);
    var m = new THREE.MeshLambertMaterial({ map: tex, color: hexColor(colorHex || '#ffffff') });
    return m;
  }

  /* ============================================================
     PEIZAZHI I MJEDISIT
     ============================================================ */
  var people = [], cars = [], clouds = [];

  function grassTexture(tone) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    var base = tone || '#5d8a3f';
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    var tones = ['#4d7a33', '#6b9747', '#54833a', '#63904a', '#3f6b2c', '#71a050'];
    for (var i = 0; i < 1400; i++) {
      ctx.fillStyle = tones[i % tones.length];
      var s = 1 + Math.random() * 3;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    return tex;
  }
  function concreteTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#8f9a8a'; ctx.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.03 + Math.random() * 0.05) + ')';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1 + Math.random() * 3);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }
  function createGround(color, y, tex) {
    y = y || 0;
    var m = tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: color });
    var g = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), m);
    g.rotation.x = -Math.PI / 2;
    g.position.y = y;
    g.receiveShadow = true;
    g.name = 'ground';
    scene.add(g);
  }
  function createTree(x, z, scale, y) {
    y = y || 0;
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.3 * scale, 1.8 * scale, 7), mat(0x6b4a2b));
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    var leafColors = [0x3d6b2f, 0x4a7a35, 0x335c26];
    var layers = [{ r: 1.25, y: 2.2 }, { r: 0.95, y: 2.9 }, { r: 0.6, y: 3.5 }];
    layers.forEach(function (L, i) {
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(L.r * scale, 1.3 * scale, 8), mat(leafColors[i]));
      leaf.position.y = L.y * scale;
      leaf.castShadow = true;
      g.add(leaf);
    });
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  }
  function createRock(x, z, s, y) {
    y = y || 0;
    var r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x8a8f88));
    r.position.set(x, y + s * 0.4, z);
    r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    r.scale.y = 0.7;
    r.castShadow = true;
    scene.add(r);
  }
  function createFlower(x, z, y) {
    y = y || 0;
    var g = new THREE.Group();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), mat(0x2f6b2a));
    stem.position.y = 0.17;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), mat([0xe74c3c, 0xf1c40f, 0xe67e22, 0x9b59b6, 0xff6b9d, 0xffffff][Math.floor(Math.random() * 6)]));
    head.position.y = 0.38;
    g.add(stem); g.add(head);
    g.position.set(x, y, z);
    scene.add(g);
  }
  function createCloud(x, y, z, s) {
    var g = new THREE.Group();
    var cMat = mat(0xffffff, { transparent: true, opacity: 0.92 });
    var puffs = [[0, 0, 0, 1.4], [1.3, 0.2, 0.3, 1.0], [-1.3, 0.15, -0.2, 1.0], [0.5, 0.4, -0.6, 0.8]];
    puffs.forEach(function (p) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(p[3] * s, 8, 6), cMat);
      m.position.set(p[0] * s, p[1] * s, p[2] * s);
      m.scale.y = 0.55;
      g.add(m);
    });
    g.position.set(x, y, z);
    scene.add(g);
    clouds.push(g);
  }
  function createLamp(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 7), mat(0x3a3f45));
    pole.position.y = 2.1;
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), mat(0x3a3f45));
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.55, 3.9, 0);
    var light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffd966, emissiveIntensity: 0.6 }));
    light.position.set(1.15, 3.9, 0);
    g.add(pole); g.add(arm); g.add(light);
    g.position.set(x, 0, z);
    scene.add(g);
  }
  function makePerson() {
    var g = new THREE.Group();
    var skin = mat(0xe8b88a), shirt = mat([0x556b2f, 0x6b8e23, 0x2c3e50, 0x8b2f2f, 0x3a5f8a][Math.floor(Math.random() * 5)]), pants = mat([0x3a3a4a, 0x555d55, 0x2f2f3f][Math.floor(Math.random() * 3)]), shoes = mat(0x222222), hair = mat([0x3a2a1a, 0x1a1a1a, 0x6b4a2b][Math.floor(Math.random() * 3)]);
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.28), shirt);
    body.position.y = 1.35;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.y = 1.95;
    g.add(head);
    var hairM = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6), hair);
    hairM.position.y = 2.02; hairM.scale.y = 0.7;
    g.add(hairM);
    var leftArm = new THREE.Group(); leftArm.position.set(-0.32, 1.6, 0);
    var la = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt); la.position.y = -0.3; leftArm.add(la); g.add(leftArm);
    var rightArm = new THREE.Group(); rightArm.position.set(0.32, 1.6, 0);
    var ra = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt); ra.position.y = -0.3; rightArm.add(ra); g.add(rightArm);
    var leftLeg = new THREE.Group(); leftLeg.position.set(-0.12, 0.95, 0);
    var ll = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), pants); ll.position.y = -0.3; leftLeg.add(ll); g.add(leftLeg);
    var rightLeg = new THREE.Group(); rightLeg.position.set(0.12, 0.95, 0);
    var rl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), pants); rl.position.y = -0.3; rightLeg.add(rl); g.add(rightLeg);
    g.userData.parts = { la: leftArm, ra: rightArm, ll: leftLeg, rl: rightLeg };
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.speed = 1.2 + Math.random() * 0.8;
    g.userData.dir = Math.random() * Math.PI * 2;
    g.userData.radius = 14 + Math.random() * 18;
    g.userData.isPerson = true;
    scene.add(g);
    people.push(g);
    return g;
  }
  function makeCar(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.95), mat(color));
    body.position.y = 0.5; body.castShadow = true;
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.85), mat(0xbfe3f5));
    cabin.position.set(-0.1, 0.95, 0);
    g.add(body); g.add(cabin);
    var wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 10);
    var wheelMat = mat(0x1a1a1a);
    [[-0.6, 0, -0.5], [0.6, 0, -0.5], [-0.6, 0, 0.5], [0.6, 0, 0.5]].forEach(function (w) {
      var wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(w[0], 0.24, w[2]);
      g.add(wheel);
    });
    g.userData.isCar = true;
    g.userData.speed = 3 + Math.random() * 3;
    g.userData.dir = Math.random() < 0.5 ? 1 : -1;
    g.userData.axis = Math.random() < 0.5 ? 'x' : 'z';
    g.userData.limit = 45;
    scene.add(g);
    cars.push(g);
    return g;
  }
  function createBuilding(x, z, w, d, h, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var winMat = mat(0xbfe3f5);
    var winCount = Math.floor(w / 1.6);
    for (var i = 0; i < winCount; i++) {
      var wx = -w / 2 + 0.9 + i * 1.6;
      for (var row = 0; row < Math.floor(h / 2.2); row++) {
        var win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), winMat);
        win.position.set(wx, 1.6 + row * 2.2, d / 2 + 0.03);
        g.add(win);
        var win2 = win.clone(); win2.position.z = -d / 2 - 0.03; g.add(win2);
      }
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  function createLake(x, z, radius) {
    var lake = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshLambertMaterial({ color: 0x4a90c4, transparent: true, opacity: 0.85 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(x, 0.05, z);
    scene.add(lake);
  }
  function createVillageHouse(x, z, r) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.4), mat(0xd8cfae));
    body.position.y = 1.3; body.castShadow = true; body.receiveShadow = true;
    var roof = makeGableRoof(4.8, 3.8, 1.4, '#8a5a33');
    roof.position.y = 2.6;
    g.add(body); g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = Math.floor(r * 4) * (Math.PI / 2);
    scene.add(g);
  }
  function seededRandom(seed) {
    var s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function buildEnvironment() {
    clearAllObjects();
    var i, rnd = seededRandom(7);
    // Lëndinë e pastër
    createGround(0x79a05a, 0, grassTexture('#79a05a'));
    // Trualli i ndërtimit (pak më i hapur)
    var plot = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshLambertMaterial({ color: 0x8fae6a }));
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(0, 0.02, 0);
    plot.receiveShadow = true;
    scene.add(plot);
    // Kufiri i truallit
    var borderMat = new THREE.MeshLambertMaterial({ color: 0xc9b896 });
    function border(x, z, w, d) {
      var s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), borderMat);
      s.position.set(x, 0.07, z);
      s.receiveShadow = true;
      scene.add(s);
    }
    border(0, -13.2, 26.6, 0.5);
    border(0, 13.2, 26.6, 0.5);
    border(-13.2, 0, 0.5, 26.6);
    border(13.2, 0, 0.5, 26.6);
    // Dekor i lehtë rreth e rrotull (pemë, lule, gurë)
    for (i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2;
      var d = 28 + rnd() * 18;
      createTree(Math.cos(a) * d, Math.sin(a) * d, 0.9 + rnd() * 0.6, 0);
    }
    for (i = 0; i < 24; i++) createFlower((rnd() - 0.5) * 90, (rnd() - 0.5) * 90, 0);
    for (i = 0; i < 4; i++) createRock((rnd() - 0.5) * 100, (rnd() - 0.5) * 100, 0.3 + rnd() * 0.5, 0);
    for (i = 0; i < 5; i++) createCloud((Math.random() - 0.5) * 130, 26 + Math.random() * 12, (Math.random() - 0.5) * 130, 1.6 + Math.random() * 1.6);
  }

  function clearAllObjects() {
    scene.children.slice().forEach(function (c) {
      if (c.isLight) return;
      if (c === gridHelper || c === skyDome) return;
      scene.remove(c);
      disposeObj(c);
    });
    people = []; cars = []; clouds = [];
    allParts = [];
  }

  function animateWorld(dt) {
    var i;
    for (i = 0; i < people.length; i++) {
      var p = people[i]; if (!p.parent) continue;
      var u = p.userData; u.phase += dt * u.speed;
      p.position.x += Math.cos(u.dir) * dt * u.speed;
      p.position.z += Math.sin(u.dir) * dt * u.speed;
      var r = Math.sqrt(p.position.x * p.position.x + p.position.z * p.position.z);
      if (r > u.radius) u.dir = Math.atan2(-p.position.z, -p.position.x) + (Math.random() - 0.5) * 0.8;
      if (r < 3) u.dir = Math.atan2(p.position.z, p.position.x) + (Math.random() - 0.5) * 0.8;
      var swing = Math.sin(u.phase) * 0.6;
      u.parts.la.rotation.x = swing; u.parts.ra.rotation.x = -swing;
      u.parts.ll.rotation.x = -swing * 0.9; u.parts.rl.rotation.x = swing * 0.9;
      p.position.y = Math.abs(Math.cos(u.phase)) * 0.06;
      p.rotation.y = u.dir;
    }
    for (i = 0; i < cars.length; i++) {
      var car = cars[i]; if (!car.parent) continue;
      var cu = car.userData;
      if (cu.axis === 'x') {
        car.position.x += cu.dir * cu.speed * dt;
        if (car.position.x > cu.limit) { car.position.x = cu.limit; cu.dir = -1; }
        if (car.position.x < -cu.limit) { car.position.x = -cu.limit; cu.dir = 1; }
        var laneZ = car.position.z > 0 ? 2.8 : -2.8;
        car.position.z += (laneZ - car.position.z) * 2 * dt;
        car.rotation.y = cu.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.position.z += cu.dir * cu.speed * dt;
        if (car.position.z > cu.limit) { car.position.z = cu.limit; cu.dir = -1; }
        if (car.position.z < -cu.limit) { car.position.z = -cu.limit; cu.dir = 1; }
        var laneX = car.position.x > 0 ? 2.8 : -2.8;
        car.position.x += (laneX - car.position.x) * 2 * dt;
        car.rotation.y = cu.dir > 0 ? 0 : Math.PI;
      }
    }
    for (i = 0; i < clouds.length; i++) {
      var cl = clouds[i]; if (!cl.parent) continue;
      cl.position.x += dt * 1.2;
      if (cl.position.x > 70) cl.position.x = -70;
    }
  }

  function disposeObj(o) {
    if (!o) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
      else o.material.dispose();
    }
    if (o.children) o.children.forEach(disposeObj);
  }

  /* ============================================================
     KRIJIMI I PJESËVE (mure, pllaka, kulme, dritare, dyer...)
     ============================================================ */
  function makeWallMesh(w, h, d, colorHex, matId) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makePartMaterial(colorHex, matId));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'wall'; m.userData.w = w; m.userData.h = h; m.userData.d = d;
    return m;
  }
  function makeGableRoof(width, depth, height, colorHex, matId) {
    var shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.lineTo(-width / 2, 0);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    var m = new THREE.Mesh(geo, makePartMaterial(colorHex, matId));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'roof'; m.userData.roofType = 'gable';
    return m;
  }
  function makePyramidRoof(width, depth, height, colorHex, matId) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, height, 4), makePartMaterial(colorHex, matId));
    m.rotation.y = Math.PI / 4;
    m.castShadow = true;
    m.userData.kind = 'roof'; m.userData.roofType = 'pyramid';
    return m;
  }
  function makeFlatRoof(w, d, colorHex, matId) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), makePartMaterial(colorHex, matId));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'roof'; m.userData.roofType = 'flat'; m.userData.w = w; m.userData.d = d;
    return m;
  }
  function makeFoundation(w, d, colorHex, matId) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), makePartMaterial(colorHex || '#b9b9b2', matId || 'concrete'));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'foundation'; m.userData.w = w; m.userData.d = d;
    return m;
  }
  function makeSlab(w, d, colorHex, matId) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), makePartMaterial(colorHex || '#c9c2b0', matId || 'wood'));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'slab'; m.userData.w = w; m.userData.d = d;
    return m;
  }
  function makeStairs(colorHex, matId) {
    var g = new THREE.Group();
    var stepMat = makePartMaterial(colorHex || '#c9c2b0', matId || 'concrete');
    var n = 8, stepH = (FLOOR_H - 0.05) / n, stepW = 1.2, depth = 0.32;
    for (var i = 0; i < n; i++) {
      var s = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, depth), stepMat);
      s.position.set(0, i * stepH + stepH / 2, -i * depth);
      s.castShadow = true; s.receiveShadow = true;
      g.add(s);
    }
    g.userData.kind = 'stairs';
    return g;
  }
  function makeChimney(colorHex, matId) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), makePartMaterial(colorHex || '#7a5a3a', matId || 'brick'));
    m.castShadow = true;
    m.userData.kind = 'chimney';
    return m;
  }
  function makeWindow(w, h) {
    var g = new THREE.Group();
    var frameMat = mat(0xf5f5f0);
    var glassMat = mat(0x9fd8f0, { transparent: true, opacity: 0.55 });
    var fr = 0.07;
    var glass = new THREE.Mesh(new THREE.BoxGeometry(w - fr * 2, h - fr * 2, 0.06), glassMat);
    glass.position.z = 0.02; glass.castShadow = true;
    g.add(glass);
    var top = new THREE.Mesh(new THREE.BoxGeometry(w, fr, 0.1), frameMat); top.position.y = h / 2 - fr / 2;
    var bottom = new THREE.Mesh(new THREE.BoxGeometry(w, fr, 0.1), frameMat); bottom.position.y = -h / 2 + fr / 2;
    var left = new THREE.Mesh(new THREE.BoxGeometry(fr, h, 0.1), frameMat); left.position.x = -w / 2 + fr / 2;
    var right = new THREE.Mesh(new THREE.BoxGeometry(fr, h, 0.1), frameMat); right.position.x = w / 2 - fr / 2;
    var mid = new THREE.Mesh(new THREE.BoxGeometry(fr, h - fr * 2, 0.1), frameMat);
    g.add(top); g.add(bottom); g.add(left); g.add(right); g.add(mid);
    g.traverse(function (c) { if (c.isMesh) c.castShadow = true; });
    g.userData.kind = 'window'; g.userData.w = w; g.userData.h = h;
    return g;
  }
  function makeDoor(w, h, colorHex) {
    var g = new THREE.Group();
    var panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), makePartMaterial(colorHex || '#6b4a2b', 'wood'));
    panel.castShadow = true;
    g.add(panel);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xd8b84a));
    knob.position.set(w / 2 - 0.12, 0, 0.08);
    g.add(knob);
    g.userData.kind = 'door'; g.userData.w = w; g.userData.h = h;
    return g;
  }

  /* ============================================================
     MOBILIE (katalog i gjerë)
     ============================================================ */
  function makeFurniture(type) {
    var g = new THREE.Group();
    var wood = mat(0x8b5a2b), woodLight = mat(0xc9a06b), dark = mat(0x4a3a28), fabric = mat(0x7a8a5a), white = mat(0xf5f5f0), metal = mat(0x9aa0a6), screen = mat(0x2c3e50), cushion = mat(0xb8c4a0), counter = mat(0xc9c2b0), steel = mat(0xcfd3d6);
    function box(w, h, d, m, x, y, z, ry) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      if (ry) b.rotation.y = ry;
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
      return b;
    }
    switch (type) {
      case 'bed':
        box(1.9, 0.3, 1.1, wood, 0, 0.3, 0);
        box(1.9, 0.18, 1.1, white, 0, 0.54, 0);
        box(1.9, 0.55, 0.14, wood, 0, 0.55, -0.55);
        box(0.12, 0.55, 1.1, wood, -0.9, 0.55, 0);
        box(0.12, 0.55, 1.1, wood, 0.9, 0.55, 0);
        box(0.55, 0.12, 0.12, woodLight, 0.6, 0.78, 0.35);
        break;
      case 'sofa':
        box(1.8, 0.35, 0.85, fabric, 0, 0.28, 0);
        box(1.8, 0.5, 0.18, fabric, 0, 0.45, -0.38);
        box(0.18, 0.5, 0.85, fabric, -0.85, 0.45, 0);
        box(0.18, 0.5, 0.85, fabric, 0.85, 0.45, 0);
        box(0.5, 0.12, 0.5, cushion, -0.55, 0.72, -0.1);
        break;
      case 'armchair':
        box(0.8, 0.32, 0.75, fabric, 0, 0.26, 0);
        box(0.8, 0.45, 0.16, fabric, 0, 0.42, -0.34);
        box(0.16, 0.45, 0.75, fabric, -0.34, 0.42, 0);
        box(0.16, 0.45, 0.75, fabric, 0.34, 0.42, 0);
        box(0.4, 0.1, 0.42, cushion, 0, 0.62, -0.08);
        break;
      case 'table':
        box(1.4, 0.08, 0.8, wood, 0, 0.72, 0);
        box(0.08, 0.72, 0.08, wood, -0.6, 0.36, -0.3);
        box(0.08, 0.72, 0.08, wood, 0.6, 0.36, -0.3);
        box(0.08, 0.72, 0.08, wood, -0.6, 0.36, 0.3);
        box(0.08, 0.72, 0.08, wood, 0.6, 0.36, 0.3);
        break;
      case 'coffee-table':
        box(1.1, 0.06, 0.6, wood, 0, 0.4, 0);
        box(0.06, 0.4, 0.06, wood, -0.48, 0.2, -0.24);
        box(0.06, 0.4, 0.06, wood, 0.48, 0.2, -0.24);
        box(0.06, 0.4, 0.06, wood, -0.48, 0.2, 0.24);
        box(0.06, 0.4, 0.06, wood, 0.48, 0.2, 0.24);
        break;
      case 'chair':
        box(0.45, 0.06, 0.45, wood, 0, 0.45, 0);
        box(0.45, 0.5, 0.06, wood, 0, 0.7, -0.2);
        box(0.06, 0.45, 0.06, wood, -0.19, 0.22, -0.19);
        box(0.06, 0.45, 0.06, wood, 0.19, 0.22, -0.19);
        box(0.06, 0.45, 0.06, wood, -0.19, 0.22, 0.19);
        box(0.06, 0.45, 0.06, wood, 0.19, 0.22, 0.19);
        break;
      case 'desk':
        box(1.4, 0.06, 0.7, wood, 0, 0.74, 0);
        box(0.06, 0.74, 0.06, wood, -0.6, 0.37, -0.28);
        box(0.06, 0.74, 0.06, wood, 0.6, 0.37, -0.28);
        box(0.06, 0.74, 0.06, wood, -0.6, 0.37, 0.28);
        box(0.06, 0.74, 0.06, wood, 0.6, 0.37, 0.28);
        box(0.3, 0.3, 0.02, screen, 0, 0.92, -0.25);
        break;
      case 'wardrobe':
        box(1.1, 1.9, 0.55, wood, 0, 0.95, 0);
        box(0.04, 1.86, 0.51, woodLight, -0.26, 0.95, 0.02);
        box(0.04, 1.86, 0.51, woodLight, 0.26, 0.95, 0.02);
        break;
      case 'shelf':
        box(1.3, 1.5, 0.35, wood, 0, 0.75, 0);
        box(1.3, 0.05, 0.3, woodLight, 0, 0.5, 0);
        box(1.3, 0.05, 0.3, woodLight, 0, 1.0, 0);
        break;
      case 'bookcase':
        box(1.4, 1.9, 0.35, wood, 0, 0.95, 0);
        for (var i = 0; i < 4; i++) box(1.4, 0.04, 0.3, woodLight, 0, 0.35 + i * 0.4, 0);
        break;
      case 'tv':
        box(1.4, 0.05, 0.4, dark, 0, 0.55, 0);
        box(1.1, 0.62, 0.06, screen, 0, 0.9, 0.2);
        box(0.08, 0.55, 0.08, metal, -0.6, 0.27, -0.12);
        box(0.08, 0.55, 0.08, metal, 0.6, 0.27, -0.12);
        break;
      case 'tv-stand':
        box(1.6, 0.5, 0.45, wood, 0, 0.25, 0);
        box(1.6, 0.06, 0.45, woodLight, 0, 0.53, 0);
        break;
      case 'lamp':
        box(0.3, 0.05, 0.3, wood, 0, 0.3, 0);
        box(0.06, 0.3, 0.06, metal, 0, 0.48, 0);
        box(0.28, 0.2, 0.28, new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffe08a, emissiveIntensity: 0.5 }), 0, 0.72, 0);
        break;
      case 'floor-lamp':
        box(0.35, 0.05, 0.35, metal, 0, 0.03, 0);
        box(0.05, 1.4, 0.05, metal, 0, 0.72, 0);
        var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.4, 16), new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffe08a, emissiveIntensity: 0.45 }));
        shade.position.y = 1.6; g.add(shade);
        break;
      case 'kitchen-counter':
        box(1.6, 0.85, 0.6, counter, 0, 0.42, 0);
        box(1.56, 0.06, 0.56, steel, 0, 0.88, 0);
        break;
      case 'stove':
        box(0.6, 0.85, 0.6, white, 0, 0.42, 0);
        box(0.56, 0.05, 0.56, dark, 0, 0.88, 0);
        box(0.18, 0.02, 0.18, metal, -0.15, 0.9, -0.15);
        box(0.18, 0.02, 0.18, metal, 0.15, 0.9, -0.15);
        box(0.18, 0.02, 0.18, metal, -0.15, 0.9, 0.15);
        box(0.18, 0.02, 0.18, metal, 0.15, 0.9, 0.15);
        break;
      case 'fridge':
        box(0.8, 1.8, 0.7, steel, 0, 0.9, 0);
        box(0.04, 1.75, 0.6, mat(0xffffff), -0.4, 0.9, 0.02);
        break;
      case 'sink':
        box(0.8, 0.85, 0.6, counter, 0, 0.42, 0);
        box(0.5, 0.08, 0.4, steel, 0, 0.88, 0);
        box(0.05, 0.35, 0.05, metal, 0.2, 1.05, 0);
        break;
      case 'toilet':
        box(0.4, 0.4, 0.5, white, 0, 0.2, 0);
        box(0.45, 0.06, 0.5, white, 0, 0.45, -0.05);
        box(0.45, 0.4, 0.06, white, 0, 0.68, -0.27);
        break;
      case 'bathtub':
        var tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.75), white);
        tub.position.y = 0.27; g.add(tub);
        var inner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.6), mat(0xeef6ff));
        inner.position.set(0, 0.5, 0); g.add(inner);
        break;
      case 'shower':
        box(0.9, 0.08, 0.9, white, 0, 0.04, 0);
        box(0.05, 2.0, 0.05, steel, -0.45, 1.0, -0.45);
        box(0.05, 2.0, 0.05, steel, 0.45, 1.0, -0.45);
        box(0.05, 2.0, 0.05, steel, -0.45, 1.0, 0.45);
        box(0.05, 2.0, 0.05, steel, 0.45, 1.0, 0.45);
        box(0.08, 0.08, 0.08, metal, 0.2, 1.9, -0.3);
        break;
      case 'rug':
        box(1.8, 0.03, 1.2, fabric, 0, 0.015, 0);
        break;
      case 'plant':
        box(0.3, 0.3, 0.3, mat(0x9a6b40), 0, 0.15, 0);
        var pot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat(0x3d6b2f));
        pot.position.y = 0.55; g.add(pot);
        break;
      case 'mirror':
        box(0.7, 1.0, 0.06, mat(0xd8b84a), 0, 0.9, 0);
        box(0.6, 0.9, 0.03, mat(0xcfe6f5), 0, 0.9, 0.04);
        break;
      case 'oven':
        box(0.6, 0.85, 0.6, white, 0, 0.42, 0);
        box(0.5, 0.5, 0.04, dark, 0, 0.6, 0.3);
        box(0.04, 0.04, 0.04, metal, -0.18, 0.6, 0.32);
        break;
      case 'dishwasher':
        box(0.6, 0.85, 0.6, steel, 0, 0.42, 0);
        box(0.5, 0.4, 0.04, white, 0, 0.55, 0.31);
        break;
      case 'washing-machine':
        var wm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 20), white);
        wm.position.y = 0.35; g.add(wm);
        var wmd = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), dark);
        wmd.position.set(0, 0.5, 0.33); g.add(wmd);
        break;
      case 'piano':
        box(1.4, 0.35, 0.5, dark, 0, 0.75, 0);
        box(0.5, 0.65, 0.4, dark, -0.2, 1.15, -0.05);
        box(1.4, 0.1, 0.25, white, 0, 0.95, 0.22);
        break;
      case 'desk-chair':
        box(0.45, 0.06, 0.45, dark, 0, 0.5, 0);
        box(0.45, 0.5, 0.06, dark, 0, 0.75, -0.2);
        box(0.05, 0.5, 0.05, metal, 0, 0.25, 0);
        box(0.4, 0.03, 0.4, metal, 0, 0.04, 0);
        break;
      case 'vase':
        var vz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.4, 12), mat(0x6b8e23));
        vz.position.y = 0.2; g.add(vz);
        var vstem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), mat(0x2f6b2a));
        vstem.position.y = 0.55; g.add(vstem);
        var vfl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xe74c3c));
        vfl.position.y = 0.75; g.add(vfl);
        break;
      case 'curtains':
        box(1.6, 0.05, 0.05, metal, 0, 2.2, 0);
        box(0.7, 2.0, 0.08, mat(0xb8c4a0), -0.4, 1.1, 0.05);
        box(0.7, 2.0, 0.08, mat(0xb8c4a0), 0.4, 1.1, 0.05);
        break;
    }
    g.userData.kind = 'furniture';
    g.userData.furnType = type;
    return g;
  }

  function makeOutdoor(type) {
    var g = new THREE.Group();
    var wood = mat(0x8b5a2b), metal = mat(0x9aa0a6), green = mat(0x3d6b2f), leaf = mat(0x4a7a35);
    function box(w, h, d, m, x, y, z) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
      return b;
    }
    switch (type) {
      case 'tree':
        box(0.22, 1.8, 0.22, mat(0x6b4a2b), 0, 0.9, 0);
        var l1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 8), leaf); l1.position.y = 2.2; l1.castShadow = true; g.add(l1);
        var l2 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.1, 8), green); l2.position.y = 3.0; l2.castShadow = true; g.add(l2);
        break;
      case 'flowerbed':
        box(0.9, 0.25, 0.6, mat(0x8a7355), 0, 0.125, 0);
        for (var i = 0; i < 4; i++) {
          var fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat([0xe74c3c, 0xf1c40f, 0xff6b9d, 0x9b59b6][i]));
          fl.position.set(-0.3 + i * 0.2, 0.42, 0); g.add(fl);
        }
        break;
      case 'fence':
        box(2.4, 0.9, 0.05, mat(0xc9b896), 0, 0.45, 0);
        box(0.07, 1.0, 0.07, mat(0x8a7355), -1.15, 0.5, 0);
        box(0.07, 1.0, 0.07, mat(0x8a7355), 0, 0.5, 0);
        box(0.07, 1.0, 0.07, mat(0x8a7355), 1.15, 0.5, 0);
        break;
      case 'hedge':
        box(2.2, 1.1, 0.6, green, 0, 0.55, 0);
        break;
      case 'pool':
        box(4.3, 0.14, 2.8, mat(0xf0f0ee), 0, 0.06, 0);
        box(3.95, 0.1, 2.45, mat(0x86c7e0, { transparent: true, opacity: 0.45 }), 0, 0.1, 0);
        var poolWater = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.05, 2.4), new THREE.MeshLambertMaterial({ color: 0x37a6d8, emissive: 0x0d4a70, emissiveIntensity: 0.4, transparent: true, opacity: 0.75 }));
        poolWater.position.set(0, 0.15, 0); g.add(poolWater);
        box(0.1, 0.55, 0.55, metal, 1.85, 0.32, 1.0);
        box(0.1, 0.55, 0.55, metal, 1.85, 0.32, 0.7);
        break;
      case 'grill':
        box(0.05, 0.6, 0.05, metal, -0.25, 0.25, 0);
        box(0.05, 0.6, 0.05, metal, 0.25, 0.25, 0);
        var bowl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), mat(0x2c2c2c));
        bowl.scale.y = 0.5; bowl.position.y = 0.55; g.add(bowl);
        break;
      case 'garden-set':
        box(1.0, 0.06, 0.6, wood, 0, 0.7, 0);
        box(0.06, 0.7, 0.06, wood, -0.4, 0.35, -0.2);
        box(0.06, 0.7, 0.06, wood, 0.4, 0.35, -0.2);
        box(0.06, 0.7, 0.06, wood, -0.4, 0.35, 0.2);
        box(0.06, 0.7, 0.06, wood, 0.4, 0.35, 0.2);
        for (var c = -1; c <= 1; c += 2) {
          box(0.5, 0.05, 0.5, wood, c * 0.9, 0.42, 0);
          box(0.5, 0.4, 0.05, wood, c * 0.9, 0.62, -0.22);
          box(0.05, 0.42, 0.05, wood, c * 0.9 - 0.2, 0.21, -0.2);
          box(0.05, 0.42, 0.05, wood, c * 0.9 + 0.2, 0.21, -0.2);
          box(0.05, 0.42, 0.05, wood, c * 0.9 - 0.2, 0.21, 0.2);
          box(0.05, 0.42, 0.05, wood, c * 0.9 + 0.2, 0.21, 0.2);
        }
        break;
      case 'garden-lamp':
        box(0.08, 1.6, 0.08, metal, 0, 0.8, 0);
        var gl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffd966, emissiveIntensity: 0.6 }));
        gl.position.y = 1.7; g.add(gl);
        break;
      case 'mailbox':
        box(0.08, 1.0, 0.08, metal, 0, 0.5, 0);
        box(0.3, 0.25, 0.4, mat(0x2c5f8a), 0, 1.15, 0.1);
        break;
    }
    g.userData.kind = 'furniture';
    g.userData.furnType = 'outdoor_' + type;
    return g;
  }

  /* ============================================================
     SHTËPITË E GATSHME
     ============================================================ */
  var HOUSES = [
    { id: 'modern', ico: '🏠', label: 'Shtëpi Moderne' },
    { id: 'traditional', ico: '🏡', label: 'Shtëpi Tradicionale' },
    { id: 'villa', ico: '🏰', label: 'Vilë (2 kate)' },
    { id: 'cottage', ico: '🛖', label: 'Shtëpi Fshati' }
  ];

  function buildReadyHouse(type) {
    allParts.slice().forEach(function (p) { scene.remove(p); disposeObj(p); });
    allParts = [];
    undoStack.length = 0; redoStack.length = 0;
    state.floorCount = 1; state.currentFloor = 0;
    deselectPart();

    var CREAM = '#f2efe6', WOOD = '#8b5a2b', SLATE = '#4a4a52', ROOFD = '#5a4a3a';
    var parts = [];
    function put(mesh, x, y, z, rotY, floor) {
      mesh.position.set(x, y, z);
      if (rotY) mesh.rotation.y = rotY;
      mesh.userData.floor = floor || 0;
      parts.push(mesh);
    }
    function wall(w, x, z, rotY, color, floor) {
      put(makeWallMesh(w, WALL_H, 0.25, color || CREAM, 'plaster'), x, (floor || 0) * FLOOR_H + WALL_H / 2, z, rotY, floor);
    }
    function win(w, h, x, y, z, rotY, floor) {
      put(makeWindow(w, h), x, (floor || 0) * FLOOR_H + y, z, rotY, floor);
    }
    function door(w, h, x, z, rotY, floor) {
      put(makeDoor(w, h, WOOD), x, (floor || 0) * FLOOR_H + h / 2, z, rotY, floor);
    }
    function furn(t, x, z, rotY, floor) {
      put(makeFurniture(t), x, (floor || 0) * FLOOR_H, z, rotY, floor);
    }

    if (type === 'modern') {
      wall(10, 0, -4, 0); wall(10, 0, 4, 0); wall(8, -5, 0, Math.PI / 2); wall(8, 5, 0, Math.PI / 2);
      win(2, 1.3, -3, 1.7, -4.15, 0); win(2, 1.3, 3, 1.7, -4.15, 0);
      win(1.4, 1.2, -2.2, 1.8, 4.15, 0); win(1.4, 1.2, 2.2, 1.8, 4.15, 0);
      win(1.6, 1.2, -5.15, 1.8, -2, Math.PI / 2); win(1.6, 1.2, 5.15, 1.8, 2, Math.PI / 2);
      door(1.3, 2.2, 0, 4.15, 0);
      put(makeFlatRoof(10.6, 8.6, SLATE, 'metal'), 0, WALL_H + 0.12, 0, 0);
      furn('sofa', -2.2, -2.6, 0); furn('coffee-table', -2.2, -1.7, 0); furn('tv', -2.2, -3.5, Math.PI);
      furn('kitchen-counter', 3.2, -2.9, 0); furn('sink', 3.2, -2.0, 0); furn('fridge', 4.3, -3.2, 0);
      furn('bed', 3.3, 2.6, 0); furn('lamp', -4.3, 2.6, 0); furn('rug', 0.5, 0.5, 0);
    } else if (type === 'traditional') {
      wall(8, 0, -3, 0); wall(8, 0, 3, 0); wall(6, -4, 0, Math.PI / 2); wall(6, 4, 0, Math.PI / 2);
      win(1.4, 1.2, -2, 2.1, -3.15, 0); win(1.4, 1.2, 2, 2.1, -3.15, 0);
      win(1.2, 1.1, -4.15, 2.0, -1.5, Math.PI / 2); win(1.2, 1.1, 4.15, 2.0, 1.5, Math.PI / 2);
      door(1.3, 2.2, 0, 3.15, 0);
      put(makeGableRoof(8.8, 6.8, 1.8, ROOFD, 'wood'), 0, WALL_H, 0, 0);
      put(makeChimney('#8a6a4a', 'brick'), 2.5, WALL_H + 0.8, -1.8, 0);
      furn('sofa', -2.2, -2, 0); furn('table', 1.8, -2, 0); furn('chair', 1.2, -1.2, 0); furn('chair', 2.4, -1.2, 0);
      furn('bed', 2.6, 2, Math.PI / 2); furn('shelf', -3.2, 2.2, Math.PI / 2); furn('lamp', -0.5, 0.5, 0);
    } else if (type === 'villa') {
      wall(12, 0, -4, 0); wall(12, 0, 4, 0); wall(8, -6, 0, Math.PI / 2); wall(8, 6, 0, Math.PI / 2);
      win(2, 1.3, -4, 1.7, -4.15, 0); win(2, 1.3, 4, 1.7, -4.15, 0);
      win(1.4, 1.2, -2, 1.8, 4.15, 0); win(1.4, 1.2, 2, 1.8, 4.15, 0);
      door(1.5, 2.3, 0, 4.15, 0);
      furn('sofa', -3, -2.6, 0); furn('coffee-table', -3, -1.7, 0); furn('tv', -3, -3.5, Math.PI);
      furn('kitchen-counter', 3, -2.9, 0); furn('table', 3.2, 1.6, 0); furn('chair', 2.6, 1.0, 0);
      put(makeStairs('#c9c2b0', 'concrete'), -4.5, 0, -2.5, Math.PI / 2, 0);
      state.floorCount = 2;
      put(makeSlab(12.6, 8.6, '#c9c2b0', 'wood'), 0, FLOOR_H, 0, 0, 0);
      wall(12, 0, -4, 0, CREAM, 1); wall(12, 0, 4, 0, CREAM, 1); wall(8, -6, 0, Math.PI / 2, CREAM, 1); wall(8, 6, 0, Math.PI / 2, CREAM, 1);
      win(1.5, 1.2, -4, 1.7, -4.15, 0, 1); win(1.5, 1.2, 4, 1.7, -4.15, 0, 1);
      win(1.5, 1.2, -2, 1.7, 4.15, 0, 1); win(1.5, 1.2, 2, 1.7, 4.15, 0, 1);
      furn('bed', -3.5, 2.6, 0, 1); furn('bed', 3.5, 2.6, 0, 1); furn('wardrobe', -5, -2, Math.PI / 2, 1);
      furn('bathtub', 4, -2, 0, 1); furn('toilet', 5, -1, 0, 1); furn('sink', 2, -3, 0, 1);
      put(makeFlatRoof(12.6, 8.6, SLATE, 'metal'), 0, FLOOR_H + WALL_H + 0.12, 0, 0);
      put(makeOutdoor('pool'), 0, 0, 8, 0, 0);
      put(makeOutdoor('tree'), -7, 0, 5, 0, 0);
      put(makeOutdoor('tree'), 7, 0, 5, 0, 0);
    } else if (type === 'cottage') {
      wall(6, 0, -2.5, 0); wall(6, 0, 2.5, 0); wall(5, -3, 0, Math.PI / 2); wall(5, 3, 0, Math.PI / 2);
      win(1.2, 1.1, -1.5, 1.8, -2.65, 0); win(1.2, 1.1, 1.5, 1.8, -2.65, 0);
      door(1.1, 2.1, 0, 2.65, 0);
      put(makePyramidRoof(7, 6, 1.6, ROOFD, 'wood'), 0, WALL_H + 0.8, 0, 0);
      furn('bed', -1.8, -1.3, 0); furn('sofa', 1.5, -1.5, 0); furn('table', 1.5, 1.2, 0); furn('chair', 1.5, 1.8, 0);
      furn('lamp', -2.2, 1.4, 0); furn('rug', 0, 0, 0);
    }

    parts.forEach(function (p) { scene.add(p); allParts.push(p); });
    buildFloorBar();
    enter3D();
    resetCamera();
    guideNotify('wall');
    toast('🏠 Shtëpia u ndërtua — tani mund ta redaktosh ose të futesh brenda!');
  }

  /* ============================================================
     MJETET / TOOLS
     ============================================================ */
  var TOOLS = {
    build: [
      { id: 'wall', ico: '🧱', label: 'Mur', kind: 'wall' },
      { id: 'window', ico: '🪟', label: 'Dritare', kind: 'window', make: function () { return makeWindow(1.1, 1.0); } },
      { id: 'window-big', ico: '🪟', label: 'Dritare e madhe', kind: 'window', make: function () { return makeWindow(1.8, 1.3); } },
      { id: 'door', ico: '🚪', label: 'Derë', kind: 'door', make: function () { return makeDoor(1.0, 2.1, '#6b4a2b'); } },
      { id: 'roof-gable', ico: '🔺', label: 'Kulm trekëndësh', kind: 'place', yOff: WALL_H, make: function () { return makeGableRoof(4.6, 3, 1.8, selectedColor, selectedMaterial); } },
      { id: 'roof-pyramid', ico: '⛺', label: 'Kulm piramidë', kind: 'place', yOff: WALL_H, make: function () { return makePyramidRoof(3.4, 3.4, 1.6, selectedColor, selectedMaterial); } },
      { id: 'roof-flat', ico: '▬', label: 'Kulm i sheshtë', kind: 'place', yOff: WALL_H, make: function () { return makeFlatRoof(4.6, 3.4, selectedColor, selectedMaterial); } },
      { id: 'chimney', ico: '🏭', label: 'Oxhak', kind: 'place', yOff: WALL_H, make: function () { return makeChimney(selectedColor, selectedMaterial); } }
    ],
    furniture: [
      { id: 'bed', ico: '🛏️', label: 'Krevat', kind: 'place', make: function () { return makeFurniture('bed'); } },
      { id: 'sofa', ico: '🛋️', label: 'Divan', kind: 'place', make: function () { return makeFurniture('sofa'); } },
      { id: 'armchair', ico: '🪑', label: 'Fotele', kind: 'place', make: function () { return makeFurniture('armchair'); } },
      { id: 'table', ico: '🍽️', label: 'Tavolinë', kind: 'place', make: function () { return makeFurniture('table'); } },
      { id: 'coffee-table', ico: '☕', label: 'Tavolinë kafeje', kind: 'place', make: function () { return makeFurniture('coffee-table'); } },
      { id: 'chair', ico: '💺', label: 'Karrige', kind: 'place', make: function () { return makeFurniture('chair'); } },
      { id: 'desk', ico: '🖥️', label: 'Tavolinë pune', kind: 'place', make: function () { return makeFurniture('desk'); } },
      { id: 'wardrobe', ico: '🚪', label: 'Garderobë', kind: 'place', make: function () { return makeFurniture('wardrobe'); } },
      { id: 'shelf', ico: '📚', label: 'Raft', kind: 'place', make: function () { return makeFurniture('shelf'); } },
      { id: 'bookcase', ico: '📖', label: 'Bibliotekë', kind: 'place', make: function () { return makeFurniture('bookcase'); } },
      { id: 'tv', ico: '📺', label: 'TV', kind: 'place', make: function () { return makeFurniture('tv'); } },
      { id: 'tv-stand', ico: '🗄️', label: 'Komodinë TV', kind: 'place', make: function () { return makeFurniture('tv-stand'); } },
      { id: 'lamp', ico: '💡', label: 'Llambë', kind: 'place', make: function () { return makeFurniture('lamp'); } },
      { id: 'floor-lamp', ico: '🛋️', label: 'Llambë dysh.', kind: 'place', make: function () { return makeFurniture('floor-lamp'); } },
      { id: 'kitchen-counter', ico: '🔪', label: 'Banak', kind: 'place', make: function () { return makeFurniture('kitchen-counter'); } },
      { id: 'stove', ico: '🍳', label: 'Sobë', kind: 'place', make: function () { return makeFurniture('stove'); } },
      { id: 'fridge', ico: '🧊', label: 'Frigorifer', kind: 'place', make: function () { return makeFurniture('fridge'); } },
      { id: 'sink', ico: '🚰', label: 'Lavaman', kind: 'place', make: function () { return makeFurniture('sink'); } },
      { id: 'toilet', ico: '🚽', label: 'Tualet', kind: 'place', make: function () { return makeFurniture('toilet'); } },
      { id: 'bathtub', ico: '🛁', label: 'Vaskë', kind: 'place', make: function () { return makeFurniture('bathtub'); } },
      { id: 'shower', ico: '🚿', label: 'Dush', kind: 'place', make: function () { return makeFurniture('shower'); } },
      { id: 'rug', ico: '🧶', label: 'Qilim', kind: 'place', make: function () { return makeFurniture('rug'); } },
      { id: 'plant', ico: '🪴', label: 'Bimë', kind: 'place', make: function () { return makeFurniture('plant'); } },
      { id: 'mirror', ico: '🪞', label: 'Pasqyrë', kind: 'place', make: function () { return makeFurniture('mirror'); } },
      { id: 'oven', ico: '🍕', label: 'Furrë', kind: 'place', make: function () { return makeFurniture('oven'); } },
      { id: 'dishwasher', ico: '🍽️', label: 'Lavastovilje', kind: 'place', make: function () { return makeFurniture('dishwasher'); } },
      { id: 'washing-machine', ico: '🧺', label: 'Lavatriçe', kind: 'place', make: function () { return makeFurniture('washing-machine'); } },
      { id: 'piano', ico: '🎹', label: 'Piano', kind: 'place', make: function () { return makeFurniture('piano'); } },
      { id: 'desk-chair', ico: '🪑', label: 'Karrige zyre', kind: 'place', make: function () { return makeFurniture('desk-chair'); } },
      { id: 'vase', ico: '🏺', label: 'Vazo', kind: 'place', make: function () { return makeFurniture('vase'); } },
      { id: 'curtains', ico: '🪟', label: 'Perde', kind: 'place', make: function () { return makeFurniture('curtains'); } }
    ],
    struct: [
      { id: 'foundation', ico: '🟫', label: 'Themel', kind: 'foundation' },
      { id: 'slab', ico: '◼️', label: 'Pllakë kati', kind: 'slab' },
      { id: 'stairs', ico: '🪜', label: 'Shkallë', kind: 'place', yOff: 0, make: function () { return makeStairs(selectedColor, selectedMaterial); } }
    ],
    outdoor: [
      { id: 'tree', ico: '🌳', label: 'Pemë', kind: 'place', make: function () { return makeOutdoor('tree'); } },
      { id: 'flowerbed', ico: '🌷', label: 'Shtrat lulesh', kind: 'place', make: function () { return makeOutdoor('flowerbed'); } },
      { id: 'fence', ico: '🚧', label: 'Gardh', kind: 'place', make: function () { return makeOutdoor('fence'); } },
      { id: 'hedge', ico: '🌿', label: 'Gjerdh i gjelbër', kind: 'place', make: function () { return makeOutdoor('hedge'); } },
      { id: 'pool', ico: '🏊', label: 'Pishinë', kind: 'place', make: function () { return makeOutdoor('pool'); } },
      { id: 'grill', ico: '🍖', label: 'Barbekju', kind: 'place', make: function () { return makeOutdoor('grill'); } },
      { id: 'garden-set', ico: '🪑', label: 'Set kopshti', kind: 'place', make: function () { return makeOutdoor('garden-set'); } },
      { id: 'garden-lamp', ico: '💡', label: 'Llambë kopshti', kind: 'place', make: function () { return makeOutdoor('garden-lamp'); } },
      { id: 'mailbox', ico: '📮', label: 'Kuti postare', kind: 'place', make: function () { return makeOutdoor('mailbox'); } }
    ]
  };

  var activeTab = 'house';
  var currentTool = null;     // tool object OR null (pamje)
  var editMode = false;       // true kur një mjet/veprim është aktiv
  var modeAction = null;      // 'build' | 'paint' | 'move' | 'delete' | null
  var placeRot = 0;
  var snapOn = false;
  var shiftHeld = false;

  var ghost = null;
  var wallDraw = null;
  var rectDraw = null;        // për themel/pllakë (drag-drejtkëndësh)
  var selectedPart = null;
  var selectionBox = null;
  var moveStart = null;       // { pos, ry } origjinale për undo
  var resizeTarget = null;
  var resizeStartW = 0, resizeStartH = 0;

  var floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function baseY() { return state.currentFloor * FLOOR_H; }
  function effectiveSnap() { return snapOn !== shiftHeld; }
  function snapVal(v) { return Math.round(v / SNAP_STEP) * SNAP_STEP; }

  function genId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function topPart(obj) {
    var o = obj;
    while (o) {
      if (o.userData && o.userData.id) return o;
      o = o.parent;
    }
    return null;
  }

  function setRay(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }
  function pointOnFloor(e) {
    floorPlane.constant = -baseY();
    var p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(floorPlane, p) ? p : null;
  }
  function hitParts(e) {
    var hits = raycaster.intersectObjects(scene.children, true);
    var parts = [];
    for (var i = 0; i < hits.length; i++) {
      var tp = topPart(hits[i].object);
      if (tp && parts.indexOf(tp) === -1) parts.push(tp);
    }
    return parts;
  }

  /* ---------- add / remove me undo/redo ---------- */
  function addPart(obj, silent) {
    obj.userData.id = obj.userData.id || genId();
    obj.userData.floor = (obj.userData.floor === undefined) ? state.currentFloor : obj.userData.floor;
    if (obj.userData.color === undefined) obj.userData.color = selectedColor;
    if (obj.userData.material === undefined) obj.userData.material = selectedMaterial;
    scene.add(obj);
    allParts.push(obj);
    if (!silent) {
      broadcast({ t: 'place', part: serializePart(obj) });
      var _sid = stepIdForKind(obj.userData.kind);
      if (_sid) guideNotify(_sid);
    }
    return obj;
  }
  function removePart(obj, silent) {
    var i = allParts.indexOf(obj);
    if (i === -1) return;
    allParts.splice(i, 1);
    scene.remove(obj);
    if (obj === selectedPart) deselectPart();
    if (!silent) broadcast({ t: 'remove', id: obj.userData.id });
  }

  function pushUndo(undoFn, redoFn) {
    undoStack.push({ undo: undoFn, redo: redoFn });
    redoStack.length = 0;
  }
  function undoLast() {
    if (!undoStack.length) { toast('⚠️ Asgjë për të zhbërë'); return; }
    var a = undoStack.pop();
    a.undo();
    redoStack.push(a);
    toast('↩️ U zhbë');
  }
  function redoLast() {
    if (!redoStack.length) { toast('⚠️ Asgjë për të ribërë'); return; }
    var a = redoStack.pop();
    a.redo();
    undoStack.push(a);
    toast('↪️ U ribë');
  }

  /* ---------- ghost preview ---------- */
  function makeGhost() {
    var obj = currentTool.make();
    obj.traverse(function (c) {
      if (c.material) { c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; }
    });
    obj.userData.ghost = true;
    scene.add(obj);
    return obj;
  }
  function clearGhost() {
    if (ghost) { scene.remove(ghost); disposeObj(ghost); ghost = null; }
  }
  function updateGhost(e) {
    var p = pointOnFloor(e);
    if (!p) return;
    if (!ghost) ghost = makeGhost();
    ghost.visible = true;
    ghost.position.set(p.x, baseY() + (currentTool.yOff || 0), p.z);
    ghost.rotation.y = placeRot;
  }
  function applySnapToVec(p) {
    if (effectiveSnap()) { p.x = snapVal(p.x); p.z = snapVal(p.z); }
    return p;
  }

  /* ---------- paint ---------- */
  function paintPart(obj, colorHex, matId, silent) {
    var oldColor = obj.userData.color, oldMat = obj.userData.material;
    var apply = function () {
      obj.userData.color = colorHex; obj.userData.material = matId;
      obj.traverse(function (c) {
        if (c.isMesh && c.material) {
          if (matId === 'glass') { c.material.transparent = true; c.material.opacity = 0.45; c.material.map = null; c.material.color.set(hexColor(colorHex)); }
          else if (!matId || matId === 'smooth') { c.material.transparent = false; c.material.opacity = 1; c.material.map = null; c.material.color.set(hexColor(colorHex)); }
          else { c.material.transparent = false; c.material.opacity = 1; c.material.map = getTexture(matId); c.material.color.set(hexColor(colorHex)); }
          c.material.needsUpdate = true;
        }
      });
    };
    apply();
    if (!silent) {
      broadcast({ t: 'paint', id: obj.userData.id, color: colorHex, material: matId });
      guideNotify('paint');
      pushUndo(function () { paintPart(obj, oldColor, oldMat, true); }, function () { paintPart(obj, colorHex, matId, true); });
    }
  }

  /* ---------- serialize / restore ---------- */
  function serializePart(p) {
    return {
      id: p.userData.id,
      kind: p.userData.kind,
      furn: p.userData.furnType || null,
      floor: p.userData.floor || 0,
      x: Math.round(p.position.x * 100) / 100,
      y: Math.round(p.position.y * 100) / 100,
      z: Math.round(p.position.z * 100) / 100,
      ry: Math.round(p.rotation.y * 100) / 100,
      w: p.userData.w || null,
      h: p.userData.h || null,
      d: p.userData.d || null,
      roofType: p.userData.roofType || null,
      color: p.userData.color || '#e8e4d8',
      material: p.userData.material || 'smooth'
    };
  }
  function restorePart(p) {
    var obj = null;
    if (p.furn) { obj = p.furn.indexOf('outdoor_') === 0 ? makeOutdoor(p.furn.slice(8)) : makeFurniture(p.furn); }
    else {
      switch (p.kind) {
        case 'wall': obj = makeWallMesh(p.w || 4, p.h || WALL_H, p.d || 0.25, p.color, p.material); break;
        case 'foundation': obj = makeFoundation(p.w || 6, p.d || 6, p.color, p.material); break;
        case 'slab': obj = makeSlab(p.w || 6, p.d || 6, p.color, p.material); break;
        case 'stairs': obj = makeStairs(p.color, p.material); break;
        case 'chimney': obj = makeChimney(p.color, p.material); break;
        case 'window': obj = makeWindow(p.w || 1.1, p.h || 1.0); break;
        case 'door': obj = makeDoor(p.w || 1.0, p.h || 2.1, p.color); break;
        case 'roof':
          if (p.roofType === 'gable') obj = makeGableRoof(p.w || 4.6, p.d || 3, p.h || 1.8, p.color, p.material);
          else if (p.roofType === 'pyramid') obj = makePyramidRoof(p.w || 3.4, p.d || 3.4, p.h || 1.6, p.color, p.material);
          else obj = makeFlatRoof(p.w || 4.6, p.d || 3.4, p.color, p.material);
          break;
        default: obj = makeWallMesh(p.w || 4, p.h || WALL_H, 0.25, p.color, p.material);
      }
    }
    if (obj) {
      obj.userData.id = p.id;
      obj.userData.floor = p.floor || 0;
      obj.userData.color = p.color;
      obj.userData.material = p.material;
      obj.position.set(p.x || 0, p.y || 0, p.z || 0);
      obj.rotation.y = p.ry || 0;
    }
    return obj;
  }

  /* ============================================================
     INTERAKSIONI ME KANVAS
     ============================================================ */
  function onCanvasDown(e) {
    if (insideActive) return;
    if (e.button !== 0) return; // majtas = veprim; djathtas = rrotullim
    setRay(e);
    if (!currentTool && !modeAction) return;

    if (modeAction === 'delete') {
      var partsD = hitParts(e);
      for (var i = 0; i < partsD.length; i++) {
        var obj = partsD[i];
        removePart(obj);
        pushUndo(function (o) { return function () { addPart(o, true); }; }(obj), function (o) { return function () { removePart(o, true); }; }(obj));
        toast('🗑️ U fshi');
        return;
      }
      return;
    }
    if (modeAction === 'paint') {
      var partsP = hitParts(e);
      for (var j = 0; j < partsP.length; j++) { paintPart(partsP[j], selectedColor, selectedMaterial); break; }
      toast('🖌️ U ly pjesa');
      return;
    }
    if (modeAction === 'move') {
      var partsM = hitParts(e);
      if (partsM.length) {
        selectPart(partsM[0]);
        moveStart = { x: selectedPart.position.x, z: selectedPart.position.z, ry: selectedPart.rotation.y };
        var p = pointOnFloor(e);
        if (p) { selectedPart.position.x = p.x; selectedPart.position.z = p.z; }
      } else {
        deselectPart();
      }
      return;
    }
    if (modeAction === 'resize') {
      var hitsR = raycaster.intersectObjects(scene.children, true);
      for (var ri = 0; ri < hitsR.length; ri++) {
        var tpr = topPart(hitsR[ri].object);
        if (tpr && tpr.userData.kind === 'wall') {
          selectPart(tpr);
          showResizePanel(tpr);
          return;
        }
      }
      deselectPart();
      hideResizePanel();
      return;
    }
    if (!currentTool) return;

    var tool = currentTool;
    if (tool.kind === 'wall') {
      var p1 = pointOnFloor(e);
      if (!p1) return;
      applySnapToVec(p1);
      wallDraw = { start: p1.clone(), preview: null, end: p1.clone() };
    } else if (tool.kind === 'foundation' || tool.kind === 'slab') {
      var p2 = pointOnFloor(e);
      if (!p2) return;
      applySnapToVec(p2);
      rectDraw = { start: p2.clone(), preview: null };
    } else if (tool.kind === 'window' || tool.kind === 'door') {
      var hits = raycaster.intersectObjects(scene.children, true);
      for (var k = 0; k < hits.length; k++) {
        var tp = topPart(hits[k].object);
        if (tp && tp.userData.kind === 'wall') {
          placeOnWall(tp, hits[k], tool.make());
          return;
        }
      }
      toast('⚠️ Kliko MBI një mur që ke ndërtuar');
    } else if (tool.kind === 'place') {
      var p3 = pointOnFloor(e);
      if (!p3) return;
      applySnapToVec(p3);
      var part = tool.make();
      part.position.set(p3.x, baseY() + (tool.yOff || 0), p3.z);
      part.rotation.y = placeRot;
      addPart(part);
      pushUndo(function (o) { return function () { removePart(o, true); }; }(part), function (o) { return function () { addPart(o, true); }; }(part));
      toast('✅ U vendos: ' + tool.label);
    }
  }

  function onCanvasMove(e) {
    if (insideActive) return;
    if (!currentTool && !modeAction) return;
    setRay(e);

    if (modeAction === 'move' && selectedPart && moveStart) {
      var p = pointOnFloor(e);
      if (p) { selectedPart.position.x = p.x; selectedPart.position.z = p.z; }
      if (selectionBox) selectionBox.update();
      return;
    }

    if (!currentTool) return;
    var tool = currentTool;

    if (tool.kind === 'wall' && wallDraw) {
      var end = pointOnFloor(e);
      if (!end) return;
      if (effectiveSnap()) { end.x = snapVal(end.x); end.z = snapVal(end.z); }
      var dx = end.x - wallDraw.start.x, dz = end.z - wallDraw.start.z;
      if (effectiveSnap()) {
        var ang = Math.atan2(dz, dx);
        ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
        var len = Math.sqrt(dx * dx + dz * dz);
        end.x = wallDraw.start.x + Math.cos(ang) * len;
        end.z = wallDraw.start.z + Math.sin(ang) * len;
      }
      var len2 = Math.sqrt((end.x - wallDraw.start.x) * (end.x - wallDraw.start.x) + (end.z - wallDraw.start.z) * (end.z - wallDraw.start.z));
      if (len2 < 0.5) { if (wallDraw.preview) wallDraw.preview.visible = false; return; }
      if (!wallDraw.preview) {
        wallDraw.preview = makeWallMesh(1, WALL_H, 0.25, selectedColor, selectedMaterial);
        wallDraw.preview.traverse(function (c) { if (c.material) { c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; } });
        scene.add(wallDraw.preview);
      }
      wallDraw.preview.visible = true;
      wallDraw.preview.position.set((wallDraw.start.x + end.x) / 2, baseY() + WALL_H / 2, (wallDraw.start.z + end.z) / 2);
      wallDraw.preview.scale.x = len2;
      wallDraw.preview.rotation.y = Math.atan2(end.z - wallDraw.start.z, end.x - wallDraw.start.x);
      wallDraw.end = end;
      return;
    }

    if (tool.kind === 'foundation' || tool.kind === 'slab') {
      if (!rectDraw) return;
      var end2 = pointOnFloor(e);
      if (!end2) return;
      if (effectiveSnap()) { end2.x = snapVal(end2.x); end2.z = snapVal(end2.z); }
      var w = Math.abs(end2.x - rectDraw.start.x), d = Math.abs(end2.z - rectDraw.start.z);
      if (w < 0.4 || d < 0.4) { if (rectDraw.preview) rectDraw.preview.visible = false; return; }
      if (!rectDraw.preview) {
        rectDraw.preview = tool.kind === 'foundation'
          ? makeFoundation(1, 1, selectedColor, selectedMaterial)
          : makeSlab(1, 1, selectedColor, selectedMaterial);
        rectDraw.preview.traverse(function (c) { if (c.material) { c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; } });
        scene.add(rectDraw.preview);
      }
      rectDraw.preview.visible = true;
      rectDraw.preview.position.set((rectDraw.start.x + end2.x) / 2, baseY() + 0.06, (rectDraw.start.z + end2.z) / 2);
      rectDraw.preview.scale.x = w;
      rectDraw.preview.scale.z = d;
      rectDraw.end = end2;
      return;
    }

    if (tool.kind === 'place') {
      updateGhost(e);
      return;
    }
    if (ghost) clearGhost();
  }

  function onCanvasUp(e) {
    if (insideActive) return;
    if (e.button !== 0) return;

    if (modeAction === 'move' && selectedPart && moveStart) {
      var o = selectedPart;
      var before = { x: moveStart.x, z: moveStart.z, ry: moveStart.ry };
      var after = { x: o.position.x, z: o.position.z, ry: o.rotation.y };
      pushUndo(
        function () { o.position.x = before.x; o.position.z = before.z; o.rotation.y = before.ry; },
        function () { o.position.x = after.x; o.position.z = after.z; o.rotation.y = after.ry; }
      );
      broadcast({ t: 'move', id: o.userData.id, x: after.x, z: after.z, ry: after.ry });
      moveStart = null;
      return;
    }

    if (!currentTool) return;
    var tool = currentTool;

    if (tool.kind === 'wall' && wallDraw) {
      var end = wallDraw.end || wallDraw.start;
      var dx = end.x - wallDraw.start.x, dz = end.z - wallDraw.start.z;
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len >= 0.5) {
        var wall = makeWallMesh(len, WALL_H, 0.25, selectedColor, selectedMaterial);
        wall.position.set((wallDraw.start.x + end.x) / 2, baseY() + WALL_H / 2, (wallDraw.start.z + end.z) / 2);
        wall.rotation.y = Math.atan2(dz, dx);
        addPart(wall);
        pushUndo(function (o) { return function () { removePart(o, true); }; }(wall), function (o) { return function () { addPart(o, true); }; }(wall));
        toast('🧱 Muri: ' + len.toFixed(1) + ' m');
      }
      if (wallDraw.preview) { scene.remove(wallDraw.preview); disposeObj(wallDraw.preview); }
      wallDraw = null;
    } else if ((tool.kind === 'foundation' || tool.kind === 'slab') && rectDraw) {
      var end2 = rectDraw.end || rectDraw.start;
      var w = Math.abs(end2.x - rectDraw.start.x), d = Math.abs(end2.z - rectDraw.start.z);
      if (w >= 0.4 && d >= 0.4) {
        var slab = tool.kind === 'foundation'
          ? makeFoundation(w, d, selectedColor, selectedMaterial)
          : makeSlab(w, d, selectedColor, selectedMaterial);
        slab.position.set((rectDraw.start.x + end2.x) / 2, baseY() + (tool.kind === 'foundation' ? 0.15 : 0.06), (rectDraw.start.z + end2.z) / 2);
        addPart(slab);
        pushUndo(function (o) { return function () { removePart(o, true); }; }(slab), function (o) { return function () { addPart(o, true); }; }(slab));
        toast(tool.kind === 'foundation' ? '🟫 U vendos themeli' : '◼️ U vendos pllaka e katit');
      }
      if (rectDraw.preview) { scene.remove(rectDraw.preview); disposeObj(rectDraw.preview); }
      rectDraw = null;
    }
  }

  function placeOnWall(wallMesh, hit, part) {
    wallMesh.updateMatrixWorld();
    var local = wallMesh.worldToLocal(hit.point.clone());
    var w = wallMesh.userData.w || 4;
    var d = wallMesh.userData.d || 0.25;
    var h = wallMesh.userData.h || WALL_H;
    var nx = Math.abs(hit.face.normal.x), ny = Math.abs(hit.face.normal.y), nz = Math.abs(hit.face.normal.z);
    var partW = part.userData.w || 1, partH = part.userData.h || 1;
    var margin = partW / 2 + 0.05;
    var localX = Math.max(-w / 2 + margin, Math.min(w / 2 - margin, local.x));
    var localY = part.userData.kind === 'door' ? partH / 2 : (partH / 2 + 0.75);
    var localZ = 0;
    if (nz > nx && nz > ny) localZ = d / 2 + 0.03;
    else if (nx > ny) localZ = Math.max(-d / 2 + 0.03, Math.min(d / 2 - 0.03, local.z));
    var world = wallMesh.localToWorld(new THREE.Vector3(localX, localY, localZ));
    part.position.copy(world);
    part.rotation.y = wallMesh.rotation.y;
    part.userData.floor = wallMesh.userData.floor;
    addPart(part);
    pushUndo(function (o) { return function () { removePart(o, true); }; }(part), function (o) { return function () { addPart(o, true); }; }(part));
    toast('✅ U vendos: ' + currentTool.label);
  }

  /* ---------- selektimi (për move) ---------- */
  function selectPart(obj) {
    deselectPart();
    selectedPart = obj;
    selectionBox = new THREE.BoxHelper(obj, 0x6b8e23);
    scene.add(selectionBox);
  }
  function deselectPart() {
    if (selectionBox) { scene.remove(selectionBox); selectionBox.geometry && selectionBox.geometry.dispose(); selectionBox.material && selectionBox.material.dispose(); selectionBox = null; }
    selectedPart = null;
  }

  /* ---------- resize muri (anash + lart) ---------- */
  function resizeWall(obj, w, h) {
    var d = obj.userData.d || 0.25;
    var ng = new THREE.BoxGeometry(w, h, d);
    obj.geometry.dispose();
    obj.geometry = ng;
    obj.userData.w = w; obj.userData.h = h;
    var fb = (obj.userData.floor || 0) * FLOOR_H;
    obj.position.y = fb + h / 2;
    if (selectionBox && selectedPart === obj) selectionBox.update();
    broadcast({ t: 'resize', id: obj.userData.id, w: w, h: h });
  }
  function updateResizeLabels() {
    var wSlider = document.getElementById('resize-w');
    var hSlider = document.getElementById('resize-h');
    if (wSlider) document.getElementById('resize-w-val').textContent = (+wSlider.value).toFixed(1) + ' m';
    if (hSlider) document.getElementById('resize-h-val').textContent = (+hSlider.value).toFixed(1) + ' m';
  }
  function showResizePanel(obj) {
    var panel = document.getElementById('resize-panel');
    var wSlider = document.getElementById('resize-w');
    var hSlider = document.getElementById('resize-h');
    if (!panel || !wSlider || !hSlider) return;
    resizeTarget = obj;
    resizeStartW = obj.userData.w || 4;
    resizeStartH = obj.userData.h || WALL_H;
    wSlider.value = resizeStartW;
    hSlider.value = resizeStartH;
    updateResizeLabels();
    panel.classList.remove('hidden');
  }
  function hideResizePanel() {
    var panel = document.getElementById('resize-panel');
    if (panel) panel.classList.add('hidden');
    resizeTarget = null;
  }
  function commitResize() {
    if (!resizeTarget) return;
    var o = resizeTarget;
    var sw = resizeStartW, sh = resizeStartH;
    var ew = parseFloat(document.getElementById('resize-w').value);
    var eh = parseFloat(document.getElementById('resize-h').value);
    resizeStartW = ew; resizeStartH = eh;
    pushUndo(function () { resizeWall(o, sw, sh); }, function () { resizeWall(o, ew, eh); });
  }

  /* ============================================================
     UI: tools, tabs, floor bar, color wheel, materials
     ============================================================ */
  function buildToolList() {
    var wrap = document.getElementById('tool-list');
    wrap.innerHTML = '';
    if (activeTab === 'house') {
      HOUSES.forEach(function (h) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tool-btn house';
        b.innerHTML = '<span class="pico">' + h.ico + '</span><span>' + h.label + '</span>';
        b.addEventListener('click', function () { buildReadyHouse(h.id); });
        wrap.appendChild(b);
      });
      return;
    }
    var list = TOOLS[activeTab];
    list.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool-btn' + (currentTool && currentTool.id === t.id ? ' active' : '');
      b.innerHTML = '<span class="pico">' + t.ico + '</span><span>' + t.label + '</span>';
      b.addEventListener('click', function () {
        if (currentTool && currentTool.id === t.id) { setTool(null); }
        else setTool(t);
      });
      wrap.appendChild(b);
    });
  }

  function setTool(tool) {
    currentTool = tool;
    modeAction = null;
    hideResizePanel();
    clearGhost();
    cancelDraws();
    if (wallDraw) { if (wallDraw.preview) { scene.remove(wallDraw.preview); disposeObj(wallDraw.preview); } wallDraw = null; }
    if (rectDraw) { if (rectDraw.preview) { scene.remove(rectDraw.preview); disposeObj(rectDraw.preview); } rectDraw = null; }
    setModeButtons();
    buildToolList();
    if (tool) {
      if (tool.kind === 'wall') setHint('Kliko e tërhiq për të vizatuar murin');
      else if (tool.kind === 'window' || tool.kind === 'door') setHint('Kliko MBI një mur për të vendosur');
      else if (tool.kind === 'foundation') setHint('Kliko e tërhiq për themelin');
      else if (tool.kind === 'slab') setHint('Kliko e tërhiq për pllakën e katit');
      else setHint('Kliko në tokë për të vendosur: ' + tool.label);
    } else {
      setHint('Zgjidh një mjet ose përdor mjete transformimi në të djathtë');
    }
    updateEditMode();
  }

  function cancelDraws() {
    if (wallDraw && wallDraw.preview) { scene.remove(wallDraw.preview); disposeObj(wallDraw.preview); }
    wallDraw = null;
    if (rectDraw && rectDraw.preview) { scene.remove(rectDraw.preview); disposeObj(rectDraw.preview); }
    rectDraw = null;
  }

  function setModeAction(action) {
    if (modeAction === action) { modeAction = null; hideResizePanel(); }
    else { modeAction = action; currentTool = null; clearGhost(); cancelDraws(); deselectPart(); if (action !== 'resize') hideResizePanel(); }
    setModeButtons();
    buildToolList();
    if (modeAction === 'paint') setHint('Kliko një pjesë për ta lyer me ngjyrën/materialin e zgjedhur');
    else if (modeAction === 'move') setHint('Kliko një pjesë për ta lëvizur · Q/E rrotullim');
    else if (modeAction === 'delete') setHint('Kliko një pjesë për ta fshirë');
    else if (modeAction === 'resize') setHint('Kliko një MUR për ta zmadhuar anash e lart');
    else setHint('Zgjidh një mjet ose përdor mjete transformimi');
    updateEditMode();
  }

  function setModeButtons() {
    setActive('btn-move', modeAction === 'move');
    setActive('btn-paint', modeAction === 'paint');
    setActive('btn-delete', modeAction === 'delete');
    setActive('btn-resize', modeAction === 'resize');
    setActive('btn-snap', snapOn);
  }
  function setActive(id, on) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('active', !!on);
  }
  function setHint(msg) { var el = document.getElementById('tool-hint'); if (el) el.textContent = msg; }

  function updateEditMode() {
    editMode = !!(currentTool || modeAction);
    if (editMode) {
      controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    } else {
      restoreControls();
    }
  }
  function restoreControls() {
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  /* ---------- floor bar ---------- */
  function buildFloorBar() {
    var wrap = document.getElementById('floor-bar');
    wrap.innerHTML = '';
    for (var f = 0; f < state.floorCount; f++) {
      (function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'floor-btn' + (f === state.currentFloor ? ' active' : '');
        b.textContent = f === 0 ? 'Përdhes' : 'Kati ' + f;
        b.addEventListener('click', function () { setFloor(f); });
        wrap.appendChild(b);
      })(f);
    }
    var plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'floor-btn plus'; plus.textContent = '+ Kati';
    plus.addEventListener('click', addFloor);
    wrap.appendChild(plus);
    if (state.floorCount > 1) {
      var minus = document.createElement('button');
      minus.type = 'button'; minus.className = 'floor-btn'; minus.textContent = '− Kati';
      minus.addEventListener('click', removeFloor);
      wrap.appendChild(minus);
    }
  }
  function setFloor(f) {
    state.currentFloor = f;
    buildFloorBar();
    deselectPart();
    toast(f === 0 ? '🏠 Katit përdhes' : '🏢 Kati ' + f);
  }
  function addFloor() {
    state.floorCount++;
    state.currentFloor = state.floorCount - 1;
    buildFloorBar();
    toast('➕ U shtua kati ' + (state.floorCount - 1));
    guideNotify('floor');
  }
  function removeFloor() {
    if (state.floorCount <= 1) return;
    var top = state.floorCount - 1;
    var doomed = allParts.filter(function (p) { return p.userData.floor === top; });
    if (doomed.length && !confirm('Fshij katin ' + top + ' dhe ' + doomed.length + ' pjesë në të?')) return;
    doomed.forEach(function (p) { removePart(p, true); });
    state.floorCount--;
    if (state.currentFloor >= state.floorCount) state.currentFloor = state.floorCount - 1;
    buildFloorBar();
    toast('➖ U hoq kati');
  }

  /* ---------- color wheel ---------- */
  var wheel = document.getElementById('colorwheel');
  var wheelCtx = wheel.getContext('2d');
  var valueSlider = document.getElementById('value-slider');
  var colorInput = document.getElementById('color-input');
  var currentSwatch = document.getElementById('current-swatch');

  function drawWheel() {
    var S = 160;
    var img = wheelCtx.createImageData(S, S);
    var R = S / 2, cx = R, cy = R;
    var val = valueSlider.value / 100;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var dx = x - cx, dy = y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var idx = (y * S + x) * 4;
        if (dist <= R) {
          var sat = Math.min(1, dist / R);
          var hue = Math.atan2(dy, dx);
          if (hue < 0) hue += Math.PI * 2;
          var rgb = hsvToRgb(hue, sat, val);
          img.data[idx] = rgb[0]; img.data[idx + 1] = rgb[1]; img.data[idx + 2] = rgb[2]; img.data[idx + 3] = 255;
        }
      }
    }
    wheelCtx.putImageData(img, 0, 0);
  }
  function pickWheel(e) {
    var rect = wheel.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var cx = rect.width / 2, cy = rect.height / 2;
    var dx = x - cx, dy = y - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var R = rect.width / 2;
    var sat = Math.min(1, dist / R);
    var hue = Math.atan2(dy, dx);
    if (hue < 0) hue += Math.PI * 2;
    var val = valueSlider.value / 100;
    var rgb = hsvToRgb(hue, sat, val);
    selectedColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
    syncSwatch();
  }
  function syncSwatch() {
    currentSwatch.style.background = selectedColor;
    colorInput.value = selectedColor;
    if (ghost && currentTool && currentTool.make) { clearGhost(); }
  }
  wheel.addEventListener('mousedown', function (e) { pickWheel(e); wheel.addEventListener('mousemove', pickWheel); });
  window.addEventListener('mouseup', function () { wheel.removeEventListener('mousemove', pickWheel); });
  valueSlider.addEventListener('input', function () { drawWheel(); });
  colorInput.addEventListener('input', function () { selectedColor = colorInput.value; currentSwatch.style.background = selectedColor; if (ghost && currentTool && currentTool.make) clearGhost(); });

  /* ---------- materials ---------- */
  var MATERIALS = [
    { id: 'smooth', label: 'Lëmuar' },
    { id: 'wood', label: 'Dru' },
    { id: 'brick', label: 'Tullë' },
    { id: 'stone', label: 'Gur' },
    { id: 'tile', label: 'Pllakë' },
    { id: 'plaster', label: 'Suvatim' },
    { id: 'concrete', label: 'Beton' },
    { id: 'metal', label: 'Metal' },
    { id: 'glass', label: 'Xham' }
  ];
  function buildMaterialList() {
    var wrap = document.getElementById('material-list');
    wrap.innerHTML = '';
    MATERIALS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mat-btn' + (selectedMaterial === m.id ? ' active' : '');
      var c = document.createElement('canvas');
      c.width = 48; c.height = 30;
      var ctx = c.getContext('2d');
      if (m.id === 'smooth') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 48, 30); }
      else if (m.id === 'glass') { ctx.fillStyle = '#bfe3f5'; ctx.fillRect(0, 0, 48, 30); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, 48, 14); }
      else { ctx.drawImage(getTexture(m.id).image, 0, 0, 48, 30); }
      b.appendChild(c);
      var span = document.createElement('span');
      span.textContent = m.label;
      b.appendChild(span);
      b.addEventListener('click', function () {
        selectedMaterial = m.id;
        buildMaterialList();
        if (ghost && currentTool && currentTool.make) clearGhost();
      });
      wrap.appendChild(b);
    });
  }

  /* ---------- toast ---------- */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ============================================================
     PAMJA 2D / 3D
     ============================================================ */
  var is2D = false;
  var savedCam2D = null;
  function enter2D() {
    savedCam2D = { pos: camera.position.clone(), target: controls.target.clone() };
    camera.position.set(0, 55, 0.01);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.update();
    is2D = true;
    if (gridHelper) gridHelper.visible = true;
    document.getElementById('btn-2d').textContent = '🌍 3D';
    toast('📐 Pamja 2D — planimetria e katit');
  }
  function enter3D() {
    if (savedCam2D) { camera.position.copy(savedCam2D.pos); controls.target.copy(savedCam2D.target); }
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();
    is2D = false;
    if (gridHelper) gridHelper.visible = false;
    document.getElementById('btn-2d').textContent = '📐 2D';
    toast('🌍 Pamja 3D — shëtit në kohë reale');
  }
  function toggle2D() { if (is2D) enter3D(); else enter2D(); }

  /* ============================================================
     SHIKO BRENDA (ecje në vetën e parë)
     ============================================================ */
  var insideActive = false;
  var wasCameraPos = null, wasTarget = null;
  var euler = new THREE.Euler(0, 0, 0, 'YXZ');
  var lookDown = false;
  var hiddenInside = [];

  function houseCenter() {
    var sx = 0, sz = 0, n = 0;
    for (var i = 0; i < allParts.length; i++) {
      var p = allParts[i];
      var k = p.userData.kind;
      if (k === 'wall' || k === 'slab' || k === 'foundation' || k === 'roof') {
        sx += p.position.x; sz += p.position.z; n++;
      }
    }
    return n === 0 ? { x: 0, z: 0 } : { x: sx / n, z: sz / n };
  }

  function enterInside() {
    var c = houseCenter();
    var floorBase = baseY();
    wasCameraPos = camera.position.clone();
    wasTarget = controls.target.clone();
    camera.position.set(c.x, floorBase + 1.7, c.z);
    euler.set(0, Math.PI, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    controls.target.set(c.x, floorBase + 1.7, c.z + 1);
    hiddenInside = [];
    allParts.forEach(function (p) {
      if (p.userData.kind === 'wall' || p.userData.kind === 'roof' || p.userData.kind === 'slab' || p.userData.kind === 'foundation' || p.userData.kind === 'chimney') {
        hiddenInside.push(p);
        p.traverse(function (cc) {
          if (cc.isMesh) cc.castShadow = false;
          if (cc.material) { cc.material.transparent = true; cc.material.opacity = 0.12; cc.material.depthWrite = false; cc.material.needsUpdate = true; }
        });
      }
    });
    insideLight = new THREE.PointLight(0xfff2d8, 1.2, 32, 1.7);
    insideLight.position.set(c.x, floorBase + 2.6, c.z);
    scene.add(insideLight);
    insideActive = true;
    document.getElementById('btn-inside').textContent = '🏞️ Dil jashtë';
    document.getElementById('inside-hint').classList.remove('hidden');
    controls.enabled = false;
    document.body.style.cursor = 'crosshair';
    window.addEventListener('mousemove', onInsideLook);
    window.addEventListener('keydown', onInsideKey);
    window.addEventListener('keyup', onInsideKeyUp);
    toast('🚪 Je brenda! Lëviz me WASD');
    guideNotify('inside');
  }
  function exitInside() {
    insideActive = false;
    document.getElementById('btn-inside').textContent = '🚪 Shiko brenda';
    document.getElementById('inside-hint').classList.add('hidden');
    if (insideLight) { scene.remove(insideLight); insideLight = null; }
    if (wasCameraPos) camera.position.copy(wasCameraPos);
    if (wasTarget) controls.target.copy(wasTarget);
    controls.enabled = true;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onInsideLook);
    window.removeEventListener('keydown', onInsideKey);
    window.removeEventListener('keyup', onInsideKeyUp);
    hiddenInside.forEach(function (p) {
      p.traverse(function (cc) {
        if (cc.isMesh) cc.castShadow = true;
        if (cc.material) { cc.material.transparent = false; cc.material.opacity = 1; cc.material.depthWrite = true; cc.material.needsUpdate = true; }
      });
    });
    hiddenInside = [];
  }
  function onInsideLook(e) {
    if (!insideActive) return;
    if (e.buttons !== 1 && !lookDown) return;
    euler.y -= e.movementX * 0.0035;
    euler.x -= e.movementY * 0.0035;
    euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }
  function onInsideKey(e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') { e.preventDefault(); lookDown = true; }
  }
  function onInsideKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') lookDown = false;
  }
  function updateInsideMovement() {
    if (!insideActive) return;
    var speed = 0.12;
    if (keys['shift']) speed = 0.3;
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    var right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    var move = new THREE.Vector3();
    if (keys['w'] || keys['arrowup']) move.add(dir);
    if (keys['s'] || keys['arrowdown']) move.sub(dir);
    if (keys['a'] || keys['arrowleft']) move.sub(right);
    if (keys['d'] || keys['arrowright']) move.add(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      camera.position.x += move.x;
      camera.position.z += move.z;
      var lo = baseY() + 1.4, hi = baseY() + FLOOR_H - 0.3;
      camera.position.y = Math.max(lo, Math.min(hi, camera.position.y));
    }
  }

  /* ============================================================
     RUAJ / NGARKO
     ============================================================ */
  function saveGame() {
    var data = {
      v: 2,
      env: state.env,
      floorCount: state.floorCount,
      currentFloor: state.currentFloor,
      parts: allParts.map(serializePart),
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      toast('💾 Loja u ruajt me sukses!');
      guideNotify('save');
    } catch (err) {
      toast('⚠️ Nuk u ruajt: ' + err.message);
    }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      state.env = data.env || 'plot';
      state.floorCount = data.floorCount || 1;
      state.currentFloor = data.currentFloor || 0;
      var parts = [];
      (data.parts || []).forEach(function (p) {
        var m = restorePart(p);
        if (m) parts.push(m);
      });
      return parts;
    } catch (err) {
      console.warn('Load save failed', err);
      return null;
    }
  }

  /* ============================================================
     CO-OP (PeerJS) — deri në 4 lojtarë online
     ============================================================ */
  var peer = null;
  var peerConnections = [];
  var isHost = false;
  var roomCode = null;

  function coopStatus(msg) { document.getElementById('coop-status').textContent = msg; }
  function genCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function setupConn(conn) {
    peerConnections.push(conn);
    conn.on('open', function () {
      updatePeerCount();
      if (isHost) {
        conn.send({ t: 'state', parts: allParts.map(serializePart) });
      }
    });
    conn.on('data', function (msg) {
      if (!msg || typeof msg !== 'object') return;
      onRemote(msg, conn);
    });
    conn.on('close', function () {
      var i = peerConnections.indexOf(conn);
      if (i !== -1) peerConnections.splice(i, 1);
      updatePeerCount();
    });
  }
  function updatePeerCount() {
    var el = document.getElementById('coop-peers');
    if (el) el.textContent = 'Lojtarë: ' + (1 + peerConnections.length);
  }
  function broadcast(msg) {
    if (!peerConnections.length) return;
    var data = msg;
    peerConnections.forEach(function (c) { try { c.send(data); } catch (e) {} });
  }
  function onRemote(msg, source) {
    if (msg.t === 'state') {
      allParts.forEach(function (p) { scene.remove(p); disposeObj(p); });
      allParts = [];
      (msg.parts || []).forEach(function (p) {
        var m = restorePart(p);
        if (m) { scene.add(m); allParts.push(m); }
      });
    } else if (msg.t === 'place') {
      var m = restorePart(msg.part);
      if (m) { scene.add(m); allParts.push(m); }
    } else if (msg.t === 'remove') {
      var t = allParts.filter(function (p) { return p.userData.id === msg.id; })[0];
      if (t) { allParts.splice(allParts.indexOf(t), 1); scene.remove(t); }
    } else if (msg.t === 'paint') {
      var t2 = allParts.filter(function (p) { return p.userData.id === msg.id; })[0];
      if (t2) paintPart(t2, msg.color, msg.material, true);
    } else if (msg.t === 'move') {
      var t3 = allParts.filter(function (p) { return p.userData.id === msg.id; })[0];
      if (t3) { t3.position.x = msg.x; t3.position.z = msg.z; t3.rotation.y = msg.ry; }
    } else if (msg.t === 'resize') {
      var t4 = allParts.filter(function (p) { return p.userData.id === msg.id; })[0];
      if (t4 && t4.userData.kind === 'wall') resizeWall(t4, msg.w, msg.h);
    }
    // hosti i përcjell ndryshimet te lojtarët e tjerë
    if (isHost && peerConnections.length > 1) {
      peerConnections.forEach(function (c) {
        if (c === source) return;
        try { c.send(msg); } catch (e) {}
      });
    }
  }
  function hostRoom() {
    if (typeof Peer === 'undefined') { coopStatus('⚠️ Co-op i padisponueshëm (nuk u ngarkua PeerJS)'); return; }
    try {
      roomCode = genCode();
      peer = new Peer('instabuild-' + roomCode, { debug: 0 });
      peer.on('open', function () {
        isHost = true;
        document.getElementById('coop-room').classList.remove('hidden');
        document.getElementById('coop-code-display').textContent = roomCode;
        coopStatus('✅ Dhoma u krijua. Shpërndaje kodin me shokët.');
      });
      peer.on('connection', setupConn);
      peer.on('error', function (err) {
        var t = (err && err.type) ? err.type : err;
        if (t === 'unavailable-id') coopStatus('⚠️ Kodi u zu nga një dhomë tjetër — provo prapë');
        else coopStatus('⚠️ Gabim: ' + t);
      });
    } catch (e) {
      coopStatus('⚠️ Nuk u krijua dhoma: ' + e.message);
    }
  }
  function joinRoom() {
    if (typeof Peer === 'undefined') { coopStatus('⚠️ Co-op i padisponueshëm (nuk u ngarkua PeerJS)'); return; }
    var code = (document.getElementById('coop-code').value || '').trim().toUpperCase();
    if (!code) { coopStatus('⚠️ Shkruaj kodin e dhomës'); return; }
    try {
      peer = new Peer({ debug: 0 });
      peer.on('open', function () {
        coopStatus('🔗 Po lidhem me ' + code + '...');
        var conn = peer.connect('instabuild-' + code, { reliable: true });
        var done = false;
        conn.on('open', function () {
          if (done) return; done = true;
          isHost = false;
          setupConn(conn);
          coopStatus('✅ U lidhe me dhomën!');
        });
        conn.on('error', function () {
          if (!done) coopStatus('⚠️ Nuk u gjet dhoma me kodin ' + code);
        });
        setTimeout(function () { if (!done && !conn.open) coopStatus('⚠️ Nuk u gjet dhoma me kodin ' + code); }, 8000);
      });
      peer.on('error', function (err) {
        coopStatus('⚠️ Gabim: ' + (err && err.type ? err.type : err));
      });
    } catch (e) {
      coopStatus('⚠️ Nuk u lidhe: ' + e.message);
    }
  }

  /* ============================================================
     UDHËRRËFYESI (NPC) — shpjegon lojën hap pas hapi
     ============================================================ */
  var guide = { step: 0, done: {}, visible: false };
  var lastPraiseTime = 0;
  var PRAISES = ['Good job! 👍', 'Well done! ✨', 'Bravo! 👏', 'Shumë mirë! 🎉', 'Vazhdo kështu! 💪', 'Perfekt! 🌟', 'Të lumtë! 🏆', 'Awesome! 🔥'];
  var guideSteps = [
    { id: 'wall', hint: '📐 Hapi 1: Zgjidh një shtëpi të gatshme (tab "Shtëpi") OSE vizato vetë muret (tab "Ndërtim") — kliko e tërhiq.', praise: 'Bravo! 👏 Shtëpia u ndërtua!' },
    { id: 'window', hint: '🪟 Hapi 2: Vendos një dritare ose derë — kliko MBI murin.', praise: 'Shumë mirë! Well done! ✨' },
    { id: 'foundation', hint: '🟫 Hapi 3: Në tab "Strukturë" vendos një themel — kliko e tërhiq për madhësinë.', praise: 'Perfekt! 👍 Themeli është gati!' },
    { id: 'furniture', hint: '🛋️ Hapi 4: Në tab "Mobilie" vendos mobilie (p.sh. krevat ose divan).', praise: 'Good job! Shtëpia po merr jetë! 🏠' },
    { id: 'rotate', hint: '🔄 Hapi 5: Rrotullo pjesët me Q/E (i hollë) ose R (90°) — vendosje 360°!', praise: 'Bravo! Rrotullim 360° i zotëruar! 🌀' },
    { id: 'floor', hint: '🏢 Hapi 6: Shto një kat me "+ Kati" për shtëpi shumëkatëshe.', praise: 'WOW! Shumëkatëshe! 🏗️' },
    { id: 'paint', hint: '🎨 Hapi 7: Lyej një pjesë — kliko "🖌️ Lyej" e pastaj mbi pjesën.', praise: 'Ngjyra të mrekullueshme! 🌈' },
    { id: 'inside', hint: '🚪 Hapi 8: Shiko shtëpinë nga brenda me "🚪 Shiko brenda" dhe ec me WASD.', praise: 'Good job! E sheh shtëpinë nga brenda! 🚶' },
    { id: 'save', hint: '💾 Hapi 9: Ruaj lojën me butonin "Ruaj" që të mos e humbasësh.', praise: 'Well done! Loja u ruajt! 💾' }
  ];

  function randomPraise() { return PRAISES[Math.floor(Math.random() * PRAISES.length)]; }

  function guideSay(text, praise) {
    var bubble = document.getElementById('guide-bubble');
    var wrap = document.getElementById('guide-2d');
    if (!bubble || !wrap) return;
    bubble.textContent = text;
    bubble.classList.toggle('praise', !!praise);
    wrap.classList.remove('hidden');
    guide.visible = true;
  }

  function initGuide() {
    guide.step = 0;
    guide.done = {};
    guide.visible = false;
    guideSay('👋 Mirë se erdhe në InstaBuild! Unë jam Nino. Zgjidh një shtëpi të gatshme në tab "Shtëpi", ose vizato vetë planimetrinë. Ndiq hapat e mi!', false);
    setTimeout(function () {
      if (guide.visible && guide.step < guideSteps.length) guideSay(guideSteps[guide.step].hint, false);
    }, 4500);
  }

  function stepIdForKind(kind) {
    if (kind === 'wall') return 'wall';
    if (kind === 'window' || kind === 'door') return 'window';
    if (kind === 'foundation' || kind === 'slab') return 'foundation';
    if (kind === 'furniture') return 'furniture';
    return null;
  }

  function praiseFor(id) {
    for (var i = 0; i < guideSteps.length; i++) if (guideSteps[i].id === id) return guideSteps[i].praise;
    return randomPraise();
  }

  function guideNotify(id) {
    if (!guide || !id) return;
    guide.done[id] = true;
    var advanced = false;
    while (guide.step < guideSteps.length && guide.done[guideSteps[guide.step].id]) {
      guide.step++;
      advanced = true;
    }
    if (advanced) {
      guideSay(praiseFor(id), true);
      var next = guide.step;
      setTimeout(function () {
        if (guide.visible && next === guide.step) {
          if (next < guideSteps.length) guideSay(guideSteps[next].hint, false);
          else guideSay('🎉 E përfundove mësimin! Tani je gati të ndërtosh çfarë të duash! ' + randomPraise(), true);
        }
      }, 4200);
    } else {
      var now = Date.now();
      if (now - lastPraiseTime > 10000 && Math.random() < 0.35) {
        lastPraiseTime = now;
        guideSay(randomPraise(), true);
      }
    }
  }

  /* ============================================================
     FILLIMI I LOJËS
     ============================================================ */
  function showScreen() {
    document.getElementById('screen-start').classList.remove('active');
    document.getElementById('hud').classList.remove('hidden');
  }
  function startGame() {
    state.env = 'plot';
    state.currentFloor = 0;
    state.floorCount = 1;
    undoStack.length = 0;
    redoStack.length = 0;
    buildEnvironment();
    buildFloorBar();
    setTool(null);
    deselectPart();
    document.getElementById('hud-loc').textContent = '🌱 Truall i pastër';
    showScreen();
    resetCamera();
    enter2D();
    initGuide();
    toast('📐 Vizato planimetrinë në 2D — zgjidh "Mur" dhe vizato muret e shtëpisë.');
  }
  function continueGame() {
    var loaded = loadSave();
    if (!loaded) { toast('⚠️ Nuk ka lojë të ruajtur'); return; }
    undoStack.length = 0;
    redoStack.length = 0;
    buildEnvironment();
    allParts = loaded;
    loaded.forEach(function (m) { scene.add(m); });
    buildFloorBar();
    setTool(null);
    document.getElementById('hud-loc').textContent = '🌱 Truall i pastër';
    showScreen();
    resetCamera();
    enter2D();
    initGuide();
    toast('💾 Loja e ruajtur u ngarkua');
  }
  function resetCamera() {
    camera.position.set(18, 14, 22);
    controls.target.set(0, 2, 0);
    controls.update();
  }

  /* ============================================================
     WIRING
     ============================================================ */
  function bindAction(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  bindAction('btn-start', startGame);
  bindAction('btn-continue', continueGame);
  bindAction('btn-save', saveGame);
  bindAction('btn-2d', toggle2D);
  bindAction('btn-inside', function () { if (insideActive) exitInside(); else enterInside(); });
  bindAction('btn-restart', function () {
    if (!confirm('Fillo nga e para? Loja e tanishme do të humbet.')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });
  bindAction('btn-move', function () { setModeAction('move'); });
  bindAction('btn-paint', function () { setModeAction('paint'); });
  bindAction('btn-delete', function () { setModeAction('delete'); });
  bindAction('btn-resize', function () { setModeAction('resize'); });
  bindAction('btn-snap', function () { snapOn = !snapOn; setModeButtons(); toast(snapOn ? '📏 Snap i aktivizuar' : '📏 Snap i çaktivizuar'); });
  bindAction('btn-rot-cw', function () { rotateBy(5 * Math.PI / 180); });
  bindAction('btn-rot-ccw', function () { rotateBy(-5 * Math.PI / 180); });
  bindAction('btn-rot-90', function () { rotateBy(Math.PI / 2); });
  bindAction('btn-undo', undoLast);
  bindAction('btn-redo', redoLast);

  document.getElementById('time-slider').addEventListener('input', function () { setTimeOfDay(parseInt(this.value, 10)); });

  document.getElementById('resize-w').addEventListener('input', function () {
    if (!resizeTarget) return;
    updateResizeLabels();
    resizeWall(resizeTarget, parseFloat(this.value), parseFloat(document.getElementById('resize-h').value));
  });
  document.getElementById('resize-h').addEventListener('input', function () {
    if (!resizeTarget) return;
    updateResizeLabels();
    resizeWall(resizeTarget, parseFloat(document.getElementById('resize-w').value), parseFloat(this.value));
  });
  document.getElementById('resize-w').addEventListener('change', commitResize);
  document.getElementById('resize-h').addEventListener('change', commitResize);

  document.querySelectorAll('#tool-tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('#tool-tabs .tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      setTool(null);
      buildToolList();
    });
  });

  /* ---------- co-op modal ---------- */
  bindAction('btn-coop', function () { document.getElementById('coop-modal').classList.remove('hidden'); });
  bindAction('btn-coop-close', function () { document.getElementById('coop-modal').classList.add('hidden'); });
  bindAction('btn-host', hostRoom);
  bindAction('btn-join', joinRoom);

  /* ---------- canvas events (wired after initThree, below) ---------- */

  /* ---------- keys (rrotullim + snap + shkurtore) ---------- */
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'Shift') shiftHeld = true;
    if (insideActive) return;
    if (k === 'q' || k === 'Q') { rotateBy(-5 * Math.PI / 180); }
    else if (k === 'e' || k === 'E') { rotateBy(5 * Math.PI / 180); }
    else if (k === 'r' || k === 'R') { rotateBy(Math.PI / 2); }
    else if (k === 'Delete' || k === 'Backspace') {
      if (selectedPart) { removePart(selectedPart); deselectPart(); toast('🗑️ U fshi'); }
    } else if (k === 'Escape') {
      setTool(null); setModeAction(null); deselectPart(); cancelDraws();
    } else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLast(); }
    else if (k === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redoLast(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === 'Shift') shiftHeld = false; });

  function rotateBy(delta) {
    if (selectedPart && modeAction === 'move') {
      selectedPart.rotation.y += delta;
      if (selectionBox) selectionBox.update();
      guideNotify('rotate');
      return;
    }
    placeRot = (placeRot + delta) % (Math.PI * 2);
    if (ghost && currentTool && currentTool.make) { clearGhost(); }
    guideNotify('rotate');
  }

  /* ============================================================
     LOOP
     ============================================================ */
  function animate() {
    requestAnimationFrame(animate);
    var dt = clock.getDelta();
    if (controls.enabled) controls.update();
    updateInsideMovement();
    animateWorld(dt);
    if (selectionBox && selectedPart) selectionBox.update();
    renderer.render(scene, camera);
  }

  /* ============================================================
     START
     ============================================================ */
  try {
    initThree();
    renderer.domElement.addEventListener('pointerdown', onCanvasDown);
    renderer.domElement.addEventListener('pointermove', onCanvasMove);
    renderer.domElement.addEventListener('pointerup', onCanvasUp);
    renderer.domElement.addEventListener('pointerleave', function () { if (ghost) clearGhost(); });
    buildEnvironment('plot');
    buildMaterialList();
    drawWheel();
    syncSwatch();
    setTimeOfDay(50);
    setTool(null);
    buildToolList();
    buildFloorBar();
    animate();
    var hasSave = false;
    try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    document.getElementById('btn-continue').classList.toggle('hidden', !hasSave);
  } catch (err) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif"><h2>⚠️ WebGL nuk u aktivizua</h2><p>' + err.message + '</p><p>Aktivizo përshpejtimin grafik në shfletues dhe provo prapë.</p></div>';
    console.error(err);
  }

  /* Hook testimi headless */
  window.__INSTABUILD__ = {
    get parts() { return allParts.length; },
    get floor() { return state.currentFloor; },
    get floors() { return state.floorCount; },
    get color() { return selectedColor; },
    get material() { return selectedMaterial; },
    get tool() { return currentTool ? currentTool.id : null; },
    get mode() { return modeAction; },
    get env() { return state.env; },
    get guideStep() { return guide.step; },
    get guideVisible() { return guide.visible; },
    get firstWall() {
      for (var i = 0; i < allParts.length; i++) {
        if (allParts[i].userData.kind === 'wall') {
          var p = allParts[i];
          return { x: p.position.x, y: p.position.y, z: p.position.z, ry: p.rotation.y, w: p.userData.w, h: p.userData.h };
        }
      }
      return null;
    },
    projectPoint: function (x, y, z) {
      var v = new THREE.Vector3(x, y, z).project(camera);
      var rect = renderer.domElement.getBoundingClientRect();
      return { x: (v.x + 1) / 2 * rect.width + rect.left, y: -(v.y - 1) / 2 * rect.height + rect.top };
    }
  };
})();
