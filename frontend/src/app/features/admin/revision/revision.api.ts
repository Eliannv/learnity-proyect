import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CursoDetalle,
  DecisionRevision,
  EstadoRevision,
  RespuestaRevision,
} from '../../../core/api/contrato';

export type { CursoRevision, EstadoRevision, RespuestaRevision } from '../../../core/api/contrato';

/** Revisión y gobernanza de cursos del administrador. */
@Injectable({ providedIn: 'root' })
export class RevisionApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Cursos de un estado (pestaña) y cuántos hay en cada estado. */
  listar(estado: EstadoRevision): Promise<RespuestaRevision> {
    return firstValueFrom(
      this.http.get<RespuestaRevision>(`${this.base}/admin/cursos`, {
        params: { estado },
      }),
    );
  }

  detalleAdmin(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.get<CursoDetalle>(`${this.base}/admin/cursos/${id}`),
    );
  }

  decidir(id: number, datos: DecisionRevision): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.put<CursoDetalle>(
        `${this.base}/admin/cursos/${id}/revision`,
        datos,
      ),
    );
  }

  /** PUBLICADO → SUSPENDIDO; `confirmo` es la casilla «Confirmo» marcada. */
  suspender(id: number, motivo: string): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.post<CursoDetalle>(`${this.base}/admin/cursos/${id}/suspension`, { motivo, confirmo: true }),
    );
  }

  /** SUSPENDIDO → PUBLICADO. */
  reactivar(id: number): Promise<CursoDetalle> {
    return firstValueFrom(this.http.delete<CursoDetalle>(`${this.base}/admin/cursos/${id}/suspension`));
  }
}
