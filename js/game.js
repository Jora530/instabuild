/* ============================================================
   InstaBuilt 3D — "Ndërto Shtëpinë Tënde"
   Lojë ndërtimi shtëpish 3D e stilit "Home Design 3D":
   - Muret vizatohen me maus (kliko e tërhiq)
   - Dritaret & dyert vendosen duke klikuar MBI murin
   - Pamja 2D (nga lart) ↔ 3D
   - Shtëpi të gatshme (Traditional / POP UP / Signature / Banesa)
   - Mobilie (gati ose vetë) · Shiko brenda · Ruaj/Ngarko
   ============================================================ */
(function () {
  'use strict';

  var SAVE_KEY = 'instabuilt_game_v1';
  var state = {
    location: null,
    houseType: null,
    furnished: null,
    parts: [],
    furniture: [],
    inside: false
  };

  var houseGroup = null;
  var buildParts = [];
  var furnitureParts = [];
  var undoStack = [];

  /* ---------------- Three.js ---------------- */
  var canvas = document.getElementById('game-canvas');
  var renderer, scene, camera, controls, raycaster, pointer;
  var clock = new THREE.Clock();
  var keys = {};

  function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8f4f, 0.95));
    var sun = new THREE.DirectionalLight(0xfff5e0, 1.15);
    sun.position.set(25, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

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

  /* ---------------- Peizazhi i vendit ---------------- */
  var groundMesh = null;

  function createGround(color, y) {
    y = y || 0;
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: color }));
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = y;
    groundMesh.receiveShadow = true;
    groundMesh.name = 'ground';
    scene.add(groundMesh);
  }

  function createTree(x, z, scale, y) {
    y = y || 0;
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.3 * scale, 1.6 * scale, 7), mat(0x6b4a2b));
    trunk.position.y = 0.8 * scale;
    trunk.castShadow = true;
    var leaves = new THREE.Mesh(new THREE.SphereGeometry(1.1 * scale, 8, 6), mat(0x3d6b2f));
    leaves.position.y = 2.3 * scale;
    leaves.castShadow = true;
    g.add(trunk); g.add(leaves);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function createBuilding(x, z, w, d, h, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var winMat = mat(0xbfe3f5);
    var winCount = Math.floor(w / 1.6);
    for (var i = 0; i < winCount; i++) {
      var wx = -w / 2 + 0.9 + i * 1.6;
      for (var row = 0; row < Math.floor(h / 2.2); row++) {
        var win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), winMat);
        win.position.set(wx, 1.6 + row * 2.2, d / 2 + 0.03);
        g.add(win);
        var win2 = win.clone();
        win2.position.z = -d / 2 - 0.03;
        g.add(win2);
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

  function seededRandom(seed) {
    var s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function buildLocation(loc) {
    clearLocation();
    var i, x, z, rnd;
    if (loc === 'city') {
      createGround(0x8f9a8a, 0);
      var roadMat = new THREE.MeshLambertMaterial({ color: 0x555d55 });
      var road1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 300), roadMat);
      road1.rotation.x = -Math.PI / 2; road1.position.set(0, 0.02, 0); scene.add(road1);
      var road2 = new THREE.Mesh(new THREE.PlaneGeometry(300, 8), roadMat);
      road2.rotation.x = -Math.PI / 2; road2.position.set(0, 0.02, 0); scene.add(road2);
      rnd = seededRandom(11);
      for (i = 0; i < 26; i++) {
        var side = Math.random();
        x = (side < 0.5 ? -1 : 1) * (7 + rnd() * 34);
        z = (rnd() - 0.5) * 110;
        createBuilding(x, z, 5 + rnd() * 6, 5 + rnd() * 6, 6 + rnd() * 22, 0x9aa08c + Math.floor(rnd() * 6) * 0x0a0a08);
      }
    } else if (loc === 'village') {
      createGround(0x79a05a, 0);
      rnd = seededRandom(22);
      for (i = 0; i < 10; i++) {
        x = (rnd() - 0.5) * 60;
        z = (rnd() - 0.5) * 60;
        if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
        createVillageHouse(x, z, rnd());
        createTree(x + 3.5, z + 2.5, 0.8 + rnd() * 0.5, 0);
      }
      for (i = 0; i < 14; i++) createTree((rnd() - 0.5) * 90, (rnd() - 0.5) * 90, 0.8 + rnd() * 0.6, 0);
    } else if (loc === 'nature') {
      createGround(0x5d8a3f, 0);
      createLake(26, -18, 10);
      rnd = seededRandom(33);
      for (i = 0; i < 40; i++) {
        x = (rnd() - 0.5) * 120;
        z = (rnd() - 0.5) * 120;
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
        if (x > 18 && z < -10) continue;
        createTree(x, z, 0.7 + rnd() * 0.9, 0);
      }
      rnd = seededRandom(44);
      for (i = 0; i < 30; i++) {
        x = (rnd() - 0.5) * 70;
        z = (rnd() - 0.5) * 70;
        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
        var flower = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), mat([0xe74c3c, 0xf1c40f, 0xe67e22, 0x9b59b6][Math.floor(rnd() * 4)]));
        flower.position.set(x, 0.28, z);
        scene.add(flower);
      }
    } else if (loc === 'hill') {
      createGround(0x6f9a4a, -6);
      var hill = new THREE.Mesh(new THREE.SphereGeometry(26, 22, 18), new THREE.MeshLambertMaterial({ color: 0x55803a }));
      hill.scale.y = 0.62;
      hill.position.set(0, -4, 0);
      hill.receiveShadow = true;
      scene.add(hill);
      var plateau = new THREE.Mesh(new THREE.CircleGeometry(7.5, 24), new THREE.MeshLambertMaterial({ color: 0x6f9a4a }));
      plateau.rotation.x = -Math.PI / 2;
      plateau.position.set(0, 7.4, 0);
      scene.add(plateau);
      rnd = seededRandom(55);
      for (i = 0; i < 18; i++) {
        x = (rnd() - 0.5) * 46;
        z = (rnd() - 0.5) * 46;
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
        var dist = Math.sqrt(x * x + z * z);
        createTree(x, z, 0.7 + rnd() * 0.7, -6 + Math.max(0, 5.4 - dist * dist / 210) * 0.4);
      }
    }
  }

  function createVillageHouse(x, z, r) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.4), mat(0xd8cfae));
    body.position.y = 1.3;
    body.castShadow = true; body.receiveShadow = true;
    var roof = makeGableRoof(4.8, 3.8, 1.4, 0x8a5a33);
    roof.position.y = 2.6;
    g.add(body); g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = Math.floor(r * 4) * (Math.PI / 2);
    scene.add(g);
  }

  function clearLocation() {
    scene.children.slice().forEach(function (c) {
      if (c.isLight) return;
      if (c === houseGroup) return;
      scene.remove(c);
      disposeObj(c);
    });
    if (groundMesh) { groundMesh = null; }
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

  function disposeGroup(g) { disposeObj(g); }

  /* ---------------- Pjesët ---------------- */
  function makeWallMesh(w, h, d, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.partType = 'wall';
    m.userData.w = w; m.userData.h = h; m.userData.d = d;
    return m;
  }
  function makeGableRoof(width, depth, height, color) {
    var shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.lineTo(-width / 2, 0);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    var m = new THREE.Mesh(geo, mat(color));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.partType = 'roof';
    return m;
  }
  function makePyramidRoof(width, depth, height, color) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, height, 4), mat(color));
    m.rotation.y = Math.PI / 4;
    m.castShadow = true;
    m.userData.partType = 'roof';
    return m;
  }
  function makeFlatRoof(w, d, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), mat(color));
    m.castShadow = true; m.receiveShadow = true;
    m.userData.partType = 'roof';
    return m;
  }
  function makeWindow(w, h, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mat(color || 0x9fd8f0));
    m.castShadow = true;
    m.userData.partType = 'window';
    m.userData.w = w; m.userData.h = h;
    return m;
  }
  function makeDoor(w, h, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), mat(color || 0x6b4a2b));
    m.castShadow = true;
    m.userData.partType = 'door';
    m.userData.w = w; m.userData.h = h;
    return m;
  }
  function makeChimney(color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), mat(color || 0x7a5a3a));
    m.castShadow = true;
    m.userData.partType = 'chimney';
    return m;
  }

  /* ---------------- Mobilie ---------------- */
  function makeFurniture(type) {
    var g = new THREE.Group();
    var wood = mat(0x8b5a2b), light = mat(0xd9c9a3), dark = mat(0x4a3a28), fabric = mat(0x6b8e23), white = mat(0xf5f5f0), metal = mat(0x777777), screen = mat(0x2c3e50);
    function box(w, h, d, m, x, y, z) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
    }
    switch (type) {
      case 'table':
        box(1.4, 0.08, 0.8, wood, 0, 0.72, 0);
        box(0.08, 0.72, 0.08, wood, -0.6, 0.36, -0.3);
        box(0.08, 0.72, 0.08, wood, 0.6, 0.36, -0.3);
        box(0.08, 0.72, 0.08, wood, -0.6, 0.36, 0.3);
        box(0.08, 0.72, 0.08, wood, 0.6, 0.36, 0.3);
        break;
      case 'chair':
        box(0.45, 0.06, 0.45, wood, 0, 0.45, 0);
        box(0.45, 0.5, 0.06, wood, 0, 0.7, -0.2);
        box(0.45, 0.06, 0.45, wood, 0, 0.95, -0.2);
        box(0.06, 0.45, 0.06, wood, -0.19, 0.22, -0.19);
        box(0.06, 0.45, 0.06, wood, 0.19, 0.22, -0.19);
        box(0.06, 0.45, 0.06, wood, -0.19, 0.22, 0.19);
        box(0.06, 0.45, 0.06, wood, 0.19, 0.22, 0.19);
        break;
      case 'bed':
        box(1.9, 0.3, 1.1, wood, 0, 0.3, 0);
        box(1.9, 0.18, 1.1, white, 0, 0.54, 0);
        box(1.9, 0.55, 0.14, wood, 0, 0.55, -0.55);
        box(0.12, 0.55, 1.1, wood, -0.9, 0.55, 0);
        box(0.12, 0.55, 1.1, wood, 0.9, 0.55, 0);
        box(0.55, 0.12, 0.12, light, 0.6, 0.78, 0.35);
        break;
      case 'sofa':
        box(1.8, 0.35, 0.85, fabric, 0, 0.28, 0);
        box(1.8, 0.5, 0.18, fabric, 0, 0.45, -0.38);
        box(0.18, 0.5, 0.85, fabric, -0.85, 0.45, 0);
        box(0.18, 0.5, 0.85, fabric, 0.85, 0.45, 0);
        box(0.5, 0.12, 0.5, light, -0.55, 0.72, -0.1);
        break;
      case 'tv':
        box(1.5, 0.05, 0.5, dark, 0, 0.55, 0);
        box(0.9, 0.55, 0.07, screen, 0, 0.95, 0.25);
        box(0.08, 0.55, 0.08, metal, -0.65, 0.27, -0.15);
        box(0.08, 0.55, 0.08, metal, 0.65, 0.27, -0.15);
        break;
      case 'shelf':
        box(1.3, 1.5, 0.35, wood, 0, 0.75, 0);
        box(1.3, 0.05, 0.3, light, 0, 0.5, 0);
        box(1.3, 0.05, 0.3, light, 0, 1.0, 0);
        break;
      case 'lamp':
        box(0.3, 0.05, 0.3, wood, 0, 0.35, 0);
        box(0.06, 0.35, 0.06, metal, 0, 0.53, 0);
        box(0.28, 0.2, 0.28, light, 0, 0.75, 0);
        break;
    }
    g.userData.partType = 'furniture';
    g.userData.furnType = type;
    return g;
  }

  /* ---------------- Shtëpitë e gatshme ---------------- */
  function buildReadyHouse(type) {
    clearHouse();
    var g = new THREE.Group();
    var cream = 0xe8e4d8, olive = 0x556b2f, brown = 0x8b5a2b, dark = 0x333d1f, white = 0xf5f5f0;
    function add(mesh, x, y, z, rotY) {
      mesh.position.set(x, y, z);
      if (rotY) mesh.rotation.y = rotY;
      mesh.userData.saved = true;
      g.add(mesh);
    }

    if (type === 'popup') {
      add(makeWallMesh(8, 2.6, 0.22, cream), 0, 1.3, -2.5);
      add(makeWallMesh(8, 2.6, 0.22, cream), 0, 1.3, 2.5);
      add(makeWallMesh(5, 2.6, 0.22, cream), -4, 1.3, 0, Math.PI / 2);
      add(makeWallMesh(5, 2.6, 0.22, cream), 4, 1.3, 0, Math.PI / 2);
      add(makeWindow(1.6, 1.1), -1.5, 1.9, -2.62);
      add(makeWindow(1.6, 1.1), 1.5, 1.9, -2.62);
      add(makeWindow(1.2, 1.0), -2.4, 1.8, 2.62);
      add(makeWindow(1.2, 1.0), 2.4, 1.8, 2.62);
      add(makeWindow(1.0, 1.0), 4.62, 1.9, -1.2, Math.PI / 2);
      add(makeDoor(1.0, 2.1), 0, 1.05, 2.62);
      add(makePyramidRoof(8.9, 5.9, 1.5, olive), 0, 3.4, 0);
      add(makeFurniture('bed'), -2.3, 0, -1.6, Math.PI / 2);
      add(makeFurniture('sofa'), 1.8, 0, -1.6, Math.PI);
      add(makeFurniture('table'), 0.4, 0, 1.6, Math.PI / 4);
      add(makeFurniture('chair'), 1.4, 0, 1.9);
      add(makeFurniture('tv'), 3.2, 0, -2.1, Math.PI);
      add(makeFurniture('lamp'), 2.8, 0, 1.7);
    } else if (type === 'traditional') {
      add(makeWallMesh(12, 3, 0.25, cream), 0, 1.5, -4);
      add(makeWallMesh(12, 3, 0.25, cream), 0, 1.5, 4);
      add(makeWallMesh(8, 3, 0.25, cream), -6, 1.5, 0, Math.PI / 2);
      add(makeWallMesh(8, 3, 0.25, cream), 6, 1.5, 0, Math.PI / 2);
      add(makeWindow(1.4, 1.2, 0xbfe3f5), -2.2, 2.1, -4.13);
      add(makeWindow(1.4, 1.2, 0xbfe3f5), 2.2, 2.1, -4.13);
      add(makeWindow(1.4, 1.2, 0xbfe3f5), -2.2, 2.1, 4.13);
      add(makeWindow(1.4, 1.2, 0xbfe3f5), 2.2, 2.1, 4.13);
      add(makeWindow(1.0, 1.1, 0xbfe3f5), -6.13, 2.0, -1.6, Math.PI / 2);
      add(makeWindow(1.0, 1.1, 0xbfe3f5), 6.13, 2.0, -1.6, Math.PI / 2);
      add(makeDoor(1.3, 2.3), 0, 1.15, 4.13);
      add(makeGableRoof(13.2, 9.2, 2.6, brown), 0, 4.3, 0);
      add(makeChimney(), 3.4, 5.3, -1.8);
      add(makeFurniture('bed'), -3.8, 0, -2.6, Math.PI / 2);
      add(makeFurniture('bed'), 3.8, 0, -2.6, Math.PI / 2);
      add(makeFurniture('sofa'), -3.6, 0, 2.6, Math.PI);
      add(makeFurniture('table'), 0, 0, 2.6);
      add(makeFurniture('chair'), 1.2, 0, 2.9);
      add(makeFurniture('shelf'), 5.2, 0, 3.2, Math.PI / 2);
      add(makeFurniture('lamp'), -0.8, 0, 0.8);
      add(makeFurniture('tv'), 3.6, 0, 3.4, Math.PI);
    } else if (type === 'signature') {
      add(makeWallMesh(10, 3.2, 0.25, white), 0, 1.6, -3);
      add(makeWallMesh(10, 3.2, 0.25, white), 0, 1.6, 3);
      add(makeWallMesh(6, 3.2, 0.25, white), -5, 1.6, 0, Math.PI / 2);
      add(makeWallMesh(6, 3.2, 0.25, white), 5, 1.6, -1.6, Math.PI / 2);
      add(makeWallMesh(7, 3.2, 0.25, white), 1.5, 1.6, 6.2, Math.PI / 2);
      add(makeWallMesh(7, 3.2, 0.25, white), 1.5, 1.6, 9.8, Math.PI / 2);
      add(makeWallMesh(4, 3.2, 0.25, white), -2, 1.6, 8, Math.PI);
      add(makeWindow(1.6, 1.3), -2.4, 2.3, -3.13);
      add(makeWindow(1.6, 1.3), 2.4, 2.3, -3.13);
      add(makeWindow(1.2, 1.2), -5.13, 2.2, 0);
      add(makeWindow(1.6, 1.3), -2.4, 2.3, 3.13);
      add(makeWindow(1.6, 1.3), 2.4, 2.3, 3.13);
      add(makeDoor(1.4, 2.4, dark), 0, 1.2, 3.13);
      add(makeGableRoof(10.5, 6.5, 2.2, olive), 0, 4.2, 0);
      add(makeGableRoof(7.5, 4.5, 1.8, dark), 1.5, 4.0, 8);
      add(makeFurniture('bed'), -3.2, 0, -1.8, Math.PI / 2);
      add(makeFurniture('sofa'), 2.8, 0, -1.8, Math.PI);
      add(makeFurniture('table'), 0.2, 0, 1.4, Math.PI / 4);
      add(makeFurniture('chair'), 1.6, 0, 2.0);
      add(makeFurniture('shelf'), 4.4, 0, 2.2, Math.PI / 2);
      add(makeFurniture('lamp'), -1.6, 0, 2.6);
      add(makeFurniture('tv'), 3.4, 0, -2.6, Math.PI);
      add(makeFurniture('bed'), 0.5, 0, 7.4, Math.PI / 2);
      add(makeFurniture('lamp'), 3.2, 0, 7.6);
    } else if (type === 'micro' || type === 'senior' || type === 'multistory') {
      var floors = type === 'multistory' ? 6 : (type === 'senior' ? 4 : 3);
      var hh = floors * 2.9;
      var facade = type === 'micro' ? 0xc9c9b8 : (type === 'senior' ? 0xcdd5b8 : 0xb8bfa8);
      add(makeWallMesh(12, hh, 0.3, facade), 0, hh / 2, -5);
      add(makeWallMesh(12, hh, 0.3, facade), 0, hh / 2, 5);
      add(makeWallMesh(10, hh, 0.3, facade), -6, hh / 2, 0, Math.PI / 2);
      add(makeWallMesh(10, hh, 0.3, facade), 6, hh / 2, 0, Math.PI / 2);
      var fl, wi;
      for (fl = 0; fl < floors; fl++) {
        for (wi = 0; wi < 3; wi++) {
          add(makeWindow(1.3, 1.1), -3.4 + wi * 3.4, 2 + fl * 2.9, -5.13);
          add(makeWindow(1.3, 1.1), -3.4 + wi * 3.4, 2 + fl * 2.9, 5.13);
        }
        add(makeWindow(1.3, 1.1), -6.13, 2 + fl * 2.9, -1.8, Math.PI / 2);
        add(makeWindow(1.3, 1.1), -6.13, 2 + fl * 2.9, 1.8, Math.PI / 2);
      }
      add(makeDoor(1.8, 2.4), 0, 1.2, 5.13);
      add(makeFlatRoof(12.6, 10.6, olive), 0, hh + 0.15, 0);
      add(makeFurniture('bed'), -4.2, 0, -3.4, Math.PI / 2);
      add(makeFurniture('sofa'), 4.2, 0, -3.4, Math.PI);
      add(makeFurniture('table'), 0, 0, 3.6);
      add(makeFurniture('bed'), -4.2, 2.9, -3.4, Math.PI / 2);
      add(makeFurniture('sofa'), 4.2, 2.9, -3.4, Math.PI);
      add(makeFurniture('table'), 0, 2.9, 3.6);
      if (floors >= 4) { add(makeFurniture('bed'), -4.2, 5.8, -3.4, Math.PI / 2); add(makeFurniture('table'), 0, 5.8, 3.6); }
      if (floors >= 6) { add(makeFurniture('bed'), -4.2, 8.7, -3.4, Math.PI / 2); add(makeFurniture('table'), 0, 8.7, 3.6); }
    }
    houseGroup = g;
    scene.add(g);
  }

  function clearHouse() {
    if (houseGroup) {
      scene.remove(houseGroup);
      disposeGroup(houseGroup);
      houseGroup = null;
    }
    buildParts = [];
    furnitureParts = [];
    undoStack = [];
  }

  /* ---------------- UI ---------------- */
  var screens = {
    location: document.getElementById('screen-location'),
    house: document.getElementById('screen-house'),
    furniture: document.getElementById('screen-furniture'),
    build: document.getElementById('screen-build'),
    furnish: document.getElementById('screen-furnish')
  };
  var hud = document.getElementById('hud');

  function showScreen(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('active', k === name);
    });
    hud.classList.toggle('hidden', !(name === 'game'));
  }

  document.querySelectorAll('.loc-card').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.location = btn.dataset.location;
      showScreen('house');
    });
  });
  document.getElementById('btn-back-house').addEventListener('click', function () { showScreen('location'); });
  document.getElementById('btn-back-furn').addEventListener('click', function () { showScreen('house'); });

  var aptNote = document.getElementById('apt-note');
  var aptBtns = document.querySelectorAll('.house-card.apt');
  function setAptState() {
    var inCity = state.location === 'city';
    aptNote.style.display = inCity ? 'none' : 'block';
    aptBtns.forEach(function (b) { b.classList.add('disabled'); });
  }
  setAptState();

  document.querySelectorAll('#screen-house .house-card').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var h = btn.dataset.house;
      var isApt = ['micro', 'senior', 'multistory'].indexOf(h) !== -1;
      if (isApt && state.location !== 'city') {
        state.location = 'city';
        toast('🏙️ Banesat janë në Qytet — të çojmë atje!');
      }
      state.houseType = h;
      if (h === 'custom') {
        showScreen('build');
        startBuildMode();
      } else if (isApt) {
        state.furnished = 'ready';
        startGame();
      } else {
        showScreen('furniture');
      }
    });
  });

  document.querySelectorAll('#screen-furniture .house-card').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.furnished = btn.dataset.furn;
      if (state.furnished === 'custom') {
        showScreen('furnish');
        startFurnishMode();
      } else {
        startGame();
      }
    });
  });

  /* ---------------- Fillimi i lojës ---------------- */
  function startGame() {
    showScreen('game');
    buildLocation(state.location);
    if (state.houseType === 'custom') {
      houseGroup = new THREE.Group();
      houseGroup.name = 'houseRoot';
      buildParts.forEach(function (p) {
        if (p.parent === scene) scene.remove(p);
        houseGroup.add(p);
      });
      furnitureParts.forEach(function (f) {
        if (f.parent === scene) scene.remove(f);
        houseGroup.add(f);
      });
      scene.add(houseGroup);
    } else {
      buildReadyHouse(state.houseType);
    }
    var y = state.location === 'hill' ? 7.3 : 0;
    houseGroup.position.y = y;
    document.getElementById('hud-loc').textContent = { city: '🏙️ Qytet', village: '🏡 Fshat', nature: '🌲 Natyrë', hill: '⛰️ Kodër' }[state.location] || '';
    resetCamera();
  }

  function resetCamera() {
    camera.position.set(20, 15, 22);
    controls.target.set(0, state.location === 'hill' ? 7.3 : 2, 0);
    controls.update();
  }

  /* ============================================================
     NDËRTIMI — stili "Home Design 3D"
     Muret vizatohen me drag; dritaret/dyert mbi mur; kulmet lirisht
     ============================================================ */
  var TOOLS = [
    { id: 'wall', ico: '🧱', label: 'Mur (vizato)', kind: 'wall' },
    { id: 'window', ico: '🪟', label: 'Dritare (te muri)', kind: 'window', make: function () { return makeWindow(1.1, 1.0); } },
    { id: 'window-big', ico: '🪟', label: 'Dritare e madhe', kind: 'window', make: function () { return makeWindow(1.8, 1.3); } },
    { id: 'door', ico: '🚪', label: 'Derë (te muri)', kind: 'door', make: function () { return makeDoor(1.0, 2.1); } },
    { id: 'door-double', ico: '🚪', label: 'Derë dyshe', kind: 'door', make: function () { return makeDoor(1.8, 2.2, 0x5a3a22); } },
    { id: 'roof-gable', ico: '🔺', label: 'Kulm trekëndësh', kind: 'place', make: function () { return makeGableRoof(4.6, 3, 1.8, 0x8b5a2b); } },
    { id: 'roof-pyramid', ico: '⛺', label: 'Kulm piramidë', kind: 'place', make: function () { return makePyramidRoof(3.4, 3.4, 1.6, 0x556b2f); } },
    { id: 'roof-flat', ico: '▬', label: 'Kulm i sheshtë', kind: 'place', make: function () { return makeFlatRoof(4.6, 3.4, 0x556b2f); } },
    { id: 'chimney', ico: '🏭', label: 'Oxhak', kind: 'place', make: function () { return makeChimney(); } }
  ];
  var FURN_TOOLS = [
    { id: 'bed', ico: '🛏️', label: 'Krevat', make: function () { return makeFurniture('bed'); } },
    { id: 'table', ico: '🪑', label: 'Tavolinë', make: function () { return makeFurniture('table'); } },
    { id: 'chair', ico: '💺', label: 'Karrige', make: function () { return makeFurniture('chair'); } },
    { id: 'sofa', ico: '🛋️', label: 'Divan', make: function () { return makeFurniture('sofa'); } },
    { id: 'tv', ico: '📺', label: 'TV', make: function () { return makeFurniture('tv'); } },
    { id: 'shelf', ico: '📚', label: 'Raft', make: function () { return makeFurniture('shelf'); } },
    { id: 'lamp', ico: '💡', label: 'Llambë', make: function () { return makeFurniture('lamp'); } }
  ];

  var buildMode = null;
  var selectedColor = '#e8e4d8';
  var placeRot = 0;
  var placeY = 0;
  var ghost = null;
  var ghostTypeId = null;
  var wallDraw = null;   // { start: Vector3, preview: Mesh }

  /* Gjatë ndërtimit: mausi i majtë = vizato/vendos, i djathti = rrotullo pamjen */
  function setBuildControls() {
    controls.enabled = true;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }
  function restoreControls() {
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  function buildPalette(containerId, list, onPick) {
    var wrap = document.getElementById(containerId);
    wrap.innerHTML = '';
    list.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal-btn' + (i === 0 ? ' active' : '');
      b.innerHTML = '<span class="pico">' + p.ico + '</span>' + p.label;
      b.addEventListener('click', function () {
        wrap.querySelectorAll('.pal-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        onPick(p);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function setTool(tool) {
    buildMode.current = tool;
    buildMode.remove = false;
    buildMode.drawWall = false;
    document.getElementById('btn-remove').classList.remove('active');
    if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; ghostTypeId = null; }
    if (wallDraw && wallDraw.preview) { scene.remove(wallDraw.preview); disposeGroup(wallDraw.preview); }
    wallDraw = null;
    if (tool.kind === 'wall') toast('🧱 Kliko e tërhiq për të vizatuar murin');
    else if (tool.kind === 'window') toast('🪟 Kliko MBI një mur për të vendosur dritaren');
    else if (tool.kind === 'door') toast('🚪 Kliko MBI një mur për të vendosur derën');
    else toast('📦 Kliko në tokë për të vendosur: ' + tool.label);
  }

  function startBuildMode() {
    buildMode = { kind: 'build', remove: false, current: TOOLS[0], parts: buildParts, drawWall: false };
    buildPalette('palette-build', TOOLS, setTool);
    setTool(TOOLS[0]);
    bindModeKeys('build');
    wireCanvas('build');
    setBuildControls();
  }

  function startFurnishMode() {
    buildMode = { kind: 'furnish', remove: false, current: FURN_TOOLS[0], parts: furnitureParts, drawWall: false };
    buildPalette('palette-furnish', FURN_TOOLS, setTool);
    setTool(FURN_TOOLS[0]);
    bindModeKeys('furnish');
    wireCanvas('furnish');
    setBuildControls();
  }

  var modeKeyHandler = null;
  function bindModeKeys(kind) {
    document.removeEventListener('keydown', modeKeyHandler);
    modeKeyHandler = function (e) {
      if (!buildMode) return;
      if (e.key === 'r' || e.key === 'R') { placeRot = (placeRot + Math.PI / 2) % (Math.PI * 2); toast('🔄 Rrotulluar'); }
      if (e.key === '+' || e.key === '=') { placeY += 0.5; toast('⬆️ Lartësia: ' + placeY.toFixed(1)); }
      if (e.key === '-' || e.key === '_') { placeY = Math.max(0, placeY - 0.5); toast('⬇️ Lartësia: ' + placeY.toFixed(1)); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        buildMode.remove = !buildMode.remove;
        var btn = kind === 'build' ? document.getElementById('btn-remove') : document.getElementById('btn-remove2');
        btn.classList.toggle('active', buildMode.remove);
        toast(buildMode.remove ? '🗑️ Modaliteti i fshirjes: kliko një pjesë' : '✅ Fshirja u mbyll');
      }
      if (e.key === 'Escape') {
        if (wallDraw) cancelWallDraw();
      }
    };
    document.addEventListener('keydown', modeKeyHandler);
  }

  var canvasWired = false;
  function wireCanvas(kind) {
    if (canvasWired) return;
    canvasWired = true;
    renderer.domElement.addEventListener('pointerdown', onBuildDown);
    renderer.domElement.addEventListener('pointermove', onBuildMove);
    renderer.domElement.addEventListener('pointerup', onBuildUp);
  }

  function groundPointFromEvent(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      if (o.name === 'ground') return hits[i];
    }
    return null;
  }

  function snap(v) { return Math.round(v * 2) / 2; }

  function onBuildDown(e) {
    if (!buildMode || !buildMode.current) return;
    if (e.button !== 0) return; // vetëm mausi i majtë
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(scene.children, true);

    if (buildMode.remove) {
      for (var i = 0; i < hits.length; i++) {
        var obj = hits[i].object;
        if (obj.userData && (obj.userData.partType || obj.userData.furnType) && !obj.userData.saved && !obj.userData.ghost && buildMode.parts.indexOf(obj) !== -1) {
          var idx = buildMode.parts.indexOf(obj);
          undoStack.push({ action: 'remove', part: obj, parts: buildMode.parts });
          buildMode.parts.splice(idx, 1);
          obj.parent.remove(obj);
          disposeGroup(obj);
          toast('🗑️ U fshi pjesa');
          return;
        }
      }
      return;
    }

    var tool = buildMode.current;
    if (tool.kind === 'wall') {
      var gh = groundPointFromEvent(e);
      if (!gh) return;
      var start = gh.point.clone();
      start.x = snap(start.x); start.z = snap(start.z);
      wallDraw = { start: start, preview: null };
    } else if (tool.kind === 'window' || tool.kind === 'door') {
      // gjej murin e klikuar
      for (var j = 0; j < hits.length; j++) {
        var o2 = hits[j].object;
        if (o2.userData && o2.userData.partType === 'wall' && buildMode.parts.indexOf(o2) !== -1) {
          placeOnWall(o2, hits[j], tool.make());
          return;
        }
      }
      toast('⚠️ Kliko MBI një mur që ke ndërtuar');
    } else {
      // vendosje e lirë (kulme, oxhak)
      var gh2 = groundPointFromEvent(e);
      if (!gh2) return;
      var part = tool.make(hexColor(selectedColor));
      var p = gh2.point.clone();
      p.x = snap(p.x); p.z = snap(p.z);
      part.position.set(p.x, placeY, p.z);
      part.rotation.y = placeRot;
      buildMode.parts.push(part);
      undoStack.push({ action: 'add', part: part, parts: buildMode.parts });
      scene.add(part);
      toast('✅ U vendos: ' + tool.label);
    }
  }

  function onBuildMove(e) {
    if (!buildMode || !buildMode.current) return;
    var tool = buildMode.current;

    if (tool.kind === 'wall' && wallDraw) {
      var gh = groundPointFromEvent(e);
      if (!gh) return;
      var end = gh.point.clone();
      end.x = snap(end.x); end.z = snap(end.z);
      var dx = end.x - wallDraw.start.x;
      var dz = end.z - wallDraw.start.z;
      // ngjitje në 90° kur është afër
      if (Math.abs(dx) < Math.abs(dz) * 0.25) dx = 0;
      if (Math.abs(dz) < Math.abs(dx) * 0.25) dz = 0;
      end.x = wallDraw.start.x + dx;
      end.z = wallDraw.start.z + dz;
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.5) { if (wallDraw.preview) { wallDraw.preview.visible = false; } return; }
      if (wallDraw.preview) wallDraw.preview.visible = true;
      if (!wallDraw.preview) {
        wallDraw.preview = makeWallMesh(1, 2.6, 0.25, hexColor(selectedColor));
        wallDraw.preview.userData.ghost = true;
        wallDraw.preview.traverse(function (c) {
          if (c.material) { c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; }
        });
        scene.add(wallDraw.preview);
      }
      var midX = (wallDraw.start.x + end.x) / 2;
      var midZ = (wallDraw.start.z + end.z) / 2;
      wallDraw.preview.position.set(midX, 1.3, midZ);
      wallDraw.preview.scale.x = len;
      wallDraw.preview.rotation.y = Math.atan2(dz, dx);
      wallDraw.end = end;
      return;
    }

    if (tool.kind === 'place') {
      var gh2 = groundPointFromEvent(e);
      if (!gh2) return;
      var pos = gh2.point.clone();
      pos.x = snap(pos.x); pos.z = snap(pos.z);
      if (!ghost || ghostTypeId !== tool.id) {
        if (ghost) { scene.remove(ghost); disposeGroup(ghost); }
        ghost = tool.make(hexColor(selectedColor));
        ghost.userData.ghost = true;
        ghost.traverse(function (c) {
          if (c.material) { c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; }
        });
        scene.add(ghost);
        ghostTypeId = tool.id;
      }
      ghost.position.copy(pos);
      ghost.position.y = placeY;
      ghost.rotation.y = placeRot;
      ghost.visible = true;
    } else if (ghost) {
      ghost.visible = false;
    }
  }

  function onBuildUp(e) {
    if (!buildMode || !buildMode.current) return;
    var tool = buildMode.current;
    if (tool.kind === 'wall' && wallDraw) {
      var end = wallDraw.end || wallDraw.start;
      var dx = end.x - wallDraw.start.x;
      var dz = end.z - wallDraw.start.z;
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len >= 0.5) {
        var wall = makeWallMesh(len, 2.6, 0.25, hexColor(selectedColor));
        wall.position.set((wallDraw.start.x + end.x) / 2, 1.3, (wallDraw.start.z + end.z) / 2);
        wall.rotation.y = Math.atan2(dz, dx);
        buildMode.parts.push(wall);
        undoStack.push({ action: 'add', part: wall, parts: buildMode.parts });
        scene.add(wall);
        toast('🧱 Muri u ndërtua: ' + len.toFixed(1) + ' m');
      }
      if (wallDraw.preview) { scene.remove(wallDraw.preview); disposeGroup(wallDraw.preview); }
      wallDraw = null;
    }
  }

  function cancelWallDraw() {
    if (wallDraw && wallDraw.preview) {
      scene.remove(wallDraw.preview);
      disposeGroup(wallDraw.preview);
    }
    wallDraw = null;
    toast('↩️ Vizatimi u anulua');
  }

  /* Vendos dritaren/derën MBI mur — si në Home Design 3D */
  function placeOnWall(wallMesh, hit, part) {
    wallMesh.updateMatrixWorld();
    var local = wallMesh.worldToLocal(hit.point.clone());
    var w = wallMesh.userData.w || 4;
    var d = wallMesh.userData.d || 0.25;
    var h = wallMesh.userData.h || 2.6;
    var nx = Math.abs(hit.face.normal.x), ny = Math.abs(hit.face.normal.y), nz = Math.abs(hit.face.normal.z);
    var partW = part.userData.w || 1, partH = part.userData.h || 1;
    var margin = partW / 2 + 0.05;
    var localX = Math.max(-w / 2 + margin, Math.min(w / 2 - margin, local.x));
    var localY = part.userData.partType === 'door' ? partH / 2 : (partH / 2 + 0.75);
    var localZ = 0;
    if (nz > nx && nz > ny) localZ = d / 2 + 0.03;       // faqja e përparme/pasme
    else if (nx > ny) localZ = Math.max(-d / 2 + 0.03, Math.min(d / 2 - 0.03, local.z));
    var world = wallMesh.localToWorld(new THREE.Vector3(localX, localY, localZ));
    part.position.copy(world);
    part.rotation.y = wallMesh.rotation.y;
    buildMode.parts.push(part);
    undoStack.push({ action: 'add', part: part, parts: buildMode.parts });
    scene.add(part);
    toast('✅ U vendos: ' + buildMode.current.label);
  }

  /* ---------------- Butonat ---------------- */
  function bindAction(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }
  bindAction('btn-rotate', function () { placeRot = (placeRot + Math.PI / 2) % (Math.PI * 2); toast('🔄 Rrotulluar'); });
  bindAction('btn-up', function () { placeY += 0.5; toast('⬆️ Lartësia: ' + placeY.toFixed(1)); });
  bindAction('btn-down', function () { placeY = Math.max(0, placeY - 0.5); toast('⬇️ Lartësia: ' + placeY.toFixed(1)); });
  bindAction('btn-remove', function () {
    if (!buildMode) return;
    buildMode.remove = !buildMode.remove;
    document.getElementById('btn-remove').classList.toggle('active', buildMode.remove);
    toast(buildMode.remove ? '🗑️ Modaliteti i fshirjes: kliko një pjesë' : '✅ Fshirja u mbyll');
  });
  bindAction('btn-undo', function () { undoLast(); });
  bindAction('btn-build-done', function () {
    if (!buildParts.length) { toast('⚠️ Ndërto të paktën një mur!'); return; }
    cleanupMode();
    state.furnished = 'custom';
    showScreen('furnish');
    startFurnishMode();
  });
  bindAction('btn-rotate2', function () { placeRot = (placeRot + Math.PI / 2) % (Math.PI * 2); toast('🔄 Rrotulluar'); });
  bindAction('btn-up2', function () { placeY += 0.5; toast('⬆️ Lartësia: ' + placeY.toFixed(1)); });
  bindAction('btn-down2', function () { placeY = Math.max(0, placeY - 0.5); toast('⬇️ Lartësia: ' + placeY.toFixed(1)); });
  bindAction('btn-remove2', function () {
    if (!buildMode) return;
    buildMode.remove = !buildMode.remove;
    document.getElementById('btn-remove2').classList.toggle('active', buildMode.remove);
    toast(buildMode.remove ? '🗑️ Modaliteti i fshirjes: kliko një pjesë' : '✅ Fshirja u mbyll');
  });
  bindAction('btn-undo2', function () { undoLast(); });
  bindAction('btn-furnish-done', function () {
    cleanupMode();
    startGame();
  });

  function cleanupMode() {
    document.removeEventListener('keydown', modeKeyHandler);
    if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; ghostTypeId = null; }
    if (wallDraw && wallDraw.preview) { scene.remove(wallDraw.preview); disposeGroup(wallDraw.preview); }
    wallDraw = null;
    buildMode = null;
    restoreControls();
  }

  function undoLast() {
    if (!undoStack.length) { toast('⚠️ Asgjë për të zhbërë'); return; }
    var last = undoStack.pop();
    if (last.action === 'add') {
      var i = last.parts.indexOf(last.part);
      if (i !== -1) last.parts.splice(i, 1);
      if (last.part.parent) last.part.parent.remove(last.part);
      disposeGroup(last.part);
      toast('↩️ U zhbë vendosja');
    } else if (last.action === 'remove') {
      last.parts.push(last.part);
      scene.add(last.part);
      toast('↩️ U rikthye pjesa');
    }
  }

  function hexColor(hex) { return parseInt(hex.replace('#', ''), 16); }

  document.querySelectorAll('.color-dot').forEach(function (dot) {
    dot.addEventListener('click', function () {
      document.querySelectorAll('.color-dot').forEach(function (d) { d.classList.remove('active'); });
      dot.classList.add('active');
      selectedColor = dot.dataset.color;
      if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; ghostTypeId = null; }
    });
  });

  /* ---------------- Pamja 2D / 3D ---------------- */
  var is2D = false;
  var savedCam2D = null;
  bindAction('btn-2d', function () {
    if (!houseGroup) return;
    if (!is2D) {
      savedCam2D = { pos: camera.position.clone(), target: controls.target.clone() };
      var box = new THREE.Box3().setFromObject(houseGroup);
      var c = box.getCenter(new THREE.Vector3());
      camera.position.set(c.x, 55, c.z + 0.01);
      controls.target.set(c.x, 0, c.z);
      controls.maxPolarAngle = Math.PI / 2.02;
      controls.update();
      is2D = true;
      document.getElementById('btn-2d').textContent = '🌍 Pamja 3D';
      toast('📐 Pamja 2D (nga lart)');
    } else {
      if (savedCam2D) {
        camera.position.copy(savedCam2D.pos);
        controls.target.copy(savedCam2D.target);
      }
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.update();
      is2D = false;
      document.getElementById('btn-2d').textContent = '📐 Pamja 2D';
      toast('🌍 Pamja 3D');
    }
  });

  /* ---------------- Shiko brenda ---------------- */
  var insideActive = false;
  var wasCameraPos = null, wasTarget = null;
  var euler = new THREE.Euler(0, 0, 0, 'YXZ');
  var lookDown = false;

  document.getElementById('btn-inside').addEventListener('click', function () {
    if (!houseGroup) return;
    if (!insideActive) enterInside();
    else exitInside();
  });

  function houseBounds() {
    return new THREE.Box3().setFromObject(houseGroup);
  }

  function enterInside() {
    var b = houseBounds();
    var cx = (b.min.x + b.max.x) / 2;
    var cz = (b.min.z + b.max.z) / 2;
    var topY = b.max.y;
    wasCameraPos = camera.position.clone();
    wasTarget = controls.target.clone();
    camera.position.set(cx, topY + 2, cz);
    controls.target.set(cx, b.min.y + 1.5, cz);
    controls.update();
    setTimeout(function () {
      if (!insideActive) return;
      camera.position.set(cx, b.min.y + 1.7, cz);
      houseGroup.traverse(function (c) {
        if (c.material && (c.userData.partType === 'wall' || c.userData.partType === 'roof' || c.userData.partType === 'chimney')) {
          c.material.transparent = true;
          c.material.opacity = 0.15;
          c.material.depthWrite = false;
        }
      });
    }, 350);
    insideActive = true;
    document.getElementById('btn-inside').textContent = '🏞️ Dil jashtë';
    document.getElementById('inside-hint').classList.remove('hidden');
    controls.enabled = false;
    document.body.style.cursor = 'crosshair';
    window.addEventListener('mousemove', onInsideLook);
    window.addEventListener('keydown', onInsideKey);
    window.addEventListener('keyup', onInsideKeyUp);
    euler.setFromQuaternion(camera.quaternion);
    toast('🚪 Je brenda shtëpisë! Lëviz me WASD');
  }

  function exitInside() {
    insideActive = false;
    document.getElementById('btn-inside').textContent = '🚪 Shiko brenda';
    document.getElementById('inside-hint').classList.add('hidden');
    if (wasCameraPos) camera.position.copy(wasCameraPos);
    if (wasTarget) controls.target.copy(wasTarget);
    controls.enabled = true;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onInsideLook);
    window.removeEventListener('keydown', onInsideKey);
    window.removeEventListener('keyup', onInsideKeyUp);
    houseGroup.traverse(function (c) {
      if (c.material && (c.userData.partType === 'wall' || c.userData.partType === 'roof' || c.userData.partType === 'chimney')) {
        c.material.transparent = false;
        c.material.opacity = 1;
        c.material.depthWrite = true;
      }
    });
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
    if (!insideActive || !houseGroup) return;
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
      var b = houseBounds();
      var pad = 0.6;
      camera.position.x = Math.max(b.min.x + pad, Math.min(b.max.x - pad, camera.position.x + move.x));
      camera.position.z = Math.max(b.min.z + pad, Math.min(b.max.z - pad, camera.position.z + move.z));
    }
  }

  /* ---------------- Ruaj / Ngarko ---------------- */
  function serializePart(p) {
    return {
      type: p.userData.partType || 'part',
      furn: p.userData.furnType || null,
      x: Math.round(p.position.x * 100) / 100,
      y: Math.round(p.position.y * 100) / 100,
      z: Math.round(p.position.z * 100) / 100,
      ry: Math.round(p.rotation.y * 100) / 100,
      w: p.userData.w || null,
      h: p.userData.h || null,
      color: p.material && p.material.color ? '#' + p.material.color.getHexString() : null
    };
  }

  document.getElementById('btn-save').addEventListener('click', function () {
    if (!houseGroup) return;
    var data = {
      v: 2,
      location: state.location,
      houseType: state.houseType,
      furnished: state.furnished,
      parts: buildParts.map(serializePart),
      furniture: furnitureParts.map(serializePart),
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      toast('💾 Loja u ruajt me sukses!');
    } catch (err) {
      toast('⚠️ Nuk u ruajt: ' + err.message);
    }
  });

  function restorePart(p) {
    var mesh = null;
    if (p.furn) {
      mesh = makeFurniture(p.furn);
    } else {
      switch (p.type) {
        case 'wall':
          mesh = makeWallMesh(p.w || 4, p.h || 2.6, 0.25, p.color ? parseInt(p.color.replace('#', ''), 16) : 0xe8e4d8);
          break;
        case 'roof':
          mesh = makeFlatRoof(4, 3, p.color ? parseInt(p.color.replace('#', ''), 16) : 0x556b2f);
          break;
        case 'window':
          mesh = makeWindow(p.w || 1.1, p.h || 1.0);
          break;
        case 'door':
          mesh = makeDoor(p.w || 1.0, p.h || 2.1);
          break;
        case 'chimney':
          mesh = makeChimney();
          break;
        default:
          mesh = makeWallMesh(4, 2.6, 0.25, 0xe8e4d8);
      }
    }
    if (mesh) {
      mesh.position.set(p.x || 0, p.y || 0, p.z || 0);
      mesh.rotation.y = p.ry || 0;
    }
    return mesh;
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      state.location = data.location;
      state.houseType = data.houseType;
      state.furnished = data.furnished;
      buildParts = [];
      furnitureParts = [];
      (data.parts || []).forEach(function (p) {
        var m = restorePart(p);
        if (m) buildParts.push(m);
      });
      (data.furniture || []).forEach(function (p) {
        var m = restorePart(p);
        if (m) furnitureParts.push(m);
      });
      return true;
    } catch (err) {
      console.warn('Load save failed', err);
      return false;
    }
  }

  document.getElementById('btn-restart').addEventListener('click', function () {
    if (!confirm('Fillo nga e para? Loja e tanishme do të humbet.')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });

  var btnContinue = document.getElementById('btn-continue');
  function checkSave() {
    var exists = false;
    try { exists = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    btnContinue.classList.toggle('hidden', !exists);
  }
  checkSave();
  btnContinue.addEventListener('click', function () {
    if (loadSave()) {
      showScreen('game');
      buildLocation(state.location);
      startGame();
      toast('💾 Loja e ruajtur u ngarkua!');
    } else {
      toast('⚠️ Nuk mund të ngarkohej loja');
    }
  });

  /* ---------------- Toast ---------------- */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ---------------- Loop ---------------- */
  function animate() {
    requestAnimationFrame(animate);
    clock.getDelta();
    if (controls.enabled) controls.update();
    updateInsideMovement();
    renderer.render(scene, camera);
  }

  /* ---------------- Start ---------------- */
  try {
    initThree();
    buildLocation('nature');
    animate();
    showScreen('location');
  } catch (err) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif"><h2>⚠️ WebGL nuk u aktivizua</h2><p>' + err.message + '</p><p>Aktivizo përshpejtimin grafik në shfletues dhe provo prapë.</p></div>';
    console.error(err);
  }

})();
