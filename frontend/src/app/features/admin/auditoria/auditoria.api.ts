import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ConsultaAuditoria, DetalleCambioAuditoria, OpcionesAuditoria, PaginaAuditoria,
} from '../../../core/api/contrato';

export type {
  CambioAuditoria, ConsultaAuditoria, DetalleCambioAuditoria, OpcionesAuditoria, PaginaAuditoria,
} from '../../../core/api/contrato';

/** Visor de auditoría del administrador (solo lectura). */
@Injectable({ providedIn: 'root' })
export class AuditoriaApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/auditoria`;

  listar(consulta: ConsultaAuditoria): Promise<PaginaAuditoria> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return firstValueFrom(this.http.get<PaginaAuditoria>(this.base, { params }));
  }

  detalle(id: number): Promise<DetalleCambioAuditoria> {
    return firstValueFrom(this.http.get<DetalleCambioAuditoria>(`${this.base}/${id}`));
  }

  opciones(): Promise<OpcionesAuditoria> {
    return firstValueFrom(this.http.get<OpcionesAuditoria>(`${this.base}/opciones`));
  }
}
