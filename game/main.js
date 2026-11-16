import { createGame, startRound, step, buy, buyGear, reload, throwGrenade, WEAPONS, GEAR } from './simulation.js';
import { MAP } from './map.js';
import { crossfire } from './scenarios.js';
import { View, hud } from './render.js';

const $ = (id) => document.getElementById(id);
const game = createGame();
const view = new View($('world'));
const input = { yaw: 0, pitch: 0, forward: 0, right: 0, fire: false, aim: false, use: false, crouch: false, walk: false };
const keys = new Set();
let locked = false, shopOpen = false, deployed = false, dragging = false, accumulator = 0, last = performance.now(), audio = null, lastShot = 0;

function sound(kind) {
  if (!audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.type = kind === 'shot' ? 'sawtooth' : 'sine';
  osc.frequency.setValueAtTime(kind === 'shot' ? 120 : 520, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(34, audio.currentTime + 0.11);
  gain.gain.setValueAtTime(kind === 'shot' ? 0.07 : 0.035, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.14);
  osc.start();
  osc.stop(audio.currentTime + 0.15);
}

function capture() {
  if (!audio) audio = new AudioContext();
  audio.resume();
  deployed = true;
  $('pause').hidden = true;
  const request = $('world').requestPointerLock();
  if (request && request.catch) request.catch(() => {
    game.notice = 'MOUSE CAPTURE UNAVAILABLE · DRAG TO LOOK';
    game.noticeTime = 5;
  });
}

$('world').addEventListener('mousedown', () => { if (deployed) dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
document.addEventListener('pointerlockerror', () => { game.notice = 'DRAG TO LOOK · WASD TO MOVE'; game.noticeTime = 5; });
$('deploy').onclick = () => { $('briefing').hidden = true; startRound(game); capture(); };
$('resume').onclick = capture;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === $('world');
  $('pause').hidden = locked || shopOpen || game.phase === 'briefing' || game.phase === 'match';
  input.fire = false;
});
document.addEventListener('mousemove', (e) => {
  if (!locked && !dragging) return;
  input.yaw -= e.movementX * 0.002;
  input.pitch = Math.max(-1.45, Math.min(1.45, input.pitch - e.movementY * 0.002));
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (locked || (deployed && !shopOpen && e.target === $('world'))) {
    if (e.button === 0) input.fire = true;
    if (e.button === 2) input.aim = true;
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.fire = false;
  if (e.button === 2) input.aim = false;
});

function toggleShop() {
  if (game.phase !== 'buy') return;
  shopOpen = !shopOpen;
  $('shop').hidden = !shopOpen;
  if (shopOpen) { document.exitPointerLock(); $('pause').hidden = true; }
  else capture();
}
$('ready').onclick = () => { shopOpen = false; $('shop').hidden = true; capture(); };

// Armory: four weapons with their real prices plus the three gear items.
$('shopitems').innerHTML = WEAPONS.map((w, i) => `<button data-kind="weapon" data-id="${i}">${i + 1} / ${w.name}<br><br>${w.cost === 0 ? 'ISSUED' : '$' + w.cost.toLocaleString()} · ${w.mag} ROUNDS · ${w.auto ? 'AUTOMATIC' : 'SEMI'}</button>`).join('')
  + GEAR.map((g, i) => `<button data-kind="gear" data-id="${g.id}">${5 + i} / ${g.name}<br><br>$${g.cost.toLocaleString()} · ${g.note}</button>`).join('');
for (const b of $('shopitems').querySelectorAll('button')) {
  b.onclick = () => {
    const ok = b.dataset.kind === 'gear' ? buyGear(game, b.dataset.id) : buy(game, Number(b.dataset.id));
    if (ok) sound('buy');
    renderShop();
  };
}
function renderShop() {
  for (const b of $('shopitems').querySelectorAll('button')) {
    const price = b.dataset.kind === 'gear'
      ? GEAR.find((g) => g.id === b.dataset.id).cost
      : WEAPONS[Number(b.dataset.id)].cost;
    b.disabled = game.money < price;
  }
  $('shopmoney').textContent = '$' + game.money.toLocaleString();
}

addEventListener('keydown', (e) => {
  if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyB') toggleShop();
  if (e.code === 'KeyR' && game.player) reload(game.player);
  if (e.code === 'KeyG') throwGrenade(game, 'smoke', input.yaw, input.pitch);
  if (e.code === 'KeyF') throwGrenade(game, 'flash', input.yaw, input.pitch);
  if (e.code === 'KeyZ') {
    const commands = ['FOLLOW', 'SPLIT', 'HOLD'];
    game.command = commands[(commands.indexOf(game.command) + 1) % 3];
    game.notice = 'SQUAD / ' + game.command;
    game.noticeTime = 2;
  }
  if (e.code === 'Tab') $('scores').hidden = false;
  if (shopOpen && /^Digit[1-7]$/.test(e.code)) {
    const n = Number(e.code.slice(-1));
    const ok = n <= 4 ? buy(game, n - 1) : buyGear(game, GEAR[n - 5].id);
    if (ok) sound('buy');
    renderShop();
  }
  if (e.code === 'Enter' && game.phase === 'match') {
    game.score = [0, 0];
    game.round = 0;
    game.money = 800;
    startRound(game);
    capture();
  }
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab') $('scores').hidden = true; });
addEventListener('blur', () => { keys.clear(); input.fire = false; });

// Radar: map footprint, both sites, every living teammate with a heading tick, and any
// enemy the squad can currently see. Living counts sit under the dial.
function radar() {
  const c = $('minimap').getContext('2d');
  const size = 190;
  const scale = size / 76;
  const center = size / 2;
  c.clearRect(0, 0, size, size);
  c.fillStyle = '#0b2129';
  c.fillRect(0, 0, size, size);
  c.strokeStyle = '#2c5f6c';
  c.lineWidth = 1;
  for (const w of MAP.walls) {
    c.fillStyle = w.kind === 'warehouse' ? '#2f6270' : w.kind === 'sea' ? '#1d4450' : '#3d7681';
    c.fillRect(center + (w.x - w.w / 2) * scale, center + (w.z - w.d / 2) * scale, w.w * scale, w.d * scale);
  }
  for (const site of MAP.sites) {
    c.fillStyle = site.name === 'A' ? '#efbb75' : '#61dfcf';
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillText(site.name, center + site.x * scale, center + site.z * scale + 4);
  }
  for (const a of game.actors) {
    if (a.hp <= 0) continue;
    const x = center + a.x * scale, y = center + a.z * scale;
    if (a.id === 0) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(x, y, 3.6, 0, Math.PI * 2);
      c.fill();
      continue;
    }
    const friendly = a.team === game.team;
    if (!friendly && a.alert <= 0) continue; // enemies show only while the squad has them spotted
    c.fillStyle = friendly ? '#5fd8cb' : '#f0796a';
    c.beginPath();
    c.moveTo(x, y - 4);
    c.lineTo(x + 3.2, y + 2.6);
    c.lineTo(x - 3.2, y + 2.6);
    c.closePath();
    c.fill();
    // Heading tick: the direction the operator is actually facing.
    c.strokeStyle = c.fillStyle;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - Math.sin(a.yaw) * 7, y - Math.cos(a.yaw) * 7);
    c.stroke();
  }
  // Own facing cone.
  if (game.player) {
    const p = game.player;
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(center + p.x * scale, center + p.z * scale);
    c.lineTo(center + (p.x - Math.sin(p.yaw) * 7) * scale, center + (p.z - Math.cos(p.yaw) * 4) * scale);
    c.stroke();
  }
}

let uiTick = 0;
function updateUI() {
  const h = hud(game);
  $('score0').textContent = h.score[0];
  $('score1').textContent = h.score[1];
  $('timer').textContent = Math.floor(h.time / 60).toString().padStart(2, '0') + ':' + (h.time % 60).toString().padStart(2, '0');
  $('phase').textContent = h.phase === 'buy' ? 'BUY PHASE' : h.site ? 'CORE ARMED' : h.phase === 'end' ? 'ROUND OVER' : 'LIVE';
  $('round').textContent = 'ROUND ' + String(h.round).padStart(2, '0') + ' / FIRST TO 7';
  $('hp').textContent = Math.ceil(h.hp);
  $('armor').textContent = h.armor;
  $('gear').textContent = (h.helmet ? 'HELMET' : 'NO HELMET') + ' · ' + (h.kit ? 'KIT' : 'NO KIT');
  $('healthbar').style.width = (h.hp * 2.2) + 'px';
  $('money').textContent = '$' + h.money.toLocaleString();
  $('ammo').textContent = h.ammo;
  $('reserve').textContent = '/ ' + h.reserve;
  $('gunname').textContent = h.weapon;
  $('faction').textContent = h.team === 0 ? 'RAIDER' : 'WARDEN';
  $('reload').textContent = game.player && game.player.reload > 0 ? 'RELOADING…' : 'R / RELOAD';
  $('notice').textContent = h.noticeTime > 0 ? h.notice : h.phase === 'match' ? h.notice + ' · ENTER TO RESTART' : game.player && game.player.hp <= 0 ? 'OPERATOR DOWN · SQUAD STILL ACTIVE' : '';
  $('objective').textContent = h.site ? 'CORE ' + h.site + ' / DISARM IN ' + Math.ceil(h.coreTime) + 's' : h.team === 0 ? 'ARM THE CORE / SITE A OR B' : 'DEFEND THE RELAY / A + B';
  $('grenades').textContent = 'G SMOKE ' + h.inventory.smoke + '  F FLASH ' + h.inventory.flash + '  · SQUAD ' + h.command;
  $('squad').textContent = h.counts.raiders + ' V ' + h.counts.wardens;
  $('killfeed').innerHTML = h.events.filter((e) => e.life > 0)
    .map((e) => `<div class="${e.team === h.team ? 'mine' : 'theirs'}"><b>${e.killer}</b><i>${e.weapon}</i><b>${e.victim}</b>${e.head ? '<u>HEADSHOT</u>' : ''}</div>`)
    .join('');
  $('progress').style.display = h.interact > 0 ? 'block' : 'none';
  $('progress').firstElementChild.style.width = Math.min(100, h.interact * 100) + '%';
  $('hitmarker').style.opacity = game.hitPulse > 0 ? 1 : 0;
  $('damage').style.opacity = game.damagePulse;
  $('flash').style.opacity = Math.min(1, game.flash);
  const moveSpread = Math.hypot(game.player ? game.player.vx : 0, game.player ? game.player.vz : 0) * 2;
  $('crosshair').style.setProperty('--gap', (5 + (game.player ? game.player.recoil : 0) * 90 + moveSpread) + 'px');
  if (game.phase !== 'buy' && shopOpen) { shopOpen = false; $('shop').hidden = true; capture(); }
  if (shopOpen) renderShop();
  $('roster').innerHTML = game.actors.map((a) => `<div><b>${a.name} / ${a.team === 0 ? 'RAIDER' : 'WARDEN'}</b><span>${a.hp > 0 ? Math.ceil(a.hp) + ' HP' + (a.armor > 0 ? ' + ' + Math.round(a.armor) + ' AR' : '') : 'DOWN'} · ${a.kills} K</span></div>`).join('');
  radar();
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  const active = (deployed || locked || window.__testing) && !shopOpen && $('pause').hidden;
  if (active) {
    input.forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    input.right = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    input.crouch = keys.has('ControlLeft') || keys.has('KeyC');
    input.walk = keys.has('ShiftLeft');
    input.use = keys.has('KeyE');
    accumulator += elapsed;
    let guard = 0;
    while (accumulator >= 1 / 60 && guard++ < 8) {
      step(game, 1 / 60, input);
      accumulator -= 1 / 60;
    }
    if (game.player && game.player.shots !== lastShot) {
      lastShot = game.player.shots;
      sound('shot');
      if (!WEAPONS[game.player.weapon].auto) input.fire = false;
    }
  }
  view.update(game);
  if (now - uiTick > 50) { updateUI(); uiTick = now; }
  requestAnimationFrame(frame);
}

// Local QA hooks drive the same simulation and renderer as normal play.
window.game = {
  state: game, input, keys, view,
  start() { startRound(game); $('briefing').hidden = true; },
  step(n) { for (let i = 0; i < n; i++) step(game, 1 / 60, input); },
  buy(i) { return buy(game, i); },
  gear(id) { return buyGear(game, id); },
  throw(type) { return throwGrenade(game, type, input.yaw, input.pitch); },
  reload() { reload(game.player); },
  crossfire() { crossfire(game); input.yaw = game.player.yaw; input.pitch = 0; },
};
requestAnimationFrame(frame);
