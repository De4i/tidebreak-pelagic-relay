import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(new URL('./game/',import.meta.url).pathname);
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const file=path===root?resolve(root,'index.html'):path;res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}}).listen(8092,'0.0.0.0',()=>console.log('TIDEBREAK http://localhost:8092'));
