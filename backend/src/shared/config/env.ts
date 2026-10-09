import 'dotenv/config';
import { z } from 'zod';

// Valida las variables de entorno al arrancar: si falta algo, el servidor no inicia y dice qué falta.
const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('Variables de entorno inválidas. Revisa tu archivo .env (usa .env.example como guía):');
  for (const problema of resultado.error.issues) {
    console.error(`  - ${problema.path.join('.')}: ${problema.message}`);
  }
  process.exit(1);
}

export const env = resultado.data;
