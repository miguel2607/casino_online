import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { MULTI_BY_ID } from '../gameList.js';
import Cat from './Cat.jsx';
import Modal from './Modal.jsx';
import { StickerLayer } from './Stickers.jsx';
import { Icon, StarIcon } from './Icons.jsx';
import { fmt } from '../format.js';

/** Ventana para responder una invitación desde cualquier página. */
function IncomingInvite() {
  const { incoming, request } = useSocket();
  const toast = useToast();
  const { pathname } = useLocation();
  const inv = incoming[0];
  if (!inv || pathname === '/pareja') return null;
  const game = MULTI_BY_ID[inv.game];

  const respond = (accept) => request('invite:respond', { inviteId: inv.id, accept }).catch(toast.error);

  return (
    <Modal
      open
      title="¡Te invitaron a jugar!"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => respond(false)}>
            Ahora no
          </button>
          <button className="btn btn-primary" onClick={() => respond(true)}>
            ¡Jugar!
          </button>
        </>
      }
    >
      <div className="redeem-confirm">
        <div className="invite-pop">
          <Cat color={inv.from.avatar} mood="love" size={72} />
          <span className="redeem-icon">{game?.emoji}</span>
        </div>
        <h3>
          {inv.from.displayName} quiere jugar {game?.name}
        </h3>
        <p className="muted">{inv.stake ? `Apuesta: ${fmt(inv.stake)} ⭐ cada uno` : 'Partida amistosa, sin apuesta'}</p>
      </div>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout, reserved } = useAuth();
  const { partnerOnline, incoming } = useSocket();
  const navigate = useNavigate();
  const shownStars = Math.max(0, (user?.stars ?? 0) - reserved);

  const links = [
    { to: '/', label: 'Lobby', icon: 'home', end: true },
    { to: '/pareja', label: 'Pareja', icon: 'heart', dot: user?.partnerId && partnerOnline, badge: incoming.length },
    { to: '/historial', label: 'Historial', icon: 'history' },
    { to: '/recompensas', label: 'Recompensas', icon: 'gift' },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: 'crown' }] : []),
  ];

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkContent = (l, size) => (
    <>
      <span className="nav-icon">
        <Icon name={l.icon} size={size} />
        {l.badge > 0 ? <span className="nav-badge">{l.badge}</span> : l.dot ? <span className="nav-dot" /> : null}
      </span>
      <span>{l.label}</span>
    </>
  );

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
              {linkContent(l, 18)}
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
            {linkContent(l, 22)}
          </NavLink>
        ))}
      </nav>

      <IncomingInvite />
      <StickerLayer />
    </div>
  );
}
