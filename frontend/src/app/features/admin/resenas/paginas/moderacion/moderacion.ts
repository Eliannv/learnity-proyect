import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type {
  EntradaHistorialResena, EstadoReporte, MotivoReporte, PaginaResenasAdmin, ReporteResena, ResenaAdmin,
} from '../../../../../core/api/contrato';
import { Peticion } from '../../../../../core/estado/peticion';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { BuscadorCurso } from '../../../../../shared/ui/cursos/buscador-curso';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import { Estrellas } from '../../../../../shared/ui/datos/estrellas';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AdminResenasApi, type EstadoResenasAdmin, type FiltrosResenasAdmin } from '../../resenas.api';

type Vista = 'TODAS' | EstadoReporte;

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'TODAS', texto: 'Todas las reseñas' },
  { valor: 'PENDIENTE', texto: 'Reportes pendientes' },
  { valor: 'OCULTADA', texto: 'Ocultadas' },
  { valor: 'DESESTIMADA', texto: 'Desestimadas' },
];

const ESTADOS: { valor: EstadoResenasAdmin; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'vigentes', texto: 'Visibles en el curso' },
  { valor: 'ocultadas', texto: 'Ocultadas por moderación' },
  { valor: 'borradas', texto: 'Borradas por el estudiante' },
];

const MOTIVO: Record<MotivoReporte, string> = { OFENSIVO: 'Lenguaje ofensivo', SPAM: 'Spam o publicidad', OTRO: 'Otro motivo' };

const ACCION: Record<EntradaHistorialResena['accion'], string> = {
  CREADA: 'Publicó la reseña',
  EDITADA: 'Editó la reseña',
  ELIMINADA: 'Borró la reseña',
  REPUBLICADA: 'Volvió a publicarla',
  RESPONDIDA_POR_DOCENTE: 'El docente respondió',
  OCULTADA: 'Ocultó la reseña',
  RESTAURADA: 'Restauró la reseña',
  RESPUESTA_RETIRADA: 'Retiró la respuesta del docente',
};

const FILTROS_INICIALES: FiltrosResenasAdmin = { estado: 'todas', curso: null, estrellas: null, q: '' };
const MAX_MOTIVO = 300;

/**
 * Reseñas del administrador: acceso total (todas, también las borradas y ocultadas, con su historial completo),
 * filtros, ocultar o restaurar, retirar la respuesta del docente y los reportes de los docentes.
 */
@Component({
  selector: 'app-moderacion-resenas',
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, LucideAngularModule, BuscadorCurso, Esqueleto, Estrellas, Modal],
  templateUrl: './moderacion.html',
  styleUrl: './moderacion.scss',
})
export class ModeracionResenas {
  private readonly api = inject(AdminResenasApi);
  private readonly toasts = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private version = 0;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected readonly vistas = VISTAS;
  protected readonly estados = ESTADOS;
  protected readonly motivo = MOTIVO;
  protected readonly maxMotivo = MAX_MOTIVO;
  protected readonly vista = signal<Vista>('TODAS');
  protected readonly filtros = signal<FiltrosResenasAdmin>(FILTROS_INICIALES);
  protected readonly hayFiltros = computed(() => {
    const f = this.filtros();
    return f.estado !== 'todas' || f.curso !== null || f.estrellas !== null || !!f.q.trim();
  });
  protected readonly carga = new Peticion();
  protected readonly todas = signal<PaginaResenasAdmin | null>(null);
  protected readonly cursos = computed(() => this.todas()?.cursos ?? []);
  protected readonly reportes = signal<ReporteResena[]>([]);
  protected readonly resolviendo = signal<number | null>(null);
  /** Reseña en la que se está actuando (ocultar, restaurar o retirar la respuesta). */
  protected readonly actuando = signal<number | null>(null);

  /** Modal «Ocultar reseña»: la reseña elegida y su motivo. */
  protected readonly aOcultar = signal<ResenaAdmin | null>(null);
  protected motivoOcultacion = '';
  protected readonly ocultacion = new Peticion();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
    // El resumen enlaza con ?vista=PENDIENTE para abrir directamente los reportes pendientes.
    const vista = inject(ActivatedRoute).snapshot.queryParamMap.get('vista');
    if (VISTAS.some((v) => v.valor === vista)) this.vista.set(vista as Vista);
    void this.cargar();
  }

  protected elegir(vista: Vista): void {
    this.vista.set(vista);
    void this.cargar();
  }

  protected filtrar(cambio: Partial<FiltrosResenasAdmin>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
    clearTimeout(this.temporizador);
    void this.cargar();
  }

  /** La búsqueda de texto espera a que se deje de escribir. */
  protected buscar(q: string): void {
    this.filtros.update((f) => ({ ...f, q }));
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.cargar(), 350);
  }

  protected limpiarFiltros(): void {
    this.filtrar(FILTROS_INICIALES);
  }

  protected async cargar(pagina = 1): Promise<void> {
    const version = ++this.version;
    const vista = this.vista();
    this.carga.limpiar();
    this.carga.ocupada.set(true);
    try {
      if (vista === 'TODAS') {
        const datos = await this.api.todas(this.filtros(), pagina);
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
          mensaje: `Dejará de verse y de contar en el promedio de «${r.resena.curso.titulo}», y el estudiante no podrá volver a publicarla. Queda en el historial para auditoría.` }
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

  protected abrirOcultar(r: ResenaAdmin): void {
    this.motivoOcultacion = '';
    this.ocultacion.limpiar();
    this.aOcultar.set(r);
  }

  protected cerrarOcultar(): void {
    if (!this.ocultacion.ocupada()) this.aOcultar.set(null);
  }

  protected async ocultar(): Promise<void> {
    const r = this.aOcultar();
    if (!r || this.ocultacion.ocupada()) return;
    const motivo = this.motivoOcultacion.trim();
    if (!motivo) {
      this.ocultacion.campos.set({ motivo: 'Escribe el motivo de la ocultación.' });
      return;
    }
    await this.ocultacion.ejecutar(
      () => this.api.ocultar(r.id, motivo),
      (actualizada) => {
        this.reemplazar(actualizada);
        this.aOcultar.set(null);
      },
      'Reseña ocultada. Ya no se ve en el curso.',
    );
  }

  protected async restaurar(r: ResenaAdmin): Promise<void> {
    const ok = await this.confirmacion.confirmar({
      titulo: '¿Restaurar esta reseña?', accion: 'Restaurar reseña', icono: 'eye',
      mensaje: `Volverá a verse y a contar en el promedio de «${r.curso.titulo}». La ocultación queda en el historial.`,
    });
    if (ok) await this.actuar(r, () => this.api.restaurar(r.id), 'Reseña restaurada.', 'Restaurar la reseña');
  }

  protected async retirarRespuesta(r: ResenaAdmin): Promise<void> {
    const ok = await this.confirmacion.confirmar({
      titulo: '¿Retirar la respuesta del docente?', accion: 'Retirar respuesta', peligro: true, icono: 'message-square-x',
      mensaje: 'La respuesta dejará de verse en el curso. Su texto y quién la retiró quedan en el historial.',
    });
    if (ok) {
      await this.actuar(r, () => this.api.retirarRespuesta(r.id), 'Respuesta del docente retirada.', 'Retirar la respuesta');
    }
  }

  private async actuar(r: ResenaAdmin, tarea: () => Promise<ResenaAdmin>, exito: string, accion: string): Promise<void> {
    this.actuando.set(r.id);
    try {
      this.reemplazar(await tarea());
      this.toasts.exito(exito);
    } catch (error) {
      this.toasts.error(mensajeDeError(error, accion));
    } finally {
      this.actuando.set(null);
    }
  }

  /** Actualiza la reseña en la lista sin recargar, para no mover al administrador de sitio. */
  private reemplazar(actualizada: ResenaAdmin): void {
    this.todas.update((t) => t && { ...t, items: t.items.map((x) => (x.id === actualizada.id ? actualizada : x)) });
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
