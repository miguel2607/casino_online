import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { config } from './config.js';
import { HttpError } from './errors.js';

const COOKIE = 'michi_token';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export const AVATARS = ['orange', 'gray', 'black', 'white', 'calico', 'cream'];

export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());
}

export function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    role: u.role,
    stars: u.stars,
    avatar: u.avatar,
    partnerId: u.partner_id ?? null,
    canClaimBonus: !u.last_daily_bonus || u.last_daily_bonus < todayStr(),
    createdAt: u.created_at,
  };
}

/** Cambia cada vez que cambia la contraseña; va dentro del token de sesión. */
const passwordVersion = (user) => (user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0);

export function issueToken(res, user) {
  const token = jwt.sign({ uid: user.id, pv: passwordVersion(user) }, config.jwtSecret, { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: MAX_AGE,
  });
}

export function clearToken(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
}

/** Valida el token de sesión y devuelve el usuario (lo usan HTTP y los sockets). */
export async function userFromToken(token) {
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Tu sesión expiró, vuelve a entrar');
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.uid]);
  if (!rows[0]) throw new HttpError(401, 'Tu sesión expiró, vuelve a entrar');
  // Las sesiones abiertas antes de un cambio de contraseña dejan de valer
  if ((payload.pv ?? 0) !== passwordVersion(rows[0])) throw new HttpError(401, 'Tu contraseña cambió, vuelve a entrar');
  return rows[0];
}

/** Lee la cookie de sesión de una cabecera Cookie cruda (handshake del socket). */
export function tokenFromCookieHeader(header = '') {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function requireAuth(req, res, next) {
  req.user = await userFromToken(req.cookies?.[COOKIE]);
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Solo el administrador puede entrar aquí');
  next();
}
