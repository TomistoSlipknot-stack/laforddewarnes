import { useState, useRef, useEffect } from 'react';

export default function AdminChats({ network }) {
  const [activeRoom, setActiveRoom] = useState(null);
  const [inp, setInp] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'employee' | 'public'
  const bottomRef = useRef(null);

  const rooms = network.chatRooms || [];
  const filtered = rooms.filter(r => {
    if (filter === 'employee') return r.role === 'employee';
    if (filter === 'public') return r.role === 'public';
    return true;
  });

  const totalUnread = rooms.reduce((s, r) => s + (r.unread || 0), 0);
  const employeeUnread = rooms.filter(r => r.role === 'employee').reduce((s, r) => s + (r.unread || 0), 0);
  const publicUnread = rooms.filter(r => r.role === 'public').reduce((s, r) => s + (r.unread || 0), 0);

  const activeMessages = activeRoom ? (network.chatMessages[activeRoom] || []) : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages]);

  const openRoom = (rid) => {
    setActiveRoom(rid);
    network.markRead(rid);
  };

  const send = () => {
    const t = inp.trim(); if (!t || !activeRoom) return;
    network.sendChat(t, activeRoom);
    setInp('');
  };

  const fmt = ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const activeRoomInfo = rooms.find(r => r.id === activeRoom);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#fafafa' }}>
      {/* Sidebar - chat list */}
      <div style={{ width: activeRoom ? 'min(220px,35%)' : '100%', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#333', marginBottom: 8 }}>
            Conversaciones {totalUnread > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 10, marginLeft: 6 }}>{totalUnread}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all', label: 'Todos', count: totalUnread },
              { id: 'employee', label: 'Empleados', count: employeeUnread },
              { id: 'public', label: 'Clientes', count: publicUnread },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{ flex: 1, background: filter === f.id ? '#003478' : '#fff', border: `1px solid ${filter === f.id ? '#0050a0' : '#e0e0e0'}`, borderRadius: 6, padding: '4px 6px', fontSize: 10, color: filter === f.id ? '#fff' : '#888', cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
                {f.label}
                {f.count > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: 8, width: 14, height: 14, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{f.count}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#333', fontSize: 12 }}>Sin conversaciones</div>}
          {filtered.map(room => (
            <div key={room.id} onClick={() => openRoom(room.id)}
              style={{ padding: '10px 12px', borderBottom: '1px solid #e0e0e0', cursor: 'pointer', background: activeRoom === room.id ? '#f0f4f8' : 'transparent', display: 'flex', gap: 10, alignItems: 'center', transition: 'background .1s' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: room.role === 'employee' ? '#e8ffe8' : '#e8f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {room.role === 'employee' ? '🔧' : '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{room.name}</span>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {room.status === 'scheduled' && <span style={{ fontSize: 8, background: 'rgba(234,179,8,.15)', color: '#fbbf24', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>AGENDADO</span>}
                    {room.status === 'sold' && <span style={{ fontSize: 8, background: 'rgba(34,197,94,.15)', color: '#22c55e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>VENTA</span>}
                    <span style={{ fontSize: 9, color: '#333' }}>{room.role === 'employee' ? 'STAFF' : 'CLIENTE'}</span>
                  </div>
                </div>
                {room.lastMsg && (
                  <div style={{ fontSize: 11, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {room.lastMsg.text}
                  </div>
                )}
              </div>
              {room.unread > 0 && (
                <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 5px', animation: 'badge-pop .3s ease', flexShrink: 0 }}>
                  {room.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {activeRoom ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', flexShrink: 0 }}>
            <button onClick={() => setActiveRoom(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, padding: 0, fontFamily: 'inherit' }}>←</button>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: activeRoomInfo?.role === 'employee' ? '#e8ffe8' : '#e8f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {activeRoomInfo?.role === 'employee' ? '🔧' : '👤'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{activeRoomInfo?.name}</div>
              <div style={{ fontSize: 10, color: activeRoomInfo?.role === 'employee' ? '#22c55e' : '#003478' }}>
                {activeRoomInfo?.role === 'employee' ? 'Empleado' : 'Cliente'}
                {activeRoomInfo?.status === 'scheduled' && ' · Agendado'}
                {activeRoomInfo?.status === 'sold' && ' · Venta hecha'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {activeRoomInfo?.status !== 'scheduled' && activeRoomInfo?.status !== 'sold' && (
                <button onClick={(e) => { e.stopPropagation(); network.chatAction(activeRoom, 'schedule'); }}
                  title="Agendar" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid rgba(234,179,8,.3)', borderRadius: 6, background: 'rgba(234,179,8,.08)', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Agendar
                </button>
              )}
              {activeRoomInfo?.status !== 'sold' && (
                <button onClick={(e) => { e.stopPropagation(); network.chatAction(activeRoom, 'sold'); }}
                  title="Marcar venta hecha" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid rgba(34,197,94,.3)', borderRadius: 6, background: 'rgba(34,197,94,.08)', color: '#22c55e', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Venta
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); network.chatAction(activeRoom, 'close'); setActiveRoom(null); }}
                title="Cerrar y eliminar" style={{ padding: '3px 8px', fontSize: 10, border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cerrar
              </button>
            </div>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeMessages.length === 0 && <div style={{ textAlign: 'center', color: '#333', fontSize: 12, marginTop: 30 }}>Sin mensajes todavia</div>}
            {activeMessages.map((msg, i) => {
              const isMe = msg.fromRole === 'admin';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && <div style={{ fontSize: 10, color: '#999', marginBottom: 2, paddingLeft: 4 }}>{msg.from}</div>}
                  <div style={{ maxWidth: '80%', background: isMe ? '#003478' : '#f0f0f0', border: `1px solid ${isMe ? '#0050a0' : '#e0e0e0'}`, borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px', padding: '9px 13px', fontSize: 13, color: isMe ? '#fff' : '#444', lineHeight: 1.45 }}>{msg.text}</div>
                  <div style={{ fontSize: 9, color: '#ccc', marginTop: 2 }}>{fmt(msg.ts)}</div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #e0e0e0', flexShrink: 0, background: '#fafafa' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 12, padding: '4px 4px 4px 12px' }}>
              <input value={inp} onChange={e => setInp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Responder..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#333', fontFamily: 'inherit', padding: '9px 0', caretColor: '#003478' }} />
              <button onClick={send} disabled={!inp.trim()}
                style={{ width: 36, height: 36, background: inp.trim() ? '#003478' : '#ccc', border: 'none', borderRadius: 9, cursor: inp.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inp.trim() ? '#fff' : '#333'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" /></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
          Seleccioná una conversacion para responder
        </div>
      )}
    </div>
  );
}
