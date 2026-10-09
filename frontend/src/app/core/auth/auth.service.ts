import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SESIONES_DEMO } from './demo-sesiones';
import type { DatosRegistro, RespuestaSesion, Rol, Sesion } from './sesion.model';

const CLAVE = 'learnity.sesion';

/**
 * Sesión del usuario en el frontend.
 * Las pantallas solo leen las señales (usuario, roles, autenticado…); este servicio
 * es el único que habla con /api/auth.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(leerSesion());

  readonly sesion = this._sesion.asReadonly();
  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly roles = computed<Rol[]>(() => this.usuario()?.roles ?? []);
  readonly esDocente = computed(() => this.roles().includes('DOCENTE'));
  readonly esAdmin = computed(() => this.roles().includes('ADMIN'));
  readonly nombreCompleto = computed(() => {
    const u = this.usuario();
    return u ? `${u.nombres} ${u.apellidos}` : '';
  });
  readonly inicial = computed(() => this.usuario()?.nombres.charAt(0).toUpperCase() ?? '');
  /** "RV" para Rosa Vera: avatar del header y del menú de la cuenta. */
  readonly iniciales = computed(() => {
    const u = this.usuario();
    return u ? `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase() : '';
  });
  /**
   * A dónde lleva el clic en la foto de perfil: el Estudiante va a su perfil (/perfil);
   * Docente y Administrador van directo a su panel, a Ajustes y perfil.
   */
  readonly rutaPerfil = computed(() => {
    if (this.esAdmin()) return '/admin/perfil';
    if (this.esDocente()) return '/docente/perfil';
    return '/perfil';
  });
  readonly token = computed(() => this._sesion()?.token ?? null);
  readonly esDemo = computed(() => this._sesion()?.demo === true);

  tieneRol(rol: Rol): boolean {
    return this.roles().includes(rol);
  }

  /** RF-02 · POST /api/auth/login */
  async iniciarSesion(correo: string, contrasena: string): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaSesion>(`${environment.apiUrl}/auth/login`, { correo, contrasena }),
    );
    this.guardar(respuesta);
  }

  /** RF-01 · POST /api/auth/registro */
  async registrar(datos: DatosRegistro): Promise<void> {
    const respuesta = await firstValueFrom(this.http.post<RespuestaSesion>(`${environment.apiUrl}/auth/registro`, datos));
    this.guardar(respuesta);
  }

  /** RF-06 · POST /api/auth/recuperar */
  async solicitarRecuperacion(correo: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/recuperar`, { correo }));
  }

  /** Modo demostración: entra con una cuenta simulada del rol indicado. */
  iniciarDemo(rol: Rol): void {
    this.guardar(SESIONES_DEMO[rol]);
  }

  cerrarSesion(): void {
    this._sesion.set(null);
    localStorage.removeItem(CLAVE);
    // 'reload': si ya está en '/', el router vuelve a evaluar canMatch y cambia el inicio
    // personalizado por el público (sin esto la navegación a la misma URL se ignora).
    void this.router.navigateByUrl('/', { onSameUrlNavigation: 'reload' });
  }

  /**
   * Pantalla tras iniciar sesión: el inicio personalizado, para todos los roles.
   * Los paneles de Docente y Administración se abren desde el menú de la foto de perfil.
   */
  rutaInicio(): string {
    return '/';
  }

  private guardar(sesion: Sesion): void {
    this._sesion.set(sesion);
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  }
}

function leerSesion(): Sesion | null {
  try {
    const guardada = localStorage.getItem(CLAVE);
    if (!guardada) return null;
    const sesion = JSON.parse(guardada) as Sesion;
    // Si se desactiva el modo demo, las sesiones simuladas dejan de valer.
    if (sesion.demo && !environment.modoDemo) return null;
    return sesion;
  } catch {
    return null;
  }
}
