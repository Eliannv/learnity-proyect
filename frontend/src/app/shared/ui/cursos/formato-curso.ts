/** Textos de los niveles del curso tal como los muestra la interfaz. */
export const NIVEL_TEXTO: Readonly<Record<string, string>> = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

/** «35 min», «1 h», «1 h 20 min»; vacío si el curso aún no tiene duración (no se imprime «0 min»). */
export function duracionCurso(minutos: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutos ?? 0));
  if (!total) return '';
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** «1 lección», «5 lecciones». */
export function leccionesTexto(lecciones: number): string {
  return `${lecciones} ${lecciones === 1 ? 'lección' : 'lecciones'}`;
}

/** Línea de metadatos de un curso: nivel (si se pide), lecciones y duración, separados por « · ». */
export function metaCurso(curso: { lecciones: number; minutos: number; nivel?: string }, conNivel = false): string {
  return [conNivel && curso.nivel ? (NIVEL_TEXTO[curso.nivel] ?? curso.nivel) : '', leccionesTexto(curso.lecciones), duracionCurso(curso.minutos)]
    .filter(Boolean)
    .join(' · ');
}
