import rps from './rps.js';
import connect4 from './connect4.js';
import memory from './memory.js';
import solitaire from './solitaire.js';
import blackjack from './blackjack.js';
import race from './race.js';
import battleship from './battleship.js';
import dots from './dots.js';
import tictactoe from './tictactoe.js';
import duel2048 from './duel2048.js';
import duelwordle from './duelwordle.js';
import stop from './stop.js';
import reflex from './reflex.js';
import draw from './draw.js';
import memorytime from './memorytime.js';
import wordsearch from './wordsearch.js';
import simonteam from './simonteam.js';
import { ghostrace, relay, sprintlive, sprintteam } from './races.js';
import kartrace from './kartrace.js';
import airhockey from './airhockey.js';
import sumo from './sumo.js';
import bomber from './bomber.js';
import fishing from './fishing.js';
import kitchen from './kitchen.js';
import kartteam from './kartteam.js';
import defense from './defense.js';
import maze from './maze.js';
import escape from './escape.js';

/**
 * Cada juego implementa:
 *  create({ options }) → estado inicial
 *  act(state, idx, action, ctx) → muta el estado; pone state.finished = { winner } al terminar
 *  view(state, idx) → lo que ve ese jugador
 *  detail(state, idx) → texto corto para el historial
 * Opcionales: parseOptions, resume (temporizadores), pulse (tiempo real), forfeit, payouts, outcomes
 * Los juegos de acción (kart, air hockey, sumo…) se arman con arena() en arena.js
 */
export const MULTI_GAMES = {
  rps,
  connect4,
  memory,
  solitaire,
  blackjack,
  race,
  battleship,
  dots,
  tictactoe,
  duel2048,
  duelwordle,
  stop,
  reflex,
  draw,
  memorytime,
  wordsearch,
  simonteam,
  ghostrace,
  relay,
  sprintlive,
  sprintteam,
  kartrace,
  airhockey,
  sumo,
  bomber,
  fishing,
  kitchen,
  kartteam,
  defense,
  maze,
  escape,
};
