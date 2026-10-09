import { env } from '../config/env.js';

/**
 * Registro de eventos de seguridad (una línea JSON por evento, en la salida estándar).
 * Nunca recibe contraseñas, tokens, cookies ni cuerpos de petición: solo identificadores,
 * la IP y el correo enmascarado. Las claves sensibles se descartan aunque alguien las pase.
 */
type Nivel = 'info' | 'aviso' | 'error';

const CLAVES_PROHIBIDAS = /contrasena|password|token|cookie|secret|hash|authorization/i;

export function ocultarCorreo(correo: string): string {
  const [usuario = '', dominio = ''] = correo.split('@');
  return `${usuario.slice(0, 1)}***@${dominio}`;
}

export function registrarEvento(evento: string, datos: Record<string, unknown> = {}, nivel: Nivel = 'info'): void {
  if (env.NODE_ENV === 'test' && process.env['LOG_EN_PRUEBAS'] !== 'true') return;
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (!CLAVES_PROHIBIDAS.test(clave) && valor !== undefined) limpio[clave] = valor;
  }
  const linea = JSON.stringify({ momento: new Date().toISOString(), nivel, evento, ...limpio });
  if (nivel === 'error') console.error(linea);
  else console.log(linea);
}
