const fs = require('fs');
const path = require('path');
const express = require('express');
const users = require('../models/users');
const settings = require('../db/settings');
const { requireAdmin } = require('../middleware/auth');
const { uploadLogo, brandingDir, LOGO_MIME_EXT } = require('../middleware/upload');

const router = express.Router();

router.use(requireAdmin);

router.get('/admin/users', (req, res) => {
  res.render('admin/users', { title: 'Utilisateurs', users: users.list() });
});

router.post('/admin/users', (req, res) => {
  const { fullName, email, password, role } = req.body;
  try {
    if (!fullName || !email || !password) throw new Error('Tous les champs sont requis.');
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    if (users.findByEmail(email)) throw new Error('Cet email est déjà utilisé.');
    users.create({ fullName, email, password, role: role === 'admin' ? 'admin' : 'technicien' });
    req.flash('success', 'Utilisateur créé.');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/toggle', (req, res) => {
  const user = users.findById(req.params.id);
  if (user) {
    if (user.id === req.session.user.id) {
      req.flash('error', 'Vous ne pouvez pas désactiver votre propre compte.');
    } else {
      users.setActive(user.id, !user.active);
      req.flash('success', `Compte ${user.active ? 'désactivé' : 'activé'}.`);
    }
  }
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/reset-password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    req.flash('error', 'Le mot de passe doit contenir au moins 8 caractères.');
    return res.redirect('/admin/users');
  }
  users.resetPassword(req.params.id, password);
  req.flash('success', 'Mot de passe réinitialisé.');
  res.redirect('/admin/users');
});

router.get('/admin/settings', (req, res) => {
  res.render('admin/settings', { title: 'Paramètres de l’entreprise', settings: settings.getAll() });
});

router.post('/admin/settings', (req, res) => {
  const { company_name, company_address, company_email, company_phone, company_website } = req.body;
  settings.setMany({ company_name, company_address, company_email, company_phone, company_website });
  req.flash('success', 'Paramètres enregistrés.');
  res.redirect('/admin/settings');
});

function removeExistingLogoFiles() {
  for (const ext of Object.values(LOGO_MIME_EXT)) {
    const p = path.join(brandingDir, `company-logo${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

router.post('/admin/settings/logo', uploadLogo, (req, res) => {
  if (!req.file) {
    req.flash('error', 'Merci de sélectionner un fichier.');
    return res.redirect('/admin/settings');
  }
  const ext = LOGO_MIME_EXT[req.file.mimetype];
  removeExistingLogoFiles();
  const filename = `company-logo${ext}`;
  fs.writeFileSync(path.join(brandingDir, filename), req.file.buffer);
  settings.setMany({ company_logo_filename: filename, company_logo_mime: req.file.mimetype });
  req.flash('success', 'Logo mis à jour. Il est désormais utilisé sur le site et dans les PDF.');
  res.redirect('/admin/settings');
});

router.post('/admin/settings/logo/remove', (req, res) => {
  removeExistingLogoFiles();
  settings.setMany({ company_logo_filename: '', company_logo_mime: '' });
  req.flash('success', 'Logo retiré.');
  res.redirect('/admin/settings');
});

module.exports = router;
