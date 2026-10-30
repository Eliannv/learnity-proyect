import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { EstadoBaseDatos, PaginaSesiones } from '../../../core/api/contrato';

export type { EstadoBaseDatos, PaginaSesiones, SesionAdmin } from '../../../core/api/contrato';

/** Sesiones abiertas de la plataforma y estado de la base de datos (solo ADMIN). */
@Injectable({ providedIn: 'root' })
export class SesionesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  estadoBaseDatos(): Promise<EstadoBaseDatos> {
    return firstValueFrom(this.http.get<EstadoBaseDatos>(`${this.base}/base-datos`));
  }

  listar(q: string, pagina: number, limite: number): Promise<PaginaSesiones> {
    let params = new HttpParams().set('pagina', pagina).set('limite', limite);
    if (q.trim()) params = params.set('q', q.trim());
    return firstValueFrom(this.http.get<PaginaSesiones>(`${this.base}/sesiones`, { params }));
  }

  /** Cierra la sesión (motivo ADMIN). La propia exige `confirmoPropia`. */
  revocar(id: string, confirmoPropia = false): Promise<void> {
    const params = confirmoPropia ? new HttpParams().set('confirmoPropia', 'true') : undefined;
    return firstValueFrom(this.http.delete<void>(`${this.base}/sesiones/${id}`, { params }));
  }
}
