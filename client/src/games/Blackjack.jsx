import { useEffect, useState } from 'react';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import PlayingCard from '../components/PlayingCard.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Cat from '../components/Cat.jsx';

const RESULT_TEXT = {
  blackjack: '¡Blackjack! Pagamos 3 a 2',
  win: '¡Le ganaste a la casa!',
  push: 'Empate, recuperas tu apuesta',
  lose: 'La casa gana esta vez',
  bust: 'Te pasaste de 21',
};

function Hand({ cards, total, label, hideTotal }) {
  return (
    <div className="bj-hand">
      <div className="bj-hand-label">
        {label}
        {!hideTotal && <span className={`bj-total ${total > 21 ? 'is-bust' : total === 21 ? 'is-21' : ''}`}>{total}</span>}
      </div>
      <div className="bj-cards">
        {cards.map((c, i) => (
          <PlayingCard key={`${i}-${c.hidden ? 'h' : c.r + c.s}`} card={c} className="deal-in" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function Blackjack() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [game, setGame] = useState(null);
  const [bet, setBet] = useState(50);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    api('/games/blackjack').then((d) => setGame(d.game)).catch(toast.error);
  }, [toast]);

  const run = async (fn) => {
    setBusy(true);
    try {
      const d = await fn();
      setGame(d.game);
      setStars(d.stars);
      setOutcome(d.outcome ?? null);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    setOutcome(null);
    run(() => post('/games/blackjack/start', { bet }));
  };
  const act = (action) => run(() => post('/games/blackjack/action', { action }));

  const active = game?.status === 'active';
  const finished = game?.status === 'finished';

  return (
    <div className="game-page">
      <GameHeader title="Blackjack" emoji="🃏" subtitle="El crupier se planta en 17 · Blackjack paga 3:2" />

      <div className="felt bj-table">
        <div className="bj-dealer">
          <Cat color="black" mood={finished ? (outcome === 'lose' ? 'happy' : 'sad') : 'wink'} size={54} accessory="crown" />
          {game ? (
            <Hand cards={game.dealer} total={game.dealerTotal} label="Crupier Michi" />
          ) : (
            <div className="bj-placeholder">Haz tu apuesta para repartir</div>
          )}
        </div>

        <div className="felt-logo">
          <span>BLACKJACK PAGA 3 A 2</span>
        </div>

        <div className="bj-player">
          {game ? <Hand cards={game.player} total={game.playerTotal} label={user.displayName} /> : <div className="bj-placeholder" />}
          {game && (
            <div className="bj-bet-tag">
              Apuesta: {game.bet} ⭐ {game.doubled && '(doblada)'}
            </div>
          )}
        </div>
      </div>

      {finished && (
        <ResultBanner
          outcome={outcome}
          bet={game.bet}
          payout={game.payout}
          title={RESULT_TEXT[game.result]}
          detail={`Tú ${game.playerTotal} · Crupier ${game.dealerTotal}`}
          seed={game.id}
          color={user.avatar}
        />
      )}

      <div className="controls">
        {active ? (
          <div className="action-row">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act('hit')}>
              Pedir carta
            </button>
            <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => act('stand')}>
              Plantarse
            </button>
            {game.canDouble && (
              <button className="btn btn-ghost btn-lg" disabled={busy || user.stars < game.bet} onClick={() => act('double')}>
                Doblar
              </button>
            )}
          </div>
        ) : (
          <div className="bet-panel">
            <BetSelector value={bet} onChange={setBet} disabled={busy} />
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || bet < 1 || bet > user.stars} onClick={start}>
              {finished ? 'Nueva mano' : 'Repartir cartas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
