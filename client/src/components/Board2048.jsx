import { useRef } from 'react';
import Cat from './Cat.jsx';
import { useElementWidth, useKeys, useSwipe } from '../hooks/gameHooks.js';

// Cada nivel de ficha es un michi distinto (el 2048 es el rey)
const LEVELS = [
  null,
  { color: 'cream', mood: 'sleepy', bg: '#fde7c8' },
  { color: 'white', mood: 'normal', bg: '#fcd5b5' },
  { color: 'gray', mood: 'happy', bg: '#f9b98c' },
  { color: 'orange', mood: 'happy', bg: '#f6956b' },
  { color: 'calico', mood: 'wink', bg: '#f47c7c' },
  { color: 'black', mood: 'happy', bg: '#ee5d8d' },
  { color: 'cream', mood: 'love', bg: '#e94590' },
  { color: 'gray', mood: 'love', bg: '#c13fb0' },
  { color: 'orange', mood: 'love', accessory: 'bow', bg: '#9d4edd' },
  { color: 'calico', mood: 'love', accessory: 'crown', bg: '#7b5cf0' },
  { color: 'orange', mood: 'love', accessory: 'crown', bg: '#f2a52b' },
  { color: 'black', mood: 'love', accessory: 'crown', bg: '#ffcf5a' },
];

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

export default function Board2048({ grid, onMove, disabled = false }) {
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const swipe = useSwipe((dir) => !disabled && onMove(dir));
  useKeys(Object.fromEntries(Object.entries(KEYS).map(([k, dir]) => [k, () => onMove(dir)])), !disabled);

  const gap = width < 360 ? 6 : 10;
  const cell = width ? (width - gap * 5) / 4 : 0;

  return (
    <div className="b2048-wrap" ref={ref}>
      <div className="b2048" style={{ height: width, padding: gap, gap }} {...swipe}>
        {grid.map((v, i) => {
          const lvl = LEVELS[Math.min(v, LEVELS.length - 1)];
          return (
            <div key={i} className={`b2048-cell ${v ? 'has-tile' : ''}`} style={{ width: cell, height: cell }}>
              {v > 0 && (
                <div key={v} className="b2048-tile" style={{ background: lvl.bg }}>
                  <Cat color={lvl.color} mood={lvl.mood} accessory={lvl.accessory} size={cell * 0.62} />
                  <span style={{ fontSize: Math.max(11, cell * (v >= 10 ? 0.17 : 0.2)) }}>{2 ** v}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
