import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token opaco de 256 bits en base64url (43 caracteres): refresh tokens y enlaces de recuperación. */
export function generarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/** Formato de generarTokenOpaco: descarta basura antes de consultar la base. */
export function esTokenOpaco(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

/** SHA-256 en hex. La base guarda solo este hash: un volcado de la tabla no sirve para entrar. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function firmarHmac(secreto: string, valor: string): string {
  return createHmac('sha256', secreto).update(valor).digest('base64url');
}

/** Comparación en tiempo constante (evita medir cuántos caracteres coinciden). */
export function igualesSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
