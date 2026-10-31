import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';

/** Lado visible del área de recorte (px CSS) y lado de la imagen que se genera. */
const LADO = 280;
const SALIDA = 512;
const ZOOM_MAX = 4;

/**
 * Recortador circular sobre un `<canvas>` nativo: arrastrar (puntero o flechas) para encuadrar,
 * deslizador o rueda para acercar. Emite un archivo JPEG cuadrado 1:1 listo para subir.
 * La imagen siempre cubre el círculo: no se puede dejar un borde vacío.
 */
@Component({
  selector: 'app-recortador-foto',
  template: `
    <div class="recortador">
      <canvas
        #lienzo
        class="lienzo"
        [class.arrastrando]="arrastrando()"
        tabindex="0"
        role="img"
        aria-label="Área de recorte. Arrastra o usa las flechas para encuadrar; + y − para acercar o alejar."
        [style.width.px]="lado"
        [style.height.px]="lado"
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
    .recortador { display: grid; justify-items: center; gap: 16px; }
    .lienzo {
      max-width: 100%;
      aspect-ratio: 1;
      border-radius: var(--radio-md, 12px);
      background: var(--tinta-900, #111);
      cursor: grab;
      touch-action: none;
    }
    .lienzo.arrastrando { cursor: grabbing; }
    .lienzo:focus-visible { outline: 3px solid var(--azul-600); outline-offset: 3px; }
    .zoom { display: flex; align-items: center; gap: 12px; width: min(280px, 100%); }
    .zoom input { flex: 1; accent-color: var(--azul-600); min-height: 44px; }
    .signo { font-size: 18px; font-weight: 600; color: var(--tinta-700); width: 1ch; text-align: center; }
  `,
})
export class RecortadorFoto {
  readonly archivo = input.required<File>();
  /** Se emite cada vez que cambia el encuadre (para habilitar «Guardar foto»). */
  readonly listo = output<boolean>();

  protected readonly lado = LADO;
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

  /** Escala que hace que el lado corto de la imagen cubra el área, por el zoom elegido. */
  private escala(zoom = this.zoom()): number {
    const img = this.imagen!;
    return (LADO / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
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
    c.width = LADO * dpr;
    c.height = LADO * dpr;
    this.dibujar();
    this.listo.emit(true);
  }

  /** Mantiene la imagen cubriendo todo el cuadrado (y por tanto el círculo). */
  private limitar(): void {
    const img = this.imagen!;
    const s = this.escala();
    const mx = Math.max(0, (img.naturalWidth * s - LADO) / 2);
    const my = Math.max(0, (img.naturalHeight * s - LADO) / 2);
    this.x = Math.min(mx, Math.max(-mx, this.x));
    this.y = Math.min(my, Math.max(-my, this.y));
  }

  private pintar(ctx: CanvasRenderingContext2D, lado: number): void {
    const img = this.imagen!;
    const factor = lado / LADO;
    const s = this.escala() * factor;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, lado / 2 + this.x * factor - w / 2, lado / 2 + this.y * factor - h / 2, w, h);
  }

  private dibujar(): void {
    if (!this.imagen) return;
    const c = this.lienzo().nativeElement;
    const ctx = c.getContext('2d')!;
    const lado = c.width;
    ctx.clearRect(0, 0, lado, lado);
    this.pintar(ctx, lado);
    // Velo fuera del círculo: lo que queda dentro es exactamente la foto que se verá.
    ctx.save();
    ctx.fillStyle = 'rgba(15, 18, 25, 0.62)';
    ctx.beginPath();
    ctx.rect(0, 0, lado, lado);
    ctx.arc(lado / 2, lado / 2, lado / 2 - 2, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(1, lado / LADO) * 1.5;
    ctx.beginPath();
    ctx.arc(lado / 2, lado / 2, lado / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
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
    const escalaCss = LADO / (e.target as HTMLElement).getBoundingClientRect().width;
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

  /** La foto encuadrada como JPEG cuadrado de 512 px (fondo blanco bajo las transparencias). */
  async recortar(): Promise<File | null> {
    if (!this.imagen) return null;
    const c = document.createElement('canvas');
    c.width = SALIDA;
    c.height = SALIDA;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SALIDA, SALIDA);
    this.pintar(ctx, SALIDA);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' }) : null;
  }
}
