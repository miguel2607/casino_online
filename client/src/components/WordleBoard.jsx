import { useKeys } from '../hooks/gameHooks.js';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
const RANK = { correct: 3, present: 2, absent: 1 };

/** Estado de cada letra del teclado según los intentos hechos. */
function letterStates(guesses) {
  const out = {};
  for (const g of guesses) {
    [...g.word].forEach((ch, i) => {
      const st = g.feedback[i];
      if (!out[ch] || RANK[st] > RANK[out[ch]]) out[ch] = st;
    });
  }
  return out;
}

export function WordleGrid({ guesses, current = '', tries = 6, small = false, rowsOnly }) {
  const rows = [];
  for (let r = 0; r < tries; r++) {
    const g = guesses[r];
    const feedback = rowsOnly ? rowsOnly[r] : g?.feedback;
    const letters = g ? [...g.word] : r === guesses.length ? [...current] : [];
    rows.push(
      <div key={r} className="wordle-row">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`wordle-tile ${feedback ? `is-${feedback[i]}` : letters[i] ? 'is-typed' : ''}`}
            style={feedback ? { animationDelay: `${i * 0.12}s` } : undefined}
          >
            {small ? '' : letters[i] || ''}
          </span>
        ))}
      </div>,
    );
  }
  return <div className={`wordle-grid ${small ? 'is-small' : ''}`}>{rows}</div>;
}

export function WordleKeyboard({ guesses, onKey, disabled }) {
  const states = letterStates(guesses);
  useKeys(
    {
      Enter: () => onKey('ENTER'),
      Backspace: () => onKey('BACK'),
      ...Object.fromEntries([...ROWS.join('')].map((ch) => [ch.toLowerCase(), () => onKey(ch)])),
    },
    !disabled,
  );
  return (
    <div className={`wordle-kb ${disabled ? 'is-disabled' : ''}`}>
      {ROWS.map((row, k) => (
        <div key={row} className="wordle-kb-row">
          {k === 2 && (
            <button className="wordle-key is-wide" onClick={() => onKey('ENTER')} disabled={disabled}>
              Enviar
            </button>
          )}
          {[...row].map((ch) => (
            <button key={ch} className={`wordle-key ${states[ch] ? `is-${states[ch]}` : ''}`} onClick={() => onKey(ch)} disabled={disabled}>
              {ch}
            </button>
          ))}
          {k === 2 && (
            <button className="wordle-key is-wide" onClick={() => onKey('BACK')} disabled={disabled} aria-label="Borrar">
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
