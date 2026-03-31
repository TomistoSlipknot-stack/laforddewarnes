// Simple PDF-like presupuesto generator (opens in new window for print)
export function generatePresupuesto(items, clientName) {
  const total = items.reduce((sum, item) => {
    const num = parseInt(String(item.precio).replace(/\D/g, ''));
    return sum + (num || 0);
  }, 0);

  const date = new Date().toLocaleDateString('es-AR');

  const html = `<!DOCTYPE html>
<html><head><title>Presupuesto - La Ford de Warnes</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
  .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #003478;padding-bottom:15px;margin-bottom:20px}
  .logo{background:#003478;color:#fff;padding:8px 20px;border-radius:12px;font-weight:800;font-style:italic;font-family:Georgia,serif;font-size:24px}
  .info{text-align:right;font-size:12px;color:#666}
  h1{font-size:22px;color:#003478;margin:0 0 20px}
  .client{background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:20px;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#003478;color:#fff;padding:10px;text-align:left;font-size:13px}
  td{padding:10px;border-bottom:1px solid #eee;font-size:13px}
  .total{text-align:right;font-size:20px;font-weight:800;color:#003478;padding:15px 0;border-top:3px solid #003478}
  .footer{text-align:center;font-size:11px;color:#999;margin-top:30px;border-top:1px solid #eee;padding-top:15px}
  @media print{body{margin:0;padding:15px}}
</style></head><body>
<div class="header">
  <div><span class="logo">Ford</span><br><strong style="font-size:16px">La Ford de Warnes</strong></div>
  <div class="info">Av. Honorio Pueyrredon 2180, Local 1<br>CABA - Tel: 4582-1565<br>WhatsApp: 11 6275-6333<br>Fecha: ${date}</div>
</div>
<h1>Presupuesto</h1>
<div class="client"><strong>Cliente:</strong> ${clientName || 'Sin especificar'}</div>
<table>
<tr><th>#</th><th>Producto</th><th>N° Pieza</th><th>Precio</th></tr>
${items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.nombre}</td><td>${it.numero_parte}</td><td>${it.precio}</td></tr>`).join('')}
</table>
<div class="total">Total estimado: $${total.toLocaleString('es-AR')}</div>
<p style="font-size:12px;color:#666">* Precios orientativos sujetos a disponibilidad. Validez: 48 horas.<br>* No incluye mano de obra de instalacion.</p>
<div class="footer">La Ford de Warnes — Repuestos Ford Originales y Alternativos<br>laforddewarnes.com</div>
<script>window.print();</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}
