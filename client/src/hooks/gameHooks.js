import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { post, api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

/** Ancho real de un elemento (para tableros cuadrados sin aspect-ratio, que iOS viejo no soporta). */
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  const observed = useRef(null);
  const observer = useRef(null);
  // Se revisa en cada render: el elemento puede aparecer después (p. ej. al pasar de una fase a otra)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === observed.current) return;
    observer.current?.disconnect();
    observed.current = el;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.current.observe(el);
  });
  useEffect(() => () => observer.current?.disconnect(), []);
  return width;
}

/** Teclas de PC. `keys` = { ArrowUp: fn, … }. Evita que flechas y espacio muevan la página. */
export function useKeys(keys, active = true, keyUp = null) {
  const ref = useRef(keys);
  ref.current = keys;
  const upRef = useRef(keyUp);
  upRef.current = keyUp;
  useEffect(() => {
    if (!active) return undefined;
    const down = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const fn = ref.current[e.key] || ref.current[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        if (!e.repeat) fn(e);
      }
    };
    const up = (e) => {
      const fn = upRef.current?.[e.key] || upRef.current?.[e.key.toLowerCase()];
      if (fn) fn(e);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [active]);
}

/** Deslizar el dedo (o el mouse) sobre un elemento: devuelve 'up' | 'down' | 'left' | 'right'. */
export function useSwipe(onSwipe, { min = 24 } = {}) {
  const start = useRef(null);
  return {
    onPointerDown: (e) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      start.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/** Diferencia entre el reloj del servidor y el del celular. */
export function useServerClock(serverNow) {
  const offset = useRef(0);
  useEffect(() => {
    if (serverNow) offset.current = serverNow - Date.now();
  }, [serverNow]);
  return useCallback(() => Date.now() + offset.current, []);
}

/** Segundos que faltan para un instante del servidor (se actualiza solo). */
export function useCountdown(target, now) {
  const [left, setLeft] = useState(() => (target ? Math.max(0, target - now()) : 0));
  useEffect(() => {
    if (!target) return undefined;
    const tick = () => setLeft(Math.max(0, target - now()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [target, now]);
  return left;
}

export const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Flujo común de los juegos de habilidad individuales: apostar, jugar, cobrar. */
export function useSkillGame(game) {
  const { setStars } = useAuth();
  const toast = useToast();
  const [session, setSession] = useState(undefined);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const syncTimer = useRef();

  useEffect(() => {
    api(`/games/skill/${game}`)
      .then((d) => setSession(d.game))
      .catch(() => setSession(null));
    return () => clearTimeout(syncTimer.current);
  }, [game]);

  const call = useCallback(
    async (path, body) => {
      setBusy(true);
      try {
        const r = await post(`/games/skill/${game}/${path}`, body);
        if (typeof r.stars === 'number') setStars(r.stars);
        if (r.game) setSession(r.game);
        if (r.finished) setResult(r);
        return r;
      } catch (err) {
        toast.error(err);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [game, setStars, toast],
  );

  const start = useCallback(
    (bet, options) => {
      setResult(null);
      return call('start', { bet, options });
    },
    [call],
  );

  /** Guarda el progreso unos instantes después del último cambio. */
  const sync = useCallback(
    (payload, delay = 800) => {
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => post(`/games/skill/${game}/sync`, payload).catch(() => {}), delay);
    },
    [game],
  );

  const finish = useCallback(
    (payload) => {
      clearTimeout(syncTimer.current);
      return call('finish', payload);
    },
    [call],
  );

  return {
    session,
    result,
    busy,
    start,
    sync,
    finish,
    action: (payload) => call('action', payload),
    forfeit: () => call('forfeit'),
    reset: () => {
      setSession(null);
      setResult(null);
    },
  };
}
