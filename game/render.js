import * as THREE from 'three';
import { buildEnvironment } from './environment.js';
import { WEAPONS, livingCounts } from './simulation.js';

const standard = (color, roughness = 0.72, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const UP = new THREE.Vector3(0, 1, 0);

// Rounded clothing and machined edges retain readable silhouettes in daylight.
function shapedBox(w, h, d, radius = Math.min(w, h, d) * 0.18) {
  const geometry = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = geometry.attributes.position;
  const inner = new THREE.Vector3(w / 2 - radius, h / 2 - radius, d / 2 - radius);
  const v = new THREE.Vector3(), core = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    core.copy(v).clamp(inner.clone().negate(), inner);
    v.sub(core).normalize().multiplyScalar(radius).add(core);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Faction kits: RAIDERS in olive and rust over dark grey, WARDENS in slate blue over white.
// Distinct at silhouette range by both hue and value, not just a badge.
const KITS = [
  {
    cloth: 0x6b6d4a, clothDark: 0x4a4c33, vest: 0x3c4032, vestTrim: 0x8a6a45,
    helmet: 0x565a3c, skin: 0xb99a7e, boot: 0x2a2b25, glove: 0x3a3b2c, accent: 0xd2a24c,
  },
  {
    cloth: 0x5c6f83, clothDark: 0x3d4c5c, vest: 0xd7dde2, vestTrim: 0x3c566e,
    helmet: 0x2f4256, skin: 0xa98a72, boot: 0x23282e, glove: 0x2f3a44, accent: 0x86c8e8,
  },
];

export class View {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 320);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.botMeshes = new Map();
    this.tracerMeshes = [];
    this.impactMeshes = [];
    this.smokeMeshes = [];
    this.tmpV = new THREE.Vector3();
    this.materials = new Map();
    buildEnvironment(this);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  material(color, roughness = 0.72, metalness = 0) {
    const key = color + ':' + roughness + ':' + metalness;
    let m = this.materials.get(key);
    if (!m) this.materials.set(key, (m = standard(color, roughness, metalness)));
    return m;
  }

  sign(text, x, y, z, color, width = 7, rotY = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#22343d';
    ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 1012, 116);
    ctx.fillStyle = color;
    ctx.font = 'bold 46px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 512, 80);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.scene.add(mesh);
  }

  // First-person rifle: receiver, barrel with a gas block, magazine, stock, optic on a rail,
  // and both gloves gripping it. Kept wide and low so the sightline stays clear.
  buildWeapon() {
    this.gun = new THREE.Group();
    const steel = this.material(0x4a5459, 0.4, 0.62);
    const polymer = this.material(0x2b3134, 0.82);
    const tan = this.material(0x8d7f63, 0.78);
    const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8e2, transparent: true, opacity: 0.35 });
    const glove = this.material(0x393b2d, 0.85);
    const add = (w, h, d, x, y, z, m, rx = 0) => {
      const mesh = new THREE.Mesh(shapedBox(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      this.gun.add(mesh);
      return mesh;
    };
    // Receiver and handguard.
    add(0.085, 0.10, 0.46, 0, 0, -0.10, steel);
    add(0.078, 0.082, 0.40, 0, 0.008, -0.50, polymer);
    for (let i = 0; i < 6; i++) add(0.086, 0.012, 0.022, 0, 0.048, -0.34 - i * 0.055, steel);
    // Barrel, muzzle device and front sight post.
    add(0.034, 0.034, 0.34, 0, 0.012, -0.86, steel);
    add(0.046, 0.046, 0.09, 0, 0.012, -1.05, polymer);
    add(0.018, 0.05, 0.018, 0, 0.05, -0.94, steel);
    // Optic: tube on a rail with a lens at the back.
    add(0.055, 0.026, 0.20, 0, 0.078, -0.16, polymer);
    add(0.05, 0.05, 0.02, 0, 0.088, -0.05, glass);
    for (const z of [-0.06, -0.26]) add(0.03, 0.03, 0.03, 0, 0.068, z, steel);
    // Magazine, pistol grip, trigger guard, stock and cheek rest.
    add(0.07, 0.20, 0.105, 0, -0.145, -0.12, polymer, -0.12);
    add(0.062, 0.155, 0.075, 0, -0.115, 0.10, polymer, 0.28);
    add(0.08, 0.022, 0.14, 0, -0.055, 0.02, steel);
    add(0.062, 0.10, 0.24, 0, 0.006, 0.24, polymer);
    add(0.066, 0.05, 0.16, 0, 0.048, 0.20, tan);
    // Gloves: firing hand on the grip, support hand under the handguard.
    add(0.10, 0.13, 0.13, 0.005, -0.11, 0.10, glove, 0.28);
    add(0.10, 0.10, 0.15, -0.01, -0.055, -0.40, glove);
    this.gun.position.set(0.20, -0.20, -0.34);
    this.gun.scale.setScalar(0.92);
    this.camera.add(this.gun);
    this.scene.add(this.camera);
    // Muzzle flash: two crossed quads plus a short cone, scaled by the real shot pulse.
    this.muzzle = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.95, depthWrite: false });
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 7), flashMat);
    core.rotation.x = -Math.PI / 2;
    core.position.z = -0.12;
    this.muzzle.add(core);
    for (let i = 0; i < 2; i++) {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), flashMat);
      quad.position.z = -0.10;
      quad.rotation.z = i * Math.PI / 2;
      quad.rotation.y = i * Math.PI / 4;
      this.muzzle.add(quad);
    }
    this.muzzle.position.set(0, 0.012, -1.10);
    this.muzzle.visible = false;
    this.gun.add(this.muzzle);
  }

  // A reading operator: helmet with a rail lamp, goggles, plate carrier with pouches, belt,
  // articulated legs and elbows, slung rifle with a muzzle at the simulation's muzzle point.
  makeBot(a) {
    const kit = KITS[a.team];
    const group = new THREE.Group();
    const cloth = this.material(kit.cloth, 0.86);
    const clothDark = this.material(kit.clothDark, 0.86);
    const vestMat = this.material(kit.vest, 0.8);
    const trim = this.material(kit.vestTrim, 0.7);
    const helmetMat = this.material(kit.helmet, 0.66);
    const skin = this.material(kit.skin, 0.72);
    const boot = this.material(kit.boot, 0.85);
    const glove = this.material(kit.glove, 0.85);
    const accent = this.material(kit.accent, 0.5, 0.2);
    const part = (w, h, d, x, y, z, m, parent = group) => {
      const mesh = new THREE.Mesh(shapedBox(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Torso: jacket shell, plate carrier, cummerbund, belt, shoulder pads.
    part(0.44, 0.50, 0.27, 0, 1.10, 0, cloth);
    part(0.48, 0.40, 0.34, 0, 1.13, 0, vestMat);
    part(0.50, 0.09, 0.36, 0, 0.90, 0, trim);
    part(0.46, 0.10, 0.30, 0, 0.80, 0, boot);
    for (const x of [-0.12, 0, 0.12]) part(0.10, 0.15, 0.07, x, 1.10, -0.20, clothDark);
    part(0.30, 0.26, 0.09, 0, 1.15, 0.21, clothDark);
    for (const x of [-0.245, 0.245]) part(0.07, 0.13, 0.24, x, 1.28, -0.02, vestMat);
    // Neck and head: skull, goggles, chin strap, helmet shell plus a lamp on the rail.
    part(0.13, 0.10, 0.13, 0, 1.43, 0, skin);
    part(0.25, 0.27, 0.25, 0, 1.55, 0, skin);
    part(0.26, 0.09, 0.05, 0, 1.57, -0.13, this.material(0x2b2f31, 0.5));
    part(0.28, 0.13, 0.28, 0, 1.66, 0.01, helmetMat);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMat);
    shell.position.set(0, 1.65, 0.01);
    shell.castShadow = true;
    group.add(shell);
    part(0.05, 0.05, 0.05, 0.10, 1.68, -0.13, accent);
    part(0.09, 0.09, 0.03, -0.10, 1.63, -0.13, clothDark);

    // Legs pivot at the hip so the walk cycle is a real swing, not a slide.
    const legs = [];
    for (const x of [-0.14, 0.14]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.82, 0);
      group.add(hip);
      part(0.19, 0.40, 0.22, 0, -0.21, 0, cloth, hip);
      part(0.20, 0.10, 0.23, 0, -0.39, -0.02, trim, hip);
      part(0.17, 0.36, 0.20, 0, -0.55, 0.01, clothDark, hip);
      part(0.19, 0.13, 0.31, 0, -0.73, -0.05, boot, hip);
      legs.push(hip);
    }
    // Arms hold the rifle: upper arm forward, forearm across the body to the handguard.
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.26, 1.28, 0);
      group.add(shoulder);
      const upper = part(0.15, 0.30, 0.17, 0, -0.15, 0, cloth, shoulder);
      upper.rotation.x = -0.55;
      const fore = part(0.14, 0.30, 0.15, side * -0.04, -0.36, -0.16, cloth, shoulder);
      fore.rotation.x = -1.15;
      part(0.13, 0.12, 0.14, side * -0.06, -0.44, -0.30, glove, shoulder);
      arms.push(shoulder);
    }
    // Rifle: receiver, handguard, barrel, magazine, stock, optic — proportioned to a carbine.
    const rifle = new THREE.Group();
    rifle.position.set(0.16, 1.10, -0.26);
    group.add(rifle);
    const rsteel = this.material(0x3c4448, 0.42, 0.6);
    const rpoly = this.material(0x24292b, 0.82);
    const rpart = (w, h, d, x, y, z, m) => {
      const mesh = new THREE.Mesh(shapedBox(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      rifle.add(mesh);
    };
    rpart(0.06, 0.075, 0.34, 0, 0, -0.10, rsteel);
    rpart(0.055, 0.06, 0.28, 0, 0.006, -0.40, rpoly);
    rpart(0.024, 0.024, 0.26, 0, 0.008, -0.66, rsteel);
    rpart(0.03, 0.03, 0.06, 0, 0.008, -0.80, rpoly);
    rpart(0.048, 0.14, 0.075, 0, -0.10, -0.10, rpoly);
    rpart(0.052, 0.09, 0.16, 0, 0.004, 0.13, rpoly);
    rpart(0.038, 0.02, 0.14, 0, 0.048, -0.08, rpoly);
    // Muzzle now sits at the simulation's muzzle point (0.18, 1.06, -1.1 from the actor).
    const muzzle = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd47a, transparent: true, opacity: 0.95, depthWrite: false });
    const burst = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.30, 6), flashMat);
    burst.rotation.x = -Math.PI / 2;
    muzzle.add(burst);
    for (let i = 0; i < 2; i++) {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat);
      quad.rotation.z = i * Math.PI / 2;
      muzzle.add(quad);
    }
    muzzle.position.set(0.02, 0.008, -0.84);
    muzzle.visible = false;
    rifle.add(muzzle);

    group.userData = { legs, arms, muzzle, rifle };
    this.scene.add(group);
    this.botMeshes.set(a.id, group);
  }

  update(s) {
    const p = s.player;
    if (!p) return;
    // Camera sits at the eye point the simulation shoots from: crosshair, camera and
    // bullet all share one origin and one direction.
    this.camera.position.set(p.x, p.height, p.z);
    this.camera.rotation.set(p.pitch || 0, p.yaw, 0, 'YXZ');
    for (const [id, g] of this.botMeshes) if (id !== 0) g.visible = false;
    for (const a of s.actors) {
      if (a.id === 0) continue;
      if (!this.botMeshes.has(a.id)) this.makeBot(a);
      const g = this.botMeshes.get(a.id);
      g.visible = a.hp > 0;
      if (!g.visible) continue;
      g.position.set(a.x, 0, a.z);
      g.rotation.y = a.yaw;
      g.scale.y = a.crouch ? 0.74 : 1;
      const speed = Math.hypot(a.vx, a.vz);
      const swing = Math.sin(s.time * 9 + a.id) * Math.min(0.55, speed * 0.2);
      g.userData.legs[0].rotation.x = swing;
      g.userData.legs[1].rotation.x = -swing;
      // Flash cadence comes from time since that weapon's last real shot vs its own interval.
      const since = a.muzzle;
      g.userData.muzzle.visible = since >= 0 && since < 0.055;
      if (g.userData.muzzle.visible) {
        const k = 1 - since / 0.055;
        g.userData.muzzle.scale.setScalar(0.7 + k * 0.7);
      }
    }
    // Tracers and impact sparks are pooled and driven by the simulation's own shots.
    for (const m of this.tracerMeshes) m.visible = false;
    for (let i = 0; i < s.tracers.length; i++) {
      const t = s.tracers[i];
      let m = this.tracerMeshes[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshBasicMaterial({ color: 0xffd489, transparent: true, opacity: 0.9 }));
        this.scene.add(m);
        this.tracerMeshes.push(m);
      }
      this.tmpV.set(t.ex - t.x, t.ey - t.y, t.ez - t.z);
      const len = this.tmpV.length();
      if (len < 1e-4) { m.visible = false; continue; }
      m.visible = true;
      m.position.set((t.x + t.ex) / 2, (t.y + t.ey) / 2, (t.z + t.ez) / 2);
      m.scale.set(0.012, len, 0.012);
      m.quaternion.setFromUnitVectors(UP, this.tmpV.normalize());
      m.material.opacity = Math.min(0.9, t.life * 12);
    }
    for (const m of this.impactMeshes) m.visible = false;
    for (let i = 0; i < s.impacts.length; i++) {
      const hit = s.impacts[i];
      let m = this.impactMeshes[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true }));
        this.scene.add(m);
        this.impactMeshes.push(m);
      }
      const k = Math.max(0, hit.life / 0.4);
      m.visible = true;
      m.position.set(hit.x, hit.y, hit.z);
      m.scale.setScalar(0.6 + (1 - k) * 1.4);
      m.material.opacity = 0.15 + k * 0.8;
    }
    for (const m of this.smokeMeshes) m.visible = false;
    for (let i = 0; i < s.smokes.length; i++) {
      const smoke = s.smokes[i];
      let m = this.smokeMeshes[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xaeb9bb, transparent: true, opacity: 0.86, depthWrite: false }));
        this.scene.add(m);
        this.smokeMeshes.push(m);
      }
      m.visible = true;
      m.position.set(smoke.x, 1.9, smoke.z);
      m.scale.set(smoke.radius, 2.9, smoke.radius);
      m.material.opacity = Math.min(0.86, smoke.life * 0.25);
    }
    if (!this.coreMesh) {
      this.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0xffbe5e, emissive: 0xff6b21, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 }));
      this.scene.add(this.coreMesh);
    }
    this.coreMesh.visible = !!s.core;
    if (s.core) {
      this.coreMesh.position.set(s.core.x, 0.75, s.core.z);
      this.coreMesh.rotation.y = s.time;
      this.coreMesh.scale.setScalar(1 + Math.sin(s.time * 9) * 0.1);
    }
    // Viewmodel: pull to the shoulder when aiming, drop on reload, kick with the shot pulse.
    const alive = p.hp > 0;
    this.gun.visible = alive;
    const aim = s.aim;
    const bob = alive ? Math.sin(s.time * 7.5) * Math.hypot(p.vx, p.vz) * 0.0022 : 0;
    this.gun.position.set(0.20 * (1 - aim * 0.86) + bob, -0.20 + aim * 0.09 - s.shotPulse * 0.012 - (p.reload > 0 ? 0.20 : 0), -0.34 + s.shotPulse * 0.045);
    this.gun.rotation.set(s.shotPulse * 0.06 - (p.reload > 0 ? 0.5 : 0), 0, 0);
    this.camera.fov = 74 - aim * 14;
    this.camera.updateProjectionMatrix();
    // The player's own flash is driven by the same shot pulse the shot itself sets.
    this.muzzle.visible = alive && s.shotPulse > 0.35;
    if (this.muzzle.visible) this.muzzle.scale.setScalar(0.7 + s.shotPulse * 0.6);
    this.renderer.render(this.scene, this.camera);
  }
}

export function hud(s) {
  const p = s.player;
  const w = p ? WEAPONS[p.weapon] : WEAPONS[0];
  const counts = livingCounts(s);
  const clock = Math.max(0, Math.ceil(s.phase === 'buy' ? s.phaseTime : s.core ? s.core.time : s.phaseTime));
  return {
    phase: s.phase, round: s.round, score: s.score, time: clock,
    hp: Math.max(0, p ? p.hp : 0), armor: Math.max(0, Math.round(p ? p.armor : 0)),
    helmet: !!(p && p.helmet), kit: !!(p && p.kit),
    ammo: p ? p.ammo : 0, reserve: p ? p.reserve : 0, weapon: w.name,
    money: s.money, site: s.core ? s.core.name : '', coreTime: s.core ? s.core.time : 0,
    interact: s.interact, command: s.command, kills: s.kills, deaths: s.deaths,
    notice: s.notice, noticeTime: s.noticeTime, events: s.events, team: s.team,
    inventory: s.inventory, counts, roundKills: s.roundKills,
  };
}
