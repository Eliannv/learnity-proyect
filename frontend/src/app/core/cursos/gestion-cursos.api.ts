import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

import {
  CursoDetalle,
  CursoResumen,
  DatosCurso,
  DatosLeccion,
  DatosModulo,
  DecisionRevision,
} from './gestion-cursos.model';

@Injectable({ providedIn: 'root' })
export class GestionCursosApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  misCursos(): Promise<{ items: CursoResumen[] }> {
    return firstValueFrom(
      this.http.get<{ items: CursoResumen[] }>(
        `${this.base}/docente/cursos`,
      ),
    );
  }

  detalleDocente(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.get<CursoDetalle>(
        `${this.base}/docente/cursos/${id}`,
      ),
    );
  }

  guardarCurso(
    id: number | null,
    datos: DatosCurso,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      id === null
        ? this.http.post<CursoDetalle>(
            `${this.base}/cursos`,
            datos,
          )
        : this.http.put<CursoDetalle>(
            `${this.base}/cursos/${id}`,
            datos,
          ),
    );
  }

  guardarModulo(
    cursoId: number,
    id: number | null,
    datos: DatosModulo,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      id === null
        ? this.http.post<CursoDetalle>(
            `${this.base}/cursos/${cursoId}/modulos`,
            datos,
          )
        : this.http.put<CursoDetalle>(
            `${this.base}/modulos/${id}`,
            datos,
          ),
    );
  }

  guardarLeccion(
    moduloId: number,
    id: number | null,
    datos: DatosLeccion,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      id === null
        ? this.http.post<CursoDetalle>(
            `${this.base}/modulos/${moduloId}/lecciones`,
            datos,
          )
        : this.http.put<CursoDetalle>(
            `${this.base}/lecciones/${id}`,
            datos,
          ),
    );
  }

  eliminar(
    tipo: 'modulos' | 'lecciones',
    id: number,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.delete<CursoDetalle>(
        `${this.base}/${tipo}/${id}`,
      ),
    );
  }

  enviarRevision(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.post<CursoDetalle>(
        `${this.base}/cursos/${id}/enviar-revision`,
        {},
      ),
    );
  }

  colaRevision(): Promise<{ items: CursoResumen[] }> {
    return firstValueFrom(
      this.http.get<{ items: CursoResumen[] }>(
        `${this.base}/admin/cursos`,
        {
          params: {
            estado: 'EN_REVISION',
          },
        },
      ),
    );
  }

  detalleAdmin(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.get<CursoDetalle>(
        `${this.base}/admin/cursos/${id}`,
      ),
    );
  }

  decidir(
    id: number,
    datos: DecisionRevision,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.put<CursoDetalle>(
        `${this.base}/admin/cursos/${id}/revision`,
        datos,
      ),
    );
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

  descargarPdf(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(
        `${this.base}/archivos/${id}`,
        {
          responseType: 'blob',
        },
      ),
    );
  }
}