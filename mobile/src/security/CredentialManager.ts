import * as Keychain from 'react-native-keychain';

export interface DeviceCredentials {
  username: string;
  password?: string;
}

/**
 * Gestor de credenciales de equipos de red conforme a los lineamientos
 * OWASP Mobile Application Security (MASVS).
 * Almacena de forma encriptada en el Keystore de Android / Keychain de iOS
 * evitando persistir contraseñas en texto plano.
 */
export class CredentialManager {
  private static getServiceKey(host: string): string {
    return `ndiag_ssh_${host.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  public static async saveCredentials(
    host: string,
    username: string,
    password?: string
  ): Promise<boolean> {
    try {
      const service = this.getServiceKey(host);
      await Keychain.setGenericPassword(username, password || '', {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      });
      return true;
    } catch (error) {
      console.warn('Error al guardar credenciales en el Keystore seguro:', error);
      return false;
    }
  }

  public static async getCredentials(host: string): Promise<DeviceCredentials | null> {
    try {
      const service = this.getServiceKey(host);
      const credentials = await Keychain.getGenericPassword({ service });
      if (credentials) {
        return {
          username: credentials.username,
          password: credentials.password,
        };
      }
      return null;
    } catch (error) {
      console.warn('Error al recuperar credenciales del Keystore:', error);
      return null;
    }
  }

  public static async removeCredentials(host: string): Promise<boolean> {
    try {
      const service = this.getServiceKey(host);
      return await Keychain.resetGenericPassword({ service });
    } catch (error) {
      console.warn('Error al eliminar credenciales del Keystore:', error);
      return false;
    }
  }
}
