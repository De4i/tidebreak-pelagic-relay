// Reproducible local training setup for captures. It only positions ordinary actors on the
// real map: same health, ammunition, damage, spread, AI and renderer as a live round. It paints
// no soldiers and adds no effects of its own; every tracer, flash and spark in a capture comes
// from the simulation actually resolving shots between these operators.
export function crossfire(s) {
  const player = s.player;
  Object.assign(player, { x: 0, z: 19, yaw: 0, pitch: -0.004 });
  // Two squadmates pushing the mid corridor north, one holding the east mouth.
  const squad = [
    { slot: 1, x: -4.6, z: 8.4, yaw: 0.06, weapon: 2 },
    { slot: 2, x: 4.6, z: 4.2, yaw: -0.05, weapon: 1 },
    { slot: 3, x: -1.4, z: 1.4, yaw: 0.02, weapon: 2 },
  ];
  // Warden pair dug in at the far end of the corridor, firing south into them.
  const enemy = [
    { slot: 1, x: 0.4, z: -3.4, yaw: Math.PI, weapon: 2 },
    { slot: 2, x: -4.2, z: -8.6, yaw: Math.PI + 0.04, weapon: 2 },
    { slot: 3, x: 4.4, z: -9.4, yaw: Math.PI - 0.05, weapon: 1 },
  ];
  const place = (a, p) => {
    Object.assign(a, {
      x: p.x, z: p.z, yaw: p.yaw, weapon: p.weapon, path: [], pathTime: 0,
      alert: 4, heard: { x: player.x, z: player.z }, reaction: 0.02 + p.slot * 0.03,
      cooldown: 0, reload: 0, vx: 0, vz: 0, muzzle: 9,
    });
    a.ammo = 30;
    a.reserve = 90;
  };
  for (const p of squad) {
    const a = s.actors.find((x) => x.id !== 0 && x.team === player.team && x.slot === p.slot);
    if (a) place(a, p);
  }
  for (const p of enemy) {
    const a = s.actors.find((x) => x.team !== player.team && x.slot === p.slot);
    if (a) place(a, p);
  }
  player.weapon = 2;
  player.ammo = 30;
  player.reserve = 90;
  s.command = 'SPLIT';
  s.phase = 'live';
  s.phaseTime = 100;
}
