const STATUS_LABELS = {
  planifie: 'Planifiée',
  en_cours: 'En cours',
  termine: 'Terminée',
  annule: 'Annulée',
};

const STATUS_COLORS = {
  planifie: '#64748B',
  en_cours: '#0EA5E9',
  termine: '#14B8A6',
  annule: '#EF4444',
};

const TYPE_LABELS = {
  maintenance: 'Maintenance préventive',
  incident: "Résolution d'incident",
  installation: 'Installation / Déploiement',
  audit: 'Audit / Contrôle',
  autre: 'Autre',
};

const PRIORITY_LABELS = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  critique: 'Critique',
};

const PRIORITY_COLORS = {
  basse: '#64748B',
  normale: '#0EA5E9',
  haute: '#F59E0B',
  critique: '#EF4444',
};

function formatDateFr(value) {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

function formatDateTimeFr(value) {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

module.exports = {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDateFr,
  formatDateTimeFr,
};
