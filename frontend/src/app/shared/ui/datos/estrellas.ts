import { Component, computed, input } from '@angular/core';

/** Una estrella de 24×24 (viewBox 0 0 24 24); las cinco se separan 26 unidades (2 de aire). */
export const TRAZO_ESTRELLA = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5L2.6 9.45l6.5-.95z';
const POSICIONES = [0, 26, 52, 78, 104];

/**
 * Puntuación de 0 a 5 con estrellas parciales (solo lectura). Los lectores de pantalla
 * oyen «4,5 de 5 estrellas»; las estrellas dibujadas son decorativas.
 * Son SVG (no el carácter ★, que depende de la fuente): cada estrella mide 1em, así que siguen el tamaño de letra
 * del contexto. La pista va en --borde y el relleno en --estrella, recortado con clip-path para las fracciones.
 */
@Component({
  selector: 'app-estrellas',
  host: { role: 'img', '[attr.aria-label]': 'etiqueta()' },
  template: `
    <svg class="pista" viewBox="0 0 128 24" aria-hidden="true" focusable="false">
      @for (x of posiciones; track x) { <path [attr.d]="estrella" [attr.transform]="'translate(' + x + ' 0)'" /> }
    </svg>
    <svg class="relleno" viewBox="0 0 128 24" aria-hidden="true" focusable="false" [style.clip-path]="recorte()">
      @for (x of posiciones; track x) { <path [attr.d]="estrella" [attr.transform]="'translate(' + x + ' 0)'" /> }
    </svg>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      flex: none;
      width: calc(128em / 24);
      height: 1em;
      vertical-align: -0.125em;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
    .pista { color: var(--borde); }
    .relleno { color: var(--estrella); }
  `,
})
export class Estrellas {
  readonly valor = input(0);

  protected readonly estrella = TRAZO_ESTRELLA;
  protected readonly posiciones = POSICIONES;

  /**
   * Fracción del ancho rellena. Las estrellas no ocupan todo el ancho (hay aire entre ellas), así que el valor se
   * lleva a su posición real: cada estrella entera avanza 26 unidades de 128 y su parte decimal, 24.
   */
  protected readonly recorte = computed(() => {
    const v = Math.max(0, Math.min(5, this.valor()));
    const enteras = Math.floor(v);
    const borde = Math.min(128, enteras * 26 + (v - enteras) * 24);
    return `inset(0 ${(100 - (borde / 128) * 100).toFixed(2)}% 0 0)`;
  });
  protected readonly etiqueta = computed(
    () => `${this.valor().toLocaleString('es', { maximumFractionDigits: 1 })} de 5 estrellas`,
  );
}
