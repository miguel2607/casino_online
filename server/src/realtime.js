import { Server } from 'socket.io';
import { pool } from './db.js';
import { tokenFromCookieHeader, userFromToken } from './auth.js';
import { emitTo, isOnline, markOffline, markOnline, setIo } from './bus.js';
import { getPartner } from './couple.js';
import * as manager from './multi/manager.js';

export const STICKERS = ['love', 'haha', 'wow', 'nooo', 'luck', 'grr', 'kiss', 'gg'];
const STICKER_COOLDOWN_MS = 700;
const lastSticker = new Map();

/** Convierte un handler async en uno con respuesta { ok, ... } / { ok: false, error }. */
const handle = (socket, fn) => async (payload, ack) => {
  try {
    // El usuario se relee en cada acción por si cambió (pareja, estrellitas…)
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [socket.data.userId]);
    const result = await fn(rows[0], payload ?? {});
    if (typeof ack === 'function') ack({ ok: true, ...result });
  } catch (err) {
    if (!err.status) console.error(err);
    if (typeof ack === 'function') ack({ ok: false, error: err.status ? err.message : 'Algo salió mal 😿' });
  }
};

async function notifyPartnerPresence(userId, online) {
  const partner = await getPartner(pool, userId);
  if (partner) emitTo(partner.id, 'presence', { online });
}

export function attachRealtime(httpServer) {
  const io = new Server(httpServer, { serveClient: false });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(tokenFromCookieHeader(socket.handshake.headers.cookie));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    if (markOnline(userId)) notifyPartnerPresence(userId, true).catch(() => {});

    const partner = await getPartner(pool, userId).catch(() => null);
    socket.emit('presence', { online: isOnline(partner?.id) });
    socket.emit('invites', manager.invitesFor(userId));

    socket.on('invite:send', handle(socket, (u, p) => manager.sendInvite(u, p)));
    socket.on('invite:respond', handle(socket, (u, p) => manager.respondInvite(u, p)));
    socket.on('invite:cancel', handle(socket, (u, p) => manager.cancelInvite(u, p)));
    socket.on('match:get', handle(socket, (u, p) => manager.getMatchView(u, p)));
    socket.on('match:action', handle(socket, (u, p) => manager.act(u, p)));
    socket.on('match:forfeit', handle(socket, (u, p) => manager.forfeit(u, p)));

    // Pulsos frecuentes: sin consultar la base de datos y con un límite de envíos por segundo
    let pulseWindow = Date.now();
    let pulses = 0;
    socket.on('match:pulse', (payload) => {
      const now = Date.now();
      if (now - pulseWindow > 1000) {
        pulseWindow = now;
        pulses = 0;
      }
      if (++pulses > 30) return;
      manager.pulse({ id: userId }, payload ?? {}).catch((err) => err.status || console.error(err));
    });

    socket.on(
      'sticker',
      handle(socket, async (u, { sticker }) => {
        if (!STICKERS.includes(sticker)) return {};
        const now = Date.now();
        if (now - (lastSticker.get(u.id) || 0) < STICKER_COOLDOWN_MS) return {};
        lastSticker.set(u.id, now);
        const event = { id: `${u.id}-${now}`, sticker, from: { id: u.id, displayName: u.display_name || u.username, avatar: u.avatar } };
        emitTo(u.id, 'sticker', event);
        if (u.partner_id) emitTo(u.partner_id, 'sticker', event);
        return {};
      }),
    );

    socket.on('disconnect', () => {
      if (markOffline(userId)) notifyPartnerPresence(userId, false).catch(() => {});
    });
  });

  return io;
}
