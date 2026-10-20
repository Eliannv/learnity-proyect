import { mkdirSync, rmSync } from 'node:fs';
import { comprobarEntorno } from '../backend/test/ayudas/guardia-entorno.js';
import { DIR_BUZON, DIR_PDF, RAIZ_TMP } from './soporte/entorno';
import { conFixtures } from './soporte/bd';

export default async function globalSetup(): Promise<void> {
  const error = comprobarEntorno(process.env);
  if (error) {
    throw new Error(
      `Guarda E2E (ADR-009): ${error} Ejecuta con NODE_ENV=test y DB_NAME=learnity_test.`
    );
  }
  // Comprueba la base realmente conectada (current_database()) antes de arrancar nada más.
  await conFixtures(async () => undefined);

  rmSync(RAIZ_TMP, { recursive: true, force: true });
  mkdirSync(DIR_PDF, { recursive: true });
  mkdirSync(DIR_BUZON, { recursive: true });
}
