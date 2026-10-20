import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CursoDetalle } from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class ContenidoApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  subirPdf(
    leccionId: number,
    archivo: File,
  ): Observable<HttpEvent<CursoDetalle>> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return this.http.post<CursoDetalle>(
      `${this.base}/lecciones/${leccionId}/archivo`,
      datos,
      {
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  descargarPdf(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.base}/archivos/${id}`, {
        responseType: 'blob',
      }),
    );
  }
}
