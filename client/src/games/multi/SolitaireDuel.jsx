import { useEffect, useRef, useState } from 'react';
import { DIFFICULTIES, applyMove, autoCompleteMoves, canAutoComplete, isWon, replay } from '@shared/solitaire.js';
import SolitaireBoard from '../../components/SolitaireBoard.jsx';
import Cat from '../../components/Cat.jsx';
import { Icon } from '../../components/Icons.jsx';

const SYNC_DELAY_MS = 400;

export default function SolitaireDuel({ match, act, colors }) {
  const { me, state: shared, players } = match;
  const cfg = DIFFICULTIES[shared.difficulty];
  const other = players[1 - me].displayName;
  const active = match.status === 'active';

  // Mis movimientos viven en el cliente; el servidor los valida y los comparte como progreso
  const [moves, setMoves] = useState(() => shared.myMoves);
  const [board, setBoard] = useState(() => replay(shared.seed, shared.difficulty, shared.myMoves));
  const timer = useRef();
  const latest = useRef(moves);

  const sync = (m, immediate) => {
    latest.current = m;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => act({ type: 'sync', moves: latest.current }).catch(() => {}), immediate ? 0 : SYNC_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (nextMoves, nextBoard) => {
    setMoves(nextMoves);
    setBoard(nextBoard);
    sync(nextMoves, isWon(nextBoard));
  };

  const onMove = (move) => {
    if (!active) return false;
    const next = applyMove(board, move);
    if (!next) return false;
    commit([...moves, move], next);
    return true;
  };

  const undo = () => {
    if (!moves.length) return;
    const next = moves.slice(0, -1);
    commit(next, replay(shared.seed, shared.difficulty, next));
  };

  const autoComplete = () => {
    let b = board;
    const list = autoCompleteMoves(b);
    for (const mv of list) b = applyMove(b, mv);
    commit([...moves, ...list], b);
  };

  const pct = (n) => `${Math.round((n / 52) * 100)}%`;

  return (
    <div className="duel-wrap">
      <div className="duel-progress">
        {[me, 1 - me].map((i) => (
          <div key={i} className="duel-row">
            <Cat color={colors[i]} size={30} mood={shared.progress[i] >= 40 ? 'love' : 'happy'} />
            <span className="duel-name">{i === me ? 'Tú' : other}</span>
            <div className="bar">
              <div className="bar-fill" style={{ width: pct(shared.progress[i]) }} />
            </div>
            <span className="duel-count">
              {shared.progress[i]}/52 · {shared.moveCounts[i]} mov.
            </span>
          </div>
        ))}
        <small className="muted">
          Mismo reparto para los dos · {cfg.label}: {cfg.description}
        </small>
      </div>

      <SolitaireBoard state={board} onMove={onMove} disabled={!active} />

      {active && (
        <div className="action-row sol-actions">
          {cfg.undo && (
            <button className="btn btn-ghost" onClick={undo} disabled={!moves.length}>
              <Icon name="undo" size={18} /> Deshacer
            </button>
          )}
          {canAutoComplete(board) && (
            <button className="btn btn-gold" onClick={autoComplete}>
              <Icon name="magic" size={18} /> Autocompletar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
