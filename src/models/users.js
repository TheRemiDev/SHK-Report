const bcrypt = require('bcryptjs');
const db = require('../db/db');

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function list() {
  return db.prepare('SELECT id, full_name, email, role, active, created_at FROM users ORDER BY full_name').all();
}

function count() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

function create({ fullName, email, password, role = 'technicien' }) {
  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`
    )
    .run(fullName, String(email).toLowerCase().trim(), hash, role);
  return findById(info.lastInsertRowid);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

function setActive(id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

function updateRole(id, role) {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

function resetPassword(id, password) {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

module.exports = {
  findByEmail,
  findById,
  list,
  count,
  create,
  verifyPassword,
  setActive,
  updateRole,
  resetPassword,
};
