import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  BandejaResenas, CalificacionCurso, DatosReporteResena, FiltrosBandejaResenas, ResenaDocente,
} from '../../core/api/contrato';

/** Reseñas de los cursos del docente: el servidor solo entrega las de sus cursos. */
@Injectable({ providedIn: 'root' })
export class DocenteResenasApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/docente`;

  bandeja(filtros: FiltrosBandejaResenas): Promise<BandejaResenas> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null) params = params.set(clave, String(valor));
    }
    return firstValueFrom(this.http.get<BandejaResenas>(`${this.base}/resenas`, { params }));
  }

  /** Promedio global como docente (todas las reseñas vigentes de sus cursos publicados). */
  valoracion(): Promise<CalificacionCurso> {
    return firstValueFrom(this.http.get<CalificacionCurso>(`${this.base}/valoracion`));
  }

  responder(id: number, texto: string): Promise<ResenaDocente> {
    return firstValueFrom(this.http.put<ResenaDocente>(`${this.base}/resenas/${id}/respuesta`, { texto }));
  }

  retirarRespuesta(id: number): Promise<ResenaDocente> {
    return firstValueFrom(this.http.delete<ResenaDocente>(`${this.base}/resenas/${id}/respuesta`));
  }

  reportar(id: number, datos: DatosReporteResena): Promise<ResenaDocente> {
    return firstValueFrom(this.http.post<ResenaDocente>(`${this.base}/resenas/${id}/reporte`, datos));
  }
}
