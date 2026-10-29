import { Component, computed, input } from '@angular/core';

export type FormaEsqueleto = 'tarjetas' | 'detalle' | 'leccion' | 'filas';

/**
 * Silueta de carga con la forma de lo que va a aparecer, para que la página no salte al llegar los datos.
 * Los lectores de pantalla oyen la etiqueta (`role="status"`); las siluetas son decorativas.
 */
@Component({
  selector: 'app-esqueleto',
  host: { role: 'status', 'aria-busy': 'true', '[class]': 'forma()' },
  template: `
    <span class="visualmente-oculto">{{ etiqueta() }}</span>
    @switch (forma()) {
      @case ('tarjetas') {
        <div class="rejilla" aria-hidden="true">
          @for (i of repeticiones(); track i) {
            <div class="tarjeta">
              <span class="esqueleto portada"></span>
              <span class="esqueleto linea larga"></span>
              <span class="esqueleto linea media"></span>
              <span class="esqueleto linea corta"></span>
            </div>
          }
        </div>
      }
      @case ('detalle') {
        <div class="detalle" aria-hidden="true">
          <div class="columna">
            <span class="esqueleto linea corta"></span>
            <span class="esqueleto titulo"></span>
            <span class="esqueleto linea larga"></span>
            <span class="esqueleto linea media"></span>
            @for (i of repeticiones(); track i) { <span class="esqueleto bloque"></span> }
          </div>
          <span class="esqueleto lateral"></span>
        </div>
      }
      @case ('leccion') {
        <div class="leccion" aria-hidden="true">
          <div class="columna">
            <span class="esqueleto escenario"></span>
            <span class="esqueleto titulo"></span>
            <span class="esqueleto linea media"></span>
          </div>
          <div class="columna temario">
            @for (i of repeticiones(); track i) { <span class="esqueleto fila"></span> }
          </div>
        </div>
      }
      @default {
        <div class="filas" aria-hidden="true">
          @for (i of repeticiones(); track i) { <span class="esqueleto fila"></span> }
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .esqueleto { border-radius: var(--radio); }
    .linea { height: 14px; }
    .larga { width: 90%; }
    .media { width: 65%; }
    .corta { width: 35%; }
    .titulo { height: 34px; width: 75%; }
    .rejilla {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px;
    }
    .tarjeta { display: grid; gap: 10px; }
    .portada { aspect-ratio: 16 / 9; border-radius: var(--radio-md); }
    .detalle, .leccion {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 32px;
      align-items: start;
    }
    .columna { display: grid; gap: 14px; }
    .bloque { height: 64px; }
    .lateral { height: 420px; border-radius: var(--radio-md); }
    .escenario { aspect-ratio: 16 / 9; border-radius: 0; }
    .temario { padding-top: 4px; }
    .filas { display: grid; gap: 10px; }
    .fila { height: 56px; }
    @media (max-width: 900px) {
      .detalle, .leccion { grid-template-columns: 1fr; }
      .lateral { height: 220px; }
    }
  `,
})
export class Esqueleto {
  readonly forma = input<FormaEsqueleto>('filas');
  readonly cantidad = input(4);
  readonly etiqueta = input('Cargando…');

  protected readonly repeticiones = computed(() => Array.from({ length: this.cantidad() }, (_, i) => i));
}
