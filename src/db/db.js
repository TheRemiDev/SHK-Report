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

runMigrations();

module.exports = db;
