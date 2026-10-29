import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { EstadoReporte, PaginaResenasAdmin, ReporteResena } from '../../../core/api/contrato';

/** Moderación de reseñas reportadas por los docentes (solo ADMIN). */
@Injectable({ providedIn: 'root' })
export class AdminResenasApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/resenas`;

  /** Acceso total: todas las reseñas (también las borradas) con su historial. */
  todas(estado: 'todas' | 'vigentes' | 'borradas', pagina: number): Promise<PaginaResenasAdmin> {
    const params = new HttpParams().set('estado', estado).set('pagina', pagina).set('limite', 20);
    return firstValueFrom(this.http.get<PaginaResenasAdmin>(this.base, { params }));
  }

  reportes(estado: EstadoReporte): Promise<ReporteResena[]> {
    return firstValueFrom(this.http.get<ReporteResena[]>(`${this.base}/reportes`, { params: new HttpParams().set('estado', estado) }));
  }

  /** OCULTAR borra la reseña de forma lógica (se conserva en el historial); DESESTIMAR la deja publicada. */
  resolver(idReporte: number, decision: 'OCULTAR' | 'DESESTIMAR'): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.base}/reportes/${idReporte}`, { decision }));
  }
}
