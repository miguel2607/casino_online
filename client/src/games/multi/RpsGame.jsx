import { useEffect, useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';

const CHOICES = {
  rock: { emoji: '✊', label: 'Piedra' },
  paper: { emoji: '✋', label: 'Papel' },
  scissors: { emoji: '✌️', label: 'Tijera' },
};

export default function RpsGame({ match, act, colors }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);
  const seenRounds = useRef(state.rounds.length);

  // Cuando se completa una ronda, mostramos la revelación unos segundos
  useEffect(() => {
    if (state.rounds.length > seenRounds.current) {
      setReveal(state.rounds[state.rounds.length - 1]);
      const t = setTimeout(() => setReveal(null), 2200);
      seenRounds.current = state.rounds.length;
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.rounds]);

  const choose = async (choice) => {
    setBusy(true);
    await act({ type: 'choose', choice }).catch(() => {});
    setBusy(false);
  };

  const active = match.status === 'active';
  const shown = reveal || (!active && state.rounds[state.rounds.length - 1]);

  return (
    <div className="felt rps-table">
      <div className="rps-score">
        <span>
          Tú <b>{state.scores[me]}</b>
        </span>
        <small>al mejor de 3</small>
        <span>
          <b>{state.scores[1 - me]}</b> {other}
        </span>
      </div>

      {shown ? (
        <div className="rps-reveal">
          <div className={`rps-hand ${shown.winner === me ? 'is-winner' : ''}`}>
            <span>{CHOICES[shown.choices[me]].emoji}</span>
            <small>Tú</small>
          </div>
          <strong className="rps-verdict">
            {shown.winner === null ? '¡Empate!' : shown.winner === me ? '¡Ganaste la ronda!' : `Ronda para ${other}`}
          </strong>
          <div className={`rps-hand is-other ${shown.winner === 1 - me ? 'is-winner' : ''}`}>
            <span>{CHOICES[shown.choices[1 - me]].emoji}</span>
            <small>{other}</small>
          </div>
        </div>
      ) : (
        <div className="rps-waiting">
          <div className="rps-status">
            <Cat color={colors[me]} mood={state.myChoice ? 'happy' : 'normal'} size={56} />
            <small>{state.myChoice ? `Elegiste ${CHOICES[state.myChoice].emoji}` : 'Elige tu jugada'}</small>
          </div>
          <div className="rps-status">
            <Cat color={colors[1 - me]} mood={state.opponentChose ? 'wink' : 'sleepy'} size={56} />
            <small>{state.opponentChose ? `${other} ya eligió 🤫` : `${other} está pensando…`}</small>
          </div>
        </div>
      )}

      {active && (
        <div className="rps-choices">
          {Object.entries(CHOICES).map(([id, c]) => (
            <button
              key={id}
              className={`rps-choice ${state.myChoice === id ? 'is-active' : ''}`}
              disabled={busy || Boolean(state.myChoice) || Boolean(reveal)}
              onClick={() => choose(id)}
            >
              <span>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
