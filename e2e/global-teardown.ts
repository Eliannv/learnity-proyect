import { rmSync } from 'node:fs';
import { limpiarMarca } from '../backend/test/ayudas/sesiones.js';
import { conFixtures, MARCA, residuos } from './soporte/bd';
import { RAIZ_TMP } from './soporte/entorno';

/** Borra todo lo que creó la ejecución (cuentas, cursos, categorías, solicitudes) y los archivos temporales. */
export default async function globalTeardown(): Promise<void> {
  await conFixtures((f) => limpiarMarca(f, MARCA));
  console.log(`RESIDUOS_TRAS_LIMPIEZA ${JSON.stringify(await residuos())}`);
  rmSync(RAIZ_TMP, { recursive: true, force: true });
}
