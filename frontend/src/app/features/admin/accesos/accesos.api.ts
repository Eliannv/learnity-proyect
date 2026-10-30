import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ConsultaAccesos, CuentaBloqueada, PaginaAccesos } from '../../../core/api/contrato';

export type { AccesoAdmin, ConsultaAccesos, CuentaBloqueada, PaginaAccesos } from '../../../core/api/contrato';

/** Registro de accesos y cuentas bloqueadas del administrador. */
@Injectable({ providedIn: 'root' })
export class AccesosApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  listar(consulta: ConsultaAccesos): Promise<PaginaAccesos> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return firstValueFrom(this.http.get<PaginaAccesos>(`${this.base}/admin/accesos`, { params }));
  }

  bloqueadas(): Promise<CuentaBloqueada[]> {
    return firstValueFrom(this.http.get<{ items: CuentaBloqueada[] }>(`${this.base}/admin/accesos/bloqueadas`))
      .then((r) => r.items);
  }

  desbloquear(idUsuario: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/admin/usuarios/${idUsuario}/bloqueo`));
  }
}
