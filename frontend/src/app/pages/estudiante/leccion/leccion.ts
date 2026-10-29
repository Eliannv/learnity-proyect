import { Esqueleto } from '../../../shared/ui/retroalimentacion/esqueleto';
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
  type ProgresoGuardado, type ResultadoIntento,
} from '../../../features/aprendizaje/aprendizaje.api';
import { EvaluacionEstudiante } from '../../../features/aprendizaje/componentes/evaluacion-estudiante';
import { RecursosEstudiante } from '../../../features/aprendizaje/componentes/recursos-estudiante';
import { ResenasCurso } from '../../../features/catalogo/componentes/resenas-curso';
import { BarraProgreso } from '../../../shared/ui/datos/barra-progreso';

const TIPO_TEXTO: Record<LeccionAprendizaje['tipo'], string> = {
  VIDEO: 'Vídeo',
  DOCUMENTO: 'PDF',
  EVALUACION: 'Evaluación',
};

@Component({
  selector: 'app-leccion',
  imports: [Esqueleto, RouterLink, LucideAngularModule, BarraProgreso, ReproductorYoutube, EvaluacionEstudiante, RecursosEstudiante, ResenasCurso],
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
  /** Última posición sin enviar por lección: cambiar de lección no descarta la anterior. */
  private readonly posicionesPendientes = new Map<number, PosicionYoutube>();

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
  protected readonly pestana = signal<'descripcion' | 'recursos'>('descripcion');
  protected readonly sidebarAbierto = signal(true);
  protected readonly descargandoId = signal<number | null>(null);
  protected readonly avisoDescarga = signal('');
  protected readonly todas = computed(() => this.detalle()?.modulos.flatMap((m) => m.lecciones) ?? []);
  protected readonly indice = computed(() => this.todas().findIndex((l) => String(l.id) === this.leccionId()));
  protected readonly leccion = computed(() => this.todas()[this.indice()] ?? null);
  protected readonly modulo = computed(() => this.detalle()?.modulos.find((m) => m.lecciones.some((l) => l.id === this.leccion()?.id)) ?? null);
  protected readonly anterior = computed(() => this.todas()[this.indice() - 1] ?? null);
  protected readonly siguiente = computed(() => this.todas()[this.indice() + 1] ?? null);
  protected readonly videoDisponible = computed(() => esIdYoutube(this.leccion()?.youtubeVideoId));

  protected contenidosDelModulo(moduloId: number) {
    return this.detalle()?.modulos.find((m) => m.id === moduloId)?.lecciones
      .slice().sort((a, b) => a.orden - b.orden) ?? [];
  }

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
      // El PDF es el contenido de un documento o el material de apoyo de un vídeo.
      if (leccion.archivoId) void this.cargarPdf(leccion.archivoId, actual);
      this.pestana.set(leccion.tipo === 'VIDEO' && leccion.archivoId ? 'recursos' : 'descripcion');
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
  protected alternarSidebar(): void {
    this.sidebarAbierto.update((abierto) => !abierto);
  }
  protected async descargarRecurso(leccion: LeccionAprendizaje, evento: Event): Promise<void> {
    evento.preventDefault();
    evento.stopPropagation();
    if (!leccion.archivoId || this.descargandoId() === leccion.archivoId) return;
    this.descargandoId.set(leccion.archivoId);
    this.avisoDescarga.set('');
    try {
      const blob = await this.contenido.descargarPdf(leccion.archivoId);
      if (blob.size === 0) throw new Error('El archivo descargado está vacío.');
      const url = URL.createObjectURL(blob);
      const nombreLimpio = leccion.titulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `leccion-${leccion.id}`;
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${nombreLimpio}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      this.avisoDescarga.set(mensajeDeError(error, 'Descargar el recurso'));
      setTimeout(() => this.avisoDescarga.set(''), 5000);
    } finally {
      this.descargandoId.set(null);
    }
  }
  protected icono(tipo: LeccionAprendizaje['tipo']): string {
    return tipo === 'VIDEO' ? 'play' : tipo === 'EVALUACION' ? 'list-checks' : 'file-text';
  }
  protected tipoTexto(tipo: LeccionAprendizaje['tipo']): string { return TIPO_TEXTO[tipo]; }
  protected completadasDe(moduloId: number): number {
    return this.contenidosDelModulo(moduloId).filter((l) => l.progreso.completada).length;
  }
  protected nivelTexto(nivel: string): string {
    return ({ PRINCIPIANTE: 'Principiante', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado' } as Record<string, string>)[nivel] ?? nivel;
  }
  protected ruta(leccion: LeccionAprendizaje): string { return `/aprender/${this.cursoId()}/${leccion.id}`; }
  protected posicionEnModulo(): number {
    return (this.modulo()?.lecciones.findIndex((l) => l.id === this.leccion()?.id) ?? -1) + 1;
  }

  protected async alternarCompletada(item: LeccionAprendizaje, evento?: Event): Promise<void> {
    if (evento) {
      evento.preventDefault();
      evento.stopPropagation();
    }
    // Una evaluación se completa al aprobarla, no a mano.
    if (this.guardando() || item.tipo === 'EVALUACION') return;
    this.guardando.set(true);
    this.errorProgreso.set('');
    this.confirmacion.set('');
    try {
      const nuevoEstado = !item.progreso.completada;
      const resultado = await this.api.guardarProgreso(item.id, { completada: nuevoEstado });
      this.aplicar(resultado);
      if (nuevoEstado) {
        this.confirmacion.set('Lección completada. Tu avance quedó guardado.');
        setTimeout(() => this.confirmacion.set(''), 4000);
      } else {
        this.confirmacion.set('');
      }
    } catch (error) {
      this.errorProgreso.set(mensajeDeError(error, 'Guardar el avance'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async marcarCompletada(): Promise<void> {
    const l = this.leccion();
    if (l) await this.alternarCompletada(l);
  }

  protected registrarPosicion(posicion: PosicionYoutube): void {
    // Puede llegar justo después de cambiar de lección (al salir del vídeo): vale si es de este curso.
    const leccion = this.todas().find((l) => l.id === posicion.leccionId);
    if (!leccion || leccion.youtubeVideoId !== posicion.videoId) return;
    this.posicionesPendientes.set(posicion.leccionId, posicion);
    if (!this.guardandoPosicion) void this.enviarPosiciones();
  }

  /** Ver el vídeo hasta el final completa la lección (sin deshacer nada si ya lo estaba). */
  protected async alTerminarVideo(fin: { leccionId: number; videoId: string }): Promise<void> {
    const leccion = this.todas().find((l) => l.id === fin.leccionId);
    if (!leccion || leccion.tipo !== 'VIDEO' || leccion.youtubeVideoId !== fin.videoId || leccion.progreso.completada) return;
    try {
      const resultado = await this.api.guardarProgreso(leccion.id, { completada: true });
      this.aplicar(resultado);
      if (this.leccion()?.id === leccion.id) {
        this.confirmacion.set('Terminaste el vídeo: lección completada.');
        setTimeout(() => this.confirmacion.set(''), 4000);
      }
    } catch (error) {
      this.errorProgreso.set(mensajeDeError(error, 'Completar la lección'));
    }
  }

  private async enviarPosiciones(): Promise<void> {
    this.guardandoPosicion = true;
    try {
      for (const [id, muestra] of this.posicionesPendientes) {
        this.posicionesPendientes.delete(id);
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

  /** Un intento aprobado completa la lección; uno suspendido no deshace una aprobación anterior. */
  protected aplicarIntento(resultado: ResultadoIntento): void {
    const l = this.leccion();
    if (!l) return;
    this.aplicar({
      leccionId: l.id, segundosVistos: l.progreso.segundosVistos,
      completada: l.progreso.completada || resultado.intento.aprobado,
      progresoPct: resultado.progresoPct, estado: resultado.estado, ultimaLeccionId: l.id,
    });
  }

  private aplicar(resultado: ProgresoGuardado): void {
    this.detalle.update((actual) => {
      if (!actual) return null;
      const previa = this.todas().find((l) => l.id === resultado.leccionId)?.progreso.completada ?? false;
      const cambio = (resultado.completada ? 1 : 0) - (previa ? 1 : 0);
      return {
        ...actual,
        inscripcion: {
          ...actual.inscripcion,
          progresoPct: resultado.progresoPct,
          estado: resultado.estado,
          ultimaLeccionId: resultado.ultimaLeccionId,
        },
        leccionesCompletadas: Math.max(0, Math.min(actual.totalLecciones, actual.leccionesCompletadas + cambio)),
        modulos: actual.modulos.map((m) => ({
          ...m,
          lecciones: m.lecciones.map((l) => l.id === resultado.leccionId
            ? { ...l, progreso: { segundosVistos: resultado.segundosVistos, completada: resultado.completada } }
            : l),
        })),
      };
    });
  }
}
