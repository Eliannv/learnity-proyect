// Constantes del entorno E2E. Puertos propios para no chocar con `npm run dev` ni con `ng serve`.
import path from 'node:path';

export const PUERTO_API = 3100;
export const PUERTO_WEB = 4300;
export const URL_WEB = `http://localhost:${PUERTO_WEB}`;
export const URL_API = `http://localhost:${PUERTO_API}`;

/** Carpeta de trabajo de la ejecución: PDF subidos y buzón de correo. Se borra en el teardown. */
export const RAIZ_TMP = path.resolve(__dirname, '..', '.tmp');
export const DIR_PDF = path.join(RAIZ_TMP, 'pdf');
export const DIR_BUZON = path.join(RAIZ_TMP, 'buzon');

/** Contraseña de las cuentas creadas por la interfaz (cumple la política de 15 caracteres). */
export const CONTRASENA_UI = 'Frase-larga-segura-2026-E2E';
