import { useState } from 'react';
import { WordleGrid, WordleKeyboard } from '../../components/WordleBoard.jsx';
import { useWordInput } from '../skill/Wordle.jsx';
import { mmss, useCountdown, useServerClock } from '../../hooks/gameHooks.js';

export default function DuelWordleGame({ match, act }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.deadline, now);
  const [sending, setSending] = useState(false);
  const other = players[1 - me].displayName;
  const mine = state.myGuesses;
  const done = match.status !== 'active' || state.solved[me] || mine.length >= state.tries;

  const { current, onKey } = useWordInput(async (word, clear) => {
    setSending(true);
    try {
      await act({ type: 'guess', word });
      clear();
    } catch {
      // el error ya se mostró
    } finally {
      setSending(false);
    }
  }, done || sending);

  return (
    <div className="wordle-wrap">
      <div className="duel-wordle-top">
        <div>
          <small className="muted">Tú</small>
          <WordleGrid guesses={mine} current={current} tries={state.tries} />
        </div>
        <div className="duel-wordle-other">
          <small className="muted">{other}</small>
          <WordleGrid guesses={state.opponentRows.map((f) => ({ word: '     ', feedback: f }))} rowsOnly={state.opponentRows} tries={state.tries} small />
          {state.solved[1 - me] && <small className="text-mint">¡Ya la adivinó!</small>}
        </div>
      </div>
      <p className="center small muted">⏱ {mmss(left)} · gana quien la adivine en menos intentos</p>
      {state.answer && (
        <p className="center">
          La palabra era <b className="text-pink">{state.answer}</b>
        </p>
      )}
      {!state.answer && done && <div className="turn-banner">Terminaste. Esperando a {other}…</div>}
      <WordleKeyboard guesses={mine} onKey={onKey} disabled={done || sending} />
    </div>
  );
}
