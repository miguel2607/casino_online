import { useEffect, useRef, useState } from 'react';
import { post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Cat from '../components/Cat.jsx';

// phase: idle → peek → shuffling → pick → reveal
export default function FindTheCat() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState('idle');
  const [slots, setSlots] = useState([0, 1, 2]); // slots[box] = posición visual
  const [catBox, setCatBox] = useState(1);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const start = () => {
    if (bet > user.stars) return toast.error('No tienes suficientes estrellitas');
    setResult(null);
    setPicked(null);
    setCatBox(1);
    setSlots([0, 1, 2]);
    setPhase('peek');
    later(() => {
      setPhase('shuffling');
      let t = 0;
      for (let k = 0; k < 9; k++) {
        t += 320;
        later(() => {
          setSlots((s) => {
            const next = [...s];
            const a = Math.floor(Math.random() * 3);
            const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
            [next[a], next[b]] = [next[b], next[a]];
            return next;
          });
        }, t);
      }
      later(() => setPhase('pick'), t + 380);
    }, 1300);
  };

  const pick = async (box) => {
    if (phase !== 'pick') return;
    setPicked(box);
    setPhase('reveal');
    try {
      // El servidor decide dónde está el michi; la caja elegida se mapea a su posición visual
      const data = await post('/games/shell/play', { bet, pick: slots[box] });
      const boxWithCat = slots.indexOf(data.catAt);
      setCatBox(boxWithCat);
      setStars(data.stars);
      setResult(data);
    } catch (err) {
      toast.error(err);
      setPhase('idle');
    }
  };

  const busy = phase === 'peek' || phase === 'shuffling' || (phase === 'reveal' && !result);
  const showCat = (box) => phase === 'reveal' && result && box === catBox;
  const opened = (box) => phase === 'reveal' && result && (box === catBox || box === picked);

  return (
    <div className="game-page">
      <GameHeader title="Encuentra al Michi" emoji="📦" subtitle="El michi se esconde en una de tres cajitas. Acertar paga x2.9" />

      <div className="felt shell-table">
        <p className="shell-hint">
          {phase === 'idle' && 'Haz tu apuesta y el michi se esconderá'}
          {phase === 'peek' && 'El michi se está escondiendo… ¡no mires! 🙈'}
          {phase === 'shuffling' && 'Mezclando cajitas…'}
          {phase === 'pick' && '¿Dónde está el michi? Elige una cajita'}
          {phase === 'reveal' && !result && 'Abriendo…'}
          {phase === 'reveal' && result && (result.win ? '¡Lo encontraste! 😻' : 'Se escondió en otra cajita 🙀')}
        </p>
        <div className="shell-stage">
          {(phase === 'idle' || phase === 'peek') && (
            <div className={`shell-hider ${phase === 'peek' ? 'is-hiding' : ''}`}>
              <Cat color="orange" mood={phase === 'peek' ? 'wink' : 'happy'} size={84} />
            </div>
          )}
          {[0, 1, 2].map((box) => (
            <button
              key={box}
              className={`shell-box ${phase === 'pick' ? 'is-pickable' : ''} ${picked === box ? 'is-picked' : ''} ${opened(box) ? 'is-open' : ''}`}
              style={{ '--slot': slots[box] }}
              onClick={() => pick(box)}
              disabled={phase !== 'pick'}
              aria-label={`Cajita ${box + 1}`}
            >
              <div className="shell-cat">{showCat(box) && <Cat color="orange" mood="love" size={84} />}</div>
              <div className="shell-lid" />
              <div className="shell-body">
                <span>🐾</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {result && (
        <ResultBanner outcome={result.outcome} bet={bet} payout={result.payout} seed={result.catAt + bet} color={user.avatar} />
      )}

      <div className="controls">
        <div className="bet-panel">
          <BetSelector value={bet} onChange={setBet} disabled={phase !== 'idle' && phase !== 'reveal'} />
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || phase === 'pick' || bet < 1 || bet > user.stars} onClick={start}>
            {phase === 'pick' ? 'Elige una cajita' : result ? 'Jugar otra vez' : 'Esconder al michi'}
          </button>
        </div>
      </div>
    </div>
  );
}
