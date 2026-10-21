import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { moveStars } from '../wallet.js';
import { emitTo, isOnline } from '../bus.js';
import { assignInviteCode, getPartner, publicPartner } from '../couple.js';
import { activeMatchFor, dropInvitesBetween } from '../multi/manager.js';

const router = Router();
const nameOf = (u) => u.display_name || u.username;

router.get('/', async (req, res) => {
  const inviteCode = req.user.invite_code || (await assignInviteCode(req.user.id));
  const partner = await getPartner(pool, req.user.id);
  res.json({
    inviteCode,
    partner: publicPartner(partner),
    activeMatch: partner ? await activeMatchFor(req.user.id) : null,
  });
});

router.post('/code', async (req, res) => {
  res.json({ inviteCode: await assignInviteCode(req.user.id) });
});

router.post('/link', async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!code) throw bad('Escribe el código de tu pareja');
  const partner = await withTx(async (c) => {
    const { rows } = await c.query('SELECT id FROM users WHERE invite_code = $1', [code]);
    if (!rows[0]) throw bad('No encontramos ese código, revísalo');
    if (rows[0].id === req.user.id) throw bad('Ese es tu propio código 😹');
    // Bloquea a los dos en orden para evitar cruces
    const ids = [req.user.id, rows[0].id].sort((a, b) => a - b);
    const { rows: both } = await c.query('SELECT * FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE', [ids]);
    if (both.some((u) => u.partner_id)) throw bad('Uno de los dos ya está vinculado con otra persona');
    await c.query('UPDATE users SET partner_id = $2 WHERE id = $1', [req.user.id, rows[0].id]);
    await c.query('UPDATE users SET partner_id = $2 WHERE id = $1', [rows[0].id, req.user.id]);
    return both.find((u) => u.id === rows[0].id);
  });
  emitTo(partner.id, 'couple', { linked: true, by: nameOf(req.user) });
  // La presencia se calcula al conectar: al vincularse hay que avisarla a los dos
  emitTo(partner.id, 'presence', { online: isOnline(req.user.id) });
  emitTo(req.user.id, 'presence', { online: isOnline(partner.id) });
  res.json({ partner: publicPartner(partner) });
});

router.post('/unlink', async (req, res) => {
  const partner = await getPartner(pool, req.user.id);
  if (!partner) throw bad('No tienes pareja vinculada');
  if (await activeMatchFor(req.user.id)) throw bad('Terminen la partida en curso antes de desvincularse');
  await pool.query('UPDATE users SET partner_id = NULL WHERE id = ANY($1)', [[req.user.id, partner.id]]);
  dropInvitesBetween(req.user.id, partner.id);
  emitTo(partner.id, 'couple', { linked: false });
  emitTo(partner.id, 'presence', { online: false });
  emitTo(req.user.id, 'presence', { online: false });
  res.json({ ok: true });
});

router.post('/gift', async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < 1) throw bad('Indica cuántas estrellitas quieres regalar');
  const message = String(req.body?.message ?? '').trim().slice(0, 120);
  const partner = await getPartner(pool, req.user.id);
  if (!partner) throw new HttpError(400, 'Primero vincúlate con tu pareja');

  const [mine, theirs] = await withTx(async (c) => [
    await moveStars(c, req.user.id, -amount, 'gift', `Regalo para ${nameOf(partner)}${message ? ` · ${message}` : ''}`),
    await moveStars(c, partner.id, amount, 'gift', `Regalo de ${nameOf(req.user)}${message ? ` · ${message}` : ''}`),
  ]);
  emitTo(partner.id, 'stars', { stars: theirs });
  emitTo(partner.id, 'gift', { from: nameOf(req.user), amount, message });
  res.json({ stars: mine });
});

export default router;
