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

  /** Recurso adjunto de la lección: PDF, PPT, PPTX o ZIP de hasta 10 MiB. */
  subirRecurso(leccionId: number, archivo: File): Promise<CursoDetalle> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return firstValueFrom(this.http.post<CursoDetalle>(`${this.base}/lecciones/${leccionId}/recursos`, datos));
  }

  eliminarRecurso(recursoId: number): Promise<CursoDetalle> {
    return firstValueFrom(this.http.delete<CursoDetalle>(`${this.base}/recursos/${recursoId}`));
  }

  /** PDF principal o recurso adjunto: se descarga con autorización, nunca por una URL pública. */
  descargarPdf(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.base}/archivos/${id}`, {
        responseType: 'blob',
      }),
    );
  }
}
