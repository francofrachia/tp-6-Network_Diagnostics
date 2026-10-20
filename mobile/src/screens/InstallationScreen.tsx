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
import { GeolocationService, LocationData } from '../evidence/GeolocationService';
import { BarcodeScannerService, EquipmentTechnicalSheet } from '../evidence/BarcodeScannerService';
import { PdfReportGenerator } from '../reporting/PdfReportGenerator';
import { LocalDatabase } from '../storage/LocalDatabase';
import { InstallationEvidence } from '../types';

interface Props {
  route?: any;
  navigation: any;
}

export const InstallationScreen: React.FC<Props> = ({ route, navigation }) => {
  const [siteName, setSiteName] = useState('Gabinete FTTH - Nodo Central');
  const [technicianName, setTechnicianName] = useState('Técnico Telecom');
  const [deviceId, setDeviceId] = useState(route?.params?.deviceId || 'DEV-ROUTER-01');
  const [deviceIp, setDeviceIp] = useState(route?.params?.ip || '192.168.1.1');
  const [qrCode, setQrCode] = useState('SN:HUA-4857544321A;MODEL:EchoLife HG8245H');
  const [parsedSheet, setParsedSheet] = useState<EquipmentTechnicalSheet | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState('Instalación de ONT y validación de potencias ópticas (-19.5 dBm). Certificado.');
  const [hasPhoto, setHasPhoto] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route?.params?.deviceId) setDeviceId(route.params.deviceId);
    if (route?.params?.ip) setDeviceIp(route.params.ip);
    // Parsear código inicial
    setParsedSheet(BarcodeScannerService.parseCode(qrCode));
  }, [route?.params]);

  const handleCaptureGps = async () => {
    setLocating(true);
    try {
      const loc = await GeolocationService.getCurrentLocation();
      setLocation(loc);
    } catch (err: any) {
      Alert.alert('Error GPS', err.message || 'No se pudo obtener la georreferenciación.');
    } finally {
      setLocating(false);
    }
  };

  const handleScanQr = () => {
    // Simular lectura de QR/código de barras de equipo de telecomunicaciones
    const sampleCodes = [
      'VENDOR:Huawei;MODEL:HG8245H;SN:48575443B901;IP:192.168.100.1',
      'VENDOR:Cisco;MODEL:WS-C2960-24TT;SN:FOC1429Z85X;IP:192.168.1.1',
      'VENDOR:MikroTik;MODEL:RB3011UiAS;SN:CC1849204A;IP:192.168.88.1',
    ];
    const picked = sampleCodes[Math.floor(Math.random() * sampleCodes.length)];
    setQrCode(picked);
    const sheet = BarcodeScannerService.parseCode(picked);
    setParsedSheet(sheet);
    if (sheet.defaultIp) setDeviceIp(sheet.defaultIp);
  };

  const handleSaveInstallation = async () => {
    if (!siteName.trim() || !technicianName.trim()) {
      Alert.alert('Datos requeridos', 'Ingrese el nombre del sitio y técnico responsable.');
      return;
    }

    setSaving(true);
    try {
      const id = `INST-${Date.now().toString(36).toUpperCase()}`;

      const installationRecord: InstallationEvidence = {
        id,
        siteName: siteName.trim(),
        technicianName: technicianName.trim(),
        deviceId: deviceId.trim(),
        deviceIp: deviceIp.trim(),
        qrCode: qrCode.trim(),
        latitude: location ? location.latitude : -32.482514,
        longitude: location ? location.longitude : -58.233519,
        accuracy: location ? location.accuracy : 4.5,
        photoUri: hasPhoto ? 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500' : undefined,
        notes: notes.trim(),
        installedAt: new Date().toISOString(),
        synced: false,
      };

      // 1. Generar Reporte PDF
      const pdfPath = await PdfReportGenerator.createReportPdf(installationRecord);
      installationRecord.pdfPath = pdfPath;

      // 2. Persistir en base local (WatermelonDB/LocalStore)
      LocalDatabase.saveInstallation(installationRecord);

      // 3. Encolar en Outbox para sincronización diferida
      LocalDatabase.enqueueOutbox('installation', installationRecord, 'create');

      Alert.alert(
        '¡Instalación Registrada!',
        `Reporte ${id} guardado localmente.\nPDF generado en:\n${pdfPath}\n\nSe encoló en la cola Outbox para sincronizarse automáticamente con el servidor central.`,
        [
          {
            text: 'Ver Cola Outbox',
            onPress: () => navigation.navigate('Outbox'),
          },
          { text: 'Aceptar' },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar la instalación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registro de Instalación de Campo</Text>
        <Text style={styles.cardSubtitle}>
          Evidencia georreferenciada (GPS), código QR/barras y acta digital en PDF
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nombre del Sitio / Cliente</Text>
          <TextInput
            style={styles.input}
            value={siteName}
            onChangeText={setSiteName}
            placeholder="Ej. Gabinete Nodo Central"
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Técnico Responsable</Text>
            <TextInput
              style={styles.input}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder="Nombre y Apellido"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>IP Equipo</Text>
            <TextInput
              style={styles.input}
              value={deviceIp}
              onChangeText={setDeviceIp}
              placeholder="192.168.1.1"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        </View>

        {/* Sección QR y Ficha Técnica */}
        <View style={styles.sectionDivider} />
        <View style={styles.subHeaderRow}>
          <Text style={styles.subTitle}>1. Identificación por Código (QR / Barras)</Text>
          <TouchableOpacity style={styles.scanCodeButton} onPress={handleScanQr}>
            <Text style={styles.scanCodeButtonText}>Escanear QR</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, { fontFamily: 'monospace', fontSize: 11 }]}
          value={qrCode}
          onChangeText={(val) => {
            setQrCode(val);
            setParsedSheet(BarcodeScannerService.parseCode(val));
          }}
          placeholder="Código de barras o QR escaneado"
          placeholderTextColor={THEME.colors.textMuted}
        />

        {parsedSheet && (
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Ficha Técnica Vinculada:</Text>
            <Text style={styles.sheetText}>
              • Fabricante: <Text style={styles.sheetVal}>{parsedSheet.vendor}</Text>
            </Text>
            <Text style={styles.sheetText}>
              • Modelo: <Text style={styles.sheetVal}>{parsedSheet.model}</Text>
            </Text>
            <Text style={styles.sheetText}>
              • Número de Serie: <Text style={styles.sheetVal}>{parsedSheet.serialNumber}</Text>
            </Text>
          </View>
        )}

        {/* Sección GPS */}
        <View style={styles.sectionDivider} />
        <View style={styles.subHeaderRow}>
          <Text style={styles.subTitle}>2. Georreferenciación GPS</Text>
          <TouchableOpacity
            style={[styles.scanCodeButton, locating && styles.buttonDisabled]}
            onPress={handleCaptureGps}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.scanCodeButtonText}>Capturar GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.gpsBox}>
          {location ? (
            <View>
              <Text style={styles.gpsCoord}>
                Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
              </Text>
              <Text style={styles.gpsPrecision}>
                Precisión: ±{location.accuracy.toFixed(1)} metros | Sede FCyT Concepción del Uruguay
              </Text>
            </View>
          ) : (
            <Text style={styles.gpsPlaceholder}>
              Presione "Capturar GPS" para registrar coordenadas georreferenciadas.
            </Text>
          )}
        </View>

        {/* Sección Evidencia Fotográfica y Notas */}
        <View style={styles.sectionDivider} />
        <View style={styles.subHeaderRow}>
          <Text style={styles.subTitle}>3. Evidencia Fotográfica y Notas</Text>
          <TouchableOpacity
            style={[styles.scanCodeButton, { backgroundColor: '#4b5563' }]}
            onPress={() => setHasPhoto(!hasPhoto)}
          >
            <Text style={styles.scanCodeButtonText}>{hasPhoto ? 'Foto Adjuntada ✓' : 'Adjuntar Foto'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notas Técnicas de Instalación</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Observaciones de tendido, potencias ópticas, etc."
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSaveInstallation}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Generar Reporte PDF y Guardar Offline</Text>
          )}
        </TouchableOpacity>
      </View>
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
    marginBottom: THEME.spacing.md,
  },
  formGroup: {
    marginBottom: THEME.spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
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
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.md,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  subTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.primaryText,
  },
  scanCodeButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
  },
  scanCodeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  sheetBox: {
    backgroundColor: THEME.colors.surface,
    padding: 10,
    borderRadius: THEME.borderRadius.sm,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.accent,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accent,
    marginBottom: 4,
  },
  sheetText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  sheetVal: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  gpsBox: {
    backgroundColor: THEME.colors.surface,
    padding: 10,
    borderRadius: THEME.borderRadius.sm,
    marginTop: 4,
  },
  gpsCoord: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.success,
    fontFamily: 'monospace',
  },
  gpsPrecision: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  gpsPlaceholder: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#059669',
    marginTop: THEME.spacing.lg,
    height: 44,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: THEME.fontSize.sm,
  },
});
