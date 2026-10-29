export interface ActividadMes {
  /** AAAA-MM. */
  mes: string;
  inscripciones: number;
  completados: number;
}

export interface LeccionEmbudo {
  leccionId: number;
  modulo: string;
  titulo: string;
  tipo: 'VIDEO' | 'DOCUMENTO' | 'EVALUACION';
  /** Inscritos que completaron la lección. */
  completaron: number;
}

export interface CursoAnalitica {
  id: number;
  titulo: string;
  inscritos: number;
  completados: number;
}

export interface Analiticas {
  cursos: { id: number; titulo: string }[];
  resumen: {
    inscritos: number;
    completados: number;
    /** Días (dos decimales) entre inscribirse y completar; null si nadie completó. */
    diasPromedioFinalizacion: number | null;
    diasMedianaFinalizacion: number | null;
  };
  /** Últimos 12 meses, incluidos los que no tuvieron movimiento. */
  actividad: ActividadMes[];
  conversion: {
    dias: number;
    /** Vistas de la ficha pública (cada carga cuenta: no son visitantes únicos). */
    visitas: number;
    inscripciones: number;
    /** inscripciones / visitas en %; null sin visitas. */
    tasaPct: number | null;
  };
  /** Solo con un curso elegido: lecciones en el orden del temario. */
  embudo: LeccionEmbudo[] | null;
  /** Solo sin curso elegido: comparación entre los cursos del docente. */
  porCurso: CursoAnalitica[] | null;
}
