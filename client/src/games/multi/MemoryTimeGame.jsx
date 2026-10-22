import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { PawIcon } from '../../components/Icons.jsx';
import { mmss, useCountdown, useElementWidth, useServerClock } from '../../hooks/gameHooks.js';

// 10 caras distintas de michi para las 10 parejas
const FACES = [
  { color: 'orange', mood: 'happy' },
  { color: 'gray', mood: 'wink' },
  { color: 'black', mood: 'love' },
  { color: 'white', mood: 'shocked' },
  { color: 'calico', mood: 'normal' },
  { color: 'cream', mood: 'sleepy' },
  { color: 'orange', mood: 'normal', accessory: 'crown' },
  { color: 'gray', mood: 'happy', accessory: 'bow' },
  { color: 'cream', mood: 'wink', accessory: 'crown' },
  { color: 'white', mood: 'love', accessory: 'bow' },
];

export default function MemoryTimeGame({ match, act }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.deadline, now);
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const active = match.status === 'active' && left > 0;
  const cols = 4;
  const cardW = width ? (Math.min(width, 460) - 8 * (cols - 1)) / cols : 0;

  const flip = async (index) => {
    if (!active || busy || state.pending[me]) return;
    setBusy(true);
    await act({ type: 'flip', index }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="memory-wrap" ref={ref}>
      <div className="memory-scores">
        <span className={left < 15000 ? 'text-red' : ''}>⏱ {mmss(left)}</span>
        <span>
          Parejas <b>{state.pairs}</b>/{state.total}
        </span>
      </div>
      <div className="turn-banner is-mine">¡Los dos a la vez! Encuentren todas las parejas antes de que se acabe el tiempo</div>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cardW}px)` }}>
        {state.cards.map((card, i) => {
          const face = card.face !== null ? FACES[card.face] : null;
          const owner = card.matchedBy ?? card.revealedBy;
          return (
            <button
              key={i}
              className={`memory-card ${face ? 'is-up' : ''} ${card.matchedBy !== null ? 'is-matched' : ''}`}
              style={{ width: cardW, height: cardW * 1.25, ...(owner !== null ? { '--owner': owner === me ? 'var(--mint)' : 'var(--pink)' } : {}) }}
              onClick={() => flip(i)}
              disabled={!active || face !== null}
            >
              <span className="memory-inner">
                <span className="memory-back">
                  <PawIcon size="40%" color="rgba(255,255,255,.85)" />
                </span>
                <span className="memory-front">{face && <Cat color={face.color} mood={face.mood} accessory={face.accessory} size="78%" />}</span>
              </span>
              {card.revealedBy !== null && card.revealedBy !== me && <span className="memory-owner" style={{ background: 'var(--pink)' }} />}
            </button>
          );
        })}
      </div>
      <p className="muted small center">
        Tus cartas en verde, las de {players[1 - me].displayName} en rosa. 10 parejas: x2 · 8 o 9: recuperan la apuesta.
      </p>
    </div>
  );
}
