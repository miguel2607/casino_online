import { useRef, useState } from 'react';
import { useElementWidth } from '../../hooks/gameHooks.js';

const SHIP_NAMES = { 4: 'Gran barco', 3: 'Barco', 2: 'Lancha' };

const cellsOf = (s) => Array.from({ length: s.len }, (_, k) => (s.dir === 'h' ? [s.r, s.c + k] : [s.r + k, s.c]));
const fits = (ships, ship, size) =>
  cellsOf(ship).every(([r, c]) => r >= 0 && c >= 0 && r < size && c < size && !ships.some((o) => cellsOf(o).some(([rr, cc]) => rr === r && cc === c)));

function randomFleet(fleet, size) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ships = [];
    let ok = true;
    for (const len of fleet) {
      let placed = false;
      for (let k = 0; k < 100 && !placed; k++) {
        const ship = { len, dir: Math.random() < 0.5 ? 'h' : 'v', r: Math.floor(Math.random() * size), c: Math.floor(Math.random() * size) };
        if (fits(ships, ship, size)) {
          ships.push(ship);
          placed = true;
        }
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
  return [];
}

function Grid({ size, cell, render, onCell, disabled, className = '' }) {
  return (
    <div className={`bs-grid ${className}`} style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}>
      {Array.from({ length: size * size }, (_, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        const { cls = '', content = '' } = render(r, c);
        return (
          <button key={i} className={`bs-cell ${cls}`} style={{ width: cell, height: cell, fontSize: cell * 0.55 }} onClick={() => onCell?.(r, c)} disabled={disabled}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

function Placement({ state, act }) {
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const { size, fleet } = state;
  const [ships, setShips] = useState([]);
  const [dir, setDir] = useState('h');
  const [busy, setBusy] = useState(false);
  const pending = fleet.slice(ships.length);
  const cell = width ? Math.floor(Math.min(width, 420) / size) : 0;
  const shipAt = (r, c) => ships.findIndex((s) => cellsOf(s).some(([rr, cc]) => rr === r && cc === c));

  const place = (r, c) => {
    const existing = shipAt(r, c);
    if (existing >= 0) return setShips(ships.filter((_, k) => k !== existing));
    if (!pending.length) return;
    const ship = { r, c, len: pending[0], dir };
    if (fits(ships, ship, size)) setShips([...ships, ship]);
  };

  const ready = async () => {
    setBusy(true);
    await act({ type: 'place', ships }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="bs-wrap" ref={ref}>
      <div className="turn-banner is-mine">
        {pending.length ? `Coloca tu ${SHIP_NAMES[pending[0]].toLowerCase()} de ${pending[0]} casillas` : 'Flota lista: confírmala'}
      </div>
      <Grid
        size={size}
        cell={cell}
        onCell={place}
        render={(r, c) => (shipAt(r, c) >= 0 ? { cls: 'is-ship', content: '🚢' } : {})}
      />
      <div className="action-row">
        <button className="btn btn-ghost" onClick={() => setDir(dir === 'h' ? 'v' : 'h')}>
          ↻ {dir === 'h' ? 'Horizontal' : 'Vertical'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShips(randomFleet(fleet, size))}>
          🎲 Aleatorio
        </button>
        <button className="btn btn-ghost" onClick={() => setShips([])} disabled={!ships.length}>
          Limpiar
        </button>
        <button className="btn btn-primary" onClick={ready} disabled={pending.length > 0 || busy}>
          ¡Listo!
        </button>
      </div>
      <p className="muted small center">Toca una casilla para poner el barco (tócalo de nuevo para quitarlo).</p>
    </div>
  );
}

export default function BattleshipGame({ match, act }) {
  const { me, state, players } = match;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const other = players[1 - me].displayName;

  if (state.phase === 'placing' && !state.placed[me]) return <Placement state={state} act={act} />;
  if (state.phase === 'placing') {
    return <div className="turn-banner">Tu flota está lista. Esperando a que {other} coloque la suya…</div>;
  }

  const { size } = state;
  const myTurn = match.status === 'active' && state.turn === me;
  const big = width ? Math.floor(Math.min(width, 420) / size) : 0;
  const small = width ? Math.floor(Math.min(width * 0.62, 260) / size) : 0;
  const shotAt = (list, r, c) => list.find((x) => x.r === r && x.c === c);
  const sunkCell = (r, c) => state.enemySunk.some((s) => cellsOf(s).some(([rr, cc]) => rr === r && cc === c));
  const myShipAt = (r, c) => state.myFleet.some((s) => cellsOf(s).some(([rr, cc]) => rr === r && cc === c));

  const shoot = async (r, c) => {
    if (!myTurn || busy || shotAt(state.myShots, r, c)) return;
    setBusy(true);
    await act({ type: 'shoot', r, c }).catch(() => {});
    setBusy(false);
  };

  const last = state.last;
  return (
    <div className="bs-wrap" ref={ref}>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {match.status !== 'active'
          ? 'Batalla terminada'
          : myTurn
            ? '¡Tu turno! Dispara al mar de tu pareja'
            : `${other} está apuntando…`}
        {last && <small className="bs-last">{last.by === me ? 'Tu disparo' : `Disparo de ${other}`}: {last.sunk ? '¡hundido! 💥' : last.hit ? '¡tocado! 🔥' : 'agua 💧'}</small>}
      </div>
      <div className="bs-score">
        <span>Hundiste {state.sunkCounts[me]}/5</span>
        <span>
          {other} hundió {state.sunkCounts[1 - me]}/5
        </span>
      </div>
      <h4 className="bs-title">Mar de {other}</h4>
      <Grid
        size={size}
        cell={big}
        onCell={shoot}
        disabled={!myTurn}
        className={myTurn ? 'is-target' : ''}
        render={(r, c) => {
          const s = shotAt(state.myShots, r, c);
          if (!s) return {};
          if (sunkCell(r, c)) return { cls: 'is-sunk', content: '💥' };
          return s.hit ? { cls: 'is-hit', content: '🔥' } : { cls: 'is-miss', content: '💧' };
        }}
      />
      <h4 className="bs-title">Tu flota</h4>
      <Grid
        size={size}
        cell={small}
        disabled
        className="is-mine"
        render={(r, c) => {
          const s = shotAt(state.enemyShots, r, c);
          const ship = myShipAt(r, c);
          if (s) return { cls: s.hit ? 'is-hit' : 'is-miss', content: s.hit ? '🔥' : '·' };
          return ship ? { cls: 'is-ship', content: '🚢' } : {};
        }}
      />
    </div>
  );
}
