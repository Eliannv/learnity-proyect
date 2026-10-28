import { DOCUMENT } from '@angular/common';
import {
  Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal,
  untracked, viewChild,
} from '@angular/core';
import { YoutubeApi, type ReproductorYoutubeSdk } from '../youtube-api';
import {
  esIdYoutube, mensajeErrorYoutube, segundosSeguros, tiempoYoutube, type PosicionYoutube,
} from '../youtube';

@Component({
  selector: 'app-reproductor-youtube',
  templateUrl: './reproductor-youtube.html',
  styleUrl: './reproductor-youtube.scss',
  host: {
    '(document:visibilitychange)': 'cambioVisibilidad()',
    '(window:pagehide)': 'antesDeSalir()',
    '(window:offline)': 'sinConexion()',
  },
})
export class ReproductorYoutube implements OnDestroy {
  /** Recibir el ID validado de la respuesta de la API, nunca HTML ni una URL. */
  readonly videoId = input.required<string>();
  /** Identidad de la lección para no mezclar muestras cuando dos lecciones usan el mismo vídeo. */
  readonly leccionId = input<number | null>(null);
  readonly titulo = input('Vídeo de la lección');
  /** Posición confirmada por el servidor. No es un porcentaje de visionado. */
  readonly posicionGuardada = input(0);
  /** false para la vista previa pública: no emite seguimiento. */
  readonly observarPosicion = input(false);
  /** Colores para el escenario oscuro de la lección. */
  readonly oscuro = input(false);
  readonly posicion = output<PosicionYoutube>();
  readonly fallo = output<string>();
  readonly listo = output<void>();
  /** El estudiante vio el vídeo hasta el final (solo con observarPosicion). */
  readonly terminado = output<{ leccionId: number; videoId: string }>();

  protected readonly estado = signal<'inicial' | 'cargando' | 'listo' | 'error'>('inicial');
  protected readonly error = signal('');
  protected readonly lenta = signal(false);
  protected readonly idValido = computed(() => esIdYoutube(this.videoId()));
  protected readonly guardada = computed(() => segundosSeguros(this.posicionGuardada()));
  protected readonly tiempoGuardado = computed(() => tiempoYoutube(this.guardada()));

  private readonly api = inject(YoutubeApi);
  private readonly documento = inject(DOCUMENT);
  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');
  private reproductor?: ReproductorYoutubeSdk;
  private videoActivo = '';
  private leccionActiva: number | null = null;
  private version = 0;
  private destruido = false;
  private huboReproduccion = false;
  private intervalo?: ReturnType<typeof setInterval>;
  private limiteCarga?: ReturnType<typeof setTimeout>;
  private limiteBuffer?: ReturnType<typeof setTimeout>;
  private diferido?: ReturnType<typeof setTimeout>;
  private pendiente?: PosicionYoutube;
  private ultima?: PosicionYoutube;
  private ultimoAviso = -Infinity;

  constructor() {
    effect(() => {
      const id = this.videoId();
      const leccionId = this.leccionId();
      untracked(() => {
        this.liberar();
        this.videoActivo = id;
        this.leccionActiva = leccionId;
        this.estado.set('inicial');
        this.error.set('');
        this.lenta.set(false);
        // El vídeo se carga solo: ni el docente ni el estudiante tienen que pulsar nada para verlo.
        if (esIdYoutube(id)) void this.cargar();
      });
    });
  }

  protected async cargar(): Promise<void> {
    if (!this.idValido() || this.destruido || this.estado() === 'cargando') return;
    this.liberar();
    this.videoActivo = this.videoId();
    this.leccionActiva = this.leccionId();
    const id = this.videoActivo;
    const version = this.version;
    const vigente = () => !this.destruido && version === this.version;
    this.estado.set('cargando');
    this.error.set('');
    this.lenta.set(false);
    try {
      const sdk = await this.api.cargar();
      if (!vigente()) return;
      const origen = this.documento.defaultView?.location.origin;
      if (!origen || origen === 'null') throw new Error('Abre Learnity desde su dirección web.');
      const destino = this.documento.createElement('div');
      this.contenedor().nativeElement.replaceChildren(destino);
      this.limiteCarga = setTimeout(() => {
        if (vigente()) this.mostrarError('El vídeo tarda demasiado en cargar. Comprueba tu conexión y reintenta.');
      }, 20_000);
      this.reproductor = new sdk.Player(destino, {
        videoId: id,
        width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
        playerVars: { origin: origen, autoplay: 0, controls: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: ({ target }) => {
            if (!vigente()) return;
            clearTimeout(this.limiteCarga);
            target.getIframe().title = this.titulo();
            target.getIframe().referrerPolicy = 'strict-origin-when-cross-origin';
            this.estado.set('listo');
            this.listo.emit();
          },
          onStateChange: ({ data }) => { if (vigente()) this.cambioEstado(data); },
          onError: ({ data }) => { if (vigente()) this.mostrarError(mensajeErrorYoutube(data)); },
        },
      });
    } catch (error) {
      if (vigente()) this.mostrarError(error instanceof Error ? error.message : mensajeErrorYoutube(-1));
    }
  }

  protected reanudar(): void {
    if (this.estado() !== 'listo' || !this.reproductor) return;
    const duracion = this.reproductor.getDuration();
    const destino = duracion > 0 ? Math.min(this.guardada(), Math.max(0, duracion - 1)) : this.guardada();
    this.reproductor.seekTo(destino, true);
    this.reproductor.playVideo();
  }

  protected cambioVisibilidad(): void {
    if (this.documento.visibilityState === 'hidden') this.muestrear('oculto', true);
  }

  protected antesDeSalir(): void { this.muestrear('salida', true); }

  protected sinConexion(): void {
    if (this.estado() !== 'listo' && this.estado() !== 'cargando') return;
    this.muestrear('oculto', true);
    this.mostrarError('Se perdió la conexión. Cuando vuelva, pulsa Reintentar.');
  }

  private cambioEstado(estado: number): void {
    clearInterval(this.intervalo);
    clearTimeout(this.limiteBuffer);
    this.lenta.set(false);
    if (estado === 1) {
      this.huboReproduccion = true;
      if (this.observarPosicion()) {
        this.intervalo = setInterval(() => this.muestrear('intervalo'), 15_000);
      }
    } else if (estado === 2) {
      // Pausar es una interrupción: la posición se guarda en el acto.
      this.muestrear('pausa', true);
    } else if (estado === 0) {
      this.muestrear('fin', true);
      const leccionId = this.leccionActiva;
      if (this.observarPosicion() && this.huboReproduccion && leccionId !== null) {
        this.terminado.emit({ leccionId, videoId: this.videoActivo });
      }
    } else if (estado === 3) {
      this.limiteBuffer = setTimeout(() => this.lenta.set(true), 15_000);
    }
  }

  private muestrear(motivo: PosicionYoutube['motivo'], inmediato = false): void {
    if (!this.observarPosicion() || !this.huboReproduccion || !this.reproductor) return;
    const leccionId = this.leccionActiva;
    if (leccionId === null || !Number.isSafeInteger(leccionId) || leccionId <= 0) return;
    const valor = this.reproductor.getCurrentTime();
    if (!Number.isFinite(valor) || valor < 0) return;
    const duracion = this.reproductor.getDuration();
    const segundos = segundosSeguros(duracion > 0 ? Math.min(valor, duracion) : valor);
    this.pendiente = { leccionId, videoId: this.videoActivo, segundos, motivo };
    if (inmediato || Date.now() - this.ultimoAviso >= 15_000) {
      this.emitirPendiente();
    } else if (!this.diferido) {
      this.diferido = setTimeout(() => this.emitirPendiente(), 15_000 - (Date.now() - this.ultimoAviso));
    }
  }

  private emitirPendiente(): void {
    clearTimeout(this.diferido);
    this.diferido = undefined;
    const muestra = this.pendiente;
    this.pendiente = undefined;
    if (!this.observarPosicion() || !muestra || (muestra.leccionId === this.ultima?.leccionId && muestra.videoId === this.ultima?.videoId && muestra.segundos === this.ultima.segundos)) return;
    this.ultima = muestra;
    this.ultimoAviso = Date.now();
    this.posicion.emit(muestra);
  }

  private mostrarError(mensaje: string): void {
    this.liberar();
    this.estado.set('error');
    this.error.set(mensaje);
    this.fallo.emit(mensaje);
  }

  private liberar(): void {
    this.muestrear('salida', true);
    this.version++;
    clearInterval(this.intervalo);
    clearTimeout(this.limiteCarga);
    clearTimeout(this.limiteBuffer);
    clearTimeout(this.diferido);
    this.diferido = undefined;
    this.pendiente = undefined;
    this.huboReproduccion = false;
    this.reproductor?.destroy();
    this.reproductor = undefined;
    this.ultima = undefined;
    this.ultimoAviso = -Infinity;
  }

  ngOnDestroy(): void {
    this.liberar();
    this.destruido = true;
  }
}
