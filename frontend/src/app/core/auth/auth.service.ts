import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SESIONES_DEMO } from './demo-sesiones';
import type { DatosRegistro, RespuestaSesion, Rol, Sesion } from './sesion.model';

const API = environment.apiUrl;
/** Renueva el access token un minuto antes de que venza. */
const MARGEN_RENOVACION_MS = 60_000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sesión del usuario en el frontend.
 *  - El access token (JWT de 15 min) vive SOLO en memoria: nada se guarda en localStorage.
 *  - El refresh token está en una cookie HttpOnly que el navegador envía a /api/auth; al recargar la página,
 *    `restaurarSesion` la usa para pedir un access token nuevo.
 *  - Angular envía solo el encabezado X-XSRF-TOKEN (protección CSRF) en refresh y logout.
 * Las pantallas solo leen las señales (usuario, roles, autenticado…); este servicio es el único que habla con /api/auth.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(null);
  private renovando: Promise<boolean> | null = null;
  private temporizador?: ReturnType<typeof setTimeout>;
  /** Avisa a las otras pestañas cuando se cierra la sesión. */
  private readonly canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('learnity-sesion');

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
  readonly token = computed(() => this._sesion()?.accessToken ?? null);
  readonly esDemo = computed(() => this._sesion()?.demo === true);

  constructor() {
    this.canal?.addEventListener('message', (evento: MessageEvent) => {
      if (evento.data === 'cerrada' && this.autenticado()) this.salir();
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
      this.canal?.close();
    });
  }

  tieneRol(rol: Rol): boolean {
    return this.roles().includes(rol);
  }

  /** RF-02 · POST /api/auth/login */
  async iniciarSesion(correo: string, contrasena: string): Promise<void> {
    this.establecer(await firstValueFrom(this.http.post<RespuestaSesion>(`${API}/auth/login`, { correo, contrasena })));
  }

  /** RF-01 · POST /api/auth/registro */
  async registrar(datos: DatosRegistro): Promise<void> {
    this.establecer(await firstValueFrom(this.http.post<RespuestaSesion>(`${API}/auth/registro`, datos)));
  }

  /** RF-06 · POST /api/auth/recuperar */
  async solicitarRecuperacion(correo: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API}/auth/recuperar`, { correo }));
  }

  /**
   * RF-06 · POST /api/auth/restablecer (el token llega en el enlace del correo).
   * El backend cierra todas las sesiones de la cuenta; si este navegador tenía una, también se olvida.
   */
  async restablecerContrasena(token: string, contrasena: string): Promise<string> {
    const r = await firstValueFrom(this.http.post<{ mensaje: string }>(`${API}/auth/restablecer`, { token, contrasena }));
    if (this.autenticado()) {
      this.olvidar();
      this.canal?.postMessage('cerrada');
    }
    return r.mensaje;
  }

  /**
   * Al cargar la aplicación (provideAppInitializer): si el navegador tiene la cookie de sesión,
   * pide un access token nuevo. Sin la cookie XSRF-TOKEN no hay sesión y no se hace la petición.
   */
  async restaurarSesion(): Promise<void> {
    if (!document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))) return;
    await this.renovar();
  }

  /**
   * POST /api/auth/refresh: rota el refresh token (cookie) y trae un access token nuevo.
   * Si varias peticiones lo necesitan a la vez, comparten una sola renovación.
   */
  renovar(): Promise<boolean> {
    this.renovando ??= this.pedirRenovacion().finally(() => (this.renovando = null));
    return this.renovando;
  }

  /** Tras editar el perfil: el header muestra el nombre nuevo sin esperar a la próxima renovación. */
  actualizarNombre(nombres: string, apellidos: string): void {
    this._sesion.update((s) => (s ? { ...s, usuario: { ...s.usuario, nombres, apellidos } } : s));
  }

  /** Tras subir o quitar la foto: el header y los avatares la muestran sin esperar a la renovación. */
  actualizarFoto(fotoUrl: string | null): void {
    this._sesion.update((s) => (s ? { ...s, usuario: { ...s.usuario, fotoUrl } } : s));
  }

  /** Modo demostración: entra con una cuenta simulada (solo en memoria; se pierde al recargar). */
  iniciarDemo(rol: Rol): void {
    this.establecer(SESIONES_DEMO[rol]);
  }

  /** Cierre de sesión real: el backend revoca el refresh token y los access tokens de esta sesión. */
  async cerrarSesion(): Promise<void> {
    if (!this.esDemo()) {
      try {
        await firstValueFrom(this.http.post(`${API}/auth/logout`, null));
      } catch {
        // Aunque falle la red, la sesión se olvida aquí; el refresh token vence solo.
      }
    }
    this.canal?.postMessage('cerrada');
    this.salir();
  }

  /** La API rechazó la sesión y no se pudo renovar: se pide iniciar sesión de nuevo y luego se vuelve aquí. */
  sesionExpirada(): void {
    this.olvidar();
    // Varias peticiones pueden fallar a la vez: solo la primera lleva al login.
    if (this.router.url.startsWith('/login')) return;
    // Si la navegación que falló aún no termina, se vuelve a esa página; si no, a la actual.
    const destino = this.router.currentNavigation()?.finalUrl ?? this.router.currentNavigation()?.extractedUrl;
    const volver = destino ? this.router.serializeUrl(destino) : this.router.url;
    void this.router.navigate(['/login'], { queryParams: { volver, expirada: 1 } });
  }

  /**
   * Pantalla tras iniciar sesión: el inicio personalizado, para todos los roles.
   * Los paneles de Docente y Administración se abren desde el menú de la foto de perfil.
   */
  rutaInicio(): string {
    return '/';
  }

  private async pedirRenovacion(intento = 0): Promise<boolean> {
    try {
      this.establecer(await firstValueFrom(this.http.post<RespuestaSesion>(`${API}/auth/refresh`, null)));
      return true;
    } catch (error) {
      // 409: otra pestaña acaba de renovar; la cookie nueva ya está en el navegador, se reintenta.
      if (error instanceof HttpErrorResponse && error.status === 409 && intento < 2) {
        await esperar(300 * (intento + 1));
        return this.pedirRenovacion(intento + 1);
      }
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) this.olvidar();
      return false;
    }
  }

  private establecer(sesion: Sesion): void {
    this._sesion.set(sesion);
    clearTimeout(this.temporizador);
    if (sesion.demo) return;
    const espera = new Date(sesion.expiraEn).getTime() - Date.now() - MARGEN_RENOVACION_MS;
    this.temporizador = setTimeout(() => void this.renovar(), Math.max(espera, 5_000));
  }

  private olvidar(): void {
    clearTimeout(this.temporizador);
    this._sesion.set(null);
  }

  private salir(): void {
    this.olvidar();
    // 'reload': si ya está en '/', el router vuelve a evaluar canMatch y cambia el inicio
    // personalizado por el público (sin esto la navegación a la misma URL se ignora).
    void this.router.navigateByUrl('/', { onSameUrlNavigation: 'reload' });
  }
}
