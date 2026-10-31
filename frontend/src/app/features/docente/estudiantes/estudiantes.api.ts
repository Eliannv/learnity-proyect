import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { SeguimientoDocente } from '../../../core/api/contrato';

/** Filtros de la lista además del curso: categoría, estudiante (nombre o correo) y estado de la inscripción. */
export interface FiltrosSeguimiento {
  categoria: string;
  q: string;
  estado: '' | 'ACTIVA' | 'COMPLETADA';
}

@Injectable({ providedIn: 'root' })
export class SeguimientoDocenteApi {
  private readonly http = inject(HttpClient);

  listar(cursoId: number | null, pagina: number, limite = 20, filtros?: FiltrosSeguimiento): Promise<SeguimientoDocente> {
    let params = new HttpParams().set('pagina', pagina).set('limite', limite);
    if (cursoId !== null) {
      params = params.set('curso', cursoId);
    }
    if (filtros?.categoria.trim()) params = params.set('categoria', filtros.categoria.trim());
    if (filtros?.q.trim()) params = params.set('q', filtros.q.trim());
    if (filtros?.estado) params = params.set('estado', filtros.estado);
    return firstValueFrom(
      this.http.get<SeguimientoDocente>(`${environment.apiUrl}/docente/estudiantes`, { params }),
    );
  }
}
