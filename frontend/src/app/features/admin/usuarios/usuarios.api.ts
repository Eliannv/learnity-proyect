import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ConsultaUsuariosAdmin, DetalleUsuarioAdmin, NuevoUsuarioAdmin, RespuestaUsuariosAdmin, RolUsuario, UsuarioAdmin,
} from '../../../core/api/contrato';

export type {
  ConsultaUsuariosAdmin, DetalleUsuarioAdmin, NuevoUsuarioAdmin, RespuestaUsuariosAdmin, RolUsuario, UsuarioAdmin,
} from '../../../core/api/contrato';

/** Gestión de cuentas del administrador (RF-21). */
@Injectable({ providedIn: 'root' })
export class AdminUsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/usuarios`;

  listar(consulta: ConsultaUsuariosAdmin): Promise<RespuestaUsuariosAdmin> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return firstValueFrom(this.http.get<RespuestaUsuariosAdmin>(this.base, { params }));
  }

  /** Crea la cuenta y envía a la persona un enlace de invitación de 72 h para crear su contraseña. */
  crear(datos: NuevoUsuarioAdmin): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.post<UsuarioAdmin>(this.base, datos));
  }

  detalle(id: number): Promise<DetalleUsuarioAdmin> {
    return firstValueFrom(this.http.get<DetalleUsuarioAdmin>(`${this.base}/${id}`));
  }

  cambiarEstado(id: number, activo: boolean): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.put<UsuarioAdmin>(`${this.base}/${id}/estado`, { activo }));
  }

  cambiarRoles(id: number, roles: RolUsuario[]): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.put<UsuarioAdmin>(`${this.base}/${id}/roles`, { roles }));
  }

  /** Cierra todas las sesiones abiertas de la cuenta. Devuelve cuántas cerró. */
  cerrarSesiones(id: number): Promise<number> {
    return firstValueFrom(this.http.delete<{ cerradas: number }>(`${this.base}/${id}/sesiones`)).then((r) => r.cerradas);
  }

  desbloquear(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}/bloqueo`));
  }

  /** Enlace nuevo de 72 h para una cuenta que aún no entró; invalida el anterior. Devuelve su vencimiento. */
  reenviarInvitacion(id: number): Promise<string> {
    return firstValueFrom(this.http.post<{ invitacionPendienteHasta: string }>(`${this.base}/${id}/invitacion`, {}))
      .then((r) => r.invitacionPendienteHasta);
  }

  /** Borra una cuenta sin actividad (si la tiene, el backend responde 409 con el motivo). */
  eliminar(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
