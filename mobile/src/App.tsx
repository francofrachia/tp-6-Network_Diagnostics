import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { THEME } from './styles/theme';
import { DiscoveryScreen } from './screens/DiscoveryScreen';
import { SnmpScreen } from './screens/SnmpScreen';
import { SshScreen } from './screens/SshScreen';
import { InstallationScreen } from './screens/InstallationScreen';
import { OutboxScreen } from './screens/OutboxScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SyncService } from './storage/SyncService';

type TabKey = 'discovery' | 'snmp' | 'ssh' | 'install' | 'outbox' | 'history';

export default function App(): React.JSX.Element {
  const [currentTab, setCurrentTab] = useState<TabKey>('discovery');
  const [navigationParams, setNavigationParams] = useState<Record<string, any>>({});

  useEffect(() => {
    // Inicializar observador de conectividad NetInfo para la sincronización Outbox diferida
    SyncService.init();
  }, []);

  const navigateTo = (tabName: string, params?: Record<string, any>) => {
    if (params) setNavigationParams(params);
    switch (tabName) {
      case 'Discovery':
        setCurrentTab('discovery');
        break;
      case 'Snmp':
        setCurrentTab('snmp');
        break;
      case 'Ssh':
        setCurrentTab('ssh');
        break;
      case 'Installation':
        setCurrentTab('install');
        break;
      case 'Outbox':
        setCurrentTab('outbox');
        break;
      case 'History':
        setCurrentTab('history');
        break;
    }
  };

  const navProxy = {
    navigate: navigateTo,
  };

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'discovery':
        return <DiscoveryScreen navigation={navProxy} />;
      case 'snmp':
        return <SnmpScreen route={{ params: navigationParams }} />;
      case 'ssh':
        return <SshScreen route={{ params: navigationParams }} />;
      case 'install':
        return <InstallationScreen navigation={navProxy} route={{ params: navigationParams }} />;
      case 'outbox':
        return <OutboxScreen />;
      case 'history':
        return <HistoryScreen />;
      default:
        return <DiscoveryScreen navigation={navProxy} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.surface} />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Network Diagnostics Suite</Text>
          <Text style={styles.topBarSubtitle}>Toolkit Móvil de Infraestructura de Telecomunicaciones</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Offline-First</Text>
        </View>
      </View>

      {/* Main Screen Body */}
      <View style={styles.body}>{renderCurrentScreen()}</View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'discovery' && styles.tabItemActive]}
          onPress={() => setCurrentTab('discovery')}
        >
          <Text style={[styles.tabIcon, currentTab === 'discovery' && styles.tabIconActive]}>📡</Text>
          <Text style={[styles.tabLabel, currentTab === 'discovery' && styles.tabLabelActive]}>Red</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'snmp' && styles.tabItemActive]}
          onPress={() => setCurrentTab('snmp')}
        >
          <Text style={[styles.tabIcon, currentTab === 'snmp' && styles.tabIconActive]}>📊</Text>
          <Text style={[styles.tabLabel, currentTab === 'snmp' && styles.tabLabelActive]}>SNMP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'ssh' && styles.tabItemActive]}
          onPress={() => setCurrentTab('ssh')}
        >
          <Text style={[styles.tabIcon, currentTab === 'ssh' && styles.tabIconActive]}>🔒</Text>
          <Text style={[styles.tabLabel, currentTab === 'ssh' && styles.tabLabelActive]}>SSH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'install' && styles.tabItemActive]}
          onPress={() => setCurrentTab('install')}
        >
          <Text style={[styles.tabIcon, currentTab === 'install' && styles.tabIconActive]}>📝</Text>
          <Text style={[styles.tabLabel, currentTab === 'install' && styles.tabLabelActive]}>Instalación</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'outbox' && styles.tabItemActive]}
          onPress={() => setCurrentTab('outbox')}
        >
          <Text style={[styles.tabIcon, currentTab === 'outbox' && styles.tabIconActive]}>🔄</Text>
          <Text style={[styles.tabLabel, currentTab === 'outbox' && styles.tabLabelActive]}>Outbox</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'history' && styles.tabItemActive]}
          onPress={() => setCurrentTab('history')}
        >
          <Text style={[styles.tabIcon, currentTab === 'history' && styles.tabIconActive]}>🗂️</Text>
          <Text style={[styles.tabLabel, currentTab === 'history' && styles.tabLabelActive]}>Historial</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: '#60a5fa',
  },
  topBarSubtitle: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: THEME.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    color: '#34d399',
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingBottom: 4,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
  },
  tabItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  tabIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: THEME.colors.primaryText,
    fontWeight: '700',
  },
});
