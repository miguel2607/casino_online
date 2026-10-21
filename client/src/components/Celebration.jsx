import { useMemo } from 'react';
import { createPortal } from 'react-dom';

const BITS = ['⭐', '🐾', '💖', '✨', '😻', '⭐', '💫'];

/** Lluvia de estrellitas y patitas. */
export default function Celebration({ count = 36 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        char: BITS[i % BITS.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        size: 16 + Math.random() * 22,
        drift: (Math.random() - 0.5) * 160,
      })),
    [count],
  );
  return createPortal(
    <div className="celebration" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>,
    document.body,
  );
}
