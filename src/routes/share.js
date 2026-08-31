const express = require('express');
const interventions = require('../models/interventions');
const settings = require('../db/settings');

const router = express.Router();

function dataUrlLooksValid(value) {
  return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 400000;
}

router.get('/share/:token', (req, res) => {
  const record = interventions.findByShareToken(req.params.token);
  if (!record) {
    return res.status(404).render('share-invalid', { title: 'Lien indisponible' });
  }
  res.render('share', {
    title: `Rapport ${record.reference}`,
    intervention: record,
    photos: JSON.parse(record.photos || '[]'),
    company: settings.getAll(),
  });
});

router.post('/share/:token/sign', (req, res) => {
  const record = interventions.findByShareToken(req.params.token);
  if (!record) {
    return res.status(404).render('share-invalid', { title: 'Lien indisponible' });
  }
  if (record.client_signed_at) {
    req.flash('error', 'Ce rapport a déjà été signé.');
    return res.redirect(`/share/${req.params.token}`);
  }

  const { name, signature } = req.body;
  if (!dataUrlLooksValid(signature)) {
    req.flash('error', 'Merci de signer dans le cadre prévu avant de valider.');
    return res.redirect(`/share/${req.params.token}`);
  }

  interventions.recordClientSignature(record.id, { name, signatureData: signature });
  req.flash('success', 'Merci, votre signature a bien été enregistrée.');
  res.redirect(`/share/${req.params.token}`);
});

module.exports = router;
