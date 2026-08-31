-- Schéma SHK-Report

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'technicien' CHECK (role IN ('admin', 'technicien')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planifie' CHECK (status IN ('planifie', 'en_cours', 'termine', 'annule')),
  type TEXT NOT NULL DEFAULT 'maintenance',
  priority TEXT NOT NULL DEFAULT 'normale' CHECK (priority IN ('basse', 'normale', 'haute', 'critique')),

  datacenter_name TEXT NOT NULL,
  datacenter_address TEXT,
  datacenter_room TEXT,
  rack_reference TEXT,

  client_name TEXT NOT NULL,
  client_contact TEXT,

  intervention_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,

  technician_name TEXT NOT NULL,
  additional_technicians TEXT,

  context TEXT,
  actions_taken TEXT,
  equipment_involved TEXT,
  incidents TEXT,
  recommendations TEXT,

  client_signature_name TEXT,
  client_signature_data TEXT,
  technician_signature_data TEXT,

  photos TEXT NOT NULL DEFAULT '[]',

  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  pdf_generated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_interventions_date ON interventions(intervention_date);
CREATE INDEX IF NOT EXISTS idx_interventions_datacenter ON interventions(datacenter_name);
CREATE INDEX IF NOT EXISTS idx_interventions_client ON interventions(client_name);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON interventions(status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
