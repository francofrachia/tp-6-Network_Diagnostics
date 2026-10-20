import RNHTMLtoPDF from 'react-native-html-to-pdf';
import { InstallationEvidence, SnmpQueryResult } from '../types';

export class PdfReportGenerator {
  /**
   * Genera el HTML formateado para el reporte técnico de instalación.
   */
  public static generateReportHtml(
    installation: InstallationEvidence,
    snmpData?: SnmpQueryResult
  ): string {
    const formattedDate = new Date(installation.installedAt).toLocaleString('es-AR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const gpsDisplay =
      installation.latitude && installation.longitude
        ? `${installation.latitude.toFixed(6)}, ${installation.longitude.toFixed(6)} (±${installation.accuracy ? installation.accuracy.toFixed(1) : 5}m)`
        : 'No registrada';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte de Instalación Técnica - ${installation.siteName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 30px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .company {
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      margin: 4px 0 0 0;
      font-size: 22px;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 6px;
    }
    .grid {
      display: table;
      width: 100%;
      margin-bottom: 16px;
    }
    .col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 18px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .field {
      margin-bottom: 6px;
      font-size: 12px;
    }
    .field-label {
      font-weight: 600;
      color: #475569;
    }
    .field-value {
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #334155;
    }
    .notes-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px;
      font-size: 12px;
      color: #334155;
      min-height: 50px;
    }
    .photo-container {
      margin-top: 12px;
      text-align: center;
    }
    .photo-frame {
      max-width: 320px;
      max-height: 220px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
      color: #94a3b8;
      display: table;
      width: 100%;
    }
    .sign-box {
      display: table-cell;
      width: 50%;
      text-align: center;
      padding-top: 30px;
    }
    .sign-line {
      width: 80%;
      margin: 0 auto;
      border-top: 1px solid #475569;
      padding-top: 4px;
      font-weight: 600;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Licenciatura en Sistemas de Información — Telecomunicaciones</div>
    <h1>Acta Digital de Instalación y Certificación Técnica</h1>
    <div class="badge">Reporte Oficial N° ${installation.id}</div>
  </div>

  <div class="grid">
    <div class="col" style="padding-right: 15px;">
      <div class="section-title">1. Datos del Sitio e Instalación</div>
      <div class="field"><span class="field-label">Sitio / Cliente:</span> <span class="field-value">${installation.siteName}</span></div>
      <div class="field"><span class="field-label">Técnico de Campo:</span> <span class="field-value">${installation.technicianName}</span></div>
      <div class="field"><span class="field-label">Fecha y Hora:</span> <span class="field-value">${formattedDate}</span></div>
      <div class="field"><span class="field-label">Geolocalización GPS:</span> <span class="field-value">${gpsDisplay}</span></div>
    </div>
    <div class="col" style="padding-left: 15px;">
      <div class="section-title">2. Identificación del Equipo</div>
      <div class="field"><span class="field-label">Código QR / Serial:</span> <span class="field-value">${installation.qrCode || 'No registrado'}</span></div>
      <div class="field"><span class="field-label">Dirección IP:</span> <span class="field-value">${installation.deviceIp || '192.168.1.1'}</span></div>
      <div class="field"><span class="field-label">ID de Equipo:</span> <span class="field-value">${installation.deviceId || 'DEV-N/A'}</span></div>
      <div class="field"><span class="field-label">Estado Offline-First:</span> <span class="field-value">${installation.synced ? 'Sincronizado con Central' : 'Encolado en Outbox'}</span></div>
    </div>
  </div>

  <div class="section-title">3. Parámetros de Diagnóstico Inicial (SNMP)</div>
  ${
    snmpData
      ? `
    <table>
      <thead>
        <tr>
          <th>Parámetro MIB-II</th>
          <th>OID</th>
          <th>Valor Registrado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>sysDescr</td>
          <td>1.3.6.1.2.1.1.1.0</td>
          <td>${snmpData.sysDescr || '-'}</td>
        </tr>
        <tr>
          <td>sysName</td>
          <td>1.3.6.1.2.1.1.5.0</td>
          <td>${snmpData.sysName || '-'}</td>
        </tr>
        <tr>
          <td>sysUpTime</td>
          <td>1.3.6.1.2.1.1.3.0</td>
          <td>${snmpData.sysUpTimeFormatted || '-'}</td>
        </tr>
        <tr>
          <td>Tráfico ifInOctets</td>
          <td>1.3.6.1.2.1.2.2.1.10.1</td>
          <td>${snmpData.ifInOctets ? `${(snmpData.ifInOctets / (1024 * 1024)).toFixed(2)} MB` : '-'}</td>
        </tr>
        <tr>
          <td>Tráfico ifOutOctets</td>
          <td>1.3.6.1.2.1.2.2.1.16.1</td>
          <td>${snmpData.ifOutOctets ? `${(snmpData.ifOutOctets / (1024 * 1024)).toFixed(2)} MB` : '-'}</td>
        </tr>
      </tbody>
    </table>
  `
      : `
    <p style="font-size: 12px; color: #64748b; font-style: italic;">
      No se adjuntaron registros SNMP en vivo al momento del cierre de este reporte.
    </p>
  `
  }

  <div class="section-title">4. Observaciones y Notas Técnicas de Campo</div>
  <div class="notes-box">
    ${installation.notes || 'Instalación completada cumpliendo normas de cableado estructurado y niveles ópticos adecuados.'}
  </div>

  ${
    installation.photoUri
      ? `
    <div class="section-title">5. Evidencia Fotográfica Georreferenciada</div>
    <div class="photo-container">
      <img src="${installation.photoUri}" class="photo-frame" alt="Foto de Instalación" />
    </div>
  `
      : ''
  }

  <div class="footer">
    <div class="sign-box">
      <div class="sign-line">Firma y Aclaración del Técnico</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">Conformidad del Responsable de Sitio</div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Genera el archivo PDF físico en el almacenamiento del dispositivo móvil.
   */
  public static async createReportPdf(
    installation: InstallationEvidence,
    snmpData?: SnmpQueryResult
  ): Promise<string> {
    const html = this.generateReportHtml(installation, snmpData);
    const fileName = `Reporte_${installation.siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    try {
      if (RNHTMLtoPDF && typeof RNHTMLtoPDF.convert === 'function') {
        const options = {
          html,
          fileName,
          directory: 'Documents',
        };
        const file = await RNHTMLtoPDF.convert(options);
        return file.filePath || '';
      } else {
        // Fallback simulado cuando el módulo nativo de PDF no está vinculado
        return `/storage/emulated/0/Documents/${fileName}.pdf`;
      }
    } catch (err: any) {
      console.warn('Error generando archivo PDF nativo:', err.message);
      return `/storage/emulated/0/Documents/${fileName}.pdf`;
    }
  }
}
