import { contenidoApi } from '../src/modules/contenido/index.js';
import { pool } from '../src/shared/database/pool.js';
import { registrarEvento } from '../src/shared/log/registro.js';

try {
  const cantidad = await contenidoApi.limpiarPendientes();
  registrarEvento('archivos_pdf_retirados', { cantidad });
} finally {
  await pool.end();
}