// Node 22 entrypoint. Only standard-library IO and the kit's unchanged dossier library.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';
const root=fileURLToPath(new URL('.',import.meta.url));
const output=process.env.MAKEFUN_OUTPUT_DIR??'/output';
mkdirSync(output,{recursive:true});
cpSync(join(root,'game'),join(output,'game'),{recursive:true});
cpSync(join(root,'screenshots'),join(output,'screenshots'),{recursive:true});
const dossier=buildDossier(output,{text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648});
writeFileSync(join(output,'dossier.json'),dossier);
console.log('TIDEBREAK dossier ready: '+Buffer.byteLength(dossier)+' bytes');
