#!/usr/bin/env bash
#
# Installateur SHK-Report — Générateur de rapports d'intervention DataCenter
# ShifTek Hosting
#
# Ce script :
#   - installe les dépendances système nécessaires (Node.js, Nginx, Certbot)
#     sans toucher aux paquets ou services déjà présents sur le serveur ;
#   - crée un utilisateur système dédié et un service systemd isolé ;
#   - choisit automatiquement un port local libre (aucun conflit de port) ;
#   - configure un virtual host Nginx dédié pour le nom de domaine fourni ;
#   - obtient et installe automatiquement un certificat SSL Let's Encrypt.
#
# Usage :
#   sudo ./install.sh
#   sudo ./install.sh --domain rapports.shiftek.fr --email admin@shiftek.fr \
#        --admin-name "Rémi Vidon" --admin-email contact@shiftek.fr --admin-password 'MotDePasse123!' \
#        --company-name "ShifTek Hosting"
#
# Toutes les options peuvent aussi être fournies de façon interactive.

set -euo pipefail

# ----------------------------------------------------------------------------
# Constantes
# ----------------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="shk-report"
SYSTEM_USER="shkreport"
MIN_NODE_MAJOR=18
NODE_SETUP_MAJOR=20
PORT_RANGE_START=3000
PORT_RANGE_END=3999

DOMAIN=""
CERTBOT_EMAIL=""
COMPANY_NAME="ShifTek Hosting"
ADMIN_NAME=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
SKIP_SSL="false"

# ----------------------------------------------------------------------------
# Utilitaires d'affichage
# ----------------------------------------------------------------------------
c_reset="\033[0m"; c_bold="\033[1m"; c_green="\033[32m"; c_yellow="\033[33m"; c_red="\033[31m"; c_blue="\033[36m"

info()  { echo -e "${c_blue}➜${c_reset} $*"; }
ok()    { echo -e "${c_green}✔${c_reset} $*"; }
warn()  { echo -e "${c_yellow}⚠${c_reset} $*"; }
fail()  { echo -e "${c_red}✘ $*${c_reset}" >&2; exit 1; }
title() { echo -e "\n${c_bold}$*${c_reset}"; }

# ----------------------------------------------------------------------------
# Lecture des arguments
# ----------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) CERTBOT_EMAIL="$2"; shift 2 ;;
    --company-name) COMPANY_NAME="$2"; shift 2 ;;
    --admin-name) ADMIN_NAME="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --skip-ssl) SKIP_SSL="true"; shift 1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^#//'
      exit 0
      ;;
    *) fail "Option inconnue : $1" ;;
  esac
done

# ----------------------------------------------------------------------------
# Pré-requis
# ----------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  fail "Ce script doit être exécuté en tant que root (sudo ./install.sh)."
fi

if ! command -v apt-get >/dev/null 2>&1; then
  fail "Ce script prend en charge uniquement les systèmes Debian/Ubuntu (apt-get introuvable)."
fi

title "SHK-Report — Installation"
info "Répertoire de l'application : $APP_DIR"

# ----------------------------------------------------------------------------
# Réutilisation des informations d'une installation précédente
# ----------------------------------------------------------------------------
# install.sh est conçu pour être relancé sans risque (mise à jour) : le
# domaine et l'email Let's Encrypt fournis au premier lancement sont
# mémorisés ici, pour ne pas avoir à les ressaisir ni redemander un nouveau
# certificat à chaque exécution.
INSTALL_STATE_FILE="$APP_DIR/.install-state"
if [ -f "$INSTALL_STATE_FILE" ]; then
  # shellcheck disable=SC1090
  source "$INSTALL_STATE_FILE"
  if [ -z "$DOMAIN" ] && [ -n "${SAVED_DOMAIN:-}" ]; then
    DOMAIN="$SAVED_DOMAIN"
  fi
  if [ -z "$CERTBOT_EMAIL" ] && [ -n "${SAVED_CERTBOT_EMAIL:-}" ]; then
    CERTBOT_EMAIL="$SAVED_CERTBOT_EMAIL"
  fi
fi

# ----------------------------------------------------------------------------
# Collecte interactive des informations manquantes
# ----------------------------------------------------------------------------
is_tty() { [ -t 0 ]; }

if [ -z "$DOMAIN" ]; then
  if is_tty; then
    read -rp "Nom de domaine à utiliser (ex: rapports.shiftek.fr) : " DOMAIN
  fi
else
  info "Domaine : $DOMAIN"
fi
[ -n "$DOMAIN" ] || fail "Un nom de domaine est requis (--domain)."

if [ -z "$CERTBOT_EMAIL" ]; then
  if is_tty; then
    read -rp "Email pour les notifications Let's Encrypt : " CERTBOT_EMAIL
  fi
fi
[ -n "$CERTBOT_EMAIL" ] || fail "Un email est requis pour Let's Encrypt (--email)."

cat > "$INSTALL_STATE_FILE" <<EOF
SAVED_DOMAIN="$DOMAIN"
SAVED_CERTBOT_EMAIL="$CERTBOT_EMAIL"
EOF

if is_tty && [ "$COMPANY_NAME" = "ShifTek Hosting" ]; then
  read -rp "Nom de l'entreprise affiché [ShifTek Hosting] : " input_company
  [ -n "$input_company" ] && COMPANY_NAME="$input_company"
fi

if [ -z "$ADMIN_NAME" ] && is_tty; then
  read -rp "Nom complet du premier administrateur : " ADMIN_NAME
fi
if [ -z "$ADMIN_EMAIL" ] && is_tty; then
  read -rp "Email du premier administrateur : " ADMIN_EMAIL
fi
if [ -z "$ADMIN_PASSWORD" ] && is_tty; then
  read -rsp "Mot de passe du premier administrateur (min. 8 caractères) : " ADMIN_PASSWORD
  echo
fi

CREATE_ADMIN="true"
if [ -z "$ADMIN_NAME" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  warn "Informations administrateur incomplètes : la création du compte sera ignorée."
  warn "Vous pourrez le créer plus tard avec : cd $APP_DIR && sudo -u $SYSTEM_USER node src/cli/create-admin.js \"Nom\" email mot_de_passe"
  CREATE_ADMIN="false"
fi

# ----------------------------------------------------------------------------
# Vérification DNS (best-effort, non bloquant)
# ----------------------------------------------------------------------------
title "Vérification DNS"
RESOLVED_IP="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
PUBLIC_IP="$(curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || true)"
if [ -n "$RESOLVED_IP" ] && [ -n "$PUBLIC_IP" ] && [ "$RESOLVED_IP" != "$PUBLIC_IP" ]; then
  warn "Le domaine $DOMAIN pointe vers $RESOLVED_IP mais ce serveur semble avoir l'IP $PUBLIC_IP."
  warn "Si le DNS n'est pas encore propagé, l'obtention du certificat SSL échouera : relancez alors ce script avec --skip-ssl puis exécutez 'certbot --nginx -d $DOMAIN' une fois le DNS à jour."
elif [ -z "$RESOLVED_IP" ]; then
  warn "Impossible de résoudre $DOMAIN pour le moment. L'obtention du certificat SSL pourrait échouer si le DNS n'est pas encore configuré."
else
  ok "$DOMAIN pointe bien vers ce serveur ($RESOLVED_IP)."
fi

# ----------------------------------------------------------------------------
# Dépendances système (installées uniquement si absentes)
# ----------------------------------------------------------------------------
title "Dépendances système"
export DEBIAN_FRONTEND=noninteractive

APT_UPDATED="false"
apt_update_once() {
  if [ "$APT_UPDATED" = "false" ]; then
    apt-get update -qq
    APT_UPDATED="true"
  fi
}

ensure_pkg() {
  local pkg="$1"
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    apt_update_once
    info "Installation du paquet manquant : $pkg"
    apt-get install -y -qq "$pkg"
  fi
}

ensure_pkg ca-certificates
ensure_pkg curl
ensure_pkg build-essential
ensure_pkg python3
ensure_pkg sqlite3

# Node.js : on réutilise une installation existante si elle est suffisamment récente,
# afin de ne jamais perturber d'autres applications Node déjà présentes sur le VPS.
NODE_OK="false"
if command -v node >/dev/null 2>&1; then
  CURRENT_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$CURRENT_MAJOR" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
    NODE_OK="true"
    ok "Node.js $(node -v) déjà installé et compatible."
  fi
fi
if [ "$NODE_OK" = "false" ]; then
  info "Installation de Node.js ${NODE_SETUP_MAJOR}.x (NodeSource)…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_SETUP_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installé."
fi

if ! command -v nginx >/dev/null 2>&1; then
  info "Installation de Nginx…"
  ensure_pkg nginx
  systemctl enable --now nginx >/dev/null 2>&1 || true
else
  ok "Nginx déjà installé."
fi

if [ "$SKIP_SSL" = "false" ]; then
  if ! command -v certbot >/dev/null 2>&1; then
    info "Installation de Certbot…"
    ensure_pkg certbot
    ensure_pkg python3-certbot-nginx
  else
    ok "Certbot déjà installé."
  fi
fi

# ----------------------------------------------------------------------------
# Utilisateur système dédié (isolation, aucun accès shell)
# ----------------------------------------------------------------------------
title "Utilisateur système"
if id "$SYSTEM_USER" >/dev/null 2>&1; then
  ok "L'utilisateur système '$SYSTEM_USER' existe déjà."
else
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SYSTEM_USER"
  ok "Utilisateur système '$SYSTEM_USER' créé."
fi

# ----------------------------------------------------------------------------
# Port local libre
# ----------------------------------------------------------------------------
title "Sélection d'un port local"
port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[.:]${port}\$"
  else
    node -e "
      const net = require('net');
      const s = net.createServer();
      s.once('error', () => process.exit(0));
      s.once('listening', () => { s.close(); process.exit(1); });
      s.listen($port, '127.0.0.1');
    "
  fi
}

if [ -f "$APP_DIR/.env" ] && grep -q '^PORT=' "$APP_DIR/.env"; then
  APP_PORT="$(grep '^PORT=' "$APP_DIR/.env" | head -n1 | cut -d= -f2)"
  info "Port déjà configuré dans .env : $APP_PORT (conservé)."
else
  APP_PORT=""
  for candidate in $(seq "$PORT_RANGE_START" "$PORT_RANGE_END"); do
    if ! port_in_use "$candidate"; then
      APP_PORT="$candidate"
      break
    fi
  done
  [ -n "$APP_PORT" ] || fail "Aucun port libre trouvé entre $PORT_RANGE_START et $PORT_RANGE_END."
  ok "Port local libre sélectionné : $APP_PORT"
fi

# ----------------------------------------------------------------------------
# Fichier d'environnement (.env)
# ----------------------------------------------------------------------------
title "Configuration (.env)"
if [ -f "$APP_DIR/.env" ]; then
  ok "Fichier .env existant conservé (les secrets ne sont pas régénérés)."
else
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  cat > "$APP_DIR/.env" <<EOF
PORT=$APP_PORT
APP_DOMAIN=$DOMAIN
COMPANY_NAME="$COMPANY_NAME"
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
DATA_DIR=./data
UPLOAD_DIR=./uploads
EOF
  chmod 600 "$APP_DIR/.env"
  ok "Fichier .env généré."
fi

# ----------------------------------------------------------------------------
# Installation des dépendances Node et build des assets
# ----------------------------------------------------------------------------
title "Installation de l'application"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  info "Arrêt temporaire du service existant pour mise à jour…"
  systemctl stop "$SERVICE_NAME"
fi

cd "$APP_DIR"
info "Installation des dépendances npm (cela peut prendre une minute)…"
npm ci --no-audit --no-fund --loglevel=error
info "Compilation des feuilles de style…"
npm run build --silent

mkdir -p "$APP_DIR/data" "$APP_DIR/uploads/photos"
chown -R "$SYSTEM_USER:$SYSTEM_USER" "$APP_DIR"
ok "Application installée et dossiers de données prêts."

# ----------------------------------------------------------------------------
# Service systemd
# ----------------------------------------------------------------------------
title "Service systemd"
NODE_BIN="$(command -v node)"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SHK-Report - Rapports d'intervention DataCenter (ShifTek Hosting)
After=network.target

[Service]
Type=simple
User=$SYSTEM_USER
Group=$SYSTEM_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN $APP_DIR/src/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$APP_DIR/data $APP_DIR/uploads

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"
sleep 1

if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "Service '$SERVICE_NAME' démarré (port local $APP_PORT)."
else
  journalctl -u "$SERVICE_NAME" --no-pager -n 40 || true
  fail "Le service n'a pas démarré. Voir les logs ci-dessus (journalctl -u $SERVICE_NAME)."
fi

# ----------------------------------------------------------------------------
# Compte administrateur
# ----------------------------------------------------------------------------
if [ "$CREATE_ADMIN" = "true" ]; then
  title "Compte administrateur"
  # create-admin.js charge lui-même $APP_DIR/.env via dotenv (cwd = APP_DIR).
  (cd "$APP_DIR" && sudo -u "$SYSTEM_USER" node src/cli/create-admin.js "$ADMIN_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
  ok "Compte administrateur prêt : $ADMIN_EMAIL"
fi

# ----------------------------------------------------------------------------
# Nginx : virtual host dédié (HTTP d'abord, pour le challenge Let's Encrypt)
# ----------------------------------------------------------------------------
title "Configuration Nginx"

if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
  NGINX_CONF="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
  NGINX_LINK="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
else
  NGINX_CONF="/etc/nginx/conf.d/${SERVICE_NAME}.conf"
  NGINX_LINK=""
fi

# Si un certificat existe déjà, Certbot a précédemment réécrit ce fichier
# pour y ajouter le bloc HTTPS + la redirection. On ne le régénère alors
# plus jamais, pour ne pas écraser cette configuration à chaque relance.
CERT_EXISTS="false"
[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && CERT_EXISTS="true"

mkdir -p /var/www/letsencrypt

if [ "$CERT_EXISTS" = "true" ]; then
  ok "Configuration Nginx existante conservée (certificat déjà en place pour $DOMAIN)."
else
  cat > "$NGINX_CONF" <<EOF
# Généré automatiquement par install.sh — SHK-Report
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 25m;
    }
}
EOF

  if [ -n "$NGINX_LINK" ] && [ ! -e "$NGINX_LINK" ]; then
    ln -s "$NGINX_CONF" "$NGINX_LINK"
  fi

  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    ok "Virtual host Nginx configuré pour $DOMAIN (port local $APP_PORT)."
  else
    nginx -t
    fail "La configuration Nginx générée est invalide."
  fi
fi

# ----------------------------------------------------------------------------
# Certificat SSL (Let's Encrypt via Certbot)
# ----------------------------------------------------------------------------
SSL_ENABLED="false"
if [ "$SKIP_SSL" = "false" ]; then
  title "Certificat SSL (Let's Encrypt)"
  if [ "$CERT_EXISTS" = "true" ]; then
    # On ne redemande pas un nouveau certificat à chaque relance (évite de
    # cogner les quotas hebdomadaires de Let's Encrypt lors des mises à
    # jour) : le renouvellement automatique (cron) s'occupe de le garder à
    # jour.
    SSL_ENABLED="true"
    ok "Certificat SSL déjà présent pour $DOMAIN (conservé)."
  elif certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect; then
    SSL_ENABLED="true"
    ok "Certificat SSL obtenu et Nginx configuré en HTTPS pour $DOMAIN."
  else
    warn "L'obtention automatique du certificat SSL a échoué (DNS pas encore propagé ?)."
    warn "Le site reste accessible en HTTP. Une fois le DNS prêt, relancez :"
    warn "  sudo certbot --nginx -d $DOMAIN --agree-tos -m $CERTBOT_EMAIL --redirect"
  fi

  if [ "$SSL_ENABLED" = "true" ]; then
    (crontab -l 2>/dev/null | grep -q 'certbot renew' || \
      (crontab -l 2>/dev/null; echo "17 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -) \
      && ok "Renouvellement automatique du certificat programmé (cron)."
  fi
else
  warn "Configuration SSL ignorée (--skip-ssl). Le site est accessible en HTTP uniquement."
fi

# ----------------------------------------------------------------------------
# Résumé
# ----------------------------------------------------------------------------
title "Installation terminée"
if [ "$SSL_ENABLED" = "true" ]; then
  ok "SHK-Report est en ligne : https://$DOMAIN"
else
  ok "SHK-Report est en ligne : http://$DOMAIN (SSL non activé pour le moment)"
fi
echo
echo "  Service systemd  : $SERVICE_NAME (sudo systemctl status $SERVICE_NAME)"
echo "  Logs             : sudo journalctl -u $SERVICE_NAME -f"
echo "  Répertoire       : $APP_DIR"
echo "  Port local       : $APP_PORT (proxié par Nginx, non exposé publiquement)"
if [ "$CREATE_ADMIN" = "true" ]; then
  echo "  Compte admin     : $ADMIN_EMAIL"
fi
echo
echo "  Pour créer un compte administrateur supplémentaire plus tard :"
echo "    cd $APP_DIR && sudo -u $SYSTEM_USER node src/cli/create-admin.js \"Nom\" email mot_de_passe"
echo
