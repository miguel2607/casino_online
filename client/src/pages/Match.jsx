import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { MULTI_BY_ID } from '../gameList.js';
import Cat from '../components/Cat.jsx';
import Modal from '../components/Modal.jsx';
import ResultBanner from '../components/ResultBanner.jsx';
import { StickerBar } from '../components/Stickers.jsx';
import { Icon } from '../components/Icons.jsx';
import { fmt } from '../format.js';
import RpsGame from '../games/multi/RpsGame.jsx';
import Connect4Game from '../games/multi/Connect4Game.jsx';
import MemoryGame from '../games/multi/MemoryGame.jsx';
import SolitaireDuel from '../games/multi/SolitaireDuel.jsx';
import BlackjackTable from '../games/multi/BlackjackTable.jsx';
import RaceDuel from '../games/multi/RaceDuel.jsx';
import BattleshipGame from '../games/multi/BattleshipGame.jsx';
import DotsGame from '../games/multi/DotsGame.jsx';
import TicTacToeGame from '../games/multi/TicTacToeGame.jsx';
import Duel2048Game from '../games/multi/Duel2048Game.jsx';
import DuelWordleGame from '../games/multi/DuelWordleGame.jsx';
import StopGame from '../games/multi/StopGame.jsx';
import ReflexGame from '../games/multi/ReflexGame.jsx';
import DrawGame from '../games/multi/DrawGame.jsx';
import MemoryTimeGame from '../games/multi/MemoryTimeGame.jsx';
import WordSearchGame from '../games/multi/WordSearchGame.jsx';
import SimonTeamGame from '../games/multi/SimonTeamGame.jsx';
import { GhostRaceGame, RelayGame, SprintLiveGame, SprintTeamGame } from '../games/multi/RaceGames.jsx';

const COMPONENTS = {
  rps: RpsGame,
  connect4: Connect4Game,
  memory: MemoryGame,
  solitaire: SolitaireDuel,
  blackjack: BlackjackTable,
  race: RaceDuel,
  battleship: BattleshipGame,
  dots: DotsGame,
  tictactoe: TicTacToeGame,
  duel2048: Duel2048Game,
  duelwordle: DuelWordleGame,
  stop: StopGame,
  reflex: ReflexGame,
  draw: DrawGame,
  memorytime: MemoryTimeGame,
  wordsearch: WordSearchGame,
  simonteam: SimonTeamGame,
  ghostrace: GhostRaceGame,
  relay: RelayGame,
  sprintlive: SprintLiveGame,
  sprintteam: SprintTeamGame,
};

/** Colores de ficha de cada jugador: su michi, o uno distinto si eligieron el mismo. */
export function playerColors(players) {
  const a = players[0].avatar;
  const b = players[1].avatar === a ? (a === 'black' ? 'orange' : 'black') : players[1].avatar;
  return [a, b];
}

function resultTitle(match) {
  const r = match.result;
  const other = match.players[1 - match.me].displayName;
  if (r.forfeit === match.me) return 'Te rendiste';
  if (r.forfeit === 1 - match.me) return `${other} se rindió, ¡ganaste!`;
  const o = r.outcomes[match.me];
  if (r.coop) return o === 'win' ? '¡Lo lograron en equipo! 🤝' : o === 'push' ? 'Casi: recuperan la apuesta' : 'Esta vez no lo lograron';
  if (r.table) return o === 'win' ? '¡Le ganaste al crupier!' : o === 'push' ? 'Empate con el crupier' : 'El crupier ganó tu mano';
  return o === 'win' ? `¡Le ganaste a ${other}!` : o === 'lose' ? `Ganó ${other}` : '¡Empate!';
}

export default function Match() {
  const { id } = useParams();
  const matchId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { request, onMatchUpdate, onMatchPulse, sendPulse, connected } = useSocket();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState('');
  const [confirmForfeit, setConfirmForfeit] = useState(false);

  useEffect(() => {
    if (!connected) return;
    request('match:get', { matchId })
      .then((r) => setMatch(r.match))
      .catch((err) => setError(err.message));
  }, [matchId, connected, request]);

  useEffect(
    () =>
      onMatchUpdate((m) => {
        if (m.id === matchId) setMatch(m);
      }),
    [matchId, onMatchUpdate],
  );

  const act = useCallback(
    (action) =>
      request('match:action', { matchId, action }).catch((err) => {
        toast.error(err);
        throw err;
      }),
    [matchId, request, toast],
  );

  const pulse = useCallback((data) => sendPulse(matchId, data), [matchId, sendPulse]);
  // Solo los pulsos de esta partida y de la pareja (o del servidor)
  const onPulse = useCallback(
    (fn) =>
      onMatchPulse((p) => {
        if (p.matchId === matchId) fn(p.data, p.from);
      }),
    [matchId, onMatchPulse],
  );

  const forfeit = async () => {
    setConfirmForfeit(false);
    await request('match:forfeit', { matchId }).catch(toast.error);
  };

  const rematch = async () => {
    try {
      await request('invite:send', { game: match.game, stake: match.stake, options: { difficulty: match.state.difficulty } });
      toast.success('Revancha enviada 💌');
      navigate('/pareja');
    } catch (err) {
      toast.error(err);
    }
  };

  if (error) {
    return (
      <div className="empty">
        <Cat mood="sad" size={80} />
        <p>{error}</p>
        <Link to="/pareja" className="btn btn-primary">
          Volver
        </Link>
      </div>
    );
  }
  if (!match) return <p className="muted center pad">Entrando a la mesa…</p>;

  const Game = COMPONENTS[match.game];
  const info = MULTI_BY_ID[match.game];
  const colors = playerColors(match.players);
  const finished = match.status === 'finished';
  const me = match.me;
  const ordered = [me, 1 - me];
  const team = info.mode === 'team';

  return (
    <div className="game-page game-page-wide match-page">
      <div className="game-header">
        <Link to="/pareja" className="icon-btn" aria-label="Volver">
          <Icon name="back" />
        </Link>
        <div className="game-header-title">
          <h1>
            <span className="game-header-emoji">{info.emoji}</span>
            {info.name}
          </h1>
          <p>
            {match.stake
              ? team
                ? `En equipo · ${fmt(match.stake)} ⭐ cada uno contra el casino`
                : `Bote: ${fmt(match.stake * 2)} ⭐`
              : 'Partida amistosa'}
          </p>
        </div>
      </div>

      <div className="versus">
        {ordered.map((i, k) => (
          <div key={i} className={`versus-player ${k === 1 ? 'is-right' : ''}`}>
            <Cat color={colors[i]} mood={finished ? (match.result.outcomes[i] === 'win' ? 'love' : match.result.outcomes[i] === 'lose' ? 'sad' : 'wink') : 'happy'} size={46} />
            <strong>{i === me ? 'Tú' : match.players[i].displayName}</strong>
          </div>
        ))}
        <span className="versus-vs">{team ? '🤝' : 'VS'}</span>
      </div>

      <Game match={match} act={act} colors={colors} pulse={pulse} onPulse={onPulse} />

      {finished && (
        <>
          <ResultBanner
            outcome={match.result.outcomes[me]}
            bet={match.stake}
            payout={match.result.payouts[me]}
            title={resultTitle(match)}
            seed={match.id}
            color={colors[me]}
          />
          <div className="action-row">
            <button className="btn btn-primary btn-lg" onClick={rematch}>
              🔁 Revancha
            </button>
            <Link to="/pareja" className="btn btn-ghost btn-lg">
              Volver
            </Link>
          </div>
        </>
      )}

      <div className="panel sticker-panel">
        <StickerBar compact />
      </div>

      {!finished && (
        <div className="action-row">
          <button className="btn btn-ghost btn-danger-ghost" onClick={() => setConfirmForfeit(true)}>
            <Icon name="flag" size={18} /> {match.game === 'blackjack' ? 'Abandonar mi mano' : 'Rendirme'}
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
        <p>
          {match.game === 'blackjack'
            ? 'Perderás tu apuesta de esta mano; tu pareja sigue jugando la suya.'
            : team
              ? 'El equipo pierde la partida y las apuestas de los dos.'
              : `${match.players[1 - me].displayName} ganará la partida${match.stake ? ` y el bote de ${fmt(match.stake * 2)} ⭐` : ''}.`}
        </p>
      </Modal>
    </div>
  );
}
