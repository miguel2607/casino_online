import { useLayoutEffect, useRef, useState } from 'react';
import { canRecycle, legalTargets } from '@shared/solitaire.js';
import PlayingCard from './PlayingCard.jsx';
import { SUIT_SYMBOL } from '../format.js';

const sameTarget = (a, b) => a && b && a.p === b.p && a.i === b.i;

/**
 * Tablero de solitario táctil. No guarda la partida: avisa con onMove(move) y el padre decide.
 * onMove debe devolver true si el movimiento se aplicó.
 */
export default function SolitaireBoard({ state, onMove, disabled = false, onDrawBlocked }) {
  const boardRef = useRef(null);
  const [cardW, setCardW] = useState(80);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const gap = w < 520 ? 5 : 12;
      setCardW(Math.min(100, Math.floor((w - gap * 6) / 7)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearSelection = () => {
    setSelected(null);
    setTargets([]);
  };

  const move = (m) => {
    clearSelection();
    return onMove(m);
  };

  const tapCard = (from) => {
    if (disabled) return;
    if (selected && !(selected.p === from.p && selected.i === from.i && selected.c === from.c)) {
      const dest = { p: from.p, i: from.i };
      if (targets.some((t) => sameTarget(t, dest))) {
        move({ t: 'm', f: selected, to: dest });
        return;
      }
    }
    const opts = legalTargets(state, from);
    if (!opts.length) return clearSelection();
    // Un toque manda la carta a su mejor destino; si hay varios, se elige después
    if (opts[0].p === 'f' || opts.length === 1) {
      move({ t: 'm', f: from, to: opts[0] });
      return;
    }
    setSelected(from);
    setTargets(opts);
  };

  const tapEmpty = (dest) => {
    if (disabled) return;
    if (selected && targets.some((t) => sameTarget(t, dest))) move({ t: 'm', f: selected, to: dest });
    else clearSelection();
  };

  const draw = () => {
    if (disabled) return;
    if (!move({ t: 'd' })) onDrawBlocked?.();
  };

  const isSel = (from) => selected && selected.p === from.p && selected.i === from.i && (from.p !== 't' || from.c >= selected.c);
  const isTarget = (dest) => targets.some((t) => sameTarget(t, dest));
  const upGap = Math.round(cardW * 0.34);
  const downGap = Math.round(cardW * 0.16);
  const cardH = Math.round(cardW * 1.4);
  const wasteShown = state.waste.slice(-(state.draw === 3 ? 3 : 1));

  return (
    <div
      className="felt sol-board"
      ref={boardRef}
      style={{ '--card-w': `${cardW}px` }}
      onClick={(e) => e.target === e.currentTarget && clearSelection()}
    >
      <div className="sol-top">
        <div className="sol-slot" onClick={draw}>
          {state.stock.length ? (
            <PlayingCard hidden className="is-clickable" />
          ) : (
            <div className={`sol-empty sol-recycle ${canRecycle(state) ? '' : 'is-dead'}`}>{canRecycle(state) ? '↻' : '✕'}</div>
          )}
          {state.stock.length > 0 && <span className="sol-count">{state.stock.length}</span>}
        </div>
        <div className="sol-slot sol-waste" style={{ width: cardW * (state.draw === 3 ? 1.6 : 1) }}>
          {wasteShown.length === 0 && <div className="sol-empty" />}
          {wasteShown.map((c, k) => {
            const isTop = k === wasteShown.length - 1;
            return (
              <PlayingCard
                key={`${c.r}${c.s}`}
                card={c}
                style={{ position: 'absolute', left: k * cardW * 0.3, zIndex: k }}
                selected={isTop && isSel({ p: 'w' })}
                onClick={isTop ? () => tapCard({ p: 'w' }) : undefined}
              />
            );
          })}
        </div>
        <div className="sol-spacer" />
        {state.foundations.map((pile, i) => {
          const topCard = pile[pile.length - 1];
          return (
            <div key={i} className="sol-slot">
              {topCard ? (
                <PlayingCard
                  card={topCard}
                  selected={isSel({ p: 'f', i })}
                  highlight={isTarget({ p: 'f', i })}
                  onClick={() => tapCard({ p: 'f', i })}
                />
              ) : (
                <div className={`sol-empty sol-foundation ${isTarget({ p: 'f', i }) ? 'is-target' : ''}`} onClick={() => tapEmpty({ p: 'f', i })}>
                  {SUIT_SYMBOL[['S', 'H', 'D', 'C'][i]]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sol-tableau">
        {state.tableau.map((col, i) => {
          let y = 0;
          const tops = col.map((c) => {
            const t = y;
            y += c.up ? upGap : downGap;
            return t;
          });
          const height = col.length ? tops[tops.length - 1] + cardH : cardH;
          return (
            <div key={i} className="sol-col" style={{ height }}>
              {col.length === 0 && (
                <div className={`sol-empty ${isTarget({ p: 't', i }) ? 'is-target' : ''}`} onClick={() => tapEmpty({ p: 't', i })}>
                  K
                </div>
              )}
              {col.map((c, k) => (
                <PlayingCard
                  key={`${c.r}${c.s}`}
                  card={c}
                  style={{ position: 'absolute', top: tops[k], zIndex: k }}
                  selected={c.up && isSel({ p: 't', i, c: k })}
                  highlight={k === col.length - 1 && isTarget({ p: 't', i })}
                  onClick={c.up ? () => tapCard({ p: 't', i, c: k }) : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
