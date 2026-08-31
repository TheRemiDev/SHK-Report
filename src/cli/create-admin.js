#!/usr/bin/env node
/**
 * Crée (ou met à jour) un compte administrateur.
 * Usage : node src/cli/create-admin.js "Nom Complet" email@exemple.fr motdepasse
 */
require('../db/db');
const users = require('../models/users');

const [, , fullName, email, password] = process.argv;

if (!fullName || !email || !password) {
  console.error('Usage: node src/cli/create-admin.js "Nom Complet" email@exemple.fr motdepasse');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Le mot de passe doit contenir au moins 8 caractères.');
  process.exit(1);
}

const existing = users.findByEmail(email);
if (existing) {
  users.resetPassword(existing.id, password);
  users.updateRole(existing.id, 'admin');
  users.setActive(existing.id, true);
  console.log(`Compte administrateur mis à jour : ${email}`);
} else {
  users.create({ fullName, email, password, role: 'admin' });
  console.log(`Compte administrateur créé : ${email}`);
}
