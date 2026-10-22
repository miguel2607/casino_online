import { useEffect, useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { useKeys, useServerClock } from '../../hooks/gameHooks.js';

export default function ReflexGame({ match, act, colors }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const now = useServerClock(state.serverNow);
  const [shown, setShown] = useState(false);
  const shownAt = useRef(null);
  const tapped = useRef(false);
  const roundKey = `${state.round}-${state.goAt}`;

  // El michi aparece exactamente en goAt (hora del servidor); el tiempo de reacción se mide aquí
  useEffect(() => {
    tapped.current = Boolean(state.myTap);
    setShown(false);
    shownAt.current = null;
    if (state.phase !== 'waiting') return undefined;
    const delay = state.goAt - now();
    const t = setTimeout(() => {
      shownAt.current = performance.now();
      setShown(true);
    }, Math.max(0, delay));
    return () => clearTimeout(t);
  }, [roundKey, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (state.phase !== 'waiting' || tapped.current || match.status !== 'active') return;
    tapped.current = true;
    if (shownAt.current == null) act({ type: 'tap', early: true }).catch(() => {});
    else act({ type: 'tap', ms: Math.round(performance.now() - shownAt.current) }).catch(() => {});
  };
  useKeys({ ' ': tap, Enter: tap }, match.status === 'active');

  const last = state.last;
  const mineTap = state.myTap;
  let message;
  if (match.status !== 'active') message = 'Duelo terminado';
  else if (mineTap?.early) message = '¡Salida falsa! 🙀 Pierdes esta ronda';
  else if (mineTap) message = `${mineTap.ms} ms · esperando a ${other}…`;
  else if (shown) message = '¡AHORA! ¡TOCA!';
  else message = 'Espera al michi… no toques todavía';

  return (
    <div className="reflex-wrap">
      <div className="memory-scores">
        {[me, 1 - me].map((i) => (
          <span key={i}>
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{state.scores[i]}</b>
          </span>
        ))}
      </div>
      <button className={`reflex-zone ${shown && !mineTap ? 'is-go' : ''} ${mineTap?.early ? 'is-early' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
        {shown && !mineTap?.early ? <Cat color="orange" mood="shocked" size={140} /> : <span className="reflex-wait">⏳</span>}
        <strong>{message}</strong>
        <small>
          Ronda {state.round} · primero en {state.target} gana
        </small>
      </button>
      {last && (
        <p className="center small">
          Ronda anterior:{' '}
          {last.winner === null ? 'nadie la ganó' : last.winner === me ? '¡la ganaste! 🎉' : `la ganó ${other}`}
          {last.taps[me] && !last.taps[me].early ? ` · tú ${last.taps[me].ms} ms` : ''}
          {last.taps[1 - me] && !last.taps[1 - me].early ? ` · ${other} ${last.taps[1 - me].ms} ms` : ''}
        </p>
      )}
      <p className="muted small center">Celular: toca la zona grande. PC: espacio o Enter.</p>
    </div>
  );
}
