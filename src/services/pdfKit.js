const fs = require('fs');
const path = require('path');
const SVGtoPDF = require('svg-to-pdfkit');
const config = require('../config');
const settings = require('../db/settings');

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

/**
 * Extrait les dimensions natives d'un SVG (viewBox en priorité, sinon
 * width/height) pour pouvoir le mettre à l'échelle nous-mêmes : le
 * width/height passé à svg-to-pdfkit n'est pas fiable pour un ratio custom.
 */
function parseSvgDims(raw) {
  const vb = /viewBox\s*=\s*["']\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)\s*["']/i.exec(raw);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  const w = /\swidth\s*=\s*["']([\d.]+)/i.exec(raw);
  const h = /\sheight\s*=\s*["']([\d.]+)/i.exec(raw);
  if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) };
  return { w: 300, h: 100 };
}

/**
 * Dessine le logo réellement importé par l'entreprise (paramètres du site),
 * quel que soit son format (SVG, PNG, JPEG, WEBP) et sa colorimétrie propre —
 * on ne recrée jamais le logo, on affiche le fichier tel quel, mis à
 * l'échelle pour tenir dans la boîte [maxWidth, maxHeight]. Sur fond sombre
 * (`dark: true`), on l'entoure d'un fond blanc pour garantir sa lisibilité
 * quelles que soient ses couleurs. Sans logo importé, on replie sur le nom
 * de l'entreprise en texte.
 */
function drawLogo(doc, x, y, { maxWidth = 200, maxHeight = 60, dark = false } = {}) {
  const filename = settings.get('company_logo_filename');
  const mime = settings.get('company_logo_mime');
  const companyName = settings.get('company_name') || 'Shiftek Hosting';
  const pad = dark ? 9 : 0;

  if (filename) {
    const filePath = path.join(config.uploadDir, 'branding', filename);
    if (fs.existsSync(filePath)) {
      try {
        if (mime === 'image/svg+xml') {
          const raw = fs.readFileSync(filePath, 'utf8');
          const dims = parseSvgDims(raw);
          const scale = Math.min((maxWidth - pad * 2) / dims.w, (maxHeight - pad * 2) / dims.h);
          const drawW = dims.w * scale;
          const drawH = dims.h * scale;
          if (dark) doc.roundedRect(x, y, drawW + pad * 2, drawH + pad * 2, 6).fill(WHITE);
          doc.save();
          doc.translate(x + pad, y + pad).scale(scale);
          SVGtoPDF(doc, raw, 0, 0, { width: dims.w, height: dims.h, assumePt: true });
          doc.restore();
          return;
        }

        const img = doc.openImage(filePath);
        const scale = Math.min((maxWidth - pad * 2) / img.width, (maxHeight - pad * 2) / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        if (dark) doc.roundedRect(x, y, drawW + pad * 2, drawH + pad * 2, 6).fill(WHITE);
        doc.image(img, x + pad, y + pad, { width: drawW, height: drawH });
        return;
      } catch {
        /* fichier illisible : repli sur le texte ci-dessous */
      }
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(Math.min(maxHeight * 0.5, 24))
    .fillColor(dark ? WHITE : INK)
    .text(companyName, x, y + maxHeight / 2 - Math.min(maxHeight * 0.5, 24) / 2, {
      width: maxWidth,
      lineBreak: false,
    });
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

function ensureSpace(doc, needed) {
  if (doc.y + needed > MAX_CONTENT_Y) {
    doc.addPage();
  }
}

/**
 * En-tête compact affiché en haut de chaque page de contenu (hors couverture).
 * `eyebrow` est le petit libellé affiché sous la référence (ex : "RAPPORT
 * D'INTERVENTION DATACENTER" ou "FICHE DE ROUTE").
 */
function drawContentHeader(doc, reference, eyebrow) {
  const top = 40;
  const rightBoxX = PAGE.width - MARGIN_X - 260;
  const rightBoxW = 260;

  drawLogo(doc, MARGIN_X, top, { maxWidth: 110, maxHeight: 26, dark: false });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(INK)
    .text(reference, rightBoxX, top + 2, { width: rightBoxW, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(SLATE)
    .text(eyebrow, rightBoxX, top + 15, {
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

function paginate(doc, company) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, { company, pageLabel: `Page ${i + 1} / ${range.count}`, cover: i === 0 });
  }
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

function drawSignatureBox(doc, { x, width, height, y, title, name, signatureData, dateLabel }) {
  doc.roundedRect(x, y, width, height, 6).stroke(BORDER);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(SLATE).text(title.toUpperCase(), x + 14, y + 12, {
    characterSpacing: 0.4,
  });

  const buf = dataUrlToBuffer(signatureData);
  if (buf) {
    try {
      doc.image(buf, x + 14, y + 30, { fit: [width - 28, height - 68], align: 'center' });
    } catch {
      /* image invalide, ignorée */
    }
  }

  doc
    .moveTo(x + 14, y + height - 34)
    .lineTo(x + width - 14, y + height - 34)
    .strokeColor(BORDER)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(INK)
    .text(name || 'Nom non renseigné', x + 14, y + height - 26, { width: width - 28 });

  if (dateLabel) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(SLATE)
      .text(dateLabel, x + 14, y + height - 14, { width: width - 28 });
  }
}

module.exports = {
  INK,
  TEAL,
  SLATE,
  LIGHT,
  BORDER,
  WHITE,
  PAGE,
  MARGIN_X,
  CONTENT_TOP,
  MARGIN_BOTTOM,
  MAX_CONTENT_Y,
  drawLogo,
  dataUrlToBuffer,
  ensureSpace,
  drawContentHeader,
  drawFooter,
  paginate,
  sectionTitle,
  bodyParagraph,
  badge,
  infoRow,
  drawSignatureBox,
};
