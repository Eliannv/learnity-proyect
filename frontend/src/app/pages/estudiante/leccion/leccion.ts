import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { mensajeDeError } from '../../../core/http/error-api';
import { ContenidoApi } from '../../../features/contenido/contenido.api';
import { ReproductorYoutube } from '../../../features/contenido/componentes/reproductor-youtube';
import { esIdYoutube, type PosicionYoutube } from '../../../features/contenido/youtube';
import {
  AprendizajeApi, idApi, type DetalleAprendizaje, type LeccionAprendizaje,
  type ProgresoGuardado,
} from '../../../features/aprendizaje/aprendizaje.api';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';

@Component({
  selector: 'app-leccion',
  imports: [RouterLink, LucideAngularModule, BarraProgreso, ReproductorYoutube],
  templateUrl: './leccion.html',
  styleUrl: './leccion.scss',
})
export class Leccion {
  readonly cursoId = input.required<string>();
  readonly leccionId = input.required<string>();

  private readonly api = inject(AprendizajeApi);
  private readonly contenido = inject(ContenidoApi);
  private readonly sanitizer = inject(DomSanitizer);
  private solicitud = 0;
  private pdfObjeto: string | null = null;
  private guardandoPosicion = false;
  private posicionPendiente: PosicionYoutube | null = null;

  protected readonly detalle = signal<DetalleAprendizaje | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly noDisponible = signal(false);
  protected readonly reintento = signal(0);
  protected readonly abiertos = signal<number[]>([]);
  protected readonly pdfSeguro = signal<SafeResourceUrl | null>(null);
  protected readonly pdfUrl = signal<string | null>(null);
  protected readonly cargandoPdf = signal(false);
  protected readonly errorPdf = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorProgreso = signal('');
  protected readonly confirmacion = signal('');
  protected readonly todas = computed(() => this.detalle()?.modulos.flatMap((m) => m.lecciones) ?? []);
  protected readonly indice = computed(() => this.todas().findIndex((l) => String(l.id) === this.leccionId()));
  protected readonly leccion = computed(() => this.todas()[this.indice()] ?? null);
  protected readonly modulo = computed(() => this.detalle()?.modulos.find((m) => m.lecciones.some((l) => l.id === this.leccion()?.id)) ?? null);
  protected readonly anterior = computed(() => this.todas()[this.indice() - 1] ?? null);
  protected readonly siguiente = computed(() => this.todas()[this.indice() + 1] ?? null);
  protected readonly videoDisponible = computed(() => esIdYoutube(this.leccion()?.youtubeVideoId));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberarPdf());
    effect(() => {
      const cursoId = this.cursoId();
      const leccionId = this.leccionId();
      this.reintento();
      void this.cargar(cursoId, leccionId);
    });
  }

  private async cargar(cursoTexto: string, leccionTexto: string): Promise<void> {
    const actual = ++this.solicitud;
    const cursoId = idApi(cursoTexto);
    const leccionId = idApi(leccionTexto);
    this.liberarPdf();
    this.detalle.set(null);
    this.error.set('');
    this.errorPdf.set('');
    this.errorProgreso.set('');
    this.confirmacion.set('');
    this.noDisponible.set(false);
    this.cargando.set(true);
    if (!cursoId || !leccionId) {
      this.noDisponible.set(true);
      this.cargando.set(false);
      return;
    }
    try {
      const detalle = await this.api.detalle(cursoId);
      if (actual !== this.solicitud) return;
      const modulo = detalle.modulos.find((m) => m.lecciones.some((l) => l.id === leccionId));
      if (!modulo) {
        this.noDisponible.set(true);
        return;
      }
      this.detalle.set(detalle);
      this.abiertos.set([modulo.id]);
      const leccion = modulo.lecciones.find((l) => l.id === leccionId)!;
      if (leccion.tipo === 'DOCUMENTO' && leccion.archivoId) void this.cargarPdf(leccion.archivoId, actual);
    } catch (error) {
      if (actual !== this.solicitud) return;
      if (error instanceof HttpErrorResponse && error.status === 404) this.noDisponible.set(true);
      else this.error.set(mensajeDeError(error, 'Cargar la lección'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  private async cargarPdf(archivoId: number, actual: number): Promise<void> {
    this.cargandoPdf.set(true);
    this.errorPdf.set('');
    try {
      const blob = await this.contenido.descargarPdf(archivoId);
      if (actual !== this.solicitud) return;
      // Sólo se permite mostrar el blob recién recibido del endpoint autenticado.
      if (blob.size === 0 || (await blob.slice(0, 5).text()) !== '%PDF-') {
        throw new Error('El archivo recibido no es un PDF válido.');
      }
      this.liberarPdf();
      const url = URL.createObjectURL(blob);
      this.pdfObjeto = url;
      this.pdfUrl.set(url);
      this.pdfSeguro.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (error) {
      if (actual === this.solicitud) this.errorPdf.set(mensajeDeError(error, 'Abrir el PDF'));
    } finally {
      if (actual === this.solicitud) this.cargandoPdf.set(false);
    }
  }

  private liberarPdf(): void {
    if (this.pdfObjeto) URL.revokeObjectURL(this.pdfObjeto);
    this.pdfObjeto = null;
    this.pdfUrl.set(null);
    this.pdfSeguro.set(null);
  }

  protected reintentar(): void { this.reintento.update((n) => n + 1); }
  protected reintentarPdf(): void {
    const archivoId = this.leccion()?.archivoId;
    if (archivoId) void this.cargarPdf(archivoId, this.solicitud);
  }
  protected alternar(id: number): void {
    this.abiertos.update((ids) => ids.includes(id) ? ids.filter((n) => n !== id) : [...ids, id]);
  }
  protected icono(tipo: LeccionAprendizaje['tipo']): string { return tipo === 'VIDEO' ? 'play' : 'file-text'; }
  protected ruta(leccion: LeccionAprendizaje): string { return `/aprender/${this.cursoId()}/${leccion.id}`; }
  protected posicionEnModulo(): number {
    return (this.modulo()?.lecciones.findIndex((l) => l.id === this.leccion()?.id) ?? -1) + 1;
  }

  protected async marcarCompletada(): Promise<void> {
    const leccion = this.leccion();
    if (!leccion || leccion.progreso.completada || this.guardando()) return;
    this.guardando.set(true);
    this.errorProgreso.set('');
    this.confirmacion.set('');
    try {
      const resultado = await this.api.guardarProgreso(leccion.id, { completada: true });
      this.aplicar(resultado);
      this.confirmacion.set('Lección completada. Tu avance quedó guardado.');
    } catch (error) {
      this.errorProgreso.set(mensajeDeError(error, 'Guardar el avance'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected registrarPosicion(posicion: PosicionYoutube): void {
    if (posicion.leccionId !== this.leccion()?.id || posicion.videoId !== this.leccion()?.youtubeVideoId) return;
    this.posicionPendiente = posicion;
    if (!this.guardandoPosicion) void this.enviarPosiciones();
  }

  private async enviarPosiciones(): Promise<void> {
    this.guardandoPosicion = true;
    try {
      while (this.posicionPendiente) {
        const muestra = this.posicionPendiente;
        this.posicionPendiente = null;
        try {
          const resultado = await this.api.guardarProgreso(muestra.leccionId, {
            segundosVistos: Math.min(86_400, muestra.segundos),
          });
          if (this.leccion()?.id === muestra.leccionId) this.aplicar(resultado);
          this.errorProgreso.set('');
        } catch (error) {
          if (this.leccion()?.id === muestra.leccionId) this.errorProgreso.set(mensajeDeError(error, 'Guardar la posición'));
        }
      }
    } finally {
      this.guardandoPosicion = false;
    }
  }

  private aplicar(resultado: ProgresoGuardado): void {
    this.detalle.update((actual) => actual ? {
      ...actual,
      inscripcion: {
        ...actual.inscripcion, progresoPct: resultado.progresoPct,
        estado: resultado.estado, ultimaLeccionId: resultado.ultimaLeccionId,
      },
      leccionesCompletadas: actual.leccionesCompletadas +
        (this.todas().find((l) => l.id === resultado.leccionId)?.progreso.completada || !resultado.completada ? 0 : 1),
      modulos: actual.modulos.map((m) => ({
        ...m,
        lecciones: m.lecciones.map((l) => l.id === resultado.leccionId
          ? { ...l, progreso: { segundosVistos: resultado.segundosVistos, completada: resultado.completada } }
          : l),
      })),
    } : null);
  }
}
