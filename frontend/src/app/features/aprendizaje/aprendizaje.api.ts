import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CursoInscrito, DatosIntento, DetalleAprendizaje, EvaluacionEstudiante, InscripcionAprendizaje,
  LeccionAprendizaje, ProgresoGuardado, ResultadoIntento,
} from '../../core/api/contrato';

export type {
  CursoInscrito, DatosIntento, DetalleAprendizaje, EvaluacionEstudiante, InscripcionAprendizaje,
  LeccionAprendizaje, LetraOpcion, ProgresoGuardado, ResultadoIntento,
} from '../../core/api/contrato';

/** Evita enviar IDs mal formados; el servidor sigue siendo la autoridad. */
export function idApi(valor: string | number): number | null {
  const texto = String(valor);
  if (!/^[1-9]\d*$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) && numero <= 2_147_483_647 ? numero : null;
}

@Injectable({ providedIn: 'root' })
export class AprendizajeApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  inscribir(cursoId: number): Promise<InscripcionAprendizaje> {
    return firstValueFrom(this.http.post<InscripcionAprendizaje>(`${this.base}/cursos/${cursoId}/inscripcion`, {}));
  }

  listar(): Promise<{ items: CursoInscrito[] }> {
    return firstValueFrom(this.http.get<{ items: CursoInscrito[] }>(`${this.base}/mi-aprendizaje`));
  }

  detalle(cursoId: number): Promise<DetalleAprendizaje> {
    return firstValueFrom(this.http.get<DetalleAprendizaje>(`${this.base}/mi-aprendizaje/cursos/${cursoId}`));
  }

  guardarProgreso(leccionId: number, datos: { segundosVistos?: number; completada?: boolean }): Promise<ProgresoGuardado> {
    return firstValueFrom(this.http.put<ProgresoGuardado>(`${this.base}/lecciones/${leccionId}/progreso`, datos));
  }

  evaluacion(evaluacionId: number): Promise<EvaluacionEstudiante> {
    return firstValueFrom(this.http.get<EvaluacionEstudiante>(`${this.base}/evaluaciones/${evaluacionId}`));
  }

  /** El servidor califica; el navegador solo envía la opción elegida en cada pregunta. */
  responderEvaluacion(evaluacionId: number, datos: DatosIntento): Promise<ResultadoIntento> {
    return firstValueFrom(this.http.post<ResultadoIntento>(`${this.base}/evaluaciones/${evaluacionId}/intentos`, datos));
  }
}
