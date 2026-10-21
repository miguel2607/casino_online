const nf = new Intl.NumberFormat('es-CO');
export const fmt = (n) => nf.format(n ?? 0);

const dtf = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtDate = (d) => dtf.format(new Date(d));

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return fmtDate(d);
}

export const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rankLabel = (r) => RANK_LABEL[r] || String(r);
export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRedSuit = (s) => s === 'H' || s === 'D';

export const SYMBOL_EMOJI = { paw: '🐾', yarn: '🧶', fish: '🐟', milk: '🥛', star: '⭐', cat: '😻' };
