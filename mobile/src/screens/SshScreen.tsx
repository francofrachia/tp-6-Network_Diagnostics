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
import { SshService, PREDEFINED_COMMANDS, PredefinedCommand } from '../protocols/ssh/SshService';
import { CredentialManager } from '../security/CredentialManager';
import { SshDiagnosticResult } from '../types';
import { LocalDatabase } from '../storage/LocalDatabase';

interface Props {
  route?: any;
}

export const SshScreen: React.FC<Props> = ({ route }) => {
  const initialHost = route?.params?.host || '192.168.1.1';
  const [host, setHost] = useState(initialHost);
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<string>('show interfaces');
  const [customCommand, setCustomCommand] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [saveToKeyring, setSaveToKeyring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SshDiagnosticResult | null>(null);

  useEffect(() => {
    if (route?.params?.host) {
      setHost(route.params.host);
      loadSavedCredentials(route.params.host);
    } else {
      loadSavedCredentials(initialHost);
    }
  }, [route?.params?.host]);

  const loadSavedCredentials = async (targetHost: string) => {
    const creds = await CredentialManager.getCredentials(targetHost);
    if (creds) {
      setUsername(creds.username);
      if (creds.password) setPassword(creds.password);
    }
  };

  const handleExecute = async () => {
    if (!host.trim() || !username.trim()) {
      Alert.alert('Datos requeridos', 'Debe especificar el host y el nombre de usuario SSH.');
      return;
    }

    const cmdToRun = useCustom ? customCommand.trim() : selectedCommand;
    if (!cmdToRun) {
      Alert.alert('Comando vacío', 'Por favor seleccione o escriba un comando.');
      return;
    }

    setLoading(true);
    try {
      // Guardar credenciales de forma segura en Keystore si el switch está activo
      if (saveToKeyring && password) {
        await CredentialManager.saveCredentials(host.trim(), username.trim(), password);
      }

      const res = await SshService.executeCommand(
        {
          host: host.trim(),
          port: parseInt(port, 10) || 22,
          username: username.trim(),
          password,
        },
        cmdToRun
      );

      setResult(res);

      // Guardar diagnóstico en base local y encolar en Outbox
      const diagRecord = LocalDatabase.saveDiagnostic(
        'SSH',
        host.trim(),
        cmdToRun,
        res.output,
        res.success ? 'success' : 'failed'
      );
      LocalDatabase.enqueueOutbox('diagnostic', diagRecord, 'create');
    } catch (err: any) {
      Alert.alert('Error SSH', err.message || 'Fallo de conexión o ejecución SSH.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cliente SSH Embebido</Text>
        <Text style={styles.cardSubtitle}>
          Diagnósticos remotos de infraestructura con almacenamiento seguro de credenciales
        </Text>

        <View style={styles.formRow}>
          <View style={{ flex: 3 }}>
            <Text style={styles.label}>Host / IP</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={(text) => {
                setHost(text);
                loadSavedCredentials(text);
              }}
              placeholder="192.168.1.1"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Puerto</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              keyboardType="numeric"
              placeholder="22"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        </View>

        <View style={[styles.formRow, { marginTop: THEME.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="admin"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.keychainNotice}
          onPress={() => setSaveToKeyring(!saveToKeyring)}
        >
          <Text style={styles.keychainNoticeIcon}>{saveToKeyring ? '☑' : '☐'}</Text>
          <Text style={styles.keychainNoticeText}>
            Manejo seguro: Cifrar credenciales con Android Keystore / iOS Keychain (OWASP MASVS)
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: THEME.spacing.md }]}>
          Comandos de Diagnóstico Predefinidos
        </Text>
        <View style={styles.chipsRow}>
          {PREDEFINED_COMMANDS.map((cmd) => (
            <TouchableOpacity
              key={cmd.id}
              style={[
                styles.chip,
                !useCustom && selectedCommand === cmd.command && styles.chipActive,
              ]}
              onPress={() => {
                setUseCustom(false);
                setSelectedCommand(cmd.command);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  !useCustom && selectedCommand === cmd.command && styles.chipTextActive,
                ]}
              >
                {cmd.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, useCustom && styles.chipActive]}
            onPress={() => setUseCustom(true)}
          >
            <Text style={[styles.chipText, useCustom && styles.chipTextActive]}>Manual...</Text>
          </TouchableOpacity>
        </View>

        {useCustom && (
          <View style={{ marginTop: THEME.spacing.sm }}>
            <Text style={styles.label}>Comando personalizado</Text>
            <TextInput
              style={styles.input}
              value={customCommand}
              onChangeText={setCustomCommand}
              placeholder="ej. show mac address-table"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.executeButton, loading && styles.buttonDisabled]}
          onPress={handleExecute}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.executeButtonText}>
              Ejecutar "{useCustom ? customCommand || 'Manual' : selectedCommand}"
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.terminalCard}>
          <View style={styles.terminalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.termDotRed} />
              <View style={styles.termDotYellow} />
              <View style={styles.termDotGreen} />
              <Text style={styles.terminalTitle}>Consola: {result.command}</Text>
            </View>
            <Text style={styles.terminalDuration}>{result.durationMs} ms</Text>
          </View>
          <ScrollView horizontal style={styles.terminalScroll}>
            <Text style={styles.terminalText}>{result.output || '(Salida vacía)'}</Text>
          </ScrollView>
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
  keychainNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: THEME.spacing.sm,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    padding: 8,
    borderRadius: THEME.borderRadius.sm,
  },
  keychainNoticeIcon: {
    fontSize: 16,
    color: THEME.colors.primaryLight,
  },
  keychainNoticeText: {
    fontSize: 11,
    color: THEME.colors.primaryText,
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  chipText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  executeButton: {
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
  executeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: THEME.fontSize.sm,
  },
  terminalCard: {
    backgroundColor: THEME.colors.terminalBg,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  terminalHeader: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  termDotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  termDotYellow: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' },
  termDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },
  terminalTitle: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  terminalDuration: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  terminalScroll: {
    padding: 12,
  },
  terminalText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: THEME.colors.terminalText,
    lineHeight: 18,
  },
});
