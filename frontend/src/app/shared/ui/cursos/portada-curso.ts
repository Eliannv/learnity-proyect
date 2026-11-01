import { Component, computed, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { Tono } from '../tipos-ui';

@Component({
  selector: 'app-portada-curso',
  imports: [LucideAngularModule],
  template: `
    <div
      class="portada"
      [class]="'portada tono-' + tono()"
      aria-hidden="true"
    >
      @if (imagenVisible(); as url) {
        <img
          [src]="url"
          alt=""
          loading="lazy"
          decoding="async"
          width="480"
          height="270"
          (error)="imagenFallida.set(url)"
        />
      } @else if (!icono()) {
        <div class="alternativa">
          <lucide-icon
            class="marca"
            [name]="marcaCategoria()"
            [size]="tamanoMarca()"
            [strokeWidth]="1.5"
          />

          @if (!compacta()) {
            <span class="etiqueta-categoria">
              {{ categoria() || 'Curso en línea' }}
            </span>
          }
        </div>
      }

      @if (icono()) {
        <span class="superpuesto">
          <lucide-icon
            [name]="icono()!"
            [size]="compacta() ? 18 : 22"
          />
        </span>
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

    .alternativa {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 8px;
      width: 100%;
      height: 100%;
      min-width: 0;
      padding: 12px;
    }

    .marca {
      display: flex;
    }

    .etiqueta-categoria {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      max-width: 100%;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.25;
      text-align: center;
      overflow-wrap: anywhere;
    }

    :host(.compacta) .alternativa {
      padding: 4px;
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
  host: {
    '[class.compacta]': 'compacta()',
  },
})
export class PortadaCurso {
  readonly categoria = input<string>('');
  readonly iconoCategoria = input<string | null | undefined>(null);
  readonly tono = input<Tono>(1);
  readonly imagen = input<string | null>(null);
  readonly icono = input<string | null>(null);
  readonly compacta = input(false);

  protected readonly imagenFallida = signal<string | null>(null);

  protected readonly imagenVisible = computed(() => {
    const url = this.imagen()?.trim();

    return url && url !== this.imagenFallida() ? url : null;
  });

  protected readonly marcaCategoria = computed(
    () => this.iconoCategoria() || 'book-open',
  );

  protected readonly tamanoMarca = computed(
    () => (this.compacta() ? 28 : 48),
  );
}