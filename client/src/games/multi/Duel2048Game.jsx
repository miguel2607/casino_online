import { useEffect, useRef, useState } from 'react';
import * as g2048 from '@shared/g2048.js';
import Board2048 from '../../components/Board2048.jsx';
import Cat from '../../components/Cat.jsx';
import { mmss, useCountdown, useServerClock } from '../../hooks/gameHooks.js';

const SYNC_MS = 500;

export default function Duel2048Game({ match, act, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.deadline, now);
  const gameRef = useRef(null);
  const movesRef = useRef([]);
  const timer = useRef();
  const [, force] = useState(0);
  const active = match.status === 'active';

  if (!gameRef.current) {
    gameRef.current = g2048.replay(state.seed, state.myMoves) || g2048.newGame(state.seed);
    movesRef.current = [...state.myMoves];
  }
  const game = gameRef.current;
  const over = g2048.isOver(game) || state.over[me];

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (g2048.isOver(game) && !state.over[me]) act({ type: 'sync', moves: movesRef.current, done: true }).catch(() => {});
  }, [game.moves]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (dir) => {
    if (!active || over || left <= 0) return;
    if (g2048.move(game, dir)) {
      movesRef.current.push(dir);
      force((n) => n + 1);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => act({ type: 'sync', moves: movesRef.current }).catch(() => {}), SYNC_MS);
    }
  };

  const finishNow = () => {
    clearTimeout(timer.current);
    act({ type: 'sync', moves: movesRef.current, done: true }).catch(() => {});
  };

  return (
    <div>
      <div className="duel-progress">
        {[me, 1 - me].map((i) => (
          <div key={i} className="duel-row">
            <Cat color={colors[i]} size={28} />
            <span className="duel-name">{i === me ? 'Tú' : players[i].displayName}</span>
            <strong className="duel-score">{i === me ? game.score : state.scores[i]} pts</strong>
            <span className="duel-count">
              máx {i === me ? 2 ** g2048.maxTile(game) : state.maxTiles[i]} {state.over[i] ? '· terminó' : ''}
            </span>
          </div>
        ))}
        <small className="muted">⏱ {mmss(left)} · el mismo tablero para los dos; gana el puntaje más alto</small>
      </div>
      <Board2048 grid={game.grid} onMove={onMove} disabled={!active || over || left <= 0} />
      {active && !over && (
        <div className="action-row">
          <button className="btn btn-ghost" onClick={finishNow}>
            Ya no más, me planto
          </button>
        </div>
      )}
      {active && over && <div className="turn-banner">Terminaste con {game.score} puntos. Esperando a {players[1 - me].displayName}…</div>}
    </div>
  );
}
