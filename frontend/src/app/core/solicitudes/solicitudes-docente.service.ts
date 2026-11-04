import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, map, tap } from 'rxjs';
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
  private readonly http = inject(HttpClient, { optional: true })!;
  private readonly api = environment.apiUrl;

  /** Estado global del modal «Solicitud para ser docente» para abrirlo sin redirigir a /perfil. */
  readonly modalAbierto = signal(false);
  readonly solicitudActual = signal<SolicitudDocente | null>(null);
  private readonly anfitriones = signal<symbol[]>([]);

  abrirModal(): void {
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  registrarAnfitrion(id: symbol): void {
    this.anfitriones.update((lista) => (lista.includes(id) ? lista : [...lista, id]));
  }

  desregistrarAnfitrion(id: symbol): void {
    this.anfitriones.update((lista) => lista.filter((item) => item !== id));
  }

  esAnfitrionActivo(id: symbol): boolean {
    return this.anfitriones()[0] === id;
  }

  miSolicitud(): Promise<SolicitudDocente | null> {
    if (!this.http) return Promise.resolve(this.solicitudActual());
    return firstValueFrom(
      this.http.get<{ solicitud: SolicitudDocente | null }>(`${this.api}/solicitudes-docente/mia`).pipe(
        map((r) => r.solicitud),
        tap((s) => this.solicitudActual.set(s)),
      ),
    );
  }

  enviar(especialidad: string, motivo: string): Promise<SolicitudDocente> {
    return firstValueFrom(
      this.http.post<SolicitudDocente>(`${this.api}/solicitudes-docente`, { especialidad, motivo }).pipe(
        tap((s) => this.solicitudActual.set(s)),
      ),
    );
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
