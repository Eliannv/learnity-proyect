import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Tono } from '../tipos-ui';
import { PortadaCurso } from './portada-curso';

/**
 * Tarjeta de curso (CourseCard). Muestra la portada del curso o, si no tiene, el ícono de la categoría.
 * Lo que va debajo del título (progreso, botones) se pasa como contenido.
 */
@Component({
  selector: 'app-tarjeta-curso',
  imports: [RouterLink, PortadaCurso],
  template: `
    <article class="tarjeta-curso">
      @if (enlace()) {
        <a class="portada" [routerLink]="enlace()" tabindex="-1" aria-hidden="true">
          <app-portada-curso [iconoCategoria]="iconoCategoria()" [tono]="tono()" [imagen]="imagen()" />
        </a>
      } @else {
        <div class="portada"><app-portada-curso [iconoCategoria]="iconoCategoria()" [tono]="tono()" [imagen]="imagen()" /></div>
      }
      <div class="cuerpo">
        <div class="chips">
          <span class="chip">{{ categoria() }}</span>
          @if (nuevo()) {
            <span class="chip chip-azul">Nuevo</span>
          }
        </div>
        @if (enlace()) {
          <a class="titulo" [routerLink]="enlace()">{{ titulo() }}</a>
        } @else {
          <h3 class="titulo">{{ titulo() }}</h3>
        }
        <p class="meta">{{ meta() }}</p>
        <ng-content />
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .tarjeta-curso {
      height: 100%;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-md);
      overflow: hidden;
      background: var(--blanco);
      transition: box-shadow 0.15s;
      &:hover {
        box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
      }
    }
    .portada {
      display: block;
      height: 144px;
    }
    .cuerpo {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      flex: 1;
    }
    .chips {
      display: flex;
      gap: 6px;
    }
    .titulo {
      font-size: 17px;
      font-weight: 600;
      color: var(--tinta-900);
      margin-top: 2px;
    }
    a.titulo:hover {
      color: var(--azul-700);
    }
    .meta {
      font-size: 13px;
      color: var(--gris-500);
    }
  `,
})
export class TarjetaCurso {
  readonly titulo = input.required<string>();
  readonly categoria = input.required<string>();
  /** Ícono de la categoría que devuelve la API (`categoria.icono`). */
  readonly iconoCategoria = input<string | null | undefined>(null);
  readonly meta = input.required<string>();
  readonly tono = input<Tono>(1);
  readonly nuevo = input(false);
  readonly enlace = input<string>();
  /** Portada que subió el docente; sin ella se dibuja el ícono de la categoría. */
  readonly imagen = input<string | null>(null);
}
