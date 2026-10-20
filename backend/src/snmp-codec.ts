/**
 * Network Diagnostics Suite - BER/ASN.1 SNMP v1/v2c Codec
 * 
 * Implementación de codificación y decodificación para el subconjunto de
 * SNMP necesario en diagnósticos de campo:
 *  - Tipos ASN.1: INTEGER (0x02), OCTET STRING (0x04), NULL (0x05),
 *    OBJECT IDENTIFIER (0x06), SEQUENCE (0x30), IpAddress (0x40),
 *    Counter32 (0x41), Gauge32 (0x42), TimeTicks (0x43).
 *  - PDUs: GetRequest (0xA0), GetNextRequest (0xA1), GetResponse (0xA2).
 */

export const ASN1_TAGS = {
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OBJECT_IDENTIFIER: 0x06,
  SEQUENCE: 0x30,
  IP_ADDRESS: 0x40,
  COUNTER32: 0x41,
  GAUGE32: 0x42,
  TIMETICKS: 0x43,
  GET_REQUEST: 0xa0,
  GET_NEXT_REQUEST: 0xa1,
  GET_RESPONSE: 0xa2,
} as const;

export interface SnmpVarBind {
  oid: string;
  type?: number;
  value: any;
}

export interface SnmpMessage {
  version: number; // 0 = v1, 1 = v2c
  community: string;
  pduType: number;
  requestId: number;
  errorStatus: number;
  errorIndex: number;
  varbinds: SnmpVarBind[];
}

export class SnmpCodec {
  /**
   * Codifica un entero ASN.1
   */
  public static encodeInteger(value: number): Buffer {
    if (value === 0) {
      return Buffer.from([ASN1_TAGS.INTEGER, 0x01, 0x00]);
    }
    const bytes: number[] = [];
    let temp = value;
    while (temp !== 0 && temp !== -1) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    // Asegurar padding de signo positivo si el bit más significativo es 1
    if (value > 0 && (bytes[0] & 0x80) !== 0) {
      bytes.unshift(0x00);
    } else if (value < 0 && (bytes[0] & 0x80) === 0) {
      bytes.unshift(0xff);
    }
    const lenBuffer = SnmpCodec.encodeLength(bytes.length);
    return Buffer.concat([
      Buffer.from([ASN1_TAGS.INTEGER]),
      lenBuffer,
      Buffer.from(bytes),
    ]);
  }

  /**
   * Codifica un OCTET STRING
   */
  public static encodeOctetString(str: string | Buffer): Buffer {
    const buf = typeof str === 'string' ? Buffer.from(str, 'utf8') : str;
    const len = SnmpCodec.encodeLength(buf.length);
    return Buffer.concat([Buffer.from([ASN1_TAGS.OCTET_STRING]), len, buf]);
  }

  /**
   * Codifica un valor NULL
   */
  public static encodeNull(): Buffer {
    return Buffer.from([ASN1_TAGS.NULL, 0x00]);
  }

  /**
   * Codifica un OID en formato string (ej: "1.3.6.1.2.1.1.1.0") a bytes BER
   */
  public static encodeOid(oidStr: string): Buffer {
    const parts = oidStr.split('.').map((p) => parseInt(p, 10));
    if (parts.length < 2) {
      throw new Error(`OID inválido: ${oidStr}`);
    }

    const bytes: number[] = [];
    // Primer byte combina los dos primeros números: (X * 40) + Y
    bytes.push(parts[0] * 40 + parts[1]);

    for (let i = 2; i < parts.length; i++) {
      let val = parts[i];
      if (val < 128) {
        bytes.push(val);
      } else {
        const subBytes: number[] = [];
        subBytes.push(val & 0x7f);
        val = val >>> 7;
        while (val > 0) {
          subBytes.unshift((val & 0x7f) | 0x80);
          val = val >>> 7;
        }
        bytes.push(...subBytes);
      }
    }

    const len = SnmpCodec.encodeLength(bytes.length);
    return Buffer.concat([
      Buffer.from([ASN1_TAGS.OBJECT_IDENTIFIER]),
      len,
      Buffer.from(bytes),
    ]);
  }

  /**
   * Codifica la longitud BER
   */
  public static encodeLength(length: number): Buffer {
    if (length < 128) {
      return Buffer.from([length]);
    }
    const bytes: number[] = [];
    let temp = length;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >>> 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  /**
   * Codifica una secuencia genérica con una etiqueta
   */
  public static encodeSequenceWithTag(tag: number, payload: Buffer): Buffer {
    const len = SnmpCodec.encodeLength(payload.length);
    return Buffer.concat([Buffer.from([tag]), len, payload]);
  }

  /**
   * Construye un paquete SNMP completo (GetRequest o GetResponse)
   */
  public static encodeMessage(msg: SnmpMessage): Buffer {
    // 1. Codificar VarBinds
    const varbindBuffers: Buffer[] = [];
    for (const vb of msg.varbinds) {
      const oidBuf = SnmpCodec.encodeOid(vb.oid);
      let valBuf: Buffer;

      if (vb.value === null || vb.value === undefined) {
        valBuf = SnmpCodec.encodeNull();
      } else if (vb.type === ASN1_TAGS.INTEGER) {
        valBuf = SnmpCodec.encodeInteger(vb.value);
      } else if (vb.type === ASN1_TAGS.TIMETICKS) {
        valBuf = SnmpCodec.encodeSequenceWithTag(
          ASN1_TAGS.TIMETICKS,
          SnmpCodec.encodeRawUint32(vb.value)
        );
      } else if (vb.type === ASN1_TAGS.COUNTER32) {
        valBuf = SnmpCodec.encodeSequenceWithTag(
          ASN1_TAGS.COUNTER32,
          SnmpCodec.encodeRawUint32(vb.value)
        );
      } else if (vb.type === ASN1_TAGS.IP_ADDRESS) {
        const ipBytes = vb.value.split('.').map((n: string) => parseInt(n, 10));
        valBuf = Buffer.concat([
          Buffer.from([ASN1_TAGS.IP_ADDRESS, 0x04]),
          Buffer.from(ipBytes),
        ]);
      } else {
        valBuf = SnmpCodec.encodeOctetString(String(vb.value));
      }

      const vbSeq = SnmpCodec.encodeSequenceWithTag(
        ASN1_TAGS.SEQUENCE,
        Buffer.concat([oidBuf, valBuf])
      );
      varbindBuffers.push(vbSeq);
    }

    const varbindListBuf = SnmpCodec.encodeSequenceWithTag(
      ASN1_TAGS.SEQUENCE,
      Buffer.concat(varbindBuffers)
    );

    // 2. Codificar PDU
    const pduPayload = Buffer.concat([
      SnmpCodec.encodeInteger(msg.requestId),
      SnmpCodec.encodeInteger(msg.errorStatus || 0),
      SnmpCodec.encodeInteger(msg.errorIndex || 0),
      varbindListBuf,
    ]);

    const pduBuf = SnmpCodec.encodeSequenceWithTag(msg.pduType, pduPayload);

    // 3. Codificar Mensaje Completo: SEQUENCE { version, community, PDU }
    const versionBuf = SnmpCodec.encodeInteger(msg.version);
    const commBuf = SnmpCodec.encodeOctetString(msg.community);

    return SnmpCodec.encodeSequenceWithTag(
      ASN1_TAGS.SEQUENCE,
      Buffer.concat([versionBuf, commBuf, pduBuf])
    );
  }

  private static encodeRawUint32(val: number): Buffer {
    const bytes: number[] = [];
    let temp = val >>> 0;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >>> 8;
    }
    if (bytes.length === 0) bytes.push(0);
    if ((bytes[0] & 0x80) !== 0) bytes.unshift(0x00);
    return Buffer.from(bytes);
  }

  /**
   * Decodifica un paquete SNMP en formato binario
   */
  public static decodeMessage(buffer: Buffer): SnmpMessage {
    let offset = 0;

    // Verificar cabecera SEQUENCE
    const outerTag = buffer[offset++];
    if (outerTag !== ASN1_TAGS.SEQUENCE) {
      throw new Error(`Tag inválido en paquete SNMP: 0x${outerTag.toString(16)}`);
    }
    const [outerLen, outerLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += outerLenBytes;

    // 1. Versión
    if (buffer[offset++] !== ASN1_TAGS.INTEGER) throw new Error('Esperaba INTEGER para versión SNMP');
    const [verLen, verLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += verLenBytes;
    const version = SnmpCodec.decodeInteger(buffer, offset, verLen);
    offset += verLen;

    // 2. Community
    if (buffer[offset++] !== ASN1_TAGS.OCTET_STRING) throw new Error('Esperaba OCTET STRING para community');
    const [commLen, commLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += commLenBytes;
    const community = buffer.slice(offset, offset + commLen).toString('utf8');
    offset += commLen;

    // 3. PDU
    const pduType = buffer[offset++];
    const [pduLen, pduLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += pduLenBytes;

    // Request ID
    if (buffer[offset++] !== ASN1_TAGS.INTEGER) throw new Error('Esperaba INTEGER para Request ID');
    const [reqLen, reqLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += reqLenBytes;
    const requestId = SnmpCodec.decodeInteger(buffer, offset, reqLen);
    offset += reqLen;

    // Error Status
    if (buffer[offset++] !== ASN1_TAGS.INTEGER) throw new Error('Esperaba INTEGER para Error Status');
    const [errLen, errLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += errLenBytes;
    const errorStatus = SnmpCodec.decodeInteger(buffer, offset, errLen);
    offset += errLen;

    // Error Index
    if (buffer[offset++] !== ASN1_TAGS.INTEGER) throw new Error('Esperaba INTEGER para Error Index');
    const [idxLen, idxLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += idxLenBytes;
    const errorIndex = SnmpCodec.decodeInteger(buffer, offset, idxLen);
    offset += idxLen;

    // VarBind List
    if (buffer[offset++] !== ASN1_TAGS.SEQUENCE) throw new Error('Esperaba SEQUENCE para VarBindList');
    const [vbListLen, vbListLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += vbListLenBytes;

    const varbinds: SnmpVarBind[] = [];
    const endVbList = offset + vbListLen;

    while (offset < endVbList) {
      if (buffer[offset++] !== ASN1_TAGS.SEQUENCE) break;
      const [vbLen, vbLenBytes] = SnmpCodec.decodeLength(buffer, offset);
      offset += vbLenBytes;
      const endVb = offset + vbLen;

      // OID
      if (buffer[offset++] !== ASN1_TAGS.OBJECT_IDENTIFIER) break;
      const [oidLen, oidLenBytes] = SnmpCodec.decodeLength(buffer, offset);
      offset += oidLenBytes;
      const oid = SnmpCodec.decodeOid(buffer.slice(offset, offset + oidLen));
      offset += oidLen;

      // Value
      const valTag = buffer[offset++];
      const [valLen, valLenBytes] = SnmpCodec.decodeLength(buffer, offset);
      offset += valLenBytes;

      let value: any = null;
      if (valTag === ASN1_TAGS.NULL) {
        value = null;
      } else if (valTag === ASN1_TAGS.INTEGER) {
        value = SnmpCodec.decodeInteger(buffer, offset, valLen);
      } else if (valTag === ASN1_TAGS.OCTET_STRING) {
        value = buffer.slice(offset, offset + valLen).toString('utf8');
      } else if (valTag === ASN1_TAGS.TIMETICKS || valTag === ASN1_TAGS.COUNTER32 || valTag === ASN1_TAGS.GAUGE32) {
        let n = 0;
        for (let i = 0; i < valLen; i++) {
          n = (n << 8) | buffer[offset + i];
        }
        value = n >>> 0;
      } else if (valTag === ASN1_TAGS.IP_ADDRESS) {
        const ipParts: number[] = [];
        for (let i = 0; i < valLen; i++) {
          ipParts.push(buffer[offset + i]);
        }
        value = ipParts.join('.');
      } else {
        value = buffer.slice(offset, offset + valLen);
      }

      offset = endVb;
      varbinds.push({ oid, type: valTag, value });
    }

    return {
      version,
      community,
      pduType,
      requestId,
      errorStatus,
      errorIndex,
      varbinds,
    };
  }

  private static decodeLength(buffer: Buffer, offset: number): [number, number] {
    const first = buffer[offset];
    if ((first & 0x80) === 0) {
      return [first, 1];
    }
    const numBytes = first & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buffer[offset + 1 + i];
    }
    return [length, 1 + numBytes];
  }

  private static decodeInteger(buffer: Buffer, offset: number, len: number): number {
    let result = 0;
    const isNegative = (buffer[offset] & 0x80) !== 0;
    for (let i = 0; i < len; i++) {
      result = (result << 8) | buffer[offset + i];
    }
    if (isNegative) {
      result = result - (1 << (len * 8));
    }
    return result;
  }

  private static decodeOid(buffer: Buffer): string {
    if (buffer.length === 0) return '';
    const first = buffer[0];
    const parts = [Math.floor(first / 40), first % 40];

    let current = 0;
    for (let i = 1; i < buffer.length; i++) {
      const b = buffer[i];
      current = (current << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) {
        parts.push(current);
        current = 0;
      }
    }
    return parts.join('.');
  }
}
