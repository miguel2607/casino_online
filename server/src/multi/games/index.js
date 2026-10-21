import rps from './rps.js';
import connect4 from './connect4.js';
import memory from './memory.js';
import solitaire from './solitaire.js';
import blackjack from './blackjack.js';
import race from './race.js';

/**
 * Cada juego implementa:
 *  create({ options }) → estado inicial
 *  act(state, idx, action, ctx) → muta el estado; pone state.finished = { winner } al terminar
 *  view(state, idx) → lo que ve ese jugador
 *  detail(state, idx) → texto corto para el historial
 * Opcionales: parseOptions, resume, forfeit, payouts, outcomes
 */
export const MULTI_GAMES = { rps, connect4, memory, solitaire, blackjack, race };
