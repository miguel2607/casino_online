import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, withTx, getSetting } from '../db.js';
import { config } from '../config.js';
import { HttpError, bad } from '../errors.js';
import { moveStars } from '../wallet.js';
import { AVATARS, clearToken, issueToken, publicUser, requireAuth } from '../auth.js';

const router = Router();
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,24}$/u;

router.get('/config', (req, res) => {
  res.json({ allowRegistration: config.allowRegistration });
});

router.post('/register', async (req, res) => {
  if (!config.allowRegistration) throw new HttpError(403, 'El registro está cerrado por ahora');
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? '').trim().slice(0, 40) || username;
  const avatar = AVATARS.includes(req.body?.avatar) ? req.body.avatar : 'orange';

  if (!USERNAME_RE.test(username)) {
    throw bad('El usuario debe tener entre 3 y 24 caracteres (letras, números, _ . -)');
  }
  if (password.length < 4) throw bad('La contraseña debe tener al menos 4 caracteres');

  const hash = await bcrypt.hash(password, 10);
  const user = await withTx(async (c) => {
    const exists = await c.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
    if (exists.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya existe');
    const { rows } = await c.query(
      'INSERT INTO users (username, display_name, password_hash, avatar, last_login_at) VALUES ($1, $2, $3, $4, now()) RETURNING id',
      [username, displayName, hash, avatar],
    );
    const starting = Number(await getSetting('starting_stars', 1000, c)) || 0;
    if (starting > 0) await moveStars(c, rows[0].id, starting, 'bonus', '¡Regalo de bienvenida! 🎁');
    return (await c.query('SELECT * FROM users WHERE id = $1', [rows[0].id])).rows[0];
  });

  issueToken(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  issueToken(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
