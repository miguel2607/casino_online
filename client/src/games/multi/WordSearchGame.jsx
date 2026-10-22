import { useRef, useState } from 'react';
import { lineCells } from '@shared/wordsearch.js';
import { mmss, useCountdown, useElementWidth, useServerClock } from '../../hooks/gameHooks.js';

const MINE = 'rgba(255, 126, 182, 0.55)';
const THEIRS = 'rgba(92, 225, 181, 0.55)';

export default function WordSearchGame({ match, act }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.deadline, now);
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [start, setStart] = useState(null);
  const [hover, setHover] = useState(null);
  const dragging = useRef(false);
  const { size, grid } = state;
  const cell = width ? Math.floor(Math.min(width, 460) / size) : 0;
  const active = match.status === 'active' && left > 0;

  const foundColor = {};
  state.words.forEach((w) => w.cells?.forEach((c) => (foundColor[c] = w.foundBy === me ? MINE : THEIRS)));
  const preview = start !== null && hover !== null ? lineCells(size, start, hover) || [start] : start !== null ? [start] : [];

  const submit = (from, to) => {
    setStart(null);
    setHover(null);
    if (from === to) return;
    act({ type: 'select', from, to }).catch(() => {});
  };

  // Toca la primera letra y luego la última (o arrastra el dedo / mouse)
  const cellFromEvent = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const i = el?.dataset?.cell;
    return i === undefined ? null : Number(i);
  };
  const handlers = {
    onPointerDown: (e) => {
      if (!active) return;
      const i = cellFromEvent(e);
      if (i === null) return;
      if (start !== null && start !== i) return submit(start, i);
      dragging.current = true;
      setStart(i);
      setHover(i);
    },
    onPointerMove: (e) => {
      if (!dragging.current) return;
      const i = cellFromEvent(e);
      if (i !== null) setHover(i);
    },
    onPointerUp: (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      const i = cellFromEvent(e);
      if (i !== null && i !== start) submit(start, i);
    },
  };

  return (
    <div className="ws-wrap" ref={ref}>
      <div className="memory-scores">
        <span className={left < 20000 ? 'text-red' : ''}>⏱ {mmss(left)}</span>
        <span>Tema: {state.theme}</span>
        <span>
          {state.words.filter((w) => w.foundBy !== null).length}/{state.words.length}
        </span>
      </div>
      <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }} {...handlers}>
        {grid.map((ch, i) => (
          <span
            key={i}
            data-cell={i}
            className={`ws-cell ${preview.includes(i) ? 'is-selecting' : ''}`}
            style={{ width: cell, height: cell, fontSize: cell * 0.55, background: foundColor[i] }}
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="ws-words">
        {state.words.map((w) => (
          <span key={w.word} className={w.foundBy !== null ? 'is-found' : ''} style={w.foundBy !== null ? { background: w.foundBy === me ? MINE : THEIRS } : undefined}>
            {w.word}
          </span>
        ))}
      </div>
      <p className="muted small center">
        Toca la primera y la última letra de una palabra (o arrástrala). Tus hallazgos en rosa, los de {players[1 - me].displayName} en verde. Todas: x2 · 6 o 7:
        recuperan la apuesta.
      </p>
    </div>
  );
}
