import { SnmpCodec, ASN1_TAGS } from './snmp-codec';
import assert from 'assert';

console.log('--- Iniciando Pruebas Unitarias del Codec BER/ASN.1 SNMP ---');

// Test 1: Enteros ASN.1
const encZero = SnmpCodec.encodeInteger(0);
assert.deepStrictEqual(Array.from(encZero), [0x02, 0x01, 0x00], 'Error codificando entero 0');

const encPositive = SnmpCodec.encodeInteger(128);
// 128 requiere padding 0x00 para no interpretarse como negativo en complemento a dos
assert.deepStrictEqual(Array.from(encPositive), [0x02, 0x02, 0x00, 0x80], 'Error codificando entero 128');

// Test 2: OID Encoding
// 1.3.6.1.2.1.1.1.0 -> 1*40 + 3 = 43 (0x2b), 6, 1, 2, 1, 1, 1, 0
const encOid = SnmpCodec.encodeOid('1.3.6.1.2.1.1.1.0');
assert.strictEqual(encOid[0], ASN1_TAGS.OBJECT_IDENTIFIER);
assert.strictEqual(encOid[2], 0x2b); // 1.3
console.log('✓ Codificación de enteros y OID verificada');

// Test 3: GetRequest PDU completo
const reqPacket = SnmpCodec.encodeMessage({
  version: 1, // v2c
  community: 'public',
  pduType: ASN1_TAGS.GET_REQUEST,
  requestId: 1042,
  errorStatus: 0,
  errorIndex: 0,
  varbinds: [
    { oid: '1.3.6.1.2.1.1.1.0', value: null },
    { oid: '1.3.6.1.2.1.1.3.0', value: null },
    { oid: '1.3.6.1.2.1.1.5.0', value: null },
  ],
});

// Test 4: Decodificación del paquete generado
const decodedReq = SnmpCodec.decodeMessage(reqPacket);
assert.strictEqual(decodedReq.version, 1);
assert.strictEqual(decodedReq.community, 'public');
assert.strictEqual(decodedReq.pduType, ASN1_TAGS.GET_REQUEST);
assert.strictEqual(decodedReq.requestId, 1042);
assert.strictEqual(decodedReq.varbinds.length, 3);
assert.strictEqual(decodedReq.varbinds[0].oid, '1.3.6.1.2.1.1.1.0');
assert.strictEqual(decodedReq.varbinds[1].oid, '1.3.6.1.2.1.1.3.0');
assert.strictEqual(decodedReq.varbinds[2].oid, '1.3.6.1.2.1.1.5.0');
console.log('✓ Codificación y decodificación de GetRequest PDU verificada');

// Test 5: GetResponse PDU con datos de MIB
const resPacket = SnmpCodec.encodeMessage({
  version: 1,
  community: 'public',
  pduType: ASN1_TAGS.GET_RESPONSE,
  requestId: 1042,
  errorStatus: 0,
  errorIndex: 0,
  varbinds: [
    { oid: '1.3.6.1.2.1.1.1.0', type: ASN1_TAGS.OCTET_STRING, value: 'Switch Cisco 2960' },
    { oid: '1.3.6.1.2.1.1.3.0', type: ASN1_TAGS.TIMETICKS, value: 5432100 },
    { oid: '1.3.6.1.2.1.1.5.0', type: ASN1_TAGS.OCTET_STRING, value: 'SW-CORE-01' },
    { oid: '1.3.6.1.2.1.2.2.1.10.1', type: ASN1_TAGS.COUNTER32, value: 987654321 },
  ],
});

const decodedRes = SnmpCodec.decodeMessage(resPacket);
assert.strictEqual(decodedRes.pduType, ASN1_TAGS.GET_RESPONSE);
assert.strictEqual(decodedRes.varbinds[0].value, 'Switch Cisco 2960');
assert.strictEqual(decodedRes.varbinds[1].value, 5432100);
assert.strictEqual(decodedRes.varbinds[2].value, 'SW-CORE-01');
assert.strictEqual(decodedRes.varbinds[3].value, 987654321);
console.log('✓ Decodificación de GetResponse con tipos OctetString, TimeTicks y Counter32 verificada exitosamente');

console.log('--- Todas las pruebas del Codec SNMP pasaron correctamente (5/5) ---');
