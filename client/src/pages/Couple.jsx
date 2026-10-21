import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { MULTI_BY_ID, MULTI_GAMES } from '../gameList.js';
import { DIFFICULTIES } from '@shared/solitaire.js';
import Cat from '../components/Cat.jsx';
import Modal from '../components/Modal.jsx';
import Stars from '../components/Stars.jsx';
import { StickerBar } from '../components/Stickers.jsx';
import { fmt } from '../format.js';

const STAKES = [0, 10, 25, 50, 100, 250];

function LinkPartner({ inviteCode, onLinked, onRegenerate }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success('Código copiado 📋');
    } catch {
      toast.info(inviteCode);
    }
  };

  const link = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/couple/link', { code });
      toast.success('¡Ahora son pareja en Michi Casino! 💞');
      onLinked();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="couple-link">
      <div className="couple-hero">
        <Cat color="orange" mood="love" size={84} />
        <span className="couple-heart">💞</span>
        <Cat color="calico" mood="love" size={84} />
      </div>
      <h2>Vincúlate con tu pareja</h2>
      <p className="muted">
        Comparte tu código o escribe el de tu pareja. Así podrán jugar juntos en tiempo real, mandarse stickers y crearse
        cupones el uno al otro.
      </p>
      <div className="couple-link-grid">
        <div className="panel">
          <h3 className="panel-title">Tu código</h3>
          <div className="invite-code">{inviteCode}</div>
          <div className="action-row">
            <button className="btn btn-primary" onClick={copy}>
              Copiar código
            </button>
            <button className="btn btn-ghost" onClick={onRegenerate}>
              Generar otro
            </button>
          </div>
        </div>
        <form className="panel form-grid" onSubmit={link}>
          <h3 className="panel-title">El código de tu pareja</h3>
          <label className="field">
            <span>Código</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MICHI-XXXXX" required />
          </label>
          <button className="btn btn-gold" disabled={busy || !code.trim()}>
            Vincularnos 💞
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Couple() {
  const { user, setStars } = useAuth();
  const { partnerOnline, connected, incoming, outgoing, request } = useSocket();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [inviting, setInviting] = useState(null); // juego elegido
  const [stake, setStake] = useState(25);
  const [difficulty, setDifficulty] = useState('easy');
  const [gift, setGift] = useState(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(() => {
    api('/couple').then(setInfo).catch(toast.error);
  }, [toast]);
  useEffect(load, [load, user.partnerId]);

  // Si alguien acepta/rechaza o termina una partida, refrescamos la partida activa
  useEffect(() => {
    if (info?.partner) load();
  }, [incoming.length, outgoing.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendInvite = async () => {
    try {
      await request('invite:send', { game: inviting.id, stake, options: { difficulty } });
      toast.success(`Invitación enviada a ${info.partner.displayName} 💌`);
      setInviting(null);
    } catch (err) {
      toast.error(err);
    }
  };

  const respond = async (inv, accept) => {
    try {
      await request('invite:respond', { inviteId: inv.id, accept });
    } catch (err) {
      toast.error(err);
    }
  };

  const sendGift = async (e) => {
    e.preventDefault();
    try {
      const { stars } = await post('/couple/gift', { amount: Number(gift.amount), message: gift.message });
      setStars(stars);
      toast.success(`Le regalaste ${fmt(gift.amount)} ⭐ a ${info.partner.displayName} 💝`);
      setGift(null);
    } catch (err) {
      toast.error(err);
    }
  };

  const unlink = async () => {
    try {
      await post('/couple/unlink');
      setConfirmUnlink(false);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  if (!info) return <p className="muted center pad">Cargando…</p>;

  if (!info.partner) {
    return (
      <div className="couple-page">
        <LinkPartner
          inviteCode={info.inviteCode}
          onLinked={load}
          onRegenerate={async () => {
            const { inviteCode } = await post('/couple/code');
            setInfo((i) => ({ ...i, inviteCode }));
          }}
        />
      </div>
    );
  }

  const partner = info.partner;
  const online = partnerOnline;

  return (
    <div className="couple-page">
      <section className="couple-card">
        <div className="couple-avatars">
          <div className="couple-person">
            <Cat color={user.avatar} mood="love" size={72} />
            <strong>Tú</strong>
          </div>
          <span className="couple-heart beat">💞</span>
          <div className="couple-person">
            <div className="avatar-with-dot">
              <Cat color={partner.avatar} mood={online ? 'happy' : 'sleepy'} size={72} />
              <span className={`online-dot ${online ? 'is-on' : ''}`} />
            </div>
            <strong>{partner.displayName}</strong>
            <small className={online ? 'text-mint' : 'muted'}>{online ? 'En línea' : 'Desconectado'}</small>
          </div>
        </div>
        <div className="couple-actions">
          <button className="btn btn-gold" onClick={() => setGift({ amount: 50, message: '' })}>
            ⭐ Regalar estrellitas
          </button>
          <Link to="/recompensas" className="btn btn-ghost">
            🎁 Cupones
          </Link>
        </div>
      </section>

      {!connected && <div className="verifying">Conectando en tiempo real…</div>}

      {info.activeMatch && (
        <Link to={`/pareja/partida/${info.activeMatch.id}`} className="active-match">
          <span>{MULTI_BY_ID[info.activeMatch.game]?.emoji}</span>
          <div>
            <strong>Partida en curso: {MULTI_BY_ID[info.activeMatch.game]?.name}</strong>
            <small>Toca para volver a la mesa</small>
          </div>
          <span className="btn btn-primary btn-sm">Volver</span>
        </Link>
      )}

      {incoming.map((inv) => (
        <div key={inv.id} className="invite-card is-incoming">
          <span className="invite-emoji">{MULTI_BY_ID[inv.game]?.emoji}</span>
          <div>
            <strong>
              {inv.from.displayName} te invita a {MULTI_BY_ID[inv.game]?.name}
            </strong>
            <small>{inv.stake ? `Apuesta: ${fmt(inv.stake)} ⭐ cada uno` : 'Partida amistosa, sin apuesta'}</small>
          </div>
          <div className="row-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => respond(inv, false)}>
              Ahora no
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => respond(inv, true)}>
              ¡Jugar!
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((inv) => (
        <div key={inv.id} className="invite-card">
          <span className="invite-emoji">{MULTI_BY_ID[inv.game]?.emoji}</span>
          <div>
            <strong>Esperando a {inv.to.displayName}…</strong>
            <small>
              {MULTI_BY_ID[inv.game]?.name} · {inv.stake ? `${fmt(inv.stake)} ⭐` : 'amistosa'}
            </small>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => request('invite:cancel', { inviteId: inv.id }).catch(() => {})}>
            Cancelar
          </button>
        </div>
      ))}

      <div className="section-head">
        <h2>Jugar juntos</h2>
        <span className="muted">{online ? `${partner.displayName} está en línea` : `Invita a ${partner.displayName} cuando se conecte`}</span>
      </div>
      <div className="game-grid">
        {MULTI_GAMES.map((g) => (
          <button
            key={g.id}
            className="game-card game-card-btn"
            style={{ '--g': g.gradient }}
            onClick={() => setInviting(g)}
            disabled={Boolean(info.activeMatch) || outgoing.length > 0}
          >
            <div className="game-card-art">
              <span className="game-card-emoji">{g.emoji}</span>
              <span className="game-card-duo">
                <Cat color={user.avatar} mood="happy" size={44} />
                <Cat color={partner.avatar} mood="wink" size={44} />
              </span>
            </div>
            <div className="game-card-body">
              <h3>{g.name}</h3>
              <p>{g.tagline}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="panel sticker-panel">
        <h3 className="panel-title">Mándale un sticker</h3>
        <StickerBar />
      </div>

      <div className="unlink-row">
        <button className="link-btn muted" onClick={() => setConfirmUnlink(true)}>
          Desvincular pareja
        </button>
      </div>

      <Modal
        open={Boolean(inviting)}
        onClose={() => setInviting(null)}
        title={inviting ? `${inviting.emoji} ${inviting.name}` : ''}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setInviting(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={sendInvite} disabled={stake > user.stars}>
              Invitar a {partner.displayName}
            </button>
          </>
        }
      >
        {inviting && (
          <div className="form-grid">
            <p className="muted">{inviting.tagline}.</p>
            <div className="field">
              <span>Apuesta de cada uno {inviting.id === 'blackjack' ? '(contra el crupier)' : '(el ganador se lleva el bote)'}</span>
              <div className="chip-row">
                {STAKES.map((s) => (
                  <button key={s} type="button" className={`pill ${stake === s ? 'is-active' : ''}`} onClick={() => setStake(s)} disabled={s > user.stars}>
                    {s === 0 ? 'Amistosa' : `${s} ⭐`}
                  </button>
                ))}
              </div>
            </div>
            {inviting.options && (
              <div className="field">
                <span>Dificultad</span>
                <div className="chip-row">
                  {Object.entries(DIFFICULTIES).map(([id, d]) => (
                    <button key={id} type="button" className={`pill ${difficulty === id ? 'is-active' : ''}`} onClick={() => setDifficulty(id)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {stake > 0 && inviting.id !== 'blackjack' && (
              <p className="small">
                Bote total: <Stars value={stake * 2} size={14} />
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(gift)} onClose={() => setGift(null)} title={`Regalar estrellitas a ${partner.displayName}`} size="sm">
        {gift && (
          <form className="form-grid" onSubmit={sendGift}>
            <div className="chip-row">
              {[10, 50, 100, 250, 500].map((n) => (
                <button type="button" key={n} className={`pill ${Number(gift.amount) === n ? 'is-active' : ''}`} onClick={() => setGift((g) => ({ ...g, amount: n }))} disabled={n > user.stars}>
                  {n} ⭐
                </button>
              ))}
            </div>
            <label className="field">
              <span>Cantidad</span>
              <input type="number" min="1" max={user.stars} value={gift.amount} onChange={(e) => setGift((g) => ({ ...g, amount: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Mensaje (opcional)</span>
              <input value={gift.message} maxLength={120} onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))} placeholder="Para que sigas jugando 💖" />
            </label>
            <div className="modal-foot modal-foot-inline">
              <button type="button" className="btn btn-ghost" onClick={() => setGift(null)}>
                Cancelar
              </button>
              <button className="btn btn-gold" disabled={!gift.amount || gift.amount > user.stars}>
                Regalar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        title="¿Desvincular pareja?"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmUnlink(false)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={unlink}>
              Desvincular
            </button>
          </>
        }
      >
        <p>Ya no podrán jugar juntos ni canjear los cupones del otro hasta que se vuelvan a vincular. Las estrellitas y el historial se conservan.</p>
      </Modal>
    </div>
  );
}
