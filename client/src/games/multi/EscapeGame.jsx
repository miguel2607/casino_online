import { useEffect, useRef, useState } from 'react';
import { mmss, useCountdown, useServerClock } from '../../hooks/gameHooks.js';

const COLOR_CSS = { red: '#e9455a', green: '#3fbf6a', blue: '#3d6fd8', yellow: '#ffcf5a', purple: '#a855f7', orange: '#f59e42' };
const COLOR_NAME = { red: 'rojo', green: 'verde', blue: 'azul', yellow: 'amarillo', purple: 'morado', orange: 'naranja' };
const WIRE_CSS = { rojo: '#e9455a', azul: '#3d6fd8', amarillo: '#ffcf5a', blanco: '#f4f1ea', negro: '#1c1331' };
const LOCKS = ['🎨 Colores', '🔣 Símbolos', '🔌 Cables'];

/** Escape room: cada uno ve pistas distintas; hay que contárselas para abrir los 3 candados. */
export default function EscapeGame({ match, act }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const active = match.status === 'active';
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.endAt, now);
  const toStart = useCountdown(state.startAt, now);
  const [seq, setSeq] = useState([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(null);
  const chatRef = useRef(null);
  const A = state.role === 'A';
  const flash = state.flash && now() - state.flash.at < 3000 ? state.flash : null;

  useEffect(() => {
    setSeq([]);
    setCode('');
  }, [state.lock, state.strikes]);
  useEffect(() => {
    chatRef.current?.scrollTo?.(0, chatRef.current.scrollHeight);
  }, [state.chat.length]);

  const send = async (action) => {
    if (busy) return;
    setBusy(true);
    await act(action).catch(() => {});
    setBusy(false);
  };
  const say = (e) => {
    e.preventDefault();
    const text = msg.trim();
    if (!text) return;
    setMsg('');
    act({ type: 'say', text }).catch(() => {});
  };

  const waiting = toStart > 0;
  let body = null;
  if (!active) {
    body = <p className="center">{state.lock >= 3 ? '¡Escaparon! 🚪✨' : 'La puerta quedó cerrada… 🔒'}</p>;
  } else if (waiting) {
    body = <p className="center">Las pistas aparecen en {Math.ceil(toStart / 1000)}…</p>;
  } else if (state.lock === 0) {
    body = A ? (
      <div className="escape-clue">
        <p>
          <b>Tu pista:</b> en la pared hay 5 manchas de colores. Díctaselas a {other} en orden:
        </p>
        <div className="escape-colors">
          {state.colors.map((c, i) => (
            <span key={i} className="escape-color" style={{ background: COLOR_CSS[c] }} title={COLOR_NAME[c]} />
          ))}
        </div>
        <p className="muted small">{state.colors.map((c) => COLOR_NAME[c]).join(' · ')}</p>
      </div>
    ) : (
      <div className="escape-clue">
        <p>
          <b>El candado:</b> marca los 5 colores en el orden que te diga {other}.
        </p>
        <div className="escape-colors">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="escape-color" style={{ background: seq[i] ? COLOR_CSS[seq[i]] : 'transparent', borderStyle: seq[i] ? 'solid' : 'dashed' }} />
          ))}
        </div>
        <div className="escape-colors">
          {state.colorOptions.map((c) => (
            <button key={c} type="button" className="escape-color" style={{ background: COLOR_CSS[c] }} aria-label={COLOR_NAME[c]} onClick={() => seq.length < 5 && setSeq([...seq, c])} />
          ))}
        </div>
        <div className="action-row">
          <button className="btn btn-ghost" onClick={() => setSeq(seq.slice(0, -1))} disabled={!seq.length}>
            ⌫ Borrar
          </button>
          <button className="btn btn-primary" disabled={seq.length !== 5 || busy} onClick={() => send({ type: 'colors', colors: seq })}>
            🔓 Probar
          </button>
        </div>
      </div>
    );
  } else if (state.lock === 1) {
    body = A ? (
      <div className="escape-clue">
        <p>
          <b>El candado</b> tiene estos 4 símbolos. {other} tiene la tabla que los convierte en números:
        </p>
        <div className="escape-symbols">{state.code.map((s, i) => <span key={i}>{s}</span>)}</div>
        <form
          className="escape-say"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 4) send({ type: 'code', code });
          }}
        >
          <input className="input" inputMode="numeric" maxLength={4} placeholder="Código de 4 números" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button className="btn btn-primary" disabled={code.length !== 4 || busy}>
            🔓 Probar
          </button>
        </form>
      </div>
    ) : (
      <div className="escape-clue">
        <p>
          <b>Tu pista:</b> encontraste esta tabla. Cuando {other} te diga los símbolos, dile los números:
        </p>
        <div className="escape-table">
          {Object.entries(state.table).map(([sym, n]) => (
            <span key={sym}>
              {sym} = <b>{n}</b>
            </span>
          ))}
        </div>
      </div>
    );
  } else if (state.lock === 2) {
    body = A ? (
      <div className="escape-clue">
        <p>
          <b>Tu pista: el manual de la bomba.</b> {other} ve <b>{state.wireCount} cables</b>; pregúntale los colores y sigue la primera regla que se cumpla:
        </p>
        <ol className="escape-rules">{state.rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
        <p className="muted small">Los cables se cuentan de arriba hacia abajo.</p>
      </div>
    ) : (
      <div className="escape-clue">
        <p>
          <b>La puerta tiene una bomba.</b> Dile a {other} los colores de arriba hacia abajo y corta el que te diga:
        </p>
        <div className="escape-wires">
          {state.wires.map((wc, i) => (
            <button
              key={i}
              type="button"
              className={`escape-wire ${state.cut.includes(i) ? 'is-cut' : ''}`}
              style={{ background: WIRE_CSS[wc] }}
              disabled={state.cut.includes(i) || busy}
              onClick={() => setPick(i)}
            >
              <span>
                {i + 1}. {wc} {pick === i ? '✂️' : ''}
              </span>
            </button>
          ))}
        </div>
        <div className="action-row">
          <button className="btn btn-primary" disabled={pick === null || busy} onClick={() => send({ type: 'cut', wire: pick }).then(() => setPick(null))}>
            ✂️ {pick === null ? 'Elige un cable' : `Cortar el cable ${pick + 1}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">⏱ {mmss(left)}</span>
        <span className="arena-hud-item">❌ {state.strikes} (−{state.penalty} s c/u)</span>
        <span className="arena-hud-item">{A ? '🔎 Investigador/a' : '🔧 Técnico/a'}</span>
      </div>
      <div className="escape-locks">
        {LOCKS.map((l, i) => (
          <span key={l} className={`escape-lock ${i < state.lock ? 'is-open' : ''} ${i === state.lock && active ? 'is-current' : ''}`} title={l}>
            {i < state.lock ? '🔓' : '🔒'}
          </span>
        ))}
      </div>
      <div className="turn-banner is-mine">{state.lock < 3 ? `Candado ${state.lock + 1}: ${LOCKS[state.lock]}` : '¡Puerta abierta!'}</div>
      {flash && (
        <p className="center" style={{ fontWeight: 800, color: flash.ok ? 'var(--mint)' : 'var(--red)' }}>
          {flash.text}
        </p>
      )}
      {body}
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="escape-chat" ref={chatRef}>
          {state.chat.length === 0 && <span className="muted small">Escríbanse las pistas aquí (o díganselas en voz alta) 💬</span>}
          {state.chat.map((m, i) => (
            <div key={i} className={m.mine ? 'mine' : ''}>
              {m.text}
            </div>
          ))}
        </div>
        <form className="escape-say" onSubmit={say}>
          <input className="input" maxLength={60} placeholder="Mensaje para tu pareja…" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn btn-ghost" disabled={!msg.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
