import Cat from './Cat.jsx';
import { PawIcon } from './Icons.jsx';
import { SUIT_SYMBOL, isRedSuit, rankLabel } from '../format.js';

const FACE = { 11: { color: 'gray' }, 12: { color: 'calico', accessory: 'bow' }, 13: { color: 'orange', accessory: 'crown' } };

/** Carta de póker. Tamaño controlado por la variable CSS --card-w. */
export default function PlayingCard({ card, hidden, selected, highlight, onClick, className = '', style }) {
  const faceDown = hidden || card?.hidden || card?.up === false;
  const classes = ['pcard', faceDown ? 'pcard-back' : '', selected ? 'is-selected' : '', highlight ? 'is-target' : '', onClick ? 'is-clickable' : '', className]
    .filter(Boolean)
    .join(' ');

  if (faceDown) {
    return (
      <div className={classes} style={style} onClick={onClick}>
        <div className="pcard-back-inner">
          <PawIcon size="38%" color="rgba(255,255,255,.85)" />
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.s);
  const label = rankLabel(card.r);
  const sym = SUIT_SYMBOL[card.s];
  const face = FACE[card.r];
  return (
    <div className={`${classes} ${red ? 'is-red' : 'is-black'}`} style={style} onClick={onClick}>
      <div className="pcard-corner">
        <span className="pcard-rank">{label}</span>
        <span className="pcard-suit">{sym}</span>
      </div>
      <div className="pcard-center">
        {face ? <Cat color={face.color} accessory={face.accessory} mood="happy" size="70%" /> : <span>{sym}</span>}
      </div>
      <div className="pcard-corner pcard-corner-br">
        <span className="pcard-rank">{label}</span>
        <span className="pcard-suit">{sym}</span>
      </div>
    </div>
  );
}
