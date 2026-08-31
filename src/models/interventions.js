const db = require('../db/db');
const { generateReference } = require('../utils/reference');

const STATUSES = ['planifie', 'en_cours', 'termine', 'annule'];
const TYPES = ['maintenance', 'incident', 'installation', 'audit', 'autre'];
const PRIORITIES = ['basse', 'normale', 'haute', 'critique'];

const FIELDS = [
  'title',
  'status',
  'type',
  'priority',
  'datacenter_name',
  'datacenter_address',
  'datacenter_room',
  'rack_reference',
  'is_internal',
  'client_id',
  'client_name',
  'client_contact',
  'intervention_date',
  'start_time',
  'end_time',
  'technician_name',
  'additional_technicians',
  'context',
  'actions_taken',
  'equipment_involved',
  'incidents',
  'recommendations',
  'client_signature_name',
  'client_signature_data',
  'technician_signature_data',
  'photos',
];

function create(data, createdBy) {
  const reference = generateReference(new Date(data.intervention_date || Date.now()));
  const payload = { reference, created_by: createdBy };
  for (const f of FIELDS) payload[f] = data[f] ?? null;

  const columns = ['reference', 'created_by', ...FIELDS];
  const placeholders = columns.map((c) => `@${c}`).join(', ');

  const info = db
    .prepare(`INSERT INTO interventions (${columns.join(', ')}) VALUES (${placeholders})`)
    .run(payload);

  return findById(info.lastInsertRowid);
}

function update(id, data) {
  const sets = FIELDS.map((f) => `${f} = @${f}`).join(', ');
  const payload = { id };
  for (const f of FIELDS) payload[f] = data[f] ?? null;

  db.prepare(
    `UPDATE interventions SET ${sets}, updated_at = datetime('now') WHERE id = @id`
  ).run(payload);

  return findById(id);
}

function markPdfGenerated(id) {
  db.prepare("UPDATE interventions SET pdf_generated_at = datetime('now') WHERE id = ?").run(id);
}

function findById(id) {
  return db.prepare('SELECT * FROM interventions WHERE id = ?').get(id);
}

function remove(id) {
  db.prepare('DELETE FROM interventions WHERE id = ?').run(id);
}

function search({ q, status, type, datacenter, client, dateFrom, dateTo, sort = 'date_desc', page = 1, pageSize = 20 } = {}) {
  const where = [];
  const params = {};

  if (q) {
    where.push(`(
      reference LIKE @q OR title LIKE @q OR datacenter_name LIKE @q OR
      client_name LIKE @q OR technician_name LIKE @q OR rack_reference LIKE @q
    )`);
    params.q = `%${q}%`;
  }
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  if (type) {
    where.push('type = @type');
    params.type = type;
  }
  if (datacenter) {
    where.push('datacenter_name = @datacenter');
    params.datacenter = datacenter;
  }
  if (client) {
    where.push('client_name = @client');
    params.client = client;
  }
  if (dateFrom) {
    where.push('intervention_date >= @dateFrom');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    where.push('intervention_date <= @dateTo');
    params.dateTo = dateTo;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sortMap = {
    date_desc: 'intervention_date DESC, id DESC',
    date_asc: 'intervention_date ASC, id ASC',
    created_desc: 'created_at DESC',
    created_asc: 'created_at ASC',
    reference: 'reference DESC',
  };
  const orderSql = sortMap[sort] || sortMap.date_desc;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM interventions ${whereSql}`).get(params).n;

  const limit = Math.max(1, Math.min(100, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;

  const rows = db
    .prepare(
      `SELECT * FROM interventions ${whereSql} ORDER BY ${orderSql} LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  return { rows, total, page: Math.max(1, page), pageSize: limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

function distinctValues(column) {
  const allowed = ['datacenter_name', 'client_name', 'technician_name'];
  if (!allowed.includes(column)) return [];
  return db
    .prepare(`SELECT DISTINCT ${column} AS v FROM interventions WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`)
    .all()
    .map((r) => r.v);
}

function findByShareToken(token) {
  return db
    .prepare(`SELECT * FROM interventions WHERE share_token = ? AND share_expires_at > datetime('now')`)
    .get(token);
}

function setShareToken(id, token, expiresAt) {
  db.prepare('UPDATE interventions SET share_token = ?, share_expires_at = ? WHERE id = ?').run(
    token,
    expiresAt,
    id
  );
}

function revokeShareToken(id) {
  db.prepare('UPDATE interventions SET share_token = NULL, share_expires_at = NULL WHERE id = ?').run(id);
}

function recordClientSignature(id, { name, signatureData }) {
  db.prepare(
    `UPDATE interventions
     SET client_signature_name = COALESCE(NULLIF(@name, ''), client_signature_name),
         client_signature_data = @signatureData,
         client_signed_at = datetime('now')
     WHERE id = @id`
  ).run({ id, name: name || '', signatureData });
}

function stats() {
  const total = db.prepare('SELECT COUNT(*) AS n FROM interventions').get().n;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM interventions GROUP BY status').all();
  const thisMonth = db
    .prepare(
      `SELECT COUNT(*) AS n FROM interventions WHERE strftime('%Y-%m', intervention_date) = strftime('%Y-%m', 'now')`
    )
    .get().n;
  const datacenters = db.prepare('SELECT COUNT(DISTINCT datacenter_name) AS n FROM interventions').get().n;
  return { total, byStatus, thisMonth, datacenters };
}

module.exports = {
  STATUSES,
  TYPES,
  PRIORITIES,
  create,
  update,
  markPdfGenerated,
  findById,
  remove,
  search,
  distinctValues,
  stats,
  findByShareToken,
  setShareToken,
  revokeShareToken,
  recordClientSignature,
};
