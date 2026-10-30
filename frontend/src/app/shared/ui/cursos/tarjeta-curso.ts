import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Estrellas } from '../datos/estrellas';
import type { Tono } from '../tipos-ui';
import { PortadaCurso } from './portada-curso';

/** Resumen de reseñas vigentes del curso (`CursoPublico.calificacion`). */
export interface CalificacionTarjeta {
  promedio: number | null;
  total: number;
}

/**
 * Tarjeta de curso (CourseCard), con la jerarquía de Udemy: portada 16:9, título, docente, valoración y meta.
 * Sin borde ni sombra en reposo: la portada recortada es la que da forma a la tarjeta.
 * `horizontal` la convierte en la fila de resultados de búsqueda (portada a la izquierda, subtítulo a dos líneas);
 * por debajo de 700px vuelve a apilarse como tarjeta.
 * Lo que va debajo (progreso, botones) se pasa como contenido.
 */
@Component({
  selector: 'app-tarjeta-curso',
  imports: [RouterLink, PortadaCurso, Estrellas],
  host: { '[class.horizontal]': 'horizontal()' },
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
        @if (enlace()) {
          <a class="titulo" [routerLink]="enlace()">{{ titulo() }}</a>
        } @else {
          <h3 class="titulo">{{ titulo() }}</h3>
        }
        @if (horizontal() && subtitulo()) {
          <p class="subtitulo-curso">{{ subtitulo() }}</p>
        }
        @if (docente()) {
          <p class="docente">{{ docente() }}</p>
        }
        @if (calificacion(); as cal) {
          @if (cal.total > 0 && cal.promedio !== null) {
            <p class="valoracion">
              <span class="nota num" aria-hidden="true">{{ cifra(cal.promedio) }}</span>
              <app-estrellas [valor]="cal.promedio" />
              <span class="conteo num">({{ cal.total }}<span class="visualmente-oculto"> {{ cal.total === 1 ? 'reseña' : 'reseñas' }}</span>)</span>
            </p>
          } @else {
            <!-- Sin reseñas todavía: se calla, pero guarda el alto de la fila para que las tarjetas vecinas cuadren. -->
            <p class="valoracion" aria-hidden="true"></p>
          }
        }
        @if (metaVisible() || nuevo()) {
          <p class="meta">
            @if (metaVisible()) { <span class="num">{{ metaVisible() }}</span> }
            @if (nuevo()) { <span class="nuevo">Nuevo</span> }
          </p>
        }
        <ng-content />
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .tarjeta-curso {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      border-radius: var(--radio);
      transition: transform var(--t-pulsar) var(--curva-salida);
      &:active {
        transform: scale(0.99);
      }
      /* El foco del título (el único enlace del orden de tabulación) rodea toda la tarjeta. */
      &:has(.titulo:focus-visible) {
        outline: 2px solid var(--foco);
        outline-offset: 4px;
      }
    }
    .portada {
      display: block;
      aspect-ratio: 16 / 9;
      border-radius: var(--radio);
      overflow: hidden;
      background: var(--elevado);
      app-portada-curso {
        transition: transform var(--t-panel) var(--curva-salida);
      }
    }
    .cuerpo {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 10px;
    }
    .titulo {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--tinta);
      text-underline-offset: 3px;
      &:focus-visible {
        outline: none;
      }
    }
    .docente {
      overflow: hidden;
      font-size: 13px;
      color: var(--tinta-3);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .valoracion {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 20px;
      font-size: 14px;
    }
    .nota {
      font-weight: 600;
      color: var(--estrella-tinta);
    }
    .conteo {
      font-size: 13px;
      color: var(--tinta-3);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      font-size: 13px;
      color: var(--tinta-3);
    }
    .nuevo {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--acento-suave);
      color: var(--acento-tinta);
      font-size: 12px;
      font-weight: 600;
    }
    .subtitulo-curso {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      font-size: 14px;
      line-height: 1.45;
      color: var(--tinta-2);
    }
    /* Fila de resultados: portada de 260px a la izquierda y el texto a su lado. */
    @media (min-width: 701px) {
      :host(.horizontal) {
        .tarjeta-curso {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          align-items: start;
          gap: 20px;
        }
        .cuerpo {
          padding-top: 0;
        }
        .titulo {
          font-size: 17px;
        }
        .valoracion:empty {
          display: none;
        }
      }
    }
    /* La portada se acerca dentro de su máscara y el título se subraya: solo con un puntero que pueda pasar por encima. */
    @media (hover: hover) {
      .tarjeta-curso:hover {
        .portada app-portada-curso {
          transform: scale(1.03);
        }
        .titulo {
          text-decoration: underline;
        }
      }
    }
  `,
})
export class TarjetaCurso {
  readonly titulo = input.required<string>();
  /** Ya no se dibuja (la categoría vive en los filtros); se conserva mientras se migran las vistas del lote 3. */
  readonly categoria = input<string>('');
  /** Ícono de la categoría que devuelve la API (`categoria.icono`). */
  readonly iconoCategoria = input<string | null | undefined>(null);
  readonly docente = input<string>();
  /** Solo en la fila horizontal: el subtítulo del curso a dos líneas. */
  readonly subtitulo = input<string | null>(null);
  readonly horizontal = input(false);
  /** Reseñas vigentes; sin reseñas la fila queda vacía con su alto. Sin el dato (null), la fila no existe. */
  readonly calificacion = input<CalificacionTarjeta | null>(null);
  /** Duración y lecciones, separadas por « · ». Las partes «0 min» se omiten. */
  readonly meta = input<string>('');
  readonly tono = input<Tono>(1);
  readonly nuevo = input(false);
  readonly enlace = input<string>();
  /** Portada que subió el docente; sin ella se dibuja el ícono de la categoría. */
  readonly imagen = input<string | null>(null);

  protected readonly metaVisible = computed(() =>
    this.meta()
      .split(' · ')
      .map((parte) => parte.trim())
      .filter((parte) => parte && !/^0\s*min$/.test(parte))
      .join(' · '),
  );

  protected cifra(promedio: number): string {
    return promedio.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
