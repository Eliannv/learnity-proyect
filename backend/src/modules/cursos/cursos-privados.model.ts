export type EstadoCurso =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'PUBLICADO'
  | 'RECHAZADO'
  | 'ARCHIVADO';

export type TipoLeccion =
  | 'DOCUMENTO'
  | 'VIDEO'
  | 'EVALUACION';

export interface ArchivoPdf {
  id: number;
  tipo: 'PDF';
  nombreOriginal: string;
  tamanoBytes: number;
}

export interface LeccionPrivada {
  id: number;
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  archivo: ArchivoPdf | null;
}

export interface ModuloPrivado {
  id: number;
  titulo: string;
  orden: number;
  lecciones: LeccionPrivada[];
}

export interface ProblemaCurso {
  campo: string;
  mensaje: string;
}

export interface CursoResumen {
  id: number;
  titulo: string;
  estado: EstadoCurso;
  motivoRechazo: string | null;
  docente: string;
  modulos: number;
}

export interface CursoDetalle {
  id: number;
  titulo: string;
  subtitulo: string;
  descripcion: string;

  categoriaId: number;
  categoriaNombre: string;

  nivel:
    | 'PRINCIPIANTE'
    | 'INTERMEDIO'
    | 'AVANZADO';

  portadaUrl: string;

  objetivos: string[];
  requisitos: string[];

  estado: EstadoCurso;
  motivoRechazo: string | null;
  docente: string;

  modulos: ModuloPrivado[];

  validacion: {
    completo: boolean;
    problemas: ProblemaCurso[];
  };
}

export type DecisionRevision =
  | {
      decision: 'APROBAR';
    }
  | {
      decision: 'RECHAZAR';
      motivo: string;
    };

export interface ContextoCurso {
  id: number;
  estado: EstadoCurso;
  idPersonaDocente: number;
  docenteActivo: boolean;
}

export interface ContextoLeccion
  extends ContextoCurso {
  leccionId: number;
  tipoLeccion: TipoLeccion;
  archivoId: number | null;
}