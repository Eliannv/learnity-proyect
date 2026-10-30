import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AccesosApi, type AccesoAdmin, type CuentaBloqueada, type PaginaAccesos } from '../../accesos.api';
import { resumirNavegador } from '../../navegador';

type Vista = 'todos' | 'fallidos';

const PASO: Record<AccesoAdmin['paso'], string> = {
  CLAVE: 'Contraseña',
  REFRESH: 'Renovación de sesión',
  RECUPERACION: 'Recuperación',
};

const MOTIVO: Record<AccesoAdmin['motivo'], string> = {
  OK: 'Correcto',
  CLAVE_INCORRECTA: 'Contraseña incorrecta',
  CUENTA_BLOQUEADA: 'Cuenta bloqueada',
  CUENTA_INACTIVA: 'Cuenta desactivada',
  CORREO_DESCONOCIDO: 'Correo no registrado',
  TOKEN_REUTILIZADO: 'Sesión reutilizada',
  TOKEN_INVALIDO: 'Sesión o enlace no válidos',
};

const LIMITE = 20;

/** Registro de inicios de sesión y desbloqueo de cuentas bloqueadas por intentos fallidos. */
@Component({
  selector: 'app-admin-accesos',
  imports: [DatePipe, LucideAngularModule, EstadoVistaComponent],
  templateUrl: './accesos.html',
  styleUrl: './accesos.scss',
})
export class AdminAccesos {
  private readonly api = inject(AccesosApi);
  private readonly toast = inject(ToastService);
  private solicitud = 0;
  private espera: ReturnType<typeof setTimeout> | undefined;

  protected readonly vistas: { valor: Vista; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'fallidos', texto: 'Solo fallidos' },
  ];
  protected readonly paso = PASO;
  protected readonly motivo = MOTIVO;
  protected readonly navegador = resumirNavegador;

  protected readonly vista = signal<Vista>('todos');
  protected readonly busqueda = signal('');
  protected readonly pagina = signal(1);
  protected readonly datos = signal<PaginaAccesos | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly bloqueadas = signal<CuentaBloqueada[] | null>(null);
  protected readonly errorBloqueadas = signal('');
  protected readonly desbloqueando = signal<number | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
    void this.cargarBloqueadas();
    void this.cargar();
  }

  protected elegir(vista: Vista): void {
    this.vista.set(vista);
    this.irA(1);
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

  protected actualizar(): void {
    void this.cargarBloqueadas();
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set('');
    try {
      const datos = await this.api.listar({
        resultado: this.vista(),
        q: this.busqueda().trim() || undefined,
        pagina: this.pagina(),
        limite: LIMITE,
      });
      if (actual === this.solicitud) this.datos.set(datos);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar el registro de accesos'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected async cargarBloqueadas(): Promise<void> {
    this.errorBloqueadas.set('');
    try {
      this.bloqueadas.set(await this.api.bloqueadas());
    } catch (error) {
      this.errorBloqueadas.set(mensajeDeError(error, 'Cargar las cuentas bloqueadas'));
    }
  }

  protected async desbloquear(c: CuentaBloqueada): Promise<void> {
    this.desbloqueando.set(c.idUsuario);
    try {
      await this.api.desbloquear(c.idUsuario);
      this.bloqueadas.update((lista) => lista?.filter((x) => x.idUsuario !== c.idUsuario) ?? null);
      this.toast.exito(`Cuenta de ${c.nombre} desbloqueada. Ya puede iniciar sesión.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Desbloquear la cuenta'));
    } finally {
      this.desbloqueando.set(null);
    }
  }

  /** Minutos que faltan para que el bloqueo venza solo (al menos 1). */
  protected minutosRestantes(hasta: string): number {
    return Math.max(1, Math.ceil((new Date(hasta).getTime() - Date.now()) / 60_000));
  }
}
