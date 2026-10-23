import { signal } from '@angular/core';
import type { CursoInscrito, CursoPublicoDetalle, CursoResumen, DetalleAprendizaje, SeguimientoDocente } from '../../../core/api/contrato';
import type { Rol, UsuarioSesion } from '../../../core/auth/sesion.model';

export function cursoPublico(id = 8): CursoPublicoDetalle {
  return {
    id, titulo: 'Seguridad de datos ' + id, subtitulo: null, descripcion: 'Un curso real',
    categoria: { id: 3, nombre: 'Tecnología' }, docente: 'Elena', docenteBio: null,
    nivel: 'PRINCIPIANTE', portadaUrl: null, modulos: 1, lecciones: 2, minutos: 10,
    publicadoEn: '2026-10-22T10:00:00Z', estado: 'PUBLICADO', objetivos: [], requisitos: [],
    temario: [{ id: id * 100, orden: 1, titulo: 'Introducción', lecciones: [
      { id: id * 10 + 1, orden: 1, titulo: 'Primera lección real', tipo: 'VIDEO', minutos: 5 },
      { id: id * 10 + 2, orden: 2, titulo: 'Segunda lección real', tipo: 'VIDEO', minutos: 5 },
    ] }],
  };
}
export function cursoInscrito(id = 8): CursoInscrito {
  return {
    curso: { id, titulo: 'Seguridad de datos ' + id, subtitulo: null, portadaUrl: null,
      nivel: 'PRINCIPIANTE', categoria: { id: 3, nombre: 'Tecnología' }, docente: 'Elena' },
    inscripcion: { id, cursoId: id, estado: 'ACTIVA', progresoPct: 50, ultimaLeccionId: id * 10 + 1,
      inscritoEn: '2026-10-22T10:00:00Z', completadoEn: null },
    totalLecciones: 2, leccionesCompletadas: 1,
  };
}
export function detalleAprendizaje(id = 8): DetalleAprendizaje {
  return {
    ...cursoInscrito(id),
    modulos: [{ id: id * 100, orden: 1, titulo: 'Introducción', lecciones: [
      { id: id * 10 + 1, orden: 1, titulo: 'Primera lección real', tipo: 'DOCUMENTO',
        vistaPrevia: false, archivoId: 100 + id, youtubeVideoId: null,
        progreso: { segundosVistos: 0, completada: true } },
      { id: id * 10 + 2, orden: 2, titulo: 'Segunda lección real', tipo: 'VIDEO',
        vistaPrevia: true, archivoId: null, youtubeVideoId: 'dQw4w9WgXcQ',
        progreso: { segundosVistos: 12, completada: false } },
    ] }],
  };
}
export function cursoDocente(id = 8): CursoResumen {
  return { id, titulo: 'Seguridad de datos ' + id, estado: 'PUBLICADO',
    motivoRechazo: null, docente: 'Elena', modulos: 1 };
}
export function seguimientoDocente(id = 8, pagina = 1): SeguimientoDocente {
  return {
    curso: { id, titulo: cursoDocente(id).titulo }, pagina, limite: 20, total: 21, totalPaginas: 2,
    resumen: { inscritos: 21, completados: 3, progresoPromedio: 35 },
    items: [{ idPersona: 80 + id, nombre: 'Estudiante ' + id, estado: 'ACTIVA', progresoPct: 35,
      ultimaLeccionId: id * 10 + 1, inscritoEn: '2026-10-21T10:00:00Z', ultimaActividadEn: '2026-10-22T10:00:00Z' }],
  };
}
export function sesionPrueba(roles: Rol[] | null = ['ESTUDIANTE']) {
  const usuario = signal<UsuarioSesion | null>(roles === null ? null : {
    idUsuario: 1, idPersona: 1, nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.test',
    fotoUrl: null, roles,
  });
  return {
    usuario, autenticado: () => usuario() !== null,
    tieneRol: (rol: Rol) => usuario()?.roles.includes(rol) ?? false,
    sesionExpirada: () => usuario.set(null),
    rutaInicio: () => '/',
  };
}
export function diferido<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}
