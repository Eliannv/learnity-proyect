import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { EstadoSolicitud, SolicitudDocente } from '../api/contrato';

// Tipos generados desde docs/api/openapi.yaml (ADR-008); se reexportan con los nombres de siempre.
export type { EstadoSolicitud, SolicitudDocente } from '../api/contrato';

export type DecisionSolicitud = { decision: 'APROBAR' } | { decision: 'RECHAZAR'; observacion: string };

/**
 * RF-05 y RF-22 · Solicitud para ser docente.
 * El estudiante la envía y consulta su estado; el administrador la aprueba, la rechaza o revoca el rol aprobado.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesDocenteService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  miSolicitud(): Promise<SolicitudDocente | null> {
    return firstValueFrom(
      this.http.get<{ solicitud: SolicitudDocente | null }>(`${this.api}/solicitudes-docente/mia`).pipe(map((r) => r.solicitud)),
    );
  }

  enviar(especialidad: string, motivo: string): Promise<SolicitudDocente> {
    return firstValueFrom(this.http.post<SolicitudDocente>(`${this.api}/solicitudes-docente`, { especialidad, motivo }));
  }

  listar(estado: EstadoSolicitud): Promise<SolicitudDocente[]> {
    return firstValueFrom(this.http.get<SolicitudDocente[]>(`${this.api}/admin/solicitudes`, { params: { estado } }));
  }

  decidir(id: number, decision: DecisionSolicitud): Promise<SolicitudDocente> {
    return firstValueFrom(this.http.put<SolicitudDocente>(`${this.api}/admin/solicitudes/${id}`, decision));
  }

  /** D3 · Retira el rol docente de una solicitud aprobada. Sus cursos publicados siguen publicados. */
  revocar(id: number, motivo: string): Promise<SolicitudDocente> {
    return firstValueFrom(this.http.post<SolicitudDocente>(`${this.api}/admin/solicitudes/${id}/revocacion`, { motivo }));
  }
}
