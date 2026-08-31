const db = require('../db/db');

/**
 * Génère une référence séquentielle du type PREFIX-2026-0001, réinitialisée
 * chaque année, pour une table et une colonne données.
 */
function generateReferenceFor(table, prefixBase, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `${prefixBase}-${year}-`;

  const row = db
    .prepare(
      `SELECT reference FROM ${table}
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

function generateReference(date = new Date()) {
  return generateReferenceFor('interventions', 'SHK', date);
}

function generateTripReference(date = new Date()) {
  return generateReferenceFor('trip_logs', 'FDR', date);
}

module.exports = { generateReference, generateTripReference };
