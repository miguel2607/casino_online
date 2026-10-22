import { useEffect, useRef } from 'react';
import Cat from '../../components/Cat.jsx';
import SimonPad, { usePlayback } from '../../components/SimonPad.jsx';
import { useServerClock } from '../../hooks/gameHooks.js';

export default function SimonTeamGame({ match, act, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const { lit, play } = usePlayback(state.stepMs);
  const shownRound = useRef(0);
  const myTurn = match.status === 'active' && state.active === me;
  const activeName = state.active === me ? 'Tú' : players[state.active].displayName;

  // Cada ronda nueva, los dos ven la secuencia completa
  useEffect(() => {
    if (match.status !== 'active' || shownRound.current === state.round) return;
    shownRound.current = state.round;
    const delay = Math.max(0, state.showUntil - now() - state.round * state.stepMs);
    play(state.sequence, delay);
  }, [state.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (color) => {
    if (!myTurn || now() < state.showUntil - 300) return;
    act({ type: 'press', color }).catch(() => {});
  };

  return (
    <div>
      <div className="memory-scores">
        <span>
          Ronda <b>{state.round}</b>
        </span>
        <span>
          Completadas <b>{state.completed}</b>
        </span>
      </div>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        <Cat color={colors[state.active]} size={22} />{' '}
        {match.status !== 'active'
          ? state.fail
            ? `Se equivocaron en la ronda ${state.fail.round}`
            : '¡Completaron todo!'
          : myTurn
            ? `¡Te toca! Repite los ${state.round} michis (${state.pos}/${state.round})`
            : `${activeName} está repitiendo la secuencia (${state.pos}/${state.round})…`}
      </div>
      <SimonPad lit={lit} onPress={press} disabled={!myTurn} />
      <p className="muted small center">Se turnan: cada ronda la repite uno. 14 rondas: x5 · 11: x3 · 8: x2 · 6: recuperan la apuesta.</p>
    </div>
  );
}
