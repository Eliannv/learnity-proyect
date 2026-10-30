import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../../shared/ui/marca/logo';

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
      <div class="contenedor">
        <p class="cierre" aria-hidden="true">Learnity</p>
      </div>
    </footer>
  `,
  styles: `
    /* Cierre del sitio sobre la banda oscura neutra (no azul marino). Títulos en minúscula de frase y el nombre a
       todo el ancho como cierre, en lugar de un mapa del sitio en mayúsculas. */
    footer {
      background: var(--cabecera-oscura);
      color: #fff;
      padding: 56px 0 32px;
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
        line-height: 1.6;
        color: var(--cabecera-oscura-2);
      }
    }
    .columnas {
      display: grid;
      grid-template-columns: repeat(3, 180px);
      gap: 32px;
      div {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      h4 {
        font-size: 14px;
        font-weight: 600;
        color: var(--cabecera-oscura-2);
        margin-bottom: 2px;
      }
      a {
        color: #fff;
        font-size: 14px;
        text-underline-offset: 4px;
        &:hover {
          text-decoration: underline;
        }
      }
    }
    /* El nombre a todo el ancho: decorativo (aria-hidden), gris de 3,9:1 sobre la banda. */
    .cierre {
      margin-top: 48px;
      font-size: clamp(56px, 13vw, 184px);
      font-weight: 700;
      line-height: 0.8;
      letter-spacing: -0.05em;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      user-select: none;
    }
    @media (max-width: 900px) {
      footer {
        padding: 40px 0 24px;
      }
      .interior {
        flex-direction: column;
        gap: 28px;
      }
      .columnas {
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        div {
          gap: 14px;
        }
      }
      .cierre {
        margin-top: 32px;
      }
    }
  `,
})
export class FooterSitio {
  readonly autenticado = input(false);
  readonly rutaPerfil = input('/perfil');
}
