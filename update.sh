#!/usr/bin/env bash
#
# Mise à jour de SHK-Report sur un serveur déjà installé via install.sh.
#
# Contrairement à un simple "git pull && systemctl restart", ce script :
#   - récupère les derniers changements (si le dossier est un dépôt git) ;
#   - réinstalle les dépendances npm si package.json a changé ;
#   - RECOMPILE les feuilles de style Tailwind (src/public/css/style.css
#     n'est jamais versionné dans git : un simple restart continue de
#     servir l'ancien CSS tant que cette étape n'est pas rejouée) ;
#   - redonne la propriété des fichiers à l'utilisateur système dédié ;
#   - redémarre le service (les migrations de base de données s'appliquent
#     automatiquement au démarrage de l'application).
#
# Il ne touche ni à Nginx ni à Certbot : pour une reconfiguration complète
# (changement de domaine, etc.), utilisez ./install.sh.
#
# Usage : sudo ./update.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="shk-report"
SYSTEM_USER="shkreport"

c_reset="\033[0m"; c_bold="\033[1m"; c_green="\033[32m"; c_red="\033[31m"; c_blue="\033[36m"
info()  { echo -e "${c_blue}➜${c_reset} $*"; }
ok()    { echo -e "${c_green}✔${c_reset} $*"; }
fail()  { echo -e "${c_red}✘ $*${c_reset}" >&2; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Ce script doit être exécuté en tant que root (sudo ./update.sh)."
fi

if ! id "$SYSTEM_USER" >/dev/null 2>&1; then
  fail "L'utilisateur système '$SYSTEM_USER' n'existe pas : l'application ne semble pas avoir été installée via install.sh."
fi

cd "$APP_DIR"

if [ -d .git ]; then
  info "Récupération des dernières modifications (git pull --ff-only)…"
  git pull --ff-only
else
  info "Pas de dépôt git ici : on suppose que le code a déjà été mis à jour manuellement."
fi

info "Installation des dépendances npm…"
npm ci --no-audit --no-fund --loglevel=error

info "Compilation des feuilles de style…"
npm run build --silent

chown -R "$SYSTEM_USER:$SYSTEM_USER" "$APP_DIR"
ok "Fichiers à jour et appartenance corrigée."

info "Redémarrage du service…"
systemctl restart "$SERVICE_NAME"
sleep 1

if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "Mise à jour terminée : $SERVICE_NAME est actif."
else
  journalctl -u "$SERVICE_NAME" --no-pager -n 40 || true
  fail "Le service n'a pas redémarré correctement. Voir les logs ci-dessus."
fi
