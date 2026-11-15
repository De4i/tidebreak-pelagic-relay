import { MAP, move, visible, walkable, route, wallDistance, boxHit } from './map.js';
export const WEAPONS = [
 {name:'KITE / 9',cost:0,damage:27,head:3.4,mag:12,reserve:60,interval:.22,reload:1.3,spread:.006,recoil:.018,auto:false},
 {name:'TERN / 45',cost:1250,damage:23,head:3.1,mag:28,reserve:112,interval:.085,reload:1.8,spread:.011,recoil:.014,auto:true},
 {name:'OSPREY / 556',cost:2700,damage:34,head:3.8,mag:24,reserve:96,interval:.115,reload:2.1,spread:.003,recoil:.025,auto:true},
 {name:'HERON / 762',cost:4200,damage:84,head:2.5,mag:6,reserve:30,interval:.9,reload:2.8,spread:.001,recoil:.07,auto:false}
];
export function createGame(seed=4821) {
 const s={seed,tick:0,time:0,phase:'briefing',phaseTime:0,round:0,score:[0,0],money:3500,losses:0,actors:[],player:null,events:[],tracers:[],smokes:[],grenades:[],core:null,interact:0,notice:'',noticeTime:0,kills:0,deaths:0,lastWinner:null,aim:0,shotPulse:0,hitPulse:0,damagePulse:0,flash:0,inventory:{smoke:1,flash:1},command:'FOLLOW',team:0,site:0};
 s.random=()=>{s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;};
 return s;
}
function actor(id,team,x,z,weapon) {const w=WEAPONS[weapon];return {id,name:id===0?'YOU':(team===0?'GULL ':'REEF ')+id,team,x,z,yaw:0,hp:100,armor:50,vx:0,vz:0,crouch:false,height:1.65,weapon,ammo:w.mag,reserve:w.reserve,reload:0,cooldown:0,recoil:0,shots:0,path:[],pathTime:0,goal:null,alert:0,heard:null,reaction:.5,objective:0,flash:0,kills:0,deaths:0};}
export function startRound(s) {
 s.round++;if(s.round===7)s.team=1-s.team;
 s.phase='buy';s.phaseTime=13;s.core=null;s.interact=0;s.grenades.length=0;s.smokes.length=0;s.tracers.length=0;s.lastWinner=null;s.flash=0;
 const old=s.player, weapon=old&&old.hp>0?old.weapon:0;
 s.actors.length=0;
 for(let t=0;t<2;t++)for(let i=0;i<4;i++){const id=t===s.team&&i===0?0:1+t*4+i;const z=t===0?23:-24;const x=(i-1.5)*3;const a=actor(id,t,x,z,id===0?weapon:2);a.yaw=t===0?0:Math.PI;s.actors.push(a);if(id===0)s.player=a;}
 s.inventory={smoke:1,flash:1};s.notice='ROUND '+s.round+' · '+(s.team===0?'RAIDERS: PLANT THE CORE':'WARDENS: HOLD THE RELAY');s.noticeTime=5;
}
export function buy(s,i) {if(s.phase!=='buy'||!s.player||s.player.hp<=0)return false;const w=WEAPONS[i];if(!w||s.money<w.cost)return false;s.money-=w.cost;Object.assign(s.player,{weapon:i,ammo:w.mag,reserve:w.reserve,reload:0});return true;}
export function buyArmor(s){if(s.phase==='buy'&&s.money>=650){s.money-=650;s.player.armor=100;return true;}return false;}
export function reload(a){if(!a.reload&&a.ammo<WEAPONS[a.weapon].mag&&a.reserve>0)a.reload=WEAPONS[a.weapon].reload;}
export function noise(s,a){for(const b of s.actors)if(b.id!==a.id&&b.hp>0&&Math.hypot(b.x-a.x,b.z-a.z)<24){b.heard={x:a.x,z:a.z};b.alert=4;}}
export function endRound(s,team,reason){if(s.phase==='end'||s.phase==='match')return;s.lastWinner=team;s.score[team]++;s.phase='end';s.phaseTime=5;s.notice=(team===s.team?'ROUND SECURED':'ROUND LOST')+' · '+reason;s.noticeTime=5;const win=team===s.team;s.losses=win?0:s.losses+1;s.money=Math.min(16000,s.money+(win?3250:Math.min(3100,1400+s.losses*450)));if(s.score[team]>=7){s.phase='match';s.notice=(team===s.team?'OPERATION COMPLETE':'OPERATION FAILED')+' · FIRST TO SEVEN';}}
function damage(s,target,amount,shooter,head){const absorb=Math.min(target.armor,amount*.28);target.armor-=absorb;target.hp=Math.max(0,target.hp-amount+absorb);if(target.id===0)s.damagePulse=1;if(shooter.id===0)s.hitPulse=.18;if(target.hp===0){target.deaths++;shooter.kills++;if(target.id===0)s.deaths++;if(shooter.id===0){s.kills++;s.money=Math.min(16000,s.money+300);}s.events.unshift({text:shooter.name+'  '+(head?'⌖':'→')+'  '+target.name,team:shooter.team,life:5});s.events.length=Math.min(s.events.length,5);}}
export function fire(s,a,yaw,pitch=0,aim=false){
 const w=WEAPONS[a.weapon];if(s.phase!=='live'||a.hp<=0||a.reload||a.cooldown>0)return false;if(a.ammo===0){reload(a);return false;}
 a.ammo--;a.cooldown=w.interval;a.shots++;noise(s,a);if(a.id===0)s.shotPulse=1;
 const velocity=Math.hypot(a.vx,a.vz),spread=w.spread*(a.crouch?.5:1)*(aim?.5:1)+velocity*.006+a.recoil*.12;
 yaw+=(s.random()-.5)*spread*2;pitch+=(s.random()-.5)*spread*2+a.recoil;
 const dx=-Math.sin(yaw)*Math.cos(pitch),dy=Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch),oy=a.height;
 let near=wallDistance(a.x,oy,a.z,dx,dy,dz,85),target=null,head=false;
 for(const b of s.actors){if(b===a||b.hp<=0||b.team===a.team)continue;const body=boxHit(a.x,oy,a.z,dx,dy,dz,b.x,b.crouch?.62:.88,b.z,.65,b.crouch?.95:1.3,.52,near);const h=boxHit(a.x,oy,a.z,dx,dy,dz,b.x,b.height-.08,b.z,.38,.38,.38,near);if(Math.min(body,h)<near){near=Math.min(body,h);target=b;head=h<=body;}}
 if(target)damage(s,target,w.damage*(head?w.head:1),a,head);
 s.tracers.push({x:a.x,y:oy,z:a.z,ex:a.x+dx*near,ey:oy+dy*near,ez:a.z+dz*near,life:.065,team:a.team});a.recoil=Math.min(.18,a.recoil+w.recoil);return true;
}
export function throwGrenade(s,type,yaw,pitch){if(s.phase!=='live'||s.player.hp<=0||s.inventory[type]<=0)return false;s.inventory[type]--;const p=s.player;s.grenades.push({type,x:p.x,y:p.height,z:p.z,vx:-Math.sin(yaw)*12,vy:4+Math.sin(pitch)*8,vz:-Math.cos(yaw)*12,life:1.4,team:p.team});noise(s,p);return true;}
function objective(s,a,dt,using){
 if(a.hp<=0)return;const site=MAP.sites.find(p=>Math.hypot(p.x-a.x,p.z-a.z)<3.4);
 if(a.team===0&&!s.core&&site&&using){a.objective+=dt;if(a.id===0)s.interact=a.objective/3;if(a.objective>=3){s.core={x:site.x,z:site.z,name:site.name,time:35};s.notice='CORE ARMED AT '+site.name+' · WARDENS HAVE 35s';s.noticeTime=5;a.objective=0;if(a.id===0)s.money+=300;}}
 else if(a.team===1&&s.core&&Math.hypot(a.x-s.core.x,a.z-s.core.z)<3.1&&using){a.objective+=dt;if(a.id===0)s.interact=a.objective/5;if(a.objective>=5)endRound(s,1,'CORE DISARMED');}
 else{a.objective=0;if(a.id===0)s.interact=0;}
}
function bots(s,dt){for(const a of s.actors){if(a.id===0||a.hp<=0)continue;a.pathTime-=dt;a.alert=Math.max(0,a.alert-dt);a.flash=Math.max(0,a.flash-dt);
 let target=null,dist=Infinity;
 for(const b of s.actors){if(b.team===a.team||b.hp<=0)continue;const d=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(-(b.x-a.x),-(b.z-a.z)),delta=Math.atan2(Math.sin(angle-a.yaw),Math.cos(angle-a.yaw));if(d<dist&&d<38&&(Math.abs(delta)<1.45||a.alert>0||d<7)&&visible(a,b,s.smokes)){target=b;dist=d;}}
 let goal;
 if(target&&a.flash<=0){const desired=Math.atan2(-(target.x-a.x),-(target.z-a.z));a.yaw+=Math.atan2(Math.sin(desired-a.yaw),Math.cos(desired-a.yaw))*Math.min(1,dt*8);a.reaction-=dt;a.alert=4;a.heard={x:target.x,z:target.z};goal=dist>14?target:{x:a.x,z:a.z};if(a.reaction<=0){const aimYaw=a.yaw+(s.random()-.5)*(.04+dist*.0018);fire(s,a,aimYaw,(s.random()-.5)*.027);a.reaction=.12+s.random()*.15;}if(a.ammo<3)reload(a);
 }else{a.reaction=.28+s.random()*.25;goal=s.core?(a.team===1?s.core:{x:s.core.x+(a.id%2?5:-5),z:s.core.z+6}):a.alert>0&&a.heard?a.heard:a.team===0?MAP.sites[a.id%2]:{x:MAP.sites[a.id%2].x,z:MAP.sites[a.id%2].z+5};if(a.team===s.team&&s.command==='FOLLOW'&&s.player.hp>0&&!s.core&&s.team===0)goal={x:s.player.x+(a.id%2?2:-2),z:s.player.z+3};if(a.team===s.team&&s.command==='HOLD')goal={x:a.x,z:a.z};}
 const inObjectiveRange=a.team===1&&s.core&&Math.hypot(a.x-s.core.x,a.z-s.core.z)<3.1||a.team===0&&!s.core&&MAP.sites.some(site=>Math.hypot(a.x-site.x,a.z-site.z)<3.4);
 if(inObjectiveRange&&(!target||dist>18)){a.vx=0;a.vz=0;}
 else if(!target||dist>14){if(a.path.length===0||(a.pathTime<=0&&s.core)){a.path=route(a,goal);a.pathTime=3+s.random();}if(walkable(a,goal))a.path=[goal];let wp=a.path[0];if(wp){const dx=wp.x-a.x,dz=wp.z-a.z,d=Math.hypot(dx,dz);if(d<.7)a.path.shift();else {const speed=a.flash>0?1:2.7;a.vx=dx/d*speed;a.vz=dz/d*speed;move(a,a.vx*dt,a.vz*dt);if(!target)a.yaw=Math.atan2(-dx,-dz);}}}else {a.vx=0;a.vz=0;}
 objective(s,a,dt,(!target||dist>18));
 // Bots use real grenades on a schedule when a contact is heard, then return to their route.
 if(a.alert>0&&a.heard&&a.shots>4&&a.id%3===0&&!a.usedGrenade){a.usedGrenade=true;s.grenades.push({type:a.team===0?'smoke':'flash',x:a.x,y:1.5,z:a.z,vx:(a.heard.x-a.x)*.5,vy:4,vz:(a.heard.z-a.z)*.5,life:1.4,team:a.team});}
 }}
export function step(s,dt,input){
 s.time+=dt;s.tick++;s.noticeTime=Math.max(0,s.noticeTime-dt);s.shotPulse=Math.max(0,s.shotPulse-dt*9);s.hitPulse=Math.max(0,s.hitPulse-dt);s.damagePulse=Math.max(0,s.damagePulse-dt*2);s.flash=Math.max(0,s.flash-dt);
 for(const e of s.events)e.life-=dt;for(let i=s.tracers.length-1;i>=0;i--)if((s.tracers[i].life-=dt)<=0)s.tracers.splice(i,1);
 if(s.phase==='briefing'||s.phase==='match')return;
 s.phaseTime-=dt;if(s.phase==='buy'&&s.phaseTime<=0){s.phase='live';s.phaseTime=100;}if(s.phase==='end'){if(s.phaseTime<=0)startRound(s);return;}
 const p=s.player;
 for(const a of s.actors){a.cooldown=Math.max(0,a.cooldown-dt);a.recoil=Math.max(0,a.recoil-dt*.08);if(a.reload>0){a.reload-=dt;if(a.reload<=0){const n=Math.min(WEAPONS[a.weapon].mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;}}}
 if(p.hp>0){p.yaw=input.yaw;p.crouch=!!input.crouch;p.height+=(p.crouch?1.06-p.height:1.65-p.height)*Math.min(1,dt*12);s.aim+=(input.aim?1-s.aim:-s.aim)*Math.min(1,dt*12);
 const speed=p.crouch?2.1:input.walk?2.8:5.2;let mx=input.right||0,mz=input.forward||0,len=Math.hypot(mx,mz)||1;mx/=len;mz/=len;const tx=(Math.cos(p.yaw)*mx-Math.sin(p.yaw)*mz)*speed,tz=(-Math.sin(p.yaw)*mx-Math.cos(p.yaw)*mz)*speed;p.vx+=(tx-p.vx)*Math.min(1,dt*13);p.vz+=(tz-p.vz)*Math.min(1,dt*13);move(p,p.vx*dt,p.vz*dt);
 if(s.phase==='live'){if(input.fire)fire(s,p,input.yaw,input.pitch,input.aim);objective(s,p,dt,input.use);}
 }
 if(s.phase!=='live')return;
 bots(s,dt);
 for(let i=s.grenades.length-1;i>=0;i--){const g=s.grenades[i];g.vy-=dt*9.8;const prev={x:g.x,z:g.z};g.x+=g.vx*dt;g.z+=g.vz*dt;g.y+=g.vy*dt;if(wallDistance(prev.x,Math.max(.2,g.y),prev.z,g.vx,0,g.vz,dt)<dt){g.x=prev.x;g.z=prev.z;g.vx*=-.5;g.vz*=-.5;}if(g.y<.2){g.y=.2;g.vy=Math.abs(g.vy)*.3;g.vx*=.96;g.vz*=.96;}g.life-=dt;if(g.life<=0){if(g.type==='smoke')s.smokes.push({x:g.x,z:g.z,radius:4.5,life:14});else for(const a of s.actors)if(a.hp>0&&Math.hypot(a.x-g.x,a.z-g.z)<17&&visible(a,g)){a.flash=2.8;if(a.id===0)s.flash=2.8;}s.grenades.splice(i,1);}}
 for(let i=s.smokes.length-1;i>=0;i--)if((s.smokes[i].life-=dt)<=0)s.smokes.splice(i,1);
 if(s.core){s.core.time-=dt;if(s.core.time<=0)endRound(s,0,'CORE DISCHARGED');}else if(s.phaseTime<=0)endRound(s,1,'TIME EXPIRED');
 const raiders=s.actors.some(a=>a.team===0&&a.hp>0),wardens=s.actors.some(a=>a.team===1&&a.hp>0);if(!wardens)endRound(s,0,'WARDENS ELIMINATED');else if(!raiders&&!s.core)endRound(s,1,'RAIDERS ELIMINATED');
}
