const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const dbPath = path.join(config.dataDir, 'shk-report.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function runMigrations() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

function columnExists(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((col) => col.name === column);
}

function ensureColumn(table, column, definition) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Ajouts incrémentaux à des tables déjà existantes (schema.sql ne gère que la
 * création initiale via CREATE TABLE IF NOT EXISTS). Chaque appel est
 * idempotent : sans effet si la colonne existe déjà.
 */
function runIncrementalMigrations() {
  ensureColumn('interventions', 'client_id', 'INTEGER REFERENCES clients(id)');
  ensureColumn('interventions', 'is_internal', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('interventions', 'share_token', 'TEXT');
  ensureColumn('interventions', 'share_expires_at', 'TEXT');
  ensureColumn('interventions', 'client_signed_at', 'TEXT');
  ensureColumn('interventions', 'datacenter_id', 'INTEGER REFERENCES datacenters(id)');
  ensureColumn('trip_logs', 'return_address', 'TEXT');
  ensureColumn('trip_logs', 'return_date', 'TEXT');
  ensureColumn('trip_logs', 'photos', "TEXT NOT NULL DEFAULT '[]'");

  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_share_token ON interventions(share_token) WHERE share_token IS NOT NULL`
  );
}

runMigrations();
runIncrementalMigrations();

module.exports = db;
