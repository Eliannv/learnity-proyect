export type EstadoCurso =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'PUBLICADO'
  | 'RECHAZADO'
  | 'ARCHIVADO';

export type NivelCurso =
  | 'PRINCIPIANTE'
  | 'INTERMEDIO'
  | 'AVANZADO';

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
  tipo: 'DOCUMENTO' | 'VIDEO' | 'EVALUACION';
  archivo: ArchivoPdf | null;
}

export interface ModuloPrivado {
  id: number;
  titulo: string;
  orden: number;
  lecciones: LeccionPrivada[];
}

export interface CursoResumen {
  id: number;
  titulo: string;
  estado: EstadoCurso;
  motivoRechazo: string | null;
  docente: string;
  modulos: number;
}

export interface DatosCurso {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  categoriaId: number;
  nivel: NivelCurso;
  portadaUrl: string;
  objetivos: string[];
  requisitos: string[];
}

export interface CursoDetalle extends DatosCurso {
  id: number;
  estado: EstadoCurso;
  motivoRechazo: string | null;
  categoriaNombre: string;
  docente: string;
  modulos: ModuloPrivado[];
  validacion: {
    completo: boolean;
    problemas: {
      campo: string;
      mensaje: string;
    }[];
  };
}

export interface DatosModulo {
  titulo: string;
  orden: number;
}

export interface DatosLeccion extends DatosModulo {
  tipo: 'DOCUMENTO';
}

export type DecisionRevision =
  | {
      decision: 'APROBAR';
    }
  | {
      decision: 'RECHAZAR';
      motivo: string;
    };

export function esEditable(estado: EstadoCurso): boolean {
  return estado === 'BORRADOR' || estado === 'RECHAZADO';
}

export function siguienteOrden(
  items: { orden: number }[],
  maximo: number,
): number {
  return (
    Array.from({ length: maximo }, (_, i) => i + 1).find(
      (n) => !items.some((x) => x.orden === n),
    ) ?? 1
  );
}