import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../ui/logo';

/**
 * Footer. Hay solo dos versiones:
 *  - público (visitante): Cuenta → Iniciar sesión, Crear cuenta, Ayuda
 *  - autenticado (estudiante, docente y administrador): Cuenta → Ver mi perfil, Ayuda
 */
@Component({
  selector: 'app-footer-sitio',
  imports: [RouterLink, Logo],
  template: `
    <footer>
      <div class="contenedor interior">
        <div class="marca">
          <app-logo [claro]="true" [tamano]="26" />
          <p>Learnity · Plataforma de cursos en línea. Una comunidad donde aprendes y también enseñas.</p>
        </div>
        <nav class="columnas" aria-label="Enlaces del pie de página">
          <div>
            <h4>Plataforma</h4>
            <a routerLink="/cursos">Explorar cursos</a>
            <a routerLink="/cursos">Categorías</a>
            <a routerLink="/" fragment="como-funciona">Cómo funciona</a>
          </div>
          <div>
            <h4>Cuenta</h4>
            @if (autenticado()) {
              <a [routerLink]="rutaPerfil()">Ver mi perfil</a>
            } @else {
              <a routerLink="/login">Iniciar sesión</a>
              <a routerLink="/registro">Crear cuenta</a>
            }
            <a routerLink="/">Ayuda</a>
          </div>
          <div>
            <h4>Institucional</h4>
            <a routerLink="/">Sobre Learnity</a>
            <a routerLink="/">Privacidad</a>
            <a routerLink="/">Contacto</a>
          </div>
        </nav>
      </div>
    </footer>
  `,
  styles: `
    footer {
      background: var(--tinta-900);
      color: var(--blanco);
      padding: 56px 0 64px;
    }
    .interior {
      display: flex;
      justify-content: space-between;
      gap: 48px;
    }
    .marca {
      max-width: 340px;
      p {
        margin-top: 14px;
        font-size: 14px;
        color: var(--gris-400);
      }
    }
    .columnas {
      display: grid;
      grid-template-columns: repeat(3, 180px);
      gap: 32px;
      div {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      h4 {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--azul-300);
        margin-bottom: 4px;
      }
      a {
        color: var(--blanco);
        font-size: 14px;
        font-weight: 600;
        &:hover {
          color: var(--azul-300);
        }
      }
    }
    @media (max-width: 900px) {
      footer {
        padding: 40px 0 32px;
      }
      .interior {
        flex-direction: column;
        gap: 28px;
      }
      .columnas {
        grid-template-columns: 1fr;
        gap: 24px;
        div {
          gap: 20px;
        }
      }
    }
  `,
})
export class FooterSitio {
  readonly autenticado = input(false);
  readonly rutaPerfil = input('/perfil');
}
