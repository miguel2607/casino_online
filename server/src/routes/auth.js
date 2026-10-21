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

// ---- Recuperación de contraseña con pregunta secreta ----

const MAX_FAILED = 3;
const LOCK_MINUTES = 60;
const IP_LIMIT = 10; // intentos por IP por hora, para cualquier usuario
const ipAttempts = new Map();

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const recoveryEnabled = () => Boolean(config.recovery.answer && config.recovery.options.length >= 2);

function checkIpLimit(ip) {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.reset < now) {
    ipAttempts.set(ip, { count: 1, reset: now + 60 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > IP_LIMIT) throw new HttpError(429, 'Demasiados intentos, espera un rato y vuelve a probar');
}

router.get('/recovery', (req, res) => {
  if (!recoveryEnabled()) return res.json({ enabled: false });
  res.json({ enabled: true, question: config.recovery.question, options: config.recovery.options });
});

router.post('/recover', async (req, res) => {
  if (!recoveryEnabled()) throw new HttpError(404, 'La recuperación de contraseña no está activada');
  checkIpLimit(req.ip);

  const username = String(req.body?.username ?? '').trim();
  const answer = req.body?.answer;
  const newPassword = String(req.body?.newPassword ?? '');
  if (!username) throw bad('Escribe tu nombre de usuario');
  if (!answer) throw bad('Elige una respuesta');
  if (newPassword.length < 4) throw bad('La nueva contraseña debe tener al menos 4 caracteres');

  const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const user = rows[0];
  if (!user) throw bad('Usuario o respuesta incorrectos');

  const lockedUntil = user.recovery_locked_until ? new Date(user.recovery_locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Podrás intentarlo de nuevo en ${minutes} min`);
  }

  if (normalize(answer) !== normalize(config.recovery.answer)) {
    const failed = user.recovery_failed + 1;
    if (failed >= MAX_FAILED) {
      await pool.query(
        `UPDATE users SET recovery_failed = 0, recovery_locked_until = now() + make_interval(mins => $2) WHERE id = $1`,
        [user.id, LOCK_MINUTES],
      );
      throw new HttpError(429, `Respuesta incorrecta. La recuperación queda bloqueada por ${LOCK_MINUTES} min`);
    }
    await pool.query('UPDATE users SET recovery_failed = $2 WHERE id = $1', [user.id, failed]);
    const left = MAX_FAILED - failed;
    throw bad(`Usuario o respuesta incorrectos. Te queda${left === 1 ? '' : 'n'} ${left} intento${left === 1 ? '' : 's'}`);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  const { rows: [updated] } = await pool.query(
    `UPDATE users SET password_hash = $2, password_changed_at = now(), recovery_failed = 0,
       recovery_locked_until = NULL, last_login_at = now()
     WHERE id = $1 RETURNING *`,
    [user.id, hash],
  );
  issueToken(res, updated);
  res.json({ user: publicUser(updated) });
});

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
