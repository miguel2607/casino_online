import { useEffect, useRef, useState } from 'react';
import { sequence } from '@shared/simon.js';
import SkillShell from '../../components/SkillShell.jsx';
import SimonPad, { usePlayback } from '../../components/SimonPad.jsx';
import { useSkillGame } from '../../hooks/gameHooks.js';

function Play({ skill }) {
  const { session, result } = skill;
  const seq = useRef(sequence(session.seed, 120)).current;
  const inputs = useRef([]);
  const [level, setLevel] = useState(1);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready | showing | input | done
  const { lit, play } = usePlayback(Math.max(320, 620 - level * 18));

  const show = async (len) => {
    setPhase('showing');
    await play(seq.slice(0, len), 700);
    setPhase('input');
  };

  useEffect(() => {
    if (phase === 'ready') show(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPress = (p) => {
    if (phase !== 'input' || result) return;
    inputs.current.push(p);
    if (p !== seq[pos]) {
      setPhase('done');
      skill.finish({ inputs: inputs.current }).catch(() => {});
      return;
    }
    if (pos + 1 < level) return setPos(pos + 1);
    // Nivel completo: el siguiente es un michi más largo
    setPos(0);
    setLevel(level + 1);
    show(level + 1);
  };

  const completed = level - 1;
  return (
    <>
      <div className="b2048-stats">
        <div>
          <span>Nivel</span>
          <strong>{level}</strong>
        </div>
        <div>
          <span>Completados</span>
          <strong>{completed}</strong>
        </div>
        <div>
          <span>{phase === 'showing' ? 'Mira…' : phase === 'input' ? 'Tu turno' : 'Fin'}</span>
          <strong>
            {phase === 'input' ? `${pos}/${level}` : phase === 'showing' ? '👀' : '🏁'}
          </strong>
        </div>
      </div>
      <SimonPad lit={lit} onPress={onPress} disabled={phase !== 'input' || Boolean(result)} />
      {!result && phase === 'input' && (
        <div className="action-row">
          <button className="btn btn-gold" onClick={() => skill.finish({ inputs: inputs.current }).catch(() => {})}>
            Plantarme y cobrar
          </button>
        </div>
      )}
    </>
  );
}

export default function Simon() {
  const skill = useSkillGame('simon');
  return (
    <SkillShell
      title="Simón Michi"
      emoji="🎵"
      subtitle="Mira la secuencia de michis y repítela; cada nivel es uno más largo"
      controls="Toca los michis en el mismo orden. PC: teclas 1, 2, 3 y 4. Puedes plantarte para cobrar lo que lleves."
      table={[
        ['15 niveles', 8],
        ['11 niveles', 4],
        ['8 niveles', 2],
        ['5 niveles', 1],
      ]}
      skill={skill}
      canForfeit={false}
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}
