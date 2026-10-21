import { randomInt } from 'node:crypto';
import { pool } from './db.js';
import { isOnline } from './bus.js';

export async function getPartner(client, userId) {
  const { rows } = await client.query(
    'SELECT p.* FROM users u JOIN users p ON p.id = u.partner_id WHERE u.id = $1',
    [userId],
  );
  return rows[0] || null;
}

export const publicPartner = (p) =>
  p && {
    id: p.id,
    username: p.username,
    displayName: p.display_name || p.username,
    avatar: p.avatar,
    stars: p.stars,
    online: isOnline(p.id),
  };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para no confundir

/** Asigna (o regenera) un código de invitación único. */
export async function assignInviteCode(userId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = 'MICHI-' + Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    try {
      await pool.query('UPDATE users SET invite_code = $2 WHERE id = $1', [userId, code]);
      return code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('No se pudo generar un código de invitación');
}
