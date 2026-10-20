import dgram from 'dgram';
import { SnmpCodec, ASN1_TAGS, SnmpVarBind } from './snmp-codec';

const MOCK_MIB: Record<string, { type: number; value: any }> = {
  // MIB-II System Group (1.3.6.1.2.1.1)
  '1.3.6.1.2.1.1.1.0': {
    type: ASN1_TAGS.OCTET_STRING,
    value: 'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4',
  },
  '1.3.6.1.2.1.1.2.0': {
    type: ASN1_TAGS.OBJECT_IDENTIFIER,
    value: '1.3.6.1.4.1.9.1.516',
  },
  '1.3.6.1.2.1.1.3.0': {
    type: ASN1_TAGS.TIMETICKS,
    value: 84621900, // En centésimas de segundo (~9.8 días)
  },
  '1.3.6.1.2.1.1.4.0': {
    type: ASN1_TAGS.OCTET_STRING,
    value: 'soporte.redes@isp-telecom.com.ar',
  },
  '1.3.6.1.2.1.1.5.0': {
    type: ASN1_TAGS.OCTET_STRING,
    value: 'SW-CORE-DISTRIBUCION-01',
  },
  '1.3.6.1.2.1.1.6.0': {
    type: ASN1_TAGS.OCTET_STRING,
    value: 'Rack 02 - Sala de Telecomunicaciones Central',
  },
  '1.3.6.1.2.1.1.7.0': {
    type: ASN1_TAGS.INTEGER,
    value: 78,
  },
  // Interfaces (tráfico de red)
  '1.3.6.1.2.1.2.2.1.10.1': {
    type: ASN1_TAGS.COUNTER32,
    value: 1248592300, // ifInOctets interfaz 1
  },
  '1.3.6.1.2.1.2.2.1.16.1': {
    type: ASN1_TAGS.COUNTER32,
    value: 859402100, // ifOutOctets interfaz 1
  },
};

export function startMockSnmpServer(port: number = 16100): dgram.Socket {
  const socket = dgram.createSocket('udp4');

  socket.on('message', (msg, rinfo) => {
    try {
      const decoded = SnmpCodec.decodeMessage(msg);

      if (decoded.pduType === ASN1_TAGS.GET_REQUEST) {
        const responseVarbinds: SnmpVarBind[] = decoded.varbinds.map((vb) => {
          const entry = MOCK_MIB[vb.oid];
          if (entry) {
            return {
              oid: vb.oid,
              type: entry.type,
              value: entry.value,
            };
          } else {
            // OID no encontrado
            return {
              oid: vb.oid,
              type: ASN1_TAGS.NULL,
              value: null,
            };
          }
        });

        const responsePacket = SnmpCodec.encodeMessage({
          version: decoded.version,
          community: decoded.community,
          pduType: ASN1_TAGS.GET_RESPONSE,
          requestId: decoded.requestId,
          errorStatus: 0,
          errorIndex: 0,
          varbinds: responseVarbinds,
        });

        socket.send(responsePacket, rinfo.port, rinfo.address, (err) => {
          if (err) {
            console.error('Error enviando respuesta SNMP a', rinfo.address, err);
          } else {
            console.log(
              `[SNMP-Mock] Respondida consulta GetRequest (${decoded.varbinds.length} OIDs) a ${rinfo.address}:${rinfo.port}`
            );
          }
        });
      }
    } catch (err: any) {
      console.error('[SNMP-Mock] Error procesando paquete UDP entrante:', err.message);
    }
  });

  socket.on('error', (err) => {
    console.error('[SNMP-Mock] Error de socket UDP:', err);
  });

  socket.bind(port, () => {
    console.log(`[SNMP-Mock] Agente SNMP simulado escuchando en UDP 0.0.0.0:${port}`);
  });

  return socket;
}
