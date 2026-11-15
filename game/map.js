// Pelagic Relay: three connected lanes around a seawater energy station.
export const MAP = {
  bounds: 27,
  sites: [{ x: -16, z: -16, name: 'A', label: 'TURBINE' }, { x: 16, z: -14, name: 'B', label: 'RELAY' }],
  walls: [
    [0, -28, 58, 2, 7], [0, 28, 58, 2, 7], [-28, 0, 2, 58, 7], [28, 0, 2, 58, 7],
    [-7, 10, 3, 19, 4.6], [7, 10, 3, 19, 4.6],
    [-12, -5, 10, 3, 4.6], [11, -5, 11, 3, 4.6],
    [-5, -17, 3, 12, 5.4], [5, -18, 3, 10, 5.4],
    [-20, 5, 8, 3, 3.7], [20, 5, 8, 3, 3.7],
    [-17, -12, 4, 3, 1.1], [18, -18, 5, 3, 1.1],
    [-18, 16, 3, 4, 1.3], [18, 16, 3, 4, 1.3],
    [0, 0, 3.6, 5, 1.25], [-21, -23, 6, 2, 2.1], [21, -24, 6, 2, 2.1],
    [-12, 23, 6, 2, 1.2], [12, 23, 6, 2, 1.2],
  ],
  nodes: [
    [0,23],[-12,21],[12,21],[-22,12],[22,12],[0,10],[-22,-1],[22,-1],[0,-6],
    [-20,-16],[19,-14],[0,-24],[-12,-23],[12,-23],[-12,-10],[12,-10],[-12,0],[12,0]
  ],
};
export function blocked(x, z, r = .34) {
  if (Math.abs(x) > MAP.bounds-r || Math.abs(z) > MAP.bounds-r) return true;
  for (const [cx,cz,w,d] of MAP.walls) {
    if (x>cx-w/2-r && x<cx+w/2+r && z>cz-d/2-r && z<cz+d/2+r) return true;
  }
  return false;
}
export function move(a, dx, dz) {
  if (!blocked(a.x+dx,a.z)) a.x+=dx;
  if (!blocked(a.x,a.z+dz)) a.z+=dz;
}
// Slab intersection returns entry distance on a finite ray, including height.
export function boxHit(ox,oy,oz,dx,dy,dz,cx,cy,cz,w,h,d,max=100) {
  let lo=0,hi=max;
  const origins=[ox,oy,oz], dirs=[dx,dy,dz], centers=[cx,cy,cz], halves=[w/2,h/2,d/2];
  for(let i=0;i<3;i++) {
    if(Math.abs(dirs[i])<1e-8) {if(Math.abs(origins[i]-centers[i])>halves[i])return Infinity;}
    else {let a=(centers[i]-halves[i]-origins[i])/dirs[i], b=(centers[i]+halves[i]-origins[i])/dirs[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;}
  }
  return lo;
}
export function wallDistance(ox,oy,oz,dx,dy,dz,max=100) {
  let hit=max;
  for(const [x,z,w,d,h] of MAP.walls)hit=Math.min(hit,boxHit(ox,oy,oz,dx,dy,dz,x,h/2,z,w,h,d,max));
  return hit;
}
export function visible(a,b,smokes=[]) {
  const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
  if(wallDistance(a.x,1.35,a.z,dx/dist,0,dz/dist,dist)<dist-.1)return false;
  for(const s of smokes)if(s.life>0){const t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/(dist*dist)));if(Math.hypot(a.x+dx*t-s.x,a.z+dz*t-s.z)<s.radius)return false;}
  return true;
}
// The same collision geometry generates a visibility graph; no hidden bot shortcuts.
export function walkable(a,b){const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(distance/.25);for(let i=1;i<=steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,.4))return false;return true;}
export const graph=MAP.nodes.map((n,i)=>MAP.nodes.map((m,j)=>i!==j&&walkable({x:n[0],z:n[1]},{x:m[0],z:m[1]})?j:-1).filter(j=>j>=0));
export function route(a,goal) {
  let start=-1,end=-1,sd=Infinity,ed=Infinity;
  for(let i=0;i<MAP.nodes.length;i++) {const [x,z]=MAP.nodes[i];let d=Math.hypot(x-a.x,z-a.z);if(d<sd&&walkable(a,{x,z})){sd=d;start=i;}d=Math.hypot(x-goal.x,z-goal.z);if(d<ed&&walkable(goal,{x,z})){ed=d;end=i;}}
  if(start<0||end<0)return [];
  const costs=MAP.nodes.map(()=>Infinity),prev=MAP.nodes.map(()=>-1),done=new Set();costs[start]=0;
  while(done.size<costs.length){let u=-1;for(let i=0;i<costs.length;i++)if(!done.has(i)&&(u<0||costs[i]<costs[u]))u=i;if(u<0||costs[u]===Infinity||u===end)break;done.add(u);for(const v of graph[u]){let d=costs[u]+Math.hypot(MAP.nodes[u][0]-MAP.nodes[v][0],MAP.nodes[u][1]-MAP.nodes[v][1]);if(d<costs[v]){costs[v]=d;prev[v]=u;}}}
  const result=[];for(let i=end;i>=0;i=prev[i]){result.unshift({x:MAP.nodes[i][0],z:MAP.nodes[i][1]});if(i===start)break;}result.push({x:goal.x,z:goal.z});return result;
}
