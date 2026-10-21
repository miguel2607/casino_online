import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api, post } from '../api.js';
import Modal from '../components/Modal.jsx';
import Stars from '../components/Stars.jsx';
import Cat from '../components/Cat.jsx';
import Celebration from '../components/Celebration.jsx';
import RewardForm from '../components/RewardForm.jsx';
import { Icon } from '../components/Icons.jsx';
import { fmt, fmtDate } from '../format.js';

const STATUS = {
  pending: { label: 'Pendiente', hint: 'Esperando a que te lo cumplan 💌' },
  fulfilled: { label: 'Cumplido', hint: 'Disfrutado ❤️' },
  cancelled: { label: 'Cancelado', hint: 'Te devolvimos tus estrellitas' },
};

function RedeemTab({ partner, version, onRedeemed }) {
  const { user, setStars } = useAuth();
  const toast = useToast();
  const [rewards, setRewards] = useState(null);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/rewards').then((d) => setRewards(d.rewards)).catch(toast.error);
  }, [version, toast]);

  const redeem = async () => {
    setBusy(true);
    try {
      const { stars } = await post(`/rewards/${selected.id}/redeem`, { note });
      setStars(stars);
      toast.success(`¡Canjeaste "${selected.title}"! 💖`);
      setSelected(null);
      setNote('');
      onRedeemed();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (!rewards) return <p className="muted center pad">Cargando…</p>;
  if (!rewards.length) {
    return (
      <div className="panel empty">
        <Cat mood="sleepy" size={80} />
        <p>
          {partner
            ? `${partner.displayName} todavía no ha creado cupones para ti. ¡Pídeselos! 😉`
            : 'Todavía no hay recompensas. Vincúlate con tu pareja para crearse cupones.'}
        </p>
        {!partner && (
          <Link to="/pareja" className="btn btn-primary">
            Vincular pareja
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="reward-grid">
        {rewards.map((r) => {
          const soldOut = r.stock !== null && r.stock <= 0;
          const affordable = user.stars >= r.cost;
          const progress = Math.min(100, (user.stars / r.cost) * 100);
          return (
            <article key={r.id} className={`coupon ${soldOut ? 'is-soldout' : ''}`}>
              <span className="coupon-from">{r.creator_name ? `De ${r.creator_name} 💞` : 'Del casino 🐾'}</span>
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

      <Modal
        open={Boolean(selected)}
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
              <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: lo quiero este sábado en la tarde 😊" />
            </label>
            <p className="muted small">Te quedarán {fmt(user.stars - selected.cost)} ⭐ después del canje.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function CreateTab({ partner }) {
  const toast = useToast();
  const [rewards, setRewards] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    api('/rewards/created').then((d) => setRewards(d.rewards)).catch(toast.error);
  }, [toast]);
  useEffect(load, [load]);

  const save = async (body) => {
    try {
      if (editing.id) await api(`/rewards/created/${editing.id}`, { method: 'PATCH', body });
      else await post('/rewards/created', body);
      toast.success(`Cupón guardado para ${partner.displayName} 🎁`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  const toggle = async (r) => {
    await api(`/rewards/created/${r.id}`, { method: 'PATCH', body: { active: !r.active } }).catch(toast.error);
    load();
  };

  const remove = async () => {
    try {
      await api(`/rewards/created/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3 className="panel-title">Cupones que creaste para {partner.displayName}</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
          <Icon name="plus" size={16} /> Nuevo cupón
        </button>
      </div>
      {!rewards ? (
        <p className="muted center pad">Cargando…</p>
      ) : rewards.length === 0 ? (
        <div className="empty">
          <Cat mood="wink" size={70} />
          <p>Crea cupones que {partner.displayName} pueda canjear con sus estrellitas: besos, planes, antojos… ¡lo que quieras!</p>
        </div>
      ) : (
        <ul className="list">
          {rewards.map((r) => (
            <li key={r.id} className={`list-row ${r.active ? '' : 'is-inactive'}`}>
              <span className="list-emoji">{r.icon}</span>
              <div className="list-main">
                <strong>
                  {r.title} {!r.active && <span className="badge badge-lose">Oculto</span>}
                </strong>
                <small>
                  {fmt(r.cost)} ⭐ · {r.stock === null ? 'ilimitado' : `quedan ${r.stock}`} · canjeado {r.times_redeemed} veces
                </small>
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>
                  {r.active ? 'Ocultar' : 'Mostrar'}
                </button>
                <button className="icon-btn" onClick={() => setEditing(r)} aria-label="Editar">
                  <Icon name="edit" size={18} />
                </button>
                <button className="icon-btn icon-btn-danger" onClick={() => setConfirmDelete(r)} aria-label="Eliminar">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Editar cupón' : `Nuevo cupón para ${partner.displayName}`}>
        {editing && <RewardForm initial={editing} onSubmit={save} onCancel={() => setEditing(null)} visibleLabel={`Visible para ${partner.displayName}`} />}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar cupón"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={remove}>
              Eliminar
            </button>
          </>
        }
      >
        <p>
          ¿Eliminar <b>{confirmDelete?.title}</b>? Los canjes que ya se hicieron se conservan. Si solo quieres esconderlo, usa
          "Ocultar".
        </p>
      </Modal>
    </div>
  );
}

function FulfillTab({ version, onChange }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [acting, setActing] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api('/rewards/to-fulfill').then((d) => setItems(d.redemptions)).catch(toast.error);
  }, [toast]);
  useEffect(load, [load, version]);

  const resolve = async (action) => {
    try {
      await post(`/rewards/to-fulfill/${acting.id}/${action}`, { note });
      toast.success(action === 'fulfill' ? '¡Cupón cumplido! ❤️' : 'Canje cancelado, se devolvieron las estrellitas');
      setActing(null);
      setNote('');
      load();
      onChange();
    } catch (err) {
      toast.error(err);
    }
  };

  if (!items) return <p className="muted center pad">Cargando…</p>;
  if (!items.length) {
    return (
      <div className="panel empty">
        <Cat mood="happy" size={70} />
        <p>Nadie ha canjeado tus cupones todavía.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <ul className="list">
        {items.map((r) => (
          <li key={r.id} className="list-row">
            <span className="list-emoji">{r.reward_icon}</span>
            <div className="list-main">
              <strong>{r.reward_title}</strong>
              <small>
                Canjeado por {r.redeemer_name} · {fmtDate(r.created_at)} · {fmt(r.cost)} ⭐
              </small>
              {r.note && <small className="user-note">📝 "{r.note}"</small>}
              {r.admin_note && <small className="admin-reply">💬 {r.admin_note}</small>}
            </div>
            {r.status === 'pending' ? (
              <button className="btn btn-primary btn-sm" onClick={() => setActing(r)}>
                Cumplir
              </button>
            ) : (
              <span className={`badge badge-status-${r.status}`}>{STATUS[r.status].label}</span>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(acting)}
        onClose={() => setActing(null)}
        title="Cumplir cupón"
        footer={
          <>
            <button className="btn btn-danger" onClick={() => resolve('cancel')}>
              Cancelar y devolver
            </button>
            <button className="btn btn-primary" onClick={() => resolve('fulfill')}>
              <Icon name="check" size={18} /> ¡Cumplido!
            </button>
          </>
        }
      >
        {acting && (
          <div className="redeem-confirm">
            <div className="redeem-icon">{acting.reward_icon}</div>
            <h3>{acting.reward_title}</h3>
            {acting.note && <p className="muted">{acting.redeemer_name} escribió: "{acting.note}"</p>}
            <label className="field">
              <span>Mensaje (opcional)</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: ¡Con mucho amor! 😘" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MineTab({ version }) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    api('/rewards/mine').then((d) => setMine(d.redemptions));
  }, [version]);

  if (!mine) return <p className="muted center pad">Cargando…</p>;
  if (!mine.length) {
    return (
      <div className="panel empty">
        <Cat mood="wink" size={70} />
        <p>Aún no has canjeado nada. ¡Gana estrellitas y elige tu premio!</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <ul className="list">
        {mine.map((m) => (
          <li key={m.id} className={`list-row redemption-${m.status}`}>
            <span className="list-emoji">{m.reward_icon}</span>
            <div className="list-main">
              <strong>{m.reward_title}</strong>
              <small>
                {fmtDate(m.created_at)} · {m.fulfiller_name ? `Lo cumple ${m.fulfiller_name}` : 'Del casino'} · {STATUS[m.status].hint}
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
  );
}

export default function Rewards() {
  const { user } = useAuth();
  const { rewardsVersion } = useSocket();
  const [tab, setTab] = useState('redeem');
  const [partner, setPartner] = useState(null);
  const [pendingToFulfill, setPendingToFulfill] = useState(0);
  const [localVersion, setLocalVersion] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const version = rewardsVersion + localVersion;

  useEffect(() => {
    api('/couple').then((d) => setPartner(d.partner)).catch(() => {});
  }, [user.partnerId]);

  useEffect(() => {
    if (!partner) return;
    api('/rewards/to-fulfill')
      .then((d) => setPendingToFulfill(d.redemptions.filter((r) => r.status === 'pending').length))
      .catch(() => {});
  }, [partner, version]);

  const bump = () => setLocalVersion((v) => v + 1);
  const tabs = [
    { id: 'redeem', label: 'Canjear' },
    ...(partner ? [{ id: 'create', label: `Crear para ${partner.displayName}` }, { id: 'fulfill', label: 'Por cumplir', badge: pendingToFulfill }] : []),
    { id: 'mine', label: 'Mis canjes' },
  ];

  return (
    <div className="rewards-page">
      {celebrate && <Celebration />}
      <div className="page-head page-head-row">
        <div>
          <h1>Recompensas</h1>
          <p className="muted">
            {partner
              ? `Canjea los cupones de ${partner.displayName} y crea los tuyos para que te los canjee.`
              : 'Cambia tus estrellitas por cupones de amor.'}
          </p>
        </div>
        <div className="balance-box">
          <span>Tienes</span>
          <Stars value={user.stars} size={26} />
        </div>
      </div>

      <div className="tabs tabs-scroll">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'redeem' && (
        <RedeemTab
          partner={partner}
          version={version}
          onRedeemed={() => {
            bump();
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 3500);
          }}
        />
      )}
      {tab === 'create' && partner && <CreateTab partner={partner} />}
      {tab === 'fulfill' && partner && <FulfillTab version={version} onChange={bump} />}
      {tab === 'mine' && <MineTab version={version} />}
    </div>
  );
}
