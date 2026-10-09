import bcrypt from 'bcrypt';

/** Costo de bcrypt acordado en la guía de la base de datos. Cada hash lleva su propio salt. */
const RONDAS = 12;

/** bcrypt solo usa los primeros 72 bytes: la política rechaza contraseñas más largas (ver politica-contrasena). */
export const MAX_BYTES_BCRYPT = 72;

/** Genera el hash bcrypt (60 caracteres) que se guarda en usuario.contrasena_hash. */
export function cifrarContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, RONDAS);
}

/** Compara la contraseña escrita con el hash guardado. El hash nunca se descifra. */
export function compararContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}

/** true si el hash se generó con un costo menor al vigente y conviene recalcularlo al iniciar sesión. */
export function requiereRecifrar(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < RONDAS;
  } catch {
    return false;
  }
}

/** Hash de una contraseña aleatoria: se compara cuando el correo no existe, para que la respuesta tarde lo mismo. */
export const hashSenuelo = bcrypt.hash(crypto.randomUUID(), RONDAS);
