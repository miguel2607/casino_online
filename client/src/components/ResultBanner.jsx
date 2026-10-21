import Cat from './Cat.jsx';
import Stars from './Stars.jsx';
import Celebration from './Celebration.jsx';

const COPY = {
  win: ['¡Ganaste!', '¡Miau-ravilloso!', '¡Eres una campeona!', '¡Qué suerte felina!'],
  lose: ['Esta vez no…', 'Ay, casi casi', 'El michi dice: otra vez', 'No pasa nada, ¡a la próxima!'],
  push: ['Empate', 'Te devolvemos tus estrellitas'],
};

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

/** Banner de resultado. outcome: win | lose | push */
export default function ResultBanner({ outcome, payout = 0, bet = 0, title, detail, seed = 0, color = 'orange' }) {
  if (!outcome) return null;
  const net = payout - bet;
  const mood = outcome === 'win' ? 'love' : outcome === 'lose' ? 'sad' : 'wink';
  return (
    <div className={`result-banner result-${outcome}`} role="status">
      {outcome === 'win' && net >= bet * 2 && <Celebration />}
      <Cat color={color} mood={mood} size={56} />
      <div className="result-text">
        <strong>{title || pick(COPY[outcome], seed)}</strong>
        {detail && <span>{detail}</span>}
      </div>
      <div className="result-amount">
        {outcome === 'win' && <Stars value={payout} sign size={20} />}
        {outcome === 'lose' && <Stars value={-bet} size={20} />}
        {outcome === 'push' && <Stars value={payout} size={20} />}
      </div>
    </div>
  );
}
