import type { PoolClient } from 'pg';
import { almacenLocal } from '../../shared/archivos/almacen.js';
import { NOMBRE_ARCHIVO_INTERNO } from '../../shared/archivos/recurso-validacion.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type { LiberadorArchivos } from '../cursos/index.js';
import { contenidoRepository as repo } from './contenido.repository.js';

// Un temporal de subida con más de una hora es de un proceso que cayó a mitad de la recepción.
const EDAD_TEMPORAL_HUERFANO_MS = 60 * 60 * 1000;

export const limpiezaPdfService = {
  async limpiarPendientes(): Promise<number> {
    let eliminados = 0;

    try {
      await almacenLocal.limpiarTemporales(EDAD_TEMPORAL_HUERFANO_MS);
    } catch {
      // Se reintenta en la próxima limpieza; no impide retirar los PDF pendientes.
    }

    const pendientes = await repo.pendientes();

    for (const nombre of pendientes) {
      try {
        const retirado = await enTransaccion(async (cliente) => {
          await repo.bloquearNombre(cliente, nombre);
          const puedeEliminarse = await repo.pendienteSinReferencia(cliente, nombre);
          if (!puedeEliminarse) {
            return false;
          }
          await almacenLocal.eliminar(nombre);
          await repo.cancelarRetiro(cliente, nombre);
          return true;
        });

        if (retirado) {
          eliminados++;
        }
      } catch {
        registrarEvento('archivo.limpieza_reintentar', { archivo: 'pendiente' }, 'aviso');
      }
    }

    return eliminados;
  },

  // Usar dentro de la misma transacción que elimina
  // las lecciones, con el curso ya bloqueado.
  async retirarPdfSinUso(
    cliente: PoolClient,
    idCurso: number,
    ids: number[],
  ): Promise<void> {
    for (const id of new Set(ids)) {
      const archivo = await repo.buscar(id, cliente);

      // PDF principal de una lección o recurso adjunto (PDF, PPT o ZIP). Los vídeos no se gestionan aquí.
      if (!archivo || archivo.idCurso !== idCurso || !['PDF', 'PPT', 'ZIP'].includes(archivo.tipo)) {
        continue;
      }

      if (!NOMBRE_ARCHIVO_INTERNO.test(archivo.ruta)) {
        throw AppError.conflicto('Un archivo antiguo requiere revisión antes de eliminarlo.');
      }

      const nombre = await repo.retirarSiHuerfano(cliente, id, idCurso);
      if (nombre) {
        await repo.programarRetiro(cliente, nombre);
      }
    }
  },
};

/** Implementación del puerto `LiberadorArchivos` definido por `cursos` (ADR-004). */
export const liberadorArchivos: LiberadorArchivos = {
  retirarSinUso: (cliente, idCurso, idsArchivos) =>
    limpiezaPdfService.retirarPdfSinUso(cliente, idCurso, idsArchivos),
  async ejecutarPendientes(): Promise<void> {
    await limpiezaPdfService.limpiarPendientes();
  },
};