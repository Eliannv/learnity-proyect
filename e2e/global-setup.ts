import { comprobarEntorno } from '../backend/test/ayudas/guardia-entorno.js';

export default async function globalSetup(): Promise<void> {
  const error = comprobarEntorno(process.env);
  if (error) {
    throw new Error(
      `Guarda E2E (ADR-009): ${error} Ejecuta con NODE_ENV=test y DB_NAME=learnity_test.`
    );
  }
}
