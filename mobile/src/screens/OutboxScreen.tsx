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
import NetInfo from '@react-native-community/netinfo';
import { THEME } from '../styles/theme';
import { LocalDatabase } from '../storage/LocalDatabase';
import { SyncService } from '../storage/SyncService';
import { OutboxItem } from '../types';

export const OutboxScreen: React.FC = () => {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [backendUrl, setBackendUrl] = useState(SyncService.getBackendUrl());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    // Escuchar cambios en la base local
    setItems(LocalDatabase.getAllOutbox());
    const unsubDb = LocalDatabase.subscribe(() => {
      setItems(LocalDatabase.getAllOutbox());
    });

    // Escuchar conectividad de red
    const unsubNet = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });

    // Escuchar estado de sincronización
    const unsubSync = SyncService.onSyncStateChange((isSync) => {
      setSyncing(isSync);
    });

    return () => {
      unsubDb();
      unsubNet();
      unsubSync();
    };
  }, []);

  const handleSyncNow = async () => {
    SyncService.setBackendUrl(backendUrl);
    setSyncing(true);
    const result = await SyncService.syncPendingOutbox();
    setSyncing(false);

    if (result.success) {
      Alert.alert('Sincronización completada', `Se sincronizaron ${result.processed} elementos con éxito.`);
    } else {
      Alert.alert(
        'Fallo de sincronización',
        'No se pudo conectar con el backend. Los elementos se mantendrán encolados para el próximo reintento automático.'
      );
    }
  };

  const renderItem = ({ item }: { item: OutboxItem }) => {
    const getBadgeStyle = () => {
      switch (item.status) {
        case 'synced':
          return { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', label: 'SINCRONIZADO' };
        case 'syncing':
          return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', label: 'ENVIANDO...' };
        case 'failed':
          return { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: `FALLÓ (${item.retryCount} INT)` };
        default:
          return { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', label: 'PENDIENTE' };
      }
    };

    const badge = getBadgeStyle();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemType}>{item.type.toUpperCase()}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.itemId}>ID: {item.id}</Text>
        <Text style={styles.itemDate}>Creado: {new Date(item.createdAt).toLocaleString()}</Text>

        {item.type === 'installation' && item.payload && (
          <Text style={styles.itemSummary}>
            Sitio: {item.payload.siteName} | Técnico: {item.payload.technicianName}
          </Text>
        )}

        {item.type === 'diagnostic' && item.payload && (
          <Text style={styles.itemSummary}>
            {item.payload.protocol} hacia {item.payload.targetIp} ({item.payload.commandOrOid})
          </Text>
        )}

        {item.type === 'device' && item.payload && (
          <Text style={styles.itemSummary}>
            Equipo {item.payload.ip} ({item.payload.vendor || 'LAN'})
          </Text>
        )}

        {item.lastError && (
          <Text style={styles.errorText}>Último error: {item.lastError}</Text>
        )}
      </View>
    );
  };

  const pendingCount = items.filter((i) => i.status !== 'synced').length;

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <View style={styles.statusRow}>
          <Text style={styles.title}>Cola Offline-First (Outbox)</Text>
          <View
            style={[
              styles.netStatusPill,
              { backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' },
            ]}
          >
            <Text
              style={[
                styles.netStatusText,
                { color: isOnline ? '#34d399' : '#f87171' },
              ]}
            >
              {isOnline ? '● Online (Conectado)' : '○ Offline (Sin Red)'}
            </Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Patrón Outbox: las acciones se registran localmente y se transmiten al backend al recuperar conectividad.
        </Text>

        <View style={styles.urlRow}>
          <TextInput
            style={styles.urlInput}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://10.0.2.2:3000"
            placeholderTextColor={THEME.colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.syncButton, (syncing || pendingCount === 0) && styles.buttonDisabled]}
            onPress={handleSyncNow}
            disabled={syncing || pendingCount === 0}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Sincronizar ({pendingCount})</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>La cola Outbox está vacía.</Text>
            <Text style={styles.emptySubtext}>
              Cuando registre instalaciones o diagnósticos sin conexión, aparecerán encolados aquí.
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  netStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  netStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textMuted,
    marginTop: 4,
    marginBottom: THEME.spacing.sm,
  },
  urlRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  urlInput: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.sm,
    fontSize: 11,
    height: 38,
    fontFamily: 'monospace',
  },
  syncButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
  itemType: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryText,
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
  itemId: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontFamily: 'monospace',
  },
  itemDate: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  itemSummary: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '500',
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    color: THEME.colors.danger,
    marginTop: 4,
  },
  emptyContainer: {
    padding: THEME.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSize.md,
    fontWeight: '600',
  },
  emptySubtext: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
  },
});
