const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const config = require('../config');
const settings = require('../db/settings');
const {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDateFr,
  formatDateTimeFr,
} = require('./pdfLabels');

const INK = '#0A0A0C';
const TEAL = '#0F9E8F';
const SLATE = '#5B6472';
const LIGHT = '#F4F5F7';
const BORDER = '#E2E5EA';
const WHITE = '#FFFFFF';

const PAGE = { size: 'A4', width: 595.28, height: 841.89 };
const MARGIN_X = 50;
const CONTENT_TOP = 108;
const MARGIN_BOTTOM = 95;
const MAX_CONTENT_Y = PAGE.height - MARGIN_BOTTOM - 8; // dernière position sûre avant le pied de page
const FOOTER_Y = 800;

const LOGO_RAW = fs.readFileSync(
  path.join(config.root, 'src', 'public', 'assets', 'logo.svg'),
  'utf8'
);
const LOGO_NATIVE_W = 950;
const LOGO_NATIVE_H = 300;

function logoColored(color) {
  return LOGO_RAW.replace(/currentColor/g, color);
}

/**
 * svg-to-pdfkit convertit width/height en pixels CSS (1px = 72/96pt) et ne
 * respecte pas toujours un ratio custom width+height. On dessine donc le SVG
 * à sa taille native (en points, assumePt) puis on applique nous-mêmes une
 * échelle via doc.scale() pour obtenir une taille finale fiable et prévisible.
 */
function drawLogo(doc, x, y, targetWidth, color) {
  const scale = targetWidth / LOGO_NATIVE_W;
  doc.save();
  doc.translate(x, y).scale(scale);
  SVGtoPDF(doc, logoColored(color), 0, 0, {
    width: LOGO_NATIVE_W,
    height: LOGO_NATIVE_H,
    assumePt: true,
  });
  doc.restore();
}

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
}

function drawContentHeader(doc, record) {
  const top = 40;
  const rightBoxX = PAGE.width - MARGIN_X - 260;
  const rightBoxW = 260;

  drawLogo(doc, MARGIN_X, top, 150, INK);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(INK)
    .text(record.reference, rightBoxX, top + 2, { width: rightBoxW, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(SLATE)
    .text('RAPPORT D’INTERVENTION DATACENTER', rightBoxX, top + 15, {
      width: rightBoxW,
      align: 'right',
      characterSpacing: 0.3,
    });

  doc
    .moveTo(MARGIN_X, top + 34)
    .lineTo(PAGE.width - MARGIN_X, top + 34)
    .lineWidth(1.4)
    .strokeColor(TEAL)
    .stroke();

  doc.y = CONTENT_TOP;
}

function drawFooter(doc, { company, pageLabel, cover = false }) {
  const y = FOOTER_Y;
  // Le pied de page se trouve dans la marge basse du document : on neutralise
  // temporairement cette marge pour que PDFKit n'insère pas une page
  // supplémentaire en pensant que le texte déborde.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.moveTo(MARGIN_X, y).lineTo(PAGE.width - MARGIN_X, y).lineWidth(0.75).strokeColor(BORDER).stroke();

  const left = [company.company_name, company.company_website, company.company_email]
    .filter(Boolean)
    .join('  •  ');

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(SLATE)
    .text(left || ' ', MARGIN_X, y + 8, { width: 320 });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(SLATE)
    .text(pageLabel, MARGIN_X, y + 8, { width: PAGE.width - MARGIN_X * 2, align: 'right' });

  doc
    .font('Helvetica-Oblique')
    .fontSize(7)
    .fillColor('#9AA2AE')
    .text(
      'Document confidentiel — usage interne et client autorisé uniquement.',
      MARGIN_X,
      y + 19,
      { width: PAGE.width - MARGIN_X * 2, align: cover ? 'left' : 'center' }
    );

  doc.page.margins.bottom = savedBottom;
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 40);
  const y = doc.y + 14;
  doc.rect(MARGIN_X, y, 4, 14).fill(TEAL);
  doc
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .fillColor(INK)
    .text(text.toUpperCase(), MARGIN_X + 12, y - 1, { characterSpacing: 0.4 });
  doc.y = y + 22;
}

function bodyParagraph(doc, text) {
  doc
    .font('Helvetica')
    .fontSize(10.2)
    .fillColor('#1F2430')
    .text(text, MARGIN_X, doc.y, {
      width: PAGE.width - MARGIN_X * 2,
      align: 'justify',
      lineGap: 3.2,
    });
  doc.moveDown(0.6);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > MAX_CONTENT_Y) {
    doc.addPage();
  }
}

function badge(doc, x, y, text, color) {
  doc.font('Helvetica-Bold').fontSize(8.5);
  const w = doc.widthOfString(text.toUpperCase()) + 18;
  doc.roundedRect(x, y, w, 17, 8.5).fill(color);
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(WHITE)
    .text(text.toUpperCase(), x, y + 4.5, { width: w, align: 'center' });
  return w;
}

function infoRow(doc, x, y, width, label, value) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(SLATE).text(label.toUpperCase(), x, y, {
    width,
    characterSpacing: 0.5,
  });
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor(INK)
    .text(value && String(value).trim() ? value : '—', x, y + 11, { width, lineGap: 1 });
}

function drawCover(doc, record, company) {
  // Bandeau supérieur sombre
  doc.rect(0, 0, PAGE.width, 190).fill(INK);
  drawLogo(doc, MARGIN_X, 55, 300, '#FFFFFF');

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

  infoRow(doc, col1, ry, colW, 'Client', record.client_name);
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
  const boxW = (PAGE.width - MARGIN_X * 2 - 24) / 2;
  const boxH = 150;
  const y = doc.y + 4;

  const boxes = [
    {
      x: MARGIN_X,
      title: 'Technicien ShifTek',
      name: record.technician_name,
      sig: record.technician_signature_data,
    },
    {
      x: MARGIN_X + boxW + 24,
      title: 'Représentant client',
      name: record.client_signature_name,
      sig: record.client_signature_data,
    },
  ];

  for (const b of boxes) {
    doc.roundedRect(b.x, y, boxW, boxH, 6).stroke(BORDER);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(SLATE).text(b.title.toUpperCase(), b.x + 14, y + 12, {
      characterSpacing: 0.4,
    });

    const buf = dataUrlToBuffer(b.sig);
    if (buf) {
      try {
        doc.image(buf, b.x + 14, y + 30, { fit: [boxW - 28, 80], align: 'center' });
      } catch {
        /* image invalide, ignorée */
      }
    }

    doc
      .moveTo(b.x + 14, y + boxH - 34)
      .lineTo(b.x + boxW - 14, y + boxH - 34)
      .strokeColor(BORDER)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(INK)
      .text(b.name || 'Nom non renseigné', b.x + 14, y + boxH - 26, { width: boxW - 28 });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(SLATE)
      .text(`Date : ${formatDateFr(record.intervention_date)}`, b.x + 14, y + boxH - 14, {
        width: boxW - 28,
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
  doc.addPage();
  doc.on('pageAdded', () => drawContentHeader(doc, record, company));
  drawContentHeader(doc, record, company);

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

  // --- Pagination & pieds de page ---
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) {
      drawFooter(doc, { company, pageLabel: `Page 1 / ${range.count}`, cover: true });
    } else {
      drawFooter(doc, { company, pageLabel: `Page ${i + 1} / ${range.count}` });
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
    doc.on('error', reject);
  });
}

module.exports = { buildInterventionPdf };
