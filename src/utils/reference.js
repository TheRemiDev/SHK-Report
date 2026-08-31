const db = require('../db/db');

/**
 * Génère une référence séquentielle du type SHK-2026-0001, réinitialisée chaque année.
 */
function generateReference(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `SHK-${year}-`;

  const row = db
    .prepare(
      `SELECT reference FROM interventions
       WHERE reference LIKE ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(`${prefix}%`);

  let next = 1;
  if (row) {
    const lastNum = parseInt(row.reference.slice(prefix.length), 10);
    if (!Number.isNaN(lastNum)) next = lastNum + 1;
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}

module.exports = { generateReference };
