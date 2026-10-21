import { useState } from 'react';

export const ICON_SUGGESTIONS = ['💋', '🤗', '💆‍♀️', '💆‍♂️', '🍫', '🍕', '🍝', '🥞', '🎬', '🌹', '💐', '🧸', '🎁', '✈️', '🏖️', '☕', '🍦', '🛁', '💌', '🎮', '🛍️', '🍔', '🎤', '🧺'];
export const EMPTY_REWARD = { title: '', description: '', icon: '💋', cost: 100, stock: '', active: true };

/** Formulario de recompensa (lo usan el admin y cada jugador para su pareja). */
export default function RewardForm({ initial, onSubmit, onCancel, visibleLabel = 'Visible' }) {
  const [r, setR] = useState(() => ({ ...EMPTY_REWARD, ...initial, stock: initial?.stock ?? '' }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...r, cost: Number(r.cost), stock: r.stock === '' ? null : Number(r.stock) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field">
        <span>Ícono</span>
        <div className="icon-picker">
          <input className="icon-input" value={r.icon} onChange={set('icon')} maxLength={16} />
          <div className="icon-suggestions">
            {ICON_SUGGESTIONS.map((i) => (
              <button type="button" key={i} className={r.icon === i ? 'is-active' : ''} onClick={() => setR((x) => ({ ...x, icon: i }))}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="field">
        <span>Título</span>
        <input value={r.title} onChange={set('title')} placeholder="Ej: Te cocino tu comida favorita" required maxLength={80} />
      </label>
      <label className="field">
        <span>Descripción</span>
        <textarea rows={2} value={r.description} onChange={set('description')} maxLength={300} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Costo en ⭐</span>
          <input type="number" min="1" value={r.cost} onChange={set('cost')} required />
        </label>
        <label className="field">
          <span>Cantidad (vacío = ilimitado)</span>
          <input type="number" min="0" value={r.stock} onChange={set('stock')} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={r.active} onChange={set('active')} /> {visibleLabel}
      </label>
      <div className="modal-foot modal-foot-inline">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Guardar
        </button>
      </div>
    </form>
  );
}
