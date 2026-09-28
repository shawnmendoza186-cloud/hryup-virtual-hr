const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'db.json');
const sessions = new Map();

function readDB() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch { return { users: [], requests: [] }; }
}
function writeDB(db) { fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}
function verify(password, stored) {
  const [salt, key] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}
function json(res, code, body) {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw=''; req.on('data', c => { raw += c; if(raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}
function userFrom(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i,'');
  const uid = token && sessions.get(token);
  if (!uid) return null;
  return readDB().users.find(u => u.id === uid) || null;
}
function cleanUser(u) { return { id:u.id, name:u.name, email:u.email, business:u.business, role:u.role }; }
function id(prefix='id') { return prefix + '_' + crypto.randomBytes(7).toString('hex'); }
function sendFile(res, file) {
  const ext = path.extname(file); const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
  fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404);return res.end('Not found');} res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data); });
}

if (!fs.existsSync(DATA)) writeDB({users:[], requests:[]});
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  try {
    if (req.method === 'GET' && pathname === '/api/health') return json(res,200,{ok:true,service:'HRyUp API'});
    if (req.method === 'POST' && pathname === '/api/register') {
      const b = await parseBody(req); if(!b.name||!b.email||!b.password||!b.business) return json(res,400,{error:'Name, email, password, and business are required.'});
      const db=readDB(); const email=b.email.trim().toLowerCase(); if(db.users.some(u=>u.email===email)) return json(res,409,{error:'An account with that email already exists.'});
      const u={id:id('usr'),name:b.name.trim(),email,business:b.business.trim(),role:'client',passwordHash:hash(b.password),createdAt:new Date().toISOString()}; db.users.push(u); writeDB(db);
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,u.id); return json(res,201,{user:cleanUser(u),token});
    }
    if (req.method === 'POST' && pathname === '/api/login') {
      const b=await parseBody(req); const db=readDB(); const u=db.users.find(x=>x.email===String(b.email||'').trim().toLowerCase());
      if(!u || !verify(String(b.password||''),u.passwordHash)) return json(res,401,{error:'Invalid email or password.'});
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,u.id); return json(res,200,{user:cleanUser(u),token});
    }
    if (req.method === 'POST' && pathname === '/api/logout') { const t=req.headers.authorization?.replace(/^Bearer\s+/i,''); if(t)sessions.delete(t); return json(res,200,{ok:true}); }
    if (req.method === 'GET' && pathname === '/api/me') { const u=userFrom(req); if(!u)return json(res,401,{error:'Unauthorized'}); return json(res,200,{user:cleanUser(u)}); }
    if (req.method === 'GET' && pathname === '/api/requests') {
      const u=userFrom(req); if(!u)return json(res,401,{error:'Unauthorized'}); const db=readDB(); return json(res,200,{requests:db.requests.filter(r=>r.userId===u.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
    }
    if (req.method === 'POST' && pathname === '/api/requests') {
      const u=userFrom(req); if(!u)return json(res,401,{error:'Unauthorized'}); const b=await parseBody(req);
      if(!b.service||!b.subject||!b.details)return json(res,400,{error:'Service, subject, and details are required.'});
      const db=readDB(); const r={id:id('req'),userId:u.id,service:b.service,subject:b.subject.trim(),details:b.details.trim(),priority:b.priority||'Normal',status:'Received',createdAt:new Date().toISOString()}; db.requests.push(r); writeDB(db); return json(res,201,{request:r});
    }
    if (req.method === 'GET' && pathname === '/api/stats') { const u=userFrom(req); if(!u)return json(res,401,{error:'Unauthorized'}); const db=readDB(); const mine=db.requests.filter(r=>r.userId===u.id); return json(res,200,{total:mine.length,received:mine.filter(r=>r.status==='Received').length,inProgress:mine.filter(r=>r.status==='In Progress').length,completed:mine.filter(r=>r.status==='Completed').length}); }
    if (req.method === 'GET') {
      let file = pathname === '/' ? path.join(ROOT,'public','index.html') : path.join(ROOT,'public',pathname.replace(/^\//,''));
      if(!file.startsWith(path.join(ROOT,'public'))) return res.writeHead(403).end(); sendFile(res,file); return;
    }
    json(res,404,{error:'Route not found'});
  } catch(e) { console.error(e); json(res,500,{error:'Server error'}); }
});
server.listen(PORT,()=>console.log(`HRyUp running at http://localhost:${PORT}`));
