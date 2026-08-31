const db = require('./db');

const DEFAULTS = {
  company_name: 'Shiftek Hosting',
  company_address: '',
  company_email: '',
  company_phone: '',
  company_website: 'shiftek.fr',
  company_logo_filename: '',
  company_logo_mime: '',
};

function get(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row) return row.value;
  return DEFAULTS[key] ?? null;
}

function getAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULTS };
  for (const row of rows) out[row.key] = row.value;
  return out;
}

function set(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ key, value });
}

function setMany(obj) {
  const tx = db.transaction((entries) => {
    for (const [key, value] of Object.entries(entries)) set(key, value);
  });
  tx(obj);
}

module.exports = { get, getAll, set, setMany, DEFAULTS };
