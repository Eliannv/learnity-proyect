import { randomUUID } from 'node:crypto';

import type {
  UsuarioSesion,
} from '../../shared/auth/tipos.js';

import { AppError } from '../../shared/http/app-error.js';

import {
  registrarEvento,
} from '../../shared/log/registro.js';

import {
  almacenLocal,
} from '../../shared/archivos/almacen.js';

import {
  NOMBRE_PDF_INTERNO,
  nombreOriginalPdf,
  validarArchivoPdf,
  validarBytesPdf,
} from '../../shared/archivos/pdf-validacion.js';

import {
  cursosService,
} from '../cursos/cursos.service.js';

import {
  contenidoRepository as repo,
} from './contenido.repository.js';

import {
  limpiezaPdfService,
} from './contenido-limpieza.service.js';

// La subida HTTP entrega un temporal en disco (`path`, ADR-011 11.5); quien llame al servicio
// directamente puede entregar los bytes (`buffer`).
interface CargaPdf {
  originalname: string;
  buffer?: Buffer | undefined;
  path?: string | undefined;
}

async function limpiarSinInterrumpir(): Promise<void> {
  try {
    await limpiezaPdfService.limpiarPendientes();
  } catch {
    registrarEvento(
      'archivo.limpieza_pendientes_fallida',
      {},
      'aviso',
    );
  }
}

async function subirValidado(
  id: number,
  carga: CargaPdf,
  original: string,
  usuario: UsuarioSesion,
) {
  let tamano: number;
  let origen: Buffer | { rutaTemporal: string };

  if (carga.path) {
    tamano = await validarArchivoPdf(carga.path);
    origen = { rutaTemporal: carga.path };
  } else {
    await validarBytesPdf(carga.buffer!);
    tamano = carga.buffer!.length;
    origen = carga.buffer!;
  }

  const nombre = randomUUID() + '.pdf';

  // Permite recuperar la limpieza si el proceso
  // se interrumpe después de escribir el archivo.
  await repo.programarNuevo(nombre);

  let resultado;

  try {
    // El archivo definitivo se crea antes de bloquear filas: ninguna E/S de disco con la
    // sección bloqueada (H3). Si la transacción falla, la reserva de `programarNuevo` lo retira.
    await almacenLocal.guardar(nombre, origen);

    resultado =
      await cursosService.conLeccionEditable(
        id,
        usuario,
        async (contexto, cliente) => {
          await repo.bloquearNombre(
            cliente,
            nombre,
          );

          const reserva =
            await repo.reservaVigente(
              cliente,
              nombre,
            );

          if (!reserva) {
            throw AppError.conflicto(
              'La subida tardó demasiado. Selecciona nuevamente el PDF.',
            );
          }

          const anterior = contexto.archivoId
            ? await repo.buscar(
                contexto.archivoId,
                cliente,
              )
            : null;

          if (
            anterior &&
            (
              anterior.idCurso !== contexto.id ||
              anterior.tipo !== 'PDF' ||
              !NOMBRE_PDF_INTERNO.test(
                anterior.ruta,
              )
            )
          ) {
            throw AppError.conflicto(
              'El archivo anterior requiere revisión antes de reemplazarlo.',
            );
          }

          const archivoId = await repo.crear(
            cliente,
            contexto.id,
            original,
            nombre,
            tamano,
          );

          await cursosService.asociarPdfPrincipal(
            cliente,
            contexto,
            archivoId,
          );

          if (anterior) {
            const retirado =
              await repo.retirarSiHuerfano(
                cliente,
                anterior.id,
                contexto.id,
              );

            if (retirado) {
              await repo.programarRetiro(
                cliente,
                retirado,
              );
            }
          }

          await repo.cancelarRetiro(
            cliente,
            nombre,
          );

          return cursosService.detallePrivado(
            cliente,
            contexto.id,
          );
        },
      );
  } catch (error) {
    // Solo adelanta la limpieza si el archivo
    // nuevo no tiene metadatos registrados.
    try {
      await repo.adelantarSiHuerfano(nombre);
    } catch {
      // La reserva permanece para otro intento.
    }

    await limpiarSinInterrumpir();

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      500,
      'No se pudo guardar el PDF. Inténtalo nuevamente.',
      'ERROR_INTERNO',
    );
  }

  await limpiarSinInterrumpir();

  return resultado;
}

export const contenidoService = {
  limpiarPendientes: () =>
    limpiezaPdfService.limpiarPendientes(),

  verificarCarga: (
    id: number,
    usuario: UsuarioSesion,
  ) => cursosService.verificarCarga(id, usuario),

  async subir(
    id: number,
    carga: CargaPdf | undefined,
    usuario: UsuarioSesion,
  ) {
    if (!carga || (!carga.path && !carga.buffer)) {
      throw AppError.solicitudInvalida(
        'Selecciona un archivo PDF.',
        [
          {
            campo: 'archivo',
            mensaje:
              'El campo archivo es obligatorio.',
          },
        ],
      );
    }

    const original = nombreOriginalPdf(
      carga.originalname,
    );

    try {
      return await subirValidado(
        id,
        carga,
        original,
        usuario,
      );
    } finally {
      // Si el temporal ya se movió al nombre definitivo, no hay nada que borrar.
      if (carga.path) {
        await almacenLocal
          .descartarTemporal(carga.path)
          .catch(() => undefined);
      }
    }
  },

  async descargar(
    id: number,
    usuario: UsuarioSesion,
  ) {
    const archivo = await repo.buscar(id);

    if (
      !archivo ||
      archivo.tipo !== 'PDF' ||
      archivo.leccionId === null
    ) {
      throw AppError.noEncontrado(
        'Archivo no encontrado.',
      );
    }

    await cursosService.autorizarLectura(
      archivo.leccionId,
      archivo.idCurso,
      usuario,
    );

    const bytes = await almacenLocal.leer(
      archivo.ruta,
      archivo.tamanoBytes,
    );

    return {
      bytes,
      nombreOriginal: archivo.nombreOriginal,
    };
  },
};