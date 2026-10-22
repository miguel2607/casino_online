import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api, post } from '../api.js';
import { GAMES, GAME_BY_ID, SKILL_GAMES } from '../gameList.js';
import Cat from '../components/Cat.jsx';
import Stars from '../components/Stars.jsx';
import Celebration from '../components/Celebration.jsx';
import { Icon, StarIcon } from '../components/Icons.jsx';
import { fmt, timeAgo } from '../format.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Lobby() {
  const { user, setStars, patchUser } = useAuth();
  const { partnerOnline } = useSocket();
  const toast = useToast();
  const [recent, setRecent] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api('/me/history?limit=6').then((d) => setRecent(d.results)).catch(() => {});
  }, []);

  const claim = async () => {
    setClaiming(true);
    try {
      const { stars, amount } = await post('/me/daily-bonus');
      setStars(stars);
      patchUser({ canClaimBonus: false });
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3500);
      toast.success(`¡Recibiste ${fmt(amount)} estrellitas! ⭐`);
    } catch (err) {
      toast.error(err);
      patchUser({ canClaimBonus: false });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="lobby">
      {celebrate && <Celebration />}
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{greeting()} 🐾</span>
          <h1>
            Hola, <span className="text-gradient">{user.displayName}</span>
          </h1>
          <p>Elige un juego, apuesta tus estrellitas y cámbialas por premios muy especiales.</p>
          <div className="hero-actions">
            <div className="hero-balance">
              <span>Tus estrellitas</span>
              <strong>
                {fmt(user.stars)} <StarIcon size={28} />
              </strong>
            </div>
            {user.canClaimBonus ? (
              <button className="btn btn-gold btn-lg bonus-btn" onClick={claim} disabled={claiming}>
                <Icon name="sun" /> Reclamar bono diario
              </button>
            ) : (
              <Link to="/recompensas" className="btn btn-primary btn-lg">
                <Icon name="gift" /> Ver recompensas
              </Link>
            )}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit">
            <StarIcon size={26} className="orbit-star s1" />
            <StarIcon size={18} className="orbit-star s2" />
            <StarIcon size={22} className="orbit-star s3" />
          </div>
          <Cat color={user.avatar} mood="love" size={170} className="hero-cat" />
        </div>
      </section>

      <Link to="/pareja" className="active-match couple-promo">
        <span>💞</span>
        <div>
          <strong>{user.partnerId ? 'Jugar en pareja' : 'Vincúlate con tu pareja'}</strong>
          <small>
            {user.partnerId
              ? `${partnerOnline ? 'Tu pareja está en línea · ' : ''}6 juegos en tiempo real, stickers y cupones`
              : 'Jueguen juntos en tiempo real y créense cupones'}
          </small>
        </div>
        <span className="btn btn-primary btn-sm">{user.partnerId ? 'Jugar' : 'Vincular'}</span>
      </Link>

      {[
        { title: 'Habilidad', hint: 'Gana según qué tan bien juegues', games: SKILL_GAMES },
        { title: 'Suerte', hint: 'Casino clásico de azar', games: GAMES },
      ].map((section) => (
        <section key={section.title}>
          <div className="section-head">
            <h2>{section.title}</h2>
            <span className="muted">{section.hint}</span>
          </div>
          <div className="game-grid">
            {section.games.map((g) => (
              <Link key={g.id} to={g.path} className="game-card" style={{ '--g': g.gradient }}>
                <div className="game-card-art">
                  <span className="game-card-emoji">{g.emoji}</span>
                  <Cat color={g.cat.color} mood={g.cat.mood} size={64} className="game-card-cat" />
                  <span className="game-card-tag">{g.tag}</span>
                </div>
                <div className="game-card-body">
                  <h3>{g.name}</h3>
                  <p>{g.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {recent.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Tus últimas jugadas</h2>
            <Link to="/historial" className="link-btn">
              Ver todo
            </Link>
          </div>
          <div className="recent-strip">
            {recent.map((r) => (
              <div key={r.id} className={`recent-item outcome-${r.outcome}`}>
                <span className="recent-emoji">{GAME_BY_ID[r.game]?.emoji}</span>
                <div>
                  <strong>{GAME_BY_ID[r.game]?.name}</strong>
                  <small>{timeAgo(r.created_at)}</small>
                </div>
                <Stars value={r.payout - r.bet} sign size={14} className="recent-net" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
