import { randomUUID } from 'node:crypto';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { almacenLocal } from '../../shared/archivos/almacen.js';
import {
  NOMBRE_PDF_INTERNO,
  nombreOriginalPdf,
  validarArchivoPdf,
  validarBytesPdf,
} from '../../shared/archivos/pdf-validacion.js';
import {
  nombreOriginalRecurso,
  TIPO_MIME,
  tituloRecurso,
  validarArchivoRecurso,
} from '../../shared/archivos/recurso-validacion.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import { cursosApi } from '../cursos/index.js';
import { limpiezaPdfService } from './contenido-limpieza.service.js';
import { contenidoRepository as repo } from './contenido.repository.js';

// La subida HTTP entrega un temporal en disco (`path`, ADR-011 11.5); quien llame al servicio
// directamente puede entregar los bytes (`buffer`).
export interface CargaPdf {
  originalname: string;
  buffer?: Buffer | undefined;
  path?: string | undefined;
}

async function limpiarSinInterrumpir(): Promise<void> {
  try {
    await limpiezaPdfService.limpiarPendientes();
  } catch {
    registrarEvento('archivo.limpieza_pendientes_fallida', {}, 'aviso');
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

    // Los demás PDF del curso se comprueban en disco antes de bloquear (D-01).
    const prevalidados = await cursosApi.prevalidarPdfDeLeccion(id);

    resultado = await cursosApi.conLeccionEditable(
      id,
      usuario,
      async (contexto, cliente) => {
        await repo.bloquearNombre(cliente, nombre);

        const reserva = await repo.reservaVigente(cliente, nombre);
        if (!reserva) {
          throw AppError.conflicto(
            'La subida tardó demasiado. Selecciona nuevamente el PDF.',
          );
        }

        const anterior = contexto.archivoId
          ? await repo.buscar(contexto.archivoId, cliente)
          : null;

        if (
          anterior &&
          (anterior.idCurso !== contexto.id ||
            anterior.tipo !== 'PDF' ||
            !NOMBRE_PDF_INTERNO.test(anterior.ruta))
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

        await cursosApi.asociarPdfPrincipal(cliente, contexto, archivoId);

        if (anterior) {
          const retirado = await repo.retirarSiHuerfano(
            cliente,
            anterior.id,
            contexto.id,
          );
          if (retirado) {
            await repo.programarRetiro(cliente, retirado);
          }
        }

        await repo.cancelarRetiro(cliente, nombre);
        // El PDF nuevo ya se validó al guardarlo: se añade su clave sin volver a leer el disco.
        const conNuevo = new Set(prevalidados).add(`${archivoId}:${nombre}:${tamano}`);
        return cursosApi.detallePrivado(cliente, contexto.id, conNuevo);
      },
    );
  } catch (error) {
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

/**
 * Recurso adjunto de una lección (PDF, PPT o ZIP). Sigue el mismo protocolo que el PDF principal:
 * reserva de limpieza, archivo definitivo antes de bloquear filas y asociación dentro de la transacción.
 */
async function subirRecursoValidado(id: number, carga: CargaPdf & { path: string }, usuario: UsuarioSesion) {
  const nombreRecurso = nombreOriginalRecurso(carga.originalname);
  const tamano = await validarArchivoRecurso(carga.path, nombreRecurso);
  const nombre = randomUUID() + nombreRecurso.extension;

  await repo.programarNuevo(nombre);
  let resultado;
  try {
    await almacenLocal.guardar(nombre, { rutaTemporal: carga.path });
    const prevalidados = await cursosApi.prevalidarPdfDeLeccion(id);

    resultado = await cursosApi.conLeccionEditable(id, usuario, async (contexto, cliente) => {
      await repo.bloquearNombre(cliente, nombre);
      if (!(await repo.reservaVigente(cliente, nombre))) {
        throw AppError.conflicto('La subida tardó demasiado. Selecciona nuevamente el archivo.');
      }
      const archivoId = await repo.crear(cliente, contexto.id, nombreRecurso.original, nombre, tamano, nombreRecurso.tipo);
      await cursosApi.asociarRecurso(cliente, contexto, archivoId, tituloRecurso(nombreRecurso));
      await repo.cancelarRetiro(cliente, nombre);
      const conNuevo = nombreRecurso.tipo === 'PDF'
        ? new Set(prevalidados).add(`${archivoId}:${nombre}:${tamano}`)
        : prevalidados;
      return cursosApi.detallePrivado(cliente, contexto.id, conNuevo);
    });
  } catch (error) {
    try {
      await repo.adelantarSiHuerfano(nombre);
    } catch {
      // La reserva permanece para otro intento.
    }
    await limpiarSinInterrumpir();
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'No se pudo guardar el archivo. Inténtalo nuevamente.', 'ERROR_INTERNO');
  }
  await limpiarSinInterrumpir();
  return resultado;
}

export interface ServicioContenido {
  limpiarPendientes(): Promise<number>;
  verificarCarga(id: number, usuario: UsuarioSesion): Promise<void>;
  subir(id: number, carga: CargaPdf | undefined, usuario: UsuarioSesion): Promise<unknown>;
}

export const contenidoService = {
  limpiarPendientes: () => limpiezaPdfService.limpiarPendientes(),

  verificarCarga: (id: number, usuario: UsuarioSesion) =>
    cursosApi.verificarCarga(id, usuario),

  async subir(
    id: number,
    carga: CargaPdf | undefined,
    usuario: UsuarioSesion,
  ) {
    if (!carga || (!carga.path && !carga.buffer)) {
      throw AppError.solicitudInvalida('Selecciona un archivo PDF.', [
        {
          campo: 'archivo',
          mensaje: 'El campo archivo es obligatorio.',
        },
      ]);
    }

    const original = nombreOriginalPdf(carga.originalname);

    try {
      return await subirValidado(id, carga, original, usuario);
    } finally {
      if (carga.path) {
        await almacenLocal.descartarTemporal(carga.path).catch(() => undefined);
      }
    }
  },

  async subirRecurso(id: number, carga: CargaPdf | undefined, usuario: UsuarioSesion) {
    if (!carga?.path) {
      throw AppError.solicitudInvalida('Selecciona un archivo.', [
        { campo: 'archivo', mensaje: 'El campo archivo es obligatorio.' },
      ]);
    }
    try {
      return await subirRecursoValidado(id, { ...carga, path: carga.path }, usuario);
    } finally {
      await almacenLocal.descartarTemporal(carga.path).catch(() => undefined);
    }
  },

  /** PDF principal o recurso adjunto; quien no puede leerlo recibe 403 o 404 sin pistas del contenido. */
  async descargar(id: number, usuario: UsuarioSesion) {
    const archivo = await repo.buscar(id);

    if (!archivo || !['PDF', 'PPT', 'ZIP'].includes(archivo.tipo) || archivo.leccionId === null) {
      throw AppError.noEncontrado('Archivo no encontrado.');
    }

    await cursosApi.autorizarLectura(archivo.leccionId, archivo.idCurso, archivo.id, usuario);
    const bytes = await almacenLocal.leer(archivo.ruta, archivo.tamanoBytes);

    const extension = archivo.nombreOriginal.slice(archivo.nombreOriginal.lastIndexOf('.')).toLowerCase();
    return {
      bytes,
      nombreOriginal: archivo.nombreOriginal,
      tipoMime: TIPO_MIME[extension] ?? 'application/octet-stream',
    };
  },
};

export const contenidoApi: ServicioContenido = {
  limpiarPendientes: () => contenidoService.limpiarPendientes(),
  verificarCarga: (id, usuario) => contenidoService.verificarCarga(id, usuario),
  subir: (id, carga, usuario) => contenidoService.subir(id, carga, usuario),
};
