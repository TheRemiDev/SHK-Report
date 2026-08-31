const express = require('express');
const clients = require('../models/clients');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/clients', (req, res) => {
  const list = clients.list(req.query.q);
  res.render('clients/list', {
    title: 'Clients',
    clients: list.map((c) => ({ ...c, interventionCount: clients.interventionCount(c.id) })),
    q: req.query.q || '',
  });
});

router.get('/clients/new', (req, res) => {
  res.render('clients/form', { title: 'Nouveau client', client: null, returnTo: req.query.returnTo || '' });
});

router.post('/clients', (req, res) => {
  const { name, contact_name, contact_email, contact_phone, address, notes, returnTo } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Le nom du client est requis.');
    return res.redirect('/clients/new');
  }
  const client = clients.create({ name, contact_name, contact_email, contact_phone, address, notes });
  req.flash('success', `Client « ${client.name} » créé.`);
  const back = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
  res.redirect(back ? `${back}${back.includes('?') ? '&' : '?'}newClientId=${client.id}` : '/clients');
});

router.get('/clients/:id/edit', (req, res) => {
  const client = clients.findById(req.params.id);
  if (!client) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('clients/form', { title: `Modifier ${client.name}`, client });
});

router.post('/clients/:id', (req, res) => {
  const client = clients.findById(req.params.id);
  if (!client) return res.status(404).render('errors/404', { title: 'Introuvable' });
  const { name, contact_name, contact_email, contact_phone, address, notes } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Le nom du client est requis.');
    return res.redirect(`/clients/${client.id}/edit`);
  }
  clients.update(client.id, { name, contact_name, contact_email, contact_phone, address, notes });
  req.flash('success', 'Client mis à jour.');
  res.redirect('/clients');
});

router.post('/clients/:id/delete', requireAdmin, (req, res) => {
  const client = clients.findById(req.params.id);
  if (client) {
    if (clients.interventionCount(client.id) > 0) {
      req.flash('error', `Impossible de supprimer « ${client.name} » : des rapports y sont liés.`);
    } else {
      clients.remove(client.id);
      req.flash('success', `Client « ${client.name} » supprimé.`);
    }
  }
  res.redirect('/clients');
});


module.exports = router;
