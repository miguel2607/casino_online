import { useCallback, useEffect, useState } from 'react';
import { api, post } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { GAME_BY_ID } from '../gameList.js';
import Modal from '../components/Modal.jsx';
import Stars from '../components/Stars.jsx';
import Cat from '../components/Cat.jsx';
import { Icon } from '../components/Icons.jsx';
import { fmt, fmtDate, timeAgo } from '../format.js';

const TABS = [
  { id: 'overview', label: 'Resumen', icon: 'chart' },
  { id: 'redemptions', label: 'Canjes', icon: 'gift' },
  { id: 'rewards', label: 'Recompensas', icon: 'crown' },
  { id: 'users', label: 'Jugadores', icon: 'users' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
];

const ICON_SUGGESTIONS = ['💋', '🤗', '💆‍♀️', '🍫', '🍕', '🍝', '🥞', '🎬', '🌹', '💐', '🧸', '🎁', '✈️', '🏖️', '☕', '🍦', '🛁', '💌', '🎮', '🛍️'];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    api('/admin/overview').then((d) => setPendingCount(d.counts.pending_redemptions)).catch(() => {});
  }, []);
  useEffect(refreshPending, [refreshPending]);

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>Panel de administración 👑</h1>
        <p className="muted">Crea recompensas, cumple los canjes y consiente con estrellitas.</p>
      </div>
      <div className="tabs tabs-scroll">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} /> {t.label}
            {t.id === 'redemptions' && pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview onGo={setTab} />}
      {tab === 'redemptions' && <Redemptions onChange={refreshPending} />}
      {tab === 'rewards' && <RewardsAdmin />}
      {tab === 'users' && <Users />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function Overview({ onGo }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api('/admin/overview').then(setData);
  }, []);
  if (!data) return <p className="muted center pad">Cargando…</p>;
  const c = data.counts;
  return (
    <>
      <div className="stat-grid">
        <button className="stat-card stat-card-action" onClick={() => onGo('redemptions')}>
          <span>Canjes pendientes</span>
          <strong className={c.pending_redemptions ? 'text-pink' : ''}>{c.pending_redemptions}</strong>
        </button>
        <div className="stat-card">
          <span>Canjes cumplidos</span>
          <strong>{c.fulfilled_redemptions}</strong>
        </div>
        <div className="stat-card">
          <span>Estrellitas en billeteras</span>
          <strong>
            <Stars value={c.stars_in_wallets} size={20} />
          </strong>
        </div>
        <div className="stat-card">
          <span>Partidas (24 h)</span>
          <strong>{fmt(c.games_today)}</strong>
        </div>
        <div className="stat-card">
          <span>Partidas totales</span>
          <strong>{fmt(c.games_played)}</strong>
        </div>
        <div className="stat-card">
          <span>Jugadores</span>
          <strong>{c.players}</strong>
        </div>
      </div>
      <div className="panel">
        <h3 className="panel-title">Actividad reciente</h3>
        {data.recent.length === 0 ? (
          <p className="muted pad">Todavía no hay partidas.</p>
        ) : (
          <ul className="list">
            {data.recent.map((r) => (
              <li key={r.id} className="list-row">
                <span className="list-emoji">{GAME_BY_ID[r.game]?.emoji}</span>
                <div className="list-main">
                  <strong>{r.summary}</strong>
                  <small>
                    {r.display_name || r.username} · {GAME_BY_ID[r.game]?.name} · {timeAgo(r.created_at)}
                  </small>
                </div>
                <Stars value={r.payout - r.bet} sign size={14} className={`list-amount ${r.payout - r.bet >= 0 ? 'text-mint' : 'text-red'}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Redemptions({ onChange }) {
  const toast = useToast();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState(null);
  const [acting, setActing] = useState(null);
  const [adminNote, setAdminNote] = useState('');

  const load = useCallback(() => {
    api(`/admin/redemptions${filter ? `?status=${filter}` : ''}`).then((d) => setItems(d.redemptions));
  }, [filter]);
  useEffect(load, [load]);

  const resolve = async (action) => {
    try {
      await post(`/admin/redemptions/${acting.id}/${action}`, { adminNote });
      toast.success(action === 'fulfill' ? 'Canje marcado como cumplido ❤️' : 'Canje cancelado y estrellitas devueltas');
      setActing(null);
      setAdminNote('');
      load();
      onChange();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="panel">
      <div className="filter-row">
        {[
          ['pending', 'Pendientes'],
          ['fulfilled', 'Cumplidos'],
          ['cancelled', 'Cancelados'],
          ['', 'Todos'],
        ].map(([v, l]) => (
          <button key={v} className={`pill ${filter === v ? 'is-active' : ''}`} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>
      {!items ? (
        <p className="muted center pad">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <Cat mood="happy" size={70} />
          <p>{filter === 'pending' ? 'No hay canjes pendientes. ¡Todo al día!' : 'Nada por aquí.'}</p>
        </div>
      ) : (
        <ul className="list">
          {items.map((r) => (
            <li key={r.id} className="list-row">
              <span className="list-emoji">{r.reward_icon}</span>
              <div className="list-main">
                <strong>{r.reward_title}</strong>
                <small>
                  {r.display_name || r.username} · {fmtDate(r.created_at)} · {fmt(r.cost)} ⭐
                </small>
                {r.note && <small className="user-note">📝 "{r.note}"</small>}
                {r.admin_note && <small className="admin-reply">💬 {r.admin_note}</small>}
              </div>
              {r.status === 'pending' ? (
                <button className="btn btn-primary btn-sm" onClick={() => setActing(r)}>
                  Resolver
                </button>
              ) : (
                <span className={`badge badge-status-${r.status}`}>{r.status === 'fulfilled' ? 'Cumplido' : 'Cancelado'}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!acting}
        onClose={() => setActing(null)}
        title="Resolver canje"
        footer={
          <>
            <button className="btn btn-danger" onClick={() => resolve('cancel')}>
              Cancelar y devolver
            </button>
            <button className="btn btn-primary" onClick={() => resolve('fulfill')}>
              <Icon name="check" size={18} /> Marcar cumplido
            </button>
          </>
        }
      >
        {acting && (
          <div className="redeem-confirm">
            <div className="redeem-icon">{acting.reward_icon}</div>
            <h3>{acting.reward_title}</h3>
            {acting.note && <p className="muted">Ella escribió: "{acting.note}"</p>}
            <label className="field">
              <span>Mensaje para ella (opcional)</span>
              <textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Ej: ¡Cumplido con mucho amor! 😘" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

const EMPTY_REWARD = { title: '', description: '', icon: '💋', cost: 100, stock: '', active: true };

function RewardsAdmin() {
  const toast = useToast();
  const [rewards, setRewards] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => api('/admin/rewards').then((d) => setRewards(d.rewards));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...editing, cost: Number(editing.cost), stock: editing.stock === '' ? null : Number(editing.stock) };
    try {
      if (editing.id) await api(`/admin/rewards/${editing.id}`, { method: 'PATCH', body });
      else await post('/admin/rewards', body);
      toast.success('Recompensa guardada 🎁');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  const toggle = async (r) => {
    await api(`/admin/rewards/${r.id}`, { method: 'PATCH', body: { active: !r.active } }).catch(toast.error);
    load();
  };

  const remove = async () => {
    try {
      await api(`/admin/rewards/${confirmDelete.id}`, { method: 'DELETE' });
      toast.success('Recompensa eliminada');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  const set = (k) => (e) => setEditing((r) => ({ ...r, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="panel">
      <div className="panel-head">
        <h3 className="panel-title">Recompensas</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY_REWARD })}>
          <Icon name="plus" size={16} /> Nueva recompensa
        </button>
      </div>
      {!rewards ? (
        <p className="muted center pad">Cargando…</p>
      ) : (
        <ul className="list">
          {rewards.map((r) => (
            <li key={r.id} className={`list-row ${r.active ? '' : 'is-inactive'}`}>
              <span className="list-emoji">{r.icon}</span>
              <div className="list-main">
                <strong>
                  {r.title} {!r.active && <span className="badge badge-lose">Oculta</span>}
                </strong>
                <small>
                  {fmt(r.cost)} ⭐ · {r.stock === null ? 'ilimitada' : `stock ${r.stock}`} · canjeada {r.times_redeemed} veces
                </small>
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>
                  {r.active ? 'Ocultar' : 'Mostrar'}
                </button>
                <button className="icon-btn" onClick={() => setEditing({ ...r, stock: r.stock ?? '' })} aria-label="Editar">
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar recompensa' : 'Nueva recompensa'}>
        {editing && (
          <form className="form-grid" onSubmit={save}>
            <div className="field">
              <span>Ícono</span>
              <div className="icon-picker">
                <input className="icon-input" value={editing.icon} onChange={set('icon')} maxLength={16} />
                <div className="icon-suggestions">
                  {ICON_SUGGESTIONS.map((i) => (
                    <button type="button" key={i} className={editing.icon === i ? 'is-active' : ''} onClick={() => setEditing((r) => ({ ...r, icon: i }))}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="field">
              <span>Título</span>
              <input value={editing.title} onChange={set('title')} placeholder="Ej: Un besito" required maxLength={80} />
            </label>
            <label className="field">
              <span>Descripción</span>
              <textarea rows={2} value={editing.description} onChange={set('description')} maxLength={300} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Costo en ⭐</span>
                <input type="number" min="1" value={editing.cost} onChange={set('cost')} required />
              </label>
              <label className="field">
                <span>Stock (vacío = ilimitado)</span>
                <input type="number" min="0" value={editing.stock} onChange={set('stock')} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={editing.active} onChange={set('active')} /> Visible para ella
            </label>
            <div className="modal-foot modal-foot-inline">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary">Guardar</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar recompensa"
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
          ¿Eliminar <b>{confirmDelete?.title}</b>? Los canjes que ya hizo se conservan en su historial. Si solo quieres
          esconderla, usa "Ocultar".
        </p>
      </Modal>
    </div>
  );
}

function Users() {
  const toast = useToast();
  const { user: me, setStars } = useAuth();
  const [users, setUsers] = useState(null);
  const [gift, setGift] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState(null);

  const load = () => api('/admin/users').then((d) => setUsers(d.users));
  useEffect(() => {
    load();
  }, []);

  const sendGift = async (e) => {
    e.preventDefault();
    try {
      const { stars } = await post(`/admin/users/${gift.user.id}/stars`, { amount: Number(gift.amount), reason: gift.reason });
      if (gift.user.id === me.id) setStars(stars);
      toast.success(Number(gift.amount) > 0 ? `Enviaste ${fmt(gift.amount)} ⭐ 💝` : 'Ajuste aplicado');
      setGift(null);
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  const openHistory = async (u) => {
    setHistoryFor(u);
    setHistory(null);
    const d = await api(`/admin/users/${u.id}/history`);
    setHistory(d.results);
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Jugadores</h3>
      {!users ? (
        <p className="muted center pad">Cargando…</p>
      ) : (
        <ul className="list">
          {users.map((u) => (
            <li key={u.id} className="list-row">
              <Cat color={u.avatar} size={40} />
              <div className="list-main">
                <strong>
                  {u.display_name || u.username} <span className="muted">@{u.username}</span>{' '}
                  {u.role === 'admin' && <span className="badge badge-push">Admin</span>}
                </strong>
                <small>
                  {u.games_played} partidas · {u.pending} canjes pendientes · última vez{' '}
                  {u.last_login_at ? timeAgo(u.last_login_at) : 'nunca'}
                </small>
              </div>
              <Stars value={u.stars} size={16} className="list-amount" />
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openHistory(u)}>
                  Historial
                </button>
                <button className="btn btn-gold btn-sm" onClick={() => setGift({ user: u, amount: 100, reason: '' })}>
                  ⭐ Regalar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!gift} onClose={() => setGift(null)} title={`Estrellitas para ${gift?.user.display_name || gift?.user.username}`} size="sm">
        {gift && (
          <form className="form-grid" onSubmit={sendGift}>
            <div className="chip-row">
              {[50, 100, 250, 500, 1000].map((n) => (
                <button type="button" key={n} className={`chip ${Number(gift.amount) === n ? 'is-active' : ''}`} onClick={() => setGift((g) => ({ ...g, amount: n }))}>
                  {n}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Cantidad (negativa para quitar)</span>
              <input type="number" value={gift.amount} onChange={(e) => setGift((g) => ({ ...g, amount: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Motivo (ella lo verá en sus movimientos)</span>
              <input value={gift.reason} onChange={(e) => setGift((g) => ({ ...g, reason: e.target.value }))} placeholder="Ej: Por ser la más linda 💖" maxLength={120} />
            </label>
            <div className="modal-foot modal-foot-inline">
              <button type="button" className="btn btn-ghost" onClick={() => setGift(null)}>
                Cancelar
              </button>
              <button className="btn btn-gold">Enviar</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Historial de ${historyFor?.display_name || historyFor?.username}`} size="lg">
        {!history ? (
          <p className="muted center pad">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="muted pad">Sin partidas todavía.</p>
        ) : (
          <ul className="list">
            {history.map((r) => (
              <li key={r.id} className="list-row">
                <span className="list-emoji">{GAME_BY_ID[r.game]?.emoji}</span>
                <div className="list-main">
                  <strong>{r.summary}</strong>
                  <small>{fmtDate(r.created_at)} · apostó {fmt(r.bet)} ⭐</small>
                </div>
                <Stars value={r.payout - r.bet} sign size={14} className={`list-amount ${r.payout - r.bet >= 0 ? 'text-mint' : 'text-red'}`} />
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api('/admin/settings').then((d) => setSettings(d.settings));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/admin/settings', {
        method: 'PUT',
        body: { starting_stars: Number(settings.starting_stars), daily_bonus: Number(settings.daily_bonus) },
      });
      setSettings(d.settings);
      toast.success('Ajustes guardados');
    } catch (err) {
      toast.error(err);
    }
  };

  if (!settings) return <p className="muted center pad">Cargando…</p>;
  return (
    <form className="panel form-grid settings-form" onSubmit={save}>
      <h3 className="panel-title">Ajustes del casino</h3>
      <label className="field">
        <span>Estrellitas de bienvenida al registrarse</span>
        <input type="number" min="0" value={settings.starting_stars} onChange={(e) => setSettings((s) => ({ ...s, starting_stars: e.target.value }))} />
      </label>
      <label className="field">
        <span>Bono diario</span>
        <input type="number" min="0" value={settings.daily_bonus} onChange={(e) => setSettings((s) => ({ ...s, daily_bonus: e.target.value }))} />
      </label>
      <div>
        <button className="btn btn-primary">Guardar ajustes</button>
      </div>
    </form>
  );
}
