import { useEffect, useMemo, useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { buildPlan, positionAt } from '../../raceAnim.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RaceDuel({ match, act, colors }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState({});
  const [phase, setPhase] = useState('picking'); // picking | countdown | racing | done
  const [countdown, setCountdown] = useState(null);
  const raf = useRef();
  // Diferencia entre el reloj del servidor y el nuestro, para que ambos vean la carrera a la vez
  const offset = useRef(0);
  useEffect(() => {
    offset.current = state.serverNow - Date.now();
  }, [state.serverNow]);

  const plan = useMemo(() => (state.order ? buildPlan(state.order, state.seed) : null), [state.order, state.seed]);

  useEffect(() => {
    if (!plan) return undefined;
    const lastFinish = Math.max(...Object.values(plan).map((p) => p.finish));
    const tick = () => {
      const t = Date.now() + offset.current - state.startAt;
      if (t < 0) {
        setPhase('countdown');
        setCountdown(Math.ceil(-t / 500));
      } else {
        const pos = {};
        for (const id of state.order) pos[id] = positionAt(plan[id], t);
        setPositions(pos);
        setPhase(t > lastFinish + 150 ? 'done' : 'racing');
        if (t > lastFinish + 150) return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [plan, state.order, state.startAt]);

  const pick = async (cat) => {
    setBusy(true);
    await act({ type: 'pick', cat }).catch(() => {});
    setBusy(false);
  };

  const owner = (catId) => state.picks.indexOf(catId);
  const showPlaces = phase === 'done';
  const myPick = state.runners.find((r) => r.id === state.picks[me]);

  return (
    <div className="race-duel">
      <div className={`turn-banner ${!state.picks[me] ? 'is-mine' : ''}`}>
        {state.order
          ? phase === 'countdown'
            ? `¡Arrancan en ${countdown}…!`
            : phase === 'racing'
              ? '¡Corriendo!'
              : 'Carrera terminada'
          : !state.picks[me]
            ? 'Elige tu michi (tu pareja elige otro)'
            : state.picks[1 - me]
              ? 'Preparando la salida…'
              : `Esperando a que ${other} elija…`}
      </div>

      <div className="race-track">
        {state.runners.map((r, i) => {
          const who = owner(r.id);
          const place = showPlaces ? state.order.indexOf(r.id) : -1;
          return (
            <div key={r.id} className={`lane ${who === me ? 'is-picked' : who === 1 - me ? 'is-partner' : ''}`}>
              <span className="lane-num">{i + 1}</span>
              <span className="lane-name">{r.name}</span>
              <div className="lane-runway">
                <div className={`runner ${phase === 'racing' ? 'is-running' : ''}`} style={{ '--pos': positions[r.id] ?? 0 }}>
                  <Cat color={r.color} mood={place === 0 ? 'love' : 'normal'} size={44} />
                  {place >= 0 && place < 3 && <span className="runner-medal">{MEDALS[place]}</span>}
                  {who >= 0 && (
                    <span className="runner-owner">
                      <Cat color={colors[who]} size={18} mood="happy" />
                    </span>
                  )}
                </div>
              </div>
              <div className="finish-line" />
            </div>
          );
        })}
      </div>

      {!state.order && (
        <div className="panel">
          <h3 className="panel-title">{myPick ? `Elegiste a ${myPick.name} (puedes cambiarlo)` : 'Corredores'}</h3>
          <div className="runner-cards">
            {state.runners.map((r) => {
              const who = owner(r.id);
              return (
                <button key={r.id} className={`runner-card ${who === me ? 'is-active' : ''}`} onClick={() => pick(r.id)} disabled={busy || who === 1 - me}>
                  <Cat color={r.color} size={46} mood={who === me ? 'happy' : 'normal'} />
                  <div>
                    <strong>{r.name}</strong>
                    <small>{who === 1 - me ? `Elegido por ${other}` : `${r.chance}%`}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
