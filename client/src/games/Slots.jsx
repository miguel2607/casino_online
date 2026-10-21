import { useRef, useState } from 'react';
import { post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Cat from '../components/Cat.jsx';
import { SYMBOL_EMOJI } from '../format.js';

const IDS = Object.keys(SYMBOL_EMOJI);
const PAYTABLE = [
  ['cat', 100, 5],
  ['star', 30, 3],
  ['milk', 15, 2],
  ['fish', 10, 1.5],
  ['yarn', 6, 1],
  ['paw', 4, 1],
];
const STRIP = 24;
const randomId = () => IDS[Math.floor(Math.random() * IDS.length)];

function Reel({ strip, spinning, index }) {
  return (
    <div className="reel">
      <div
        className="reel-strip"
        style={{
          transform: spinning ? `translateY(calc(-${strip.length - 1} * var(--sym-h)))` : 'translateY(0)',
          transition: spinning ? `transform ${1.1 + index * 0.45}s cubic-bezier(.15,.75,.2,1.02)` : 'none',
        }}
      >
        {strip.map((id, i) => (
          <div key={i} className="reel-sym">
            {SYMBOL_EMOJI[id]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Slots() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [bet, setBet] = useState(10);
  const [strips, setStrips] = useState(() => [0, 1, 2].map(() => ['cat']));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const [rolling, setRolling] = useState(false);
  const timer = useRef();

  const spin = async () => {
    setRolling(true);
    setResult(null);
    let data;
    try {
      data = await post('/games/slots/spin', { bet });
    } catch (err) {
      toast.error(err);
      setRolling(false);
      return;
    }
    setStars(data.stars - data.payout); // la apuesta se descuenta de inmediato
    // La tira empieza con el símbolo visible y termina en el resultado
    setSpinning(false);
    setStrips((prev) =>
      data.reels.map((final, i) => [prev[i][prev[i].length - 1], ...Array.from({ length: STRIP + i * 6 }, randomId), final]),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => setSpinning(true)));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setResult(data);
      setStars(data.stars);
      setCount((c) => c + 1);
      setRolling(false);
    }, 2150);
  };

  const won = result && result.multiplier > 0;

  return (
    <div className="game-page">
      <GameHeader title="Tragamichis" emoji="🎰" subtitle="Dos o tres símbolos iguales pagan. ¡Tres michis pagan x100!" />

      <div className={`slot-machine ${won ? 'is-win' : ''}`}>
        <div className="slot-top">
          <Cat color="cream" mood={won ? 'love' : rolling ? 'shocked' : 'happy'} size={64} />
          <div className="slot-marquee">TRAGAMICHIS</div>
          <Cat color="gray" mood={won ? 'love' : rolling ? 'shocked' : 'wink'} size={64} />
        </div>
        <div className="slot-window">
          {strips.map((s, i) => (
            <Reel key={i} strip={s} spinning={spinning} index={i} />
          ))}
          <div className="slot-payline" />
        </div>
      </div>

      {result && (
        <ResultBanner
          outcome={result.outcome}
          bet={bet}
          payout={result.payout}
          title={won ? `¡x${result.multiplier}!` : 'Sin premio esta vez'}
          detail={result.reels.map((r) => SYMBOL_EMOJI[r]).join(' ')}
          seed={count}
          color={user.avatar}
        />
      )}

      <div className="controls">
        <div className="bet-panel">
          <BetSelector value={bet} onChange={setBet} disabled={rolling} />
          <button className="btn btn-primary btn-lg btn-block" disabled={rolling || bet < 1 || bet > user.stars} onClick={spin}>
            {rolling ? 'Girando…' : 'Girar'}
          </button>
        </div>
      </div>

      <div className="panel paytable">
        <h3 className="panel-title">Tabla de premios</h3>
        <div className="paytable-grid">
          <span className="muted">Símbolo</span>
          <span className="muted">Tres iguales</span>
          <span className="muted">Dos iguales</span>
          {PAYTABLE.map(([id, three, two]) => (
            <div key={id} className="paytable-row">
              <span className="paytable-sym">{SYMBOL_EMOJI[id].repeat(1)}</span>
              <span>x{three}</span>
              <span>x{two}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
