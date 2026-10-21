import { useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { PawIcon } from '../../components/Icons.jsx';

// 8 caras distintas de michi para las 8 parejas
const FACES = [
  { color: 'orange', mood: 'happy' },
  { color: 'gray', mood: 'wink' },
  { color: 'black', mood: 'love' },
  { color: 'white', mood: 'shocked' },
  { color: 'calico', mood: 'normal' },
  { color: 'cream', mood: 'sleepy' },
  { color: 'orange', mood: 'normal', accessory: 'crown' },
  { color: 'gray', mood: 'happy', accessory: 'bow' },
];

export default function MemoryGame({ match, act, colors }) {
  const { me, state, players } = match;
  const [busy, setBusy] = useState(false);
  const active = match.status === 'active';
  const myTurn = active && state.turn === me && !state.pending;
  const other = players[1 - me].displayName;

  const flip = async (index) => {
    if (!myTurn || busy) return;
    setBusy(true);
    await act({ type: 'flip', index }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="memory-wrap">
      <div className="memory-scores">
        <span className={state.turn === me && active ? 'is-turn' : ''}>
          Tú · <b>{state.scores[me]}</b>
        </span>
        <span className={state.turn !== me && active ? 'is-turn' : ''}>
          {other} · <b>{state.scores[1 - me]}</b>
        </span>
      </div>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {!active ? 'Partida terminada' : state.pending ? 'No son pareja… 🙈' : myTurn ? '¡Tu turno! Voltea dos cartas' : `Turno de ${other}…`}
      </div>
      <div className="memory-grid">
        {state.cards.map((card, i) => {
          const face = card.face !== null ? FACES[card.face] : null;
          return (
            <button
              key={i}
              className={`memory-card ${face ? 'is-up' : ''} ${card.by !== null ? 'is-matched' : ''}`}
              style={card.by !== null ? { '--owner': card.by === me ? 'var(--mint)' : 'var(--pink)' } : undefined}
              onClick={() => flip(i)}
              disabled={!myTurn || busy || face !== null}
              aria-label={face ? 'Carta volteada' : 'Carta boca abajo'}
            >
              <span className="memory-inner">
                <span className="memory-back">
                  <PawIcon size="40%" color="rgba(255,255,255,.85)" />
                </span>
                <span className="memory-front">{face && <Cat color={face.color} mood={face.mood} accessory={face.accessory} size="78%" />}</span>
              </span>
              {card.by !== null && <span className="memory-owner" style={{ background: card.by === me ? 'var(--mint)' : 'var(--pink)' }} />}
            </button>
          );
        })}
      </div>
      <p className="muted small center">Tus parejas se marcan en verde y las de {other} en rosa.</p>
    </div>
  );
}
