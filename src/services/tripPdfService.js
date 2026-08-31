const PDFDocument = require('pdfkit');
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
  infoRow,
  drawSignatureBox,
} = require('./pdfKit');
const { formatDateFr, formatDateTimeFr } = require('./pdfLabels');

// Le PDF utilise la police standard Helvetica (encodage WinAnsi) : l'espace
// insécable fine (U+202F) que toLocaleString('fr-FR') utilise comme séparateur
// de milliers n'existe pas dans cet encodage et s'affichait comme un
// caractère parasite. On la remplace par un espace normal, sans risque ici.
function frNumber(value, options) {
  return Number(value)
    .toLocaleString('fr-FR', options)
    .replace(/[  ]/g, ' ');
}

function formatKm(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${frNumber(value, { maximumFractionDigits: 1 })} km`;
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${frNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function drawCover(doc, trip, company, detours) {
  doc.rect(0, 0, PAGE.width, 160).fill(LIGHT);
  doc.moveTo(0, 160).lineTo(PAGE.width, 160).lineWidth(2).strokeColor(TEAL).stroke();
  drawLogo(doc, MARGIN_X, 32, { maxWidth: 210, maxHeight: 84 });

  const infoLines = [
    company.company_address,
    [company.company_phone, company.company_email].filter(Boolean).join('  ·  '),
    company.company_website,
  ].filter(Boolean);
  let infoY = 34;
  doc.font('Helvetica').fontSize(9).fillColor(SLATE);
  infoLines.forEach((line) => {
    doc.text(line, PAGE.width - MARGIN_X - 220, infoY, { width: 220, align: 'right' });
    infoY += 13;
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor(INK)
    .text('FICHE DE ROUTE', MARGIN_X, 196, { characterSpacing: 0.3 });

  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEAL).text('RÉFÉRENCE', MARGIN_X, 236);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(trip.reference, MARGIN_X, 249);

  const cardY = 292;
  let cardH = 210;
  if (trip.return_address) cardH += 42;
  if (detours.length) cardH += 42;
  doc.roundedRect(MARGIN_X, cardY, PAGE.width - MARGIN_X * 2, cardH, 6).fillAndStroke(LIGHT, BORDER);

  const colW = (PAGE.width - MARGIN_X * 2 - 60) / 2;
  const col1 = MARGIN_X + 24;
  const col2 = MARGIN_X + 24 + colW + 12;
  let ry = cardY + 24;
  const rowGap = 42;

  infoRow(doc, col1, ry, colW, 'Date', formatDateFr(trip.trip_date));
  infoRow(doc, col2, ry, colW, 'Technicien', trip.technician_name);
  ry += rowGap;
  infoRow(doc, col1, ry, colW, 'Départ', trip.departure_address);
  infoRow(doc, col2, ry, colW, 'Arrivée', trip.arrival_address);
  ry += rowGap;

  if (trip.return_address) {
    infoRow(doc, col1, ry, colW, 'Retour', trip.return_address);
    ry += rowGap;
  }

  if (detours.length) {
    // La flèche → (U+2192) n'existe pas dans l'encodage WinAnsi de la police
    // standard Helvetica utilisée pour le PDF et s'affichait comme un
    // caractère parasite ; « » » (chevron), lui, en fait partie.
    infoRow(doc, col1, ry, PAGE.width - MARGIN_X * 2 - 48, 'Détours', detours.join('  »  '));
    ry += rowGap;
  }

  infoRow(doc, col1, ry, colW, 'Distance totale', formatKm(trip.total_km));
  infoRow(doc, col2, ry, colW, 'Montant dépensé', formatAmount(trip.total_amount));
  ry += rowGap;
  infoRow(doc, col1, ry, PAGE.width - MARGIN_X * 2 - 48, 'Motif', trip.purpose);

  doc.y = cardY + cardH + 26;
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

function drawSignature(doc, trip) {
  sectionTitle(doc, 'Signature');
  ensureSpace(doc, 170);
  const boxW = (PAGE.width - MARGIN_X * 2 - 24) / 2;
  const boxH = 150;
  const y = doc.y + 4;

  drawSignatureBox(doc, {
    x: MARGIN_X,
    width: boxW,
    height: boxH,
    y,
    title: 'Signature',
    name: trip.technician_name,
    signatureData: trip.signature_data,
    dateLabel: `Date : ${formatDateFr(trip.trip_date)}`,
  });

  doc.y = y + boxH + 10;
}

async function buildTripPdf(trip, outputStream) {
  const company = settings.getAll();
  const detours = JSON.parse(trip.detours || '[]');

  const doc = new PDFDocument({
    size: PAGE.size,
    margins: { top: CONTENT_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X },
    bufferPages: true,
    info: {
      Title: `Fiche de route ${trip.reference}`,
      Author: company.company_name,
      Subject: 'Fiche de route',
    },
  });

  doc.pipe(outputStream);

  drawCover(doc, trip, company, detours);

  const eyebrow = 'FICHE DE ROUTE';
  doc.addPage();
  doc.on('pageAdded', () => drawContentHeader(doc, trip.reference, eyebrow));
  drawContentHeader(doc, trip.reference, eyebrow);

  if (trip.notes) {
    sectionTitle(doc, 'Notes');
    bodyParagraph(doc, trip.notes);
  }

  drawSignature(doc, trip);

  paginate(doc, company);
  doc.end();

  return new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
    doc.on('error', reject);
  });
}

module.exports = { buildTripPdf };
