import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AlertaSeguridad, ConsultaAlertas, PaginaAlertas, ResultadoAnalisisAlertas,
} from '../../../core/api/contrato';

export type { AlertaSeguridad, ConsultaAlertas, PaginaAlertas, ResultadoAnalisisAlertas } from '../../../core/api/contrato';

/** Alertas de seguridad del administrador: listado, análisis bajo demanda y atención. */
@Injectable({ providedIn: 'root' })
export class AlertasApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/alertas`;

  listar(consulta: ConsultaAlertas): Promise<PaginaAlertas> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null) params = params.set(clave, String(valor));
    }
    return firstValueFrom(this.http.get<PaginaAlertas>(this.base, { params }));
  }

  /** Revisa las últimas 24 horas; lo ya detectado no se duplica. */
  analizar(): Promise<ResultadoAnalisisAlertas> {
    return firstValueFrom(this.http.post<ResultadoAnalisisAlertas>(`${this.base}/analisis`, null));
  }

  atender(id: number, nota: string | null): Promise<AlertaSeguridad> {
    return firstValueFrom(this.http.put<AlertaSeguridad>(`${this.base}/${id}/atencion`, { nota }));
  }
}
