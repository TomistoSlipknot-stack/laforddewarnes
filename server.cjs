const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ─── DATA DIRECTORY ──────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function loadJSON(name, fallback) {
  const f = path.join(dataDir, name);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
}
function saveJSON(name, data) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2), 'utf8');
}

// ─── STOCK & CHAT ────────────────────────────────────────────────────────────
let stockData = loadJSON('stock.json', { modelos: [], partes: [] });
function saveStock() { saveJSON('stock.json', stockData); }

let chatRooms = {};
let salesLog = loadJSON('sales.json', []);
function saveChats() {
  const toSave = {};
  for (const [id, room] of Object.entries(chatRooms)) {
    if (room.status === 'scheduled' || room.status === 'sold') toSave[id] = room;
  }
  saveJSON('chats.json', toSave);
}
function saveSales() { saveJSON('sales.json', salesLog); }

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
  const list = [];
  for (const [, info] of clients) {
    list.push({ id: info.id, name: info.name, role: info.role, roomId: info.roomId, connectedAt: info.connectedAt });
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
    })).sort((a, b) => {
      const ta = a.lastMsg ? a.lastMsg.ts : 0;
      const tb = b.lastMsg ? b.lastMsg.ts : 0;
      return tb - ta;
    });
}

// ─── EXPRESS ─────────────────────────────────────────────────────────────────
const app = express();
const distPath = path.join(__dirname, 'dist');

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Auth
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === '1234') return res.json({ ok: true, role: 'admin', name: 'Juan' });
  if (password === 'taller') return res.json({ ok: true, role: 'employee', name: 'Empleado' });
  return res.json({ ok: false });
});

// Stock
app.get('/api/stock', (req, res) => res.json(stockData));
app.post('/api/stock', (req, res) => {
  stockData = req.body;
  saveStock();
  broadcastAll({ type: 'stock_update', stock: stockData });
  res.json({ ok: true });
});

// Image upload
app.post('/api/upload', (req, res) => {
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
    res.status(500).json({ error: e.message });
  }
});

// Static
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── HTTP + WEBSOCKET ────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = 'u' + (idCounter++);
  clients.set(ws, { id: clientId, name: 'Anon', role: 'public', roomId: null, connectedAt: Date.now() });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      const clientInfo = clients.get(ws);

      switch (data.type) {
        case 'register': {
          const roomId = data.role === 'admin' ? null : clientId;
          clientInfo.name = data.name || 'Anon';
          clientInfo.role = data.role || 'public';
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

          if (data.role === 'admin') {
            sendTo(ws, { type: 'chat_list', rooms: getChatList() });
            sendTo(ws, { type: 'online_list', users: getOnlineList() });
            sendTo(ws, { type: 'search_logs', logs: searchLogs.slice(-50) });
            sendTo(ws, { type: 'sales_list', sales: salesLog.slice(-50) });
          } else if (roomId && chatRooms[roomId]) {
            sendTo(ws, { type: 'chat_history', roomId, messages: chatRooms[roomId].messages.slice(-100) });
          }

          broadcastToRole('admin', { type: 'online_list', users: getOnlineList() });
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
          break;
        }

        case 'chat_msg': {
          const roomId = data.roomId || clientInfo.roomId;
          if (!roomId || !chatRooms[roomId]) break;
          const msg = { from: clientInfo.name, fromRole: clientInfo.role, text: data.text, ts: Date.now() };
          chatRooms[roomId].messages.push(msg);
          if (chatRooms[roomId].messages.length > 500) chatRooms[roomId].messages.shift();
          if (clientInfo.role !== 'admin') {
            chatRooms[roomId].unreadByJuan = (chatRooms[roomId].unreadByJuan || 0) + 1;
          }
          saveChats();
          for (const [otherWs, otherInfo] of clients) {
            if (otherWs.readyState !== 1) continue;
            if (otherInfo.roomId === roomId || otherInfo.role === 'admin') {
              sendTo(otherWs, { type: 'chat_msg', roomId, msg });
            }
          }
          broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
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
    broadcastToRole('admin', { type: 'chat_list', rooms: getChatList() });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ford Warnes server running on port ${PORT}`);
});
