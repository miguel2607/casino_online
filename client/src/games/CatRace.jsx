import { useEffect, useRef, useState } from 'react';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Cat from '../components/Cat.jsx';

const BASE_MS = 6000;
const SEGMENTS = 10;

/** Genera la trayectoria de cada michi: llega a la meta en su tiempo según el orden real. */
function buildPlan(order) {
  const plan = {};
  order.forEach((id, rank) => {
    const finish = BASE_MS + rank * (220 + Math.random() * 260);
    const w = Array.from({ length: SEGMENTS }, () => 0.55 + Math.random() * 0.9);
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    plan[id] = { finish, points: [0, ...w.map((x) => (acc += x / sum))] };
  });
  return plan;
}

function positionAt(p, t) {
  if (t >= p.finish) return 1;
  const f = (t / p.finish) * SEGMENTS;
  const i = Math.floor(f);
  return p.points[i] + (p.points[i + 1] - p.points[i]) * (f - i);
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function CatRace() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [card, setCard] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  const [pick, setPick] = useState(null);
  const [bet, setBet] = useState(25);
  const [positions, setPositions] = useState({});
  const [phase, setPhase] = useState('betting'); // betting | racing | done
  const [result, setResult] = useState(null);
  const raf = useRef();

  useEffect(() => {
    api('/games/race/card').then(setCard).catch(toast.error);
    return () => cancelAnimationFrame(raf.current);
  }, [toast]);

  const race = async () => {
    if (!pick) return toast.info('Elige a tu michi favorito primero 🐱');
    let data;
    try {
      data = await post('/games/race/bet', { cat: pick, bet, raceId: card.raceId });
    } catch (err) {
      return toast.error(err);
    }
    setStars(data.stars - data.payout);
    setNextCard(data.nextCard);
    setPhase('racing');
    const plan = buildPlan(data.order);
    const t0 = performance.now();
    const tick = (now) => {
      const t = now - t0;
      const pos = {};
      for (const id of data.order) pos[id] = positionAt(plan[id], t);
      setPositions(pos);
      if (t < plan[data.order[data.order.length - 1]].finish + 200) raf.current = requestAnimationFrame(tick);
      else {
        setPhase('done');
        setResult(data);
        setStars(data.stars);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const newRace = () => {
    setCard(nextCard);
    setNextCard(null);
    setPositions({});
    setResult(null);
    setPhase('betting');
  };

  if (!card) return <p className="muted center pad">Preparando la pista…</p>;
  const runners = card.runners;
  const picked = runners.find((r) => r.id === pick);
  const leader = Object.entries(positions).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="game-page game-page-wide">
      <GameHeader title="Carrera de Michis" emoji="🏁" subtitle="Elige un michi, apuesta y que gane el más veloz" />

      <div className="race-track">
        {runners.map((r, i) => {
          const pos = positions[r.id] ?? 0;
          const place = result ? result.order.indexOf(r.id) : -1;
          return (
            <div key={r.id} className={`lane ${pick === r.id ? 'is-picked' : ''}`}>
              <span className="lane-num">{i + 1}</span>
              <span className="lane-name">{r.name}</span>
              <div className="lane-runway">
                <div className={`runner ${phase === 'racing' ? 'is-running' : ''}`} style={{ '--pos': pos }}>
                  <Cat color={r.color} mood={place === 0 ? 'love' : phase === 'racing' && leader === r.id ? 'happy' : phase === 'done' ? 'sleepy' : 'normal'} size={44} />
                  {place >= 0 && place < 3 && <span className="runner-medal">{MEDALS[place]}</span>}
                </div>
              </div>
              <div className="finish-line" />
            </div>
          );
        })}
      </div>

      {phase === 'done' && result && (
        <ResultBanner
          outcome={result.outcome}
          bet={bet}
          payout={result.payout}
          title={result.win ? `¡${picked?.name} ganó!` : `Ganó ${runners.find((r) => r.id === result.order[0])?.name}`}
          detail={`${picked?.name} llegó en el puesto ${result.order.indexOf(pick) + 1}`}
          seed={result.order.length + bet}
          color={picked?.color}
        />
      )}

      <div className="race-bottom">
        <div className="panel">
          <h3 className="panel-title">Corredores</h3>
          <div className="runner-cards">
            {runners.map((r) => (
              <button
                key={r.id}
                className={`runner-card ${pick === r.id ? 'is-active' : ''}`}
                onClick={() => phase === 'betting' && setPick(r.id)}
                disabled={phase !== 'betting'}
              >
                <Cat color={r.color} size={46} mood={pick === r.id ? 'happy' : 'normal'} />
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.chance}%<span className="hide-sm"> de ganar</span>
                  </small>
                </div>
                <span className="odds">x{r.odds.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bet-panel">
          <BetSelector value={bet} onChange={setBet} disabled={phase !== 'betting'} label={picked ? `Apuesta por ${picked.name}` : 'Tu apuesta'} />
          {phase === 'done' ? (
            <button className="btn btn-primary btn-lg btn-block" onClick={newRace}>
              Siguiente carrera
            </button>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" disabled={phase !== 'betting' || !pick || bet < 1 || bet > user.stars} onClick={race}>
              {phase === 'racing' ? '¡Corriendo!' : picked ? `¡Arrancan! · ganarías ${Math.floor(bet * picked.odds)} ⭐` : 'Elige un michi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
