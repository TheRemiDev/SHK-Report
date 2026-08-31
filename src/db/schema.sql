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

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

CREATE TABLE IF NOT EXISTS datacenters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_datacenters_name ON datacenters(name);

CREATE TABLE IF NOT EXISTS trip_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  trip_date TEXT NOT NULL,
  departure_address TEXT NOT NULL,
  arrival_address TEXT NOT NULL,
  detours TEXT NOT NULL DEFAULT '[]',
  purpose TEXT,
  total_km REAL,
  total_amount REAL,
  notes TEXT,
  technician_name TEXT NOT NULL,
  signature_data TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_date ON trip_logs(trip_date);
