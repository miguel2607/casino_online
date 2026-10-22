import SkillShell from '../../components/SkillShell.jsx';
import RunnerGame from '../../arcade/RunnerGame.jsx';
import KartGame from '../../arcade/KartGame.jsx';
import FlappyGame from '../../arcade/FlappyGame.jsx';
import SprintGame from '../../arcade/SprintGame.jsx';
import { SPRINT } from '../../arcade/engines.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSkillGame } from '../../hooks/gameHooks.js';

// Los cuatro juegos de acción individuales: al terminar la partida se envía el puntaje

export function RunnerPage() {
  const skill = useSkillGame('runner');
  const { user } = useAuth();
  const s = skill.session;
  return (
    <SkillShell
      wide
      title="Michi Runner"
      emoji="🏃"
      subtitle="Salta pepinos y perros, agáchate ante los pájaros y recoge pescaditos"
      controls="Celular: toca la pantalla o el botón para saltar y mantén «Agacharse». PC: espacio o ↑ para saltar, ↓ para agacharse. Cada pescadito vale 10 puntos."
      table={[
        ['2.200 puntos', 8],
        ['1.400 puntos', 4],
        ['800 puntos', 2],
        ['400 puntos', 1],
      ]}
      skill={skill}
      canForfeit={false}
    >
      {s && <RunnerGame key={s.id} seed={s.seed} myColor={user.avatar} onEnd={({ score }) => !skill.result && skill.finish({ score }).catch(() => {})} />}
    </SkillShell>
  );
}

export function KartPage() {
  const skill = useSkillGame('kart');
  const { user } = useAuth();
  const s = skill.session;
  return (
    <SkillShell
      title="Michi Kart"
      emoji="🏎️"
      subtitle="Cambia de carril para esquivar obstáculos; cada vez vas más rápido"
      controls="Celular: toca la mitad izquierda o derecha (o los botones). PC: ← → o A D. Cada pescadito vale 15 puntos."
      table={[
        ['5.500 puntos', 8],
        ['3.500 puntos', 4],
        ['2.000 puntos', 2],
        ['1.000 puntos', 1],
      ]}
      skill={skill}
      canForfeit={false}
    >
      {s && <KartGame key={s.id} seed={s.seed} color={user.avatar} onEnd={({ score }) => !skill.result && skill.finish({ score }).catch(() => {})} />}
    </SkillShell>
  );
}

export function FlappyPage() {
  const skill = useSkillGame('flappy');
  const { user } = useAuth();
  const s = skill.session;
  return (
    <SkillShell
      title="Flappy Michi"
      emoji="🧶"
      subtitle="Vuela entre las columnas de ovillos sin tocarlas"
      controls="Celular: toca la pantalla para aletear. PC: espacio, ↑ o clic."
      table={[
        ['35 ovillos', 8],
        ['20 ovillos', 4],
        ['10 ovillos', 2],
        ['5 ovillos', 1],
      ]}
      skill={skill}
      canForfeit={false}
    >
      {s && <FlappyGame key={s.id} seed={s.seed} color={user.avatar} onEnd={({ score }) => !skill.result && skill.finish({ score }).catch(() => {})} />}
    </SkillShell>
  );
}

export function SprintPage() {
  const skill = useSkillGame('sprint');
  const { user } = useAuth();
  const s = skill.session;
  return (
    <SkillShell
      title="Sprint de 100 metros"
      emoji="⚡"
      subtitle="Llega a la meta en 9 segundos o menos alternando los dos botones"
      controls="Celular: usa un pulgar en cada botón. PC: ← y → (o A y D) alternando. Si tardas más de 9 s pierdes la entrada."
      table={[
        ['9,00 s o menos', 2],
        ['8,50 s o menos', 3],
        ['8,00 s o menos', 5],
        ['7,50 s o menos', 10],
      ]}
      skill={skill}
      canForfeit={false}
    >
      {s && <SprintGame key={s.id} color={user.avatar} limit={SPRINT.limit} onFinish={(time) => !skill.result && skill.finish({ score: time }).catch(() => {})} />}
    </SkillShell>
  );
}
