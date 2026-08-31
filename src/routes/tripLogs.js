const fs = require('fs');
const path = require('path');
const express = require('express');
const tripLogs = require('../models/tripLogs');
const { requireAdmin } = require('../middleware/auth');
const { uploadPhotos, photosDir } = require('../middleware/upload');
const { buildTripPdf } = require('../services/tripPdfService');

const router = express.Router();

function normalizeTripFields(body) {
  const isRoundTrip = body.trip_mode === 'aller_retour';
  const returnAddress = isRoundTrip ? (body.return_address || '').trim() : '';
  return { return_address: returnAddress || null };
}

router.get('/trips', (req, res) => {
  const { q, dateFrom, dateTo, page } = req.query;
  const result = tripLogs.search({ q, dateFrom, dateTo, page: parseInt(page, 10) || 1, pageSize: 15 });
  const stats = tripLogs.stats();

  res.render('trips/list', {
    title: 'Fiches de route',
    result,
    stats,
    filters: { q, dateFrom, dateTo },
  });
});

router.get('/trips/new', (req, res) => {
  res.render('trips/form', { title: 'Nouvelle fiche de route', trip: null, photos: [] });
});

router.post('/trips', uploadPhotos, (req, res) => {
  try {
    const detours = [].concat(req.body.detour || []).filter((d) => d && d.trim());
    const photos = (req.files || []).map((f) => f.filename);
    const data = {
      ...req.body,
      detours: JSON.stringify(detours),
      ...normalizeTripFields(req.body),
      photos: JSON.stringify(photos),
    };
    const record = tripLogs.create(data, req.session.user.id);
    req.flash('success', `Fiche de route ${record.reference} créée.`);
    res.redirect(`/trips/${record.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Impossible de créer la fiche de route : ' + err.message);
    res.redirect('/trips/new');
  }
});

router.get('/trips/:id', (req, res) => {
  const trip = tripLogs.findById(req.params.id);
  if (!trip) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('trips/detail', {
    title: trip.reference,
    trip,
    detours: JSON.parse(trip.detours || '[]'),
    photos: JSON.parse(trip.photos || '[]'),
  });
});

router.get('/trips/:id/edit', (req, res) => {
  const trip = tripLogs.findById(req.params.id);
  if (!trip) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('trips/form', { title: `Modifier ${trip.reference}`, trip, photos: JSON.parse(trip.photos || '[]') });
});

router.post('/trips/:id', uploadPhotos, (req, res) => {
  const trip = tripLogs.findById(req.params.id);
  if (!trip) return res.status(404).render('errors/404', { title: 'Introuvable' });
  try {
    const detours = [].concat(req.body.detour || []).filter((d) => d && d.trim());

    const existing = JSON.parse(trip.photos || '[]');
    const removed = new Set([].concat(req.body.remove_photos || []).filter(Boolean));
    for (const filename of removed) {
      fs.unlink(path.join(photosDir, path.basename(filename)), () => {});
    }
    const kept = existing.filter((f) => !removed.has(f));
    const added = (req.files || []).map((f) => f.filename);
    const photos = [...kept, ...added];

    const data = {
      ...req.body,
      detours: JSON.stringify(detours),
      ...normalizeTripFields(req.body),
      photos: JSON.stringify(photos),
    };
    tripLogs.update(trip.id, data);
    req.flash('success', 'Fiche de route mise à jour.');
    res.redirect(`/trips/${trip.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Impossible de mettre à jour la fiche : ' + err.message);
    res.redirect(`/trips/${trip.id}/edit`);
  }
});

router.post('/trips/:id/delete', requireAdmin, (req, res) => {
  const trip = tripLogs.findById(req.params.id);
  if (trip) {
    for (const filename of JSON.parse(trip.photos || '[]')) {
      fs.unlink(path.join(photosDir, path.basename(filename)), () => {});
    }
    tripLogs.remove(trip.id);
    req.flash('success', `Fiche ${trip.reference} supprimée.`);
  }
  res.redirect('/trips');
});

router.get('/trips/:id/pdf', async (req, res) => {
  const trip = tripLogs.findById(req.params.id);
  if (!trip) return res.status(404).render('errors/404', { title: 'Introuvable' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Fiche-de-route-${trip.reference}.pdf"`);

  try {
    await buildTripPdf(trip, res);
  } catch (err) {
    console.error('Erreur génération PDF fiche de route', err);
    if (!res.headersSent) res.status(500).send('Erreur lors de la génération du PDF.');
  }
});

module.exports = router;
