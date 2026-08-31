const path = require('path');
require('dotenv').config();

const root = path.resolve(__dirname, '..', '..');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  appDomain: process.env.APP_DOMAIN || 'localhost',
  companyName: process.env.COMPANY_NAME || 'ShifTek Hosting',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: path.resolve(root, process.env.DATA_DIR || './data'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  root,
};
