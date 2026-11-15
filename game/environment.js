import * as THREE from 'three';
import { MAP } from './map.js';
// Original procedural surface textures: concrete aggregate, pavement, planked crates.
function surface(base,kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);let seed=7193;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<12000;i++){const gray=Math.floor(random()*80)+90;ctx.fillStyle=`rgba(${gray},${gray},${gray},${random()*.18})`;ctx.fillRect(random()*256,random()*256,1+random()*3,1+random()*2);}if(kind==='concrete'){ctx.strokeStyle='#746f6325';for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(i*64,0);ctx.lineTo(i*64,256);ctx.stroke();}ctx.fillStyle='#ffffff16';ctx.fillRect(0,0,256,2);}if(kind==='wood'){for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#00000030':'#ffffff15';ctx.fillRect(0,i*32,256,2);}ctx.strokeStyle='#694a2f50';for(let i=0;i<25;i++){ctx.beginPath();ctx.moveTo(0,random()*256);ctx.lineTo(256,random()*256);ctx.stroke();}}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
export function buildEnvironment(view){const scene=view.scene;
 const concreteTex=surface('#bfb7a5','concrete'),roadTex=surface('#7e888a','road'),woodTex=surface('#aa8359','wood');roadTex.repeat.set(22,22);concreteTex.repeat.set(2,2);
 const concrete=new THREE.MeshStandardMaterial({map:concreteTex,roughness:.94}),road=new THREE.MeshStandardMaterial({map:roadTex,roughness:.96}),wood=new THREE.MeshStandardMaterial({map:woodTex,roughness:.86});
 const painted=new THREE.MeshStandardMaterial({color:0xc7d4cf,roughness:.75}),blue=new THREE.MeshStandardMaterial({color:0x3c6778,roughness:.7}),rust=new THREE.MeshStandardMaterial({color:0xad6745,roughness:.85}),dark=new THREE.MeshStandardMaterial({color:0x344247,roughness:.65}),yellow=new THREE.MeshStandardMaterial({color:0xe6b23e,roughness:.65}),steel=new THREE.MeshStandardMaterial({color:0x87979c,roughness:.45,metalness:.55});
 function box(w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);return o;}
 function cylinder(r,h,x,y,z,m){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);return o;}
 scene.background=new THREE.Color(0xaed5e9);scene.fog=new THREE.Fog(0xc4dce3,48,170);
 scene.add(new THREE.HemisphereLight(0xe4f4ff,0x8e927b,2.25));scene.add(new THREE.AmbientLight(0xffffff,.45));
 const sun=new THREE.DirectionalLight(0xffefd6,3.0);sun.position.set(-25,45,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.near=.5;sun.shadow.camera.far=130;sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;scene.add(sun);view.renderer.toneMappingExposure=1.05;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(58,58),road);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // Geometry exactly matches the simulation's walls; dressing stays on those footprints.
 for(let i=0;i<MAP.walls.length;i++){const [x,z,w,d,h]=MAP.walls[i];if(i<4){box(w,h,d,x,h/2,z,concrete);box(w+.05,.2,d+.05,x,h,z,painted);for(let t=-Math.max(w,d)/2+2;t<Math.max(w,d)/2;t+=6){const xx=w>d?x+t:x,zz=d>w?z+t:z;box(w>d?.3:w+.06,h,.3+(w>d?d:0),xx,h/2,zz,painted);}}else if(h>3){const material=i%2?blue:rust;box(w,h,d,x,h/2,z,material);box(w+.12,.12,d+.12,x,h,z,steel);const longX=w>d;for(let t=-Math.max(w,d)/2+.3;t<Math.max(w,d)/2;t+=.48){box(longX?.055:w+.04,h-.2,longX?d+.04:.055,longX?x+t:x,h/2,longX?z:z+t,material);}box(w+.04,.18,d+.04,x,.25,z,dark);view.sign(i%2?'RELAY LOGISTICS':'PELAGIC / FREIGHT',x,h*.68,z+d/2+.035,'#f5ead1',Math.min(3.3,w*.8));}else {box(w,h,d,x,h/2,z,concrete);box(w+.02,.13,d+.02,x,h-.14,z,yellow);for(let t=-w/2+.25;t<w/2;t+=.6){const stripe=box(.24,.15,.015,x+t,h-.14,z+d/2+.02,dark);stripe.rotation.z=-.4;}}}
 // Paint, drainage grates and cable runs are flush so they do not create invisible collisions.
 for(let z=-24;z<27;z+=4)for(const x of [-24,24])box(.12,.008,2.1,x,.013,z,yellow);
 for(let z=-20;z<25;z+=10){box(1.6,.02,.45,0,.02,z,dark);for(let x=-.7;x<.8;x+=.13)box(.025,.025,.43,x,.03,z,steel);}
 for(const x of [-26,26]){box(.3,.1,50,x,.06,0,concrete);for(let z=-23;z<27;z+=8){cylinder(.07,5.8,x,2.9,z,steel);box(1.4,.13,.5,x,5.8,z,painted);}}
 for(const site of MAP.sites){const color=site.name==='A'?yellow:blue;for(const dx of [-3.4,3.4])box(.12,.012,6.8,site.x+dx,.025,site.z,color);for(const dz of [-3.4,3.4])box(6.8,.012,.12,site.x,.025,site.z+dz,color);view.sign(site.name+' / '+site.label,site.x,3.8,site.z-4,'#ffe0a0',5);const term=box(.65,1.1,.4,site.x,0.55,site.z,steel);box(.45,.32,.02,site.x,.8,site.z+.22,new THREE.MeshBasicMaterial({color:0x32a68b}));}
 // Dense skyline outside the combat boundaries: warehouse, gantry, tanks, dock and ocean.
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:0x4795b2,roughness:.32,metalness:.25}));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-1.4,0);scene.add(ocean);
 box(82,1,76,0,-.7,0,concrete);
 for(const x of [-39,39]){box(16,10,50,x,4.5,-3,concrete);box(17,.3,52,x,9.7,-3,blue);for(let z=-22;z<23;z+=7){box(.05,2.4,3,x>0?x-8.03:x+8.03,5.9,z,blue);box(.06,.12,3.1,x>0?x-8.07:x+8.07,5.9,z,steel);}for(let z=-20;z<22;z+=10){box(1.1,1.8,2,x>0?x-8.5:x+8.5,7.7,z,painted);for(let j=0;j<5;j++)box(.04,.04,1.8,x>0?x-9.07:x+9.07,7.1+j*.22,z,dark);}}
 for(const x of [-20,20]){cylinder(3.4,11,x,5,-39,painted);cylinder(3.48,.3,x,1,-39,blue);cylinder(3.48,.3,x,8,-39,blue);cylinder(.32,3,x,12,-39,steel);box(.5,10,.35,x+3.6,5,-39,steel);}
 for(const x of [-23,23]){box(.8,22,.8,x,11,-35,yellow);box(2,.7,2,x,21.5,-35,steel);}box(48,.9,.9,0,22,-35,yellow);box(.3,.3,18,0,22,-26,steel);box(.4,8,.4,0,17,-17,steel);cylinder(.5,.65,0,12.7,-17,dark);
 box(10,2.4,18,2,0,-58,blue);box(5,3,5,2,2.5,-55,painted);cylinder(.1,10,2,7,-55,steel);
 for(const [x,z]of [[-20,5],[20,5],[-7,10],[7,10]]){for(let k=0;k<2;k++){const dx=x<0?-.2:.2;const base=Math.abs(x)===20?3.7:4.6;box(1,1,1,x+dx,base+.5+k,z,wood);box(1.04,.07,1.04,x+dx,base+.15+k,z,dark);box(1.04,.07,1.04,x+dx,base+.85+k,z,dark);}}
 // Exterior railing, mooring bollards and warning boards.
 for(let x=-30;x<=30;x+=3){cylinder(.08,1.3,x,.4,35,steel);if(x%6===0)cylinder(.3,.5,x,-.1,34,yellow);}box(60,.08,.08,0,1.04,35,steel);
 view.sign('PELAGIC RELAY  /  NORTH DOCK',0,8,-27,'#f0d5a3',12);
 view.sign('AUTHORIZED PERSONNEL ONLY',-20,3.4,27,'#f0d5a3',6);
 // Batch static geometry by material: texture detail should not require thousands of draws.
 const batches=new Map();scene.updateMatrixWorld(true);
 for(const child of [...scene.children]){if(!child.isMesh||Array.isArray(child.material))continue;let list=batches.get(child.material);if(!list)batches.set(child.material,list=[]);const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrixWorld);list.push(g);scene.remove(child);child.geometry.dispose();}
 for(const [material,geometries]of batches){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=geometries.map(g=>g.getAttribute(name));if(arrays.some(a=>!a))continue;const data=new Float32Array(arrays.reduce((n,a)=>n+a.array.length,0));let offset=0;for(const a of arrays){data.set(a.array,offset);offset+=a.array.length;}merged.setAttribute(name,new THREE.BufferAttribute(data,arrays[0].itemSize));}const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);for(const g of geometries)g.dispose();}
 view.buildWeapon();
}
