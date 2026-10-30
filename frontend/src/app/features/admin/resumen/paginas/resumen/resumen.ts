import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { ResumenApi, type ResumenAdmin } from '../../resumen.api';

/** Una tarjeta de atención rápida: cuántos casos esperan y adónde ir a resolverlos. */
interface Pendiente {
  clave: string;
  titulo: string;
  icono: string;
  ruta: string;
  queryParams?: Record<string, string>;
  cantidad: number;
  /** Texto para el lector de pantalla y el pie de la tarjeta. */
  detalle: string;
  /** Algo urgente dentro del contador (p. ej., alertas de severidad ALTA). */
  urgente?: string;
}

/**
 * Resumen del panel del administrador: primero lo que espera una acción (resaltado si hay casos) y después los
 * indicadores globales de la plataforma.
 */
@Component({
  selector: 'app-admin-resumen',
  imports: [DatePipe, DecimalPipe, RouterLink, LucideAngularModule, EstadoVistaComponent],
  templateUrl: './resumen.html',
  styleUrl: './resumen.scss',
})
export class AdminResumen {
  private readonly api = inject(ResumenApi);

  protected readonly datos = signal<ResumenAdmin | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly pendientes = computed<Pendiente[]>(() => {
    const a = this.datos()?.atencion;
    if (!a) return [];
    return [
      { clave: 'solicitudes', titulo: 'Solicitudes de docente', icono: 'user-check', ruta: '/admin/solicitudes',
        cantidad: a.solicitudesDocente, detalle: a.solicitudesDocente === 1 ? 'pendiente de decidir' : 'pendientes de decidir' },
      { clave: 'revision', titulo: 'Cursos por revisar', icono: 'shield-check', ruta: '/admin/revision',
        cantidad: a.cursosEnRevision, detalle: 'esperando revisión' },
      { clave: 'reportes', titulo: 'Reportes de reseñas', icono: 'flag', ruta: '/admin/resenas', queryParams: { vista: 'PENDIENTE' },
        cantidad: a.reportesResenas, detalle: a.reportesResenas === 1 ? 'reporte pendiente' : 'reportes pendientes' },
      { clave: 'alertas', titulo: 'Alertas de seguridad', icono: 'shield-alert', ruta: '/admin/alertas',
        cantidad: a.alertasSeguridad, detalle: a.alertasSeguridad === 1 ? 'alerta sin atender' : 'alertas sin atender',
        urgente: a.alertasAltas ? `${a.alertasAltas} de severidad alta` : undefined },
      { clave: 'bloqueadas', titulo: 'Cuentas bloqueadas', icono: 'lock', ruta: '/admin/accesos',
        cantidad: a.cuentasBloqueadas, detalle: a.cuentasBloqueadas === 1 ? 'bloqueada ahora' : 'bloqueadas ahora' },
    ];
  });
  protected readonly totalPendientes = computed(() => this.pendientes().reduce((n, p) => n + p.cantidad, 0));

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.datos.set(await this.api.obtener());
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Cargar el resumen'));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Porcentaje entero de `parte` sobre `total` (0 si no hay total). */
  protected porcentaje(parte: number, total: number): number {
    return total ? Math.round((parte * 100) / total) : 0;
  }
}
