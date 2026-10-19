import type { PoolClient } from 'pg';

import {
  enTransaccion,
} from '../../shared/database/pool.js';

import { AppError } from '../../shared/http/app-error.js';

import {
  almacenLocal,
} from '../../shared/archivos/almacen.js';

import {
  NOMBRE_PDF_INTERNO,
} from '../../shared/archivos/pdf-validacion.js';

import {
  contenidoRepository as repo,
} from './contenido.repository.js';

export const limpiezaPdfService = {
  async limpiarPendientes(): Promise<number> {
    let eliminados = 0;

    const pendientes = await repo.pendientes();

    for (const nombre of pendientes) {
      try {
        const retirado = await enTransaccion(
          async cliente => {
            await repo.bloquearNombre(
              cliente,
              nombre,
            );

            const puedeEliminarse =
              await repo.pendienteSinReferencia(
                cliente,
                nombre,
              );

            if (!puedeEliminarse) {
              return false;
            }

            await almacenLocal.eliminar(nombre);

            await repo.cancelarRetiro(
              cliente,
              nombre,
            );

            return true;
          },
        );

        if (retirado) {
          eliminados++;
        }
      } catch {
        console.warn(
          '[PDF] Quedó una limpieza pendiente; se reintentará.',
        );
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
      const archivo = await repo.buscar(
        id,
        cliente,
      );

      if (
        !archivo ||
        archivo.idCurso !== idCurso ||
        archivo.tipo !== 'PDF'
      ) {
        continue;
      }

      if (
        !NOMBRE_PDF_INTERNO.test(archivo.ruta)
      ) {
        throw AppError.conflicto(
          'Un PDF antiguo requiere revisión antes de eliminarlo.',
        );
      }

      const nombre =
        await repo.retirarSiHuerfano(
          cliente,
          id,
          idCurso,
        );

      if (nombre) {
        await repo.programarRetiro(
          cliente,
          nombre,
        );
      }
    }
  },
};