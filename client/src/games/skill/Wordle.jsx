import { useState } from 'react';
import SkillShell from '../../components/SkillShell.jsx';
import { WordleGrid, WordleKeyboard } from '../../components/WordleBoard.jsx';
import { useSkillGame } from '../../hooks/gameHooks.js';
import { useToast } from '../../context/ToastContext.jsx';

/** Maneja la palabra que se está escribiendo con el teclado en pantalla o el físico. */
export function useWordInput(onSubmit, disabled) {
  const [current, setCurrent] = useState('');
  const onKey = (k) => {
    if (disabled) return;
    if (k === 'BACK') return setCurrent((c) => [...c].slice(0, -1).join(''));
    if (k === 'ENTER') {
      if ([...current].length === 5) onSubmit(current, () => setCurrent(''));
      return;
    }
    setCurrent((c) => ([...c].length < 5 ? c + k : c));
  };
  return { current, onKey };
}

function Play({ skill }) {
  const { session, result } = skill;
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const guesses = session.guesses || [];
  const done = Boolean(result) || guesses.length >= session.tries;

  const { current, onKey } = useWordInput(async (word, clear) => {
    setSending(true);
    try {
      await skill.action({ word });
      clear();
    } catch {
      toast.info('Intenta con otra palabra');
    } finally {
      setSending(false);
    }
  }, done || sending);

  return (
    <div className="wordle-wrap">
      <WordleGrid guesses={guesses} current={current} tries={session.tries} />
      {session.answer && (
        <p className="center">
          La palabra era <b className="text-pink">{session.answer}</b>
        </p>
      )}
      <WordleKeyboard guesses={guesses} onKey={onKey} disabled={done || sending} />
    </div>
  );
}

export default function Wordle() {
  const skill = useSkillGame('wordle');
  return (
    <SkillShell
      title="Michi-Wordle"
      emoji="🔤"
      subtitle="Adivina la palabra de 5 letras en 6 intentos"
      controls="Verde: letra en su lugar. Amarillo: está en la palabra pero en otro lugar. Gris: no está. En PC puedes escribir con el teclado."
      table={[
        ['Adivinar en 1 intento', 8],
        ['En 2 intentos', 6],
        ['En 3 intentos', 4],
        ['En 4 intentos', 2.5],
        ['En 5 intentos', 1.6],
        ['En 6 intentos', 1.2],
      ]}
      skill={skill}
    >
      {skill.session && <Play key={skill.session.id} skill={skill} />}
    </SkillShell>
  );
}
