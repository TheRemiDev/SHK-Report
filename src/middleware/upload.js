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

module.exports = { upload, uploadPhotos, photosDir };
