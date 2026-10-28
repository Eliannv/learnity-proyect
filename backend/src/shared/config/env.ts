import 'dotenv/config';
import { z } from 'zod';

const booleano = (porDefecto: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(porDefecto)
    .transform((v) => v === 'true');

const opcional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

// Valida las variables de entorno al arrancar: si falta algo, el servidor no inicia y dice qué falta.
const esquema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:4200'),
    /** URL pública del frontend: se usa para armar el enlace de recuperación. */
    FRONTEND_URL: z.url().default('http://localhost:4200'),
    /** false = conexión directa; 1 = detrás de un proxy inverso (Nginx), para leer la IP real. */
    TRUST_PROXY: z.string().default('false'),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_SSL: booleano('false'),
    PDF_DIR: z.string().trim().min(1).default('uploads/pdf'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres aleatorios'),
    /** Vida del access token (JWT que el navegador guarda solo en memoria). */
    ACCESS_MINUTOS: z.coerce.number().int().min(1).max(60).default(15),
    /** Inactividad máxima: el refresh token vence si no se usa en estos días. */
    REFRESH_DIAS: z.coerce.number().int().min(1).max(30).default(7),
    /** Vida máxima de una sesión aunque se siga refrescando. */
    SESION_MAX_DIAS: z.coerce.number().int().min(1).max(90).default(30),
    /** Cookies solo por HTTPS. Obligatorio en producción; en desarrollo local por HTTP va en false. */
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),

    RECUPERACION_MINUTOS: z.coerce.number().int().min(15).max(30).default(20),
    /** Inicios de sesión por IP cada 15 minutos. Solo las E2E (muchas cuentas desde 127.0.0.1) lo suben. */
    LOGIN_MAX_POR_IP: z.coerce.number().int().min(1).max(1000).default(20),
    /** Consulta Have I Been Pwned (k-anonimato: solo viajan 5 caracteres del hash SHA-1). */
    HIBP_ACTIVO: booleano('true'),

    /** gmail = Gmail API (OAuth 2.0, alcance gmail.send) · buzon = archivos locales para pruebas. */
    CORREO_TRANSPORTE: z.enum(['gmail', 'buzon']).default('buzon'),
    BUZON_DIR: z.string().default('.buzon'),
    GMAIL_CLIENT_ID: opcional,
    GMAIL_CLIENT_SECRET: opcional,
    GMAIL_REFRESH_TOKEN: opcional,
    GMAIL_REMITENTE: opcional,
    GMAIL_NOMBRE_REMITENTE: z.string().default('Learnity'),
  })
  .superRefine((e, ctx) => {
    if (e.CORREO_TRANSPORTE === 'gmail') {
      for (const clave of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_REMITENTE'] as const) {
        if (!e[clave]) ctx.addIssue({ code: 'custom', path: [clave], message: 'obligatorio con CORREO_TRANSPORTE=gmail' });
      }
    }
    if (e.NODE_ENV === 'production') {
      if (e.CORREO_TRANSPORTE !== 'gmail') {
        ctx.addIssue({ code: 'custom', path: ['CORREO_TRANSPORTE'], message: 'en producción debe ser gmail' });
      }
      if (e.COOKIE_SECURE === 'false') {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'en producción las cookies exigen HTTPS (true)' });
      }
    }
  })
  .transform((e) => ({
    ...e,
    COOKIE_SECURE: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : e.NODE_ENV === 'production',
    TRUST_PROXY: /^\d+$/.test(e.TRUST_PROXY) ? Number(e.TRUST_PROXY) : e.TRUST_PROXY === 'true',
    ORIGENES: e.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
  }));

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  // `registrarEvento` depende de `env`, así que aquí se escribe la misma línea JSON directamente.
  process.stderr.write(
    JSON.stringify({
      momento: new Date().toISOString(),
      nivel: 'error',
      evento: 'variables_entorno_invalidas',
      ayuda: 'revisa tu archivo .env (usa .env.example como guía)',
      problemas: resultado.error.issues.map((problema) => ({ variable: problema.path.join('.'), mensaje: problema.message })),
    }) + '\n',
  );
  process.exit(1);
}

export const env = resultado.data;
