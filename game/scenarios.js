// Reproducible local training setup. It uses ordinary actors, ammo, damage and bot AI;
// no painted soldiers, fake tracers, extra health or alternate renderer.
export function crossfire(s){
 const placements=[[-3.1,5,0],[-3.2,-7,Math.PI],[3.2,-8,Math.PI]];
 const ids=[2,5,6];
 for(let i=0;i<ids.length;i++){const a=s.actors.find(a=>a.id===ids[i]);if(!a)continue;const [x,z,yaw]=placements[i];Object.assign(a,{x,z,yaw,path:[],pathTime:0,alert:3,reaction:.10+i*.025});}
 Object.assign(s.player,{x:3.5,z:11,yaw:.07,pitch:0});s.command='SPLIT';
}
