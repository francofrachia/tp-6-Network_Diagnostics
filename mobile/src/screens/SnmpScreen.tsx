import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { THEME } from '../styles/theme';
import { SnmpClient } from '../protocols/snmp/SnmpClient';
import { SnmpQueryResult } from '../types';
import { LocalDatabase } from '../storage/LocalDatabase';

interface Props {
  route?: any;
}

export const SnmpScreen: React.FC<Props> = ({ route }) => {
  const initialIp = route?.params?.targetIp || '192.168.1.1';
  const [targetIp, setTargetIp] = useState(initialIp);
  const [port, setPort] = useState('161');
  const [community, setCommunity] = useState('public');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnmpQueryResult | null>(null);

  useEffect(() => {
    if (route?.params?.targetIp) {
      setTargetIp(route.params.targetIp);
    }
  }, [route?.params?.targetIp]);

  const handleQuery = async () => {
    if (!targetIp.trim()) {
      Alert.alert('Validación', 'Por favor ingrese la dirección IP del equipo.');
      return;
    }

    setLoading(true);
    try {
      const portNum = parseInt(port, 10) || 161;
      const res = await SnmpClient.queryDevice(targetIp.trim(), portNum, community.trim(), 4000);
      setResult(res);

      // Guardar diagnóstico en base de datos local y encolar en Outbox
      const diagRecord = LocalDatabase.saveDiagnostic(
        'SNMP',
        targetIp,
        'MIB-II (sysDescr, sysName, sysUpTime, ifOctets)',
        res
      );
      LocalDatabase.enqueueOutbox('diagnostic', diagRecord, 'create');
    } catch (err: any) {
      Alert.alert('Error SNMP', err.message || 'No se recibió respuesta del agente SNMP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Consulta SNMP v1/v2c (PDU BER/ASN.1)</Text>
        <Text style={styles.cardSubtitle}>
          Construcción de GetRequest manual y parser propio de OIDs MIB-II (1.3.6.1.2.1.1.x)
        </Text>

        <View style={styles.formRow}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>IP Destino</Text>
            <TextInput
              style={styles.input}
              value={targetIp}
              onChangeText={setTargetIp}
              placeholder="192.168.1.1"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Puerto UDP</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              keyboardType="numeric"
              placeholder="161"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        </View>

        <View style={{ marginTop: THEME.spacing.sm }}>
          <Text style={styles.label}>Community String</Text>
          <TextInput
            style={styles.input}
            value={community}
            onChangeText={setCommunity}
            placeholder="public"
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleQuery}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Consultar Agente SNMP</Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Resultado de Telemetría SNMP</Text>
              <Text style={styles.latencyBadge}>{result.latencyMs} ms</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Nombre del Sistema (sysName):</Text>
              <Text style={styles.metricValue}>{result.sysName || '-'}</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Tiempo de Actividad (sysUpTime):</Text>
              <Text style={[styles.metricValue, { color: THEME.colors.success }]}>
                {result.sysUpTimeFormatted || `${result.sysUpTime} ticks`}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Descripción del Hardware/OS (sysDescr):</Text>
              <Text style={styles.metricValueSmall}>{result.sysDescr || '-'}</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Ubicación Física (sysLocation):</Text>
              <Text style={styles.metricValue}>{result.sysLocation || '-'}</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Contacto Técnico (sysContact):</Text>
              <Text style={styles.metricValue}>{result.sysContact || '-'}</Text>
            </View>
          </View>

          <View style={styles.trafficGrid}>
            <View style={styles.trafficCard}>
              <Text style={styles.trafficTitle}>Tráfico Entrada (ifInOctets)</Text>
              <Text style={styles.trafficValue}>
                {result.ifInOctets ? `${(result.ifInOctets / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
              </Text>
              <Text style={styles.trafficSub}>OID: 1.3.6.1.2.1.2.2.1.10.1</Text>
            </View>

            <View style={styles.trafficCard}>
              <Text style={styles.trafficTitle}>Tráfico Salida (ifOutOctets)</Text>
              <Text style={styles.trafficValue}>
                {result.ifOutOctets ? `${(result.ifOutOctets / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
              </Text>
              <Text style={styles.trafficSub}>OID: 1.3.6.1.2.1.2.2.1.16.1</Text>
            </View>
          </View>

          <View style={styles.rawTableCard}>
            <Text style={styles.rawTableTitle}>VarBinds Decodificados (ASN.1)</Text>
            {result.rawMetrics.map((m, idx) => (
              <View key={idx} style={styles.varbindRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vbName}>{m.name}</Text>
                  <Text style={styles.vbOid}>{m.oid}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.vbVal}>{String(m.value)}</Text>
                  <Text style={styles.vbType}>{m.type}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  cardSubtitle: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textMuted,
    marginTop: 2,
    marginBottom: THEME.spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  label: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.sm,
    fontSize: THEME.fontSize.sm,
    height: 40,
  },
  button: {
    backgroundColor: THEME.colors.primary,
    marginTop: THEME.spacing.md,
    height: 42,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: THEME.fontSize.sm,
  },
  resultsContainer: {
    gap: THEME.spacing.md,
  },
  summaryCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: THEME.spacing.xs,
  },
  summaryTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.primaryText,
  },
  latencyBadge: {
    backgroundColor: '#064e3b',
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metricItem: {
    marginBottom: THEME.spacing.xs,
  },
  metricLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  metricValue: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  metricValueSmall: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  trafficGrid: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  trafficCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  trafficTitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  trafficValue: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.accent,
    marginVertical: 4,
  },
  trafficSub: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontFamily: 'monospace',
  },
  rawTableCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  rawTableTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  varbindRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  vbName: {
    color: THEME.colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  vbOid: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  vbVal: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  vbType: {
    color: THEME.colors.accent,
    fontSize: 9,
  },
});
