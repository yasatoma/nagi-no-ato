import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const port=Number(process.env.PORT||4173);
http.createServer((req,res)=>{
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const rel=url==='/'?'index.html':url.slice(1);
 const file=path.resolve(root,rel);
 const normalized=path.relative(root,file).split(path.sep).join('/');
 const allowed=normalized==='index.html'||normalized.startsWith('src/')||normalized.startsWith('assets/');
 if(!allowed||!file.startsWith(root+path.sep)){res.writeHead(404).end('Not found');return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});
}).listen(port,'0.0.0.0',()=>console.log(`凪のあとに、声が残る — http://localhost:${port}`));
