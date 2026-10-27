export type LetraOpcion = 'A' | 'B' | 'C' | 'D';

export interface ResumenIntentos {
  intentos: number;
  mejorPuntaje: number | null;
  ultimoPuntaje: number | null;
  /** Aprobada al menos una vez. */
  aprobada: boolean;
}

/** Evaluación tal como la ve el estudiante: nunca incluye cuál es la opción correcta. */
export interface EvaluacionEstudiante {
  id: number;
  leccionId: number;
  titulo: string;
  porcentajeAprobacion: number;
  preguntas: {
    id: number;
    orden: number;
    enunciado: string;
    opciones: { letra: LetraOpcion; texto: string }[];
  }[];
  resumen: ResumenIntentos;
}

export interface ResultadoIntento {
  intento: {
    id: number;
    puntaje: number;
    aprobado: boolean;
    correctas: number;
    total: number;
    realizadoEn: string;
  };
  /** Si cada respuesta fue correcta; no revela la opción correcta de las falladas. */
  respuestas: { preguntaId: number; opcion: LetraOpcion; correcta: boolean }[];
  resumen: ResumenIntentos;
  progresoPct: number;
  estado: 'ACTIVA' | 'COMPLETADA';
}
