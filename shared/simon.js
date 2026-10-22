// Simón Michi: secuencias de 4 michis de colores que crecen en cada nivel.
import { mulberry32, randInt } from './rng.js';

export const SIMON_PADS = 4;

export function sequence(seed, length) {
  const rnd = mulberry32(seed);
  return Array.from({ length }, () => randInt(rnd, SIMON_PADS));
}

/**
 * Las entradas son la concatenación de cada nivel: nivel 1 = [s0], nivel 2 = [s0, s1], …
 * Devuelve cuántos niveles completos se repitieron bien.
 */
export function levelReached(seed, inputs) {
  if (!Array.isArray(inputs) || inputs.length > 5000) return 0;
  const seq = sequence(seed, 120);
  let pos = 0;
  let level = 0;
  for (let len = 1; len <= seq.length; len++) {
    for (let k = 0; k < len; k++) {
      if (pos >= inputs.length) return level;
      if (inputs[pos] !== seq[k]) return level;
      pos++;
    }
    level = len;
  }
  return level;
}
