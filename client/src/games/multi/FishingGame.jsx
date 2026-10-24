import { useEffect, useRef } from 'react';
import Cat from '../../components/Cat.jsx';
import { useCountdown, useKeys, useServerClock } from '../../hooks/gameHooks.js';

const BITE = {
  fish: { e: '🐟', text: '¡Picó! ¡TOCA!' },
  gold: { e: '🐠', text: '¡DORADO! ¡RÁPIDO!' },
  boot: { e: '👢', text: 'Es una bota… ¡no toques!' },
};
const RESULT = {
  caught: (l) => `¡Lo sacaste! ${BITE[l.type].e}${l.ms ? ` en ${l.ms} ms` : ''}`,
  late: () => 'Muy lento… se escapó 💨',
  escaped: () => 'Se fue sin que tocaras 💨',
  boot: () => 'Sacaste una bota 👢 −1',
  ignored: () => 'Bien, ignoraste la bota 👍',
  scared: () => 'Tocaste sin que picara: espantaste los peces 🙀',
};

/** Pesca rápida: cuando el corcho se hunde, toca lo más rápido que puedas (menos si es una bota). */
export default function FishingGame({ match, act, colors }) {
  const { me, state, players } = match;
  const active = match.status === 'active';
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.endAt, now);
  const toStart = useCountdown(state.startAt, now);
  const shownAt = useRef(null);
  const sentFor = useRef(null);
  const bite = state.bite;

  useEffect(() => {
    shownAt.current = bite ? performance.now() : null;
  }, [bite?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hook = () => {
    if (!active || toStart > 0) return;
    if (bite && sentFor.current === bite.id) return;
    sentFor.current = bite?.id ?? null;
    navigator.vibrate?.(20);
    act({ type: 'hook', id: bite?.id ?? null, ms: shownAt.current ? Math.round(performance.now() - shownAt.current) : null }).catch(() => {});
  };
  useKeys({ ' ': hook, Enter: hook }, active);

  const last = state.last;
  let message;
  if (!active) message = 'Se acabó la pesca';
  else if (toStart > 0) message = `Lancen las cañas… ${Math.ceil(toStart / 1000)}`;
  else if (bite) message = BITE[bite.type].text;
  else message = 'Espera a que pique…';

  return (
    <div className="arena-game">
      <div className="arena-hud">
        {[me, 1 - me].map((i) => (
          <span key={i} className="arena-hud-item">
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{state.scores[i]}</b>
          </span>
        ))}
        <span className="arena-hud-item">⏱ {Math.ceil(left / 1000)} s</span>
      </div>
      <button
        type="button"
        className={`fish-lake ${bite ? 'is-bite' : ''} ${bite?.type === 'gold' ? 'is-gold' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          hook();
        }}
      >
        <span className="fish-bobber">{bite ? BITE[bite.type].e : '🎣'}</span>
        <strong>{message}</strong>
        {last && <small>{RESULT[last.result]?.(last)}</small>}
        {state.opponentBiting && active && <small>🎣 A {players[1 - me].displayName} le está picando algo…</small>}
      </button>
      <div className="fish-caught" aria-label="Lo que pescaste">
        {state.caught.map((t, i) => (
          <span key={i}>{BITE[t].e}</span>
        ))}
      </div>
      <p className="arena-help">🐟 vale 1 · 🐠 dorado vale 3 (pica más rápido) · 👢 si la sacas te resta 1 · tocar sin picada espanta a los peces. PC: espacio.</p>
    </div>
  );
}
