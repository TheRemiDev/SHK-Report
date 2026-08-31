const db = require('../db/db');

function list(q) {
  if (q) {
    return db
      .prepare(
        `SELECT * FROM clients WHERE name LIKE @q OR contact_name LIKE @q OR contact_email LIKE @q
         ORDER BY name COLLATE NOCASE`
      )
      .all({ q: `%${q}%` });
  }
  return db.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
}

function create(data) {
  const info = db
    .prepare(
      `INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes)
       VALUES (@name, @contact_name, @contact_email, @contact_phone, @address, @notes)`
    )
    .run({
      name: data.name,
      contact_name: data.contact_name || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      notes: data.notes || null,
    });
  return findById(info.lastInsertRowid);
}

function update(id, data) {
  db.prepare(
    `UPDATE clients SET name = @name, contact_name = @contact_name, contact_email = @contact_email,
     contact_phone = @contact_phone, address = @address, notes = @notes, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    name: data.name,
    contact_name: data.contact_name || null,
    contact_email: data.contact_email || null,
    contact_phone: data.contact_phone || null,
    address: data.address || null,
    notes: data.notes || null,
  });
  return findById(id);
}

function remove(id) {
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}

function interventionCount(id) {
  return db.prepare('SELECT COUNT(*) AS n FROM interventions WHERE client_id = ?').get(id).n;
}

module.exports = { list, findById, create, update, remove, interventionCount };
