import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { RolUsuario } from '../../../../../core/api/contrato';
import { AuthService } from '../../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { resumirNavegador } from '../../../../../shared/util/navegador';
import { ConmutadorSeccion, SECCION_SEGURIDAD } from '../../../../../shared/ui/navegacion/conmutador-seccion';
import { EstadoBd } from '../../componentes/estado-bd';
import { SesionesApi, type PaginaSesiones, type SesionAdmin } from '../../sesiones.api';

const NOMBRE_ROL: Record<RolUsuario, string> = { ESTUDIANTE: 'Estudiante', DOCENTE: 'Docente', ADMIN: 'Administrador' };
const LIMITE = 20;

/** Estado de la base de datos y sesiones abiertas de la plataforma, con cierre de sesiones (motivo ADMIN). */
@Component({
  selector: 'app-admin-sesiones',
  imports: [DatePipe, LucideAngularModule, EstadoVistaComponent, EstadoBd, ConmutadorSeccion],
  templateUrl: './sesiones.html',
  styleUrl: './sesiones.scss',
})
export class AdminSesiones {
  private readonly api = inject(SesionesApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private solicitud = 0;
  private espera: ReturnType<typeof setTimeout> | undefined;

  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly navegador = resumirNavegador;
  protected readonly seccion = SECCION_SEGURIDAD;
  private readonly estadoBd = viewChild(EstadoBd);

  protected readonly busqueda = signal('');
  protected readonly pagina = signal(1);
  protected readonly datos = signal<PaginaSesiones | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly cerrando = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
    this.actualizar();
  }

  protected actualizar(): void {
    void this.estadoBd()?.cargar();
    void this.cargar();
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.irA(1), 300);
  }

  protected irA(pagina: number): void {
    this.pagina.set(pagina);
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set('');
    try {
      const datos = await this.api.listar(this.busqueda(), this.pagina(), LIMITE);
      if (actual === this.solicitud) this.datos.set(datos);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar las sesiones'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  /** Cierra la sesión. Si es la propia, lo advierte y, tras cerrarla, sale de la cuenta. */
  protected async cerrar(s: SesionAdmin): Promise<void> {
    const ok = await this.confirmacion.confirmar(s.actual
      ? {
          titulo: '¿Cerrar tu sesión actual?', accion: 'Cerrar mi sesión', peligro: true, icono: 'log-out',
          mensaje: 'Es la sesión con la que estás usando el panel ahora. Al cerrarla saldrás de tu cuenta y tendrás que volver a iniciar sesión.',
        }
      : {
          titulo: '¿Cerrar esta sesión?', accion: 'Cerrar sesión', peligro: true, icono: 'log-out',
          mensaje: `${s.usuario.nombre} tendrá que volver a iniciar sesión en ${this.navegador(s.agente)}. Sus otras sesiones siguen abiertas.`,
        });
    if (!ok) return;
    this.cerrando.set(s.id);
    try {
      await this.api.revocar(s.id, s.actual);
      if (s.actual) {
        this.toast.exito('Cerraste tu sesión.');
        await this.auth.cerrarSesion();
        return;
      }
      this.datos.update((d) => d && {
        items: d.items.filter((x) => x.id !== s.id),
        paginacion: { ...d.paginacion, total: Math.max(0, d.paginacion.total - 1) },
      });
      this.toast.exito(`Sesión de ${s.usuario.nombre} cerrada.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cerrar la sesión'));
    } finally {
      this.cerrando.set(null);
    }
  }
}
