import * as THREE from 'three';
import { MAP } from './map.js';

// Original procedural surfaces built from a seeded stream: no image files, no borrowed art.
function surface(base, kind, seed = 7193) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 9000; i++) {
    const tone = Math.floor(random() * 70) + 96;
    ctx.fillStyle = `rgba(${tone},${tone},${tone - 6},${random() * 0.16})`;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 2);
  }
  if (kind === 'concrete') {
    ctx.strokeStyle = '#6f6a5c22';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke(); }
    ctx.fillStyle = '#ffffff14';
    ctx.fillRect(0, 0, 256, 2);
  } else if (kind === 'asphalt') {
    ctx.fillStyle = '#20262a55';
    for (let i = 0; i < 700; i++) ctx.fillRect(random() * 256, random() * 256, 2, 2);
    ctx.strokeStyle = '#8b8f8a18';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, random() * 256); ctx.lineTo(256, random() * 256); ctx.stroke(); }
  } else if (kind === 'corrugated') {
    for (let i = 0; i < 32; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.13)';
      ctx.fillRect(i * 8, 0, 5, 256);
    }
    ctx.fillStyle = 'rgba(140,80,50,0.12)';
    for (let i = 0; i < 40; i++) ctx.fillRect(random() * 256, random() * 256, 3 + random() * 10, 2 + random() * 5);
  } else if (kind === 'wood') {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, i * 32, 256, 2);
    }
    ctx.strokeStyle = '#6b4a2f55';
    for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.moveTo(0, random() * 256); ctx.lineTo(256, random() * 256); ctx.stroke(); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Boxes that belong to a merged batch: geometry plus the matrix that places it in the world.
function batcher() {
  const groups = new Map();
  return {
    add(w, h, d, x, y, z, material, rx = 0, ry = 0, rz = 0) {
      const geometry = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geometry);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.updateMatrix();
      geometry.applyMatrix4(mesh.matrix);
      let list = groups.get(material);
      if (!list) groups.set(material, (list = []));
      list.push(geometry);
    },
    addShape(geometry, x, y, z, material) {
      const mesh = new THREE.Mesh(geometry);
      mesh.position.set(x, y, z);
      mesh.updateMatrix();
      geometry.applyMatrix4(mesh.matrix);
      let list = groups.get(material);
      if (!list) groups.set(material, (list = []));
      list.push(geometry);
    },
    flush(scene) {
      for (const [material, geometries] of groups) {
        const merged = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const arrays = geometries.map((g) => g.getAttribute(name));
          if (arrays.some((a) => !a)) continue;
          const data = new Float32Array(arrays.reduce((n, a) => n + a.array.length, 0));
          let offset = 0;
          for (const a of arrays) { data.set(a.array, offset); offset += a.array.length; }
          merged.setAttribute(name, new THREE.BufferAttribute(data, arrays[0].itemSize));
        }
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
        for (const g of geometries) g.dispose();
      }
      groups.clear();
    },
  };
}

export function buildEnvironment(view) {
  const scene = view.scene;
  const concreteTex = surface('#c3bbaa', 'concrete', 7311);
  const asphaltTex = surface('#8b9498', 'asphalt', 4489);
  const woodTex = surface('#ad8a5f', 'wood', 991);
  const steelTex = surface('#93a3a8', 'corrugated', 557);
  concreteTex.repeat.set(2, 2);
  asphaltTex.repeat.set(24, 24);
  woodTex.repeat.set(1, 1);
  steelTex.repeat.set(1, 1);

  const materials = {
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.94 }),
    road: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.96 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.88 }),
    teal: new THREE.MeshStandardMaterial({ map: steelTex, color: 0x4c7f8c, roughness: 0.55, metalness: 0.35 }),
    rust: new THREE.MeshStandardMaterial({ map: steelTex, color: 0xb0704a, roughness: 0.72, metalness: 0.3 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x33556b, roughness: 0.7 }),
    painted: new THREE.MeshStandardMaterial({ color: 0xd2dade, roughness: 0.7 }),
    haz: new THREE.MeshStandardMaterial({ color: 0xe8b53c, roughness: 0.65 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x354348, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b9ba1, roughness: 0.45, metalness: 0.55 }),
  };
  const batch = batcher();

  // Bright daylight: sky/ground bounce plus one sun sized to the whole playable map.
  scene.background = new THREE.Color(0xb7dcf0);
  scene.fog = new THREE.Fog(0xcfe4ec, 62, 210);
  scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x9a9c86, 2.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const sun = new THREE.DirectionalLight(0xfff2da, 2.9);
  sun.position.set(-34, 52, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -52;
  sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 52;
  sun.shadow.camera.bottom = -52;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 160;
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  view.renderer.toneMappingExposure = 1.02;

  // Quay deck, then open water beyond the seawall.
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), materials.road);
  deck.rotation.x = -Math.PI / 2;
  deck.receiveShadow = true;
  scene.add(deck);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x3d87a8, roughness: 0.3, metalness: 0.28 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.6;
  scene.add(water);

  // A lane's worth of road paint, drains and quay edging. All of it is flush: zero collisions.
  for (let z = -32; z < 34; z += 4) {
    for (const x of [-31, 31]) batch.add(0.16, 0.01, 2.2, x, 0.014, z, materials.haz);
  }
  for (const x of [-6, 6]) for (let z = -30; z < 32; z += 6) batch.add(0.14, 0.01, 3.2, x, 0.013, z, materials.painted);
  for (let z = -26; z < 29; z += 9) {
    batch.add(1.8, 0.03, 0.5, 0, 0.02, z, materials.dark);
    for (let x = -0.78; x < 0.8; x += 0.14) batch.add(0.03, 0.03, 0.48, x, 0.034, z, materials.steel);
  }
  for (const x of [-33.6, 33.6]) {
    batch.add(0.5, 0.16, 66, x, 0.09, 0, materials.concrete);
    for (let z = -30; z < 32; z += 7) {
      batch.add(0.16, 1.35, 0.16, x, 0.8, z, materials.steel);
      batch.add(1.6, 0.1, 0.12, x + (x > 0 ? -0.8 : 0.8), 1.45, z, materials.painted);
    }
  }

  // Every MAP solid is dressed from its own footprint, so what blocks a bullet is what you see.
  for (const w of MAP.walls) {
    const { x, z, w: width, d: depth, h: height, kind } = w;
    if (kind === 'sea') {
      batch.add(width, height, depth, x, height / 2, z, materials.concrete);
      batch.add(width + 0.1, 0.24, depth + 0.1, x, height, z, materials.painted);
      const long = width > depth;
      for (let t = -Math.max(width, depth) / 2 + 2; t < Math.max(width, depth) / 2 - 1; t += 5.5) {
        batch.add(long ? 0.3 : width + 0.08, height, long ? depth + 0.08 : 0.3, long ? x + t : x, height / 2, long ? z : z + t, materials.painted);
      }
    } else if (kind === 'warehouse') {
      batch.add(width, height, depth, x, height / 2, z, materials.concrete);
      batch.add(width + 0.5, 0.5, depth + 0.5, x, height + 0.16, z, materials.navy);
      const long = width > depth;
      const face = long ? depth / 2 + 0.06 : width / 2 + 0.06;
      for (let t = -Math.max(width, depth) / 2 + 1.4; t < Math.max(width, depth) / 2 - 1.4; t += 3.2) {
        batch.add(long ? 1.9 : 0.16, height * 0.5, long ? 0.16 : 1.9, long ? x + t : x + face, height * 0.42, long ? z + face : z + t, materials.dark);
      }
      // Loading doors and a roof vent stack give the block a front and a scale.
      batch.add(long ? 4.2 : 0.2, 4.2, long ? 0.2 : 4.2, long ? x : x + face, 2.15, long ? z + face : z, materials.teal);
      batch.add(1.1, 1.5, 1.1, x - width * 0.3, height + 1.1, z - depth * 0.22, materials.steel);
      view.sign(w.label ?? 'PELAGIC / FREIGHT', long ? x : x + face + 0.2, height * 0.74, long ? z + face + 0.2 : z, '#f6ecd4', Math.min(4.6, Math.max(width, depth) * 0.55), long ? 0 : Math.PI / 2);
    } else if (kind === 'freight') {
      const material = Math.abs(x) > 20 ? materials.rust : materials.teal;
      batch.add(width, height, depth, x, height / 2, z, material);
      batch.add(width + 0.14, 0.16, depth + 0.14, x, height, z, materials.steel);
      batch.add(width + 0.14, 0.16, depth + 0.14, x, 0.24, z, materials.dark);
      const long = width > depth;
      for (let t = -Math.max(width, depth) / 2 + 0.3; t < Math.max(width, depth) / 2; t += 0.5) {
        batch.add(long ? 0.06 : width + 0.06, height - 0.22, long ? depth + 0.06 : 0.06, long ? x + t : x, height / 2, long ? z : z + t, material);
      }
      batch.add(long ? width * 0.9 : 0.1, 0.5, long ? 0.1 : depth * 0.9, long ? x : x + width / 2 + 0.02, height * 0.62, long ? z + depth / 2 + 0.02 : z, materials.haz);
      if (w.label) view.sign(w.label, x, height + 0.8, z, '#f7e9cc', Math.min(5, Math.max(width, depth) * 0.7), long ? 0 : Math.PI / 2);
    } else if (kind === 'crate') {
      batch.add(width, height, depth, x, height / 2, z, materials.wood);
      batch.add(width + 0.06, 0.09, depth + 0.06, x, height - 0.04, z, materials.dark);
      batch.add(width + 0.06, 0.09, depth + 0.06, x, 0.06, z, materials.dark);
      batch.add(width * 0.62, 0.05, 0.12, x, height + 0.015, z, materials.painted);
    } else {
      // Barrier: a concrete block with a hazard band along the top and visible end caps.
      batch.add(width, height, depth, x, height / 2, z, materials.concrete);
      batch.add(width + 0.04, 0.2, depth + 0.04, x, height - 0.1, z, materials.haz);
      batch.add(width + 0.02, 0.1, depth + 0.02, x, 0.05, z, materials.dark);
    }
  }

  // Site markings and terminal props: paint is flush, machines sit inside a wall's footprint.
  for (const site of MAP.sites) {
    const paint = site.name === 'A' ? materials.haz : materials.painted;
    for (const dx of [-3.6, 3.6]) batch.add(0.14, 0.012, 7.2, site.x + dx, 0.02, site.z, paint);
    for (const dz of [-3.6, 3.6]) batch.add(7.2, 0.012, 0.14, site.x, 0.02, site.z + dz, paint);
    view.sign(site.name + ' / ' + site.label, site.x, 3.6, site.z + 4.2, site.name === 'A' ? '#ffe1a4' : '#b6f3ea', 6.4);
    batch.add(0.7, 1.15, 0.45, site.x + 2.6, 0.58, site.z - 2.4, materials.steel);
    batch.add(0.46, 0.3, 0.03, site.x + 2.6, 0.86, site.z - 2.16, new THREE.MeshBasicMaterial({ color: 0x35b591 }));
    batch.add(0.22, 0.65, 0.22, site.x - 2.7, 0.33, site.z + 2.3, materials.dark);
  }

  // Skyline outside the walls: warehouse shells, gantry crane, tanks and a moored hull.
  box(batch, 22, 11, 58, -44, 5.5, -4, materials.concrete);
  box(batch, 22, 11, 58, 44, 5.5, -4, materials.concrete);
  for (const x of [-44, 44]) {
    box(batch, 23, 0.4, 60, x, 11.2, -4, materials.navy);
    for (let z = -30; z < 26; z += 8) box(batch, 0.1, 2.6, 3.2, x + (x > 0 ? -11.1 : 11.1), 6.6, z, materials.dark);
  }
  for (const x of [-24, 24]) {
    cylinder(batch, 3.6, 13, x, 6, -44, materials.painted);
    cylinder(batch, 3.75, 0.35, x, 12.4, -44, materials.navy);
    cylinder(batch, 3.75, 0.35, x, 1.2, -44, materials.navy);
    box(batch, 0.45, 11, 0.35, x + 3.9, 5.5, -44, materials.steel);
  }
  for (const x of [-27, 27]) {
    box(batch, 0.9, 26, 0.9, x, 13, -38, materials.haz);
    box(batch, 2.2, 0.8, 2.2, x, 25.4, -38, materials.steel);
  }
  box(batch, 56, 1, 1, 0, 26, -38, materials.haz);
  box(batch, 0.4, 0.4, 26, 0, 26, -26, materials.steel);
  box(batch, 0.5, 9, 0.5, 0, 17, -14, materials.steel);
  cylinder(batch, 0.6, 0.8, 0, 12.6, -14, materials.dark);
  box(batch, 12, 3, 22, 4, 0.9, -66, materials.navy);
  box(batch, 5.4, 3.4, 5.4, 4, 3, -62, materials.painted);
  // Mooring line and bollards along the south quay.
  for (let x = -33; x <= 33; x += 3.2) {
    cylinder(batch, 0.09, 1.35, x, 0.42, 33, materials.steel);
    if (Math.round(x) % 6 === 0) cylinder(batch, 0.34, 0.5, x, 0.12, 32.4, materials.haz);
  }
  box(batch, 66, 0.09, 0.09, 0, 1.1, 33, materials.steel);
  view.sign('PELAGIC RELAY / NORTH DOCK', 0, 8.4, -33.4, '#f4dcae', 15);
  view.sign('AUTHORISED PERSONNEL ONLY', -18, 3.6, 33.2, '#f4dcae', 7.4, Math.PI);

  // Crate stacks and pallets on the quay, all outside movement lanes and off sightlines.
  for (const [x, z, n] of [[-31, 20, 2], [31, 20, 3], [-31, -30, 2], [31, -30, 2]]) {
    for (let k = 0; k < n; k++) {
      batch.add(1.5, 1.1, 1.5, x + (k % 2) * 1.6, 0.55 + Math.floor(k / 2) * 1.1, z, materials.wood);
      batch.add(1.56, 0.08, 1.56, x + (k % 2) * 1.6, 1.06 + Math.floor(k / 2) * 1.1, z, materials.dark);
    }
    batch.add(2.4, 0.14, 2.4, x + 0.8, 0.07, z, materials.wood);
  }
  batch.flush(scene);
  view.buildWeapon();
}

function box(batch, w, h, d, x, y, z, material) {
  batch.add(w, h, d, x, y, z, material);
}

function cylinder(batch, r, h, x, y, z, material) {
  batch.addShape(new THREE.CylinderGeometry(r, r, h, 12), x, y, z, material);
}
