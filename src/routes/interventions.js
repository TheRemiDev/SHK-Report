const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const interventions = require('../models/interventions');
const clients = require('../models/clients');
const { uploadPhotos, photosDir } = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const { buildInterventionPdf } = require('../services/pdfService');

const router = express.Router();

const SHARE_LINK_DAYS = 30;

function normalizeClientFields(body) {
  const isInternal = body.is_internal === 'on' || body.is_internal === '1';
  if (isInternal) {
    return { is_internal: 1, client_id: null, client_name: 'Intervention interne', client_contact: null };
  }

  const clientId = body.client_id ? parseInt(body.client_id, 10) : null;
  if (Number.isInteger(clientId)) {
    const record = clients.findById(clientId);
    if (record) {
      return {
        is_internal: 0,
        client_id: record.id,
        client_name: record.name,
        client_contact: body.client_contact || record.contact_name || '',
      };
    }
  }

  return {
    is_internal: 0,
    client_id: null,
    client_name: body.client_name || '',
    client_contact: body.client_contact || '',
  };
}

router.get('/', (req, res) => {
  const { q, status, type, datacenter, client, dateFrom, dateTo, sort, page } = req.query;
  const result = interventions.search({
    q,
    status,
    type,
    datacenter,
    client,
    dateFrom,
    dateTo,
    sort,
    page: parseInt(page, 10) || 1,
    pageSize: 15,
  });
  const stats = interventions.stats();

  res.render('dashboard', {
    title: 'Tableau de bord',
    result,
    stats,
    filters: { q, status, type, datacenter, client, dateFrom, dateTo, sort },
    datacenters: interventions.distinctValues('datacenter_name'),
    clients: interventions.distinctValues('client_name'),
    STATUSES: interventions.STATUSES,
    TYPES: interventions.TYPES,
  });
});

router.get('/interventions/new', (req, res) => {
  const preselectedClient = req.query.newClientId ? clients.findById(req.query.newClientId) : null;
  res.render('intervention-form', {
    title: 'Nouveau rapport d’intervention',
    intervention: null,
    preselectedClient,
    clientsList: clients.list(),
    datacenters: interventions.distinctValues('datacenter_name'),
    technicians: interventions.distinctValues('technician_name'),
    STATUSES: interventions.STATUSES,
    TYPES: interventions.TYPES,
    PRIORITIES: interventions.PRIORITIES,
  });
});

router.post('/interventions', uploadPhotos, (req, res) => {
  try {
    const photos = (req.files || []).map((f) => f.filename);
    const data = { ...req.body, ...normalizeClientFields(req.body), photos: JSON.stringify(photos) };
    const record = interventions.create(data, req.session.user.id);
    req.flash('success', `Rapport ${record.reference} créé avec succès.`);
    res.redirect(`/interventions/${record.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', "Impossible de créer le rapport : " + err.message);
    res.redirect('/interventions/new');
  }
});

router.get('/interventions/:id', (req, res) => {
  const record = interventions.findById(req.params.id);
  if (!record) return res.status(404).render('errors/404', { title: 'Introuvable' });
  const shareUrl = record.share_token ? `${req.protocol}://${req.get('host')}/share/${record.share_token}` : null;
  res.render('intervention-detail', {
    title: record.reference,
    intervention: record,
    photos: JSON.parse(record.photos || '[]'),
    shareUrl,
  });
});

router.get('/interventions/:id/edit', (req, res) => {
  const record = interventions.findById(req.params.id);
  if (!record) return res.status(404).render('errors/404', { title: 'Introuvable' });
  res.render('intervention-form', {
    title: `Modifier ${record.reference}`,
    intervention: record,
    preselectedClient: null,
    clientsList: clients.list(),
    datacenters: interventions.distinctValues('datacenter_name'),
    technicians: interventions.distinctValues('technician_name'),
    STATUSES: interventions.STATUSES,
    TYPES: interventions.TYPES,
    PRIORITIES: interventions.PRIORITIES,
  });
});

router.post('/interventions/:id', uploadPhotos, (req, res) => {
  const record = interventions.findById(req.params.id);
  if (!record) return res.status(404).render('errors/404', { title: 'Introuvable' });

  try {
    const existing = JSON.parse(record.photos || '[]');
    const removed = new Set(
      [].concat(req.body.remove_photos || []).filter(Boolean)
    );
    for (const filename of removed) {
      const p = path.join(photosDir, path.basename(filename));
      fs.unlink(p, () => {});
    }
    const kept = existing.filter((f) => !removed.has(f));
    const added = (req.files || []).map((f) => f.filename);
    const photos = [...kept, ...added];

    const data = { ...req.body, ...normalizeClientFields(req.body), photos: JSON.stringify(photos) };
    interventions.update(req.params.id, data);
    req.flash('success', 'Rapport mis à jour.');
    res.redirect(`/interventions/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', "Impossible de mettre à jour le rapport : " + err.message);
    res.redirect(`/interventions/${req.params.id}/edit`);
  }
});

router.post('/interventions/:id/delete', requireAdmin, (req, res) => {
  const record = interventions.findById(req.params.id);
  if (record) {
    for (const filename of JSON.parse(record.photos || '[]')) {
      fs.unlink(path.join(photosDir, path.basename(filename)), () => {});
    }
    interventions.remove(req.params.id);
    req.flash('success', `Rapport ${record.reference} supprimé.`);
  }
  res.redirect('/');
});

router.get('/interventions/:id/pdf', async (req, res) => {
  const record = interventions.findById(req.params.id);
  if (!record) return res.status(404).render('errors/404', { title: 'Introuvable' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Rapport-${record.reference}.pdf"`);

  try {
    await buildInterventionPdf(record, res);
    interventions.markPdfGenerated(record.id);
  } catch (err) {
    console.error('Erreur génération PDF', err);
    if (!res.headersSent) res.status(500).send('Erreur lors de la génération du PDF.');
  }
});

router.post('/interventions/:id/share', (req, res) => {
  const record = interventions.findById(req.params.id);
  if (!record) return res.status(404).render('errors/404', { title: 'Introuvable' });
  if (record.is_internal) {
    req.flash('error', 'Une intervention interne ne peut pas être partagée à un client.');
    return res.redirect(`/interventions/${record.id}`);
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SHARE_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  interventions.setShareToken(record.id, token, expiresAt);
  req.flash('success', `Lien client généré, valable ${SHARE_LINK_DAYS} jours.`);
  res.redirect(`/interventions/${record.id}`);
});

router.post('/interventions/:id/share/revoke', (req, res) => {
  interventions.revokeShareToken(req.params.id);
  req.flash('success', 'Lien client révoqué.');
  res.redirect(`/interventions/${req.params.id}`);
});

router.get('/api/suggest', (req, res) => {
  const field = req.query.field;
  const allowed = { datacenter: 'datacenter_name', client: 'client_name', technician: 'technician_name' };
  if (!allowed[field]) return res.json([]);
  res.json(interventions.distinctValues(allowed[field]));
});

module.exports = router;
