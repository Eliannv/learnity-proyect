import bcrypt from 'bcrypt';

/** Costo de bcrypt acordado en la guía de la base de datos. */
const RONDAS = 12;

/** Genera el hash bcrypt (60 caracteres) que se guarda en usuario.contrasena_hash. */
export function cifrarContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, RONDAS);
}

/** Compara la contraseña escrita con el hash guardado. El hash nunca se descifra. */
export function compararContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}
