const db = require('../db/db');

function list(q) {
  if (q) {
    return db
      .prepare(
        `SELECT * FROM vehicles WHERE brand LIKE @q OR model LIKE @q OR plate LIKE @q ORDER BY brand COLLATE NOCASE`
      )
      .all({ q: `%${q}%` });
  }
  return db.prepare('SELECT * FROM vehicles ORDER BY brand COLLATE NOCASE').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
}

function create(data) {
  const info = db
    .prepare(`INSERT INTO vehicles (brand, model, plate, notes) VALUES (@brand, @model, @plate, @notes)`)
    .run({
      brand: data.brand,
      model: data.model || null,
      plate: data.plate,
      notes: data.notes || null,
    });
  return findById(info.lastInsertRowid);
}

function update(id, data) {
  db.prepare(
    `UPDATE vehicles SET brand = @brand, model = @model, plate = @plate, notes = @notes, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    brand: data.brand,
    model: data.model || null,
    plate: data.plate,
    notes: data.notes || null,
  });
  return findById(id);
}

function remove(id) {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
}

function tripCount(id) {
  return db.prepare('SELECT COUNT(*) AS n FROM trip_logs WHERE vehicle_id = ?').get(id).n;
}

function label(v) {
  if (!v) return '';
  const name = [v.brand, v.model].filter(Boolean).join(' ');
  return v.plate ? `${name} — ${v.plate}` : name;
}

module.exports = { list, findById, create, update, remove, tripCount, label };
