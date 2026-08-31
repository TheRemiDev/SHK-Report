const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');

const config = require('./config');
const db = require('./db/db');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const interventionsRoutes = require('./routes/interventions');
const adminRoutes = require('./routes/admin');
const clientsRoutes = require('./routes/clients');
const datacentersRoutes = require('./routes/datacenters');
const shareRoutes = require('./routes/share');
const tripLogsRoutes = require('./routes/tripLogs');

const SqliteStore = require('better-sqlite3-session-store')(session);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(config.uploadDir));

app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 12 * 60 * 60 * 1000,
    },
  })
);

app.use(flash());
app.use(attachUser);

app.use((req, res, next) => {
  res.locals.companyName = config.companyName;
  res.locals.appDomain = config.appDomain;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

app.use('/', authRoutes);
app.use('/', shareRoutes);

const { requireAuth } = require('./middleware/auth');
app.use('/', requireAuth, interventionsRoutes);
app.use('/', requireAuth, adminRoutes);
app.use('/', requireAuth, clientsRoutes);
app.use('/', requireAuth, datacentersRoutes);
app.use('/', requireAuth, tripLogsRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page introuvable' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render('errors/500', { title: 'Erreur serveur', error: err });
});

module.exports = app;
