// Exécute simplement le schéma (idempotent, CREATE TABLE IF NOT EXISTS).
// Utilisé par install.sh et disponible via `npm run migrate`.
require('./db');
console.log('Base de données prête.');
