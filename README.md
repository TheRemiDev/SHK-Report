# SHK-Report

Application de gestion et de génération des **rapports d'intervention DataCenter**
de ShifTek Hosting : création des rapports, historique consultable et filtrable,
export PDF professionnel avec logo et signatures.

## Fonctionnalités

- Authentification par comptes (administrateur / technicien).
- Création de rapports d'intervention : DataCenter, client, date, techniciens,
  contexte, actions réalisées, matériel concerné, incidents, recommandations.
- Base de clients dédiée : à la création d'un rapport, choisissez un client déjà
  enregistré, saisissez un client ponctuel à la main, ou marquez l'intervention
  comme **interne** (aucune information client demandée ni affichée).
- Lien client temporaire : pour toute intervention non interne, générez un lien
  de consultation à durée limitée (30 jours) que le client peut ouvrir sans
  compte pour consulter le rapport (mise en page proche du PDF final) et le
  signer électroniquement à distance.
- Upload de photos et capture de signature (technicien + client) directement
  dans le navigateur, sur place ou à distance.
- Référence automatique et unique par rapport (`SHK-2026-0001`, ...).
- Tableau de bord avec recherche et filtres (statut, type, DataCenter, client, dates).
- Export PDF stylé (page de garde, en-têtes/pieds de page, photos, signatures)
  généré côté serveur avec le logo ShifTek Hosting.
- Fiches de route : suivi des déplacements (adresses de départ/arrivée, détours,
  kilomètres parcourus, montant des frais), avec signature et export PDF dédié.
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

## Mettre à jour l'application

`git pull` puis `systemctl restart shk-report` **ne suffit pas** : les
feuilles de style compilées (`src/public/css/style.css`) ne sont jamais
versionnées dans git, donc un simple redémarrage continue de servir l'ancien
CSS tant qu'il n'est pas recompilé. Utilisez plutôt :

```bash
cd /chemin/vers/shk-report
sudo ./update.sh
```

Ce script récupère les derniers commits, réinstalle les dépendances npm si
besoin, **recompile les feuilles de style**, corrige les droits, puis
redémarre le service. Les migrations de base de données s'appliquent
automatiquement au démarrage de l'application (aucune action manuelle requise).

`sudo ./install.sh` reste disponible et sûr à relancer (il ne redemande pas
le domaine/l'email, ne régénère pas le `.env`, et ne redemande pas non plus
de certificat SSL si un certificat valide existe déjà) : utilisez-le si vous
devez reconfigurer Nginx, changer de domaine, ou si `update.sh` échoue.

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
  app.js                  # assemblage Express (middlewares, routes, sessions)
  server.js               # point d'entrée
  config/                 # configuration (variables d'environnement)
  db/                     # connexion SQLite, schéma, migrations, paramètres
  models/                 # accès aux données (utilisateurs, interventions,
                           # clients, fiches de route)
  routes/                 # routes Express (auth, interventions, clients,
                           # fiches de route, lien de partage public, admin)
  services/
    pdfKit.js              # briques PDF partagées (logo, en-têtes, mise en page)
    pdfService.js          # génération des rapports d'intervention PDF
    tripPdfService.js       # génération des fiches de route PDF
  middleware/              # authentification, upload de fichiers
  views/                   # templates EJS (dont share.ejs : page publique de
                           # consultation/signature client)
  public/                  # CSS compilé, JS front (dont le sélecteur custom
                           # et les pads de signature), logo
install.sh                # installateur automatisé (VPS)
```
