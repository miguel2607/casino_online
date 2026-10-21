// Canal de eventos en tiempo real compartido por las rutas y el gestor de partidas.
let io = null;
const online = new Map(); // userId -> conexiones abiertas

export const setIo = (server) => {
  io = server;
};

export function emitTo(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

export const isOnline = (userId) => Boolean(userId) && (online.get(userId) || 0) > 0;

/** Devuelve true si es la primera conexión del usuario. */
export function markOnline(userId) {
  const n = (online.get(userId) || 0) + 1;
  online.set(userId, n);
  return n === 1;
}

/** Devuelve true si era su última conexión. */
export function markOffline(userId) {
  const n = Math.max(0, (online.get(userId) || 0) - 1);
  if (n) online.set(userId, n);
  else online.delete(userId);
  return n === 0;
}
