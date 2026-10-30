import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface EnlaceSeccion {
  ruta: string;
  texto: string;
}

/**
 * Pestañas de navegación entre páginas hermanas que comparten una entrada del menú lateral
 * (p. ej. Cursos | Categorías). Cada pestaña es un enlace a su ruta, así las URLs siguen siendo las de siempre.
 */
@Component({
  selector: 'app-conmutador-seccion',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="pestanas-linea" [attr.aria-label]="etiqueta()">
      @for (e of enlaces(); track e.ruta) {
        <a [routerLink]="e.ruta" routerLinkActive="activa" ariaCurrentWhenActive="page">{{ e.texto }}</a>
      }
    </nav>
  `,
  styles: `
    :host { display: block; }
  `,
})
export class ConmutadorSeccion {
  readonly etiqueta = input.required<string>();
  readonly enlaces = input.required<EnlaceSeccion[]>();
}

export const SECCION_CURSOS: EnlaceSeccion[] = [
  { ruta: '/admin/revision', texto: 'Cursos' },
  { ruta: '/admin/categorias', texto: 'Categorías' },
];

export const SECCION_SEGURIDAD: EnlaceSeccion[] = [
  { ruta: '/admin/sesiones', texto: 'Sesiones activas' },
  { ruta: '/admin/accesos', texto: 'Historial de accesos y bloqueos' },
];
