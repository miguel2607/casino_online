import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Cat from './Cat.jsx';
import { Icon, StarIcon } from './Icons.jsx';
import { fmt } from '../format.js';

export default function Layout() {
  const { user, logout, reserved } = useAuth();
  const shownStars = Math.max(0, (user?.stars ?? 0) - reserved);
  const navigate = useNavigate();

  const links = [
    { to: '/', label: 'Lobby', icon: 'home', end: true },
    { to: '/historial', label: 'Historial', icon: 'history' },
    { to: '/recompensas', label: 'Recompensas', icon: 'gift' },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: 'crown' }] : []),
  ];

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <Cat color="orange" mood="happy" size={38} />
          <span>
            Michi<b>Casino</b>
          </span>
        </NavLink>
        <nav className="topnav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="topnav-link">
              <Icon name={l.icon} size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <NavLink to="/recompensas" className="balance-pill" title="Tus estrellitas">
            <StarIcon size={20} />
            <span key={shownStars} className="balance-value">
              {fmt(shownStars)}
            </span>
          </NavLink>
          <div className="user-chip">
            <Cat color={user?.avatar} size={30} />
            <span className="user-chip-name">{user?.displayName}</span>
          </div>
          <button className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <nav className="bottomnav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="bottomnav-link">
            <Icon name={l.icon} size={22} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
