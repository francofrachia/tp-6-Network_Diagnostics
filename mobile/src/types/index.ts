export interface DiscoveredDevice {
  id: string;
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  isSnmpCapable?: boolean;
  responseTimeMs?: number;
  openPorts?: number[];
  lastSeen: string;
}

export interface SnmpMetric {
  oid: string;
  name: string;
  value: string | number;
  type: string;
}

export interface SnmpQueryResult {
  targetIp: string;
  community: string;
  sysDescr?: string;
  sysObjectID?: string;
  sysUpTime?: number;
  sysUpTimeFormatted?: string;
  sysContact?: string;
  sysName?: string;
  sysLocation?: string;
  ifInOctets?: number;
  ifOutOctets?: number;
  latencyMs: number;
  rawMetrics: SnmpMetric[];
  queriedAt: string;
}

export interface SshCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SshDiagnosticResult {
  command: string;
  output: string;
  executedAt: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface InstallationEvidence {
  id: string;
  siteName: string;
  technicianName: string;
  deviceId?: string;
  deviceIp?: string;
  qrCode?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  photoUri?: string;
  pdfPath?: string;
  notes: string;
  installedAt: string;
  synced: boolean;
}

export type OutboxEntityType = 'device' | 'installation' | 'diagnostic';

export interface OutboxItem {
  id: string;
  type: OutboxEntityType;
  payload: any;
  action: 'create' | 'update' | 'upsert';
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  lastAttempt?: string;
  lastError?: string;
  createdAt: string;
}

export interface NetworkConnectionState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  localIp?: string;
  subnet?: string;
}
