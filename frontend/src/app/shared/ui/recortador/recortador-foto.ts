import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';

/** Dimensiones visibles del área de recorte (px CSS) y dimensiones de la imagen JPEG generada. */
const LADO_1_1 = 280;
const SALIDA_1_1 = 512;
const ANCHO_16_9 = 384;
const ALTO_16_9 = 216;
const SALIDA_16_9_ANCHO = 960;
const SALIDA_16_9_ALTO = 540;
const ZOOM_MAX = 4;

/**
 * Recortador sobre un `<canvas>` nativo: arrastrar (puntero o flechas) para encuadrar,
 * deslizador o rueda para acercar. Soporta proporción `'1:1'` (circular 512×512 px para foto de perfil)
 * y `'16:9'` (rectangular horizontal 960×540 px para portada de curso).
 * La imagen siempre cubre el encuadre completo sin dejar bordes vacíos.
 */
@Component({
  selector: 'app-recortador-foto',
  template: `
    <div class="recortador">
      <canvas
        #lienzo
        class="lienzo"
        [class.arrastrando]="arrastrando()"
        [class.rectangular]="esPanoramico()"
        tabindex="0"
        role="img"
        aria-label="Área de recorte. Arrastra o usa las flechas para encuadrar; + y − para acercar o alejar."
        [style.width.px]="anchoCss()"
        [style.height.px]="altoCss()"
        (pointerdown)="empezar($event)"
        (pointermove)="mover($event)"
        (pointerup)="terminar($event)"
        (pointercancel)="terminar($event)"
        (wheel)="rueda($event)"
        (keydown)="tecla($event)"
      ></canvas>
      <label class="zoom">
        <span class="visualmente-oculto">Acercar</span>
        <span class="signo" aria-hidden="true">−</span>
        <input
          type="range"
          min="1"
          [max]="zoomMax"
          step="0.01"
          [value]="zoom()"
          [attr.aria-valuetext]="porcentaje() + ' %'"
          (input)="fijarZoom(+$any($event.target).value)"
        />
        <span class="signo" aria-hidden="true">+</span>
      </label>
    </div>
  `,
  styles: `
    .recortador { display: grid; justify-items: center; gap: 16px; width: 100%; }
    .lienzo {
      max-width: 100%;
      height: auto !important;
      aspect-ratio: 1;
      border-radius: var(--radio-md, 12px);
      background: var(--tinta-900, #111);
      cursor: grab;
      touch-action: none;
    }
    .lienzo.rectangular {
      aspect-ratio: 16 / 9;
    }
    .lienzo.arrastrando { cursor: grabbing; }
    .lienzo:focus-visible { outline: 3px solid var(--azul-600); outline-offset: 3px; }
    .zoom { display: flex; align-items: center; gap: 12px; width: min(320px, 100%); }
    .zoom input { flex: 1; accent-color: var(--azul-600); min-height: 44px; }
    .signo { font-size: 18px; font-weight: 600; color: var(--tinta-700); width: 1ch; text-align: center; }
  `,
})
export class RecortadorFoto {
  readonly archivo = input.required<File>();
  /** Proporción del recorte: `'1:1'` circular (512×512) o `'16:9'` horizontal (960×540). */
  readonly proporcion = input<'1:1' | '16:9'>('1:1');
  /** Se emite cada vez que cambia el encuadre (para habilitar «Guardar foto»). */
  readonly listo = output<boolean>();

  protected readonly esPanoramico = computed(() => this.proporcion() === '16:9');
  protected readonly anchoCss = computed(() => (this.esPanoramico() ? ANCHO_16_9 : LADO_1_1));
  protected readonly altoCss = computed(() => (this.esPanoramico() ? ALTO_16_9 : LADO_1_1));
  protected readonly zoomMax = ZOOM_MAX;
  protected readonly zoom = signal(1);
  protected readonly arrastrando = signal(false);
  protected readonly porcentaje = computed(() => Math.round(this.zoom() * 100));

  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private imagen: HTMLImageElement | null = null;
  private url: string | null = null;
  /** Desplazamiento del centro de la imagen respecto al centro del área, en px CSS. */
  private x = 0;
  private y = 0;
  private agarre: { id: number; x: number; y: number; ox: number; oy: number } | null = null;

  constructor() {
    afterNextRender(() => void this.cargar());
    inject(DestroyRef).onDestroy(() => this.url && URL.revokeObjectURL(this.url));
  }

  /** Escala que hace que la imagen cubra todo el área de recorte (1:1 o 16:9), por el zoom elegido. */
  private escala(zoom = this.zoom()): number {
    const img = this.imagen!;
    const base = Math.max(this.anchoCss() / img.naturalWidth, this.altoCss() / img.naturalHeight);
    return base * zoom;
  }

  private async cargar(): Promise<void> {
    this.url = URL.createObjectURL(this.archivo());
    const img = new Image();
    img.decoding = 'async';
    img.src = this.url;
    try {
      await img.decode();
    } catch {
      this.listo.emit(false);
      return;
    }
    this.imagen = img;
    const c = this.lienzo().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = this.anchoCss() * dpr;
    c.height = this.altoCss() * dpr;
    this.dibujar();
    this.listo.emit(true);
  }

  /** Mantiene la imagen cubriendo todo el área de recorte. */
  private limitar(): void {
    const img = this.imagen!;
    const s = this.escala();
    const mx = Math.max(0, (img.naturalWidth * s - this.anchoCss()) / 2);
    const my = Math.max(0, (img.naturalHeight * s - this.altoCss()) / 2);
    this.x = Math.min(mx, Math.max(-mx, this.x));
    this.y = Math.min(my, Math.max(-my, this.y));
  }

  private pintar(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void {
    const img = this.imagen!;
    const factor = ancho / this.anchoCss();
    const s = this.escala() * factor;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, ancho / 2 + this.x * factor - w / 2, alto / 2 + this.y * factor - h / 2, w, h);
  }

  private dibujar(): void {
    if (!this.imagen) return;
    const c = this.lienzo().nativeElement;
    const ctx = c.getContext('2d')!;
    const ancho = c.width;
    const alto = c.height;
    ctx.clearRect(0, 0, ancho, alto);
    this.pintar(ctx, ancho, alto);
    ctx.save();
    if (this.esPanoramico()) {
      const grosor = Math.max(1, ancho / this.anchoCss()) * 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = grosor;
      ctx.strokeRect(grosor, grosor, ancho - grosor * 2, alto - grosor * 2);
    } else {
      // Velo fuera del círculo: lo que queda dentro es exactamente la foto que se verá.
      ctx.fillStyle = 'rgba(15, 18, 25, 0.62)';
      ctx.beginPath();
      ctx.rect(0, 0, ancho, alto);
      ctx.arc(ancho / 2, alto / 2, ancho / 2 - 2, 0, Math.PI * 2);
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = Math.max(1, ancho / LADO_1_1) * 1.5;
      ctx.beginPath();
      ctx.arc(ancho / 2, alto / 2, ancho / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  protected fijarZoom(valor: number): void {
    if (!this.imagen) return;
    const anterior = this.zoom();
    const nuevo = Math.min(ZOOM_MAX, Math.max(1, valor));
    // Acercar respecto al centro del área: el punto encuadrado no se desplaza.
    this.x *= nuevo / anterior;
    this.y *= nuevo / anterior;
    this.zoom.set(nuevo);
    this.limitar();
    this.dibujar();
  }

  protected empezar(e: PointerEvent): void {
    if (!this.imagen) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.agarre = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: this.x, oy: this.y };
    this.arrastrando.set(true);
  }

  protected mover(e: PointerEvent): void {
    if (!this.agarre || this.agarre.id !== e.pointerId) return;
    // 1:1 con el puntero, respetando dónde se agarró.
    const escalaCss = this.anchoCss() / (e.target as HTMLElement).getBoundingClientRect().width;
    this.x = this.agarre.ox + (e.clientX - this.agarre.x) * escalaCss;
    this.y = this.agarre.oy + (e.clientY - this.agarre.y) * escalaCss;
    this.limitar();
    this.dibujar();
  }

  protected terminar(e: PointerEvent): void {
    if (this.agarre?.id !== e.pointerId) return;
    this.agarre = null;
    this.arrastrando.set(false);
  }

  protected rueda(e: WheelEvent): void {
    e.preventDefault();
    this.fijarZoom(this.zoom() * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  protected tecla(e: KeyboardEvent): void {
    const paso = e.shiftKey ? 40 : 10;
    const mov: Record<string, [number, number]> = {
      ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso],
    };
    if (mov[e.key]) {
      // Las flechas mueven el encuadre (como la cámara), no la foto.
      this.x += mov[e.key]![0];
      this.y += mov[e.key]![1];
      this.limitar();
      this.dibujar();
    } else if (e.key === '+' || e.key === '=') {
      this.fijarZoom(this.zoom() + 0.1);
    } else if (e.key === '-' || e.key === '_') {
      this.fijarZoom(this.zoom() - 0.1);
    } else {
      return;
    }
    e.preventDefault();
  }

  /** La imagen encuadrada como WebP (calidad 0.86) con fallback a JPEG (512×512 en 1:1 o 960×540 en 16:9). */
  async recortar(): Promise<File | null> {
    if (!this.imagen) return null;
    const anchoSalida = this.esPanoramico() ? SALIDA_16_9_ANCHO : SALIDA_1_1;
    const altoSalida = this.esPanoramico() ? SALIDA_16_9_ALTO : SALIDA_1_1;
    const prefijo = this.esPanoramico() ? 'portada-curso' : 'foto-perfil';
    const c = document.createElement('canvas');
    c.width = anchoSalida;
    c.height = altoSalida;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, anchoSalida, altoSalida);
    this.pintar(ctx, anchoSalida, altoSalida);
    const blobWebp = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/webp', 0.86));
    if (blobWebp && blobWebp.type === 'image/webp') {
      return new File([blobWebp], `${prefijo}.webp`, { type: 'image/webp' });
    }
    const blobJpeg = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    return blobJpeg ? new File([blobJpeg], `${prefijo}.jpg`, { type: 'image/jpeg' }) : null;
  }
}
