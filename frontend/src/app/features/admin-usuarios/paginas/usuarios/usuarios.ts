import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { Avatar } from '../../../../shared/ui/avatar';
import { EstadoVistaComponent } from '../../../../shared/ui/estado-vista';
import { Modal } from '../../../../shared/ui/modal';
import { ToastService } from '../../../../shared/ui/toast.service';
import {
  AdminUsuariosApi, type RespuestaUsuariosAdmin, type RolUsuario, type UsuarioAdmin,
} from '../../admin-usuarios.api';

type FiltroRol = RolUsuario | 'TODOS';
type FiltroEstado = 'ACTIVO' | 'INACTIVO' | 'TODOS';

const NOMBRE_ROL: Record<RolUsuario, string> = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  ADMIN: 'Administrador',
};
const LIMITE = 20;

/** Gestión de cuentas (RF-21): buscar, filtrar, activar o desactivar y asignar roles. */
@Component({
  selector: 'app-admin-usuarios',
  imports: [DatePipe, LucideAngularModule, Avatar, EstadoVistaComponent, Modal],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class AdminUsuarios {
  private readonly api = inject(AdminUsuariosApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
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

  /** Los conteos por rol cambian al editar roles: se recargan sin perder la página. */
  private reemplazar(actualizado: UsuarioAdmin): void {
    this.datos.update((d) => d && { ...d, items: d.items.map((x) => x.id === actualizado.id ? actualizado : x) });
    void this.cargar();
  }
}
