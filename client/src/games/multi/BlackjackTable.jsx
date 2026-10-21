import { useState } from 'react';
import PlayingCard from '../../components/PlayingCard.jsx';
import Cat from '../../components/Cat.jsx';

const RESULT = { blackjack: '¡Blackjack!', win: 'Ganó', push: 'Empate', lose: 'Perdió' };
const STATUS = { playing: 'Jugando…', stand: 'Se plantó', bust: 'Se pasó', blackjack: '¡Blackjack!' };

function Hand({ cards, total, label, status, result, isTurn, color }) {
  return (
    <div className={`bjt-hand ${isTurn ? 'is-turn' : ''}`}>
      <div className="bj-hand-label">
        <Cat color={color} size={26} mood={result === 'lose' ? 'sad' : isTurn ? 'shocked' : 'happy'} />
        {label}
        <span className={`bj-total ${total > 21 ? 'is-bust' : total === 21 ? 'is-21' : ''}`}>{total}</span>
      </div>
      <div className="bj-cards">
        {cards.map((c, i) => (
          <PlayingCard key={`${i}${c.r}${c.s}`} card={c} className="deal-in" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <span className={`bjt-status ${result ? `result-${result}` : ''}`}>{result ? RESULT[result] : isTurn ? 'Su turno' : STATUS[status]}</span>
    </div>
  );
}

export default function BlackjackTable({ match, act, colors }) {
  const { me, state, players } = match;
  const [busy, setBusy] = useState(false);
  const myTurn = match.status === 'active' && state.turn === me;
  const other = players[1 - me].displayName;

  const play = async (type) => {
    setBusy(true);
    await act({ type }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="bjt-wrap">
      <div className="felt bj-table bjt-table">
        <div className="bj-dealer">
          <Cat color="black" mood={state.turn === 'done' ? 'happy' : 'wink'} size={46} accessory="crown" />
          <div className="bj-hand">
            <div className="bj-hand-label">
              Crupier Michi <span className="bj-total">{state.dealerTotal}</span>
            </div>
            <div className="bj-cards">
              {state.dealer.map((c, i) => (
                <PlayingCard key={`${i}-${c.hidden ? 'h' : c.r + c.s}`} card={c} className="deal-in" />
              ))}
            </div>
          </div>
        </div>
        <div className="felt-logo">
          <span>MESA PARA DOS</span>
        </div>
        <div className="bjt-players">
          {[me, 1 - me].map((i) => (
            <Hand
              key={i}
              cards={state.hands[i]}
              total={state.totals[i]}
              label={i === me ? 'Tú' : other}
              status={state.status[i]}
              result={state.results?.[i]}
              isTurn={state.turn === i}
              color={colors[i]}
            />
          ))}
        </div>
      </div>

      {match.status === 'active' && (
        <div className="controls">
          {myTurn ? (
            <div className="action-row">
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => play('hit')}>
                Pedir carta
              </button>
              <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => play('stand')}>
                Plantarse
              </button>
            </div>
          ) : (
            <div className={`turn-banner`}>{state.turn === 'dealer' ? 'Juega el crupier…' : `Turno de ${other}…`}</div>
          )}
        </div>
      )}
    </div>
  );
}
