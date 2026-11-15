import assert from 'node:assert/strict';
import { createGame,startRound,step,buy,fire,reload,throwGrenade,endRound } from './game/simulation.js';
import { blocked,move,route,visible,MAP } from './game/map.js';
const idle={yaw:0,pitch:0};
const fresh=()=>{let s=createGame();startRound(s);s.phase='live';return s;};
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('buy phase and economy',()=>{const s=createGame();startRound(s);assert(buy(s,2));assert.equal(s.money,800);assert(!buy(s,3));assert.equal(s.player.ammo,24);});
test('collision blocks walls, movement slides',()=>{const a={x:0,z:4};move(a,0,-3);assert.equal(a.z,4);move(a,1,0);assert.equal(a.x,1);assert(blocked(0,0));});
test('ammo depleted then finite reserve reload',()=>{const s=fresh(),p=s.player;for(let i=0;i<12;i++){p.cooldown=0;assert(fire(s,p,0));}assert.equal(p.ammo,0);p.cooldown=0;fire(s,p,0);assert(p.reload>0);for(let i=0;i<100;i++)step(s,1/60,idle);assert.equal(p.ammo,12);assert.equal(p.reserve,48);});
test('head damage and wall occlusion',()=>{const s=fresh(),p=s.player,e=s.actors.find(a=>a.team!==p.team);for(const a of s.actors)if(a!==p&&a!==e)a.hp=0;p.x=-24;p.z=20;e.x=-24;e.z=15;e.hp=100;e.armor=0;p.weapon=2;fire(s,p,0,0,true);assert.equal(e.hp,0);e.hp=100;p.x=7;p.z=23;e.x=7;e.z=-10;p.cooldown=0;p.recoil=0;fire(s,p,0,0,true);assert.equal(e.hp,100);});
test('objective plant then five-second defender disarm',()=>{const s=fresh(),p=s.player;for(const a of s.actors)if(a!==p){a.x=24;a.z=23;a.pathTime=999;}p.x=MAP.sites[0].x;p.z=MAP.sites[0].z;for(let i=0;i<181;i++)step(s,1/60,{...idle,use:true});assert(s.core);const d=s.actors.find(a=>a.team===1);for(const a of s.actors)if(a!==p&&a!==d)a.hp=0;p.x=24;p.z=23;d.hp=100;d.armor=50;d.x=s.core.x;d.z=s.core.z;d.pathTime=999;for(let i=0;i<310;i++)step(s,1/60,idle);assert.equal(s.lastWinner,1);});
test('grenades use inventory and smoke blocks sight',()=>{const s=fresh();assert(throwGrenade(s,'smoke',0,0));assert(!throwGrenade(s,'smoke',0,0));for(let i=0;i<90;i++)step(s,1/60,idle);assert(s.smokes.length);const m=s.smokes[0];assert(!visible({x:m.x-6,z:m.z},{x:m.x+6,z:m.z},s.smokes));});
test('round win money and automatic restart',()=>{const s=fresh();endRound(s,0,'TEST');assert.equal(s.score[0],1);assert.equal(s.money,6750);for(let i=0;i<310;i++)step(s,1/60,idle);assert.equal(s.round,2);assert.equal(s.phase,'buy');});
test('bot routes are connected and bots advance',()=>{const s=fresh();s.command='SPLIT';const bots=s.actors.filter(a=>a.id!==0);const before=bots.map(a=>[a.x,a.z]);for(let i=0;i<600;i++)step(s,1/60,idle);assert(bots.some((a,i)=>Math.hypot(a.x-before[i][0],a.z-before[i][1])>5));assert(route({x:0,z:23},MAP.sites[0]).length>2);});
test('fixed-step simulation reproduces exactly',()=>{function run(){const s=fresh();for(let i=0;i<600;i++)step(s,1/60,idle);return JSON.stringify(s,(k,v)=>typeof v==='function'?undefined:v);}assert.equal(run(),run());});
console.log(`${passed} gameplay checks passed`);
