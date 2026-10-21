import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  applyMove,
  autoCompleteMoves,
  canAutoComplete,
  isWon,
  replay,
} from '@shared/solitaire.js';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GameHeader from '../components/GameHeader.jsx';
import BetSelector from '../components/BetSelector.jsx';
import SolitaireBoard from '../components/SolitaireBoard.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import Modal from '../components/Modal.jsx';
import Cat from '../components/Cat.jsx';
import { Icon } from '../components/Icons.jsx';

const DIFF_CATS = { easy: { color: 'white', mood: 'happy' }, medium: { color: 'gray', mood: 'wink' }, hard: { color: 'black', mood: 'shocked' } };

function useElapsed(startedAt, running) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!startedAt) return '0:00';
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function Setup({ onStart, busy, lastResult }) {
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState('easy');
  const [bet, setBet] = useState(50);
  const cfg = DIFFICULTIES[difficulty];
  return (
    <>
      {lastResult}
      <div className="diff-grid">
        {Object.entries(DIFFICULTIES).map(([id, d]) => (
          <button key={id} className={`diff-card diff-${id} ${difficulty === id ? 'is-active' : ''}`} onClick={() => setDifficulty(id)}>
            <Cat {...DIFF_CATS[id]} size={58} />
            <strong>{d.label}</strong>
            <span className="diff-mult">x{d.multiplier}</span>
            <small>{d.description}</small>
          </button>
        ))}
      </div>
      <div className="controls">
        <div className="bet-panel">
          <BetSelector value={bet} onChange={setBet} disabled={busy} />
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || bet < 1 || bet > user.stars} onClick={() => onStart(difficulty, bet)}>
            Repartir · ganarías {Math.floor(bet * cfg.multiplier)} ⭐
          </button>
        </div>
      </div>
      <div className="panel rules">
        <h3 className="panel-title">Cómo se juega</h3>
        <p className="muted">
          Ordena las cartas en los cuatro cimientos, de la A a la K por palo. En las columnas apila cartas en orden descendente
          alternando rojo y negro; solo una K puede ir a una columna vacía. <b>Toca una carta</b> para moverla automáticamente; si
          tiene varios destinos posibles, toca después el destino. Tu partida se guarda sola, puedes cerrar y volver cuando
          quieras.
        </p>
      </div>
    </>
  );
}

export default function Solitaire() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [session, setSession] = useState(undefined);
  const [moves, setMoves] = useState([]);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(null); // { outcome, payout, bet }
  const [verifying, setVerifying] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const pending = useRef(null);
  const syncTimer = useRef();
  const syncChain = useRef(Promise.resolve());

  // ---- Carga inicial / reanudar partida ----
  useEffect(() => {
    api('/games/solitaire')
      .then(({ game }) => {
        setSession(game);
        if (game) {
          const s = replay(game.seed, game.difficulty, game.moves);
          setMoves(game.moves);
          setState(s);
        }
      })
      .catch((err) => {
        toast.error(err);
        setSession(null);
      });
  }, [toast]);

  // ---- Sincronización con el servidor ----
  const flush = useCallback(() => {
    clearTimeout(syncTimer.current);
    const m = pending.current;
    if (!m) return syncChain.current;
    pending.current = null;
    syncChain.current = syncChain.current.then(async () => {
      try {
        const res = await post('/games/solitaire/sync', { moves: m });
        if (res.won) {
          setStars(res.stars);
          setFinished({ outcome: res.outcome, payout: res.payout });
          setVerifying(false);
        }
      } catch (err) {
        toast.error(err);
        setVerifying(false);
      }
    });
    return syncChain.current;
  }, [setStars, toast]);

  const scheduleSync = useCallback(
    (m, immediate = false) => {
      pending.current = m;
      clearTimeout(syncTimer.current);
      if (immediate) flush();
      else syncTimer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  useEffect(() => {
    const onLeave = () => {
      if (!pending.current) return;
      const blob = new Blob([JSON.stringify({ moves: pending.current })], { type: 'application/json' });
      navigator.sendBeacon('/api/games/solitaire/sync', blob);
      pending.current = null;
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      flush();
    };
  }, [flush]);

  // ---- Acciones ----
  const commit = (nextMoves, nextState) => {
    setMoves(nextMoves);
    setState(nextState);
    const won = isWon(nextState);
    if (won) setVerifying(true);
    scheduleSync(nextMoves, won);
  };

  const doMove = (move) => {
    const next = applyMove(state, move);
    if (!next) return false;
    commit([...moves, move], next);
    return true;
  };

  const undo = () => {
    if (!moves.length) return;
    const nextMoves = moves.slice(0, -1);
    commit(nextMoves, replay(session.seed, session.difficulty, nextMoves));
  };

  const autoComplete = () => {
    const list = autoCompleteMoves(state);
    let s = state;
    let m = moves;
    list.forEach((mv, k) => {
      setTimeout(() => {
        s = applyMove(s, mv);
        m = [...m, mv];
        if (k === list.length - 1) commit(m, s);
        else {
          setState(s);
          setMoves(m);
        }
      }, k * 90);
    });
  };

  const start = async (difficulty, bet) => {
    setBusy(true);
    try {
      const { game, stars } = await post('/games/solitaire/start', { difficulty, bet });
      setStars(stars);
      setFinished(null);
      setSession(game);
      setMoves([]);
      setState(replay(game.seed, game.difficulty, []));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const forfeit = async () => {
    setConfirmForfeit(false);
    pending.current = null;
    clearTimeout(syncTimer.current);
    try {
      await syncChain.current;
      const res = await post('/games/solitaire/forfeit');
      setStars(res.stars);
      setFinished({ outcome: 'lose', payout: 0, forfeited: true });
    } catch (err) {
      toast.error(err);
    }
  };

  const playAgain = () => {
    setSession(null);
    setState(null);
    setMoves([]);
  };

  const elapsed = useElapsed(session?.startedAt, !!session && !finished);

  if (session === undefined) return <p className="muted center pad">Barajando cartas…</p>;

  const lastBanner = finished && (
    <ResultBanner
      outcome={finished.outcome}
      bet={session?.bet ?? 0}
      payout={finished.payout}
      title={finished.forfeited ? 'Te rendiste esta vez' : finished.outcome === 'win' ? '¡Solitario completado!' : undefined}
      detail={session ? `${DIFFICULTIES[session.difficulty].label} · ${moves.length} movimientos · ${elapsed}` : undefined}
      seed={moves.length}
      color={user.avatar}
    />
  );

  if (!session || !state) {
    return (
      <div className="game-page">
        <GameHeader title="Solitario" emoji="♠️" subtitle="Klondike clásico en tres dificultades" />
        <Setup onStart={start} busy={busy} />
      </div>
    );
  }

  const cfg = DIFFICULTIES[session.difficulty];
  const passesLeft = cfg.maxPasses == null ? null : cfg.maxPasses - state.passes - 1;

  return (
    <div className="game-page game-page-wide">
      <GameHeader title="Solitario" emoji="♠️" subtitle={`${cfg.label} · premio x${cfg.multiplier} · apuesta ${session.bet} ⭐`}>
        <div className="sol-meta">
          <span>⏱ {elapsed}</span>
          <span>🔀 {moves.length}</span>
          {passesLeft != null && <span title="Vueltas restantes al mazo">↻ {Math.max(passesLeft, 0)}</span>}
        </div>
      </GameHeader>

      {finished ? (
        <>
          {lastBanner}
          <div className="controls">
            <button className="btn btn-primary btn-lg btn-block" onClick={playAgain}>
              Jugar otra vez
            </button>
          </div>
        </>
      ) : (
        verifying && <div className="verifying">Verificando tu victoria… 🐾</div>
      )}

      <SolitaireBoard
        state={state}
        onMove={doMove}
        disabled={Boolean(finished) || verifying}
        onDrawBlocked={() => toast.info('Ya no quedan vueltas al mazo')}
      />

      {!finished && (
        <div className="action-row sol-actions">
          {cfg.undo && (
            <button className="btn btn-ghost" onClick={undo} disabled={!moves.length || verifying}>
              <Icon name="undo" size={18} /> Deshacer
            </button>
          )}
          {canAutoComplete(state) && (
            <button className="btn btn-gold" onClick={autoComplete} disabled={verifying}>
              <Icon name="magic" size={18} /> Autocompletar
            </button>
          )}
          <button className="btn btn-ghost btn-danger-ghost" onClick={() => setConfirmForfeit(true)} disabled={verifying}>
            <Icon name="flag" size={18} /> Rendirse
          </button>
        </div>
      )}

      <Modal
        open={confirmForfeit}
        onClose={() => setConfirmForfeit(false)}
        title="¿Rendirte?"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmForfeit(false)}>
              Seguir jugando
            </button>
            <button className="btn btn-danger" onClick={forfeit}>
              Rendirme
            </button>
          </>
        }
      >
        <p>Perderás las {session.bet} ⭐ que apostaste en esta partida. Recuerda que tu partida se guarda: puedes dejarla y volver luego.</p>
      </Modal>
    </div>
  );
}
