export default function AboutUs({ theme }) {
  const t = theme || {};
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '30px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 70, height: 38, background: '#003478', borderRadius: 20, marginBottom: 12 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 19, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: t.text || '#1a1a1a', margin: '0 0 8px' }}>La Ford de Warnes</h1>
        <p style={{ fontSize: 18, color: t.textSecondary || '#666', lineHeight: 1.6 }}>
          Casa de repuestos Ford con 50 años de antigüedad. Siempre con el óvalo.
        </p>
      </div>

      {/* Story */}
      <div style={{ background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#003478', marginBottom: 12 }}>Nuestra Historia</h2>
        <p style={{ fontSize: 15, color: t.textSecondary || '#555', lineHeight: 1.8 }}>
          La Ford de Warnes nació en la calle Warnes, corazón del mundo automotor de Buenos Aires.
          Con más de 50 años de experiencia, nos especializamos exclusivamente en repuestos Ford
          originales y alternativos de la más alta calidad.
        </p>
        <p style={{ fontSize: 15, color: t.textSecondary || '#555', lineHeight: 1.8, marginTop: 10 }}>
          Nuestro equipo conoce cada pieza, cada modelo y cada detalle de los vehículos Ford.
          Desde la Ranger hasta el Ka, desde el Mustang hasta la Transit — si es Ford, lo tenemos.
        </p>
      </div>

      {/* Services */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { icon: '🔧', title: 'Repuestos Originales', desc: 'Piezas Ford genuinas con garantía de fábrica' },
          { icon: '💰', title: 'Mejores Precios', desc: 'Precios competitivos por debajo del concesionario oficial' },
          { icon: '🚚', title: 'Envíos a todo el país', desc: 'Enviamos tu repuesto donde estés en Argentina' },
          { icon: '🔍', title: 'Asesoramiento', desc: 'Te ayudamos a encontrar la pieza exacta para tu Ford' },
          { icon: '⚡', title: 'Reparaciones', desc: 'Reparamos llaves de luces, teclas, espejos y más' },
          { icon: '📱', title: 'Atención por WhatsApp', desc: 'Consulta rápida y respuesta inmediata' },
        ].map((s, i) => (
          <div key={i} style={{ background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 10, padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text || '#333', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: t.textSecondary || '#777' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div style={{ background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#003478', marginBottom: 12 }}>Encontranos</h2>
        <div style={{ fontSize: 15, color: t.textSecondary || '#555', lineHeight: 2 }}>
          <div><strong>Dirección:</strong> Av. Honorio Pueyrredón 2180, Local 1, CABA</div>
          <div><strong>Teléfono:</strong> 4582-1565</div>
          <div><strong>WhatsApp:</strong> <a href="https://wa.me/5491162756333" style={{ color: '#25d366', fontWeight: 600, textDecoration: 'none' }}>11 6275-6333</a></div>
          <div><strong>Instagram:</strong> <a href="https://www.instagram.com/laforddewarnes/" target="_blank" rel="noopener noreferrer" style={{ color: '#E1306C', fontWeight: 600, textDecoration: 'none' }}>@laforddewarnes</a></div>
          <div style={{ marginTop: 8 }}>
            <strong>Horarios:</strong> Lunes a Viernes 8:00-18:00 · Sábados 8:00-13:00
          </div>
        </div>
      </div>

      {/* QR Code for the taller */}
      <div style={{ background: t.card || "#fff", border: "1px solid " + (t.cardBorder || "#e0e0e0"), borderRadius: 12, padding: 24, marginBottom: 20, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#003478", marginBottom: 12 }}>Código QR</h2>
        <p style={{ fontSize: 14, color: t.textSecondary || "#666", marginBottom: 16 }}>Escaneá para entrar directo a nuestra web</p>
        <img src={"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://laforddewarnes.com"} alt="QR La Ford de Warnes" style={{ width: 200, height: 200, borderRadius: 8 }} />
        <p style={{ fontSize: 12, color: t.textMuted || "#999", marginTop: 10 }}>Imprimí este QR y pegalo en el mostrador</p>
      </div>

      {/* Map */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid ' + (t.cardBorder || '#e0e0e0') }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3284.0!2d-58.4563422!3d-34.598777!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95bcca07865b0dfb%3A0xccc0a5e2fbbe584c!2sLa%20Ford%20de%20Warnes!5e0!3m2!1ses!2sar!4v1"
          width="100%" height="350" style={{ border: 0 }} allowFullScreen="" loading="lazy" title="Ubicación"
        />
      </div>
    </div>
  );
}
