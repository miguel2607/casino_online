import { useEffect, useRef, useState } from 'react';
import { mmss, useCountdown, useServerClock } from '../../hooks/gameHooks.js';

const SYNC_MS = 600;

export default function StopGame({ match, act }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.endsAt, now);
  const [answers, setAnswers] = useState(state.myAnswers);
  const [rejected, setRejected] = useState(() => state.categories.map(() => false));
  const [busy, setBusy] = useState(false);
  const timer = useRef();
  const roundKey = `${state.round}-${state.letter}`;

  // Nueva ronda: limpiamos las respuestas
  useEffect(() => {
    setAnswers(state.myAnswers);
    setRejected(state.categories.map(() => false));
  }, [roundKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  const writing = state.phase === 'writing' || state.phase === 'basta';
  const setAnswer = (k, v) => {
    const next = answers.map((a, i) => (i === k ? v : a));
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => act({ type: 'answers', answers: next }).catch(() => {}), SYNC_MS);
  };

  const basta = async () => {
    setBusy(true);
    clearTimeout(timer.current);
    await act({ type: 'basta', answers }).catch(() => {});
    setBusy(false);
  };

  const confirmReview = async () => {
    setBusy(true);
    await act({ type: 'review', rejected }).catch(() => {});
    setBusy(false);
  };

  const starts = (w) => w.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').startsWith(state.letter);
  const filled = answers.filter((a) => a.trim()).length;

  if (state.phase === 'starting') return <div className="turn-banner">Preparando la primera letra…</div>;

  return (
    <div className="stop-wrap">
      <div className="stop-top">
        <div className="stop-letter">{state.letter}</div>
        <div className="stop-info">
          <strong>
            Ronda {state.round} de {state.rounds}
          </strong>
          <span className="muted small">
            Tú {state.scores[me]} · {other} {state.scores[1 - me]}
          </span>
          {writing && (
            <span className={state.phase === 'basta' ? 'text-red' : 'muted'}>
              {state.phase === 'basta' ? `¡${state.bastaBy === me ? 'Dijiste' : `${other} dijo`} BASTA! ${Math.ceil(left / 1000)}…` : `⏱ ${mmss(left)}`}
            </span>
          )}
        </div>
      </div>

      {writing && (
        <>
          <div className="stop-fields">
            {state.categories.map((cat, k) => (
              <label key={cat} className="field">
                <span>{cat}</span>
                <input
                  value={answers[k]}
                  onChange={(e) => setAnswer(k, e.target.value)}
                  placeholder={`${cat} con ${state.letter}…`}
                  maxLength={30}
                  autoCapitalize="words"
                  autoComplete="off"
                  className={answers[k].trim() && !starts(answers[k]) ? 'is-wrong' : ''}
                />
              </label>
            ))}
          </div>
          <p className="muted small center">
            {other} lleva {state.opponentFilled}/{state.categories.length}
          </p>
          {state.phase === 'writing' && (
            <button className="btn btn-gold btn-lg btn-block stop-basta" onClick={basta} disabled={busy || filled < state.categories.length}>
              ✋ ¡BASTA!
            </button>
          )}
        </>
      )}

      {state.phase === 'review' && (
        <div className="panel">
          <h3 className="panel-title">Revisa las respuestas de {other}</h3>
          <p className="muted small">Toca las que no valen. Las vacías o que no empiezan con {state.letter} ya cuentan como inválidas.</p>
          <div className="stop-review">
            {state.categories.map((cat, k) => {
              const theirs = state.opponentAnswers?.[k] || '';
              const autoBad = !theirs.trim() || !starts(theirs);
              return (
                <div key={cat} className="stop-review-row">
                  <span className="muted small">{cat}</span>
                  <span className="stop-mine">{answers[k] || '—'}</span>
                  <button
                    className={`stop-theirs ${autoBad || rejected[k] ? 'is-rejected' : 'is-ok'}`}
                    disabled={autoBad || state.confirmed[me]}
                    onClick={() => setRejected(rejected.map((r, i) => (i === k ? !r : r)))}
                  >
                    {theirs || '—'} {autoBad || rejected[k] ? '✗' : '✓'}
                  </button>
                </div>
              );
            })}
          </div>
          {state.confirmed[me] ? (
            <div className="turn-banner">Esperando a que {other} revise las tuyas…</div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={confirmReview} disabled={busy}>
              Confirmar revisión
            </button>
          )}
        </div>
      )}

      {(state.phase === 'between' || match.status !== 'active') && state.history.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">Resultado de la ronda {state.history.length}</h3>
          {(() => {
            const h = state.history[state.history.length - 1];
            return (
              <div className="stop-review">
                {state.categories.map((cat, k) => (
                  <div key={cat} className="stop-review-row">
                    <span className="muted small">{cat}</span>
                    <span className={h.valid[me][k] ? '' : 'is-struck'}>
                      {h.answers[me][k] || '—'} <b className="text-mint">+{h.points[me][k]}</b>
                    </span>
                    <span className={h.valid[1 - me][k] ? '' : 'is-struck'}>
                      {h.answers[1 - me][k] || '—'} <b className="text-mint">+{h.points[1 - me][k]}</b>
                    </span>
                  </div>
                ))}
                <div className="stop-review-row stop-total">
                  <span>Total</span>
                  <b>Tú +{h.totals[me]}</b>
                  <b>
                    {other} +{h.totals[1 - me]}
                  </b>
                </div>
              </div>
            );
          })()}
          {state.phase === 'between' && <p className="muted small center">La siguiente letra sale en {Math.ceil(left / 1000)} s…</p>}
        </div>
      )}
      <p className="muted small center">Única respuesta válida: 20 · distintas: 10 · iguales: 5</p>
    </div>
  );
}
