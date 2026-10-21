import { useEffect, useState } from 'react';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import PlayingCard from '../components/PlayingCard.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Stars from '../components/Stars.jsx';
import { fmt } from '../format.js';

export default function HiLo() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [game, setGame] = useState(null);
  const [bet, setBet] = useState(25);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    api('/games/hilo').then((d) => setGame(d.game)).catch(toast.error);
  }, [toast]);

  const run = async (fn) => {
    setBusy(true);
    try {
      const d = await fn();
      setGame(d.game);
      setStars(d.stars);
      setOutcome(d.outcome ?? null);
      if (d.correct) {
        setFlash('ok');
        setTimeout(() => setFlash(null), 600);
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const active = game?.status === 'active';
  const finished = game?.status === 'finished';
  const history = game?.history ?? [];

  return (
    <div className="game-page">
      <GameHeader title="Mayor o Menor" emoji="🔼" subtitle="Adivina si la siguiente carta será mayor o menor. Los empates pierden." />

      <div className="felt hilo-table">
        <div className="hilo-stats">
          <div>
            <span>Multiplicador</span>
            <strong>x{game ? game.multiplier.toFixed(2) : '1.00'}</strong>
          </div>
          <div>
            <span>Aciertos</span>
            <strong>{game?.steps ?? 0}</strong>
          </div>
          <div>
            <span>{finished ? 'Premio' : 'Cobrarías'}</span>
            <strong>{fmt(finished ? game.payout : game?.steps ? game.potential : 0)} ⭐</strong>
          </div>
        </div>

        <div className={`hilo-card ${flash === 'ok' ? 'flash-ok' : ''}`}>
          {game ? (
            <PlayingCard key={history.length} card={game.current} className="flip-in" />
          ) : (
            <PlayingCard hidden />
          )}
        </div>

        {history.length > 1 && (
          <div className="hilo-history">
            {history.slice(0, -1).slice(-10).map((c, i) => (
              <PlayingCard key={i} card={c} className="pcard-mini" />
            ))}
          </div>
        )}
      </div>

      {finished && (
        <ResultBanner
          outcome={outcome}
          bet={game.bet}
          payout={game.payout}
          title={game.result === 'cashout' ? `¡Cobraste x${game.multiplier.toFixed(2)}!` : undefined}
          detail={game.result === 'cashout' ? `${game.steps} aciertos seguidos` : `Llegaste a ${game.steps} aciertos`}
          seed={game.id}
          color={user.avatar}
        />
      )}

      <div className="controls">
        {active ? (
          <>
            <div className="action-row">
              <button className="btn btn-primary btn-lg hilo-btn" disabled={busy || !game.odds.higher} onClick={() => run(() => post('/games/hilo/guess', { choice: 'higher' }))}>
                ▲ Mayor {game.odds.higher && <small>x{game.odds.higher.toFixed(2)}</small>}
              </button>
              <button className="btn btn-primary btn-lg hilo-btn" disabled={busy || !game.odds.lower} onClick={() => run(() => post('/games/hilo/guess', { choice: 'lower' }))}>
                ▼ Menor {game.odds.lower && <small>x{game.odds.lower.toFixed(2)}</small>}
              </button>
            </div>
            <button className="btn btn-gold btn-lg btn-block" disabled={busy || game.steps < 1} onClick={() => run(() => post('/games/hilo/cashout'))}>
              {game.steps < 1 ? 'Acierta una carta para poder cobrar' : <>Cobrar <Stars value={game.potential} size={18} /></>}
            </button>
          </>
        ) : (
          <div className="bet-panel">
            <BetSelector value={bet} onChange={setBet} disabled={busy} />
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={busy || bet < 1 || bet > user.stars}
              onClick={() => {
                setOutcome(null);
                run(() => post('/games/hilo/start', { bet }));
              }}
            >
              {finished ? 'Jugar otra vez' : 'Empezar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
