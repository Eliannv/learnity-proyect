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
export type VistaPreviaVideo =
  paths['/lecciones/{id}/video-preview']['get']['responses'][200]['content']['application/json'];
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

export type DecisionRevision =
  paths['/admin/cursos/{id}/revision']['put']['requestBody']['content']['application/json'];

export type InscripcionAprendizaje = Esquemas['InscripcionAprendizaje'];
export type CursoInscrito = Esquemas['CursoInscrito'];
export type DetalleAprendizaje = Esquemas['DetalleAprendizaje'];
export type LeccionAprendizaje = Esquemas['LeccionAprendizaje'];
export type ProgresoGuardado = Esquemas['ProgresoGuardado'];
export type SeguimientoDocente = Esquemas['SeguimientoDocente'];
