import { Router } from 'express';
import blackjack from './blackjack.js';
import roulette from './roulette.js';
import solitaire from './solitaire.js';
import race from './race.js';
import slots from './slots.js';
import hilo from './hilo.js';
import shell from './shell.js';
import scratch from './scratch.js';

const router = Router();
router.use('/blackjack', blackjack);
router.use('/roulette', roulette);
router.use('/solitaire', solitaire);
router.use('/race', race);
router.use('/slots', slots);
router.use('/hilo', hilo);
router.use('/shell', shell);
router.use('/scratch', scratch);

export default router;
