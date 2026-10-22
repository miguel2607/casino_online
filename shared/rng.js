// Generador pseudoaleatorio con semilla: cliente y servidor obtienen la misma secuencia.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rnd, n) => Math.floor(rnd() * n);

export function shuffleWith(rnd, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rnd, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Quita tildes y pasa a mayúsculas, conservando la Ñ. */
export function normalizeWord(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '');
}
