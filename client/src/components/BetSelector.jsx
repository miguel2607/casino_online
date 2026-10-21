import { useAuth } from '../context/AuthContext.jsx';
import { StarIcon } from './Icons.jsx';
import { fmt } from '../format.js';

const CHIPS = [10, 25, 50, 100, 500];

export default function BetSelector({ value, onChange, disabled, label = 'Tu apuesta', fixedOptions }) {
  const { user } = useAuth();
  const max = user?.stars ?? 0;
  const set = (n) => onChange(Math.max(1, Math.min(Math.floor(n) || 1, Math.max(max, 1))));

  return (
    <div className={`bet-selector ${disabled ? 'is-disabled' : ''}`}>
      <div className="bet-top">
        <span className="bet-label">{label}</span>
        <span className="bet-available">
          Disponible: {fmt(max)} <StarIcon size={14} />
        </span>
      </div>
      <div className="bet-input-row">
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => set(value / 2)}>
          ½
        </button>
        <label className="bet-input">
          <StarIcon size={18} />
          <input
            type="number"
            min="1"
            max={max}
            inputMode="numeric"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
            onBlur={() => set(value)}
            aria-label={label}
          />
        </label>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => set(value * 2)}>
          x2
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => set(max)}>
          Máx
        </button>
      </div>
      <div className="chip-row">
        {(fixedOptions || CHIPS).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip chip-${c} ${value === c ? 'is-active' : ''}`}
            disabled={disabled || c > max}
            onClick={() => set(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
