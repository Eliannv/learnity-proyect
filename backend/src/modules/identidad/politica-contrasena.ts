import { contrasenaExpuesta } from '../../shared/seguridad/contrasenas-expuestas.js';
import { AppError } from '../../shared/http/app-error.js';

// Regla del negocio (NIST SP 800-63B): largo mínimo (lo valida el esquema), sin reglas arbitrarias de
// composición, y rechazo de contraseñas comprometidas, muy comunes o ligadas a la propia cuenta.

/** Respaldo local por si Have I Been Pwned no responde: contraseñas largas pero conocidísimas. */
const COMUNES = new Set([
  'passwordpassword', 'contrasenacontrasena', 'contraseñacontraseña', '123456789012345', '1234567890123456',
  'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl', 'aaaaaaaaaaaaaaa', 'learnitylearnity', 'iloveyouiloveyou',
  'administradoradmin', 'estudianteestudiante', 'abcdefghijklmnop', 'passwordpassword1', 'password123456789',
]);

export interface ContextoContrasena {
  correo: string;
  nombres?: string;
  apellidos?: string;
}

function rechazo(mensaje: string): AppError {
  return AppError.solicitudInvalida(mensaje, [{ campo: 'contrasena', mensaje }]);
}

/** Lanza AppError 400 si la contraseña no se puede usar. */
export async function exigirContrasenaSegura(contrasena: string, contexto: ContextoContrasena): Promise<void> {
  const minuscula = contrasena.toLowerCase();
  const compacta = minuscula.replace(/\s+/g, '');

  if (new Set(Array.from(compacta)).size < 4 || COMUNES.has(compacta)) {
    throw rechazo('Esa contraseña es demasiado común o repetitiva. Prueba con una frase de varias palabras.');
  }

  // Si al quitar el nombre, el correo y "learnity" queda poco (p. ej. "rosavera2026"), se rechaza.
  const usuarioCorreo = contexto.correo.split('@')[0]?.toLowerCase() ?? '';
  const propias = [usuarioCorreo, contexto.nombres, contexto.apellidos, 'learnity']
    .flatMap((t) => {
      const valor = (t ?? '').toLowerCase();
      return [valor.replace(/\s+/g, ''), ...valor.split(/[\s._-]+/)];
    })
    .filter((t) => t.length >= 4)
    .sort((a, b) => b.length - a.length);
  let resto = compacta;
  for (const t of propias) resto = resto.split(t).join('');
  if (resto !== compacta && resto.replace(/[^\p{L}\p{N}]/gu, '').length < 8) {
    throw rechazo('La contraseña no debe basarse en tu nombre, tu correo o el nombre de la plataforma.');
  }

  if ((await contrasenaExpuesta(contrasena)) === true) {
    throw rechazo('Esta contraseña apareció en filtraciones de datos conocidas. Elige otra que no uses en ningún sitio.');
  }
}
