import type { SeccionPdf } from './pdf.js';

export type Letra = 'A' | 'B' | 'C' | 'D';

export interface Pregunta {
  enunciado: string;
  opciones: [string, string, string, string];
  correcta: Letra;
}

export interface Apunte {
  /** Nombre visible del archivo descargable (con extensión .pdf). */
  archivo: string;
  titulo: string;
  resumen?: string;
  secciones: SeccionPdf[];
}

export type Leccion =
  | { tipo: 'VIDEO'; titulo: string; youtube: string; minutos: number }
  | { tipo: 'DOCUMENTO'; titulo: string; apunte: Apunte; recursos?: Apunte[] }
  | { tipo: 'EVALUACION'; titulo: string; aprobacion: number; preguntas: Pregunta[] };

export interface Modulo {
  titulo: string;
  lecciones: Leccion[];
}

export interface Curso {
  clave: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  nivel: 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
  categoria: string;
  autor: string;
  nombreAutor: string;
  publicadoHaceDias: number;
  objetivos: string[];
  requisitos: string[];
  modulos: Modulo[];
}

export interface Docente {
  correo: string;
  especialidad: string;
  motivo: string;
}

export interface Categoria {
  nombre: string;
  descripcion: string;
  icono: string;
}

export interface Comentario {
  autor: string;
  comentario: string;
  haceDias: number;
}

export interface Actividad {
  curso: string;
  estudiante: string;
  inscritoHaceDias: number;
  /** Lecciones completadas en orden; 'todas' completa el curso. */
  lecciones: number | 'todas';
  resena?: { estrellas: 1 | 2 | 3 | 4 | 5; comentario: string; haceDias: number };
  hilo?: Comentario[];
}
