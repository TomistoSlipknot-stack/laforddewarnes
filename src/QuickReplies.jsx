import { useState } from 'react';

// Quick reply templates for employees/admin
const TEMPLATES = [
  { id: 'stock_si', label: 'En stock', text: 'Si, lo tenemos en stock. Podes pasar a buscarlo de lunes a viernes de 8 a 18hs.' },
  { id: 'stock_no', label: 'Sin stock', text: 'No lo tenemos en stock en este momento. Te aviso cuando llegue.' },
  { id: 'precio', label: 'Precio', text: 'El precio es $[PRECIO]. Incluye servicio. El precio OEM oficial de Ford es $[OEM].' },
  { id: 'consultar', label: 'Consultar', text: 'Dejame verificar la disponibilidad y te confirmo en unos minutos.' },
  { id: 'horarios', label: 'Horarios', text: 'Nuestro horario es de lunes a viernes de 8:00 a 18:00 y sabados de 8:00 a 13:00. Estamos en Av. Honorio Pueyrredon 2180, Local 1, CABA.' },
  { id: 'envio', label: 'Envio', text: 'Hacemos envios a todo el pais. El costo depende de la zona. Consultanos por WhatsApp: 11 6275-6333.' },
  { id: 'gracias', label: 'Gracias', text: 'Gracias por tu consulta! Cualquier otra duda estamos a disposicion.' },
  { id: 'llegada', label: 'Llegada', text: 'El producto llega aproximadamente en [DIAS] dias habiles. Te avisamos apenas lo tengamos.' },
  { id: 'whatsapp', label: 'WhatsApp', text: 'Para una atencion mas rapida, escribinos por WhatsApp al 11 6275-6333.' },
  { id: 'cerrado', label: 'Cerrado', text: 'En este momento estamos cerrados. Te respondemos manana a primera hora. Horario: Lun-Vie 8-18, Sab 8-13.' },
];

export default function QuickReplies({ onSelect, onSendFicha, product, theme }) {
  const [expanded, setExpanded] = useState(false);
  const t = theme || {};

  return (
    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--fw-cardBorder, #e0e0e0)', background: 'var(--fw-card, #fafafa)' }}>
      {/* Toggle */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ fontSize: 11, color: '#003478', background: 'none', border: '1px solid #003478', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          {expanded ? '▲ Cerrar' : '⚡ Respuestas rapidas'}
        </button>

        {/* Send product ficha button */}
        {product && onSendFicha && (
          <button onClick={() => onSendFicha(product)}
            style={{ fontSize: 11, color: '#fff', background: '#003478', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            📋 Enviar ficha del producto
          </button>
        )}

        {/* "Estoy buscando" button */}
        <button onClick={() => onSelect('Estoy buscando tu repuesto, dame un momento...')}
          style={{ fontSize: 11, color: '#fff', background: '#f59e0b', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          🔍 Estoy buscando
        </button>
      </div>

      {/* Expanded templates */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { onSelect(t.text); setExpanded(false); }}
              style={{
                fontSize: 11, color: 'var(--fw-text, #333)', background: 'var(--fw-card, #fff)',
                border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 16,
                padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .1s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Auto-reply for outside business hours
export function isOutsideHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sunday

  // Sunday = closed
  if (day === 0) return true;
  // Saturday = 8-13
  if (day === 6 && (hour < 8 || hour >= 13)) return true;
  // Weekdays = 8-18
  if (hour < 8 || hour >= 18) return true;

  return false;
}

export const AUTO_REPLY_MSG = 'Gracias por escribirnos! En este momento estamos fuera de horario. Te respondemos el proximo dia habil a partir de las 8:00. Horario: Lun-Vie 8:00-18:00 / Sab 8:00-13:00. Para urgencias: WhatsApp 11 6275-6333.';

// Format product ficha as text message
export function formatProductFicha(product) {
  if (!product) return '';
  let ficha = `📋 FICHA DEL PRODUCTO\n`;
  ficha += `━━━━━━━━━━━━━━━━━━━━\n`;
  ficha += `${product.nombre}\n`;
  ficha += `N° Pieza: ${product.numero_parte}\n`;
  ficha += `Precio La Ford de Warnes: ${product.precio}\n`;
  if (product.precio_oem) ficha += `Precio Ford oficial: ${product.precio_oem}\n`;
  ficha += `Stock: ${product.stock > 0 ? product.stock + ' disponibles' : 'Consultar disponibilidad'}\n`;
  ficha += `Categoria: ${product.cat}\n`;
  if (product.modelo_nombre) ficha += `Modelo: ${product.modelo_nombre}\n`;
  ficha += `━━━━━━━━━━━━━━━━━━━━\n`;
  ficha += `La Ford de Warnes | Tel: 4582-1565`;
  return ficha;
}
