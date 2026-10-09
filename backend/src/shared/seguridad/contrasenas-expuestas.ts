import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { registrarEvento } from '../log/registro.js';

/**
 * Comprueba si una contraseña apareció en filtraciones conocidas (Have I Been Pwned · Pwned Passwords).
 * k-anonimato: se calcula el SHA-1 aquí y solo se envían sus 5 primeros caracteres; la API devuelve
 * los sufijos que empiezan así y la comparación se hace en el servidor. La contraseña nunca sale.
 *
 * Devuelve true (expuesta), false (no aparece) o null (no se pudo consultar: la política local sigue aplicando).
 */
export async function contrasenaExpuesta(contrasena: string): Promise<boolean | null> {
  if (!env.HIBP_ACTIVO) return null;
  const sha1 = createHash('sha1').update(contrasena, 'utf8').digest('hex').toUpperCase();
  const prefijo = sha1.slice(0, 5);
  const sufijo = sha1.slice(5);
  try {
    const respuesta = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Learnity-API' },
      signal: AbortSignal.timeout(3000),
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const texto = await respuesta.text();
    for (const linea of texto.split('\n')) {
      const [s, cuenta] = linea.trim().split(':');
      // Las líneas de relleno (Add-Padding) traen cuenta 0.
      if (s === sufijo && Number(cuenta) > 0) return true;
    }
    return false;
  } catch (error) {
    registrarEvento('hibp_no_disponible', { motivo: (error as Error).name }, 'aviso');
    return null;
  }
}
