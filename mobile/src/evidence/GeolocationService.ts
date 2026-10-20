import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  timestamp: number;
}

export class GeolocationService {
  /**
   * Solicita permisos de ubicación en Android si es necesario.
   */
  public static async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permiso de Ubicación para Reporte Técnico',
            message: 'La aplicación requiere georreferenciar las instalaciones de telecomunicaciones.',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'Aceptar',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Error al solicitar permiso de ubicación:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Obtiene la posición GPS actual con alta precisión.
   */
  public static async getCurrentLocation(): Promise<LocationData> {
    const hasPermission = await this.requestLocationPermission();

    return new Promise((resolve) => {
      if (!hasPermission) {
        // Fallback a coordenadas de demostración (Sede FCyT Concepción del Uruguay: -32.4825, -58.2335)
        resolve(this.getDemoLocation());
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.warn('Error obteniendo GPS físico:', error.message);
          resolve(this.getDemoLocation());
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    });
  }

  public static getDemoLocation(): LocationData {
    return {
      latitude: -32.482514,
      longitude: -58.233519,
      accuracy: 4.8,
      altitude: 28.5,
      timestamp: Date.now(),
    };
  }
}
