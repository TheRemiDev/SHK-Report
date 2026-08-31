const db = require('../db/db');
const { generateTripReference } = require('../utils/reference');

const FIELDS = [
  'trip_date',
  'departure_address',
  'arrival_address',
  'detours',
  'purpose',
  'total_km',
  'total_amount',
  'notes',
  'technician_name',
  'signature_data',
];

function toPayload(data) {
  const payload = {};
  for (const f of FIELDS) payload[f] = data[f] ?? null;
  payload.total_km = data.total_km ? parseFloat(String(data.total_km).replace(',', '.')) : null;
  payload.total_amount = data.total_amount ? parseFloat(String(data.total_amount).replace(',', '.')) : null;
  return payload;
}

function create(data, createdBy) {
  const reference = generateTripReference(new Date(data.trip_date || Date.now()));
  const payload = { reference, created_by: createdBy, ...toPayload(data) };

  const columns = ['reference', 'created_by', ...FIELDS];
  const placeholders = columns.map((c) => `@${c}`).join(', ');

  const info = db
    .prepare(`INSERT INTO trip_logs (${columns.join(', ')}) VALUES (${placeholders})`)
    .run(payload);

  return findById(info.lastInsertRowid);
}

function update(id, data) {
  const payload = { id, ...toPayload(data) };
  const sets = FIELDS.map((f) => `${f} = @${f}`).join(', ');

  db.prepare(`UPDATE trip_logs SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(payload);
  return findById(id);
}

function findById(id) {
  return db.prepare('SELECT * FROM trip_logs WHERE id = ?').get(id);
}

function remove(id) {
  db.prepare('DELETE FROM trip_logs WHERE id = ?').run(id);
}

function search({ q, dateFrom, dateTo, page = 1, pageSize = 20 } = {}) {
  const where = [];
  const params = {};

  if (q) {
    where.push(`(reference LIKE @q OR departure_address LIKE @q OR arrival_address LIKE @q OR technician_name LIKE @q OR purpose LIKE @q)`);
    params.q = `%${q}%`;
  }
  if (dateFrom) {
    where.push('trip_date >= @dateFrom');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    where.push('trip_date <= @dateTo');
    params.dateTo = dateTo;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM trip_logs ${whereSql}`).get(params).n;

  const limit = Math.max(1, Math.min(100, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;

  const rows = db
    .prepare(
      `SELECT * FROM trip_logs ${whereSql} ORDER BY trip_date DESC, id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  return { rows, total, page: Math.max(1, page), pageSize: limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

function stats() {
  const total = db.prepare('SELECT COUNT(*) AS n FROM trip_logs').get().n;
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(total_km), 0) AS km, COALESCE(SUM(total_amount), 0) AS amount
       FROM trip_logs WHERE strftime('%Y-%m', trip_date) = strftime('%Y-%m', 'now')`
    )
    .get();
  return { total, kmThisMonth: totals.km, amountThisMonth: totals.amount };
}

module.exports = { create, update, findById, remove, search, stats };
