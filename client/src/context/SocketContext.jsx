import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { fmt } from '../format.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, setStars, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [invites, setInvites] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [rewardsVersion, setRewardsVersion] = useState(0);
  const listeners = useRef(new Set());
  const userId = user?.id;
  // navigate cambia en cada ruta: lo guardamos en un ref para no reconectar el socket
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!userId) return undefined;
    const socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('presence', ({ online }) => setPartnerOnline(online));
    socket.on('invites', setInvites);
    socket.on('stars', ({ stars }) => setStars(stars));
    socket.on('match:start', ({ matchId }) => navigateRef.current(`/pareja/partida/${matchId}`));
    socket.on('match:update', (m) => listeners.current.forEach((fn) => fn(m)));
    socket.on('invite:declined', ({ by }) => toast.info(`${by} no puede jugar ahora 😿`));
    socket.on('couple', ({ linked, by }) => {
      refresh();
      if (linked) toast.success(`¡${by} se vinculó contigo! 💞`);
      else toast.info('Tu pareja se desvinculó');
    });
    socket.on('gift', ({ from, amount, message }) => {
      toast.success(`${from} te regaló ${fmt(amount)} ⭐${message ? ` · "${message}"` : ''}`);
    });
    socket.on('redemption', ({ by, title, icon }) => {
      toast.success(`${icon} ${by} canjeó tu cupón "${title}"`);
      setRewardsVersion((v) => v + 1);
    });
    socket.on('redemption:update', ({ by, title, status }) => {
      toast.info(status === 'fulfilled' ? `💖 ${by} cumplió "${title}"` : `${by} canceló "${title}" y te devolvió las estrellitas`);
      setRewardsVersion((v) => v + 1);
    });
    socket.on('rewards:changed', () => setRewardsVersion((v) => v + 1));
    socket.on('sticker', (s) => {
      setStickers((list) => [...list.slice(-4), s]);
      setTimeout(() => setStickers((list) => list.filter((x) => x.id !== s.id)), 3200);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, setStars, refresh, toast]);

  /** Emite un evento y devuelve la respuesta del servidor (lanza error si falla). */
  const request = useCallback(
    (event, payload) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) return reject(new Error('Sin conexión en tiempo real, reintentando…'));
        socket.timeout(10000).emit(event, payload, (err, res) => {
          if (err) reject(new Error('El servidor no respondió, intenta de nuevo'));
          else if (!res?.ok) reject(new Error(res?.error || 'Algo salió mal 😿'));
          else resolve(res);
        });
      }),
    [],
  );

  const onMatchUpdate = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const sendSticker = useCallback((sticker) => socketRef.current?.emit('sticker', { sticker }), []);

  const incoming = useMemo(() => invites.filter((i) => i.to.id === userId), [invites, userId]);
  const outgoing = useMemo(() => invites.filter((i) => i.from.id === userId), [invites, userId]);

  const value = useMemo(
    () => ({ connected, partnerOnline, incoming, outgoing, stickers, rewardsVersion, request, onMatchUpdate, sendSticker }),
    [connected, partnerOnline, incoming, outgoing, stickers, rewardsVersion, request, onMatchUpdate, sendSticker],
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
