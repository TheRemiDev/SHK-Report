const express = require('express');
const datacenters = require('../models/datacenters');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/datacenters', (req, res) => {
  const list = datacenters.list(req.query.q);
  res.render('datacenters/list', {
    title: 'DataCenters',
    datacenters: list.map((d) => ({ ...d, interventionCount: datacenters.interventionCount(d.id) })),
    q: req.query.q || '',
  });
});

router.get('/datacenters/new', (req, res) => {
  res.render('datacenters/form', {
    title: 'Nouveau DataCenter',
    datacenter: null,
    returnTo: req.query.returnTo || '',
  });
});

router.post('/datacenters', (req, res) => {
  const { name, address, notes, returnTo } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Le nom du DataCenter est requis.');
    return res.redirect('/datacenters/new');
  }
  const datacenter = datacenters.create({ name, address, notes });
  req.flash('success', `DataCenter « ${datacenter.name} » créé.`);
  const back = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
  res.redirect(back ? `${back}${back.includes('?') ? '&' : '?'}newDatacenterId=${datacenter.id}` : '/datacenters');
});

router.get('/datacenters/:id/edit', (req, res) => {
  const datacenter = datacenters.findById(req.params.id);
  if (!datacenter) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('datacenters/form', { title: `Modifier ${datacenter.name}`, datacenter, returnTo: '' });
});

router.post('/datacenters/:id', (req, res) => {
  const datacenter = datacenters.findById(req.params.id);
  if (!datacenter) return res.status(404).render('errors/404', { title: 'Introuvable' });
  const { name, address, notes } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Le nom du DataCenter est requis.');
    return res.redirect(`/datacenters/${datacenter.id}/edit`);
  }
  datacenters.update(datacenter.id, { name, address, notes });
  req.flash('success', 'DataCenter mis à jour.');
  res.redirect('/datacenters');
});

router.post('/datacenters/:id/delete', requireAdmin, (req, res) => {
  const datacenter = datacenters.findById(req.params.id);
  if (datacenter) {
    if (datacenters.interventionCount(datacenter.id) > 0) {
      req.flash('error', `Impossible de supprimer « ${datacenter.name} » : des rapports y sont liés.`);
    } else {
      datacenters.remove(datacenter.id);
      req.flash('success', `DataCenter « ${datacenter.name} » supprimé.`);
    }
  }
  res.redirect('/datacenters');
});

module.exports = router;
