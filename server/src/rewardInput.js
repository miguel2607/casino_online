import { bad } from './errors.js';

/** Valida los campos de una recompensa. Con partial=true solo valida los que vengan. */
export function parseReward(body, partial = false) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = String(body.title ?? '').trim().slice(0, 80);
    if (!out.title) throw bad('La recompensa necesita un título');
  }
  if (!partial || body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 300);
  if (!partial || body.icon !== undefined) out.icon = String(body.icon ?? '').trim().slice(0, 16) || '🎁';
  if (!partial || body.cost !== undefined) {
    out.cost = Number(body.cost);
    if (!Number.isInteger(out.cost) || out.cost < 1) throw bad('El costo debe ser un número entero mayor a 0');
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === null || body.stock === '' || body.stock === undefined) out.stock = null;
    else {
      out.stock = Number(body.stock);
      if (!Number.isInteger(out.stock) || out.stock < 0) throw bad('El stock debe ser un entero (o vacío para ilimitado)');
    }
  }
  if (!partial || body.active !== undefined) out.active = body.active === undefined ? true : Boolean(body.active);
  return out;
}
