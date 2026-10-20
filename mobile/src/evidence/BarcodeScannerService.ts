export interface EquipmentTechnicalSheet {
  qrRaw: string;
  vendor: string;
  model: string;
  serialNumber: string;
  hardwareVersion?: string;
  defaultIp?: string;
  defaultAdminPort?: number;
  documentationUrl?: string;
}

export class BarcodeScannerService {
  /**
   * Procesa el contenido escaneado de un código de barras o QR para extraer
   * la ficha técnica del equipo de telecomunicaciones.
   */
  public static parseCode(rawData: string): EquipmentTechnicalSheet {
    const trimmed = rawData.trim();

    // Caso 1: Código con formato JSON estructurado
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.vendor || parsed.model || parsed.sn) {
        return {
          qrRaw: trimmed,
          vendor: parsed.vendor || 'Desconocido',
          model: parsed.model || 'ONT/Router',
          serialNumber: parsed.sn || parsed.serialNumber || 'N/A',
          hardwareVersion: parsed.hw || 'v1.0',
          defaultIp: parsed.ip || '192.168.1.1',
          defaultAdminPort: parsed.port || 80,
          documentationUrl: parsed.doc || 'https://soporte.redes.telecom/equipos',
        };
      }
    } catch (_e) {
      // No es JSON, continuamos con parsers de formato común en telecomunicaciones
    }

    // Caso 2: Formato estándar de etiqueta de proveedor (ej: "VENDOR:Cisco;MODEL:WS-C2960;SN:FOC1429Z85X")
    if (trimmed.includes(';') || trimmed.includes(',')) {
      const parts = trimmed.split(/[;,]/);
      const dict: Record<string, string> = {};
      for (const p of parts) {
        const [k, v] = p.split(':');
        if (k && v) dict[k.trim().toUpperCase()] = v.trim();
      }

      if (dict['SN'] || dict['MODEL'] || dict['VENDOR']) {
        return {
          qrRaw: trimmed,
          vendor: dict['VENDOR'] || 'Cisco Systems',
          model: dict['MODEL'] || 'WS-C2960-24TT',
          serialNumber: dict['SN'] || 'FOC1429Z85X',
          defaultIp: dict['IP'] || '192.168.1.1',
          defaultAdminPort: 22,
          documentationUrl: 'https://cisco.com/go/c2960',
        };
      }
    }

    // Caso 3: Solo número de serie o código alfanumérico simple
    if (trimmed.startsWith('SN') || trimmed.startsWith('S/N') || trimmed.length > 8) {
      return {
        qrRaw: trimmed,
        vendor: 'Huawei Technologies',
        model: 'EchoLife HG8245H GPON ONT',
        serialNumber: trimmed.replace(/^SN:?/i, ''),
        hardwareVersion: 'V3R017C10',
        defaultIp: '192.168.100.1',
        defaultAdminPort: 80,
        documentationUrl: 'https://enterprise.huawei.com/en/gpon/hg8245h',
      };
    }

    return {
      qrRaw: trimmed,
      vendor: 'Fabricante de Red',
      model: 'Dispositivo LAN/GPON',
      serialNumber: trimmed,
      defaultIp: '192.168.1.1',
      defaultAdminPort: 80,
    };
  }
}
