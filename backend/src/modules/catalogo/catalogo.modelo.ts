export type NivelCurso = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export type OrdenCatalogo = 'recientes' | 'populares' | 'az';
export type TipoLeccionPublica = 'VIDEO' | 'DOCUMENTO' | 'EVALUACION';

export interface FiltrosPublicos {
  q?: string | undefined;
  categorias: string[];
  niveles: NivelCurso[];
  orden: OrdenCatalogo;
  pagina: number;
  limite: number;
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
}

export interface CursoPublico {
  id: number;
  titulo: string;
  subtitulo: string | null;
  categoria: CategoriaPublica;
  docente: string;
  nivel: NivelCurso;
  portadaUrl: string | null;
  modulos: number;
  lecciones: number;
  minutos: number;
  publicadoEn: string;
  estado: 'PUBLICADO';
}

export interface LeccionTemarioPublico {
  id: number;
  orden: number;
  titulo: string;
  tipo: TipoLeccionPublica;
  minutos: number;
  vistaPrevia?: {
    reproductorUrl: string;
  };
}

export interface ModuloTemarioPublico {
  id: number;
  orden: number;
  titulo: string;
  lecciones: LeccionTemarioPublico[];
}

export interface CursoPublicoDetalle extends CursoPublico {
  descripcion: string;
  docenteBio: string | null;
  objetivos: string[];
  requisitos: string[];
  temario: ModuloTemarioPublico[];
}
