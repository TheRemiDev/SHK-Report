# SHK-Report

Application de gestion et de génération des **rapports d'intervention DataCenter**
de ShifTek Hosting : création des rapports, historique consultable et filtrable,
export PDF professionnel avec logo et signatures.

## Fonctionnalités

- Authentification par comptes (administrateur / technicien).
- Création de rapports d'intervention : DataCenter, client, date, techniciens,
  contexte, actions réalisées, matériel concerné, incidents, recommandations.
- Upload de photos et capture de signature (technicien + client) directement
  dans le navigateur.
- Référence automatique et unique par rapport (`SHK-2026-0001`, ...).
- Tableau de bord avec recherche et filtres (statut, type, DataCenter, client, dates).
- Export PDF stylé (page de garde, en-têtes/pieds de page, photos, signatures)
  généré côté serveur avec le logo ShifTek Hosting.
- Panneau d'administration : gestion des utilisateurs et des informations
  d'entreprise affichées dans l'application et les PDF.

## Stack technique

- Node.js + Express, vues EJS, Tailwind CSS.
- SQLite (via `better-sqlite3`) : base de données embarquée, aucun service
  externe à gérer.
- PDFKit + `svg-to-pdfkit` pour la génération des rapports PDF.
- Sessions stockées en SQLite (`better-sqlite3-session-store`).

## Installation sur un VPS (production)

Le script `install.sh` installe l'application de façon autonome sur un serveur
Debian/Ubuntu, **sans entrer en conflit avec d'autres applications déjà présentes** :

- il ne réinstalle Node.js que s'il est absent ou trop ancien ;
- il choisit automatiquement un port local libre pour l'application ;
- il crée un utilisateur système dédié (`shkreport`) et un service systemd isolé
  (`shk-report.service`) ;
- il ajoute un virtual host Nginx dédié (sans toucher aux configurations
  existantes) et configure automatiquement le certificat SSL Let's Encrypt.

```bash
git clone <url-du-depot> shk-report
cd shk-report
sudo ./install.sh
```

Le script demandera (ou accepte en options) :

```bash
sudo ./install.sh \
  --domain rapports.shiftek.fr \
  --email admin@shiftek.fr \
  --company-name "ShifTek Hosting" \
  --admin-name "Rémi Vidon" \
  --admin-email contact@shiftek.fr \
  --admin-password 'MotDePasse-Solide-123'
```

> Le domaine doit déjà pointer vers l'adresse IP du serveur avant de lancer le
> script pour que l'obtention du certificat SSL réussisse. Si ce n'est pas le
> cas, relancez avec `--skip-ssl`, puis une fois le DNS propagé :
> `sudo certbot --nginx -d votre-domaine`.

Après installation :

```bash
sudo systemctl status shk-report      # état du service
sudo journalctl -u shk-report -f      # logs en direct
```

Pour mettre à jour l'application après un `git pull`, relancez simplement
`sudo ./install.sh` (le script est idempotent : il ne régénère ni le `.env`
ni le port déjà attribués, et redémarre le service proprement).

## Personnaliser le logo

Le logo utilisé dans l'interface et les PDF est un fichier SVG unique :
`src/public/assets/logo.svg`. Remplacez-le (en conservant le nom de fichier
et l'attribut `viewBox`) pour que votre logo apparaisse automatiquement
partout dans l'application et sur les rapports PDF générés.

## Développement local

Prérequis : Node.js ≥ 18.

```bash
npm install
cp .env.example .env
npm run build         # compile Tailwind CSS
npm run create-admin -- "Nom Complet" admin@exemple.fr motdepasse123
npm run dev            # démarre le serveur avec rechargement automatique
```

L'application est alors disponible sur `http://localhost:3000`.

### Structure du projet

```
src/
  app.js               # assemblage Express (middlewares, routes, sessions)
  server.js             # point d'entrée
  config/                # configuration (variables d'environnement)
  db/                     # connexion SQLite, schéma, migrations, paramètres
  models/                 # accès aux données (utilisateurs, interventions)
  routes/                 # routes Express (auth, interventions, admin)
  services/pdfService.js  # génération des rapports PDF
  middleware/              # authentification, upload de fichiers
  views/                   # templates EJS
  public/                  # CSS compilé, JS front, logo
install.sh                # installateur automatisé (VPS)
```
