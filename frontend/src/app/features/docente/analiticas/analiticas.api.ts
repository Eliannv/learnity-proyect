import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Analiticas } from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class DocenteAnaliticasApi {
  private readonly http = inject(HttpClient);

  /** Sin curso: todos los cursos del docente y la comparación entre ellos; con curso: además el embudo. */
  obtener(curso: number | null): Promise<Analiticas> {
    const params = curso === null ? new HttpParams() : new HttpParams().set('curso', curso);
    return firstValueFrom(this.http.get<Analiticas>(`${environment.apiUrl}/docente/analiticas`, { params }));
  }
}
