import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import GameHeader from './GameHeader.jsx';
import BetSelector from './BetSelector.jsx';
import ResultBanner from './ResultBanner.jsx';
import Modal from './Modal.jsx';
import { Icon } from './Icons.jsx';

/**
 * Marco común de los juegos de habilidad: pantalla de apuesta, partida y resultado.
 * - table: filas [condición, multiplicador] para mostrar la tabla de premios
 * - options: contenido extra en la pantalla de apuesta (dificultad, tamaño…)
 * - children: el juego (solo se muestra con partida en curso o terminada)
 */
export default function SkillShell({ title, emoji, subtitle, controls, table, options, skill, getOptions, children, wide, canForfeit = true }) {
  const { user } = useAuth();
  const [bet, setBet] = useState(25);
  const [confirm, setConfirm] = useState(false);
  const { session, result, busy } = skill;

  if (session === undefined) return <p className="muted center pad">Cargando…</p>;

  return (
    <div className={`game-page ${wide ? 'game-page-wide' : ''}`}>
      <GameHeader title={title} emoji={emoji} subtitle={subtitle} />

      {!session && (
        <>
          {options}
          <div className="controls">
            <div className="bet-panel">
              <BetSelector value={bet} onChange={setBet} disabled={busy} label="Entrada" />
              <button
                className="btn btn-primary btn-lg btn-block"
                disabled={busy || bet < 1 || bet > user.stars}
                onClick={() => skill.start(bet, getOptions?.()).catch(() => {})}
              >
                ¡Jugar!
              </button>
            </div>
          </div>
          <div className="panel rules">
            <h3 className="panel-title">Premios</h3>
            <div className="skill-table">
              {table.map(([cond, mult]) => (
                <div key={cond} className="skill-table-row">
                  <span>{cond}</span>
                  <b>x{mult}</b>
                </div>
              ))}
            </div>
            {controls && <p className="muted small controls-help">{controls}</p>}
          </div>
        </>
      )}

      {session && (
        <>
          {result && (
            <>
              <ResultBanner outcome={result.outcome} bet={session.bet} payout={result.payout} title={result.payout > session.bet ? `¡x${result.multiplier}!` : undefined} detail={result.summary} seed={session.id} color={user.avatar} />
              <div className="action-row">
                <button className="btn btn-primary btn-lg" onClick={skill.reset}>
                  Jugar otra vez
                </button>
              </div>
            </>
          )}
          {children}
          {!result && canForfeit && (
            <div className="action-row skill-forfeit">
              <button className="btn btn-ghost btn-danger-ghost btn-sm" onClick={() => setConfirm(true)}>
                <Icon name="flag" size={16} /> Retirarme
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Retirarte?"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Seguir jugando
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setConfirm(false);
                skill.forfeit().catch(() => {});
              }}
            >
              Retirarme
            </button>
          </>
        }
      >
        <p>Perderás la entrada de {session?.bet} ⭐.</p>
      </Modal>
    </div>
  );
}
