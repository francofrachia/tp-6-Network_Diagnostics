import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { THEME } from '../styles/theme';
import { NetworkScanner } from '../discovery/NetworkScanner';
import { MdnsDiscovery } from '../discovery/MdnsDiscovery';
import { LocalDatabase } from '../storage/LocalDatabase';
import { DiscoveredDevice } from '../types';

interface Props {
  navigation: any;
}

export const DiscoveryScreen: React.FC<Props> = ({ navigation }) => {
  const [subnetPrefix, setSubnetPrefix] = useState('192.168.1');
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  useEffect(() => {
    // Cargar dispositivos previamente guardados
    const saved = LocalDatabase.getDevices();
    if (saved.length > 0) {
      setDevices(saved);
    }

    const unsubscribe = LocalDatabase.subscribe(() => {
      setDevices(LocalDatabase.getDevices());
    });
    return () => unsubscribe();
  }, []);

  const handleStartScan = async () => {
    setScanning(true);
    setScanProgress('Iniciando escaneo de subred y mDNS...');

    try {
      // Iniciar descubrimiento mDNS
      MdnsDiscovery.startDiscovery((mdnsDev) => {
        LocalDatabase.saveDevice(mdnsDev);
      });

      // Escaneo ARP/TCP sobre la subred
      await NetworkScanner.scanSubnet(subnetPrefix, 1, 20, (dev) => {
        LocalDatabase.saveDevice(dev);
        LocalDatabase.enqueueOutbox('device', dev, 'upsert');
      });

      setScanProgress('Escaneo finalizado con éxito.');
    } catch (err: any) {
      Alert.alert('Error de escaneo', err.message || 'No se pudo completar el escaneo de red.');
    } finally {
      setScanning(false);
      MdnsDiscovery.stopDiscovery();
    }
  };

  const renderItem = ({ item }: { item: DiscoveredDevice }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.ipContainer}>
          <Text style={styles.ipText}>{item.ip}</Text>
          {item.responseTimeMs !== undefined && (
            <Text style={styles.latencyText}>{item.responseTimeMs} ms</Text>
          )}
        </View>
        {item.isSnmpCapable && (
          <View style={styles.badgeSnmp}>
            <Text style={styles.badgeSnmpText}>SNMP OK</Text>
          </View>
        )}
      </View>

      <Text style={styles.hostnameText}>{item.hostname || 'Host sin nombre'}</Text>

      <View style={styles.detailsRow}>
        <Text style={styles.detailLabel}>MAC: </Text>
        <Text style={styles.detailValue}>{item.mac || 'N/A'}</Text>
      </View>

      <View style={styles.detailsRow}>
        <Text style={styles.detailLabel}>Fabricante: </Text>
        <Text style={styles.detailValue}>{item.vendor || 'Dispositivo de red'}</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Snmp', { targetIp: item.ip })}
        >
          <Text style={styles.actionButtonText}>Diagnóstico SNMP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.sshButton]}
          onPress={() => navigation.navigate('Ssh', { host: item.ip })}
        >
          <Text style={styles.actionButtonText}>Consola SSH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.installButton]}
          onPress={() => navigation.navigate('Installation', { deviceId: item.id, ip: item.ip })}
        >
          <Text style={styles.actionButtonText}>Instalar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Descubrimiento de Red</Text>
        <Text style={styles.subtitle}>Escaneo ARP/TCP sobre subred local y mDNS/Bonjour</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={subnetPrefix}
            onChangeText={setSubnetPrefix}
            placeholder="Subred (ej. 192.168.1)"
            placeholderTextColor={THEME.colors.textMuted}
            keyboardType="numeric"
            editable={!scanning}
          />
          <TouchableOpacity
            style={[styles.scanButton, scanning && styles.buttonDisabled]}
            onPress={handleStartScan}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.scanButtonText}>Escanear LAN</Text>
            )}
          </TouchableOpacity>
        </View>

        {scanning && <Text style={styles.progressText}>{scanProgress}</Text>}
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay dispositivos descubiertos en la lista.</Text>
            <Text style={styles.emptySubtext}>
              Ingrese la subred y presione "Escanear LAN" para encontrar equipos activos.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  headerBox: {
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  title: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  subtitle: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textMuted,
    marginTop: 2,
    marginBottom: THEME.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.sm,
    fontSize: THEME.fontSize.sm,
    height: 40,
  },
  scanButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: THEME.fontSize.sm,
  },
  progressText: {
    color: THEME.colors.accent,
    fontSize: THEME.fontSize.xs,
    marginTop: THEME.spacing.xs,
  },
  listContent: {
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  ipText: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.primaryText,
    fontFamily: 'monospace',
  },
  latencyText: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.success,
  },
  badgeSnmp: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: THEME.colors.success,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeSnmpText: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  hostnameText: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  detailLabel: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSize.xs,
  },
  detailValue: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.xs,
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
  },
  sshButton: {
    backgroundColor: '#374151',
  },
  installButton: {
    backgroundColor: '#065f46',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: THEME.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSize.xs,
    textAlign: 'center',
    marginTop: 6,
  },
});
