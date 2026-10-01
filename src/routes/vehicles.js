const express = require('express');
const vehicles = require('../models/vehicles');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/vehicles', (req, res) => {
  const list = vehicles.list(req.query.q);
  res.render('vehicles/list', {
    title: 'Parc véhicules',
    vehicles: list.map((v) => ({ ...v, tripCount: vehicles.tripCount(v.id) })),
    q: req.query.q || '',
  });
});

router.get('/vehicles/new', (req, res) => {
  res.render('vehicles/form', {
    title: 'Nouveau véhicule',
    vehicle: null,
    returnTo: req.query.returnTo || '',
  });
});

router.post('/vehicles', (req, res) => {
  const { brand, model, plate, notes, returnTo } = req.body;
  if (!brand || !brand.trim()) {
    req.flash('error', 'La marque du véhicule est requise.');
    return res.redirect('/vehicles/new');
  }
  if (!plate || !plate.trim()) {
    req.flash('error', "L'immatriculation du véhicule est requise.");
    return res.redirect('/vehicles/new');
  }
  const vehicle = vehicles.create({ brand, model, plate, notes });
  req.flash('success', `Véhicule « ${vehicles.label(vehicle)} » créé.`);
  const back = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
  res.redirect(back ? `${back}${back.includes('?') ? '&' : '?'}newVehicleId=${vehicle.id}` : '/vehicles');
});

router.get('/vehicles/:id/edit', (req, res) => {
  const vehicle = vehicles.findById(req.params.id);
  if (!vehicle) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('vehicles/form', { title: `Modifier ${vehicles.label(vehicle)}`, vehicle, returnTo: '' });
});

router.post('/vehicles/:id', (req, res) => {
  const vehicle = vehicles.findById(req.params.id);
  if (!vehicle) return res.status(404).render('errors/404', { title: 'Introuvable' });
  const { brand, model, plate, notes } = req.body;
  if (!brand || !brand.trim()) {
    req.flash('error', 'La marque du véhicule est requise.');
    return res.redirect(`/vehicles/${vehicle.id}/edit`);
  }
  if (!plate || !plate.trim()) {
    req.flash('error', "L'immatriculation du véhicule est requise.");
    return res.redirect(`/vehicles/${vehicle.id}/edit`);
  }
  vehicles.update(vehicle.id, { brand, model, plate, notes });
  req.flash('success', 'Véhicule mis à jour.');
  res.redirect('/vehicles');
});

router.post('/vehicles/:id/delete', requireAdmin, (req, res) => {
  const vehicle = vehicles.findById(req.params.id);
  if (vehicle) {
    if (vehicles.tripCount(vehicle.id) > 0) {
      req.flash('error', `Impossible de supprimer « ${vehicle.brand} » : des fiches de route y sont liées.`);
    } else {
      vehicles.remove(vehicle.id);
      req.flash('success', `Véhicule « ${vehicle.brand} » supprimé.`);
    }
  }
  res.redirect('/vehicles');
});

module.exports = router;
