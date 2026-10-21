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
    canClaimBonus: !u.last_daily_bonus || u.last_daily_bonus < todayStr(),
    createdAt: u.created_at,
  };
}

export function issueToken(res, user) {
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '30d' });
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

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Tu sesión expiró, vuelve a entrar');
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.uid]);
  if (!rows[0]) throw new HttpError(401, 'Tu sesión expiró, vuelve a entrar');
  req.user = rows[0];
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Solo el administrador puede entrar aquí');
  next();
}
