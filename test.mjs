import assert from 'node:assert/strict';
import {
  createGame, startRound, step, buy, buyGear, fire, reload, throwGrenade, endRound,
  WEAPONS, GEAR, START_MONEY, MAX_MONEY, ROUNDS_TO_WIN,
} from './game/simulation.js';
import { blocked, move, route, visible, walkable, MAP, wallDistance } from './game/map.js';

const idle = { yaw: 0, pitch: 0 };
const fresh = () => { const s = createGame(); startRound(s); s.phase = 'live'; s.phaseTime = 105; return s; };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('squads are five versus five with distinct names and teams', () => {
  const s = fresh();
  assert.equal(s.actors.length, 10);
  assert.equal(s.actors.filter((a) => a.team === 0).length, 5);
  assert.equal(s.actors.filter((a) => a.team === 1).length, 5);
  const names = new Set(s.actors.map((a) => a.name));
  assert.equal(names.size, 10);
});

test('buy phase gates purchases and charges exactly the listed price', () => {
  const s = createGame();
  startRound(s);
  assert.equal(s.money, START_MONEY);
  assert.equal(s.phase, 'buy');
  assert.equal(buy(s, 2), false, 'a $2,700 rifle is out of reach on the $800 opening balance');
  s.money = 4000;
  assert(buy(s, 2));
  assert.equal(s.money, 4000 - WEAPONS[2].cost);
  assert.equal(s.player.ammo, WEAPONS[2].mag);
  assert.equal(buy(s, 2), false, 'no double charge for the same gun');
  s.money = 100;
  assert.equal(buy(s, 3), false, 'cannot afford the marksman rifle');
  s.phase = 'live';
  assert.equal(buy(s, 1), false, 'no purchases once the round is live');
});

test('gear purchases are exclusive and priced, with armor and helmet actually stored', () => {
  const s = createGame();
  startRound(s);
  s.money = 3000;
  assert(buyGear(s, 'vest'));
  assert.equal(s.player.armor, 100);
  assert.equal(s.money, 3000 - GEAR[0].cost);
  assert.equal(buyGear(s, 'vest'), false, 'a full vest cannot be bought twice');
  assert(buyGear(s, 'helmet'));
  assert.equal(s.player.helmet, true);
  assert.equal(s.money, 3000 - GEAR[0].cost - GEAR[1].cost);
  assert(buyGear(s, 'kit'));
  assert.equal(s.player.kit, true);
  assert.equal(buyGear(s, 'kit'), false, 'the kit cannot be bought twice');
});

test('collision blocks solids and movement slides along a face', () => {
  const a = { x: 0, z: 20 };
  move(a, 0, -8); // a single step cannot tunnel through the mid barrier at z=15
  assert(!blocked(a.x, a.z), 'movement never leaves an actor inside a solid');
  assert(blocked(0, 15), 'the mid barrier is solid');
  const b = { x: 0, z: 17.2 };
  move(b, 0, -1.5);
  assert(b.z > 16.1, 'a walk into the barrier face is stopped short of it');
  move(b, 4, 0);
  assert(b.x > 0, 'movement along the face still works');
  assert(blocked(0, -22), 'the crate at 0,-22 is solid');
});

test('ammo depletes then reloads only from a finite reserve', () => {
  const s = fresh(), p = s.player;
  p.weapon = 0;
  p.ammo = WEAPONS[0].mag;
  p.reserve = WEAPONS[0].reserve;
  for (let i = 0; i < WEAPONS[0].mag; i++) { p.cooldown = 0; assert(fire(s, p, 0)); }
  assert.equal(p.ammo, 0);
  p.cooldown = 0;
  fire(s, p, 0);
  assert(p.reload > 0, 'firing empty starts a reload');
  for (let i = 0; i < 120; i++) step(s, 1 / 60, idle);
  assert.equal(p.ammo, WEAPONS[0].mag);
  assert.equal(p.reserve, WEAPONS[0].reserve - WEAPONS[0].mag);
});

test('headshots out-damage body shots and armor soaks damage until spent', () => {
  const s = fresh(), p = s.player;
  const enemy = s.actors.find((a) => a.team !== p.team);
  for (const a of s.actors) if (a !== p && a !== enemy) a.hp = 0;
  p.weapon = 2;
  p.x = -23; p.z = 6;
  enemy.x = -23; enemy.z = 0;
  enemy.armor = 0;
  enemy.hp = 100;
  p.cooldown = 0; p.recoil = 0;
  p.height = enemy.height; // level shot into the head box
  fire(s, p, 0, (enemy.height - 0.1 - p.height) / 6, true);
  const headDamage = 100 - enemy.hp;
  assert(headDamage > WEAPONS[2].damage, 'a headshot must exceed one body hit');

  enemy.hp = 100; enemy.armor = 100;
  p.cooldown = 0; p.recoil = 0;
  p.height = enemy.height - 0.1;
  fire(s, p, 0, 0, true);
  const withArmor = 100 - enemy.hp;
  assert(enemy.armor < 100, 'armor must spend itself');
  assert(withArmor < headDamage, 'armor must reduce the damage that lands');
});

test('health and armor reset at the start of every round, bought gear does not carry', () => {
  const s = fresh();
  s.player.hp = 12;
  s.player.armor = 5;
  s.player.helmet = true;
  endRound(s, 1, 'TEST');
  for (let i = 0; i < 400; i++) step(s, 1 / 60, idle);
  assert.equal(s.phase, 'buy');
  assert.equal(s.player.hp, 100);
  assert.equal(s.player.armor, 0);
  assert.equal(s.player.helmet, false);
});

test('wall occlusion keeps hits honest: no shooting through a warehouse', () => {
  const s = fresh(), p = s.player;
  const enemy = s.actors.find((a) => a.team !== p.team);
  for (const a of s.actors) if (a !== p && a !== enemy) a.hp = 0;
  enemy.armor = 0;
  enemy.hp = 100;
  // The west warehouse sits between these two points on the same x.
  p.x = -13; p.z = 18; p.height = 1.65;
  enemy.x = -13; enemy.z = -14;
  p.weapon = 2;
  p.cooldown = 0; p.recoil = 0;
  fire(s, p, 0, 0, true);
  assert.equal(enemy.hp, 100, 'a solid between shooter and target must stop the round');
});

test('an unobstructed shot does land, and records a tracer plus an impact spark', () => {
  const s = fresh(), p = s.player;
  const enemy = s.actors.find((a) => a.team !== p.team);
  for (const a of s.actors) if (a !== p && a !== enemy) a.hp = 0;
  enemy.armor = 0; enemy.hp = 100;
  p.x = 0; p.z = 12.6; p.height = 1.65;
  enemy.x = 0; enemy.z = 8.0;
  enemy.crouch = false;
  p.weapon = 2;
  p.cooldown = 0; p.recoil = 0;
  const before = enemy.hp;
  fire(s, p, 0, (1.3 - p.height) / 4.6, true);
  assert(enemy.hp < before, 'a clear line of fire must connect');
  assert.equal(s.tracers.length, 1);
  s.impacts.length = 0;
  p.cooldown = 0; p.recoil = 0;
  p.yaw = 0;
  fire(s, p, Math.PI, 0, true); // shoot south into the mid barrier
  assert(s.impacts.length >= 1, 'a round that hits a solid spawns an impact spark');
});

test('kill feed names killer, victim and weapon', () => {
  const s = fresh(), p = s.player;
  const enemy = s.actors.find((a) => a.team !== p.team);
  enemy.armor = 0; enemy.hp = 8;
  p.weapon = 2;
  p.x = 0; p.z = 12.6; p.height = 1.65;
  enemy.x = 0; enemy.z = 8;
  p.cooldown = 0; p.recoil = 0;
  fire(s, p, 0, (1.3 - p.height) / 4.6, true);
  const event = s.events[0];
  assert(event, 'a kill must post to the feed');
  assert.equal(event.killer, 'YOU');
  assert.equal(event.victim, enemy.name);
  assert.equal(event.weapon, WEAPONS[2].name);
  assert.equal(s.kills, 1);
  assert.equal(s.money, START_MONEY + WEAPONS[2].kill);
});

test('round, kill and plant rewards land exactly once each', () => {
  const s = fresh();
  const start = s.money;
  endRound(s, 0, 'TEST');
  assert.equal(s.money, start + 3250);
  endRound(s, 0, 'AGAIN');
  assert.equal(s.money, start + 3250, 'endRound is idempotent for a settled round');
  s.money = MAX_MONEY - 10;
  s.phase = 'live';
  const p = s.player;
  p.x = MAP.sites[0].x; p.z = MAP.sites[0].z;
  for (let i = 0; i < 200; i++) step(s, 1 / 60, { ...idle, use: true });
  assert(s.core, 'holding E on site A arms the core');
  assert.equal(s.money, MAX_MONEY, 'plant reward clamps at the money cap');
});

test('loss bonus escalates but never exceeds the cap', () => {
  const s = createGame();
  startRound(s);
  s.money = 0;
  const gains = [];
  for (let i = 0; i < 4; i++) {
    s.phase = 'live';
    const before = s.money;
    endRound(s, 1, 'LOSS');
    gains.push(s.money - before);
    s.phase = 'buy';
  }
  assert(gains[0] < gains[1] && gains[1] < gains[2], 'the loss bonus escalates');
  assert(Math.max(...gains) <= 3400, 'the loss bonus is capped');
});

test('core can be disarmed inside five seconds, and the kit halves it', () => {
  for (const withKit of [false, true]) {
    const s = fresh(), p = s.player;
    s.team = 0;
    s.phase = 'live';
    p.x = MAP.sites[0].x; p.z = MAP.sites[0].z;
    for (const a of s.actors) if (a !== p) { a.x = 30; a.z = 30; a.pathTime = 999; }
    for (let i = 0; i < 200; i++) step(s, 1 / 60, { ...idle, use: true });
    assert(s.core, 'core armed');
    s.team = 1;
    const defender = s.actors.find((a) => a.team === 1);
    for (const a of s.actors) if (a !== defender) a.hp = 0;
    defender.hp = 100;
    defender.x = s.core.x; defender.z = s.core.z;
    defender.kit = withKit;
    s.phase = 'live';
    let ticks = 0;
    while (s.phase === 'live' && ticks < 400) { step(s, 1 / 60, idle); ticks++; }
    assert.equal(s.lastWinner, 1, 'the defender disarms the core');
    const seconds = ticks / 60;
    if (withKit) assert(seconds < 4.6, 'a kit disarms faster than five seconds');
    else assert(seconds >= 4.6, 'without a kit the disarm needs five seconds');
  }
});

test('smoke blocks bot sight and grenades consume inventory', () => {
  const s = fresh();
  assert(throwGrenade(s, 'smoke', 0, 0));
  assert.equal(throwGrenade(s, 'smoke', 0, 0), false, 'one smoke per round');
  for (let i = 0; i < 120; i++) step(s, 1 / 60, idle);
  assert(s.smokes.length);
  const m = s.smokes[0];
  assert(!visible({ x: m.x - 6, z: m.z }, { x: m.x + 6, z: m.z }, s.smokes));
});

test('seven round wins end the match, sides swap after six rounds', () => {
  const s = createGame();
  startRound(s);
  const firstTeam = s.team;
  for (let r = 0; r < 6; r++) {
    s.phase = 'live';
    endRound(s, firstTeam, 'TEST');
    s.phase = 'buy';
    startRound(s);
  }
  assert.equal(s.team, 1 - firstTeam, 'sides swap after round six');
  let guard = 0;
  while (s.phase !== 'match' && guard++ < 40) {
    s.phase = 'live';
    endRound(s, s.team, 'TEST');
    if (s.phase === 'match') break;
    s.phase = 'buy';
    startRound(s);
  }
  assert.equal(s.phase, 'match');
  assert(s.score[0] >= ROUNDS_TO_WIN || s.score[1] >= ROUNDS_TO_WIN);
});

test('bots advance along collision-clear routes and exchange fire', () => {
  const s = fresh();
  s.command = 'SPLIT';
  const bots = s.actors.filter((a) => a.id !== 0);
  const before = bots.map((a) => [a.x, a.z]);
  let shots = 0;
  for (let i = 0; i < 1800; i++) {
    step(s, 1 / 60, idle);
    for (const a of bots) if (a.shots > 0) shots++;
  }
  assert(bots.some((a, i) => Math.hypot(a.x - before[i][0], a.z - before[i][1]) > 6), 'bots must move');
  assert(shots > 0, 'bots must actually shoot');
  for (const b of bots) assert(!blocked(b.x, b.z, 0.2), 'no bot may end up inside a solid');
});

test('every navigation node is reachable and every route is walkable', () => {
  for (const [x, z] of MAP.nodes) assert(!blocked(x, z, 0.42), `node ${x},${z} is inside a solid`);
  for (const from of MAP.nodes) {
    for (const site of MAP.sites) {
      const path = route({ x: from[0], z: from[1] }, site);
      assert(path.length > 0, `no route from ${from} to ${site.name}`);
    }
  }
});

test('map solids all occlude sight and stop movement where drawn', () => {
  for (const w of MAP.walls) {
    assert(blocked(w.x, w.z), `solid at ${w.x},${w.z} must block movement`);
    const hit = wallDistance(w.x, w.h / 2, w.z + w.d / 2 + 6, 0, 0, -1, 12);
    assert(hit < 12, `solid at ${w.x},${w.z} must stop a ray`);
  }
});

test('fixed-step simulation reproduces exactly from the same seed', () => {
  const run = () => {
    const s = fresh();
    for (let i = 0; i < 900; i++) step(s, 1 / 60, idle);
    return JSON.stringify(s, (k, v) => (typeof v === 'function' ? undefined : v));
  };
  assert.equal(run(), run());
});

test('radar counts and headings reflect living actors', async () => {
  const { livingCounts } = await import('./game/simulation.js');
  const s = fresh();
  assert.deepEqual(livingCounts(s), { raiders: 5, wardens: 5 });
  s.actors.find((a) => a.team === 1).hp = 0;
  assert.deepEqual(livingCounts(s), { raiders: 5, wardens: 4 });
  for (const a of s.actors) assert.equal(typeof a.yaw, 'number');
});

console.log(`${passed} gameplay checks passed`);
