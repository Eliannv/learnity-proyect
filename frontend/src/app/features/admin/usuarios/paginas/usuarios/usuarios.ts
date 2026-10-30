import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../../core/auth/auth.service';
import { erroresPorCampo, mensajeDeError } from '../../../../../core/http/error-api';
import { Avatar } from '../../../../../shared/ui/marca/avatar';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AltaUsuario } from '../../componentes/alta-usuario';
import { FichaUsuario, type AccionFicha } from '../../componentes/ficha-usuario';
import {
  AdminUsuariosApi, type DetalleUsuarioAdmin, type NuevoUsuarioAdmin, type RespuestaUsuariosAdmin, type RolUsuario,
  type UsuarioAdmin,
} from '../../usuarios.api';

type FiltroRol = RolUsuario | 'TODOS';
type FiltroEstado = 'ACTIVO' | 'INACTIVO' | 'TODOS';

const NOMBRE_ROL: Record<RolUsuario, string> = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  ADMIN: 'Administrador',
};
const LIMITE = 20;

/**
 * Gestión de cuentas (RF-21): buscar, filtrar, activar o desactivar, asignar roles, crear cuentas por invitación
 * y abrir la ficha de cada una (bloqueo, sesiones abiertas, inscripciones y cursos creados).
 */
@Component({
  selector: 'app-admin-usuarios',
  imports: [DatePipe, LucideAngularModule, Avatar, EstadoVistaComponent, Modal, AltaUsuario, FichaUsuario],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class AdminUsuarios {
  private readonly api = inject(AdminUsuariosApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private solicitud = 0;
  private espera: ReturnType<typeof setTimeout> | undefined;

  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly rolesDisponibles: RolUsuario[] = ['ESTUDIANTE', 'DOCENTE', 'ADMIN'];

  protected readonly busqueda = signal('');
  protected readonly rol = signal<FiltroRol>('TODOS');
  protected readonly estado = signal<FiltroEstado>('TODOS');
  protected readonly pagina = signal(1);

  protected readonly datos = signal<RespuestaUsuariosAdmin | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly ocupadoId = signal<number | null>(null);

  /** Cuenta a la que se le editan los roles, y la selección en curso. */
  protected readonly editando = signal<UsuarioAdmin | null>(null);
  protected readonly rolesElegidos = signal<RolUsuario[]>([]);
  protected readonly errorRoles = signal('');
  /** Cuenta que se va a desactivar, a la espera de confirmación. */
  protected readonly desactivando = signal<UsuarioAdmin | null>(null);

  /** Alta de una cuenta: modal abierto, envío en curso y errores de la API. */
  protected readonly creando = signal(false);
  protected readonly enviandoAlta = signal(false);
  protected readonly erroresAlta = signal<Record<string, string>>({});
  protected readonly errorAlta = signal('');

  /** Ficha abierta: la cuenta de la fila y su detalle cuando llega. */
  protected readonly fichaDe = signal<UsuarioAdmin | null>(null);
  protected readonly ficha = signal<DetalleUsuarioAdmin | null>(null);
  protected readonly errorFicha = signal('');
  protected readonly accionFicha = signal<AccionFicha>(null);

  protected readonly filtrosRol = computed(() => {
    const c = this.datos()?.conteos;
    return [
      { valor: 'TODOS' as const, texto: 'Todos', total: c?.total },
      { valor: 'ESTUDIANTE' as const, texto: 'Estudiantes', total: c?.estudiantes },
      { valor: 'DOCENTE' as const, texto: 'Docentes', total: c?.docentes },
      { valor: 'ADMIN' as const, texto: 'Administradores', total: c?.administradores },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
    void this.cargar();
  }

  protected esYo(u: UsuarioAdmin): boolean {
    return u.idPersona === this.auth.usuario()?.idPersona;
  }

  protected iniciales(u: UsuarioAdmin): string {
    return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase();
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.irA(1), 300);
  }

  protected filtrarRol(valor: FiltroRol): void {
    this.rol.set(valor);
    this.irA(1);
  }

  protected filtrarEstado(valor: FiltroEstado): void {
    this.estado.set(valor);
    this.irA(1);
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
      const datos = await this.api.listar({
        q: this.busqueda().trim() || undefined,
        rol: this.rol() === 'TODOS' ? undefined : (this.rol() as RolUsuario),
        estado: this.estado() === 'TODOS' ? undefined : (this.estado() as 'ACTIVO' | 'INACTIVO'),
        pagina: this.pagina(),
        limite: LIMITE,
      });
      if (actual === this.solicitud) this.datos.set(datos);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar los usuarios'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  /** Reactivar es inmediato; desactivar pide confirmación porque cierra las sesiones de la persona. */
  protected pedirCambioEstado(u: UsuarioAdmin): void {
    if (u.activo) this.desactivando.set(u);
    else void this.cambiarEstado(u, true);
  }

  protected async cambiarEstado(u: UsuarioAdmin, activo: boolean): Promise<void> {
    this.desactivando.set(null);
    this.ocupadoId.set(u.id);
    try {
      const actualizado = await this.api.cambiarEstado(u.id, activo);
      this.reemplazar(actualizado);
      this.toast.exito(activo ? `Cuenta de ${u.nombre} activada.` : `Cuenta de ${u.nombre} desactivada.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cambiar el estado de la cuenta'));
    } finally {
      this.ocupadoId.set(null);
    }
  }

  protected abrirRoles(u: UsuarioAdmin): void {
    this.errorRoles.set('');
    this.rolesElegidos.set([...u.roles]);
    this.editando.set(u);
  }

  protected alternarRol(rol: RolUsuario, marcado: boolean): void {
    this.rolesElegidos.update((roles) => marcado ? [...roles, rol] : roles.filter((r) => r !== rol));
  }

  protected async guardarRoles(): Promise<void> {
    const u = this.editando();
    if (!u) return;
    const roles = this.rolesDisponibles.filter((r) => this.rolesElegidos().includes(r));
    if (!roles.length) {
      this.errorRoles.set('La cuenta debe conservar al menos un rol.');
      return;
    }
    this.ocupadoId.set(u.id);
    try {
      this.reemplazar(await this.api.cambiarRoles(u.id, roles));
      this.editando.set(null);
      this.toast.exito(`Roles de ${u.nombre} actualizados.`);
    } catch (error) {
      this.errorRoles.set(mensajeDeError(error, 'Guardar los roles'));
    } finally {
      this.ocupadoId.set(null);
    }
  }

  protected abrirAlta(): void {
    this.erroresAlta.set({});
    this.errorAlta.set('');
    this.creando.set(true);
  }

  protected async crear(datos: NuevoUsuarioAdmin): Promise<void> {
    this.enviandoAlta.set(true);
    this.erroresAlta.set({});
    this.errorAlta.set('');
    try {
      const nueva = await this.api.crear(datos);
      this.creando.set(false);
      this.toast.exito(`Cuenta de ${nueva.nombre} creada. Le enviamos la invitación a ${nueva.correo}; vence en 72 horas.`);
      void this.cargar();
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      this.erroresAlta.set(porCampo);
      if (!Object.keys(porCampo).length) this.errorAlta.set(mensajeDeError(error, 'Crear la cuenta'));
    } finally {
      this.enviandoAlta.set(false);
    }
  }

  protected abrirFicha(u: UsuarioAdmin): void {
    this.fichaDe.set(u);
    void this.cargarFicha();
  }

  protected cerrarFicha(): void {
    this.fichaDe.set(null);
    this.ficha.set(null);
  }

  protected async cargarFicha(): Promise<void> {
    const u = this.fichaDe();
    if (!u) return;
    this.errorFicha.set('');
    try {
      const detalle = await this.api.detalle(u.id);
      if (this.fichaDe()?.id === u.id) this.ficha.set(detalle);
    } catch (error) {
      if (this.fichaDe()?.id === u.id) this.errorFicha.set(mensajeDeError(error, 'Cargar la ficha'));
    }
  }

  /** Desbloqueo desde la fila o desde la ficha. */
  protected async desbloquear(u: Pick<UsuarioAdmin, 'id' | 'nombre'>): Promise<void> {
    this.accionFicha.set('desbloquear');
    this.ocupadoId.set(u.id);
    try {
      await this.api.desbloquear(u.id);
      this.toast.exito(`Cuenta de ${u.nombre} desbloqueada. Ya puede iniciar sesión.`);
      this.datos.update((d) => d && { ...d, items: d.items.map((x) => x.id === u.id ? { ...x, bloqueadoHasta: null } : x) });
      if (this.fichaDe()?.id === u.id) await this.cargarFicha();
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Desbloquear la cuenta'));
    } finally {
      this.accionFicha.set(null);
      this.ocupadoId.set(null);
    }
  }

  protected async cerrarSesiones(u: Pick<UsuarioAdmin, 'id' | 'nombre'>): Promise<void> {
    const confirmado = await this.confirmacion.confirmar({
      titulo: `¿Cerrar las sesiones de ${u.nombre}?`,
      mensaje: 'Saldrá de Learnity en todos sus dispositivos y tendrá que volver a iniciar sesión. Su cuenta sigue activa.',
      accion: 'Cerrar sesiones',
      peligro: true,
      icono: 'log-out',
    });
    if (!confirmado) return;
    this.accionFicha.set('sesiones');
    try {
      const cerradas = await this.api.cerrarSesiones(u.id);
      this.toast.exito(cerradas === 1 ? `Se cerró 1 sesión de ${u.nombre}.` : `Se cerraron ${cerradas} sesiones de ${u.nombre}.`);
      if (this.fichaDe()?.id === u.id) await this.cargarFicha();
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cerrar las sesiones'));
    } finally {
      this.accionFicha.set(null);
    }
  }

  /** Los conteos por rol cambian al editar roles: se recargan sin perder la página. */
  private reemplazar(actualizado: UsuarioAdmin): void {
    this.datos.update((d) => d && { ...d, items: d.items.map((x) => x.id === actualizado.id ? actualizado : x) });
    void this.cargar();
  }
}
