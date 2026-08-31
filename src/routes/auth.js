const express = require('express');
const users = require('../models/users');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Connexion' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = email ? users.findByEmail(email) : null;

  if (!user || !user.active || !users.verifyPassword(user, password || '')) {
    req.flash('error', 'Identifiants incorrects.');
    return res.redirect('/login');
  }

  req.session.regenerate((err) => {
    if (err) {
      req.flash('error', 'Une erreur est survenue, veuillez réessayer.');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };
    const dest = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(dest);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
