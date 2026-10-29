import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Logo } from '../../../shared/ui/marca/logo';

/**
 * Marco de las pantallas de acceso (Login, Registro, Recuperar contraseña).
 * Escritorio: tarjeta con presentación a la izquierda y formulario a la derecha.
 * Teléfono: flecha para volver, logo centrado y formulario.
 */
@Component({
  selector: 'app-marco-acceso',
  imports: [RouterLink, LucideAngularModule, Logo],
  template: `
    <div class="fondo">
      <span class="burbuja b1"></span>
      <span class="burbuja b2"></span>
      <span class="burbuja b3"></span>

      <button type="button" class="volver solo-movil" (click)="volver()" aria-label="Volver">
        <lucide-icon name="arrow-left" [size]="24" />
      </button>

      <main class="tarjeta-acceso">
        <section class="presentacion oculto-movil">
          <a routerLink="/"><app-logo [tamano]="26" /></a>
          <h1>
            {{ tituloAntes() }} <span>{{ tituloResaltado() }}</span>
          </h1>
          <p class="descripcion">{{ descripcion() }}</p>
          <ul class="ventajas">
            <li>
              <span class="icono azul"><lucide-icon name="book-open" [size]="20" /></span>
              <div><strong>Cursos en línea</strong><span>Módulos y lecciones a tu ritmo.</span></div>
            </li>
            <li>
              <span class="icono morado"><lucide-icon name="play" [size]="20" /></span>
              <div><strong>Contenido multimedia</strong><span>Videos, PDF y presentaciones.</span></div>
            </li>
            <li>
              <span class="icono verde"><lucide-icon name="chart-no-axes-column" [size]="20" /></span>
              <div><strong>Evaluaciones</strong><span>Mide lo que aprendes en cada módulo.</span></div>
            </li>
          </ul>
        </section>

        <section class="formulario">
          <a routerLink="/" class="logo-movil solo-movil" aria-label="Ir al inicio">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3 1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"
              />
            </svg>
            <span>Learnity</span>
          </a>
          <ng-content />
        </section>
      </main>
    </div>
  `,
  styleUrl: './marco-acceso.scss',
})
export class MarcoAcceso {
  private readonly location = inject(Location);
  readonly tituloAntes = input.required<string>();
  readonly tituloResaltado = input.required<string>();
  readonly descripcion = input.required<string>();

  protected volver() {
    this.location.back();
  }
}
