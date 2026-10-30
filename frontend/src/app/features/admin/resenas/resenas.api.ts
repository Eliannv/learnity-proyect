import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { EstadoReporte, PaginaResenasAdmin, ReporteResena, ResenaAdmin } from '../../../core/api/contrato';

/** vigentes: se ven en el curso; borradas: por su autor; ocultadas: por un administrador. */
export type EstadoResenasAdmin = 'todas' | 'vigentes' | 'borradas' | 'ocultadas';

export interface FiltrosResenasAdmin {
  estado: EstadoResenasAdmin;
  curso: number | null;
  estrellas: number | null;
  /** Parte del nombre de la categoría del curso. */
  categoria: string;
  /** Texto en el comentario o en la respuesta del docente. */
  q: string;
}

/** Moderación de reseñas (solo ADMIN): todas las reseñas, reportes de los docentes, ocultación y respuestas. */
@Injectable({ providedIn: 'root' })
export class AdminResenasApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/resenas`;

  /** Acceso total: todas las reseñas (también las borradas y ocultadas) con su historial. */
  todas(filtros: FiltrosResenasAdmin, pagina: number): Promise<PaginaResenasAdmin> {
    let params = new HttpParams().set('estado', filtros.estado).set('pagina', pagina).set('limite', 20);
    if (filtros.curso !== null) params = params.set('curso', filtros.curso);
    if (filtros.estrellas !== null) params = params.set('estrellas', filtros.estrellas);
    if (filtros.categoria.trim()) params = params.set('categoria', filtros.categoria.trim());
    if (filtros.q.trim()) params = params.set('q', filtros.q.trim());
    return firstValueFrom(this.http.get<PaginaResenasAdmin>(this.base, { params }));
  }

  reportes(estado: EstadoReporte): Promise<ReporteResena[]> {
    return firstValueFrom(this.http.get<ReporteResena[]>(`${this.base}/reportes`, { params: new HttpParams().set('estado', estado) }));
  }

  /** OCULTAR oculta la reseña (se conserva en el historial); DESESTIMAR la deja publicada. */
  resolver(idReporte: number, decision: 'OCULTAR' | 'DESESTIMAR'): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.base}/reportes/${idReporte}`, { decision }));
  }

  /** Oculta una reseña sin reporte previo; el motivo es interno (el estudiante no lo ve). */
  ocultar(idResena: number, motivo: string): Promise<ResenaAdmin> {
    return firstValueFrom(this.http.post<ResenaAdmin>(`${this.base}/${idResena}/ocultacion`, { motivo }));
  }

  restaurar(idResena: number): Promise<ResenaAdmin> {
    return firstValueFrom(this.http.delete<ResenaAdmin>(`${this.base}/${idResena}/ocultacion`));
  }

  retirarRespuesta(idResena: number): Promise<ResenaAdmin> {
    return firstValueFrom(this.http.delete<ResenaAdmin>(`${this.base}/${idResena}/respuesta`));
  }
}
