import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../data.sqlite');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
  } else {
    console.log('Conexión establecida con SQLite en:', DB_PATH);
  }
});

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          ip TEXT NOT NULL,
          mac TEXT,
          hostname TEXT,
          vendor TEXT,
          model TEXT,
          serial_number TEXT,
          last_seen TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS installations (
          id TEXT PRIMARY KEY,
          device_id TEXT,
          site_name TEXT NOT NULL,
          technician_name TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          notes TEXT,
          qr_code TEXT,
          photo_uri TEXT,
          pdf_path TEXT,
          status TEXT DEFAULT 'completed',
          installed_at TEXT NOT NULL,
          synced_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS diagnostics (
          id TEXT PRIMARY KEY,
          device_id TEXT,
          protocol TEXT NOT NULL,
          target_ip TEXT NOT NULL,
          command_or_oid TEXT NOT NULL,
          result_payload TEXT NOT NULL,
          status TEXT NOT NULL,
          executed_at TEXT NOT NULL,
          synced_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sync_events (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          received_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}
