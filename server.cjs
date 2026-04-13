const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://fordwarnes:q8JDvqAazcuGSOz1@fordwarnes.k9lihgv.mongodb.net/fordwarnes?retryWrites=true&w=majority';

// ─── DATA DIRECTORY (fallback for uploads only) ─────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── MONGODB CONNECTION ─────────────────────────────────────────────────────
let db;
const mongoClient = new MongoClient(MONGO_URI, {
  tls: true,
  // Tolerate Atlas TLS hiccups (the SSL alert 80 error)
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
});

async function connectDB() {
  // Retry connection up to 3 times with backoff (Atlas sometimes rejects
  // the first TLS handshake on cold starts or IP changes)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoClient.connect();
      break; // success
    } catch (e) {
      console.error(`[MongoDB] connection attempt ${attempt}/3 failed:`, e.message);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  try {
    db = mongoClient.db('fordwarnes');
    console.log('MongoDB connected!');
    // Bug #9 fix: reconcile MongoDB vs local JSON fallback on boot.
    // If MongoDB was down when someone edited data, the JSON file has newer
    // data than MongoDB. Use whichever is newer and push the winner upstream.
    const reconciled = {};
    async function loadWithReconcile(key, current) {
      const doc = await db.collection('config').findOne({ _id: key });
      const mongoData = doc?.data;
      const mongoTs = doc?.updatedAt || 0;
      const jsonPath = path.join(dataDir, key + '.json');
      let jsonData = null, jsonTs = 0;
      if (fs.existsSync(jsonPath)) {
        try {
          jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          jsonTs = fs.statSync(jsonPath).mtimeMs;
        } catch {}
      }
      if (jsonTs > mongoTs + 1000 && jsonData != null) {
        console.log(`[reconcile] JSON newer than Mongo for "${key}" (${new Date(jsonTs).toISOString()} > ${new Date(mongoTs).toISOString()}), pushing JSON -> Mongo`);
        reconciled[key] = jsonData;
        // Push back to Mongo so both sides are aligned
        try {
          await db.collection('config').updateOne(
            { _id: key },
            { $set: { data: jsonData, updatedAt: jsonTs, reconciledAt: Date.now() } },
            { upsert: true }
          );
        } catch (e) { console.error(`[reconcile] push failed for ${key}:`, e); }
        return jsonData;
      }
      if (mongoData != null) return mongoData;
      return jsonData != null ? jsonData : current;
    }
    accounts = await loadWithReconcile('accounts', accounts);
    stockData = await loadWithReconcile('stock', stockData);
    salesHistory = await loadWithReconcile('salesHistory', salesHistory);
    clientNotes = await loadWithReconcile('clientNotes', clientNotes);
    searchAnalytics = await loadWithReconcile('searchAnalytics', searchAnalytics);
    pedidos = await loadWithReconcile('pedidos', pedidos);
    const loadedChats = await loadWithReconcile('chats', null);
    if (loadedChats && typeof loadedChats === 'object') chatRooms = loadedChats;
    clientAccounts = await loadWithReconcile('clientAccounts', clientAccounts);
    carts = await loadWithReconcile('carts', {}) || {};
    supplierStockMem = await loadWithReconcile('supplierStock', {}) || {};
    console.log('Data loaded from MongoDB', Object.keys(reconciled).length ? `(reconciled ${Object.keys(reconciled).join(',')})` : '');
  } catch (e) {
    console.error('MongoDB connection failed, using local files:', e.message);
    // Fallback to JSON files
    accounts = loadJSON('accounts.json', accounts);
    stockData = loadJSON('stock.json', stockData);
    salesHistory = loadJSON('salesHistory.json', salesHistory);
    clientNotes = loadJSON('clientNotes.json', clientNotes);
    searchAnalytics = loadJSON('searchAnalytics.json', searchAnalytics);
  }
}

// Save to MongoDB (with JSON fallback) - ALWAYS saves with timestamp
// Bug #18 fix: exponential backoff retry on MongoDB failures.
// Bug #15 fix: track failure count + log prominently.
let _mongoFailStreak = 0;
async function saveToDB(key, data) {
  const now = Date.now();
  let lastErr = null;
  if (db) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.collection('config').updateOne(
          { _id: key },
          { $set: { data, updatedAt: now } },
          { upsert: true }
        );
        if (_mongoFailStreak > 0) console.log(`[MongoDB] recovered after ${_mongoFailStreak} failures`);
        _mongoFailStreak = 0;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
    if (lastErr) {
      _mongoFailStreak++;
      console.error(`[MongoDB SAVE ERROR #${_mongoFailStreak}]`, key, lastErr.message);
      if (_mongoFailStreak === 1 || _mongoFailStreak % 5 === 0) {
        console.error(`[ALERT] MongoDB saves failing (streak=${_mongoFailStreak}). Data may be at risk. Latest key: ${key}`);
      }
    }
  }
  // Also save locally as backup so the JSON reconcile on next boot can recover
  try { saveJSON(key + '.json', data); } catch {}
}

// Force save ALL data to MongoDB (called periodically + on shutdown)
async function saveAllData() {
  console.log('[AutoSave] Saving all data to MongoDB...');
  await saveToDB('accounts', accounts);
  await saveToDB('pedidos', pedidos);
  await saveToDB('clientAccounts', clientAccounts);
  await saveToDB('salesHistory', salesHistory);
  await saveToDB('clientNotes', clientNotes);
  await saveToDB('searchAnalytics', searchAnalytics);
  await saveToDB('chats', chatRooms);
  await saveToDB('carts', carts);
  await saveToDB('supplierStock', supplierStockMem);
  await saveToDB('stock', stockData);
  await saveToDB('sessions', sessions);
  console.log('[AutoSave] Complete');
}

function loadJSON(name, fallback) {
  const f = path.join(dataDir, name);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
}
function saveJSON(name, data) {
  try { fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2), 'utf8'); } catch {}
}

// ─── IN-MEMORY DATA (loaded from MongoDB on startup) ────────────────────────
let stockData = { modelos: [], partes: [] };
let chatRooms = {};
let salesLog = [];
let salesHistory = [];
let clientNotes = {};
let searchAnalytics = {};

async function saveStock() { await saveToDB('stock', stockData); }
async function saveChats() {
  const toSave = {};
  for (const [id, room] of Object.entries(chatRooms)) {
    // Save ALL rooms that have messages (not just scheduled/sold)
    if (room.messages?.length > 0 || room.status === 'scheduled' || room.status === 'sold') toSave[id] = room;
  }
  await saveToDB('chats', toSave);
}
async function saveSales() { await saveToDB('sales', salesLog); }
async function saveSalesHistory() { await saveToDB('salesHistory', salesHistory); }
async function saveClientNotes() { await saveToDB('clientNotes', clientNotes); }
async function saveSearchAnalytics() { await saveToDB('searchAnalytics', searchAnalytics); }
let pedidos = [];
async function savePedidos() { await saveToDB('pedidos', pedidos); }
let clientAccounts = [];
async function saveClientAccounts() { await saveToDB('clientAccounts', clientAccounts); }
// Bug #2: server-side carts keyed by client account name/id
let carts = {}; // { clientKey: { items: [], updatedAt } }
async function saveCarts() { await saveToDB('carts', carts); }
// Bug #13: in-memory supplierStock with JSON fallback
let supplierStockMem = {};
async function saveSupplierStock() { await saveToDB('supplierStock', supplierStockMem); }

// ─── CONNECTED CLIENTS ──────────────────────────────────────────────────────
const clients = new Map();
const searchLogs = [];
let idCounter = 1;

function sendTo(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}
function broadcastToRole(role, data, excludeWs) {
  const msg = JSON.stringify(data);
  for (const [ws, info] of clients) {
    if (ws !== excludeWs && ws.readyState === 1 && info.role === role) ws.send(msg);
  }
}
function broadcastAll(data, excludeWs) {
  const msg = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(msg);
  }
}
function getOnlineList() {
  // Only show registered users with active connections (not bots/crawlers/dead sockets)
  const list = [];
  const seen = new Set(); // dedupe by name+role
  for (const [ws, info] of clients) {
    if (ws.readyState !== 1) continue; // skip dead connections
    if (!info.registered || !info.name) continue;
    const key = info.name + '_' + info.role;
    if (seen.has(key)) continue; // skip duplicate connections from same user
    seen.add(key);
    list.push({ id: info.id, name: info.name, role: info.role, roomId: info.roomId, connectedAt: info.connectedAt, active: info.active !== false });
  }
  return list;
}
function getChatList() {
  return Object.entries(chatRooms)
    .filter(([, room]) => room.status !== 'closed')
    .map(([id, room]) => ({
      id, name: room.name, role: room.role,
      lastMsg: room.messages.length ? room.messages[room.messages.length - 1] : null,
      unread: room.unreadByJuan || 0,
      msgCount: room.messages.length,
      status: room.status || 'active',
      claimedBy: room.claimedBy || null,
    })).sort((a, b) => {
      const ta = a.lastMsg ? a.lastMsg.ts : 0;
      const tb = b.lastMsg ? b.lastMsg.ts : 0;
      return tb - ta;
    });
}


// ─── SANITIZER ────────────────────────────────────────────────────────────
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").slice(0, 2000);
}

// ─── AUTH TOKENS (persisted to MongoDB so sessions survive Render restarts) ──
const crypto = require('crypto');
let sessions = {};
function createSession(role, name) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { role, name, created: Date.now() };
  // Persist to MongoDB async (fire-and-forget is fine here; saveAllData also covers it)
  saveSessions().catch(e => console.error('[saveSessions]', e));
  return token;
}
async function saveSessions() { await saveToDB('sessions', sessions); }
async function loadSessions() {
  if (!db) return;
  try {
    const doc = await db.collection('config').findOne({ _id: 'sessions' });
    if (doc && doc.data && typeof doc.data === 'object') {
      // Only load sessions that haven't expired (24h lifetime)
      const now = Date.now();
      const valid = {};
      for (const [t, s] of Object.entries(doc.data)) {
        if (s && s.created && now - s.created < 86400000) valid[t] = s;
      }
      sessions = valid;
      console.log(`[sessions] loaded ${Object.keys(sessions).length} active sessions from MongoDB`);
    }
  } catch (e) { console.error('[sessions] load error:', e); }
}
function requireAuth(roles) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = token && sessions[token];
    if (!session || !roles.includes(session.role)) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }
    req.user = session;
    next();
  };
}
// Clean expired sessions every 30 min (24h lifetime)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const t in sessions) { if (now - sessions[t].created > 86400000) { delete sessions[t]; cleaned++; } }
  if (cleaned > 0) saveSessions().catch(e => console.error('[saveSessions]', e));
}, 1800000);

// ─── RATE LIMITER ────────────────────────────────────────────────────────────
const rateLimits = {};
function rateLimit(ip, max, windowMs) {
  const now = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => now - t < windowMs);
  if (rateLimits[ip].length >= max) return false;
  rateLimits[ip].push(now);
  return true;
}
// Clean up old entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimits) {
    rateLimits[ip] = rateLimits[ip].filter(t => now - t < 60000);
    if (rateLimits[ip].length === 0) delete rateLimits[ip];
  }
}, 300000);

// ─── EXPRESS ─────────────────────────────────────────────────────────────────
const app = express();
const distPath = path.join(__dirname, 'dist');

app.use(helmet({
  contentSecurityPolicy: false, // React uses inline styles
  crossOriginEmbedderPolicy: false, // Allow Google Maps embed
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Verify session endpoint — frontend calls this on page load to detect stale tokens
app.get('/api/verify-session', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = token && sessions[token];
  if (!session) return res.status(401).json({ ok: false, error: 'session_expired' });
  res.json({ ok: true, role: session.role, name: session.name });
});

// ─── IMAGES IN MONGODB (Bug #3/#12 fix) ────────────────────────────────────
// Render free tier has an ephemeral filesystem: anything written to disk is
// wiped on every deploy/restart. So we store image uploads in MongoDB as
// base64 strings and serve them through /api/img/:name with long cache.
// An in-memory LRU avoids hitting MongoDB on every request.
const IMG_CACHE = new Map(); // name -> { data: Buffer, mime, etag }
const IMG_CACHE_MAX = 200;
function imgCachePut(name, entry) {
  if (IMG_CACHE.has(name)) IMG_CACHE.delete(name);
  IMG_CACHE.set(name, entry);
  while (IMG_CACHE.size > IMG_CACHE_MAX) {
    const firstKey = IMG_CACHE.keys().next().value;
    IMG_CACHE.delete(firstKey);
  }
}
async function saveImageToDB(name, mime, buf) {
  if (!db) throw new Error('no_db');
  const b64 = buf.toString('base64');
  await db.collection('images').updateOne(
    { _id: name },
    { $set: { _id: name, mime, data: b64, size: buf.length, uploadedAt: Date.now() } },
    { upsert: true }
  );
  imgCachePut(name, { data: buf, mime, etag: '"' + name + '-' + buf.length + '"' });
}
async function loadImageFromDB(name) {
  if (IMG_CACHE.has(name)) return IMG_CACHE.get(name);
  if (!db) return null;
  const doc = await db.collection('images').findOne({ _id: name });
  if (!doc) return null;
  const buf = Buffer.from(doc.data, 'base64');
  const entry = { data: buf, mime: doc.mime || 'image/jpeg', etag: '"' + name + '-' + buf.length + '"' };
  imgCachePut(name, entry);
  return entry;
}
app.get('/api/img/:name', async (req, res) => {
  try {
    const name = String(req.params.name).replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!name) return res.status(400).end();
    const entry = await loadImageFromDB(name);
    if (!entry) return res.status(404).end();
    if (req.headers['if-none-match'] === entry.etag) return res.status(304).end();
    res.setHeader('Content-Type', entry.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', entry.etag);
    res.end(entry.data);
  } catch (e) {
    console.error('[img] serve error:', e);
    res.status(500).end();
  }
});
// Backfill: on boot, scan existing disk folders and import any missing images
// into MongoDB so they survive the next redeploy.
async function backfillImagesToDB() {
  if (!db) { console.log('[img] backfill skipped: no db'); return; }
  const scanDirs = [
    { dir: path.join(__dirname, 'public', 'img', 'modelos'), prefix: 'modelo_' },
    { dir: path.join(__dirname, 'dist', 'img', 'modelos'), prefix: 'modelo_' },
    { dir: uploadsDir, prefix: 'upload_' },
  ];
  let imported = 0;
  for (const { dir, prefix } of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
        const name = prefix + f;
        const existing = await db.collection('images').findOne({ _id: name }, { projection: { _id: 1 } });
        if (existing) continue;
        const buf = fs.readFileSync(path.join(dir, f));
        const ext = f.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        await db.collection('images').updateOne(
          { _id: name },
          { $set: { _id: name, mime, data: buf.toString('base64'), size: buf.length, uploadedAt: Date.now(), backfilled: true } },
          { upsert: true }
        );
        imported++;
      }
    } catch (e) { console.error('[img] backfill error:', e); }
  }
  if (imported > 0) console.log(`[img] backfilled ${imported} images to MongoDB`);
}

// ─── ACCOUNTS ──
let accounts = loadJSON('accounts.json', {
  admin: { user: 'juan', pass: '1234', name: 'Juan', role: 'admin' },
  employees: []
});
async function saveAccounts() { await saveToDB('accounts', accounts); }

// Auto-migrate plaintext passwords to bcrypt on first run
function isHashed(p) { return p && p.startsWith('$2'); }
(async () => {
  let changed = false;
  if (!isHashed(accounts.admin.pass)) {
    accounts.admin.pass = await bcrypt.hash(accounts.admin.pass, 10);
    changed = true;
  }
  for (const e of accounts.employees) {
    if (!isHashed(e.pass)) {
      e.pass = await bcrypt.hash(e.pass, 10);
      changed = true;
    }
  }
  if (changed) saveAccounts().catch(e => console.error('[saveAccounts]', e));
})();

// Auth
app.post('/api/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(ip, 10, 60000)) return res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera 1 minuto.' });
  const { password, username } = req.body;
  if (!password || !username) return res.json({ ok: false });
  // Admin login — username must match
  if (username === accounts.admin.user && await bcrypt.compare(password, accounts.admin.pass)) {
    const token = createSession('admin', accounts.admin.name);
    return res.json({ ok: true, role: 'admin', name: accounts.admin.name, token });
  }
  // Employee login — username must match
  for (const emp of accounts.employees) {
    if (emp.user === username && await bcrypt.compare(password, emp.pass)) {
      const token = createSession('employee', emp.name);
      return res.json({ ok: true, role: 'employee', name: emp.name, token });
    }
  }
  // Client login
  for (const cli of clientAccounts) {
    if ((cli.email === username || cli.phone === username) && await bcrypt.compare(password, cli.pass)) {
      const token = createSession('client', cli.name);
      return res.json({ ok: true, role: 'client', name: cli.name, clientId: cli.id, token });
    }
  }
  return res.json({ ok: false });
});

// Client register
app.post('/api/register', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(ip, 5, 60000)) return res.status(429).json({ ok: false, error: 'Demasiados intentos' });
  const { name, email, phone, password } = req.body;
  if (!name || !password || password.length < 4) return res.json({ ok: false, error: 'Nombre y contraseña (mín 4 caracteres) requeridos' });
  if (!email && !phone) return res.json({ ok: false, error: 'Email o teléfono requerido' });
  // Check if email/phone already exists
  if (email && clientAccounts.find(c => c.email === email)) return res.json({ ok: false, error: 'Ese email ya tiene cuenta' });
  if (phone && clientAccounts.find(c => c.phone === phone)) return res.json({ ok: false, error: 'Ese teléfono ya tiene cuenta' });
  const hashed = await bcrypt.hash(password, 10);
  const client = {
    id: 'cli_' + Date.now(),
    name: sanitize(name),
    email: sanitize(email || ''),
    phone: sanitize(phone || ''),
    pass: hashed,
    createdAt: Date.now(),
  };
  clientAccounts.push(client);
  saveClientAccounts().catch(e => console.error('[saveClientAccounts]', e));
  const token = createSession('client', client.name);
  res.json({ ok: true, role: 'client', name: client.name, clientId: client.id, token });
});

// Get client pedidos
app.get('/api/mis-pedidos', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = token && sessions[token];
  if (!session) return res.json({ pedidos: [] });
  const mine = pedidos.filter(p => p.cliente?.nombre === session.name).reverse();
  res.json({ pedidos: mine });
});

// Client accounts list (staff can see)
app.get('/api/clientes', requireAuth(['admin', 'employee']), (req, res) => {
  const list = clientAccounts.map(c => {
    const clientPedidos = pedidos.filter(p => p.cliente?.nombre === c.name || p.cliente?.email === c.email);
    const enProgreso = clientPedidos.filter(p => !['entregado', 'cancelado'].includes(p.estado)).length;
    const completados = clientPedidos.filter(p => p.estado === 'entregado').length;
    return {
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      createdAt: c.createdAt,
      pedidosEnProgreso: enProgreso,
      pedidosCompletados: completados,
      totalPedidos: clientPedidos.length,
    };
  });
  res.json({ clientes: list });
});

// Account management (admin only — requires auth)
app.get('/api/accounts', requireAuth(['admin']), (req, res) => {
  res.json({
    admin: { user: accounts.admin.user, name: accounts.admin.name },
    employees: accounts.employees.map(e => ({ id: e.id, user: e.user, name: e.name, passVisible: e.passVisible || '****', createdAt: e.createdAt }))
  });
});
app.post('/api/accounts/employee', requireAuth(['admin']), async (req, res) => {
  const { name, user, pass } = req.body;
  if (!name || !pass) return res.json({ ok: false, error: 'Nombre y contraseña requeridos' });
  if (pass.length < 4) return res.json({ ok: false, error: 'Mínimo 4 caracteres' });
  const id = 'emp_' + Date.now();
  const hashed = await bcrypt.hash(pass, 10);
  accounts.employees.push({ id, name, user: user || name.toLowerCase().replace(/\s+/g,''), pass: hashed, passVisible: pass, createdAt: Date.now() });
  saveAccounts().catch(e => console.error('[saveAccounts]', e));
  res.json({ ok: true });
});
app.delete('/api/accounts/employee/:id', requireAuth(['admin']), (req, res) => {
  const emp = accounts.employees.find(e => e.id === req.params.id);
  accounts.employees = accounts.employees.filter(e => e.id !== req.params.id);
  saveAccounts().catch(e => console.error('[saveAccounts]', e));
  // Kick the employee in real-time via WebSocket
  if (emp) {
    for (const [ws, info] of clients) {
      if (info.role === 'employee' && info.name === emp.name && ws.readyState === 1) {
        sendTo(ws, { type: 'kicked' });
      }
    }
  }
  res.json({ ok: true });
});
app.post('/api/accounts/admin-pass', requireAuth(['admin']), async (req, res) => {
  const { newPass } = req.body;
  if (!newPass || newPass.length < 4) return res.json({ ok: false, error: 'Mínimo 4 caracteres' });
  accounts.admin.pass = await bcrypt.hash(newPass, 10);
  saveAccounts().catch(e => console.error('[saveAccounts]', e));
  res.json({ ok: true });
});

// Stock
app.get('/api/stock', (req, res) => res.json(stockData));
app.post('/api/stock', requireAuth(['admin', 'employee']), async (req, res) => {
  try {
    stockData = req.body;
    await saveStock();
    broadcastAll({ type: 'stock_update', stock: stockData });
    res.json({ ok: true });
  } catch (e) {
    console.error('[saveStock] failed:', e);
    res.status(500).json({ ok: false, error: 'save_failed' });
  }
});

// Model image upload — stores in MongoDB so it survives Render redeploys
app.post('/api/upload-model-image', requireAuth(['admin']), async (req, res) => {
  try {
    const { modelId, image } = req.body;
    if (!modelId || !image) return res.status(400).json({ ok: false, error: 'Faltan datos' });
    const match = image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Formato de imagen invalido' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const mime = 'image/' + (match[1] === 'jpg' ? 'jpeg' : match[1]);
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'Imagen demasiado grande (max 5MB)' });
    const name = 'modelo_' + modelId.replace(/[^a-zA-Z0-9_-]/g, '') + '.' + ext;
    await saveImageToDB(name, mime, buf);
    console.log('[ModelImage] Saved to DB', name, buf.length, 'bytes');
    res.json({ ok: true, url: '/api/img/' + name });
  } catch (e) {
    console.error('[ModelImage] Error:', e);
    res.status(500).json({ ok: false, error: 'Error al subir imagen' });
  }
});

// Generic image upload — also in MongoDB
app.post('/api/upload', requireAuth(['admin', 'employee']), async (req, res) => {
  try {
    const { image, filename } = req.body;
    const match = image && image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const mime = 'image/' + (match[1] === 'jpg' ? 'jpeg' : match[1]);
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Too large (max 5MB)' });
    const baseName = (filename || `img_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const name = 'upload_' + baseName + '.' + ext;
    await saveImageToDB(name, mime, buf);
    res.json({ ok: true, url: '/api/img/' + name });
  } catch (e) {
    console.error('[Upload] Error:', e);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});


// ─── ANALYTICS API ──
// Sales history
app.get('/api/sales-history', requireAuth(['admin', 'employee']), (req, res) => {
  const today = new Date().toDateString();
  const todaySales = salesHistory.filter(s => new Date(s.date).toDateString() === today);
  const todayTotal = todaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekSales = salesHistory.filter(s => s.date > weekAgo);
  res.json({
    today: { count: todaySales.length, total: todayTotal },
    week: { count: weekSales.length },
    recent: salesHistory.slice(-20).reverse(),
  });
});

app.post('/api/sales-history', requireAuth(['admin', 'employee']), async (req, res) => {
  const { clientName, products, total, notes } = req.body;
  salesHistory.push({
    id: 'sale_' + Date.now(),
    date: Date.now(),
    clientName: clientName || 'Cliente',
    products: products || [],
    total: total || 0,
    notes: notes || '',
  });
  if (salesHistory.length > 1000) salesHistory = salesHistory.slice(-500);
  try { await saveSalesHistory(); } catch (e) { console.error('[saveSalesHistory] failed:', e); return res.status(500).json({ ok: false, error: 'save_failed' }); }
  res.json({ ok: true });
});

// Client notes
app.get('/api/client-notes/:name', (req, res) => {
  res.json({ notes: clientNotes[req.params.name] || '' });
});

app.post('/api/client-notes', requireAuth(['admin', 'employee']), (req, res) => {
  const { clientName, note } = req.body;
  if (clientName) {
    clientNotes[clientName] = note || '';
    saveClientNotes().catch(e => console.error('[saveClientNotes]', e));
  }
  res.json({ ok: true });
});

// Popular products (tracked from searches)
app.get('/api/popular-products', (req, res) => {
  const sorted = Object.entries(searchAnalytics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({ term, count }));
  res.json({ popular: sorted });
});

// Frequent clients
app.get('/api/frequent-clients', requireAuth(['admin', 'employee']), (req, res) => {
  const clientCounts = {};
  salesHistory.forEach(s => {
    clientCounts[s.clientName] = (clientCounts[s.clientName] || 0) + 1;
  });
  const sorted = Object.entries(clientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count, notes: clientNotes[name] || '' }));
  res.json({ clients: sorted });
});

// ─── PEDIDOS (Orders) ────────────────────────────────────────────────────
// Create order (public - clients can order)
app.post('/api/pedidos', async (req, res) => {
  const { cliente, items, total, entrega, comprobante, notas } = req.body;
  if (!cliente?.nombre || !cliente?.telefono || !items?.length) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos' });
  }
  // Basic total sanity check (prevents negative or absurd totals from bypassing checkout)
  const numTotal = Number(total) || 0;
  if (numTotal < 0 || numTotal > 50000000) {
    return res.status(400).json({ ok: false, error: 'Total invalido' });
  }
  const order = {
    id: 'PED-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    cliente: { nombre: sanitize(cliente.nombre), telefono: sanitize(cliente.telefono), email: sanitize(cliente.email || ''), direccion: sanitize(cliente.direccion || '') },
    items: items.map(i => ({ nombre: sanitize(i.nombre || ''), numero_parte: i.numero_parte, modelo: i.modelo_nombre || '', precio: i.precio, qty: i.qty || 1 })),
    total: total || 0,
    entrega: entrega || 'local', // 'local' or 'envio'
    direccionEnvio: sanitize(req.body.direccionEnvio || ''),
    comprobante: comprobante || null, // base64 image
    notas: sanitize(notas || ''),
    estado: 'pendiente',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  pedidos.push(order);
  try {
    await savePedidos();
  } catch (e) {
    console.error('[savePedidos create] failed:', e);
    // Roll back in-memory push so retry doesn't duplicate
    const idx = pedidos.indexOf(order);
    if (idx !== -1) pedidos.splice(idx, 1);
    return res.status(500).json({ ok: false, error: 'save_failed' });
  }
  // Notify admin/employees via WebSocket
  broadcastToRole('admin', { type: 'new_order', order });
  broadcastToRole('employee', { type: 'new_order', order });
  // Send confirmation email to client
  try { sendOrderEmail(order, 'pendiente'); } catch (e) { console.error('[email] failed:', e); }
  res.json({ ok: true, orderId: order.id });
});

// List orders (staff only)
app.get('/api/pedidos', requireAuth(['admin', 'employee']), (req, res) => {
  res.json({ pedidos: pedidos.slice().reverse() });
});

// Update order status (staff only)
app.post('/api/pedidos/status', requireAuth(['admin', 'employee']), async (req, res) => {
  const { orderId, status, encargado, nota } = req.body;
  const valid = ['pendiente', 'pagado', 'preparando', 'listo', 'enviado', 'entregado', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ ok: false, error: 'Estado invalido' });
  const order = pedidos.find(p => p.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  order.estado = status;
  order.updatedAt = Date.now();
  if (encargado) order.encargado = encargado;
  if (nota !== undefined) {
    if (typeof order.notas === 'string') order.notas = order.notas ? [{ texto: order.notas, autor: 'system', fecha: order.createdAt }] : [];
    if (!order.notas) order.notas = [];
    order.notas.push({ texto: nota, autor: req.user?.name || 'Staff', fecha: Date.now() });
  }
  try {
    await savePedidos();
    // When marked as paid, register the sale in salesHistory for the Dashboard
    if (status === 'pagado') {
      salesHistory.push({
        id: 'sale_' + Date.now(),
        date: Date.now(),
        clientName: order.cliente?.nombre || 'Cliente',
        products: (order.items || []).map(i => i.nombre || i.numero_parte || 'Producto'),
        total: Number(order.total) || 0,
        notes: 'Pedido ' + order.id,
      });
      if (salesHistory.length > 1000) salesHistory = salesHistory.slice(-500);
      await saveSalesHistory();
    }
  } catch (e) {
    console.error('[savePedidos status] failed:', e);
    return res.status(500).json({ ok: false, error: 'save_failed' });
  }
  broadcastToRole('admin', { type: 'order_updated', order });
  broadcastToRole('employee', { type: 'order_updated', order });
  // Send status update email to client
  try { sendOrderEmail(order, status); } catch (e) { console.error('[email] failed:', e); }
  res.json({ ok: true });
});

// ─── SUPPLIER STOCK (from scraper running on Juan's PC) ─────────────────
app.get('/api/supplier-stock', requireAuth(['admin', 'employee']), async (req, res) => {
  try {
    if (!db) return res.json({ stock: {}, updatedAt: null });
    const doc = await db.collection('config').findOne({ _id: 'supplierStock' });
    res.json({ stock: doc?.data || {}, updatedAt: doc?.updatedAt || null });
  } catch { res.json({ stock: {}, updatedAt: null }); }
});

// ─── CONSULTAR STOCK (Fase 5) ────────────────────────────────────────────
// On-demand stock check triggered by a real client click. Uses the ultra-
// conservative supplier-scraper module with 12h cache + daily caps.
const supplierScraper = require('./supplier-scraper.cjs');
// Hook alerting: when the scraper wants to reach Juan, log loud + (future)
// send an email via Resend. Placeholder until the alert channel is confirmed.
supplierScraper.setAlertFn((level, msg) => {
  console.error(`[SCRAPER ${level}]`, msg);
  // TODO: send email via Resend to Juan when level === 'URGENT'
});

// Simple per-IP rate limit so one user can't spam the button
const consultaRl = new Map();
function consultaRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - 60 * 1000; // 1 minute window
  const arr = (consultaRl.get(ip) || []).filter(t => t > cutoff);
  if (arr.length >= 10) return false;
  arr.push(now);
  consultaRl.set(ip, arr);
  return true;
}

app.post('/api/consultar-stock/:partNumber', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!consultaRateLimit(ip)) return res.status(429).json({ ok: false, error: 'too_many_requests' });
  const sku = String(req.params.partNumber || '').replace(/[^a-zA-Z0-9_\-./]/g, '').slice(0, 64);
  if (!sku) return res.status(400).json({ ok: false, error: 'no_sku' });
  try {
    const result = await supplierScraper.consultarStock(db, sku);
    res.json({ ok: true, sku, ...result });
  } catch (e) {
    console.error('[consultar-stock]', sku, e);
    res.status(500).json({ ok: false, error: 'internal' });
  }
});

// Admin dashboard — counters, disabled suppliers, cache inspect
app.get('/api/scraper-status', requireAuth(['admin', 'employee']), (req, res) => {
  res.json(supplierScraper.getStatus());
});

// Admin: clear cache for a specific SKU (force re-query next time)
app.post('/api/scraper-clear/:sku', requireAuth(['admin']), async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'no_db' });
  try {
    await db.collection('supplierStockCache').deleteOne({ _id: String(req.params.sku) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/supplier-stock-mark', requireAuth(['admin', 'employee']), async (req, res) => {
  const { partNumber, supplier, hasStock, precio } = req.body;
  if (!partNumber || !supplier) return res.status(400).json({ ok: false });
  try {
    if (!supplierStockMem[partNumber]) supplierStockMem[partNumber] = { suppliers: {} };
    supplierStockMem[partNumber].suppliers[supplier] = { available: hasStock, precio: precio || '', checkedAt: Date.now() };
    await saveSupplierStock();
    res.json({ ok: true });
  } catch (e) {
    console.error('[supplierStock mark]', e);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/supplier-stock/:partNumber', async (req, res) => {
  // In-memory first, then JSON fallback, then Mongo as last resort
  const partData = supplierStockMem?.[req.params.partNumber];
  res.json(partData || { suppliers: {} });
});

// ─── CARTS (Bug #2 fix) ─────────────────────────────────────────────────
// Cart is stored per authenticated client (or by a random clientKey stored
// in localStorage for anonymous users). Survives browser clears and device
// changes as long as the user is logged in.
function cartKey(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token && token.length > 4) return 'tok_' + token.slice(0, 32);
  const k = String(req.query.key || req.body?.key || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return k ? 'anon_' + k : null;
}
app.get('/api/cart', (req, res) => {
  const key = cartKey(req);
  if (!key) return res.json({ items: [], key: null });
  const cart = carts[key] || { items: [], updatedAt: 0 };
  res.json({ items: cart.items || [], updatedAt: cart.updatedAt, key });
});
app.post('/api/cart', async (req, res) => {
  const key = cartKey(req);
  if (!key) return res.status(400).json({ ok: false, error: 'no_key' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  // Sanity cap: a cart shouldn't have more than 200 items
  if (items.length > 200) return res.status(413).json({ ok: false, error: 'too_many_items' });
  carts[key] = { items, updatedAt: Date.now() };
  try { await saveCarts(); } catch (e) { console.error('[saveCarts]', e); return res.status(500).json({ ok: false, error: 'save_failed' }); }
  res.json({ ok: true });
});

// ─── EMAIL SYSTEM (Resend) ───────────────────────────────────────────────
const { Resend } = require('resend');
const RESEND_KEY = process.env.RESEND_API_KEY || '';
let resend = null;
try { if (RESEND_KEY) resend = new Resend(RESEND_KEY); } catch {}

async function sendOrderEmail(order, status) {
  if (!resend) return;
  const email = order.cliente?.email;
  if (!email) return;

  const statusLabels = {
    pendiente: 'Recibido - Esperando pago',
    pagado: 'Pago confirmado',
    preparando: 'En preparacion',
    listo: 'Listo para entrega',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };

  const itemsHtml = (order.items || []).map(i =>
    '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + (i.nombre || '') + '</td><td style="padding:8px;border-bottom:1px solid #eee">' + (i.numero_parte || '') + '</td><td style="padding:8px;border-bottom:1px solid #eee">' + (i.precio || '') + '</td></tr>'
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden">
      <div style="background:#003478;padding:20px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">La Ford de Warnes</h1>
        <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">Repuestos Ford - Desde 1978</p>
      </div>
      <div style="padding:24px">
        <h2 style="color:#003478;margin:0 0 8px">Pedido ${order.id}</h2>
        <p style="font-size:14px;color:#333">Hola ${order.cliente?.nombre || 'Cliente'},</p>
        <div style="background:#f0f4ff;border-left:4px solid #003478;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0">
          <strong style="color:#003478">Estado: ${statusLabels[status] || status}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">Producto</th><th style="padding:8px;text-align:left">Codigo</th><th style="padding:8px;text-align:left">Precio</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="text-align:right;font-size:20px;font-weight:bold;color:#16a34a;margin:16px 0">Total: $${(order.total || 0).toLocaleString('es-AR')}</div>
        <div style="background:#fafafa;border-radius:8px;padding:14px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:13px;color:#555"><strong>Entrega:</strong> ${order.entrega === 'envio' ? 'Envio a domicilio' : 'Recoger en local'}</p>
          ${order.entrega === 'local' ? '<p style="margin:0;font-size:12px;color:#888">Av. Honorio Pueyrredon 2180, Local 1, CABA</p>' : ''}
          ${order.direccionEnvio ? '<p style="margin:0;font-size:12px;color:#888">' + order.direccionEnvio + '</p>' : ''}
        </div>
        <div style="background:#f0fff4;border-radius:8px;padding:14px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:13px;color:#16a34a;font-weight:bold">Datos de pago:</p>
          <p style="margin:0;font-size:13px;color:#333">Alias MercadoPago: <strong>laforddewarnes.mp</strong></p>
          <p style="margin:0;font-size:13px;color:#333">CVU: <strong>0000003100002327991773</strong></p>
          <p style="margin:0;font-size:12px;color:#888">Titular: Juan Jesus Amaya</p>
        </div>
      </div>
      <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999">
        La Ford de Warnes - Av. Honorio Pueyrredon 2180, CABA<br>
        WhatsApp: 11 6275-6333 | Tel: 4582-1565<br>
        laforddewarnes.com
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'La Ford de Warnes <pedidos@laforddewarnes.com>',
      to: email,
      subject: 'Pedido ' + order.id + ' - ' + (statusLabels[status] || status),
      html,
    });
    console.log('[Email] Sent to', email, 'for order', order.id, 'status:', status);
  } catch (e) {
    console.error('[Email] Error:', e.message);
  }
}

// ─── CLAUDE AI SEARCH ────────────────────────────────────────────────────
const Anthropic = require('@anthropic-ai/sdk');
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || '';
let claude = null;
try { claude = new Anthropic({ apiKey: CLAUDE_KEY }); } catch {}

// ─── BUSCADOR IA V2 (Fase 7) — Gemini with function calling ──────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
const buscadorIA = require('./buscador-ia.cjs');
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
let gemini = null;
let geminiModel = null;
try {
  if (GEMINI_KEY) {
    gemini = new GoogleGenerativeAI(GEMINI_KEY);
    geminiModel = gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      tools: [{
        functionDeclarations: buscadorIA.TOOLS.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        })),
      }],
    });
  }
} catch (e) { console.error('[gemini init]', e.message); }

const BUSCADOR_MAX_ITERATIONS = 6;

function buildBuscadorSystemPrompt(role, userName) {
  const isStaff = role === 'admin' || role === 'employee' || role === 'jefe';
  const persona = isStaff
    ? `Estas ayudando a ${userName || 'un empleado'} que trabaja en La Ford de Warnes. Es tu compañero de equipo — se amable, claro y colaborativo. Ayudalo a encontrar lo que necesita rapidamente.`
    : `Estas hablando con ${userName || 'un cliente'} que visita la tienda online. Tratalo con amabilidad y paciencia, como si fuera un cliente importante que entro al local.`;
  return `Sos el asistente de busqueda inteligente de La Ford de Warnes (laforddewarnes.com), una tienda de repuestos Ford en CABA con 48 años de experiencia. WhatsApp: 11 6275-6333. Honorio Pueyrredon 2180.

${persona}

TUS HERRAMIENTAS:
- search_parts: busqueda fuzzy con typos y sinonimos. Usala primero cuando el cliente describe algo vago.
- filter_by_compatibility: SOLO devuelve piezas con compatibilidad verificada (detalles del catalogo oficial Ford). Usala cuando tenes modelo+año+motor y queres info 100% confiable.
- get_part_details: trae info completa de un SKU puntual.
- suggest_alternatives: cuando no hay lo pedido, ofrecele alternativas similares.
- consultar_stock_ahora: SOLO si el cliente pregunta explicitamente por disponibilidad. No spamees este tool.
- proponer_agregar_carrito: IMPORTANTE — NO agrega nada solo. Emite una propuesta que el cliente confirma con un boton. Usala SOLO si el cliente dice explicitamente "agrega" o "comprame" o equivalente. Siempre presentala como "te propongo agregar X, confirmalo abajo".

REGLAS CRITICAS DE HONESTIDAD:
1. NO inventes compatibilidades. Si no tenes datos verificados (campo detalles), decilo claro: "no tengo detalle de compatibilidad verificado, mejor consultamos a Juan por WhatsApp para estar seguros".
2. NO inventes precios ni SKUs. Siempre sacalos de las herramientas.
3. Si una busqueda no devuelve nada, sugerir WhatsApp (11 6275-6333) es una opcion valida.
4. Cuando un cliente pide "algo para X", PRIMERO pregunta modelo y año si no los sabes. No adivines.
5. Si el cliente escribe con typos, corregi mentalmente y busca, pero nunca le digas "escribiste mal". Simplemente entendes y respondes.

FORMATO DE RESPUESTA:
- Español amable y profesional. Podes usar "vos" pero siempre con respeto y buena onda. Nada de insultos, groserias ni jerga agresiva.
- Cuando muestres productos, mencionalos con nombre y precio.
- Cuando encuentres 5+ resultados, NO los listes todos — mostra los 3 mas relevantes y ofrece "tengo mas opciones, queres que te muestre?".
- Si propones agregar al carrito, SIEMPRE aclara "necesito tu confirmacion, toca el boton verde abajo".
- Se siempre paciente, incluso si el cliente pregunta algo obvio o repite la misma pregunta.

DATOS DE PAGO (si el cliente pregunta): Alias MercadoPago laforddewarnes.mp. CVU 0000003100002327991773.`;
}

// In-memory search logs buffered for analytics — flushed to Mongo periodically
const searchLogBuffer = [];
async function flushSearchLogs() {
  if (searchLogBuffer.length === 0 || !db) return;
  const toFlush = searchLogBuffer.splice(0, searchLogBuffer.length);
  try {
    await db.collection('searchLogsV2').insertMany(toFlush);
  } catch (e) {
    console.error('[searchLogsV2] flush failed:', e);
    searchLogBuffer.unshift(...toFlush);
  }
}
setInterval(() => flushSearchLogs().catch(() => {}), 30000);

app.post('/api/buscador-ia-v2', async (req, res) => {
  if (!geminiModel) return res.status(503).json({ ok: false, error: 'IA no disponible — falta GEMINI_API_KEY' });
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!rateLimit(ip, 30, 60000)) return res.status(429).json({ ok: false, error: 'Muchas consultas, esperá un momento' });

  const { messages, role, userName, sessionId } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ ok: false, error: 'Mensajes vacios' });
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser || typeof lastUser.content !== 'string' || lastUser.content.length < 2) return res.status(400).json({ ok: false, error: 'Mensaje del usuario muy corto' });

  const logEntry = {
    sessionId: String(sessionId || '').slice(0, 64) || null,
    ip: String(ip).slice(0, 45),
    role: role || 'client',
    userName: userName || null,
    userMessage: lastUser.content.slice(0, 500),
    startedAt: Date.now(),
    toolsUsed: [],
    resultSkus: [],
    proposalSku: null,
    finalResponseLen: 0,
    iterations: 0,
    error: null,
  };

  try {
    // Convert conversation to Gemini format
    // Gemini uses "user" and "model" roles (not "assistant")
    const geminiHistory = [];
    for (const m of messages) {
      if (!m || !m.content) continue;
      if (m.role === 'user') geminiHistory.push({ role: 'user', parts: [{ text: m.content }] });
      else if (m.role === 'assistant') geminiHistory.push({ role: 'model', parts: [{ text: m.content }] });
    }
    // Remove the last user message — it goes into sendMessage, not history
    const lastUserMsg = geminiHistory.pop();
    if (!lastUserMsg) return res.status(400).json({ ok: false, error: 'No user message' });

    const chat = geminiModel.startChat({
      history: geminiHistory,
      systemInstruction: buildBuscadorSystemPrompt(role, userName),
    });

    const toolContext = { db, supplierScraper };
    const collectedProposals = [];
    const collectedCards = [];
    let finalText = '';

    // First message to Gemini
    let result = await chat.sendMessage(lastUserMsg.parts);
    let response = result.response;

    for (let iter = 0; iter < BUSCADOR_MAX_ITERATIONS; iter++) {
      logEntry.iterations = iter + 1;

      // Check for text in the response
      const text = response.text && response.text() ? response.text() : '';
      if (text) finalText = text;

      // Check for function calls
      const fnCalls = response.functionCalls ? response.functionCalls() : null;
      if (!fnCalls || fnCalls.length === 0) break; // No more tools to call, done

      // Execute each function call
      const fnResponses = [];
      for (const fc of fnCalls) {
        logEntry.toolsUsed.push(fc.name);
        const toolResult = await buscadorIA.executeTool(fc.name, fc.args || {}, toolContext);
        // Collect cards/proposals for frontend
        if (toolResult.ok) {
          if (Array.isArray(toolResult.items)) {
            for (const it of toolResult.items) {
              if (it.sku && !collectedCards.find(c => c.sku === it.sku)) collectedCards.push(it);
              if (it.sku) logEntry.resultSkus.push(it.sku);
            }
          }
          if (Array.isArray(toolResult.alternativas)) {
            for (const it of toolResult.alternativas) {
              if (it.sku && !collectedCards.find(c => c.sku === it.sku)) collectedCards.push(it);
            }
          }
          if (toolResult.proposal && toolResult.proposal.type === 'cart_proposal') {
            collectedProposals.push(toolResult.proposal);
            logEntry.proposalSku = toolResult.proposal.sku;
          }
        }
        fnResponses.push({
          functionResponse: {
            name: fc.name,
            response: toolResult,
          },
        });
      }
      // Send function results back to Gemini
      result = await chat.sendMessage(fnResponses);
      response = result.response;
      // Capture the final text after tool results
      const afterText = response.text && response.text() ? response.text() : '';
      if (afterText) finalText = afterText;
    }

    logEntry.finalResponseLen = finalText.length;
    logEntry.durationMs = Date.now() - logEntry.startedAt;
    logEntry.noResults = logEntry.resultSkus.length === 0 && collectedProposals.length === 0;
    searchLogBuffer.push(logEntry);

    res.json({
      ok: true,
      response: finalText || 'No pude generar respuesta, probá reformular la consulta.',
      cards: collectedCards.slice(0, 8),
      proposals: collectedProposals,
      meta: { iterations: logEntry.iterations, toolsUsed: logEntry.toolsUsed, noResults: logEntry.noResults },
    });
  } catch (e) {
    console.error('[buscador-ia-v2]', e);
    logEntry.error = e.message;
    logEntry.durationMs = Date.now() - logEntry.startedAt;
    searchLogBuffer.push(logEntry);
    res.status(500).json({ ok: false, error: 'Error de IA: ' + (e.message || 'desconocido') });
  }
});

// ─── SEARCH INSIGHTS (Fase 7C) — resumen IA para el jefe ─────────────────
// Claude lee el log de busquedas de los ultimos N dias y genera insights
// accionables: top queries con resultados, top queries SIN resultados
// (oportunidades de agregar al catalogo), conversion de busqueda, etc.
app.get('/api/search-insights', requireAuth(['admin']), async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'no_db' });
  if (!gemini) return res.status(503).json({ ok: false, error: 'IA no disponible' });
  try {
    await flushSearchLogs();
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const logs = await db.collection('searchLogsV2').find({ startedAt: { $gte: since } }).sort({ startedAt: -1 }).limit(1000).toArray();

    // Build raw aggregates (cheap stats + sample queries for the AI)
    const total = logs.length;
    const noResults = logs.filter(l => l.noResults).length;
    const withProposal = logs.filter(l => l.proposalSku).length;
    const errors = logs.filter(l => l.error).length;
    const avgDuration = total ? Math.round(logs.reduce((s, l) => s + (l.durationMs || 0), 0) / total) : 0;
    const toolCounts = {};
    for (const l of logs) for (const t of (l.toolsUsed || [])) toolCounts[t] = (toolCounts[t] || 0) + 1;

    const noResultQueries = logs.filter(l => l.noResults && !l.error).map(l => l.userMessage).slice(0, 60);
    const topQueries = logs.filter(l => !l.noResults && !l.error).map(l => l.userMessage).slice(0, 60);

    // Ask Claude to summarize the raw data into actionable insights
    const aiPrompt = `Sos un analista comercial de La Ford de Warnes, una tienda de repuestos Ford. Te paso el log de busquedas de los ultimos ${days} dias y necesito que le resumas a Juan (el jefe) lo mas importante en formato corto y accionable.

STATS CRUDAS:
- Total busquedas: ${total}
- Sin resultados: ${noResults} (${total ? Math.round(noResults / total * 100) : 0}%)
- Propusieron agregar al carrito: ${withProposal}
- Errores: ${errors}
- Duracion promedio: ${avgDuration}ms
- Herramientas usadas: ${JSON.stringify(toolCounts)}

BUSQUEDAS SIN RESULTADOS (oportunidades — piezas que clientes buscan y no tenemos):
${noResultQueries.slice(0, 40).map((q, i) => (i + 1) + '. ' + q).join('\n') || '(ninguna)'}

BUSQUEDAS EXITOSAS (lo que mas se busca y encontramos):
${topQueries.slice(0, 40).map((q, i) => (i + 1) + '. ' + q).join('\n') || '(ninguna)'}

Devolveme un resumen EN ESPAÑOL ARGENTINO tipo reporte a Juan con estas secciones:

📊 RESUMEN NUMERICO (1-2 frases)
🔥 OPORTUNIDADES (piezas que busca gente y no estan en catalogo — agrupa por tipo, ej "3 busquedas de filtros para Ranger 2019")
✅ LO QUE ANDA BIEN (que categorias estan funcionando en la busqueda)
⚠️ ALERTAS (cualquier patron raro: muchos errores, muchas busquedas sin resultado del mismo tipo, etc)
💡 RECOMENDACIONES (1-3 acciones concretas que Juan puede tomar esta semana)

Se concreto, no uses relleno. Si no hay data suficiente, decilo.`;

    const insightsModel = gemini.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const msg = await insightsModel.generateContent(aiPrompt);
    const summary = msg.response?.text?.() || 'Sin resumen';
    res.json({
      ok: true,
      period_days: days,
      stats: { total, noResults, withProposal, errors, avgDuration, toolCounts },
      summary,
    });
  } catch (e) {
    console.error('[search-insights]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Admin: hot-reload catalog after running merge-details.cjs
app.post('/api/buscador-ia-reload', requireAuth(['admin']), (req, res) => {
  const n = buscadorIA.reloadCatalog();
  res.json({ ok: true, parts: n });
});

app.post('/api/ai-search', async (req, res) => {
  if (!gemini) return res.json({ ok: false, error: 'IA no disponible' });
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(ip, 20, 60000)) return res.status(429).json({ ok: false, error: 'Muchas consultas, espera un momento' });
  const { query, context, role, userName } = req.body;
  if (!query || query.length < 2) return res.json({ ok: false, error: 'Consulta muy corta' });

  const isJefe = role === 'jefe';
  const isStaff = role === 'empleado' || isJefe;
  const personContext = isJefe
    ? `Estas hablando con Juan, el dueño de La Ford de Warnes. Es tu jefe — tratalo con respeto y confianza. Ayudalo con buscar piezas, ver stock, registrar ventas, crear empleados, ajustar precios, estadisticas. No le hables como cliente.`
    : isStaff
    ? `Estas hablando con ${userName || 'un empleado'} que trabaja en La Ford de Warnes. Es tu compañero de equipo — ayudalo a buscar piezas para atender clientes, consultar precios, ver stock. Se amable y colaborativo.`
    : `Estas hablando con ${userName || 'un cliente'} que visita la tienda online. Ayudalo con amabilidad a encontrar repuestos, consultar precios y resolver dudas sobre su vehiculo Ford.`;

  try {
    const aiModel = gemini.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const prompt = `Sos el asistente virtual de La Ford de Warnes, una casa de repuestos Ford en Buenos Aires con mas de 48 años de experiencia. Ubicacion: Av. Honorio Pueyrredon 2180, CABA. WhatsApp: 11 6275-6333. Horarios: Lunes a Viernes 8-18, Sabados 8-13.

${personContext}

PERSONALIDAD: Hablas en español, sos amable, respetuoso y servicial. Tenes buena onda pero siempre profesional. Nada de insultos ni groserias. Sos claro y eficiente.

REGLAS:
- Si hay productos en el contexto, mencionalos con nombre y precio
- Si piden algo vago, pregunta modelo y año del vehiculo con amabilidad
- Si no encontras nada, sugeri WhatsApp (11 6275-6333) o probar con otro termino
- Respuestas cortas (2-4 oraciones) a menos que necesites detallar productos
- Si te preguntan algo que no es de repuestos, responde amablemente y redirigilo
- Se siempre amable y respetuoso, sin importar como te hablen

DATOS DE PAGO: Alias MercadoPago: laforddewarnes.mp | CVU: 0000003100002327991773

${context || 'Sin resultados del catalogo'}

CONSULTA DEL USUARIO: ${query}`;

    const result = await aiModel.generateContent(prompt);
    const text = result.response?.text?.() || 'No pude procesar tu consulta';
    res.json({ ok: true, response: text });
  } catch (e) {
    console.error('[AI]', e.message);
    res.json({ ok: false, error: 'Error de IA' });
  }
});

// Static
// Bug #3 fallback: if the client requests /img/modelos/X or /uploads/X and
// the disk copy is missing (post-redeploy), try to serve it from MongoDB.
app.get('/img/modelos/:name', async (req, res, next) => {
  try {
    const fname = String(req.params.name).replace(/[^a-zA-Z0-9_.-]/g, '');
    const diskPath = path.join(distPath, 'img', 'modelos', fname);
    if (fs.existsSync(diskPath)) return res.sendFile(diskPath);
    const entry = await loadImageFromDB('modelo_' + fname);
    if (!entry) return res.status(404).end();
    res.setHeader('Content-Type', entry.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(entry.data);
  } catch (e) { next(e); }
});
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});


// Auto-reply outside business hours
function isOutsideHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0) return true;
  if (day === 6 && (hour < 8 || hour >= 13)) return true;
  if (hour < 8 || hour >= 18) return true;
  return false;
}
const AUTO_REPLY = 'Gracias por escribirnos! En este momento estamos fuera de horario. Te respondemos el proximo dia habil a partir de las 8:00. Horario: Lun-Vie 8:00-18:00 / Sab 8:00-13:00.';

// ─── HTTP + WEBSOCKET ────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Limit max concurrent WebSocket connections
const MAX_WS_CONNECTIONS = 200;
wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_WS_CONNECTIONS) { ws.close(1013, 'Too many connections'); return; }
  const clientId = 'u' + (idCounter++);
  clients.set(ws, { id: clientId, name: null, role: null, roomId: null, connectedAt: Date.now(), registered: false });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw);
      const clientInfo = clients.get(ws);

      switch (data.type) {
        case 'register': {
          // Validate role from auth token if provided, otherwise default to public
          let verifiedRole = 'public';
          if (data.token && sessions[data.token]) {
            verifiedRole = sessions[data.token].role;
          } else if (data.role === 'public') {
            verifiedRole = 'public';
          }
          const roomId = verifiedRole === 'admin' ? null : clientId;
          clientInfo.name = data.name || 'Anon';
          clientInfo.role = verifiedRole;
          clientInfo.registered = true;
          clientInfo.roomId = roomId;

          if (roomId && !chatRooms[roomId]) {
            chatRooms[roomId] = {
              name: data.name || 'Cliente',
              role: data.role || 'public',
              messages: [],
              unreadByJuan: 0,
              status: 'active',
              createdAt: Date.now(),
            };
          }

          sendTo(ws, { type: 'registered', clientId, roomId });
          sendTo(ws, { type: 'stock_update', stock: stockData });

          if (data.role === 'admin' || data.role === 'employee') {
            sendTo(ws, { type: 'chat_list', rooms: getChatList() });
            sendTo(ws, { type: 'online_list', users: getOnlineList() });
            if (data.role === 'admin') {
              sendTo(ws, { type: 'search_logs', logs: searchLogs.slice(-50) });
              sendTo(ws, { type: 'sales_list', sales: salesLog.slice(-50) });
            }
          }
          if (roomId && chatRooms[roomId]) {
            sendTo(ws, { type: 'chat_history', roomId, messages: chatRooms[roomId].messages.slice(-100) });
          }

          broadcastToRole('admin', { type: 'online_list', users: getOnlineList() });
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          broadcastToRole('employee', { type: 'chat_list', rooms: getChatList() });
          break;
        }

        case 'chat_msg': {
          // Rate limit: max 30 msgs per minute
          const msgIp = 'ws_' + clientId;
          if (!rateLimit(msgIp, 30, 60000)) break;
          const roomId = data.roomId || clientInfo.roomId;
          if (!roomId || !chatRooms[roomId]) break;
          // Bug #11: persist a serverId + accept a client localId so the
          // client can deduplicate on retry and the UI can display "sent".
          const serverId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const msg = {
            id: serverId,
            localId: data.localId || null,
            from: sanitize(clientInfo.name),
            fromRole: clientInfo.role,
            text: sanitize(data.text),
            ts: Date.now(),
          };
          chatRooms[roomId].messages.push(msg);
          if (chatRooms[roomId].messages.length > 500) chatRooms[roomId].messages.shift();
          if (clientInfo.role !== 'admin' && clientInfo.role !== 'employee') {
            chatRooms[roomId].unreadByJuan = (chatRooms[roomId].unreadByJuan || 0) + 1;
          }
          // Wait for the save before ACK so the client knows it's durable
          try { await saveChats(); }
          catch (e) { console.error('[saveChats]', e); sendTo(ws, { type: 'chat_err', localId: data.localId || null, error: 'save_failed' }); break; }
          // ACK to the sender with both localId and serverId
          sendTo(ws, { type: 'chat_ack', localId: data.localId || null, serverId, roomId, ts: msg.ts });
          // Fan out the message to room participants + all staff
          for (const [otherWs, otherInfo] of clients) {
            if (otherWs.readyState !== 1) continue;
            if (otherInfo.roomId === roomId || otherInfo.role === 'admin' || otherInfo.role === 'employee') {
              sendTo(otherWs, { type: 'chat_msg', roomId, msg });
            }
          }
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          broadcastToRole('employee', { type: 'chat_list', rooms: getChatList() });
          break;
        }

        // ── Claim a chat (employee/admin takes ownership) ──
        case 'claim_chat': {
          if (clientInfo.role !== 'admin' && clientInfo.role !== 'employee') break;
          const room = chatRooms[data.roomId];
          if (!room) break;
          if (room.claimedBy) break; // already claimed
          room.claimedBy = clientInfo.name;
          room.claimedRole = clientInfo.role;
          saveChats().catch(e => console.error('[saveChats]', e));
          // Notify everyone
          broadcastAll({ type: 'chat_claimed', roomId: data.roomId, by: clientInfo.name, role: clientInfo.role });
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          broadcastToRole('employee', { type: 'chat_list', rooms: getChatList() });
          break;
        }

        case 'status': {
          clientInfo.active = data.active !== false;
          broadcastToRole('admin', { type: 'online_list', users: getOnlineList() });
          broadcastToRole('employee', { type: 'online_list', users: getOnlineList() });
          break;
        }
        case 'mark_read': {
          if (clientInfo.role !== 'admin' && clientInfo.role !== 'employee') break;
          if (data.roomId && chatRooms[data.roomId]) {
            chatRooms[data.roomId].unreadByJuan = 0;
            saveChats().catch(e => console.error('[saveChats]', e));
            sendTo(ws, { type: 'chat_history', roomId: data.roomId, messages: chatRooms[data.roomId].messages.slice(-100) });
            sendTo(ws, { type: 'chat_list', rooms: getChatList() });
          }
          break;
        }

        case 'chat_action': {
          if (clientInfo.role !== 'admin' && clientInfo.role !== 'employee') break;
          const room = chatRooms[data.roomId];
          if (!room) break;
          if (data.action === 'schedule') { room.status = 'scheduled'; saveChats().catch(e => console.error('[saveChats]', e)); }
          else if (data.action === 'sold') {
            room.status = 'sold';
            salesLog.push({ id: data.roomId, name: room.name, role: room.role, messages: room.messages, soldAt: Date.now() });
            saveSales().catch(e => console.error('[saveSales]', e)); saveChats().catch(e => console.error('[saveChats]', e));
          }
          else if (data.action === 'close') { delete chatRooms[data.roomId]; saveChats().catch(e => console.error('[saveChats]', e)); }
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          broadcastToRole('admin', { type: 'sales_list', sales: salesLog.slice(-50) });
          break;
        }

        case 'get_sales': {
          if (clientInfo.role !== 'admin') break;
          sendTo(ws, { type: 'sales_list', sales: salesLog.slice(-50) });
          break;
        }

        case 'search': {
          const log = { query: data.query, user: clientInfo.name, role: clientInfo.role, timestamp: Date.now() };
          searchLogs.push(log);
            // Track popular searches
            const term = data.query.toLowerCase().trim();
            if (term.length > 2) { searchAnalytics[term] = (searchAnalytics[term] || 0) + 1; if (Object.keys(searchAnalytics).length % 50 === 0) saveSearchAnalytics(); }
          if (searchLogs.length > 200) searchLogs.shift();
          broadcastToRole('admin', { type: 'search_log', log });
          break;
        }
      }
    } catch (e) { /* ignore */ }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    clients.delete(ws);
    if (info && info.roomId && chatRooms[info.roomId]) {
      const room = chatRooms[info.roomId];
      if (room.status === 'active' && room.messages.length === 0) {
        delete chatRooms[info.roomId];
      }
      if (room.status === 'active' && room.messages.length > 0) {
        setTimeout(() => {
          if (chatRooms[info.roomId] && chatRooms[info.roomId].status === 'active') {
            delete chatRooms[info.roomId];
            saveChats().catch(e => console.error('[saveChats]', e));
            broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          }
        }, 5 * 60 * 1000);
      }
    }
    broadcastToRole('admin', { type: 'online_list', users: getOnlineList() });
    broadcastToRole('employee', { type: 'online_list', users: getOnlineList() });
    broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
  });
});

// Ping/pong to detect dead connections
const PING_INTERVAL = 30000;
setInterval(() => {
  for (const [ws, info] of clients) {
    if (ws.readyState !== 1) { clients.delete(ws); continue; }
    if (info._pongWaiting) { ws.terminate(); clients.delete(ws); continue; }
    info._pongWaiting = true;
    ws.ping();
  }
  // Broadcast updated online list after cleanup
  broadcastToRole('admin', { type: 'online_list', users: getOnlineList() });
  broadcastToRole('employee', { type: 'online_list', users: getOnlineList() });
}, PING_INTERVAL);
wss.on('connection', (ws2) => {
  ws2.on('pong', () => { const info = clients.get(ws2); if (info) info._pongWaiting = false; });
});

// ─── AUTO-SAVE LOCK (prevents overlapping saves from clobbering each other) ──
let _isSaving = false;
async function safeSaveAll(label) {
  if (_isSaving) {
    console.log(`[AutoSave] skipped (${label}) — previous save still running`);
    return;
  }
  _isSaving = true;
  try {
    await saveAllData();
  } catch (e) {
    console.error(`[AutoSave] ${label} failed:`, e);
  } finally {
    _isSaving = false;
  }
}

// Wrap a promise with a hard timeout so Render's 10s shutdown grace period is never exceeded
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

// Connect to MongoDB then start server
connectDB().then(async () => {
  // Load persisted sessions so logins survive Render restarts
  try { await loadSessions(); } catch (e) { console.error('[sessions load]', e); }
  // Backfill existing disk images into MongoDB (one-time per boot, idempotent)
  try { await backfillImagesToDB(); } catch (e) { console.error('[img backfill]', e); }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ford Warnes server running on port ${PORT}`);
    // Auto-save every 2 minutes (with overlap lock)
    setInterval(() => safeSaveAll('interval'), 120000);
    console.log('[AutoSave] Scheduled every 2 minutes');
  });
}).catch(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ford Warnes server running on port ${PORT} (without MongoDB)`);
  });
});

// Save ALL data on shutdown (Render sends SIGTERM ~10s before stopping)
async function gracefulShutdown(signal) {
  console.log(`[Shutdown] ${signal} received, saving all data...`);
  try {
    await withTimeout(saveAllData(), 8000, 'shutdown save');
    console.log('[Shutdown] save complete');
  } catch (e) {
    console.error('[Shutdown] save failed:', e);
  }
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
