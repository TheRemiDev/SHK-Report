const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('../config');
const settings = require('../db/settings');
const {
  INK,
  TEAL,
  SLATE,
  LIGHT,
  BORDER,
  PAGE,
  MARGIN_X,
  CONTENT_TOP,
  MARGIN_BOTTOM,
  drawLogo,
  ensureSpace,
  drawContentHeader,
  paginate,
  sectionTitle,
  bodyParagraph,
  badge,
  infoRow,
  drawSignatureBox,
} = require('./pdfKit');
const {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDateFr,
  formatDateTimeFr,
} = require('./pdfLabels');

function drawCover(doc, record, company) {
  // Bandeau supérieur sombre
  doc.rect(0, 0, PAGE.width, 190).fill(INK);
  drawLogo(doc, MARGIN_X, 58, 240, '#FFFFFF');

  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#B7BEC8')
    .text(company.company_website || 'shiftek.fr', PAGE.width - MARGIN_X - 200, 62, {
      width: 200,
      align: 'right',
    });

  // Titre
  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(INK)
    .text('RAPPORT D’INTERVENTION', MARGIN_X, 224, { characterSpacing: 0.3 });

  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor(SLATE)
    .text(record.title || TYPE_LABELS[record.type] || '', MARGIN_X, 256);

  let by = 292;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEAL).text('RÉFÉRENCE', MARGIN_X, by);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(record.reference, MARGIN_X, by + 13);

  const bx = MARGIN_X + 220;
  const w1 = badge(
    doc,
    bx,
    by + 12,
    STATUS_LABELS[record.status] || record.status,
    STATUS_COLORS[record.status] || SLATE
  );
  badge(
    doc,
    bx + w1 + 10,
    by + 12,
    `Priorité ${PRIORITY_LABELS[record.priority] || record.priority}`,
    PRIORITY_COLORS[record.priority] || SLATE
  );

  // Carte d'informations
  const cardY = 350;
  const cardH = 230;
  doc.roundedRect(MARGIN_X, cardY, PAGE.width - MARGIN_X * 2, cardH, 6).fillAndStroke(LIGHT, BORDER);

  const colW = (PAGE.width - MARGIN_X * 2 - 60) / 2;
  const col1 = MARGIN_X + 24;
  const col2 = MARGIN_X + 24 + colW + 12;
  let ry = cardY + 24;
  const rowGap = 42;

  infoRow(doc, col1, ry, colW, record.is_internal ? 'Intervention' : 'Client', record.client_name);
  infoRow(doc, col2, ry, colW, 'Contact client', record.client_contact);
  ry += rowGap;
  infoRow(doc, col1, ry, colW, 'DataCenter', record.datacenter_name);
  infoRow(doc, col2, ry, colW, 'Adresse', record.datacenter_address);
  ry += rowGap;
  infoRow(doc, col1, ry, colW, 'Salle', record.datacenter_room);
  infoRow(doc, col2, ry, colW, 'Baie / Rack', record.rack_reference);
  ry += rowGap;
  infoRow(doc, col1, ry, colW, 'Date d’intervention', formatDateFr(record.intervention_date));
  infoRow(
    doc,
    col2,
    ry,
    colW,
    'Horaires',
    record.start_time || record.end_time
      ? `${record.start_time || '—'} - ${record.end_time || '—'}`
      : '—'
  );
  ry += rowGap;
  infoRow(doc, col1, ry, colW, 'Technicien(s)', record.technician_name);
  infoRow(doc, col2, ry, colW, 'Type d’intervention', TYPE_LABELS[record.type] || record.type);

  doc.y = cardY + cardH + 30;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(SLATE)
    .text(
      `Document généré le ${formatDateTimeFr(new Date().toISOString())} par ${company.company_name}.`,
      MARGIN_X,
      doc.y,
      { width: PAGE.width - MARGIN_X * 2 }
    );
}

function drawSignatures(doc, record) {
  sectionTitle(doc, 'Signatures');
  ensureSpace(doc, 170);
  const boxH = 150;
  const y = doc.y + 4;
  const fullW = PAGE.width - MARGIN_X * 2;
  const boxW = record.is_internal ? fullW : (fullW - 24) / 2;

  drawSignatureBox(doc, {
    x: MARGIN_X,
    width: boxW,
    height: boxH,
    y,
    title: 'Technicien Shiftek',
    name: record.technician_name,
    signatureData: record.technician_signature_data,
    dateLabel: `Date : ${formatDateFr(record.intervention_date)}`,
  });

  if (!record.is_internal) {
    drawSignatureBox(doc, {
      x: MARGIN_X + boxW + 24,
      width: boxW,
      height: boxH,
      y,
      title: 'Représentant client',
      name: record.client_signature_name,
      signatureData: record.client_signature_data,
      dateLabel: record.client_signed_at
        ? `Signé le : ${formatDateFr(record.client_signed_at.slice(0, 10))}`
        : `Date : ${formatDateFr(record.intervention_date)}`,
    });
  }

  doc.y = y + boxH + 10;
}

function drawPhotos(doc, record, photos) {
  if (!photos || !photos.length) return;
  sectionTitle(doc, `Photos de l’intervention (${photos.length})`);

  const cols = 2;
  const gap = 16;
  const boxW = (PAGE.width - MARGIN_X * 2 - gap) / cols;
  const boxH = 160;

  for (let i = 0; i < photos.length; i++) {
    const col = i % cols;
    if (col === 0) ensureSpace(doc, boxH + 20);
    const x = MARGIN_X + col * (boxW + gap);
    const y = doc.y;

    const filePath = path.join(config.uploadDir, 'photos', photos[i]);
    doc.roundedRect(x, y, boxW, boxH, 4).fillAndStroke(LIGHT, BORDER);
    if (fs.existsSync(filePath)) {
      try {
        doc.image(filePath, x + 6, y + 6, { fit: [boxW - 12, boxH - 22], align: 'center', valign: 'center' });
      } catch {
        /* image illisible, ignorée */
      }
    }
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(SLATE)
      .text(`Photo ${i + 1}`, x + 6, y + boxH - 13);

    if (col === cols - 1 || i === photos.length - 1) doc.y = y + boxH + 14;
  }
}

async function buildInterventionPdf(record, outputStream) {
  const company = settings.getAll();
  const doc = new PDFDocument({
    size: PAGE.size,
    margins: { top: CONTENT_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X },
    bufferPages: true,
    info: {
      Title: `Rapport d'intervention ${record.reference}`,
      Author: company.company_name,
      Subject: 'Rapport d’intervention DataCenter',
    },
  });

  doc.pipe(outputStream);

  // --- Page de garde ---
  drawCover(doc, record, company);

  // --- Pages de contenu ---
  const eyebrow = 'RAPPORT D’INTERVENTION DATACENTER';
  doc.addPage();
  doc.on('pageAdded', () => drawContentHeader(doc, record.reference, eyebrow));
  drawContentHeader(doc, record.reference, eyebrow);

  if (record.context) {
    sectionTitle(doc, "Contexte de l'intervention");
    bodyParagraph(doc, record.context);
  }
  if (record.actions_taken) {
    sectionTitle(doc, 'Actions réalisées');
    bodyParagraph(doc, record.actions_taken);
  }
  if (record.equipment_involved) {
    sectionTitle(doc, 'Matériel concerné');
    bodyParagraph(doc, record.equipment_involved);
  }
  if (record.incidents) {
    sectionTitle(doc, 'Incidents rencontrés');
    bodyParagraph(doc, record.incidents);
  }
  if (record.recommendations) {
    sectionTitle(doc, 'Recommandations');
    bodyParagraph(doc, record.recommendations);
  }

  const photos = JSON.parse(record.photos || '[]');
  drawPhotos(doc, record, photos);

  drawSignatures(doc, record);

  paginate(doc, company);
  doc.end();

  return new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
    doc.on('error', reject);
  });
}

module.exports = { buildInterventionPdf };
