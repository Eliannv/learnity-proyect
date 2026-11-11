import type { components, paths } from './generado/esquema';

/**
 * Alias legibles de los tipos generados desde `docs/api/openapi.yaml`
 * (ADR-008). Regenerar con `npm run api:tipos`; no editar `generado/`.
 */
type Esquemas = components['schemas'];

export type ProblemaCampo = Esquemas['ProblemaCampo'];
export type CuerpoErrorApi = Esquemas['ErrorApi'];

export type CategoriaPublica = Esquemas['CategoriaPublica'];
export type CursoPublico = Esquemas['CursoPublico'];
export type CursoPublicoDetalle = Esquemas['CursoPublicoDetalle'];
export type NivelCursoPublico = CursoPublico['nivel'];
export type TipoLeccionPublica =
  CursoPublicoDetalle['temario'][number]['lecciones'][number]['tipo'];
export type ModuloPublico = CursoPublicoDetalle['temario'][number];
export type LeccionPublica = ModuloPublico['lecciones'][number];
export type PaginaCatalogo =
  paths['/cursos']['get']['responses'][200]['content']['application/json'];
export type ConsultaCatalogo = NonNullable<
  paths['/cursos']['get']['parameters']['query']
>;
export type OrdenCatalogo = NonNullable<ConsultaCatalogo['orden']>;

export type DatosCurso = Esquemas['DatosCurso'];
export type DatosModulo = Esquemas['DatosModulo'];
export type DatosLeccion = Esquemas['DatosLeccion'];

export type ArchivoPdf = Esquemas['ArchivoPdf'];
export type LeccionPrivada = Esquemas['LeccionPrivada'];
export type ModuloPrivado = Esquemas['ModuloPrivado'];
export type ValidacionCurso = Esquemas['ValidacionCurso'];
export type CursoResumen = Esquemas['CursoResumen'];
export type CursoDetalle = Esquemas['CursoDetalle'];

export type EstadoCurso = CursoDetalle['estado'];
export type NivelCurso = CursoDetalle['nivel'];

export type ListaCursos =
  paths['/docente/cursos']['get']['responses'][200]['content']['application/json'];
export type CursoDelDocente = Esquemas['CursoDelDocente'];
/** Cola de revisión del administrador: cursos sin los datos de inscritos ni valoración. */
export type CursoRevision = Esquemas['CursoRevision'];
export type EstadoRevision = NonNullable<NonNullable<paths['/admin/cursos']['get']['parameters']['query']>['estado']>;
export type RespuestaRevision = paths['/admin/cursos']['get']['responses'][200]['content']['application/json'];
export type SuspensionCurso = NonNullable<CursoDetalle['suspension']>;

export type DecisionRevision =
  paths['/admin/cursos/{id}/revision']['put']['requestBody']['content']['application/json'];

export type InscripcionAprendizaje = Esquemas['InscripcionAprendizaje'];
export type CursoInscrito = Esquemas['CursoInscrito'];
export type DetalleAprendizaje = Esquemas['DetalleAprendizaje'];
export type LeccionAprendizaje = Esquemas['LeccionAprendizaje'];
export type ProgresoGuardado = Esquemas['ProgresoGuardado'];
export type SeguimientoDocente = Esquemas['SeguimientoDocente'];

export type DatosCuestionario = Esquemas['DatosCuestionario'];
export type CuestionarioDocente = Esquemas['CuestionarioDocente'];
export type LetraOpcion = Esquemas['OpcionEvaluacion']['letra'];
export type EvaluacionEstudiante = Esquemas['EvaluacionEstudiante'];
export type ResumenIntentos = Esquemas['ResumenIntentos'];
export type ResultadoIntento = Esquemas['ResultadoIntento'];
export type DatosIntento =
  paths['/evaluaciones/{id}/intentos']['post']['requestBody']['content']['application/json'];

export type UsuarioAdmin = Esquemas['UsuarioAdmin'];
export type RespuestaUsuariosAdmin = Esquemas['RespuestaUsuariosAdmin'];
export type RolUsuario = UsuarioAdmin['roles'][number];
export type ConsultaUsuariosAdmin = NonNullable<paths['/admin/usuarios']['get']['parameters']['query']>;
export type DetalleUsuarioAdmin = Esquemas['DetalleUsuarioAdmin'];
export type SolicitudDocente = Esquemas['SolicitudDocente'];
export type EstadoSolicitud = SolicitudDocente['estado'];
export type NuevoUsuarioAdmin = Esquemas['NuevoUsuarioAdmin'];

export type CategoriaAdmin = Esquemas['CategoriaAdmin'];
export type DatosCategoriaNueva = Esquemas['DatosCategoriaNueva'];
export type DatosCategoria = Esquemas['DatosCategoria'];

export type InstructorPublico = CursoPublicoDetalle['instructor'];
export type CalificacionCurso = Esquemas['CalificacionCurso'];

export interface HiloRespuesta {
  id: number;
  autor: { nombre: string; fotoUrl: string | null; esDocenteCurso: boolean };
  comentario: string;
  creadoEn: string;
  propia: boolean;
}

export type Resena = Omit<Esquemas['Resena'], 'respuestas'> & {
  respuestas?: HiloRespuesta[];
};
export type PaginaResenas = Omit<Esquemas['PaginaResenas'], 'items'> & {
  items: Resena[];
};
export type MiResena = Esquemas['MiResena'];
export type DatosResena = Esquemas['DatosResena'];
export type RecursoLeccion = Esquemas['RecursoLeccion'];
export type ResenaDocente = Omit<Esquemas['ResenaDocente'], 'respuestas'> & {
  respuestas?: HiloRespuesta[];
};
export type BandejaResenas = Omit<Esquemas['BandejaResenas'], 'items'> & {
  items: ResenaDocente[];
};
export type FiltrosBandejaResenas = NonNullable<paths['/docente/resenas']['get']['parameters']['query']>;
export type DatosReporteResena = Esquemas['DatosReporteResena'];
export type MotivoReporte = DatosReporteResena['motivo'];
export type ReporteResena = Esquemas['ReporteResena'];
export type EstadoReporte = ReporteResena['estado'];
export type EntradaHistorialResena = Esquemas['EntradaHistorialResena'];
export type ResenaAdmin = Omit<Esquemas['ResenaAdmin'], 'respuestas'> & {
  esAutor?: boolean;
  esDocenteCurso?: boolean;
  respuestas?: HiloRespuesta[];
};
export type PaginaResenasAdmin = Omit<Esquemas['PaginaResenasAdmin'], 'items'> & {
  items: ResenaAdmin[];
};
export type Analiticas = Esquemas['Analiticas'];
export type RecursoAprendizaje = LeccionAprendizaje['recursos'][number];
export type AccesoAdmin = Esquemas['AccesoAdmin'];
export type PaginaAccesos = Esquemas['PaginaAccesos'];
export type CuentaBloqueada = Esquemas['CuentaBloqueada'];
export type ConsultaAccesos = NonNullable<paths['/admin/accesos']['get']['parameters']['query']>;
export type CambioAuditoria = Esquemas['CambioAuditoria'];
export type DetalleCambioAuditoria = Esquemas['DetalleCambioAuditoria'];
export type PaginaAuditoria = Esquemas['PaginaAuditoria'];
export type OpcionesAuditoria = Esquemas['OpcionesAuditoria'];
export type ConsultaAuditoria = NonNullable<paths['/admin/auditoria']['get']['parameters']['query']>;
export type EstadoBaseDatos = Esquemas['EstadoBaseDatos'];
export type SesionAdmin = Esquemas['SesionAdmin'];
export type PaginaSesiones = Esquemas['PaginaSesiones'];
export type TipoAlertaSeguridad = Esquemas['AlertaSeguridad']['tipo'] | 'REPORTE_CURSO';
export type AlertaSeguridad = Omit<Esquemas['AlertaSeguridad'], 'tipo' | 'evidencia'> & {
  tipo: TipoAlertaSeguridad;
  evidencia: Esquemas['AlertaSeguridad']['evidencia'] & {
    curso?: number | null;
    cursoTitulo?: string | null;
    motivo?: string | null;
  };
};
export type PaginaAlertas = Omit<Esquemas['PaginaAlertas'], 'items'> & {
  items: AlertaSeguridad[];
};
export type ResultadoAnalisisAlertas = Esquemas['ResultadoAnalisisAlertas'];
export type ConsultaAlertas = Omit<NonNullable<paths['/admin/alertas']['get']['parameters']['query']>, 'tipo'> & {
  tipo?: TipoAlertaSeguridad;
};
export type ResumenAdmin = Esquemas['ResumenAdmin'];
