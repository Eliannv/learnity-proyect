import {
  Directive,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

@Directive({
  selector: '[appEntradaSuave]',
  standalone: true,
  host: {
    '(focusin)': 'mostrarAhora()',
  },
})
export class EntradaSuave {
  readonly retardoEntrada = input(0);

  readonly origenEntrada =
    input<'abajo' | 'izquierda' | 'derecha'>('abajo');

  private readonly elemento =
    inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly destruir = inject(DestroyRef);

  private observador?: IntersectionObserver;
  private animacion?: Animation;
  private preferencia?: MediaQueryList;

  private mostrado = false;
  private destruido = false;

  private readonly alCambiarPreferencia = (
    evento: MediaQueryListEvent,
  ): void => {
    if (evento.matches) this.mostrarAhora();
  };

  constructor() {
    afterNextRender(() => this.preparar());

    this.destruir.onDestroy(() => {
      this.destruido = true;
      this.mostrarAhora();

      this.preferencia?.removeEventListener(
        'change',
        this.alCambiarPreferencia,
      );
    });
  }

  private preparar(): void {
    const nodo = this.elemento.nativeElement;

    if (
      this.destruido ||
      this.mostrado ||
      typeof nodo.animate !== 'function'
    ) {
      return;
    }

    this.preferencia = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    );

    if (this.preferencia?.matches) return;

    this.preferencia?.addEventListener(
      'change',
      this.alCambiarPreferencia,
    );

    if (typeof IntersectionObserver === 'undefined') {
      this.animar();
      return;
    }

    this.observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          this.animar();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -24px 0px',
      },
    );

    this.observador.observe(nodo);
  }

  private animar(): void {
    if (
      this.destruido ||
      this.mostrado ||
      this.preferencia?.matches
    ) {
      return;
    }

    this.mostrado = true;
    this.observador?.disconnect();

    const origen = this.origenEntrada();

    const desde =
      origen === 'izquierda'
        ? '-16px 0'
        : origen === 'derecha'
          ? '16px 0'
          : '0 16px';

    const valor = this.retardoEntrada();

    const retardo = Number.isFinite(valor)
      ? Math.min(400, Math.max(0, valor))
      : 0;

    this.animacion = this.elemento.nativeElement.animate(
      [
        { opacity: 0, translate: desde },
        { opacity: 1, translate: '0 0' },
      ],
      {
        duration: 800,
        delay: retardo,
        easing: 'ease',
        fill: 'backwards',
      },
    );
  }

  protected mostrarAhora(): void {
    this.mostrado = true;
    this.observador?.disconnect();
    this.animacion?.cancel();
    this.animacion = undefined;
  }
}