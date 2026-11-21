import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CargaGrabacion, CursoDetalle } from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class ContenidoApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  async subirGrabacion(
    curso: number,
    archivo: File,
    operacion: string,
    avance: (pct: number) => void,
  ): Promise<string> {
    const carga = await firstValueFrom(
      this.http.post<CargaGrabacion>(`${this.base}/docente/cursos/${curso}/grabaciones`, {
        operacion,
        tamano: archivo.size,
      }),
    );
    const base = `${this.base}/grabaciones/${carga.id}`;
    const partes = Math.ceil(archivo.size / carga.tamanoParte);
    if (!carga.lista) {
      for (let i = carga.siguiente; i < partes; i++) {
        const bloque = archivo.slice(
          i * carga.tamanoParte,
          (i + 1) * carga.tamanoParte,
          'application/octet-stream',
        );
        await firstValueFrom(this.http.put<void>(`${base}/partes/${i}`, bloque));
        avance(Math.floor((100 * (i + 1)) / partes));
      }
      await firstValueFrom(this.http.post(base + '/confirmar', {}));
    }
    return carga.id;
  }

  async autorizarVideo(leccion: number): Promise<string> {
    const url = `${this.base}/lecciones/${leccion}/video`;
    await firstValueFrom(this.http.post<void>(url + '/sesion', {}, { withCredentials: true }));
    return url;
  }

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
