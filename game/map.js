// Pelagic Relay: an original North Atlantic harbour map. Every solid is declared once here
// and drives both the simulation's collision/occlusion rays and the renderer's dressing, so a
// prop a player can see is always a prop a bullet stops on and a body cannot walk through.
export const MAP = {
  bounds: 34,
  sites: [
    { x: -23, z: -22, name: 'A', label: 'TURBINE HALL' },
    { x: 23, z: -20, name: 'B', label: 'RELAY MAST' },
  ],
  spawns: {
    raider: [[-20, 27], [-10, 27], [0, 27], [10, 27], [20, 27]],
    warden: [[-20, -32], [-10, -32], [0, -30], [10, -32], [20, -32]],
  },
  // kind picks both the material dressing and how the shape reads at a glance.
  walls: [
    // Seawall perimeter.
    { x: 0, z: 35, w: 70, d: 2, h: 6, kind: 'sea' },
    { x: 0, z: -35, w: 70, d: 2, h: 6, kind: 'sea' },
    { x: -35, z: 0, w: 2, d: 70, h: 6, kind: 'sea' },
    { x: 35, z: 0, w: 2, d: 70, h: 6, kind: 'sea' },
    // Two transit warehouses split the yard into a mid corridor and two outside lanes.
    { x: -13, z: 2, w: 12, d: 22, h: 8.5, kind: 'warehouse', label: 'PELAGIC / FREIGHT 2' },
    { x: 13, z: 2, w: 12, d: 22, h: 8.5, kind: 'warehouse', label: 'NORTH DOCK / BERTH 4' },
    // Mid corridor: crates, a stacked freight pair and a low wall at each mouth.
    { x: 0, z: 15, w: 5, d: 2.2, h: 1.25, kind: 'barrier' },
    { x: -3.4, z: 4, w: 3, d: 3, h: 1.4, kind: 'crate' },
    { x: 3.4, z: -5, w: 3, d: 3, h: 1.4, kind: 'crate' },
    { x: 0, z: -13.5, w: 5, d: 2.2, h: 1.25, kind: 'barrier' },
    { x: -5.6, z: 8.5, w: 2.4, d: 6, h: 2.6, kind: 'freight' },
    { x: 5.7, z: 9.5, w: 2.2, d: 5, h: 2.6, kind: 'freight' },
    // West lane freight and the A-side terminal block.
    { x: -27, z: 12, w: 6, d: 10, h: 3.2, kind: 'freight' },
    { x: -27, z: -6, w: 6, d: 12, h: 3.2, kind: 'freight' },
    { x: -29, z: -18, w: 5, d: 9, h: 3.2, kind: 'freight' },
    { x: -16, z: -28, w: 12, d: 5, h: 3.4, kind: 'freight', label: 'TURBINE HALL' },
    // East lane freight and the B-side terminal block.
    { x: 27, z: 12, w: 6, d: 10, h: 3.2, kind: 'freight' },
    { x: 27, z: -5, w: 6, d: 12, h: 3.2, kind: 'freight' },
    { x: 30, z: -18, w: 4, d: 8, h: 3.2, kind: 'freight' },
    { x: 16, z: -28, w: 12, d: 5, h: 3.4, kind: 'freight', label: 'RELAY MAST' },
    // Cover that shapes both sites and the north connector.
    { x: -23, z: -14, w: 6, d: 2, h: 1.2, kind: 'barrier' },
    { x: -19, z: -20, w: 2, d: 5, h: 1.2, kind: 'barrier' },
    { x: -27, z: -26, w: 3, d: 3, h: 1.3, kind: 'crate' },
    { x: 23, z: -13, w: 6, d: 2, h: 1.2, kind: 'barrier' },
    { x: 19, z: -20, w: 2, d: 5, h: 1.2, kind: 'barrier' },
    { x: 28, z: -25, w: 3, d: 3, h: 1.3, kind: 'crate' },
    { x: 0, z: -22, w: 3, d: 3, h: 1.3, kind: 'crate' },
    { x: -8, z: -24, w: 2, d: 2, h: 1.1, kind: 'crate' },
    { x: 8, z: -25, w: 2, d: 2, h: 1.1, kind: 'crate' },
    // South yard: spawn cover, so neither team can be shot off its own spawn line.
    { x: -14, z: 22, w: 4, d: 2, h: 1.2, kind: 'barrier' },
    { x: 14, z: 22, w: 4, d: 2, h: 1.2, kind: 'barrier' },
    { x: 0, z: 22, w: 3, d: 3, h: 1.3, kind: 'crate' },
    { x: -30, z: 26, w: 4, d: 4, h: 1.3, kind: 'crate' },
    { x: 30, z: 26, w: 4, d: 4, h: 1.3, kind: 'crate' },
  ],
  // Navigation nodes are accepted only where they clear the same collision radius actors use.
  nodes: [
    [-20, 27], [-10, 27], [0, 27], [10, 27], [20, 27],
    [-24, 18], [24, 18], [-30, 16], [30, 16],
    [0, 18], [0, 11], [0, 0], [0, -9], [0, -18], [0, -27],
    [-22, 8], [-22, -3], [-22, -14], [-22, -26],
    [22, 8], [22, -3], [22, -14], [22, -26],
    [-30, 4], [-30, -10], [30, 4], [30, -10],
    [-16, -24], [16, -24], [-23, -22], [23, -20],
    [-11, -18], [11, -18],
  ],
};

const RADIUS = 0.34;

export function blocked(x, z, r = RADIUS) {
  if (Math.abs(x) > MAP.bounds - r || Math.abs(z) > MAP.bounds - r) return true;
  for (const w of MAP.walls) {
    if (x > w.x - w.w / 2 - r && x < w.x + w.w / 2 + r && z > w.z - w.d / 2 - r && z < w.z + w.d / 2 + r) return true;
  }
  return false;
}

export function move(a, dx, dz) {
  if (!blocked(a.x + dx, a.z)) a.x += dx;
  if (!blocked(a.x, a.z + dz)) a.z += dz;
}

// Slab intersection: entry distance along a finite ray, or Infinity.
export function boxHit(ox, oy, oz, dx, dy, dz, cx, cy, cz, w, h, d, max = 100) {
  let lo = 0, hi = max;
  const origins = [ox, oy, oz], dirs = [dx, dy, dz], centers = [cx, cy, cz], halves = [w / 2, h / 2, d / 2];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dirs[i]) < 1e-8) { if (Math.abs(origins[i] - centers[i]) > halves[i]) return Infinity; }
    else {
      let a = (centers[i] - halves[i] - origins[i]) / dirs[i], b = (centers[i] + halves[i] - origins[i]) / dirs[i];
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a); hi = Math.min(hi, b);
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}

export function wallDistance(ox, oy, oz, dx, dy, dz, max = 100) {
  let hit = max;
  for (const w of MAP.walls) hit = Math.min(hit, boxHit(ox, oy, oz, dx, dy, dz, w.x, w.h / 2, w.z, w.w, w.h, w.d, max));
  return hit;
}

// Nearest solid a segment meets, so impact effects can sit exactly where the bullet stopped.
export function wallImpact(ox, oy, oz, dx, dy, dz, max = 100) {
  let best = max, wall = null;
  for (const w of MAP.walls) {
    const t = boxHit(ox, oy, oz, dx, dy, dz, w.x, w.h / 2, w.z, w.w, w.h, w.d, best);
    if (t < best) { best = t; wall = w; }
  }
  return best < max ? { distance: best, wall } : null;
}

export function visible(a, b, smokes = []) {
  const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return true;
  const eye = a.height ?? 1.7;
  if (wallDistance(a.x, eye, a.z, dx / dist, 0, dz / dist, dist) < dist - 0.1) return false;
  for (const s of smokes) if (s.life > 0) {
    const t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.z - a.z) * dz) / (dist * dist)));
    if (Math.hypot(a.x + dx * t - s.x, a.z + dz * t - s.z) < s.radius) return false;
  }
  return true;
}

// Navigation edges come from the collision geometry itself: no hidden bot shortcuts.
export function walkable(a, b) {
  const distance = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(distance / 0.25);
  for (let i = 1; i <= steps; i++) {
    if (blocked(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, 0.4)) return false;
  }
  return true;
}

// Derive a connected clearance grid from the actual solids, rather than hand placing
// waypoints that become invalid whenever cover moves. Keep spawns and sites explicit.
MAP.nodes = [];
for (let x = -32; x <= 32; x += 4) {
  for (let z = -32; z <= 32; z += 4) {
    if (!blocked(x, z, 0.42)) MAP.nodes.push([x, z]);
  }
}
for (const p of [...MAP.spawns.raider, ...MAP.spawns.warden, ...MAP.sites.map(p => [p.x, p.z])]) {
  if (!blocked(p[0], p[1], 0.42)) MAP.nodes.push(p);
}

export const graph = MAP.nodes.map((n, i) => MAP.nodes
  .map((m, j) => (i !== j && walkable({ x: n[0], z: n[1] }, { x: m[0], z: m[1] }) ? j : -1))
  .filter((j) => j >= 0));

export function route(a, goal) {
  let start = -1, end = -1, sd = Infinity, ed = Infinity;
  for (let i = 0; i < MAP.nodes.length; i++) {
    const [x, z] = MAP.nodes[i];
    let d = Math.hypot(x - a.x, z - a.z);
    if (d < sd && walkable(a, { x, z })) { sd = d; start = i; }
    d = Math.hypot(x - goal.x, z - goal.z);
    if (d < ed && walkable(goal, { x, z })) { ed = d; end = i; }
  }
  if (start < 0 || end < 0) return [];
  const costs = MAP.nodes.map(() => Infinity), prev = MAP.nodes.map(() => -1), done = new Set();
  costs[start] = 0;
  while (done.size < costs.length) {
    let u = -1;
    for (let i = 0; i < costs.length; i++) if (!done.has(i) && (u < 0 || costs[i] < costs[u])) u = i;
    if (u < 0 || costs[u] === Infinity || u === end) break;
    done.add(u);
    for (const v of graph[u]) {
      const d = costs[u] + Math.hypot(MAP.nodes[u][0] - MAP.nodes[v][0], MAP.nodes[u][1] - MAP.nodes[v][1]);
      if (d < costs[v]) { costs[v] = d; prev[v] = u; }
    }
  }
  if (costs[end] === Infinity) return [];
  const result = [];
  for (let i = end; i >= 0; i = prev[i]) { result.unshift({ x: MAP.nodes[i][0], z: MAP.nodes[i][1] }); if (i === start) break; }
  result.push({ x: goal.x, z: goal.z });
  return result;
}
