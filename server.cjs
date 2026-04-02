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
const mongoClient = new MongoClient(MONGO_URI);

async function connectDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('fordwarnes');
    console.log('MongoDB connected!');
    // Load data from MongoDB into memory
    const accDoc = await db.collection('config').findOne({ _id: 'accounts' });
    if (accDoc) accounts = accDoc.data;
    const stockDoc = await db.collection('config').findOne({ _id: 'stock' });
    if (stockDoc) stockData = stockDoc.data;
    const histDoc = await db.collection('config').findOne({ _id: 'salesHistory' });
    if (histDoc) salesHistory = histDoc.data;
    const notesDoc = await db.collection('config').findOne({ _id: 'clientNotes' });
    if (notesDoc) clientNotes = notesDoc.data;
    const analyticsDoc = await db.collection('config').findOne({ _id: 'searchAnalytics' });
    if (analyticsDoc) searchAnalytics = analyticsDoc.data;
    const pedidosDoc = await db.collection('config').findOne({ _id: 'pedidos' });
    if (pedidosDoc) pedidos = pedidosDoc.data;
    const clientAccDoc = await db.collection('config').findOne({ _id: 'clientAccounts' });
    if (clientAccDoc) clientAccounts = clientAccDoc.data;
    console.log('Data loaded from MongoDB');
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

// Save to MongoDB (with JSON fallback)
async function saveToDB(key, data) {
  try {
    if (db) await db.collection('config').updateOne({ _id: key }, { $set: { data } }, { upsert: true });
  } catch (e) { console.error('MongoDB save error:', e.message); }
  // Also save locally as backup
  try { saveJSON(key + '.json', data); } catch {}
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

function saveStock() { saveToDB('stock', stockData); }
function saveChats() {
  const toSave = {};
  for (const [id, room] of Object.entries(chatRooms)) {
    if (room.status === 'scheduled' || room.status === 'sold') toSave[id] = room;
  }
  saveToDB('chats', toSave);
}
function saveSales() { saveToDB('sales', salesLog); }
function saveSalesHistory() { saveToDB('salesHistory', salesHistory); }
function saveClientNotes() { saveToDB('clientNotes', clientNotes); }
function saveSearchAnalytics() { saveToDB('searchAnalytics', searchAnalytics); }
let pedidos = [];
function savePedidos() { saveToDB('pedidos', pedidos); }
let clientAccounts = [];
function saveClientAccounts() { saveToDB('clientAccounts', clientAccounts); }

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

// ─── AUTH TOKENS ─────────────────────────────────────────────────────────
const crypto = require('crypto');
const sessions = {};
function createSession(role, name) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { role, name, created: Date.now() };
  return token;
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
  for (const t in sessions) { if (now - sessions[t].created > 86400000) delete sessions[t]; }
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

// ─── ACCOUNTS ──
let accounts = loadJSON('accounts.json', {
  admin: { user: 'juan', pass: '1234', name: 'Juan', role: 'admin' },
  employees: []
});
function saveAccounts() { saveToDB('accounts', accounts); }

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
  if (changed) saveAccounts();
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
  saveClientAccounts();
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
    employees: accounts.employees.map(e => ({ id: e.id, user: e.user, name: e.name, createdAt: e.createdAt }))
  });
});
app.post('/api/accounts/employee', requireAuth(['admin']), async (req, res) => {
  const { name, user, pass } = req.body;
  if (!name || !pass) return res.json({ ok: false, error: 'Nombre y contraseña requeridos' });
  if (pass.length < 4) return res.json({ ok: false, error: 'Mínimo 4 caracteres' });
  const id = 'emp_' + Date.now();
  const hashed = await bcrypt.hash(pass, 10);
  accounts.employees.push({ id, name, user: user || name.toLowerCase().replace(/\s+/g,''), pass: hashed, createdAt: Date.now() });
  saveAccounts();
  res.json({ ok: true });
});
app.delete('/api/accounts/employee/:id', requireAuth(['admin']), (req, res) => {
  const emp = accounts.employees.find(e => e.id === req.params.id);
  accounts.employees = accounts.employees.filter(e => e.id !== req.params.id);
  saveAccounts();
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
  saveAccounts();
  res.json({ ok: true });
});

// Stock
app.get('/api/stock', (req, res) => res.json(stockData));
app.post('/api/stock', requireAuth(['admin', 'employee']), (req, res) => {
  stockData = req.body;
  saveStock();
  broadcastAll({ type: 'stock_update', stock: stockData });
  res.json({ ok: true });
});

// Image upload
app.post('/api/upload', requireAuth(['admin', 'employee']), (req, res) => {
  try {
    const { image, filename } = req.body;
    const match = image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    const fname = (filename || `img_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '') + '.' + ext;
    fs.writeFileSync(path.join(uploadsDir, fname), buf);
    res.json({ ok: true, url: '/uploads/' + fname });
  } catch (e) {
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

app.post('/api/sales-history', requireAuth(['admin', 'employee']), (req, res) => {
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
  saveSalesHistory();
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
    saveClientNotes();
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
app.post('/api/pedidos', (req, res) => {
  const { cliente, items, total, entrega, comprobante, notas } = req.body;
  if (!cliente?.nombre || !cliente?.telefono || !items?.length) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos' });
  }
  const order = {
    id: 'PED-' + String(Date.now()).slice(-6),
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
  savePedidos();
  // Notify admin/employees via WebSocket
  broadcastToRole('admin', { type: 'new_order', order });
  broadcastToRole('employee', { type: 'new_order', order });
  res.json({ ok: true, orderId: order.id });
});

// List orders (staff only)
app.get('/api/pedidos', requireAuth(['admin', 'employee']), (req, res) => {
  res.json({ pedidos: pedidos.slice().reverse() });
});

// Update order status (staff only)
app.post('/api/pedidos/status', requireAuth(['admin', 'employee']), (req, res) => {
  const { orderId, status } = req.body;
  const valid = ['pendiente', 'pagado', 'preparando', 'listo', 'enviado', 'entregado', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ ok: false, error: 'Estado invalido' });
  const order = pedidos.find(p => p.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  order.estado = status;
  order.updatedAt = Date.now();
  savePedidos();
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
    saveSalesHistory();
  }
  broadcastToRole('admin', { type: 'order_updated', order });
  broadcastToRole('employee', { type: 'order_updated', order });
  res.json({ ok: true });
});

// Static
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

  ws.on('message', (raw) => {
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
          const msg = { from: sanitize(clientInfo.name), fromRole: clientInfo.role, text: sanitize(data.text), ts: Date.now() };
          chatRooms[roomId].messages.push(msg);
          if (chatRooms[roomId].messages.length > 500) chatRooms[roomId].messages.shift();
          if (clientInfo.role !== 'admin' && clientInfo.role !== 'employee') {
            chatRooms[roomId].unreadByJuan = (chatRooms[roomId].unreadByJuan || 0) + 1;
          }
          saveChats();
          // Send to: the client in this room + admin + all employees
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
          saveChats();
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
          if (clientInfo.role !== 'admin') break;
          if (data.roomId && chatRooms[data.roomId]) {
            chatRooms[data.roomId].unreadByJuan = 0;
            saveChats();
            sendTo(ws, { type: 'chat_history', roomId: data.roomId, messages: chatRooms[data.roomId].messages.slice(-100) });
            sendTo(ws, { type: 'chat_list', rooms: getChatList() });
          }
          break;
        }

        case 'chat_action': {
          if (clientInfo.role !== 'admin') break;
          const room = chatRooms[data.roomId];
          if (!room) break;
          if (data.action === 'schedule') { room.status = 'scheduled'; saveChats(); }
          else if (data.action === 'sold') {
            room.status = 'sold';
            salesLog.push({ id: data.roomId, name: room.name, role: room.role, messages: room.messages, soldAt: Date.now() });
            saveSales(); saveChats();
          }
          else if (data.action === 'close') { delete chatRooms[data.roomId]; saveChats(); }
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
            saveChats();
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

// Connect to MongoDB then start server
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ford Warnes server running on port ${PORT}`);
  });
}).catch(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ford Warnes server running on port ${PORT} (without MongoDB)`);
  });
});
