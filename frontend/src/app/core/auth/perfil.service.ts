import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { Perfil } from './sesion.model';

export interface DatosPerfil {
  nombres: string;
  apellidos: string;
  ciudad: string | null;
  biografia: string | null;
}

const fecha = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });

/** "08 feb 2026" para "activa desde…". */
export function fechaCorta(iso: string | null | undefined): string {
  return iso ? fecha.format(new Date(iso)).replace('.', '') : '';
}

/** RF-04 · Perfil de la cuenta (GET/PUT /api/perfil y PUT /api/perfil/contrasena). */
@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/perfil`;

  obtener(): Promise<Perfil> {
    return firstValueFrom(this.http.get<Perfil>(this.api));
  }

  /** Guarda el perfil y actualiza el nombre que se ve en el header. */
  async actualizar(datos: DatosPerfil): Promise<Perfil> {
    const perfil = await firstValueFrom(this.http.put<Perfil>(this.api, datos));
    this.auth.actualizarNombre(perfil.nombres, perfil.apellidos);
    return perfil;
  }

  /** Cambia la contraseña; la API cierra las sesiones de los demás dispositivos. */
  async cambiarContrasena(actual: string, nueva: string): Promise<string> {
    const r = await firstValueFrom(this.http.put<{ mensaje: string }>(`${this.api}/contrasena`, { actual, nueva }));
    return r.mensaje;
  }
}
