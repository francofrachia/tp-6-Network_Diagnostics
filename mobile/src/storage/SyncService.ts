import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { LocalDatabase } from './LocalDatabase';
import { OutboxItem } from '../types';

export class SyncService {
  private static backendUrl: string = 'http://10.0.2.2:3000';
  private static isSyncing: boolean = false;
  private static unsubscribeNetInfo?: () => void;
  private static onSyncStateChangeCallbacks: Set<(syncing: boolean) => void> = new Set();

  public static setBackendUrl(url: string) {
    this.backendUrl = url.replace(/\/+$/, '');
  }

  public static getBackendUrl(): string {
    return this.backendUrl;
  }

  public static onSyncStateChange(cb: (syncing: boolean) => void): () => void {
    this.onSyncStateChangeCallbacks.add(cb);
    return () => this.onSyncStateChangeCallbacks.delete(cb);
  }

  private static notifySyncState(syncing: boolean) {
    this.isSyncing = syncing;
    this.onSyncStateChangeCallbacks.forEach((cb) => {
      try {
        cb(syncing);
      } catch (_e) {}
    });
  }

  /**
   * Inicializa el observador de conectividad de red con NetInfo.
   * Dispara automáticamente la sincronización Outbox al recuperar conectividad.
   */
  public static init() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      console.log(`[NetInfo] Estado de red: conectado=${state.isConnected}, alcanzable=${state.isInternetReachable}`);
      if (state.isConnected) {
        // Disparo diferido para asegurar estabilidad de la interfaz de red
        setTimeout(() => {
          this.syncPendingOutbox();
        }, 1500);
      }
    });
  }

  /**
   * Procesa la cola de sincronización Outbox pendiente.
   */
  public static async syncPendingOutbox(): Promise<{ processed: number; success: boolean }> {
    if (this.isSyncing) {
      console.log('[SyncService] Ya existe una sincronización en curso.');
      return { processed: 0, success: false };
    }

    const pendingItems = LocalDatabase.getPendingOutbox();
    if (pendingItems.length === 0) {
      return { processed: 0, success: true };
    }

    this.notifySyncState(true);

    try {
      // Marcar elementos como sincronizando
      pendingItems.forEach((item) => {
        LocalDatabase.updateOutboxStatus(item.id, 'syncing');
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${this.backendUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ batch: pendingItems }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error en servidor central: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const syncedIds: string[] = data.syncedIds || [];

      for (const id of syncedIds) {
        LocalDatabase.updateOutboxStatus(id, 'synced');
        // Si era una instalación, marcarla en la base local
        LocalDatabase.markInstallationSynced(id);
      }

      console.log(`[SyncService] Sincronización exitosa. ${syncedIds.length} elementos procesados.`);
      this.notifySyncState(false);
      return { processed: syncedIds.length, success: true };
    } catch (err: any) {
      console.warn('[SyncService] Falló el envío al backend:', err.message);

      // Revertir estado a failed para reintentar luego
      pendingItems.forEach((item) => {
        LocalDatabase.updateOutboxStatus(item.id, 'failed', err.message);
      });

      this.notifySyncState(false);
      return { processed: 0, success: false };
    }
  }
}
