import { useCallback, useEffect, useRef, useState } from 'react';
import { post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import { SYMBOL_EMOJI } from '../format.js';

const TICKETS = [
  { id: 'mini', name: 'Mini', price: 10, color: '#5ce1b5' },
  { id: 'classic', name: 'Clásico', price: 50, color: '#ff7eb6' },
  { id: 'deluxe', name: 'Deluxe', price: 200, color: '#ffd166' },
];
const PRIZES = [
  ['cat', 25],
  ['star', 10],
  ['milk', 5],
  ['yarn', 3],
  ['fish', 2],
  ['paw', 1],
];

function ScratchLayer({ onDone, revealed }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const doneRef = useRef(false);
  const moves = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    g.addColorStop(0, '#cfc7dd');
    g.addColorStop(0.5, '#efeaf7');
    g.addColorStop(1, '#b9b0cb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = 'rgba(80,60,110,.35)';
    ctx.font = `700 ${Math.max(14, rect.width / 16)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🐾 RASCA AQUÍ 🐾', rect.width / 2, rect.height / 2);
    doneRef.current = false;
  }, []);

  const percentCleared = () => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    const step = 64;
    for (let i = 3; i < data.length; i += 4 * step) if (data[i] < 40) clear++;
    return clear / (data.length / (4 * step));
  };

  const scratch = (e) => {
    if (!drawing.current || doneRef.current) return;
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; // opaco: borra por completo
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, Math.max(18, rect.width / 14), 0, Math.PI * 2);
    ctx.fill();
    if (++moves.current % 12 === 0 && percentCleared() > 0.55) {
      doneRef.current = true;
      onDone();
    }
  };

  return (
    <canvas
      ref={ref}
      className={`scratch-layer ${revealed ? 'is-revealed' : ''}`}
      onPointerDown={(e) => {
        drawing.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        scratch(e);
      }}
      onPointerMove={scratch}
      onPointerUp={() => (drawing.current = false)}
      onPointerCancel={() => (drawing.current = false)}
    />
  );
}

export default function Scratch() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [ticket, setTicket] = useState(TICKETS[1]);
  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  const buy = async () => {
    setBusy(true);
    try {
      const data = await post('/games/scratch/buy', { ticket: ticket.id });
      setStars(data.stars - data.payout);
      setCard({ ...data, ticket });
      setRevealed(false);
      setCount((c) => c + 1);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const reveal = useCallback(() => {
    setRevealed(true);
    setStars(card.stars);
  }, [card, setStars]);

  return (
    <div className="game-page">
      <GameHeader title="Rasca y Gana" emoji="🎟️" subtitle="Encuentra tres símbolos iguales y gana su premio" />

      <div className="scratch-tickets">
        {TICKETS.map((t) => (
          <button
            key={t.id}
            className={`ticket-option ${ticket.id === t.id ? 'is-active' : ''}`}
            style={{ '--tc': t.color }}
            onClick={() => setTicket(t)}
            disabled={card && !revealed}
          >
            <strong>{t.name}</strong>
            <span>{t.price} ⭐</span>
            <small>Premio máx. {t.price * 25} ⭐</small>
          </button>
        ))}
      </div>

      <div className="scratch-card" style={{ '--tc': card?.ticket.color || ticket.color }}>
        <div className="scratch-head">
          <span>MICHI RASCA</span>
          <span>{(card?.ticket || ticket).price} ⭐</span>
        </div>
        <div className="scratch-area">
          <div className="scratch-grid">
            {(card?.grid || Array(9).fill(null)).map((s, i) => (
              <div key={i} className={`scratch-cell ${revealed && card?.symbol === s ? 'is-match' : ''}`}>
                {s ? SYMBOL_EMOJI[s] : '❔'}
              </div>
            ))}
          </div>
          {card && <ScratchLayer key={count} onDone={reveal} revealed={revealed} />}
          {!card && <div className="scratch-cover">Compra un boleto para rascar</div>}
        </div>
        <div className="scratch-prizes">
          {PRIZES.map(([s, m]) => (
            <span key={s}>
              {SYMBOL_EMOJI[s]}×3 = x{m}
            </span>
          ))}
        </div>
      </div>

      {card && revealed && (
        <ResultBanner
          outcome={card.outcome}
          bet={card.price}
          payout={card.payout}
          title={card.multiplier ? `¡Tres ${SYMBOL_EMOJI[card.symbol]}! x${card.multiplier}` : 'Boleto sin premio'}
          seed={count}
          color={user.avatar}
        />
      )}

      <div className="controls">
        <div className="action-row">
          {card && !revealed ? (
            <button className="btn btn-ghost btn-lg btn-block" onClick={reveal}>
              Revelar todo
            </button>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || ticket.price > user.stars} onClick={buy}>
              Comprar boleto {ticket.name} · {ticket.price} ⭐
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
