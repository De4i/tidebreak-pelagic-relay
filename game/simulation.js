// TIDEBREAK rules: a fixed-step, seeded simulation kept entirely apart from rendering.
// Two five-operator squads, a buy phase with real prices, a core-plant objective, and
// ballistics that start from the same eye point and direction the camera shows.
import { MAP, move, visible, walkable, route, wallDistance, boxHit } from './map.js';

export const ROUNDS_TO_WIN = 7;
export const SIDE_SWITCH_ROUND = 7;
export const BUY_TIME = 15;
export const ROUND_TIME = 105;
export const CORE_TIME = 40;
export const ARM_TIME = 3;
export const DISARM_TIME = 5;
export const KIT_DISARM_TIME = 2.5;
export const MAX_MONEY = 16000;
export const START_MONEY = 800;

// cost 0 marks gear the squad is issued rather than bought; every other price is charged.
export const WEAPONS = [
  { name: 'KITE / 9', cost: 0, damage: 26, head: 3.6, mag: 12, reserve: 60, interval: 0.22, reload: 1.3, spread: 0.006, recoil: 0.016, auto: false, kill: 300, tier: 'pistol' },
  { name: 'TERN / 45', cost: 1250, damage: 22, head: 3.2, mag: 28, reserve: 112, interval: 0.085, reload: 1.8, spread: 0.011, recoil: 0.013, auto: true, kill: 600, tier: 'smg' },
  { name: 'OSPREY / 556', cost: 2700, damage: 33, head: 3.9, mag: 30, reserve: 90, interval: 0.105, reload: 2.1, spread: 0.004, recoil: 0.022, auto: true, kill: 300, tier: 'rifle' },
  { name: 'HERON / 762', cost: 4200, damage: 82, head: 2.6, mag: 6, reserve: 24, interval: 0.9, reload: 2.8, spread: 0.001, recoil: 0.07, auto: false, kill: 300, tier: 'marksman' },
];

export const GEAR = [
  { id: 'vest', name: 'CERAMIC VEST', cost: 650, note: 'SOAKS HALF OF EACH HIT' },
  { id: 'helmet', name: 'BALLISTIC HELMET', cost: 350, note: 'HALVES HEAD DAMAGE' },
  { id: 'kit', name: 'DISARM KIT', cost: 400, note: 'DISARM IN 2.5s' },
];

const RAID_NAMES = ['YOU', 'SALT 2', 'SALT 3', 'SALT 4', 'SALT 5'];
const WARD_NAMES = ['KEEL 1', 'KEEL 2', 'KEEL 3', 'KEEL 4', 'KEEL 5'];
// Bots open on an escalation a human buys through: sidearms, then SMGs, then rifles.
const BOT_TIERS = [0, 0, 1, 2, 2, 2, 2];

export function createGame(seed = 4821) {
  const s = {
    seed, tick: 0, time: 0, phase: 'briefing', phaseTime: 0, round: 0, score: [0, 0],
    money: START_MONEY, losses: 0, actors: [], player: null, events: [], tracers: [], impacts: [],
    smokes: [], grenades: [], core: null, interact: 0, notice: '', noticeTime: 0,
    kills: 0, deaths: 0, lastWinner: null, aim: 0, shotPulse: 0, hitPulse: 0, damagePulse: 0,
    flash: 0, inventory: { smoke: 1, flash: 1 }, command: 'FOLLOW', team: 0, site: 0,
    roundKills: 0, plantedBy: null, lastRoundMoney: 0,
  };
  s.random = () => { s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0; return s.seed / 4294967296; };
  return s;
}

function makeActor(id, team, x, z, weapon) {
  const w = WEAPONS[weapon];
  return {
    id, team, x, z, yaw: 0, pitch: 0, hp: 100, armor: 0, helmet: false, kit: false,
    vx: 0, vz: 0, crouch: false, height: 1.65, weapon, ammo: w.mag, reserve: w.reserve,
    reload: 0, cooldown: 0, recoil: 0, shots: 0, path: [], pathTime: 0, goal: null,
    alert: 0, heard: null, reaction: 0.4, objective: 0, flash: 0, kills: 0, deaths: 0,
    muzzle: 9, usedGrenade: false, aliveSince: 1,
  };
}

function nameFor(team, slot) {
  return team === 0 ? RAID_NAMES[slot] : WARD_NAMES[slot];
}

export function startRound(s) {
  s.round++;
  if (s.round === SIDE_SWITCH_ROUND) { s.team = 1 - s.team; s.losses = 0; }
  s.phase = 'buy';
  s.phaseTime = BUY_TIME;
  s.core = null;
  s.interact = 0;
  s.grenades.length = 0;
  s.smokes.length = 0;
  s.tracers.length = 0;
  s.impacts.length = 0;
  s.lastWinner = null;
  s.flash = 0;
  s.plantedBy = null;
  s.roundKills = 0;
  const old = s.player;
  const keepWeapon = old && old.hp > 0 ? old.weapon : 0;
  const botTier = BOT_TIERS[Math.min(BOT_TIERS.length - 1, Math.max(0, s.round - 1))];
  s.actors.length = 0;
  for (let team = 0; team < 2; team++) {
    const spawns = team === 0 ? MAP.spawns.raider : MAP.spawns.warden;
    for (let slot = 0; slot < 5; slot++) {
      const isPlayer = team === s.team && slot === 0;
      const id = isPlayer ? 0 : 1 + team * 5 + slot;
      const [x, z] = spawns[slot];
      const a = makeActor(id, team, x, z, isPlayer ? keepWeapon : botTier);
      a.name = isPlayer ? 'YOU' : nameFor(team, slot);
      a.slot = slot;
      a.yaw = team === 0 ? 0 : Math.PI;
      a.skill = 0.55 + s.random() * 0.35;
      s.actors.push(a);
      if (isPlayer) s.player = a;
    }
  }
  // Gear is per round: health and armor come back at their starting values, bought gear does not.
  for (const a of s.actors) { a.hp = 100; a.armor = 0; a.helmet = false; a.kit = false; a.aliveSince = 1; }
  s.inventory = { smoke: 1, flash: 1 };
  s.aim = 0;
  s.notice = 'ROUND ' + s.round + ' · ' + (s.team === 0 ? 'RAIDERS: ARM THE CORE' : 'WARDENS: HOLD THE RELAY');
  s.noticeTime = 5;
}

export function canBuy(s) {
  return s.phase === 'buy' && !!s.player && s.player.hp > 0;
}

export function buy(s, i) {
  if (!canBuy(s)) return false;
  const w = WEAPONS[i];
  if (!w || s.money < w.cost) return false;
  if (s.player.weapon === i && w.cost > 0) return false; // never charge twice for the same gun
  s.money -= w.cost;
  Object.assign(s.player, { weapon: i, ammo: w.mag, reserve: w.reserve, reload: 0, recoil: 0 });
  return true;
}

export function buyGear(s, id) {
  if (!canBuy(s)) return false;
  const gear = GEAR.find((g) => g.id === id);
  if (!gear || s.money < gear.cost) return false;
  if (id === 'vest' && s.player.armor >= 100) return false;
  if (id === 'helmet' && s.player.helmet) return false;
  if (id === 'kit' && s.player.kit) return false;
  s.money -= gear.cost;
  if (id === 'vest') s.player.armor = 100;
  else if (id === 'helmet') s.player.helmet = true;
  else s.player.kit = true;
  return true;
}

export function reload(a) {
  const w = WEAPONS[a.weapon];
  if (!a.reload && a.ammo < w.mag && a.reserve > 0) a.reload = w.reload;
}

export function noise(s, a) {
  for (const b of s.actors) {
    if (b.id === a.id || b.hp <= 0) continue;
    if (Math.hypot(b.x - a.x, b.z - a.z) < 26) { b.heard = { x: a.x, z: a.z }; b.alert = 4; }
  }
}

export function endRound(s, team, reason) {
  if (s.phase === 'end' || s.phase === 'match') return;
  s.lastWinner = team;
  s.score[team]++;
  s.phase = 'end';
  s.phaseTime = 6;
  const won = team === s.team;
  s.notice = (won ? 'ROUND SECURED' : 'ROUND LOST') + ' · ' + reason;
  s.noticeTime = 6;
  s.losses = won ? 0 : s.losses + 1;
  // One round bonus, paid on the round's end: win money, or an escalating loss bonus.
  const bonus = won ? 3250 : Math.min(3400, 1400 + 500 * (s.losses - 1));
  s.lastRoundMoney = bonus;
  s.money = Math.min(MAX_MONEY, s.money + bonus);
  if (s.score[team] >= ROUNDS_TO_WIN) {
    s.phase = 'match';
    s.notice = (won ? 'OPERATION COMPLETE' : 'OPERATION FAILED') + ' · FIRST TO SEVEN';
  }
}

// Armor spends itself to cancel half of each hit; a helmet halves head damage before that.
function applyDamage(s, target, amount, shooter, head) {
  let dmg = amount;
  if (head && target.helmet) dmg *= 0.5;
  const absorbed = target.armor > 0 ? Math.min(target.armor, dmg * 0.5) : 0;
  if (absorbed > 0) { target.armor -= absorbed; dmg -= absorbed; }
  target.hp = Math.max(0, target.hp - dmg);
  if (target.id === 0) s.damagePulse = Math.min(1, s.damagePulse + dmg / 60);
  if (shooter.id === 0) s.hitPulse = 0.18;
  if (target.hp === 0 && target.aliveSince !== -1) {
    target.aliveSince = -1;
    target.deaths++;
    shooter.kills++;
    if (target.id === 0) s.deaths++;
    if (shooter.id === 0) {
      s.kills++;
      s.roundKills++;
      s.money = Math.min(MAX_MONEY, s.money + WEAPONS[shooter.weapon].kill);
    }
    s.events.unshift({
      killer: shooter.name, victim: target.name, weapon: WEAPONS[shooter.weapon].name,
      head, team: shooter.team, life: 6,
    });
    s.events.length = Math.min(s.events.length, 5);
  }
  return absorbed;
}

// World position of an actor's rifle muzzle, matching the mesh the renderer builds.
export function muzzlePoint(a) {
  const sin = Math.sin(a.yaw), cos = Math.cos(a.yaw);
  const ox = 0.18, oz = -1.1, scale = a.crouch ? 0.72 : 1;
  return {
    x: a.x + ox * cos + oz * sin,
    y: (a.crouch ? 0.96 : 1.06) * scale,
    z: a.z - ox * sin + oz * cos,
  };
}

export function fire(s, a, yaw, pitch = 0, aim = false) {
  const w = WEAPONS[a.weapon];
  if (s.phase !== 'live' || a.hp <= 0 || a.reload || a.cooldown > 0) return false;
  if (a.ammo === 0) { reload(a); return false; }
  a.ammo--;
  a.cooldown = w.interval;
  a.shots++;
  a.muzzle = 0;
  noise(s, a);
  if (a.id === 0) s.shotPulse = 1;

  // Spread is symmetric about the aim line and grows with movement, hip fire and recoil.
  const moving = Math.hypot(a.vx, a.vz);
  const spread = w.spread * (a.crouch ? 0.55 : 1) * (aim ? 0.45 : 1) + moving * 0.007 + a.recoil * 0.15;
  yaw += (s.random() - 0.5) * spread * 2;
  pitch += (s.random() - 0.5) * spread * 2;
  const cp = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
  const eye = a.height;
  let near = wallDistance(a.x, eye, a.z, dx, dy, dz, 95);
  let target = null, head = false;
  for (const b of s.actors) {
    if (b === a || b.hp <= 0 || b.team === a.team) continue;
    const bodyY = b.crouch ? 0.62 : 0.88;
    const bodyH = b.crouch ? 0.95 : 1.3;
    const body = boxHit(a.x, eye, a.z, dx, dy, dz, b.x, bodyY, b.z, 0.62, bodyH, 0.5, near);
    const skull = boxHit(a.x, eye, a.z, dx, dy, dz, b.x, b.height - 0.1, b.z, 0.36, 0.36, 0.36, near);
    const best = Math.min(body, skull);
    if (best < near) { near = best; target = b; head = skull <= body; }
  }
  const start = a.id === 0 ? { x: a.x, y: eye, z: a.z } : muzzlePoint(a);
  const end = { x: a.x + dx * near, y: eye + dy * near, z: a.z + dz * near };
  if (target) applyDamage(s, target, w.damage * (head ? w.head : 1), a, head);
  else if (near < 95) {
    s.impacts.push({ x: end.x, y: end.y, z: end.z, life: 0.4, kind: 'spark' });
    if (s.impacts.length > 24) s.impacts.splice(0, s.impacts.length - 24);
  }
  s.tracers.push({ x: start.x, y: start.y, z: start.z, ex: end.x, ey: end.y, ez: end.z, life: 0.07, team: a.team });
  if (s.tracers.length > 40) s.tracers.splice(0, s.tracers.length - 40);
  a.recoil = Math.min(0.16, a.recoil + w.recoil);
  return true;
}

export function throwGrenade(s, type, yaw, pitch) {
  if (s.phase !== 'live' || !s.player || s.player.hp <= 0 || s.inventory[type] <= 0) return false;
  s.inventory[type]--;
  const p = s.player;
  s.grenades.push({
    type, x: p.x, y: p.height, z: p.z,
    vx: -Math.sin(yaw) * 12, vy: 4 + Math.sin(pitch) * 8, vz: -Math.cos(yaw) * 12,
    life: 1.4, team: p.team,
  });
  noise(s, p);
  return true;
}

function objective(s, a, dt, using) {
  if (a.hp <= 0) return;
  const site = MAP.sites.find((p) => Math.hypot(p.x - a.x, p.z - a.z) < 3.6);
  if (a.team === 0 && !s.core && site && using) {
    a.objective += dt;
    if (a.id === 0) s.interact = a.objective / ARM_TIME;
    if (a.objective >= ARM_TIME) {
      s.core = { x: site.x, z: site.z, name: site.name, time: CORE_TIME };
      s.plantedBy = a.name;
      s.notice = 'CORE ARMED AT ' + site.name + ' · WARDENS HAVE ' + CORE_TIME + 's';
      s.noticeTime = 5;
      a.objective = 0;
      if (a.id === 0) s.money = Math.min(MAX_MONEY, s.money + 300);
      s.events.unshift({ killer: a.name, victim: 'CORE ' + site.name, weapon: 'CORE CHARGE', head: false, team: a.team, life: 5 });
      s.events.length = Math.min(s.events.length, 5);
    }
  } else if (a.team === 1 && s.core && Math.hypot(a.x - s.core.x, a.z - s.core.z) < 3.2 && using) {
    a.objective += dt;
    const need = a.kit ? KIT_DISARM_TIME : DISARM_TIME;
    if (a.id === 0) s.interact = a.objective / need;
    if (a.objective >= need) endRound(s, 1, 'CORE DISARMED');
  } else {
    a.objective = 0;
    if (a.id === 0) s.interact = 0;
  }
}

function botGoal(s, a) {
  const site = MAP.sites[a.slot % 2];
  const lane = a.slot % 2 === 0 ? -1 : 1;
  if (s.core) {
    return a.team === 1
      ? { x: s.core.x + lane * 3.2, z: s.core.z + (a.slot % 3) * 2.4 }
      : { x: s.core.x + lane * 6, z: s.core.z + 7 };
  }
  if (a.alert > 0 && a.heard) return a.heard;
  if (a.team === s.team && s.player && s.player.hp > 0) {
    if (s.command === 'HOLD') return { x: a.x, z: a.z };
    if (s.command === 'FOLLOW') return { x: s.player.x + lane * 2.2, z: s.player.z + 2.4 };
  }
  return { x: site.x + lane * 4.5, z: site.z + 4 };
}

function bots(s, dt) {
  for (const a of s.actors) {
    if (a.id === 0 || a.hp <= 0) continue;
    a.pathTime -= dt;
    a.alert = Math.max(0, a.alert - dt);
    a.flash = Math.max(0, a.flash - dt);
    let target = null, dist = Infinity;
    for (const b of s.actors) {
      if (b.team === a.team || b.hp <= 0) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      const angle = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      const delta = Math.atan2(Math.sin(angle - a.yaw), Math.cos(angle - a.yaw));
      if (d < dist && d < 42 && (Math.abs(delta) < 1.4 || a.alert > 0 || d < 6) && visible(a, b, s.smokes)) { target = b; dist = d; }
    }
    if (target && a.flash <= 0) {
      const desired = Math.atan2(-(target.x - a.x), -(target.z - a.z));
      a.yaw += Math.atan2(Math.sin(desired - a.yaw), Math.cos(desired - a.yaw)) * Math.min(1, dt * 9);
      a.reaction -= dt;
      a.alert = 4;
      a.heard = { x: target.x, z: target.z };
      if (a.reaction <= 0) {
        // Bots aim at the torso and let the same spread rules decide the hit.
        const miss = (0.022 + dist * 0.0011) * (1.35 - a.skill);
        fire(s, a, a.yaw + (s.random() - 0.5) * miss * 2, (s.random() - 0.5) * miss + 0.004, true);
        a.reaction = 0.1 + s.random() * 0.16;
      }
      if (a.ammo < 3) reload(a);
      if (dist < 11) { a.vx = 0; a.vz = 0; }
    } else {
      a.reaction = 0.3 + s.random() * 0.25;
      const goal = botGoal(s, a);
      const atCore = a.team === 1 && s.core && Math.hypot(a.x - s.core.x, a.z - s.core.z) < 3.2;
      if (!atCore) {
        if (a.path.length === 0 || a.pathTime <= 0) { a.path = route(a, goal); a.pathTime = 4 + s.random(); }
        if (walkable(a, goal)) a.path = [goal];
        const wp = a.path[0];
        if (wp) {
          const dx = wp.x - a.x, dz = wp.z - a.z, d = Math.hypot(dx, dz);
          if (d < 0.7) a.path.shift();
          else {
            const speed = a.flash > 0 ? 1 : 2.7;
            a.vx = dx / d * speed;
            a.vz = dz / d * speed;
            move(a, a.vx * dt, a.vz * dt);
            a.yaw = Math.atan2(-dx, -dz);
          }
        }
      } else { a.vx = 0; a.vz = 0; }
    }
    const onCore = a.team === 1 && s.core && Math.hypot(a.x - s.core.x, a.z - s.core.z) < 3.2;
    const onSite = a.team === 0 && !s.core && MAP.sites.some((p) => Math.hypot(p.x - a.x, p.z - a.z) < 3.6);
    objective(s, a, dt, (onCore || onSite) && (!target || dist > 16));
    if (a.alert > 0 && a.heard && a.shots > 4 && a.slot % 3 === 0 && !a.usedGrenade) {
      a.usedGrenade = true;
      s.grenades.push({
        type: a.team === 0 ? 'smoke' : 'flash', x: a.x, y: 1.5, z: a.z,
        vx: (a.heard.x - a.x) * 0.5, vy: 4, vz: (a.heard.z - a.z) * 0.5, life: 1.4, team: a.team,
      });
    }
  }
}

export function step(s, dt, input) {
  s.time += dt;
  s.tick++;
  s.noticeTime = Math.max(0, s.noticeTime - dt);
  s.shotPulse = Math.max(0, s.shotPulse - dt * 9);
  s.hitPulse = Math.max(0, s.hitPulse - dt);
  s.damagePulse = Math.max(0, s.damagePulse - dt * 2);
  s.flash = Math.max(0, s.flash - dt);
  for (const e of s.events) e.life -= dt;
  for (let i = s.tracers.length - 1; i >= 0; i--) if ((s.tracers[i].life -= dt) <= 0) s.tracers.splice(i, 1);
  for (let i = s.impacts.length - 1; i >= 0; i--) if ((s.impacts[i].life -= dt) <= 0) s.impacts.splice(i, 1);
  if (s.phase === 'briefing' || s.phase === 'match') return;
  s.phaseTime -= dt;
  if (s.phase === 'buy' && s.phaseTime <= 0) { s.phase = 'live'; s.phaseTime = ROUND_TIME; }
  if (s.phase === 'end') { if (s.phaseTime <= 0) startRound(s); return; }

  const p = s.player;
  for (const a of s.actors) {
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.recoil = Math.max(0, a.recoil - dt * 0.09);
    a.muzzle += dt;
    if (a.reload > 0) {
      a.reload -= dt;
      if (a.reload <= 0) {
        const n = Math.min(WEAPONS[a.weapon].mag - a.ammo, a.reserve);
        a.ammo += n;
        a.reserve -= n;
      }
    }
  }
  if (p && p.hp > 0) {
    p.yaw = input.yaw;
    p.crouch = !!input.crouch;
    p.height += ((p.crouch ? 1.08 : 1.65) - p.height) * Math.min(1, dt * 12);
    s.aim += ((input.aim ? 1 : 0) - s.aim) * Math.min(1, dt * 12);
    const speed = p.crouch ? 2.1 : input.walk ? 2.9 : 5.2;
    let mx = input.right || 0, mz = input.forward || 0;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    const tx = (Math.cos(p.yaw) * mx - Math.sin(p.yaw) * mz) * speed;
    const tz = (-Math.sin(p.yaw) * mx - Math.cos(p.yaw) * mz) * speed;
    p.vx += (tx - p.vx) * Math.min(1, dt * 13);
    p.vz += (tz - p.vz) * Math.min(1, dt * 13);
    move(p, p.vx * dt, p.vz * dt);
    // The camera pitch is the aim pitch: recoil kicks the vector the crosshair shows.
    p.pitch = Math.max(-1.5, Math.min(1.5, (input.pitch || 0) - p.recoil));
    if (s.phase === 'live') {
      if (input.fire) fire(s, p, p.yaw, p.pitch, s.aim > 0.55);
      objective(s, p, dt, input.use);
    }
  }
  if (s.phase !== 'live') return;
  bots(s, dt);
  for (let i = s.grenades.length - 1; i >= 0; i--) {
    const g = s.grenades[i];
    g.vy -= dt * 9.8;
    const prev = { x: g.x, z: g.z };
    g.x += g.vx * dt; g.z += g.vz * dt; g.y += g.vy * dt;
    if (wallDistance(prev.x, Math.max(0.2, g.y), prev.z, g.vx, 0, g.vz, dt) < dt) {
      g.x = prev.x; g.z = prev.z; g.vx *= -0.5; g.vz *= -0.5;
    }
    if (g.y < 0.2) { g.y = 0.2; g.vy = Math.abs(g.vy) * 0.3; g.vx *= 0.96; g.vz *= 0.96; }
    g.life -= dt;
    if (g.life <= 0) {
      if (g.type === 'smoke') s.smokes.push({ x: g.x, z: g.z, radius: 4.5, life: 14 });
      else for (const a of s.actors) {
        if (a.hp > 0 && Math.hypot(a.x - g.x, a.z - g.z) < 17 && visible(a, g)) {
          a.flash = 2.8;
          if (a.id === 0) s.flash = 2.8;
        }
      }
      s.grenades.splice(i, 1);
    }
  }
  for (let i = s.smokes.length - 1; i >= 0; i--) if ((s.smokes[i].life -= dt) <= 0) s.smokes.splice(i, 1);
  if (s.core) { s.core.time -= dt; if (s.core.time <= 0) endRound(s, 0, 'CORE DISCHARGED'); }
  else if (s.phaseTime <= 0) endRound(s, 1, 'TIME EXPIRED');
  const raiders = s.actors.some((a) => a.team === 0 && a.hp > 0);
  const wardens = s.actors.some((a) => a.team === 1 && a.hp > 0);
  if (!wardens) endRound(s, 0, 'WARDENS ELIMINATED');
  else if (!raiders && !s.core) endRound(s, 1, 'RAIDERS ELIMINATED');
}

// Living counts for the radar caption and the squad bar.
export function livingCounts(s) {
  let raiders = 0, wardens = 0;
  for (const a of s.actors) {
    if (a.hp <= 0) continue;
    if (a.team === 0) raiders++; else wardens++;
  }
  return { raiders, wardens };
}
