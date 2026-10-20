import Zeroconf from 'react-native-zeroconf';
import { DiscoveredDevice } from '../types';

export class MdnsDiscovery {
  private static zeroconfInstance: any;

  public static startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onError?: (err: any) => void
  ) {
    try {
      if (!this.zeroconfInstance) {
        this.zeroconfInstance = new Zeroconf();
      }

      this.zeroconfInstance.on('resolved', (service: any) => {
        if (service && service.addresses && service.addresses.length > 0) {
          const ip = service.addresses[0];
          const device: DiscoveredDevice = {
            id: `mdns-${ip}`,
            ip,
            hostname: service.name || service.host,
            vendor: service.txt?.vendor || 'Dispositivo mDNS/Bonjour',
            openPorts: service.port ? [service.port] : [],
            isSnmpCapable: true,
            lastSeen: new Date().toISOString(),
          };
          onDeviceFound(device);
        }
      });

      this.zeroconfInstance.on('error', (err: any) => {
        if (onError) onError(err);
      });

      this.zeroconfInstance.scan('http', 'tcp', 'local.');
    } catch (e) {
      console.warn('Zeroconf nativo no disponible o en entorno emulado:', e);
    }
  }

  public static stopDiscovery() {
    try {
      if (this.zeroconfInstance) {
        this.zeroconfInstance.stop();
        this.zeroconfInstance.removeDeviceListeners();
      }
    } catch (_e) {
      // Ignorar error al detener
    }
  }
}
