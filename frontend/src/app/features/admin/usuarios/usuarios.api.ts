import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ConsultaUsuariosAdmin, RespuestaUsuariosAdmin, RolUsuario, UsuarioAdmin,
} from '../../core/api/contrato';

export type { ConsultaUsuariosAdmin, RespuestaUsuariosAdmin, RolUsuario, UsuarioAdmin } from '../../core/api/contrato';

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

  cambiarEstado(id: number, activo: boolean): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.put<UsuarioAdmin>(`${this.base}/${id}/estado`, { activo }));
  }

  cambiarRoles(id: number, roles: RolUsuario[]): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.put<UsuarioAdmin>(`${this.base}/${id}/roles`, { roles }));
  }
}
