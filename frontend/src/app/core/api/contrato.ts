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
export type ColaRevision = { items: CursoResumen[] };

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

export type CategoriaAdmin = Esquemas['CategoriaAdmin'];
export type DatosCategoriaNueva = Esquemas['DatosCategoriaNueva'];
export type DatosCategoria = Esquemas['DatosCategoria'];

export type InstructorPublico = CursoPublicoDetalle['instructor'];
export type CalificacionCurso = Esquemas['CalificacionCurso'];
export type Resena = Esquemas['Resena'];
export type PaginaResenas = Esquemas['PaginaResenas'];
export type MiResena = Esquemas['MiResena'];
export type DatosResena = Esquemas['DatosResena'];
export type RecursoLeccion = Esquemas['RecursoLeccion'];
export type ResenaDocente = Esquemas['ResenaDocente'];
export type BandejaResenas = Esquemas['BandejaResenas'];
export type FiltrosBandejaResenas = NonNullable<paths['/docente/resenas']['get']['parameters']['query']>;
export type DatosReporteResena = Esquemas['DatosReporteResena'];
export type MotivoReporte = DatosReporteResena['motivo'];
export type ReporteResena = Esquemas['ReporteResena'];
export type EstadoReporte = ReporteResena['estado'];
export type EntradaHistorialResena = Esquemas['EntradaHistorialResena'];
export type ResenaAdmin = Esquemas['ResenaAdmin'];
export type PaginaResenasAdmin = Esquemas['PaginaResenasAdmin'];
export type Analiticas = Esquemas['Analiticas'];
export type RecursoAprendizaje = LeccionAprendizaje['recursos'][number];
export type AccesoAdmin = Esquemas['AccesoAdmin'];
export type PaginaAccesos = Esquemas['PaginaAccesos'];
export type CuentaBloqueada = Esquemas['CuentaBloqueada'];
export type ConsultaAccesos = NonNullable<paths['/admin/accesos']['get']['parameters']['query']>;
