import { useEffect, useRef, useState } from 'react';
import Cat from './Cat.jsx';
import { useKeys } from '../hooks/gameHooks.js';

export const PADS = [
  { color: 'orange', bg: '#f6a04d', tone: 330, key: '1' },
  { color: 'gray', bg: '#7aa2ff', tone: 392, key: '2' },
  { color: 'calico', bg: '#ff7eb6', tone: 494, key: '3' },
  { color: 'black', bg: '#5ce1b5', tone: 587, key: '4' },
];

let audioCtx = null;
/** Pequeño "miau" electrónico (el navegador solo permite sonido tras un toque). */
export function beep(freq, ms = 220) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    // sin sonido no pasa nada
  }
}

/** Reproduce una secuencia encendiendo los michis uno a uno. */
export function usePlayback(stepMs = 600) {
  const [lit, setLit] = useState(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const play = (seq, delay = 500) =>
    new Promise((resolve) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      seq.forEach((p, k) => {
        timers.current.push(setTimeout(() => {
          setLit(p);
          beep(PADS[p].tone, stepMs * 0.6);
        }, delay + k * stepMs));
        timers.current.push(setTimeout(() => setLit(null), delay + k * stepMs + stepMs * 0.6));
      });
      timers.current.push(setTimeout(resolve, delay + seq.length * stepMs));
    });
  return { lit, play, setLit };
}

export default function SimonPad({ lit, onPress, disabled }) {
  const [pressed, setPressed] = useState(null);
  const press = (i) => {
    if (disabled) return;
    setPressed(i);
    setTimeout(() => setPressed((p) => (p === i ? null : p)), 180);
    beep(PADS[i].tone, 160);
    onPress(i);
  };
  useKeys(Object.fromEntries(PADS.map((p, i) => [p.key, () => press(i)])), !disabled);

  return (
    <div className={`simon ${disabled ? 'is-disabled' : ''}`}>
      {PADS.map((p, i) => (
        <button
          key={i}
          className={`simon-pad ${lit === i || pressed === i ? 'is-lit' : ''}`}
          style={{ '--pad': p.bg }}
          onPointerDown={(e) => {
            e.preventDefault();
            press(i);
          }}
          aria-label={`Michi ${i + 1}`}
        >
          <Cat color={p.color} mood={lit === i || pressed === i ? 'love' : 'happy'} size="58%" />
          <span className="simon-key">{p.key}</span>
        </button>
      ))}
    </div>
  );
}
