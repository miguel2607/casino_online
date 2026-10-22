import { useEffect, useMemo, useRef, useState } from 'react';
import { SUDOKU_SIZES, conflicts } from '@shared/sudoku.js';
import SkillShell from '../../components/SkillShell.jsx';
import Cat from '../../components/Cat.jsx';
import { useElementWidth, useKeys, useSkillGame } from '../../hooks/gameHooks.js';

function Play({ skill }) {
  const { session, result } = skill;
  const { size, puzzle, boxRows, boxCols } = session;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [grid, setGrid] = useState(() => session.grid || [...puzzle]);
  const [sel, setSel] = useState(() => puzzle.indexOf(0));
  const bad = useMemo(() => conflicts(grid, size), [grid, size]);
  const full = grid.every(Boolean);

  useEffect(() => {
    if (full && bad.size === 0 && !result) skill.finish({ grid }).catch(() => {});
  }, [full, bad.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const put = (v) => {
    if (result || sel < 0 || puzzle[sel]) return;
    const next = [...grid];
    next[sel] = v;
    setGrid(next);
    skill.sync({ grid: next });
  };

  const moveSel = (dr, dc) => {
    const r = Math.floor(sel / size);
    const c = sel % size;
    setSel(((r + dr + size) % size) * size + ((c + dc + size) % size));
  };

  const keys = {
    ArrowUp: () => moveSel(-1, 0),
    ArrowDown: () => moveSel(1, 0),
    ArrowLeft: () => moveSel(0, -1),
    ArrowRight: () => moveSel(0, 1),
    Backspace: () => put(0),
    Delete: () => put(0),
    0: () => put(0),
  };
  for (let v = 1; v <= size; v++) keys[String(v)] = () => put(v);
  useKeys(keys, !result);

  const cell = width ? Math.floor(width / size) : 0;
  const selVal = grid[sel];

  return (
    <>
      <div className="sudoku-wrap" ref={ref}>
        <div className="sudoku-grid" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}>
          {grid.map((v, i) => {
            const r = Math.floor(i / size);
            const c = i % size;
            const cls = [
              'sudoku-cell',
              puzzle[i] ? 'is-given' : '',
              i === sel ? 'is-selected' : '',
              selVal && v === selVal && i !== sel ? 'is-same' : '',
              bad.has(i) ? 'is-bad' : '',
              c % boxCols === 0 ? 'bl' : '',
              r % boxRows === 0 ? 'bt' : '',
              c === size - 1 ? 'br' : '',
              r === size - 1 ? 'bb' : '',
            ].join(' ');
            return (
              <button key={i} className={cls} style={{ width: cell, height: cell, fontSize: cell * 0.5 }} onClick={() => setSel(i)}>
                {v || ''}
              </button>
            );
          })}
        </div>
      </div>
      {!result && (
        <div className="sudoku-pad" style={{ gridTemplateColumns: `repeat(${Math.min(size, 5) + 1}, 1fr)` }}>
          {Array.from({ length: size }, (_, k) => k + 1).map((v) => (
            <button key={v} className="btn btn-ghost sudoku-num" onClick={() => put(v)} disabled={sel < 0 || Boolean(puzzle[sel])}>
              {v}
            </button>
          ))}
          <button className="btn btn-ghost sudoku-num" onClick={() => put(0)} aria-label="Borrar">
            ⌫
          </button>
        </div>
      )}
      {full && bad.size > 0 && (
        <p className="center small text-red">
          <Cat mood="shocked" size={22} /> Hay números repetidos (en rojo)
        </p>
      )}
    </>
  );
}

export default function Sudoku() {
  const skill = useSkillGame('sudoku');
  const [size, setSize] = useState(4);
  return (
    <SkillShell
      title="Sudoku de Michis"
      emoji="🔢"
      subtitle="Completa el tablero sin repetir número en fila, columna ni caja"
      controls="Toca una casilla y luego un número. PC: flechas para moverte y teclas numéricas para escribir. Al completarlo bien, cobras solo."
      table={Object.values(SUDOKU_SIZES).map((s) => [`Resolver ${s.label}`, s.multiplier])}
      skill={skill}
      getOptions={() => ({ size })}
      options={
        <div className="diff-grid">
          {Object.entries(SUDOKU_SIZES).map(([id, s]) => (
            <button key={id} className={`diff-card ${Number(id) === size ? 'is-active diff-medium' : ''}`} onClick={() => setSize(Number(id))}>
              <strong>{s.label}</strong>
              <span className="diff-mult">x{s.multiplier}</span>
            </button>
          ))}
        </div>
      }
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}
