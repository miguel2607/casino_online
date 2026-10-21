import { useEffect, useMemo, useRef, useState } from 'react';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Cat from '../components/Cat.jsx';
import { fmt } from '../format.js';

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
const SEG = 360 / WHEEL.length;
const CHIPS = [1, 5, 10, 25, 100];
const SPIN_MS = 5200;

const keyOf = (type, value) => (value == null ? type : `${type}:${value}`);
const OUTSIDE = { red: 'Rojo', black: 'Negro', even: 'Par', odd: 'Impar', low: '1-18', high: '19-36' };
const betLabel = (b) =>
  b.type === 'number' ? `Número ${b.value}` : b.type === 'dozen' ? `${b.value}ª docena` : b.type === 'column' ? `Columna ${b.value}` : OUTSIDE[b.type];

function Wheel({ rotation, result, spinning }) {
  const R = 150;
  const segs = useMemo(
    () =>
      WHEEL.map((n, i) => {
        const a0 = ((i - 0.5) * SEG - 90) * (Math.PI / 180);
        const a1 = ((i + 0.5) * SEG - 90) * (Math.PI / 180);
        const p = (a, r) => `${R + r * Math.cos(a)} ${R + r * Math.sin(a)}`;
        const d = `M${R} ${R} L${p(a0, 140)} A140 140 0 0 1 ${p(a1, 140)} Z`;
        const fill = n === 0 ? '#16a34a' : RED.has(n) ? '#d6304f' : '#1e1729';
        return (
          <g key={n}>
            <path d={d} fill={fill} stroke="#e8c675" strokeWidth="0.8" />
            <text x={R} y={R - 122} transform={`rotate(${i * SEG} ${R} ${R})`} textAnchor="middle" className="wheel-num">
              {n}
            </text>
          </g>
        );
      }),
    [],
  );
  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" />
      <svg viewBox="0 0 300 300" className="wheel" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.12,.6,.1,1)` : 'none' }}>
        <circle cx="150" cy="150" r="148" fill="#5b3a1e" stroke="#e8c675" strokeWidth="4" />
        {segs}
        <circle cx="150" cy="150" r="100" fill="#3a2414" stroke="#e8c675" strokeWidth="2" />
        <circle cx="150" cy="150" r="90" fill="url(#wheel-center)" />
        <defs>
          <radialGradient id="wheel-center">
            <stop offset="0" stopColor="#7a4d26" />
            <stop offset="1" stopColor="#3a2414" />
          </radialGradient>
        </defs>
      </svg>
      <div className="wheel-hub">
        {result != null && !spinning ? (
          <span className={`wheel-result num-${colorOf(result)}`}>{result}</span>
        ) : (
          <Cat color="orange" mood={spinning ? 'shocked' : 'happy'} size={78} />
        )}
      </div>
    </div>
  );
}

export default function Roulette() {
  const { user, setStars, setReserved } = useAuth();
  const toast = useToast();
  const [chip, setChip] = useState(10);
  const [mode, setMode] = useState('add'); // add | remove
  const [bets, setBets] = useState({});
  const [stack, setStack] = useState([]);
  const [lastBets, setLastBets] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const timer = useRef();

  useEffect(() => {
    api('/me/history?game=roulette&limit=12')
      .then((d) => setRecent(d.results.map((r) => r.details.number)))
      .catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  const total = Object.values(bets).reduce((s, b) => s + b.amount, 0);
  const available = user.stars - total;

  // Las fichas en la mesa se muestran ya descontadas del saldo
  useEffect(() => {
    setReserved(spinning ? 0 : total);
  }, [total, spinning, setReserved]);
  useEffect(() => () => setReserved(0), [setReserved]);
  useEffect(() => {
    if (!total) setMode('add');
  }, [total]);

  /** Cambia la apuesta de una casilla en `delta` estrellitas y lo guarda para poder deshacer. */
  const adjust = (type, value, delta, record = true) => {
    const k = keyOf(type, value);
    const current = bets[k]?.amount || 0;
    if (delta > 0 && delta > available) {
      toast.error('No tienes suficientes estrellitas para esa ficha');
      return;
    }
    const applied = Math.max(delta, -current);
    if (!applied) return;
    if (result) setResult(null);
    setBets((b) => {
      const next = { ...b };
      const amount = (b[k]?.amount || 0) + applied;
      if (amount > 0) next[k] = { type, value, amount };
      else delete next[k];
      return next;
    });
    if (record) setStack((s) => [...s, { type, value, delta: applied }]);
  };

  const place = (type, value = null) => {
    if (spinning) return;
    adjust(type, value, mode === 'remove' ? -chip : chip);
  };

  const undo = () => {
    const last = stack[stack.length - 1];
    if (!last) return;
    setStack((s) => s.slice(0, -1));
    adjust(last.type, last.value, -last.delta, false);
  };

  const clear = () => {
    setBets({});
    setStack([]);
  };

  const repeat = () => {
    if (!lastBets) return;
    const sum = Object.values(lastBets).reduce((s, b) => s + b.amount, 0);
    if (sum > user.stars) return toast.error('No te alcanzan las estrellitas para repetir');
    setResult(null);
    setBets(lastBets);
    setStack(Object.values(lastBets).map((b) => ({ type: b.type, value: b.value, delta: b.amount })));
  };

  const spin = async () => {
    if (!total) return toast.info('Toca la mesa para colocar fichas 🐾');
    setResult(null);
    let data;
    try {
      data = await post('/games/roulette/spin', { bets: Object.values(bets) });
    } catch (err) {
      return toast.error(err);
    }
    setStars(data.stars - data.payout);
    const idx = WHEEL.indexOf(data.number);
    const target = (360 - idx * SEG) % 360;
    const base = rotation - (rotation % 360);
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    setRotation(base + 360 * 6 + target + jitter);
    setSpinning(true);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setResult(data);
      setStars(data.stars);
      setRecent((r) => [data.number, ...r].slice(0, 12));
      setLastBets(bets);
      setBets({});
      setStack([]);
    }, SPIN_MS + 150);
  };

  // Función de render (no componente) para no remontar las casillas en cada render
  const Cell = ({ type, value = null, children, className = '', style }) => {
    const k = keyOf(type, value);
    const b = bets[k];
    const isWin = result && result.winningBets.some((w) => w.type === type && (w.value ?? null) === value);
    const hit = result && type === 'number' && value === result.number;
    return (
      <button key={k} type="button" style={style} className={`rt-cell ${className} ${hit ? 'is-hit' : ''} ${isWin ? 'is-win' : ''} ${mode === 'remove' && b ? 'is-removable' : ''}`}
        onClick={() => place(type, value)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!spinning) adjust(type, value, -chip);
        }}
        disabled={spinning}
      >
        {children}
        {b && <span className={`rt-chip chip-${CHIPS.includes(b.amount) ? b.amount : 'x'}`}>{b.amount >= 1000 ? `${Math.floor(b.amount / 1000)}k` : b.amount}</span>}
      </button>
    );
  };

  const columns = Array.from({ length: 12 }, (_, c) => [3 * c + 3, 3 * c + 2, 3 * c + 1]);

  return (
    <div className="game-page game-page-wide">
      <GameHeader title="Ruleta" emoji="🎡" subtitle="Ruleta europea · Pleno paga 35:1, docenas y columnas 2:1, colores 1:1" />

      <div className="roulette-layout">
        <div className="roulette-left">
          <Wheel rotation={rotation} result={result?.number ?? null} spinning={spinning} />
          <div className="recent-numbers">
            <span className="muted small">Últimos números</span>
            <div>
              {recent.length === 0 && <span className="muted small">—</span>}
              {recent.map((n, i) => (
                <span key={i} className={`num-ball num-${colorOf(n)}`}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="roulette-right">
          <div className="felt rt-board-wrap">
            <div className="rt-board">
              {Cell({ type: 'number', value: 0, className: 'rt-zero num-green', children: '0' })}
              {columns.map((col, ci) =>
                col.map((n, ri) =>
                  Cell({ type: 'number', value: n, className: `num-${colorOf(n)}`, style: { gridColumn: ci + 2, gridRow: ri + 1 }, children: n }),
                ),
              )}
              {[3, 2, 1].map((c, i) => Cell({ type: 'column', value: c, className: `rt-col rt-col-${i + 1}`, children: '2:1' }))}
              {[1, 2, 3].map((d) => Cell({ type: 'dozen', value: d, className: `rt-dozen rt-dozen-${d}`, children: `${d}ª 12` }))}
              {Cell({ type: 'low', className: 'rt-out rt-out-1', children: '1-18' })}
              {Cell({ type: 'even', className: 'rt-out rt-out-2', children: 'Par' })}
              {Cell({ type: 'red', className: 'rt-out rt-out-3 num-red', children: '◆' })}
              {Cell({ type: 'black', className: 'rt-out rt-out-4 num-black', children: '◆' })}
              {Cell({ type: 'odd', className: 'rt-out rt-out-5', children: 'Impar' })}
              {Cell({ type: 'high', className: 'rt-out rt-out-6', children: '19-36' })}
            </div>
          </div>

          <div className="panel rt-controls">
            <div className="rt-chips">
              <span className="muted small">Ficha</span>
              <div className="chip-row">
                {CHIPS.map((c) => (
                  <button key={c} className={`chip chip-${c} ${chip === c ? 'is-active' : ''}`} onClick={() => setChip(c)} disabled={spinning}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="rt-summary">
              <span className="muted small">Apuesta total</span>
              <strong>{fmt(total)} ⭐</strong>
              <span className="muted small">Disponible: {fmt(spinning ? user.stars : available)} ⭐</span>
            </div>

            <div className="rt-mode" role="group" aria-label="Modo de fichas">
              <button className={`rt-mode-btn ${mode === 'add' ? 'is-active' : ''}`} onClick={() => setMode('add')} disabled={spinning}>
                ➕ Poner fichas
              </button>
              <button className={`rt-mode-btn is-remove ${mode === 'remove' ? 'is-active' : ''}`} onClick={() => setMode('remove')} disabled={spinning || !total}>
                ➖ Quitar fichas
              </button>
            </div>
            <p className="rt-mode-hint muted small">
              {mode === 'add'
                ? `Toca una casilla para poner ${chip} ⭐. Clic derecho para quitar.`
                : `Toca una casilla con fichas para quitarle ${chip} ⭐.`}
            </p>

            {total > 0 && (
              <ul className="rt-bets">
                {Object.values(bets).map((b) => (
                  <li key={keyOf(b.type, b.value)} className="rt-bet">
                    <span className={`rt-bet-label ${b.type === 'red' || b.type === 'black' ? `dot-${b.type}` : ''}`}>{betLabel(b)}</span>
                    <div className="rt-bet-ctrl">
                      <button className="rt-step" onClick={() => adjust(b.type, b.value, -chip)} disabled={spinning} aria-label="Quitar ficha">
                        −
                      </button>
                      <strong>{fmt(b.amount)} ⭐</strong>
                      <button className="rt-step" onClick={() => adjust(b.type, b.value, chip)} disabled={spinning || chip > available} aria-label="Agregar ficha">
                        +
                      </button>
                      <button className="rt-step rt-step-x" onClick={() => adjust(b.type, b.value, -b.amount)} disabled={spinning} aria-label="Quitar apuesta">
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="action-row">
              <button className="btn btn-ghost" onClick={undo} disabled={spinning || !stack.length}>
                Deshacer
              </button>
              <button className="btn btn-ghost" onClick={clear} disabled={spinning || !total}>
                Limpiar
              </button>
              {lastBets && !total && (
                <button className="btn btn-ghost" onClick={repeat} disabled={spinning}>
                  Repetir
                </button>
              )}
              <button className="btn btn-primary btn-lg" onClick={spin} disabled={spinning || !total}>
                {spinning ? 'Girando…' : 'Girar'}
              </button>
            </div>
          </div>

          {result && (
            <ResultBanner
              outcome={result.outcome}
              bet={result.totalBet}
              payout={result.payout}
              title={result.payout > 0 ? `¡Salió el ${result.number}!` : `Salió el ${result.number}`}
              detail={result.winningBets.length ? `Acertaste ${result.winningBets.length} apuesta(s)` : 'Ninguna ficha acertó'}
              seed={result.number}
              color={user.avatar}
            />
          )}
        </div>
      </div>
    </div>
  );
}
