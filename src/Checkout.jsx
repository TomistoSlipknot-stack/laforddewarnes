import { useState, useRef } from 'react';
import { authFetch } from './App.jsx';

export default function Checkout({ items, onClose, onOrderComplete, theme, userName }) {
  const t = theme || {};
  const fileRef = useRef(null);

  const [nombre, setNombre] = useState(userName || '');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [entrega, setEntrega] = useState('local'); // 'local' | 'envio'
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [provincia, setProvincia] = useState('');
  const [comprobante, setComprobante] = useState(null); // base64 string
  const [comprobantePreview, setComprobantePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = items.reduce((sum, item) => {
    const num = parseInt(String(item.precio).replace(/\D/g, ''));
    return sum + (num || 0);
  }, 0);

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    border: `1px solid ${t.cardBorder || '#ccc'}`,
    borderRadius: 8,
    background: t.bg || '#fff',
    color: t.text || '#333',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const errorInputStyle = {
    ...inputStyle,
    border: '1px solid #dc2626',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: t.textSecondary || '#666',
    marginBottom: 6,
  };

  const sectionStyle = {
    background: t.card || '#fff',
    border: `1px solid ${t.cardBorder || '#e0e0e0'}`,
    borderRadius: 12,
    padding: '18px',
    marginBottom: 16,
  };

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setComprobante(ev.target.result);
      setComprobantePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function validate() {
    const errs = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!telefono.trim()) errs.telefono = 'El telefono es obligatorio';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const order = {
      items: items.map(it => ({
        nombre: it.nombre,
        numero_parte: it.numero_parte,
        precio: it.precio,
        modelo_nombre: it.modelo_nombre,
      })),
      total,
      cliente: {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim() || null,
      },
      entrega,
      direccionEnvio: entrega === 'envio' ? `${direccion.trim()}, ${localidad.trim()}, CP ${codigoPostal.trim()}, ${provincia.trim()}` : '',
      comprobante: comprobante || null,
      notas: '',
    };

    try {
      await onOrderComplete(order);
      setSuccess(true);
    } catch { }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: t.bg || '#f5f5f5',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: t.card || '#fff',
          border: `1px solid ${t.cardBorder || '#e0e0e0'}`,
          borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 400,
          boxShadow: '0 8px 30px rgba(0,0,0,.1)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10004;</div>
          <h2 style={{ color: t.text || '#333', fontSize: 22, marginBottom: 8 }}>Pedido Confirmado</h2>
          <p style={{ color: t.textSecondary || '#666', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
            Tu pedido fue registrado. Te contactaremos por WhatsApp para confirmar disponibilidad y coordinar el pago.
          </p>
          <button onClick={onClose} style={{
            padding: '14px 32px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            border: 'none', borderRadius: 10, background: '#003478', color: '#fff',
            cursor: 'pointer',
          }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: t.bg || '#f5f5f5',
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={onClose} style={{
            background: t.card || '#fff', border: `1px solid ${t.cardBorder || '#ddd'}`,
            borderRadius: 10, width: 44, height: 44, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: t.text || '#333', flexShrink: 0,
          }}>
            &#8592;
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text || '#333', margin: 0 }}>
            Confirmar Pedido
          </h1>
        </div>

        {/* Order summary */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text || '#333', margin: '0 0 12px 0' }}>
            Resumen del pedido
          </h3>
          {items.map((item, i) => (
            <div key={item.numero_parte || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '10px 0',
              borderBottom: i < items.length - 1 ? `1px solid ${t.cardBorder || '#eee'}` : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text || '#333' }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: t.textMuted || t.textSecondary || '#999', marginTop: 2 }}>
                  N/P: {item.numero_parte} &middot; {item.modelo_nombre}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text || '#333', flexShrink: 0 }}>
                {item.precio}
              </div>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 14, marginTop: 4,
            borderTop: `2px solid ${t.cardBorder || '#ddd'}`,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text || '#333' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: t.text || '#333' }}>
              ${total.toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Client info */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text || '#333', margin: '0 0 14px 0' }}>
            Datos del cliente
          </h3>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nombre completo *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setErrors(er => ({ ...er, nombre: undefined })); }}
              placeholder="Tu nombre"
              style={errors.nombre ? errorInputStyle : inputStyle}
            />
            {errors.nombre && <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>{errors.nombre}</span>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Telefono / WhatsApp *</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => { setTelefono(e.target.value); setErrors(er => ({ ...er, telefono: undefined })); }}
              placeholder="Ej: 11 2345-6789"
              style={errors.telefono ? errorInputStyle : inputStyle}
            />
            {errors.telefono && <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>{errors.telefono}</span>}
          </div>

          <div>
            <label style={labelStyle}>Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Delivery method */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text || '#333', margin: '0 0 14px 0' }}>
            Metodo de entrega
          </h3>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px',
            border: `2px solid ${entrega === 'local' ? '#003478' : (t.cardBorder || '#ddd')}`,
            borderRadius: 10, cursor: 'pointer', marginBottom: 10,
            background: entrega === 'local' ? 'rgba(0,52,120,.1)' : 'transparent',
          }}>
            <input
              type="radio" name="entrega" value="retiro"
              checked={entrega === 'local'}
              onChange={() => setEntrega('local')}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text || '#333' }}>
                Recoger en local
                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginLeft: 8 }}>GRATIS</span>
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary || '#888', marginTop: 4, lineHeight: 1.4 }}>
                Av. Honorio Pueyrredon 2180, Local 1, CABA
              </div>
            </div>
          </label>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px',
            border: `2px solid ${entrega === 'envio' ? '#003478' : (t.cardBorder || '#ddd')}`,
            borderRadius: 10, cursor: 'pointer',
            background: entrega === 'envio' ? 'rgba(0,52,120,.1)' : 'transparent',
          }}>
            <input
              type="radio" name="entrega" value="envio"
              checked={entrega === 'envio'}
              onChange={() => setEntrega('envio')}
              style={{ marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text || '#333' }}>
                Envio a domicilio
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary || '#888', marginTop: 2 }}>
                Coordinamos el envio por separado
              </div>
            </div>
          </label>

          {entrega === 'envio' && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Direccion</label>
                <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
                  placeholder="Calle y numero" style={inputStyle} autoComplete="street-address" />
              </div>
              <div>
                <label style={labelStyle}>Localidad</label>
                <input type="text" value={localidad} onChange={e => {
                  setLocalidad(e.target.value);
                  const loc = e.target.value.toLowerCase().trim();
                  // Auto-detect CABA
                  const esCABA = ['caba','capital federal','buenos aires capital','palermo','belgrano','caballito','villa crespo','villa urquiza','flores','almagro','recoleta','barracas','la boca','san telmo','nuñez','colegiales','chacarita','liniers','mataderos','devoto','lugano','pompeya','boedo','parque patricios','villa del parque','saavedra','versalles','agronomia','paternal','villa luro','monte castro','villa real','velez sarsfield','villa ortuzar','coghlan','villa pueyrredon','villa devoto','villa santa rita','parque chacabuco','parque avellaneda','villa soldati','villa riachuelo','puerto madero','retiro','san nicolas','monserrat','san cristobal','constitucion','balvanera','once','abasto','tribunales','congreso','microcentro','catalinas'].some(b => loc.includes(b));
                  if (esCABA) { setProvincia('CABA'); setCodigoPostal(loc === 'caba' || loc === 'capital federal' ? '1414' : ''); }
                }} placeholder="Ej: Villa Crespo, Quilmes..." style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Provincia</label>
                  <input type="text" value={provincia} onChange={e => setProvincia(e.target.value)}
                    placeholder="Se completa automatico" style={{ ...inputStyle, background: provincia ? (t.bg || '#f0f4ff') : (t.bg || '#fafafa') }} readOnly={!!provincia} />
                </div>
                <div style={{ width: 120 }}>
                  <label style={labelStyle}>Codigo Postal</label>
                  <input type="text" value={codigoPostal} onChange={e => setCodigoPostal(e.target.value)}
                    placeholder="CP" style={inputStyle} />
                </div>
              </div>
              {/* Shipping cost */}
              <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid ' + (t.cardBorder || '#ddd'), background: t.bg || '#fafafa' }}>
                {provincia.toLowerCase() === 'caba' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: t.text || '#333' }}>Costo de envio (CABA):</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#003478' }}>$10.000</span>
                  </div>
                ) : provincia ? (
                  <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                    Envio fuera de CABA — Un asesor te contactara para coordinar el costo del envio
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: t.textMuted || '#999' }}>
                    Ingresa tu localidad para ver el costo de envio
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text || '#333', margin: '0 0 14px 0' }}>
            Datos de pago
          </h3>
          <div style={{
            background: t.bg || '#f9f9f9', borderRadius: 8, padding: '14px',
            border: `1px solid ${t.cardBorder || '#e0e0e0'}`, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: t.textSecondary || '#666', marginBottom: 8 }}>
              Transferi el total a la siguiente cuenta:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: t.textMuted || '#888' }}>Alias MercadoPago:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text || '#333', fontFamily: 'monospace' }}>laforddewarnes.mp</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: t.textMuted || '#888' }}>CBU:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text || '#333', fontFamily: 'monospace' }}>0000003100002327991773</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Comprobante de transferencia</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              border: `2px dashed ${t.cardBorder || '#ccc'}`, borderRadius: 10,
              background: 'transparent', color: t.textSecondary || '#666',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {comprobante ? 'Cambiar comprobante' : 'Subir comprobante'}
            </button>

            {comprobantePreview && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <img
                  src={comprobantePreview}
                  alt="Comprobante"
                  style={{
                    maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                    border: `1px solid ${t.cardBorder || '#ddd'}`,
                  }}
                />
                <button onClick={() => { setComprobante(null); setComprobantePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  style={{
                    display: 'block', margin: '8px auto 0', background: 'none', border: 'none',
                    color: '#dc2626', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Quitar comprobante
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '16px', fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
            border: 'none', borderRadius: 12, background: '#003478', color: '#fff',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            boxShadow: '0 4px 16px rgba(0,52,120,.3)',
            marginBottom: 16,
          }}
        >
          {submitting ? 'Procesando...' : 'Confirmar Pedido'}
        </button>

      </div>
    </div>
  );
}
