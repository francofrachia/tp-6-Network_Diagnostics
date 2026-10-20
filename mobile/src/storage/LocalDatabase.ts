import { DiscoveredDevice, InstallationEvidence, SshDiagnosticResult, OutboxItem } from '../types';

export class LocalDatabase {
  private static devices: Map<string, DiscoveredDevice> = new Map();
  private static installations: Map<string, InstallationEvidence> = new Map();
  private static diagnostics: Array<{
    id: string;
    protocol: string;
    targetIp: string;
    commandOrOid: string;
    resultPayload: any;
    status: string;
    executedAt: string;
  }> = [];
  private static outbox: Map<string, OutboxItem> = new Map();
  private static listeners: Set<() => void> = new Set();

  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notificando observador de base local:', err);
      }
    });
  }

  // --- Dispositivos ---
  public static saveDevice(device: DiscoveredDevice) {
    this.devices.set(device.id, device);
    this.notify();
  }

  public static getDevices(): DiscoveredDevice[] {
    return Array.from(this.devices.values()).sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  // --- Instalaciones ---
  public static saveInstallation(inst: InstallationEvidence) {
    this.installations.set(inst.id, inst);
    this.notify();
  }

  public static getInstallations(): InstallationEvidence[] {
    return Array.from(this.installations.values()).sort(
      (a, b) => new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime()
    );
  }

  public static getInstallationById(id: string): InstallationEvidence | undefined {
    return this.installations.get(id);
  }

  public static markInstallationSynced(id: string) {
    const inst = this.installations.get(id);
    if (inst) {
      inst.synced = true;
      this.notify();
    }
  }

  // --- Diagnósticos ---
  public static saveDiagnostic(
    protocol: 'SNMP' | 'SSH',
    targetIp: string,
    commandOrOid: string,
    resultPayload: any,
    status: string = 'success'
  ) {
    const record = {
      id: `diag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      protocol,
      targetIp,
      commandOrOid,
      resultPayload,
      status,
      executedAt: new Date().toISOString(),
    };
    this.diagnostics.unshift(record);
    this.notify();
    return record;
  }

  public static getDiagnostics() {
    return [...this.diagnostics];
  }

  // --- Cola Outbox ---
  public static enqueueOutbox(
    type: 'device' | 'installation' | 'diagnostic',
    payload: any,
    action: 'create' | 'update' | 'upsert' = 'upsert'
  ): OutboxItem {
    const item: OutboxItem = {
      id: payload.id || `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      payload,
      action,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.outbox.set(item.id, item);
    this.notify();
    return item;
  }

  public static getPendingOutbox(): OutboxItem[] {
    return Array.from(this.outbox.values()).filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );
  }

  public static getAllOutbox(): OutboxItem[] {
    return Array.from(this.outbox.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static updateOutboxStatus(
    id: string,
    status: 'pending' | 'syncing' | 'failed' | 'synced',
    error?: string
  ) {
    const item = this.outbox.get(id);
    if (item) {
      item.status = status;
      item.lastAttempt = new Date().toISOString();
      if (status === 'failed') {
        item.retryCount += 1;
        item.lastError = error;
      } else if (status === 'synced') {
        item.lastError = undefined;
      }
      this.notify();
    }
  }

  public static removeOutbox(id: string) {
    this.outbox.delete(id);
    this.notify();
  }
}
