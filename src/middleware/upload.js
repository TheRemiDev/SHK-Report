const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

const photosDir = path.join(config.uploadDir, 'photos');
fs.mkdirSync(photosDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Format de fichier non supporté (JPEG, PNG ou WEBP uniquement).'));
    }
    cb(null, true);
  },
});

function uploadPhotos(req, res, next) {
  upload.array('photos', 10)(req, res, (err) => {
    if (err) {
      req.flash('error', err.message || "Échec de l'envoi des photos.");
      return res.redirect(req.get('Referrer') || '/');
    }
    next();
  });
}

const brandingDir = path.join(config.uploadDir, 'branding');
fs.mkdirSync(brandingDir, { recursive: true });

const LOGO_MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!LOGO_MIME_EXT[file.mimetype]) {
      return cb(new Error('Format de logo non supporté (PNG, JPEG, WEBP ou SVG uniquement).'));
    }
    cb(null, true);
  },
});

function uploadLogo(req, res, next) {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) {
      req.flash('error', err.message || "Échec de l'envoi du logo.");
      return res.redirect(req.get('Referrer') || '/admin/settings');
    }
    next();
  });
}

module.exports = { upload, uploadPhotos, photosDir, uploadLogo, brandingDir, LOGO_MIME_EXT };
