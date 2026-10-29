import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICONO_CATEGORIA, type Tono } from '../tipos-ui';

/**
 * Portada del curso. Si el curso tiene imagen (curso.portada_url) la muestra;
 * si no, dibuja una portada con el ícono de su categoría en un tono de la marca.
 * `icono` superpone un indicador centrado (por ejemplo, reproducir en la última lección).
 */
@Component({
  selector: 'app-portada-curso',
  imports: [LucideAngularModule],
  template: `
    <div class="portada" [class]="'portada tono-' + tono()" aria-hidden="true">
      @if (imagen()) {
        <img [src]="imagen()" alt="" loading="lazy" />
      } @else if (!icono()) {
        <lucide-icon class="marca" [name]="iconoCategoria()" [size]="tamanoMarca()" [strokeWidth]="1.5" />
      }
      @if (icono()) {
        <span class="superpuesto"><lucide-icon [name]="icono()!" [size]="compacta() ? 18 : 22" /></span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .portada {
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      /* Trama de puntos: da textura sin competir con el título */
      background-image: radial-gradient(rgb(255 255 255 / 16%) 1px, transparent 1px);
      background-size: 14px 14px;
    }
    .tono-1 {
      background-color: var(--azul-700);
      color: var(--azul-100);
    }
    .tono-2 {
      background-color: var(--tinta-800);
      color: var(--azul-300);
    }
    .tono-3 {
      background-color: var(--azul-100);
      background-image: radial-gradient(rgb(37 99 235 / 14%) 1px, transparent 1px);
      color: var(--azul-700);
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .marca {
      position: absolute;
      right: 8%;
      bottom: -12%;
      transform: rotate(-12deg);
      opacity: 0.9;
    }
    :host(.compacta) .marca {
      position: static;
      transform: none;
    }
    .superpuesto {
      position: relative;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--blanco);
      color: var(--tinta-900);
      box-shadow: 0 4px 14px rgb(15 23 42 / 25%);
    }
  `,
  host: { '[class.compacta]': 'compacta()' },
})
export class PortadaCurso {
  readonly categoria = input.required<string>();
  readonly tono = input<Tono>(1);
  readonly imagen = input<string | null>(null);
  readonly icono = input<string | null>(null);
  /** Miniaturas (menús y listas): ícono de categoría más pequeño. */
  readonly compacta = input(false);

  protected readonly iconoCategoria = computed(() => ICONO_CATEGORIA[this.categoria()] ?? 'book-open');
  protected readonly tamanoMarca = computed(() => (this.compacta() ? 28 : 96));
}
