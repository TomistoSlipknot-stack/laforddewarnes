import { useState, useEffect, useRef, useCallback } from 'react';

function playNotifSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'msg') {
      // Two-tone ding
      const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
      o1.type = "sine"; o1.frequency.value = 880;
      g1.gain.setValueAtTime(0.15, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      o1.connect(g1); g1.connect(ctx.destination);
      o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.15);
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.type = "sine"; o2.frequency.value = 1175;
      g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      o2.connect(g2); g2.connect(ctx.destination);
      o2.start(ctx.currentTime + 0.12); o2.stop(ctx.currentTime + 0.3);
    } else if (type === 'alert') {
      // Triple beep for admin
      [0, 0.15, 0.3].forEach(delay => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = 1320;
        g.gain.setValueAtTime(0.12, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.1);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.1);
      });
    }
    setTimeout(() => ctx.close(), 600);
  } catch (e) { /* silent */ }
}


function showBrowserNotif(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg', badge: '/favicon.svg' });
    }
  } catch(e) {}
}

function requestNotifPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch(e) {}
}

export function useNetwork() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [stock, setStock] = useState({ modelos: [], partes: [] });
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [chatMessages, setChatMessages] = useState({}); // { [roomId]: [msg,...] }
  const [searchLogs, setSearchLogs] = useState([]);
  const [salesLog, setSalesLog] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback((name, role) => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      requestNotifPermission();
      setConnected(true);
      const token = localStorage.getItem('fw_token') || '';
      ws.send(JSON.stringify({ type: 'register', name, role, token }));
      // Activity detection
      let lastActivity = Date.now();
      let isActive = true;
      const onActivity = () => { lastActivity = Date.now(); if (!isActive) { isActive = true; ws.readyState === 1 && ws.send(JSON.stringify({ type: 'status', active: true })); } };
      const checkIdle = setInterval(() => {
        const idle = Date.now() - lastActivity > 60000;
        if (idle && isActive) { isActive = false; ws.readyState === 1 && ws.send(JSON.stringify({ type: 'status', active: false })); }
      }, 15000);
      const onVis = () => { if (document.hidden) { isActive = false; ws.readyState === 1 && ws.send(JSON.stringify({ type: 'status', active: false })); } else onActivity(); };
      document.addEventListener('visibilitychange', onVis);
      ['mousemove','keydown','click','scroll','touchstart'].forEach(e => document.addEventListener(e, onActivity, { passive: true }));
      ws._cleanActivity = () => { clearInterval(checkIdle); document.removeEventListener('visibilitychange', onVis); ['mousemove','keydown','click','scroll','touchstart'].forEach(e => document.removeEventListener(e, onActivity)); };
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case 'registered':
            setClientId(data.clientId);
            setRoomId(data.roomId);
            break;
          case 'stock_update':
            setStock(data.stock);
            break;
          case 'kicked':
            alert('Tu cuenta fue eliminada por el administrador.');
            localStorage.removeItem('fw_token');
            window.location.reload();
            break;
          case 'online_list':
            setOnlineUsers(data.users);
            break;
          case 'new_order':
            playNotifSound('alert');
            if (document.hidden) showBrowserNotif('Nuevo Pedido!', data.order.cliente.nombre + ' - $' + (data.order.total || 0).toLocaleString('es-AR'));
            break;
          case 'order_updated':
            break;
          case 'chat_list':
            setChatRooms(data.rooms);
            break;
          case 'chat_history':
            setChatMessages(prev => ({ ...prev, [data.roomId]: data.messages }));
            break;
          case 'chat_msg':
            setChatMessages(prev => {
              const room = prev[data.roomId] || [];
              return { ...prev, [data.roomId]: [...room, data.msg] };
            });
            if (data.msg.fromRole !== role) { playNotifSound(role === 'admin' ? 'alert' : 'msg'); if (document.hidden) showBrowserNotif('La Ford de Warnes', data.msg.from + ': ' + (data.msg.text || '').slice(0, 80)); }
            break;
          case 'search_log':
            setSearchLogs(prev => [...prev.slice(-49), data.log]);
            break;
          case 'search_logs':
            setSearchLogs(data.logs || []);
            break;
          case 'sales_list':
            setSalesLog(data.sales || []);
            break;
          case 'chat_claimed':
            // Update chat rooms to reflect who claimed it
            setChatRooms(prev => prev.map(r => r.id === data.roomId ? { ...r, claimedBy: data.by } : r));
            break;
        }
      } catch (err) { /* ignore */ }
    };

    ws.onclose = () => {
      ws._cleanActivity?.();
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(() => connect(name, role), 2000);
    };
    ws.onerror = () => ws.close();
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (wsRef.current) wsRef.current.close();
  }, []);

  const sendChat = useCallback((text, targetRoomId) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_msg', text, roomId: targetRoomId || roomId,
      }));
    }
  }, [roomId]);

  const markRead = useCallback((rid) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'mark_read', roomId: rid }));
    }
  }, []);

  const broadcastSearch = useCallback((query) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'search', query }));
    }
  }, []);

  const chatAction = useCallback((roomId, action) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'chat_action', roomId, action }));
    }
  }, []);

  const claimChat = useCallback((roomId) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'claim_chat', roomId }));
    }
  }, []);

  return {
    connect, disconnect, connected,
    stock, onlineUsers, chatRooms, chatMessages,
    searchLogs, salesLog, clientId, roomId,
    sendChat, markRead, broadcastSearch, chatAction, claimChat,
  };
}
