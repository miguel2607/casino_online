import { Link } from 'react-router-dom';
import { Icon } from './Icons.jsx';

export default function GameHeader({ title, subtitle, emoji, children }) {
  return (
    <div className="game-header">
      <Link to="/" className="icon-btn" aria-label="Volver al lobby">
        <Icon name="back" />
      </Link>
      <div className="game-header-title">
        <h1>
          {emoji && <span className="game-header-emoji">{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="game-header-extra">{children}</div>}
    </div>
  );
}
