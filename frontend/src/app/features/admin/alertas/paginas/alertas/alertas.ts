import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Peticion } from '../../../../../core/estado/peticion';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AlertasApi, type AlertaSeguridad, type PaginaAlertas } from '../../alertas.api';

type Vista = 'pendientes' | 'atendidas' | 'todas';
type Orden = 'recientes' | 'antiguas';
type Tipo = AlertaSeguridad['tipo'];
type Severidad = AlertaSeguridad['severidad'];

const TIPO: Record<Tipo, string> = {
  INTENTOS_FALLIDOS: 'Intentos fallidos de inicio de sesión',
  CAMBIO_PRIVILEGIOS: 'Cambio de privilegios',
  RAFAGA_RESENAS: 'Ráfaga de reseñas',
  MODIFICACION_MASIVA: 'Modificación masiva de cursos publicados',
};
const SEVERIDAD: Record<Severidad, string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };
const LIMITE = 20;
/** Enlaces de evidencia que se muestran antes de «y N más». */
const MAX_ENLACES = 6;
const MAX_NOTA = 300;

/**
 * Alertas de seguridad: hallazgos de las reglas de la base (038), con su evidencia enlazada al visor de auditoría
 * o al registro de accesos, el análisis bajo demanda y la atención con nota.
 */
@Component({
  selector: 'app-admin-alertas',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, EstadoVistaComponent, Modal],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class AdminAlertas {
  private readonly api = inject(AlertasApi);
  private readonly toast = inject(ToastService);
  private solicitud = 0;

  protected readonly tipos = TIPO;
  protected readonly listaTipos = Object.keys(TIPO) as Tipo[];
  protected readonly severidades = SEVERIDAD;
  protected readonly maxEnlaces = MAX_ENLACES;
  protected readonly maxNota = MAX_NOTA;

  protected readonly vista = signal<Vista>('pendientes');
  protected readonly orden = signal<Orden>('recientes');
  protected readonly severidad = signal<'' | Severidad>('');
  protected readonly tipo = signal<'' | Tipo>('');
  protected readonly pagina = signal(1);
  protected readonly datos = signal<PaginaAlertas | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly analizando = signal(false);

  /** Modal «Marcar atendida». */
  protected readonly aAtender = signal<AlertaSeguridad | null>(null);
  protected nota = '';
  protected readonly atencion = new Peticion();

  constructor() {
    void this.cargar();
  }

  protected ordenar(orden: Orden): void {
    this.orden.set(orden);
    this.pagina.set(1);
    void this.cargar();
  }

  protected elegir(vista: Vista): void {
    this.vista.set(vista);
    this.irA(1);
  }

  protected filtrar(cambio: { severidad?: '' | Severidad; tipo?: '' | Tipo }): void {
    if (cambio.severidad !== undefined) this.severidad.set(cambio.severidad);
    if (cambio.tipo !== undefined) this.tipo.set(cambio.tipo);
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
        estado: this.vista(), orden: this.orden(), severidad: this.severidad() || undefined, tipo: this.tipo() || undefined,
        pagina: this.pagina(), limite: LIMITE,
      });
      if (actual === this.solicitud) this.datos.set(datos);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar las alertas'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected async analizar(): Promise<void> {
    this.analizando.set(true);
    try {
      const { nuevas } = await this.api.analizar();
      this.toast.exito(nuevas
        ? `Análisis completado: ${nuevas} ${nuevas === 1 ? 'alerta nueva' : 'alertas nuevas'}.`
        : 'Análisis completado: no hay hallazgos nuevos en las últimas 24 horas.');
      this.irA(1);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Ejecutar el análisis'));
    } finally {
      this.analizando.set(false);
    }
  }

  protected abrirAtender(a: AlertaSeguridad): void {
    this.nota = '';
    this.atencion.limpiar();
    this.aAtender.set(a);
  }

  protected cerrarAtender(): void {
    if (!this.atencion.ocupada()) this.aAtender.set(null);
  }

  protected async atender(): Promise<void> {
    const a = this.aAtender();
    if (!a) return;
    await this.atencion.ejecutar(
      () => this.api.atender(a.id, this.nota.trim() || null),
      (atendida) => {
        this.aAtender.set(null);
        this.datos.update((d) => d && {
          ...d,
          items: this.vista() === 'pendientes'
            ? d.items.filter((x) => x.id !== atendida.id)
            : d.items.map((x) => (x.id === atendida.id ? atendida : x)),
          paginacion: this.vista() === 'pendientes'
            ? { ...d.paginacion, total: Math.max(0, d.paginacion.total - 1) } : d.paginacion,
          contadores: {
            ...d.contadores,
            pendientes: Math.max(0, d.contadores.pendientes - 1),
            atendidas: d.contadores.atendidas + 1,
          },
        });
      },
      'Alerta marcada como atendida.',
    );
  }
}
