import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type {
  EntradaHistorialResena, EstadoReporte, MotivoReporte, PaginaResenasAdmin, ReporteResena,
} from '../../../../core/api/contrato';
import { Peticion } from '../../../../core/estado/peticion';
import { mensajeDeError } from '../../../../core/http/error-api';
import { ConfirmacionService } from '../../../../shared/ui/retroalimentacion/confirmacion.service';
import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { Estrellas } from '../../../../shared/ui/datos/estrellas';
import { ToastService } from '../../../../shared/ui/retroalimentacion/toast.service';
import { AdminResenasApi } from '../../admin-resenas.api';

type Vista = 'TODAS' | EstadoReporte;
type FiltroTodas = 'todas' | 'vigentes' | 'borradas';

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'TODAS', texto: 'Todas las reseñas' },
  { valor: 'PENDIENTE', texto: 'Reportes pendientes' },
  { valor: 'OCULTADA', texto: 'Ocultadas' },
  { valor: 'DESESTIMADA', texto: 'Desestimadas' },
];

const MOTIVO: Record<MotivoReporte, string> = { OFENSIVO: 'Lenguaje ofensivo', SPAM: 'Spam o publicidad', OTRO: 'Otro motivo' };

const ACCION: Record<EntradaHistorialResena['accion'], string> = {
  CREADA: 'Publicó la reseña',
  EDITADA: 'Editó la reseña',
  ELIMINADA: 'Borró la reseña',
  REPUBLICADA: 'Volvió a publicarla',
  RESPONDIDA_POR_DOCENTE: 'El docente respondió',
};

/**
 * Reseñas del administrador: acceso total (todas, también las borradas, con su historial completo)
 * y los reportes de los docentes para decidir si se ocultan.
 */
@Component({
  selector: 'app-reportes-resenas',
  imports: [DatePipe, NgTemplateOutlet, RouterLink, LucideAngularModule, Esqueleto, Estrellas],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
})
export class ReportesResenas {
  private readonly api = inject(AdminResenasApi);
  private readonly toasts = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private version = 0;

  protected readonly vistas = VISTAS;
  protected readonly motivo = MOTIVO;
  protected readonly vista = signal<Vista>('TODAS');
  protected readonly filtroTodas = signal<FiltroTodas>('todas');
  protected readonly carga = new Peticion();
  protected readonly todas = signal<PaginaResenasAdmin | null>(null);
  protected readonly reportes = signal<ReporteResena[]>([]);
  protected readonly resolviendo = signal<number | null>(null);

  constructor() {
    void this.cargar();
  }

  protected elegir(vista: Vista): void {
    this.vista.set(vista);
    void this.cargar();
  }

  protected filtrar(filtro: string): void {
    this.filtroTodas.set(filtro as FiltroTodas);
    void this.cargar();
  }

  protected async cargar(pagina = 1): Promise<void> {
    const version = ++this.version;
    const vista = this.vista();
    this.carga.limpiar();
    this.carga.ocupada.set(true);
    try {
      if (vista === 'TODAS') {
        const datos = await this.api.todas(this.filtroTodas(), pagina);
        if (version === this.version) this.todas.set(datos);
      } else {
        const lista = await this.api.reportes(vista);
        if (version === this.version) this.reportes.set(lista);
      }
    } catch (error) {
      if (version === this.version) this.carga.fallar(error);
    } finally {
      if (version === this.version) this.carga.ocupada.set(false);
    }
  }

  protected async resolver(r: ReporteResena, decision: 'OCULTAR' | 'DESESTIMAR'): Promise<void> {
    const ocultar = decision === 'OCULTAR';
    const ok = await this.confirmacion.confirmar(ocultar
      ? { titulo: '¿Ocultar esta reseña?', accion: 'Ocultar reseña', peligro: true, icono: 'eye-off',
          mensaje: `Dejará de verse y de contar en el promedio de «${r.resena.curso.titulo}». Queda en el historial para auditoría.` }
      : { titulo: '¿Desestimar el reporte?', accion: 'Desestimar reporte', icono: 'circle-check',
          mensaje: 'La reseña sigue publicada sin cambios.' });
    if (!ok) return;
    this.resolviendo.set(r.id);
    try {
      await this.api.resolver(r.id, decision);
      this.reportes.update((lista) => lista.filter((x) => x.id !== r.id));
      this.toasts.exito(ocultar ? 'Reseña ocultada.' : 'Reporte desestimado.');
    } catch (error) {
      this.toasts.error(mensajeDeError(error, 'Resolver el reporte'));
    } finally {
      this.resolviendo.set(null);
    }
  }

  protected textoAccion(h: EntradaHistorialResena): string {
    return ACCION[h.accion];
  }

  protected cambio(h: EntradaHistorialResena): string {
    if (h.estrellasAnterior !== null && h.estrellasNueva !== null && h.estrellasAnterior !== h.estrellasNueva) {
      return `${h.estrellasAnterior} ★ → ${h.estrellasNueva} ★`;
    }
    return h.accion === 'CREADA' || h.accion === 'REPUBLICADA' ? `${h.estrellasNueva} ★` : '';
  }
}
