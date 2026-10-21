import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { GAMES, GAME_BY_ID } from '../gameList.js';
import Stars from '../components/Stars.jsx';
import Cat from '../components/Cat.jsx';
import { fmt, fmtDate } from '../format.js';

const OUTCOME = { win: 'Ganada', lose: 'Perdida', push: 'Empate' };
const KIND = { bet: 'Apuesta', win: 'Premio', refund: 'Devolución', bonus: 'Bono', redeem: 'Canje', admin: 'Regalo' };

export default function History() {
  const [tab, setTab] = useState('games');
  const [game, setGame] = useState('');
  const [results, setResults] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/me/stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setResults(null);
    api(`/me/history?limit=30${game ? `&game=${game}` : ''}`).then((d) => {
      setResults(d.results);
      setHasMore(d.results.length === 30);
    });
  }, [game]);

  useEffect(() => {
    if (tab === 'wallet' && !transactions) api('/me/transactions?limit=100').then((d) => setTransactions(d.transactions));
  }, [tab, transactions]);

  const loadMore = async () => {
    const d = await api(`/me/history?limit=30&offset=${results.length}${game ? `&game=${game}` : ''}`);
    setResults((r) => [...r, ...d.results]);
    setHasMore(d.results.length === 30);
  };

  const t = stats?.totals;
  const winRate = t?.played ? Math.round((t.wins / t.played) * 100) : 0;

  return (
    <div className="history-page">
      <div className="page-head">
        <h1>Tu historial</h1>
        <p className="muted">Cada jugada y cada estrellita quedan guardadas.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Partidas jugadas</span>
          <strong>{fmt(t?.played)}</strong>
        </div>
        <div className="stat-card">
          <span>Partidas ganadas</span>
          <strong>
            {fmt(t?.wins)} <small>{winRate}%</small>
          </strong>
        </div>
        <div className="stat-card">
          <span>Balance en juegos</span>
          <strong className={t && t.returned - t.wagered >= 0 ? 'text-mint' : 'text-red'}>
            {t ? <Stars value={t.returned - t.wagered} sign size={20} /> : '—'}
          </strong>
        </div>
        <div className="stat-card">
          <span>Mejor premio</span>
          <strong>{t ? <Stars value={t.best} size={20} /> : '—'}</strong>
        </div>
        <div className="stat-card">
          <span>Cupones canjeados</span>
          <strong>{fmt(stats?.redeemed?.count)}</strong>
        </div>
      </div>

      {stats?.games?.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">Por juego</h3>
          <div className="per-game">
            {stats.games.map((g) => (
              <div key={g.game} className="per-game-row">
                <span className="per-game-name">
                  {GAME_BY_ID[g.game]?.emoji} {GAME_BY_ID[g.game]?.name || g.game}
                </span>
                <span className="muted">{g.played} partidas</span>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${(g.wins / g.played) * 100}%` }} />
                </div>
                <span className="muted">{Math.round((g.wins / g.played) * 100)}% ganadas</span>
                <Stars value={g.returned - g.wagered} sign size={14} className={g.returned - g.wagered >= 0 ? 'text-mint' : 'text-red'} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'games' ? 'is-active' : ''}`} onClick={() => setTab('games')}>
          Partidas
        </button>
        <button className={`tab ${tab === 'wallet' ? 'is-active' : ''}`} onClick={() => setTab('wallet')}>
          Movimientos de estrellitas
        </button>
      </div>

      {tab === 'games' && (
        <div className="panel">
          <div className="filter-row">
            <button className={`pill ${!game ? 'is-active' : ''}`} onClick={() => setGame('')}>
              Todos
            </button>
            {GAMES.map((g) => (
              <button key={g.id} className={`pill ${game === g.id ? 'is-active' : ''}`} onClick={() => setGame(g.id)}>
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
          {!results ? (
            <p className="muted center pad">Cargando…</p>
          ) : results.length === 0 ? (
            <div className="empty">
              <Cat mood="sleepy" size={80} />
              <p>Aún no hay partidas aquí. ¡Ve a jugar!</p>
            </div>
          ) : (
            <>
              <ul className="list">
                {results.map((r) => (
                  <li key={r.id} className="list-row">
                    <span className="list-emoji">{GAME_BY_ID[r.game]?.emoji}</span>
                    <div className="list-main">
                      <strong>{r.summary}</strong>
                      <small>
                        {GAME_BY_ID[r.game]?.name} · {fmtDate(r.created_at)} · apostaste {fmt(r.bet)} ⭐
                      </small>
                    </div>
                    <span className={`badge badge-${r.outcome}`}>{OUTCOME[r.outcome]}</span>
                    <Stars value={r.payout - r.bet} sign size={14} className={`list-amount ${r.payout - r.bet >= 0 ? 'text-mint' : 'text-red'}`} />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button className="btn btn-ghost btn-block" onClick={loadMore}>
                  Cargar más
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className="panel">
          {!transactions ? (
            <p className="muted center pad">Cargando…</p>
          ) : (
            <ul className="list">
              {transactions.map((tx) => (
                <li key={tx.id} className="list-row">
                  <span className={`badge badge-kind-${tx.kind}`}>{KIND[tx.kind] || tx.kind}</span>
                  <div className="list-main">
                    <strong>{tx.description}</strong>
                    <small>
                      {fmtDate(tx.created_at)} · saldo {fmt(tx.balance_after)} ⭐
                    </small>
                  </div>
                  <Stars value={tx.amount} sign size={14} className={`list-amount ${tx.amount >= 0 ? 'text-mint' : 'text-red'}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
