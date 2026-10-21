import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, post } from '../api.js';
import Modal from '../components/Modal.jsx';
import Stars from '../components/Stars.jsx';
import Cat from '../components/Cat.jsx';
import Celebration from '../components/Celebration.jsx';
import { fmt, fmtDate } from '../format.js';

const STATUS = {
  pending: { label: 'Pendiente', hint: 'Esperando a que te lo cumplan 💌' },
  fulfilled: { label: 'Cumplido', hint: 'Disfrutado ❤️' },
  cancelled: { label: 'Cancelado', hint: 'Te devolvimos tus estrellitas' },
};

export default function Rewards() {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [rewards, setRewards] = useState(null);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const load = () => {
    api('/rewards').then((d) => setRewards(d.rewards));
    api('/rewards/mine').then((d) => setMine(d.redemptions));
  };
  useEffect(load, []);

  const redeem = async () => {
    setBusy(true);
    try {
      const { stars } = await post(`/rewards/${selected.id}/redeem`, { note });
      setStars(stars);
      toast.success(`¡Canjeaste "${selected.title}"! 💖`);
      setSelected(null);
      setNote('');
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3500);
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const pending = mine.filter((m) => m.status === 'pending');
  const past = mine.filter((m) => m.status !== 'pending');

  return (
    <div className="rewards-page">
      {celebrate && <Celebration />}
      <div className="page-head page-head-row">
        <div>
          <h1>Recompensas</h1>
          <p className="muted">Cambia tus estrellitas por cupones de amor. Cada cupón se puede reclamar cuando quieras.</p>
        </div>
        <div className="balance-box">
          <span>Tienes</span>
          <Stars value={user.stars} size={26} />
        </div>
      </div>

      {!rewards ? (
        <p className="muted center pad">Cargando…</p>
      ) : rewards.length === 0 ? (
        <div className="empty">
          <Cat mood="sleepy" size={80} />
          <p>Todavía no hay recompensas disponibles.</p>
        </div>
      ) : (
        <div className="reward-grid">
          {rewards.map((r) => {
            const soldOut = r.stock !== null && r.stock <= 0;
            const affordable = user.stars >= r.cost;
            const progress = Math.min(100, (user.stars / r.cost) * 100);
            return (
              <article key={r.id} className={`coupon ${soldOut ? 'is-soldout' : ''}`}>
                <div className="coupon-icon">{r.icon}</div>
                <div className="coupon-body">
                  <h3>{r.title}</h3>
                  {r.description && <p>{r.description}</p>}
                  {r.stock !== null && <small className="muted">{soldOut ? 'Agotado' : `Quedan ${r.stock}`}</small>}
                </div>
                <div className="coupon-foot">
                  <Stars value={r.cost} size={18} className="coupon-cost" />
                  {affordable || soldOut ? (
                    <button className="btn btn-primary btn-sm" disabled={soldOut} onClick={() => setSelected(r)}>
                      Canjear
                    </button>
                  ) : (
                    <div className="coupon-progress" title={`Te faltan ${fmt(r.cost - user.stars)} ⭐`}>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <small>Faltan {fmt(r.cost - user.stars)}</small>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <h2>Mis cupones</h2>
      </div>
      {mine.length === 0 ? (
        <div className="panel empty">
          <Cat mood="wink" size={70} />
          <p>Aún no has canjeado nada. ¡Gana estrellitas y elige tu premio!</p>
        </div>
      ) : (
        <div className="panel">
          <ul className="list">
            {[...pending, ...past].map((m) => (
              <li key={m.id} className={`list-row redemption-${m.status}`}>
                <span className="list-emoji">{m.reward_icon}</span>
                <div className="list-main">
                  <strong>{m.reward_title}</strong>
                  <small>
                    {fmtDate(m.created_at)} · {STATUS[m.status].hint}
                    {m.note && ` · "${m.note}"`}
                  </small>
                  {m.admin_note && <small className="admin-reply">💬 {m.admin_note}</small>}
                </div>
                <span className={`badge badge-status-${m.status}`}>{STATUS[m.status].label}</span>
                <Stars value={m.cost} size={14} className="list-amount muted" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => !busy && setSelected(null)}
        title="Confirmar canje"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setSelected(null)} disabled={busy}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={redeem} disabled={busy}>
              {busy ? 'Canjeando…' : `Canjear por ${fmt(selected?.cost)} ⭐`}
            </button>
          </>
        }
      >
        {selected && (
          <div className="redeem-confirm">
            <div className="redeem-icon">{selected.icon}</div>
            <h3>{selected.title}</h3>
            <p className="muted">{selected.description}</p>
            <label className="field">
              <span>¿Algún detalle? (opcional)</span>
              <textarea
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: lo quiero este sábado en la tarde 😊"
              />
            </label>
            <p className="muted small">
              Te quedarán {fmt(user.stars - selected.cost)} ⭐ después del canje.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
