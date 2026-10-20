/**
 * Codec BER/ASN.1 simplificado para SNMP v1/v2c en React Native.
 * Implementado en puro TypeScript con Uint8Array, compatible con Hermes y JSC.
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
  public static encodeInteger(value: number): Uint8Array {
    if (value === 0) {
      return new Uint8Array([ASN1_TAGS.INTEGER, 0x01, 0x00]);
    }
    const bytes: number[] = [];
    let temp = value;
    while (temp !== 0 && temp !== -1) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    if (value > 0 && (bytes[0] & 0x80) !== 0) {
      bytes.unshift(0x00);
    } else if (value < 0 && (bytes[0] & 0x80) === 0) {
      bytes.unshift(0xff);
    }
    const len = SnmpCodec.encodeLength(bytes.length);
    return SnmpCodec.concat([new Uint8Array([ASN1_TAGS.INTEGER]), len, new Uint8Array(bytes)]);
  }

  public static encodeOctetString(str: string): Uint8Array {
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);
    const len = SnmpCodec.encodeLength(strBytes.length);
    return SnmpCodec.concat([new Uint8Array([ASN1_TAGS.OCTET_STRING]), len, strBytes]);
  }

  public static encodeNull(): Uint8Array {
    return new Uint8Array([ASN1_TAGS.NULL, 0x00]);
  }

  public static encodeOid(oidStr: string): Uint8Array {
    const parts = oidStr.split('.').map((p) => parseInt(p, 10));
    if (parts.length < 2) {
      throw new Error(`OID inválido: ${oidStr}`);
    }

    const bytes: number[] = [];
    bytes.push(parts[0] * 40 + parts[1]);

    for (let i = 2; i < parts.length; i++) {
      let val = parts[i];
      if (val < 128) {
        bytes.push(val);
      } else {
        const sub: number[] = [];
        sub.push(val & 0x7f);
        val = val >>> 7;
        while (val > 0) {
          sub.unshift((val & 0x7f) | 0x80);
          val = val >>> 7;
        }
        bytes.push(...sub);
      }
    }

    const len = SnmpCodec.encodeLength(bytes.length);
    return SnmpCodec.concat([
      new Uint8Array([ASN1_TAGS.OBJECT_IDENTIFIER]),
      len,
      new Uint8Array(bytes),
    ]);
  }

  public static encodeLength(length: number): Uint8Array {
    if (length < 128) {
      return new Uint8Array([length]);
    }
    const bytes: number[] = [];
    let temp = length;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >>> 8;
    }
    return new Uint8Array([0x80 | bytes.length, ...bytes]);
  }

  public static encodeSequence(tag: number, payload: Uint8Array): Uint8Array {
    const len = SnmpCodec.encodeLength(payload.length);
    return SnmpCodec.concat([new Uint8Array([tag]), len, payload]);
  }

  public static encodeMessage(msg: SnmpMessage): Uint8Array {
    const varbindBuffers: Uint8Array[] = [];

    for (const vb of msg.varbinds) {
      const oidBuf = SnmpCodec.encodeOid(vb.oid);
      const valBuf = vb.value === null || vb.value === undefined ? SnmpCodec.encodeNull() : SnmpCodec.encodeOctetString(String(vb.value));
      const vbSeq = SnmpCodec.encodeSequence(ASN1_TAGS.SEQUENCE, SnmpCodec.concat([oidBuf, valBuf]));
      varbindBuffers.push(vbSeq);
    }

    const varbindList = SnmpCodec.encodeSequence(ASN1_TAGS.SEQUENCE, SnmpCodec.concat(varbindBuffers));

    const pduPayload = SnmpCodec.concat([
      SnmpCodec.encodeInteger(msg.requestId),
      SnmpCodec.encodeInteger(msg.errorStatus || 0),
      SnmpCodec.encodeInteger(msg.errorIndex || 0),
      varbindList,
    ]);

    const pdu = SnmpCodec.encodeSequence(msg.pduType, pduPayload);
    const versionBuf = SnmpCodec.encodeInteger(msg.version);
    const commBuf = SnmpCodec.encodeOctetString(msg.community);

    return SnmpCodec.encodeSequence(ASN1_TAGS.SEQUENCE, SnmpCodec.concat([versionBuf, commBuf, pdu]));
  }

  public static decodeMessage(buffer: Uint8Array): SnmpMessage {
    let offset = 0;

    const outerTag = buffer[offset++];
    if (outerTag !== ASN1_TAGS.SEQUENCE) {
      throw new Error(`Tag de secuencia principal inválido: 0x${outerTag.toString(16)}`);
    }
    const [, outerLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += outerLenBytes;

    // Versión
    if (buffer[offset++] !== ASN1_TAGS.INTEGER) throw new Error('Esperaba INTEGER para versión');
    const [verLen, verLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += verLenBytes;
    const version = SnmpCodec.decodeInteger(buffer, offset, verLen);
    offset += verLen;

    // Community
    if (buffer[offset++] !== ASN1_TAGS.OCTET_STRING) throw new Error('Esperaba OCTET STRING para community');
    const [commLen, commLenBytes] = SnmpCodec.decodeLength(buffer, offset);
    offset += commLenBytes;
    const decoder = new TextDecoder();
    const community = decoder.decode(buffer.subarray(offset, offset + commLen));
    offset += commLen;

    // PDU
    const pduType = buffer[offset++];
    const [, pduLenBytes] = SnmpCodec.decodeLength(buffer, offset);
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

    // VarBindList
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

      if (buffer[offset++] !== ASN1_TAGS.OBJECT_IDENTIFIER) break;
      const [oidLen, oidLenBytes] = SnmpCodec.decodeLength(buffer, offset);
      offset += oidLenBytes;
      const oid = SnmpCodec.decodeOid(buffer.subarray(offset, offset + oidLen));
      offset += oidLen;

      const valTag = buffer[offset++];
      const [valLen, valLenBytes] = SnmpCodec.decodeLength(buffer, offset);
      offset += valLenBytes;

      let value: any = null;
      if (valTag === ASN1_TAGS.NULL) {
        value = null;
      } else if (valTag === ASN1_TAGS.INTEGER) {
        value = SnmpCodec.decodeInteger(buffer, offset, valLen);
      } else if (valTag === ASN1_TAGS.OCTET_STRING) {
        value = decoder.decode(buffer.subarray(offset, offset + valLen));
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
        value = buffer.subarray(offset, offset + valLen);
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

  private static decodeLength(buffer: Uint8Array, offset: number): [number, number] {
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

  private static decodeInteger(buffer: Uint8Array, offset: number, len: number): number {
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

  private static decodeOid(buffer: Uint8Array): string {
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

  private static concat(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}
