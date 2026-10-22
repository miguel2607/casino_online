import { useEffect, useRef, useState } from 'react';
import { MINE_LEVELS, apply, newBoard, replay } from '@shared/minesweeper.js';
import SkillShell from '../../components/SkillShell.jsx';
import { useElementWidth, useSkillGame } from '../../hooks/gameHooks.js';

const NUM_COLORS = ['', '#3d6fd8', '#13915f', '#d6304f', '#6b21a8', '#9c3b16', '#0e7490', '#241c33', '#7a7a7a'];
const LONG_PRESS_MS = 420;

function Play({ skill }) {
  const { session, result } = skill;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const actionsRef = useRef(session.actions || []);
  const [board, setBoard] = useState(() => replay(session.seed, session.level, session.actions || []) || newBoard(session.level));
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const press = useRef(null);
  const cfg = MINE_LEVELS[session.level];
  const over = board.won || board.lost;

  useEffect(() => {
    if (over) return undefined;
    const t0 = session.startedAt || Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [over, session.startedAt]);

  useEffect(() => {
    if (over && !result) skill.finish({ actions: actionsRef.current }).catch(() => {});
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAction = (action) => {
    if (over || result) return;
    const next = { ...board, revealed: [...board.revealed], flagged: [...board.flagged] };
    if (!apply(session.seed, next, action)) return;
    actionsRef.current = [...actionsRef.current, action];
    setBoard(next);
    if (!next.won && !next.lost) skill.sync({ actions: actionsRef.current });
  };

  const tap = (i) => {
    if (board.revealed[i]) return doAction({ t: 'c', i });
    doAction({ t: flagMode ? 'f' : 'r', i });
  };

  // Mantener presionado (celular) o clic derecho (PC) pone bandera
  const handlers = (i) => ({
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      press.current = { i, fired: false, timer: setTimeout(() => {
        press.current.fired = true;
        doAction({ t: 'f', i });
        navigator.vibrate?.(30);
      }, LONG_PRESS_MS) };
    },
    onPointerUp: () => press.current && clearTimeout(press.current.timer),
    onPointerLeave: () => press.current && clearTimeout(press.current.timer),
    onClick: () => {
      if (press.current?.fired) {
        press.current = null;
        return;
      }
      tap(i);
    },
    onContextMenu: (e) => {
      e.preventDefault();
      doAction({ t: 'f', i });
    },
  });

  const cell = width ? Math.floor(width / cfg.cols) : 0;
  const flags = board.flagged.filter(Boolean).length;

  return (
    <>
      <div className="mines-bar">
        <span>🥒 {cfg.mines - flags}</span>
        <button className={`btn btn-sm ${flagMode ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setFlagMode((f) => !f)} disabled={over}>
          🚩 {flagMode ? 'Modo bandera' : 'Poner banderas'}
        </button>
        <span>⏱ {elapsed}s</span>
      </div>
      <div className="mines-wrap" ref={ref}>
        <div className="mines-grid" style={{ gridTemplateColumns: `repeat(${cfg.cols}, ${cell}px)` }}>
          {board.revealed.map((open, i) => {
            const isMine = board.mines?.has(i);
            const showMine = over && isMine;
            const n = board.counts?.[i] ?? 0;
            return (
              <button
                key={i}
                className={`mine-cell ${open ? 'is-open' : ''} ${board.exploded === i ? 'is-exploded' : ''} ${showMine ? 'is-mine' : ''}`}
                style={{ width: cell, height: cell, fontSize: cell * 0.55 }}
                {...handlers(i)}
                aria-label={open ? `${n}` : 'Caja cerrada'}
              >
                {showMine ? '🥒' : open ? (n ? <b style={{ color: NUM_COLORS[n] }}>{n}</b> : '') : board.flagged[i] ? '🚩' : ''}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function Minesweeper() {
  const skill = useSkillGame('mines');
  const [level, setLevel] = useState('easy');
  return (
    <SkillShell
      title="Buscaminas de Michis"
      emoji="🥒"
      subtitle="Destapa todas las cajas sin pepino: a los michis les asustan"
      controls="Toca para destapar. Para poner bandera: mantén presionado, usa el botón 🚩 o clic derecho en PC. Toca un número con sus banderas puestas para destapar alrededor."
      table={Object.values(MINE_LEVELS).map((l) => [`Ganar en ${l.label} (${l.rows}×${l.cols}, ${l.mines} pepinos)`, l.multiplier])}
      skill={skill}
      getOptions={() => ({ level })}
      options={
        <div className="diff-grid">
          {Object.entries(MINE_LEVELS).map(([id, l]) => (
            <button key={id} className={`diff-card diff-${id} ${level === id ? 'is-active' : ''}`} onClick={() => setLevel(id)}>
              <strong>{l.label}</strong>
              <span className="diff-mult">x{l.multiplier}</span>
              <small>
                {l.rows}×{l.cols} · {l.mines} pepinos
              </small>
            </button>
          ))}
        </div>
      }
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}

