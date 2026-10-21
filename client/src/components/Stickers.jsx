import { createPortal } from 'react-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Cat from './Cat.jsx';

export const STICKERS = {
  love: { color: 'calico', mood: 'love', text: '¡Te amo!' },
  kiss: { color: 'orange', mood: 'love', text: 'Muak 💋' },
  haha: { color: 'cream', mood: 'happy', text: '¡Jajaja!' },
  wow: { color: 'white', mood: 'shocked', text: '¡Wow!' },
  luck: { color: 'gray', mood: 'wink', text: '¡Suerte!' },
  gg: { color: 'orange', mood: 'happy', text: '¡Bien jugado!', accessory: 'crown' },
  nooo: { color: 'gray', mood: 'sad', text: '¡Nooo!' },
  grr: { color: 'black', mood: 'shocked', text: '¡Grrr!' },
};

export function StickerBar({ compact = false }) {
  const { sendSticker, connected } = useSocket();
  return (
    <div className={`sticker-bar ${compact ? 'is-compact' : ''}`} role="toolbar" aria-label="Enviar sticker">
      {Object.entries(STICKERS).map(([id, s]) => (
        <button key={id} className="sticker-btn" onClick={() => sendSticker(id)} disabled={!connected} title={s.text} aria-label={s.text}>
          <Cat color={s.color} mood={s.mood} accessory={s.accessory} size={36} />
        </button>
      ))}
    </div>
  );
}

/** Stickers recibidos: aparecen flotando sobre la pantalla unos segundos. */
export function StickerLayer() {
  const { stickers } = useSocket();
  const { user } = useAuth();
  if (!stickers.length) return null;
  return createPortal(
    <div className="sticker-layer" aria-live="polite">
      {stickers.map((s) => {
        const def = STICKERS[s.sticker];
        const mine = s.from.id === user?.id;
        return (
          <div key={s.id} className={`sticker-pop ${mine ? 'is-mine' : 'is-theirs'}`}>
            <Cat color={def.color} mood={def.mood} accessory={def.accessory} size={84} />
            <span className="sticker-text">{def.text}</span>
            <small>{mine ? 'Tú' : s.from.displayName}</small>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
