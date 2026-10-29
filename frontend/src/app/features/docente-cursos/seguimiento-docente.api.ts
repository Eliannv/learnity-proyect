import { HttpClient, HttpParams, type HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SeguimientoDocente } from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class SeguimientoDocenteApi {
  private readonly http = inject(HttpClient);

  listar(cursoId: number, pagina: number, limite = 20): Promise<SeguimientoDocente> {
    const params = new HttpParams().set('pagina', pagina).set('limite', limite);
    return firstValueFrom(
      this.http.get<SeguimientoDocente>(
        `${environment.apiUrl}/docente/cursos/${cursoId}/estudiantes`,
        { params },
      ),
    );
  }

  /** CSV de todos los inscritos (lo arma el servidor, que comprueba que el curso sea propio). */
  async exportar(cursoId: number): Promise<{ blob: Blob; nombre: string }> {
    const respuesta: HttpResponse<Blob> = await firstValueFrom(
      this.http.get(`${environment.apiUrl}/docente/cursos/${cursoId}/estudiantes/exportar`, {
        responseType: 'blob', observe: 'response',
      }),
    );
    const disposicion = respuesta.headers.get('content-disposition') ?? '';
    const nombre = /filename="([^"]+)"/.exec(disposicion)?.[1] ?? `estudiantes-curso-${cursoId}.csv`;
    return { blob: respuesta.body ?? new Blob([]), nombre };
  }
}
