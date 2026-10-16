import {
  contenidoService,
} from '../src/modules/contenido/contenido.service.js';

import {
  pool,
} from '../src/shared/database/pool.js';

try {
  const cantidad =
    await contenidoService.limpiarPendientes();

  console.log('PDF retirados:', cantidad);
} finally {
  await pool.end();
}