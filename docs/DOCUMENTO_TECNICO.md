# Network Diagnostics Suite
## Toolkit móvil de diagnóstico de infraestructura de telecomunicaciones para técnicos de campo

**Carrera:** Licenciatura en Sistemas de Información  
**Cátedra:** Desarrollo de Aplicaciones Móviles (2026)  
**Institución:** Facultad de Ciencia y Tecnología (FCyT) – Sede Concepción del Uruguay  
**Área temática:** Comunicaciones y Redes de Datos  
**Tecnología:** React Native (Bare CLI) & Node.js / TypeScript  

---

## 1. Introducción y Arquitectura del Sistema

El proyecto **Network Diagnostics Suite** es una solución móvil integral diseñada para asistir a los técnicos de telecomunicaciones durante tareas de despliegue, mantenimiento y certificación de equipamiento en campo (switches, routers, antenas punto a punto y terminales de red óptica GPON/ONT).

Debido a que las tareas en sitios de instalación remotos (gabinetes urbanos, azoteas o salas de servidores) a menudo carecen de cobertura celular o acceso a Internet, el sistema fue concebido bajo el paradigma **Offline-First**, utilizando el patrón arquitectónico **Outbox** para asegurar que ningún reporte ni diagnóstico se pierda.

```
+-----------------------------------------------------------------------------------+
|                         Capa de Presentación (UI React Native)                    |
|  [Listado Equipos]  [Consola Diagnóstico]  [Escaneo QR]  [Formulario]  [Outbox]   |
+-----------------------------------------------------------------------------------+
         |                  |                 |             |             |
         v                  v                 v             v             v
+------------------+ +---------------+ +---------------+ +----------+ +-------------+
| Discovery Layer  | | Protocol Layer| | Evidence Layer| |Local Store| |  Sync Layer |
|  - Escaneo ARP   | | - Cliente SNMP| | - Fotos/QR    | | - SQLite /| | - Outbox    |
|  - mDNS/Bonjour  | | - Cliente SSH | | - GPS Preciso | |  Reactivo | | - NetInfo   |
+------------------+ +---------------+ +---------------+ +----------+ +-------------+
         |                  |                 |                          |
         |                  |                 +------------+             |
         v                  v                              v             v
+------------------+ +---------------+             +-------------------------------+
|  Red Local (LAN) | | Almacenamiento|             |     Reporting Layer (PDF)     |
| Routers / ONTs   | | Seguro Keyring|             +-------------------------------+
+------------------+ +---------------+                             |
                            |                                      v
                            +---------------------------> +-----------------+
                                                          | Backend Central |
                                                          |  Sincronización |
                                                          +-----------------+
```

### Organización en Capas de Dominio:
1. **Discovery Layer:** Descubrimiento de hosts activos mediante barrido de subred ARP/TCP y resolución de servicios mDNS/Bonjour vía `react-native-zeroconf`.
2. **Protocol Layer:** Implementación binaria sobre sockets crudos UDP de un cliente SNMP v1/v2c con parser BER/ASN.1 propio y cliente SSH (`react-native-ssh-sftp`) para ejecución de comandos de diagnóstico predefinidos.
3. **Evidence Layer:** Recolección de evidencia física y documental (fotografías, coordenadas GPS de alta precisión y lectura de códigos QR/barras para vinculación de ficha técnica).
4. **Local Store:** Base de datos local reactiva y persistente que almacena el inventario de equipos descubiertos, bitácora de diagnósticos y actas de instalación.
5. **Sync Layer:** Motor de sincronización diferida basado en el patrón Outbox que monitoriza la conectividad mediante `@react-native-community/netinfo` y reintenta de forma automática ante pérdidas de conexión.
6. **Reporting Layer:** Generador de reportes técnicos formales en formato PDF (`react-native-html-to-pdf`) con firma digital de conformidad y telemetría embebida.

---

## 2. Especificación del Subconjunto del Protocolo SNMP (BER / ASN.1)

### 2.1 Contexto y Justificación
SNMP (*Simple Network Management Protocol*) opera sobre la capa de transporte mediante datagramas UDP (puerto 161). En entornos móviles, las librerías convencionales de JavaScript dependen frecuentemente de librerías nativas compiladas de C/C++ que no son compatibles con los motores modernos de React Native (como Hermes). Por esta razón, se diseñó e implementó un **codec propio y liviano de codificación y decodificación BER/ASN.1** en TypeScript puro.

### 2.2 Estructura del Datagrama SNMP
Todo mensaje SNMP v1/v2c es una secuencia ASN.1 (`SEQUENCE`, etiqueta `0x30`) compuesta por:
1. **Versión:** `INTEGER` (`0x02`), donde `0` representa SNMPv1 y `1` representa SNMPv2c.
2. **Community String:** `OCTET STRING` (`0x04`), típicamente `"public"`.
3. **PDU de Aplicación:** Bloque estructurado según el tipo de operación:
   - `0xA0`: `GetRequest-PDU` (cliente a agente).
   - `0xA2`: `GetResponse-PDU` (agente a cliente).

Dentro del PDU se transmiten:
- **Request ID:** `INTEGER` identificador unívoco para correlacionar solicitudes y respuestas concurrentes.
- **Error Status:** `INTEGER` (`0` para `noError`).
- **Error Index:** `INTEGER` (`0`).
- **VarBindList:** `SEQUENCE` de tuplas de enlace de variables (`VarBind`). Cada una vincula un `OBJECT IDENTIFIER` con su respectivo valor (`NULL` en solicitudes `GetRequest`).

```
+-------------------------------------------------------------------------+
| SEQUENCE (0x30) [Longitud Total]                                        |
|  ├─ INTEGER (0x02) [Longitud] -> Version (1 = SNMPv2c)                  |
|  ├─ OCTET STRING (0x04) [Longitud] -> Community ("public")             |
|  └─ PDU: GET-REQUEST (0xA0) / GET-RESPONSE (0xA2) [Longitud]           |
|      ├─ INTEGER (0x02) -> Request ID (ej: 1042)                         |
|      ├─ INTEGER (0x02) -> Error Status (0 = noError)                    |
|      ├─ INTEGER (0x02) -> Error Index (0)                               |
|      └─ VarBindList: SEQUENCE (0x30)                                    |
|          └─ VarBind: SEQUENCE (0x30)                                    |
|              ├─ OBJECT IDENTIFIER (0x06) -> 1.3.6.1.2.1.1.1.0 (sysDescr)|
|              └─ VALUE (ASN.1 ANY) -> OCTET STRING / TIMETICKS / NULL    |
+-------------------------------------------------------------------------+
```

### 2.3 Reglas de Codificación BER Implementadas
- **Enteros (INTEGER - 0x02):** Codificados en complemento a dos con orden de bytes Big-Endian. Si el bit más significativo del primer byte es `1` en un número positivo, se antepone un byte de padding `0x00`.
- **Identificador de Objetos (OID - 0x06):** Los dos primeros arcos `X.Y` se combinan mediante la fórmula `(X * 40) + Y`. Los arcos subsiguientes mayores o iguales a 128 se dividen en grupos de 7 bits con el bit más significativo en `1` (VLQ - *Variable Length Quantity*), finalizando en un byte con MSB en `0`.
- **TimeTicks (0x43) y Counter32 (0x41):** Enteros sin signo de 32 bits utilizados para contabilizar centésimas de segundo de uptime y octetos transmitidos por interfaces de red.

### 2.4 Tabla de OIDs Estándar Soportados (RFC 1213 MIB-II)
| OID | Nombre MIB-II | Tipo ASN.1 | Descripción Técnica |
|---|---|---|---|
| `1.3.6.1.2.1.1.1.0` | `sysDescr` | `OCTET STRING` | Descripción del hardware, versión de firmware y OS del equipo |
| `1.3.6.1.2.1.1.2.0` | `sysObjectID` | `OID` | Identificador de proveedor empresarial en el árbol IANA |
| `1.3.6.1.2.1.1.3.0` | `sysUpTime` | `TIMETICKS` | Centésimas de segundo desde el último reinicio |
| `1.3.6.1.2.1.1.4.0` | `sysContact` | `OCTET STRING` | Persona o área de contacto técnico responsable |
| `1.3.6.1.2.1.1.5.0` | `sysName` | `OCTET STRING` | Nombre de host asignado en la red (FQDN/Hostname) |
| `1.3.6.1.2.1.1.6.0` | `sysLocation` | `OCTET STRING` | Ubicación física (nodo, rack, gabinete o piso) |
| `1.3.6.1.2.1.2.2.1.10.1` | `ifInOctets` | `COUNTER32` | Total de octetos (bytes) recibidos por la interfaz 1 |
| `1.3.6.1.2.1.2.2.1.16.1` | `ifOutOctets` | `COUNTER32` | Total de octetos (bytes) transmitidos por la interfaz 1 |

### 2.5 Análisis de Seguridad y Limitaciones
- **Alcance:** La implementación utiliza SNMPv1/v2c orientado a consultas de monitoreo de solo lectura (`GetRequest`).
- **Limitación de SNMPv1/v2c:** Las cadenas de comunidad (`community strings`) viajan en texto claro dentro de los datagramas UDP. En entornos no confiables, cualquier analizador de tráfico puede capturarlas.
- **Mitigación recomendada:** Emplear comunidades de solo lectura (`RO`) con nombres no predecibles, segmentar la red de gestión en una VLAN de administración aislada y evaluar SNMPv3 (con cifrado USM/AES y autenticación SHA) para operaciones de escritura (`SetRequest`).

---

## 3. Manejo Seguro de Credenciales SSH (OWASP MASVS)

El estándar **OWASP Mobile Application Security Verification Standard (MASVS)** establece que ninguna aplicación debe persistir contraseñas o claves privadas en texto plano dentro del almacenamiento del dispositivo (como `SharedPreferences` en Android o `UserDefaults` en iOS).

### Arquitectura de Seguridad Implementada:
1. **Hardware-Backed Keystore:**
   - En Android, la suite utiliza el **Android Keystore Provider** mediante `react-native-keychain`. Las claves criptográficas se generan y protegen dentro del TEE (*Trusted Execution Environment*) o StrongBox del procesador.
   - En iOS, se utiliza el **Keychain Services**, aplicando la política de accesibilidad `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
2. **Ciclo de Vida de las Credenciales:**
   - Las contraseñas de acceso a switches o routers nunca se registran en los archivos de base de datos ni en los reportes de sincronización Outbox.
   - El almacenamiento se aísla por host mediante un espacio de nombres cifrado (`ndiag_ssh_<host>`).
   - Se provee la función de revocación inmediata (`removeCredentials`) para cuando el técnico finaliza la intervención.

---

## 4. Arquitectura Offline-First y Patrón Outbox

### 4.1 Problema del Entorno de Campo
Los técnicos operan frecuentemente en sótanos, cámaras subterráneas de fibra óptica o zonas rurales donde no hay cobertura 4G/5G ni conectividad WiFi a Internet. Sin una arquitectura adecuada, cualquier intento de enviar un reporte o guardar un diagnóstico provocaría un bloqueo o la pérdida irrecuperable de la información.

### 4.2 Diseño del Patrón Outbox
Siguiendo las pautas de Martin Fowler, toda mutación de datos generada por el usuario o por un diagnóstico se escribe **en una única transacción atómica local** en dos estructuras:
1. La tabla de dominio correspondiente (`installations`, `diagnostics` o `devices`).
2. La cola de salida persistida (`outbox`), con estado inicial `pending`.

```
[Acción de Usuario / Diagnóstico]
             │
             ▼
+────────────────────────────────────────+
|       Transacción Local Segura         |
|  1. Guardar en Base de Datos Local     |
|  2. Encolar elemento en Outbox         |
+────────────────────────────────────────+
             │
             ▼
     ¿Hay Conectividad?
       /            \
     (Sí)           (No)
      /                \
     ▼                  ▼
[Push al Backend]  [Permanecer en Outbox (Pending)]
     │                  │
 200 OK?                ▼
  /   \         [Escuchando NetInfo...]
(Sí)  (No)              │
 /       \              ▼
▼         ▼      [Al detectar Red Online]
[Synced] [Failed: Reintento con Backoff] ───┘
```

### 4.3 Máquina de Estados del Outbox
- **`pending`:** Elemento registrado localmente, en espera de conectividad con el servidor central.
- **`syncing`:** Lote tomado por el worker de sincronización en proceso de transmisión HTTP.
- **`failed`:** La petición falló por timeout o error de red. Se incrementa `retryCount`, se registra `lastError` y se programa el siguiente reintento aplicando retroceso exponencial.
- **`synced`:** El backend acusó recibo exitoso (`200 OK`). El registro se marca como sincronizado y se actualiza la marca en el acta de instalación.

### 4.4 Detección Automática y Reintentos
- La librería `@react-native-community/netinfo` mantiene un observador nativo sobre el estado de la conexión a nivel del sistema operativo.
- Al detectarse la transición de `offline` a `online` (o cambio de interfaz de red), se dispara un temporizador de estabilización (1.5 segundos) que ejecuta de forma automática el volcado de la cola Outbox sin requerir intervención del usuario.
- Se proporciona además un gatillo manual ("Sincronizar Ahora") en la pantalla de gestión del Outbox.

### 4.5 Idempotencia y Resolución de Conflictos
El servidor central implementa cláusulas de actualización condicional (`ON CONFLICT(id) DO UPDATE`), garantizando que si un paquete se retransmite por causa de una confirmación perdida, el estado final del backend sea consistente y libre de duplicados.

---

## 5. Servidor de Sincronización y Simulación (Backend)

Para verificar el ciclo de vida completo de la aplicación sin requerir infraestructura externa de servidores, se incluye un backend en Node.js y TypeScript con persistencia SQLite:

### Endpoints de la API REST:
- **`POST /api/sync`:** Recibe lotes de la cola Outbox (`devices`, `installations`, `diagnostics`), realiza el guardado atómico en SQLite y retorna el listado de IDs confirmados.
- **`GET /api/reports`:** Retorna el historial de instalaciones recibidas con sus coordenadas GPS y notas.
- **`GET /api/diagnostics`:** Retorna los diagnósticos SNMP y SSH recibidos.
- **`GET /api/devices`:** Retorna el inventario de equipamiento descubierto en campo.
- **`GET /api/health`:** Diagnóstico de salud del servicio y puertos de red activos.
- **`GET /`:** Dashboard web interactivo en tiempo real con recarga automática para visualizar el ingreso de los datos.

### Simuladores Integrados de Laboratorio:
- **Agente SNMP Mock (UDP 16100):** Escucha solicitudes SNMP binarias y responde a los OIDs del MIB-II con valores representativos de equipamiento de red.
- **Servidor SSH Mock (TCP 2222):** Servidor SSH con emulación de comandos (`show interfaces`, `uptime`, `show version`, `ping`) para pruebas en emuladores o computadoras personales.

---

## 6. Instrucciones de Ejecución y Validación

### Requisitos Previos:
- Node.js versión 18 o superior.
- Java Development Kit (JDK 17) y Android SDK configurados en variables de entorno.

### 1. Iniciar el Servidor Backend
En una terminal:
```powershell
cd backend
npm install
npm run test    # Ejecuta la suite de pruebas unitarias del Codec SNMP (5/5 tests)
npm start       # Inicia API en http://localhost:3000, SNMP Mock en UDP 16100 y SSH Mock en TCP 2222
```
Se puede acceder desde el navegador a `http://localhost:3000` para visualizar el Dashboard en tiempo real.

### 2. Iniciar la Aplicación Móvil React Native
En una segunda terminal:
```powershell
cd mobile
npm install
npm run start   # Inicia el empaquetador Metro
```

En una tercera terminal para compilar y lanzar en Android:
```powershell
cd mobile
npm run android # O abrir carpeta mobile/android en Android Studio y compilar
```

---

## 7. Guía para la Demostración en Video (Requisito Sección 07)

El video demostrativo solicitado por la cátedra puede estructurarse en las siguientes 4 etapas claras:
1. **Descubrimiento LAN:** Abrir la pestaña *Red*, ingresar la subred local (o utilizar la predeterminada) y presionar "Escanear LAN". Mostrar el listado de dispositivos encontrados con IP, MAC y latencia.
2. **Consulta SNMP:** Seleccionar un equipo o ingresar a la pestaña *SNMP*, presionar "Consultar Agente SNMP" y mostrar la decodificación de `sysDescr`, `sysName`, `sysUpTime` legible y contadores de tráfico de interfaces.
3. **Instalación y Reporte PDF:** Ir a la pestaña *Instalación*, escanear o vincular el código QR del equipo, capturar las coordenadas GPS en tiempo real, redactar una nota técnica y presionar "Generar Reporte PDF y Guardar Offline". Mostrar la ruta del archivo PDF generado.
4. **Prueba Offline-First y Sincronización:** Ir a la pestaña *Outbox*, verificar que el reporte y los diagnósticos figuran en estado `Pendiente`. Al conectarse al servidor central (o presionar "Sincronizar"), demostrar cómo los elementos pasan a `Sincronizado` y se reflejan inmediatamente en el Dashboard web del Backend.
