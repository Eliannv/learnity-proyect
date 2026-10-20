import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { crearMarca } from '../backend/test/ayudas/datos.js';
import { DIR_BUZON, DIR_PDF, PUERTO_API, PUERTO_WEB, URL_API, URL_WEB } from './soporte/entorno';

// Variables de la base de pruebas (backend/.env.test). Se cargan sin imprimirlas ni copiarlas.
// loadEnvFile no pisa lo que ya está definido en el entorno (p. ej. DB_NAME exportado a mano).
process.loadEnvFile(path.resolve(__dirname, '..', 'backend', '.env.test'));
process.env['NODE_ENV'] = 'test';
// Marca única de la ejecución: nombres de persona, títulos y categorías la llevan para limpiar.
process.env['E2E_MARCA'] ??= crearMarca('e2e');

const entornoApi = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PUERTO_API),
  CORS_ORIGIN: URL_WEB,
  FRONTEND_URL: URL_WEB,
  CORREO_TRANSPORTE: 'buzon',
  BUZON_DIR: DIR_BUZON,
  PDF_DIR: DIR_PDF,
  // Sin red en las pruebas: la consulta a Have I Been Pwned queda desactivada solo aquí.
  HIBP_ACTIVO: 'false',
  COOKIE_SECURE: 'false',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/resultado.json' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: URL_WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-EC',
  },
  webServer: [
    {
      // API contra learnity_test. tsx ejecuta el código fuente, igual que `npm run dev` sin el modo watch.
      command: 'npx tsx src/server.ts',
      cwd: path.resolve(__dirname, '..', 'backend'),
      url: `${URL_API}/api/salud`,
      env: entornoApi as Record<string, string>,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Frontend en modo desarrollo con proxy /api → API de pruebas.
      command: `npx ng serve --port ${PUERTO_WEB} --proxy-config ../e2e/proxy.e2e.conf.json`,
      cwd: path.resolve(__dirname, '..', 'frontend'),
      url: URL_WEB,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
