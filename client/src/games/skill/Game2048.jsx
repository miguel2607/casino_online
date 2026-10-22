import { useEffect, useRef, useState } from 'react';
import * as g2048 from '@shared/g2048.js';
import SkillShell from '../../components/SkillShell.jsx';
import Board2048 from '../../components/Board2048.jsx';
import { useSkillGame } from '../../hooks/gameHooks.js';

export const TABLE_2048 = [
  ['Llegar al 2048 👑', 10],
  ['Llegar al 1024', 4],
  ['Llegar al 512', 2],
  ['Llegar al 256', 1],
];

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
          <span>Puntos</span>
          <strong>{game.score}</strong>
        </div>
        <div>
          <span>Mejor ficha</span>
          <strong>{2 ** g2048.maxTile(game)}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{game.moves}</strong>
        </div>
      </div>
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
      subtitle="Junta michis iguales para que crezcan hasta el rey 2048"
      controls="Celular: desliza el dedo sobre el tablero. PC: flechas o W A S D. Puedes terminar y cobrar cuando quieras."
      table={TABLE_2048}
      skill={skill}
      canForfeit={false}
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}
