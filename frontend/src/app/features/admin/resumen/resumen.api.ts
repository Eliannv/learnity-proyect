import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ResumenAdmin } from '../../../core/api/contrato';

export type { ResumenAdmin } from '../../../core/api/contrato';

/** Resumen del panel del administrador: atención rápida e indicadores globales. */
@Injectable({ providedIn: 'root' })
export class ResumenApi {
  private readonly http = inject(HttpClient);

  obtener(): Promise<ResumenAdmin> {
    return firstValueFrom(this.http.get<ResumenAdmin>(`${environment.apiUrl}/admin/resumen`));
  }
}
