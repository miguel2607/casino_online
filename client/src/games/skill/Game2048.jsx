import { useEffect, useRef, useState } from 'react';
import * as g2048 from '@shared/g2048.js';
import SkillShell from '../../components/SkillShell.jsx';
import Board2048 from '../../components/Board2048.jsx';
import Stars from '../../components/Stars.jsx';
import { useSkillGame } from '../../hooks/gameHooks.js';

// El premio depende de la FICHA MÁS ALTA que formes (no de los puntos). Igual que en el servidor.
const PRIZES = [
  [7, 1],
  [8, 1.5],
  [9, 3],
  [10, 6],
  [11, 15],
];
const prizeFor = (exp) => PRIZES.filter(([e]) => exp >= e).pop()?.[1] ?? 0;

export const TABLE_2048 = [...PRIZES]
  .reverse()
  .map(([e, m]) => [`Formar la ficha ${2 ** e}${e === 7 ? ' (recuperas la entrada)' : ''}`, m]);

function PrizePanel({ maxExp, bet }) {
  const mult = prizeFor(maxExp);
  const next = PRIZES.find(([e]) => e > maxExp);
  return (
    <div className="prize-panel">
      <div>
        <span>Si terminas ahora cobras</span>
        <strong>{mult ? <Stars value={Math.floor(bet * mult)} size={16} /> : 'nada todavía'}</strong>
        {mult > 0 && <small>x{mult}</small>}
      </div>
      <div>
        <span>Siguiente premio</span>
        <strong>{next ? `Ficha ${2 ** next[0]}` : '¡Máximo!'}</strong>
        {next && <small>x{next[1]}</small>}
      </div>
    </div>
  );
}

function Play({ skill }) {
  const { session, result } = skill;
  const gameRef = useRef(null);
  const movesRef = useRef([]);
  const [, force] = useState(0);

  // Reconstruye la partida (también al volver a una partida guardada)
  if (!gameRef.current || gameRef.current.seed !== session.seed) {
    const g = g2048.replay(session.seed, session.moves || []) || g2048.newGame(session.seed);
    gameRef.current = { seed: session.seed, game: g };
    movesRef.current = [...(session.moves || [])];
  }
  const game = gameRef.current.game;
  const over = g2048.isOver(game);
  const maxExp = g2048.maxTile(game);

  useEffect(() => {
    if (over && !result) skill.finish({ moves: movesRef.current }).catch(() => {});
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (dir) => {
    if (result || over) return;
    if (g2048.move(game, dir)) {
      movesRef.current.push(dir);
      skill.sync({ moves: movesRef.current });
      force((n) => n + 1);
    }
  };

  return (
    <>
      <div className="b2048-stats">
        <div>
          <span>Ficha más alta</span>
          <strong>{2 ** maxExp}</strong>
        </div>
        <div>
          <span>Puntos</span>
          <strong>{game.score}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{game.moves}</strong>
        </div>
      </div>
      {!result && <PrizePanel maxExp={maxExp} bet={session.bet} />}
      <Board2048 grid={game.grid} onMove={onMove} disabled={Boolean(result)} />
      {!result && (
        <div className="action-row">
          <button className="btn btn-gold" disabled={skill.busy} onClick={() => skill.finish({ moves: movesRef.current }).catch(() => {})}>
            Terminar y cobrar
          </button>
        </div>
      )}
    </>
  );
}

export default function Game2048() {
  const skill = useSkillGame('g2048');
  return (
    <SkillShell
      title="2048 de Michis"
      emoji="🐱"
      subtitle="Junta michis iguales para que crezcan; el premio depende de la ficha más alta que formes"
      controls="Ojo: los puntos no cuentan para el premio, cuenta la FICHA MÁS ALTA (por ejemplo, formar un michi 256). Celular: desliza el dedo sobre el tablero. PC: flechas o W A S D. Puedes terminar y cobrar cuando quieras."
      table={TABLE_2048}
      skill={skill}
      canForfeit={false}
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}
