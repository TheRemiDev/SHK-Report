const db = require('../db/db');

function list(q) {
  if (q) {
    return db
      .prepare(`SELECT * FROM datacenters WHERE name LIKE @q OR address LIKE @q ORDER BY name COLLATE NOCASE`)
      .all({ q: `%${q}%` });
  }
  return db.prepare('SELECT * FROM datacenters ORDER BY name COLLATE NOCASE').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM datacenters WHERE id = ?').get(id);
}

function create(data) {
  const info = db
    .prepare(`INSERT INTO datacenters (name, address, notes) VALUES (@name, @address, @notes)`)
    .run({
      name: data.name,
      address: data.address || null,
      notes: data.notes || null,
    });
  return findById(info.lastInsertRowid);
}

function update(id, data) {
  db.prepare(
    `UPDATE datacenters SET name = @name, address = @address, notes = @notes, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    name: data.name,
    address: data.address || null,
    notes: data.notes || null,
  });
  return findById(id);
}

function remove(id) {
  db.prepare('DELETE FROM datacenters WHERE id = ?').run(id);
}

function interventionCount(id) {
  return db.prepare('SELECT COUNT(*) AS n FROM interventions WHERE datacenter_id = ?').get(id).n;
}

module.exports = { list, findById, create, update, remove, interventionCount };
