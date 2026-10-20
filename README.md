# Network Diagnostics Suite
### Toolkit móvil de diagnóstico de infraestructura de telecomunicaciones para técnicos de campo

**Área temática:** Comunicaciones y Redes de Datos  
**Tecnología:** React Native & Node.js / TypeScript  
**Cátedra:** Desarrollo de Aplicaciones Móviles (2026) — FCyT Sede Concepción del Uruguay  

---

## 🎯 Descripción del Proyecto

Aplicación móvil orientada a técnicos de telecomunicaciones para el aprovisionamiento, diagnóstico y certificación en campo de infraestructura de red (switches, routers, antenas y ONTs).

El sistema opera con arquitectura **Offline-First**, utilizando sockets crudos TCP/UDP para interactuar directamente con protocolos de bajo nivel (SNMP v1/v2c BER/ASN.1, SSH y mDNS), prescindiendo de abstracciones HTTP para el diagnóstico local, y garantizando la persistencia mediante el patrón **Outbox**.

---

## 📁 Estructura del Repositorio

```text
TP6-Network_Diagnostics/
├── backend/                  # Servidor de sincronización y simuladores de red
│   ├── src/
│   │   ├── db.ts             # Base de datos SQLite y tablas de outbox/reportes
│   │   ├── snmp-codec.ts     # Codec BER/ASN.1 para SNMP v1/v2c
│   │   ├── snmp-mock.ts      # Agente SNMP simulado (UDP 16100)
│   │   ├── ssh-mock.ts       # Servidor SSH de laboratorio (TCP 2222)
│   │   ├── test-snmp.ts      # Pruebas unitarias de codificación y decodificación
│   │   └── server.ts         # API REST y Dashboard Web en tiempo real
│   ├── package.json
│   └── tsconfig.json
├── mobile/                   # Aplicación móvil React Native CLI (Bare)
│   ├── android/              # Configuración nativa Android, permisos y Gradle
│   ├── src/
│   │   ├── discovery/        # Escaneo LAN ARP/TCP y mDNS/Bonjour
│   │   ├── protocols/        # Cliente SNMP (BER/ASN.1) y Cliente SSH
│   │   ├── security/         # Almacenamiento seguro en Keystore/Keychain (OWASP)
│   │   ├── evidence/         # Escaneo QR, Fichas Técnicas y GPS de alta precisión
│   │   ├── storage/          # Base local y cola Outbox con reintentos
│   │   ├── reporting/        # Generador de reportes de instalación en PDF
│   │   ├── screens/          # Pantallas de la aplicación
│   │   ├── styles/           # Paleta de colores y componentes visuales
│   │   └── App.tsx           # Entrada principal y navegador de pestañas
│   ├── index.js
│   ├── package.json
│   └── tsconfig.json
└── docs/
    └── DOCUMENTO_TECNICO.md  # Especificación técnica completa de la solución
```

---

## 🚀 Puesta en Marcha

### 1. Servidor Backend y Simuladores
```bash
cd backend
npm install
npm run test    # Verifica las pruebas unitarias del Codec BER/ASN.1
npm start       # Inicia el servidor HTTP (puerto 3000), SNMP (16100) y SSH (2222)
```
Abrir `http://localhost:3000` en el navegador para acceder al panel de control de reportes y sincronización.

### 2. Aplicación Móvil
```bash
cd mobile
npm install
npm run start
npm run android # Ejecución en emulador o dispositivo físico
```

---

## 📄 Documentación Técnica Detallada
Para consultar la especificación exhaustiva del protocolo SNMP, el esquema de seguridad para credenciales SSH y la arquitectura de la cola Outbox diferida, consultar:
👉 [docs/DOCUMENTO_TECNICO.md](docs/DOCUMENTO_TECNICO.md)
