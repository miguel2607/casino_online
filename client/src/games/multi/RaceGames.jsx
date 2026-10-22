import { useEffect, useState } from 'react';
import RunnerGame from '../../arcade/RunnerGame.jsx';
import SprintGame from '../../arcade/SprintGame.jsx';
import Cat from '../../components/Cat.jsx';
import { useServerClock } from '../../hooks/gameHooks.js';

/** Última posición recibida de la pareja por pulsos. */
function usePartnerPosition(onPulse, initial) {
  const [pos, setPos] = useState(initial);
  useEffect(() => onPulse((data) => setPos(data)), [onPulse]);
  return [pos, setPos];
}

// ---------------- Carrera fantasma ----------------
export function GhostRaceGame({ match, act, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const [ghost] = usePartnerPosition(onPulse, { d: state.positions[1 - me], y: 0 });
  const [myTime, setMyTime] = useState(state.times[me]);
  const other = players[1 - me].displayName;

  return (
    <div>
      <div className="turn-banner is-mine">
        La misma pista para los dos · tu pareja es el michi fantasma · los choques te frenan
      </div>
      {myTime == null && match.status === 'active' ? (
        <RunnerGame
          seed={state.seed}
          race
          length={state.length}
          startAt={state.startAt}
          now={now}
          ghost={ghost}
          ghostColor={colors[1 - me]}
          myColor={colors[me]}
          label={other}
          onPulse={pulse}
          onEnd={({ time }) => {
            setMyTime(time);
            act({ type: 'finish', time }).catch(() => {});
          }}
        />
      ) : (
        <div className="panel center">
          <Cat color={colors[me]} mood="love" size={70} />
          <p>
            Llegaste en <b>{(myTime ?? state.times[me])?.toFixed(2)} s</b>
          </p>
          {state.times[1 - me] == null && match.status === 'active' && (
            <p className="muted">
              {other} va en {Math.round(ghost?.d || 0)} m de {state.length}…
            </p>
          )}
          {state.times[1 - me] != null && (
            <p className="muted">
              {other}: {state.times[1 - me].toFixed(2)} s
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- Relevos ----------------
export function RelayGame({ match, act, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const [runner, setRunner] = usePartnerPosition(onPulse, { d: state.position });
  const myLegActive = state.leg === state.myLeg && match.status === 'active';
  const runnerIdx = state.order[state.leg];
  const runnerName = runnerIdx === me ? 'Tú' : players[runnerIdx].displayName;
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setRunner({ d: state.position });
    setSent(false);
  }, [state.leg]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = state.times.reduce((a, t) => a + (t || 0), 0);
  return (
    <div>
      <div className="relay-legs">
        {state.order.map((p, leg) => (
          <div key={leg} className={`relay-leg ${state.leg === leg && match.status === 'active' ? 'is-active' : ''}`}>
            <Cat color={colors[p]} size={30} mood={state.times[leg] != null ? 'love' : 'happy'} />
            <span>
              Posta {leg + 1}: {p === me ? 'Tú' : players[p].displayName}
            </span>
            <b>{state.times[leg] != null ? `${state.times[leg].toFixed(2)} s` : state.leg === leg ? 'corriendo…' : 'esperando'}</b>
          </div>
        ))}
        <small className="muted">
          Meta del equipo: {state.target} s · llevan {total.toFixed(2)} s
        </small>
      </div>

      {myLegActive && !sent ? (
        <RunnerGame
          key={state.leg}
          seed={state.seed}
          race
          length={state.legLength}
          startAt={state.startAt}
          now={now}
          myColor={colors[me]}
          onPulse={pulse}
          onEnd={({ time }) => {
            setSent(true);
            act({ type: 'finish', time }).catch(() => {});
          }}
        />
      ) : (
        match.status === 'active' && (
          <div className="relay-watch">
            <div className="turn-banner">
              {runnerIdx === me ? 'Terminaste tu posta 🧶 ¡pásale el ovillo!' : `${runnerName} está corriendo: ¡mándale ánimos con un sticker!`}
            </div>
            <div className="sprint-track">
              <div className="sprint-lane">
                <span className="sprint-label">{runnerName}</span>
                <div className="sprint-runway">
                  <div className="sprint-runner" style={{ left: `calc(${Math.min(100, ((runner?.d || 0) / state.legLength) * 100)}% - 40px)` }}>
                    <Cat color={colors[runnerIdx]} mood="happy" size={40} />
                  </div>
                </div>
                <div className="finish-line" />
              </div>
            </div>
            <p className="center muted">
              {Math.round(runner?.d || 0)} / {state.legLength} m
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ---------------- Sprint en vivo ----------------
export function SprintLiveGame({ match, act, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const [rival] = usePartnerPosition(onPulse, { d: state.positions[1 - me] });
  const [done, setDone] = useState(state.times[me] != null);
  const other = players[1 - me].displayName;

  return (
    <div>
      {!done && match.status === 'active' ? (
        <SprintGame
          startAt={state.startAt}
          now={now}
          color={colors[me]}
          runners={[{ key: 'rival', label: other, color: colors[1 - me], d: state.times[1 - me] != null ? 100 : rival?.d || 0 }]}
          onPulse={pulse}
          onFinish={(time) => {
            setDone(true);
            act({ type: 'finish', time }).catch(() => {});
          }}
        />
      ) : (
        <div className="panel center">
          <p>¡Llegaste! {state.times[me] != null && <b>{state.times[me].toFixed(2)} s</b>}</p>
          {state.times[1 - me] == null && match.status === 'active' && <p className="muted">Esperando a {other}…</p>}
        </div>
      )}
    </div>
  );
}

// ---------------- Sprint en equipo ----------------
export function SprintTeamGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const now = useServerClock(state.serverNow);
  const [live, setLive] = useState({ d: state.d, dealer: state.dealer, taps: state.taps });
  useEffect(() => onPulse((data) => data.dealer !== undefined && setLive(data)), [onPulse]);

  return (
    <div>
      <div className="turn-banner is-mine">¡Toquen los dos! Sus toques empujan al mismo michi contra el crupier</div>
      <SprintGame
        startAt={state.startAt}
        now={now}
        teamMode
        teamD={live.d}
        runners={[
          { key: 'team', label: 'Equipo', color: colors[me], d: live.d },
          { key: 'dealer', label: 'Crupier', color: 'black', d: live.dealer },
        ]}
        onTaps={(n) => pulse({ taps: n })}
      />
      <p className="center small muted">
        Toques: tú {live.taps?.[me] ?? 0} · {players[1 - me].displayName} {live.taps?.[1 - me] ?? 0}
      </p>
    </div>
  );
}
