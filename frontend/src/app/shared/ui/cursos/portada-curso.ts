import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { Tono } from '../tipos-ui';

/**
 * Portada del curso. Si el curso tiene imagen (curso.portada_url) la muestra;
 * si no, dibuja una portada con el ícono de su categoría (el que eligió el administrador) en un tono de la marca.
 * `icono` superpone un indicador centrado (por ejemplo, reproducir en la última lección).
 */
@Component({
  selector: 'app-portada-curso',
  imports: [LucideAngularModule],
  template: `
    <div class="portada" [class]="'portada tono-' + tono()" aria-hidden="true">
      @if (imagen()) {
        <!-- 16:9 intrínseco: el navegador reserva el hueco antes de cargar la imagen (sin saltos de diseño). -->
        <img [src]="imagen()" alt="" loading="lazy" decoding="async" width="480" height="270" />
      } @else if (!icono()) {
        <lucide-icon class="marca" [name]="marcaCategoria()" [size]="tamanoMarca()" [strokeWidth]="1.5" />
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
    }
    /* Tonos planos de la marca, sin tramas ni degradados: el ícono de la categoría es el único dibujo. */
    .tono-1 {
      background-color: var(--acento);
      color: var(--acento-pista);
    }
    .tono-2 {
      background-color: var(--cabecera-oscura);
      color: var(--acento-pista);
    }
    .tono-3 {
      background-color: var(--acento-suave);
      color: var(--acento);
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
      background: var(--superficie);
      color: var(--tinta);
    }
  `,
  host: { '[class.compacta]': 'compacta()' },
})
export class PortadaCurso {
  /** Ícono de la categoría que devuelve la API (`categoria.icono`); sin él, un libro. */
  readonly iconoCategoria = input<string | null | undefined>(null);
  readonly tono = input<Tono>(1);
  readonly imagen = input<string | null>(null);
  readonly icono = input<string | null>(null);
  /** Miniaturas (menús y listas): ícono de categoría más pequeño. */
  readonly compacta = input(false);

  protected readonly marcaCategoria = computed(() => this.iconoCategoria() || 'book-open');
  protected readonly tamanoMarca = computed(() => (this.compacta() ? 28 : 96));
}
