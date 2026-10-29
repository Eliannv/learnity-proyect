import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CuestionarioDocente,
  CursoDetalle,
  DatosCuestionario,
  DatosCurso,
  DatosLeccion,
  DatosModulo,
  ListaCursos,
} from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class DocenteCursosApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  misCursos(): Promise<ListaCursos> {
    return firstValueFrom(
      this.http.get<ListaCursos>(`${this.base}/docente/cursos`),
    );
  }

  detalleDocente(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.get<CursoDetalle>(`${this.base}/docente/cursos/${id}`),
    );
  }

  guardarCurso(id: number | null, datos: DatosCurso): Promise<CursoDetalle> {
    return firstValueFrom(
      id === null
        ? this.http.post<CursoDetalle>(`${this.base}/cursos`, datos)
        : this.http.put<CursoDetalle>(`${this.base}/cursos/${id}`, datos),
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
        : this.http.put<CursoDetalle>(`${this.base}/modulos/${id}`, datos),
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
        : this.http.put<CursoDetalle>(`${this.base}/lecciones/${id}`, datos),
    );
  }

  cuestionario(leccionId: number): Promise<CuestionarioDocente> {
    return firstValueFrom(
      this.http.get<CuestionarioDocente>(`${this.base}/docente/lecciones/${leccionId}/evaluacion`),
    );
  }

  guardarCuestionario(leccionId: number, datos: DatosCuestionario): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.put<CursoDetalle>(`${this.base}/lecciones/${leccionId}/evaluacion`, datos),
    );
  }

  eliminar(
    tipo: 'modulos' | 'lecciones',
    id: number,
  ): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.delete<CursoDetalle>(`${this.base}/${tipo}/${id}`),
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
}
