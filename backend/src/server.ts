import express, { Request, Response } from 'express';
import cors from 'cors';
import { db, initializeDatabase } from './db';
import { startMockSnmpServer } from './snmp-mock';
import { startMockSshServer } from './ssh-mock';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SNMP_PORT = process.env.SNMP_PORT ? parseInt(process.env.SNMP_PORT, 10) : 16100;
const SSH_PORT = process.env.SSH_PORT ? parseInt(process.env.SSH_PORT, 10) : 2222;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      snmpMockPort: SNMP_PORT,
      sshMockPort: SSH_PORT,
      httpPort: PORT,
    },
  });
});

// Outbox Sync Endpoint
app.post('/api/sync', (req: Request, res: Response) => {
  const { batch } = req.body;

  if (!Array.isArray(batch)) {
    return res.status(400).json({ error: 'Formato inválido. Se espera un arreglo "batch".' });
  }

  const syncedIds: string[] = [];

  db.serialize(() => {
    const insertSyncEvent = db.prepare(
      `INSERT INTO sync_events (id, entity_type, entity_id, action) VALUES (?, ?, ?, ?)`
    );

    const upsertDevice = db.prepare(`
      INSERT INTO devices (id, ip, mac, hostname, vendor, model, serial_number, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ip=excluded.ip,
        mac=excluded.mac,
        hostname=excluded.hostname,
        last_seen=excluded.last_seen
    `);

    const upsertInstallation = db.prepare(`
      INSERT INTO installations (
        id, device_id, site_name, technician_name, latitude, longitude,
        accuracy, notes, qr_code, photo_uri, pdf_path, status, installed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        site_name=excluded.site_name,
        technician_name=excluded.technician_name,
        notes=excluded.notes,
        status=excluded.status
    `);

    const insertDiagnostic = db.prepare(`
      INSERT INTO diagnostics (
        id, device_id, protocol, target_ip, command_or_oid,
        result_payload, status, executed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    for (const item of batch) {
      try {
        const { id, type, payload, action } = item;

        if (type === 'device') {
          upsertDevice.run(
            payload.id || id,
            payload.ip,
            payload.mac || null,
            payload.hostname || null,
            payload.vendor || null,
            payload.model || null,
            payload.serialNumber || null,
            payload.lastSeen || new Date().toISOString()
          );
        } else if (type === 'installation') {
          upsertInstallation.run(
            payload.id || id,
            payload.deviceId || null,
            payload.siteName || 'Sitio sin nombre',
            payload.technicianName || 'Técnico de campo',
            payload.latitude || null,
            payload.longitude || null,
            payload.accuracy || null,
            payload.notes || '',
            payload.qrCode || null,
            payload.photoUri || null,
            payload.pdfPath || null,
            payload.status || 'completed',
            payload.installedAt || new Date().toISOString()
          );
        } else if (type === 'diagnostic') {
          insertDiagnostic.run(
            payload.id || id,
            payload.deviceId || null,
            payload.protocol,
            payload.targetIp,
            payload.commandOrOid,
            typeof payload.resultPayload === 'object'
              ? JSON.stringify(payload.resultPayload)
              : String(payload.resultPayload),
            payload.status || 'success',
            payload.executedAt || new Date().toISOString()
          );
        }

        insertSyncEvent.run(
          `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          id,
          action || 'upsert'
        );

        syncedIds.push(id);
      } catch (err: any) {
        console.error(`Error procesando elemento de outbox ${item.id}:`, err.message);
      }
    }

    insertSyncEvent.finalize();
    upsertDevice.finalize();
    upsertInstallation.finalize();
    insertDiagnostic.finalize();

    console.log(`[Sync-API] Procesados con éxito ${syncedIds.length} elementos de outbox.`);
    return res.json({
      success: true,
      processed: syncedIds.length,
      syncedIds,
      timestamp: new Date().toISOString(),
    });
  });
});

// Consultar Instalaciones
app.get('/api/reports', (_req: Request, res: Response) => {
  db.all('SELECT * FROM installations ORDER BY installed_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Consultar Diagnósticos
app.get('/api/diagnostics', (_req: Request, res: Response) => {
  db.all('SELECT * FROM diagnostics ORDER BY executed_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Consultar Dispositivos
app.get('/api/devices', (_req: Request, res: Response) => {
  db.all('SELECT * FROM devices ORDER BY last_seen DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Consultar Eventos de Sincronización
app.get('/api/sync-events', (_req: Request, res: Response) => {
  db.all('SELECT * FROM sync_events ORDER BY received_at DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Dashboard Web Interactivo
app.get('/', (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Diagnostics Suite - Panel Central de Sincronización</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5; }
    .header { margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 24px; font-weight: 700; color: #60a5fa; }
    .subtitle { color: var(--text-muted); font-size: 14px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-online { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; }
    .card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px; }
    .card .value { font-size: 32px; font-weight: 700; color: #38bdf8; }
    .section-title { font-size: 18px; font-weight: 600; margin: 24px 0 12px 0; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); }
    th { background: #162032; color: var(--text-muted); font-weight: 600; }
    tr:hover { background: rgba(255, 255, 255, 0.02); }
    .tag { font-family: monospace; background: #0b1120; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .empty { padding: 32px; text-align: center; color: var(--text-muted); font-size: 14px; }
    .photo-thumb { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; }
    .btn-refresh { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; }
    .btn-refresh:hover { background: var(--primary-hover); }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Network Diagnostics Suite</h1>
      <p class="subtitle">Servidor Central de Recepción y Sincronización Diferida (Offline Outbox)</p>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span class="badge badge-online">● Backend Activo (Puerto ${PORT})</span>
      <button class="btn-refresh" onclick="window.location.reload()">Actualizar</button>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Reportes de Instalación</h3>
      <div class="value" id="val-reports">-</div>
    </div>
    <div class="card">
      <h3>Diagnósticos Ejecutados</h3>
      <div class="value" id="val-diagnostics">-</div>
    </div>
    <div class="card">
      <h3>Dispositivos Registrados</h3>
      <div class="value" id="val-devices">-</div>
    </div>
    <div class="card">
      <h3>Servicios Simulados</h3>
      <div style="margin-top: 8px; font-size: 13px;">
        <div>📡 SNMP Mock: <span class="tag">UDP 0.0.0.0:${SNMP_PORT}</span></div>
        <div style="margin-top: 4px;">🔒 SSH Mock: <span class="tag">TCP 0.0.0.0:${SSH_PORT}</span></div>
      </div>
    </div>
  </div>

  <h2 class="section-title">📋 Últimas Instalaciones y Reportes Sincronizados</h2>
  <div class="card" style="padding: 0; overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>Sitio</th>
          <th>Técnico</th>
          <th>Georreferencia (GPS)</th>
          <th>Código QR</th>
          <th>Fecha Instalación</th>
          <th>Notas Técnicas</th>
        </tr>
      </thead>
      <tbody id="table-installations">
        <tr><td colspan="6" class="empty">Cargando instalaciones...</td></tr>
      </tbody>
    </table>
  </div>

  <h2 class="section-title">⚡ Diagnósticos de Red Recibidos (SNMP / SSH)</h2>
  <div class="card" style="padding: 0; overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>Protocolo</th>
          <th>IP Destino</th>
          <th>Comando / OID</th>
          <th>Resultado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody id="table-diagnostics">
        <tr><td colspan="5" class="empty">Cargando diagnósticos...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    async function loadData() {
      try {
        const [repRes, diagRes, devRes] = await Promise.all([
          fetch('/api/reports'),
          fetch('/api/diagnostics'),
          fetch('/api/devices')
        ]);
        const reports = await repRes.json();
        const diagnostics = await diagRes.json();
        const devices = await devRes.json();

        document.getElementById('val-reports').innerText = reports.length;
        document.getElementById('val-diagnostics').innerText = diagnostics.length;
        document.getElementById('val-devices').innerText = devices.length;

        const repTbody = document.getElementById('table-installations');
        if (reports.length === 0) {
          repTbody.innerHTML = '<tr><td colspan="6" class="empty">No hay instalaciones registradas todavía. Los datos sincronizados por la app móvil aparecerán aquí.</td></tr>';
        } else {
          repTbody.innerHTML = reports.map(r => \`
            <tr>
              <td><strong>\${r.site_name || '-'}</strong></td>
              <td>\${r.technician_name || '-'}</td>
              <td><span class="tag">\${r.latitude ? r.latitude.toFixed(5) + ', ' + r.longitude.toFixed(5) : 'Sin GPS'}</span></td>
              <td><span class="tag">\${r.qr_code || 'N/A'}</span></td>
              <td>\${new Date(r.installed_at).toLocaleString()}</td>
              <td>\${r.notes || '-'}</td>
            </tr>
          \`).join('');
        }

        const diagTbody = document.getElementById('table-diagnostics');
        if (diagnostics.length === 0) {
          diagTbody.innerHTML = '<tr><td colspan="5" class="empty">No hay diagnósticos registrados aún.</td></tr>';
        } else {
          diagTbody.innerHTML = diagnostics.map(d => \`
            <tr>
              <td><span class="badge" style="background:#1e3a8a; color:#93c5fd;">\${d.protocol}</span></td>
              <td><span class="tag">\${d.target_ip}</span></td>
              <td><code>\${d.command_or_oid}</code></td>
              <td><pre style="font-size:11px; max-width:320px; max-height:60px; overflow:auto;">\${d.result_payload}</pre></td>
              <td>\${new Date(d.executed_at).toLocaleString()}</td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        console.error('Error cargando datos:', err);
      }
    }
    loadData();
    setInterval(loadData, 5000);
  </script>
</body>
</html>
  `);
});

// Iniciar base de datos y servidores
initializeDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[HTTP-API] Servidor Express activo en http://localhost:${PORT}`);
    });
    startMockSnmpServer(SNMP_PORT);
    startMockSshServer(SSH_PORT);
  })
  .catch((err) => {
    console.error('Error inicializando la base de datos:', err);
  });
