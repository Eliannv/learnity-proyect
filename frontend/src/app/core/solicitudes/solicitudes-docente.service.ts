import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface SolicitudDocente {
  id: number;
  estado: EstadoSolicitud;
  especialidad: string;
  motivo: string;
  observacion: string | null;
  enviadaEn: string;
  revisadaEn: string | null;
  solicitante: {
    nombres: string;
    apellidos: string;
    correo: string;
    estudianteDesde: string;
    cursosCompletados: number;
  };
}

export type DecisionSolicitud = { decision: 'APROBAR' } | { decision: 'RECHAZAR'; observacion: string };

/**
 * RF-05 y RF-22 · Solicitud para ser docente.
 * El estudiante la envía y consulta su estado; el administrador la aprueba o la rechaza.
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
}
