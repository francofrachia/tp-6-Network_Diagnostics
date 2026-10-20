import { Server, ServerChannel } from 'ssh2';
import crypto from 'crypto';

// Generar una clave de host RSA de 2048 bits para el servidor mock en formato PKCS#1 PEM
const { privateKey: hostPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const MOCK_OUTPUTS: Record<string, string> = {
  'show interfaces': `GigabitEthernet0/1 is up, line protocol is up (connected)
  Hardware is Gigabit Ethernet, address is 001a.a2b3.c4d5
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec, reliability 255/255
  5 minute input rate 12450000 bits/sec, 1540 packets/sec
  5 minute output rate 8750000 bits/sec, 1120 packets/sec
  845920194 packets input, 108429184920 bytes
  691029410 packets output, 87492019482 bytes
GigabitEthernet0/2 is up, line protocol is up (connected)
  Hardware is Gigabit Ethernet, address is 001a.a2b3.c4d6
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec, reliability 255/255
  5 minute input rate 24000 bits/sec, 12 packets/sec
  5 minute output rate 18000 bits/sec, 9 packets/sec
`,
  'uptime': ` 16:30:15 up 9 days, 18:42,  1 user,  load average: 0.12, 0.08, 0.05
`,
  'show version': `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4
Technical Support: http://www.cisco.com/techsupport
Compiled Wed 26-Jun-13 02:49 by prod_rel_team
System image file is "flash:/c2960-lanbasek9-mz.150-2.SE4.bin"
cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.
24 FastEthernet interfaces
2 Gigabit Ethernet interfaces
Model number: WS-C2960-24TT-L
System serial number: FOC1429Z85X
`,
  'ping 8.8.8.8': `Sending 5, 100-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 14/18/22 ms
`,
};

export function startMockSshServer(port: number = 2222): Server {
  const server = new Server(
    {
      hostKeys: [hostPrivateKey],
    },
    (client) => {
      console.log('[SSH-Mock] Nueva conexión entrante');

      client
        .on('authentication', (ctx) => {
          // Acepta cualquier usuario/contraseña para facilitar pruebas de laboratorio
          console.log(`[SSH-Mock] Autenticación recibida - Usuario: "${ctx.username}", Método: "${ctx.method}"`);
          ctx.accept();
        })
        .on('ready', () => {
          console.log('[SSH-Mock] Cliente autenticado con éxito');

          client.on('session', (accept) => {
            const session = accept();

            session.on('exec', (acceptExec, _rejectExec, info) => {
              const stream = acceptExec();
              const command = info.command.trim();
              console.log(`[SSH-Mock] Comando ejecutado: "${command}"`);

              let response = MOCK_OUTPUTS[command];
              if (!response) {
                // Si el comando contiene 'ping'
                if (command.startsWith('ping')) {
                  response = `Pinging host...\nReply received: bytes=64 time=15ms TTL=58\nSuccess rate: 100%\n`;
                } else if (command.toLowerCase().includes('interfaces') || command.toLowerCase().includes('ip')) {
                  response = MOCK_OUTPUTS['show interfaces'];
                } else {
                  response = `Comando ejecutado con éxito: ${command}\nEstado: OK\n`;
                }
              }

              stream.write(response);
              stream.exit(0);
              stream.end();
            });

            session.on('shell', (acceptShell) => {
              const stream = acceptShell();
              stream.write('Switch-Core> ');

              let buffer = '';
              stream.on('data', (data: Buffer) => {
                const char = data.toString('utf8');
                if (char === '\r' || char === '\n') {
                  const cmd = buffer.trim();
                  buffer = '';
                  stream.write('\r\n');
                  if (cmd === 'exit' || cmd === 'quit') {
                    stream.end();
                    return;
                  }
                  const output = MOCK_OUTPUTS[cmd] || `Comando: ${cmd}\r\n`;
                  stream.write(output.replace(/\n/g, '\r\n'));
                  stream.write('Switch-Core> ');
                } else {
                  buffer += char;
                  stream.write(char); // echo
                }
              });
            });
          });
        })
        .on('close', () => {
          console.log('[SSH-Mock] Conexión SSH cerrada');
        });
    }
  );

  server.listen(port, '0.0.0.0', () => {
    console.log(`[SSH-Mock] Servidor SSH de pruebas escuchando en TCP 0.0.0.0:${port}`);
  });

  return server;
}
