import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { THEME } from '../styles/theme';
import { LocalDatabase } from '../storage/LocalDatabase';
import { InstallationEvidence } from '../types';

export const HistoryScreen: React.FC = () => {
  const [tab, setTab] = useState<'installations' | 'diagnostics'>('installations');
  const [installations, setInstallations] = useState<InstallationEvidence[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const unsub = LocalDatabase.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const loadData = () => {
    setInstallations(LocalDatabase.getInstallations());
    setDiagnostics(LocalDatabase.getDiagnostics());
  };

  const renderInstallationItem = ({ item }: { item: InstallationEvidence }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.siteName}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: item.synced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: item.synced ? '#34d399' : '#fbbf24' },
            ]}
          >
            {item.synced ? 'SINCRONIZADO' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <Text style={styles.dateText}>{new Date(item.installedAt).toLocaleString()}</Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Técnico:</Text>
        <Text style={styles.detailValue}>{item.technicianName}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Equipo / IP:</Text>
        <Text style={styles.detailValue}>{item.deviceIp || item.deviceId || 'N/A'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>GPS:</Text>
        <Text style={styles.detailValue}>
          {item.latitude ? `${item.latitude.toFixed(5)}, ${item.longitude?.toFixed(5)}` : 'Sin GPS'}
        </Text>
      </View>

      {item.pdfPath && (
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={() => Alert.alert('Reporte PDF', `Archivo almacenado en:\n${item.pdfPath}`)}
        >
          <Text style={styles.pdfButtonText}>📄 Ver Ruta del Reporte PDF</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDiagnosticItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.protoBadge}>
          <Text style={styles.protoText}>{item.protocol}</Text>
        </View>
        <Text style={styles.dateText}>{new Date(item.executedAt).toLocaleString()}</Text>
      </View>

      <Text style={styles.targetIp}>Destino: {item.targetIp}</Text>
      <Text style={styles.commandText}>Comando/OID: {item.commandOrOid}</Text>

      <View style={styles.resultBox}>
        <Text style={styles.resultPayload} numberOfLines={4}>
          {typeof item.resultPayload === 'object'
            ? JSON.stringify(item.resultPayload, null, 2)
            : String(item.resultPayload)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'installations' && styles.tabActive]}
          onPress={() => setTab('installations')}
        >
          <Text style={[styles.tabText, tab === 'installations' && styles.tabTextActive]}>
            Instalaciones ({installations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'diagnostics' && styles.tabActive]}
          onPress={() => setTab('diagnostics')}
        >
          <Text style={[styles.tabText, tab === 'diagnostics' && styles.tabTextActive]}>
            Diagnósticos ({diagnostics.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'installations' ? (
        <FlatList
          data={installations}
          keyExtractor={(item) => item.id}
          renderItem={renderInstallationItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay instalaciones guardadas offline.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={diagnostics}
          keyExtractor={(item) => item.id}
          renderItem={renderDiagnosticItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay diagnósticos registrados.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: THEME.colors.primaryText,
  },
  listContent: {
    padding: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  dateText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  detailLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    width: 80,
  },
  detailValue: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  pdfButton: {
    marginTop: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  pdfButtonText: {
    fontSize: 11,
    color: THEME.colors.primaryText,
    fontWeight: '600',
  },
  protoBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  protoText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  targetIp: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
    marginTop: 4,
  },
  commandText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  resultBox: {
    backgroundColor: THEME.colors.terminalBg,
    borderRadius: 4,
    padding: 8,
    marginTop: 6,
  },
  resultPayload: {
    color: THEME.colors.terminalText,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    padding: THEME.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSize.sm,
  },
});
