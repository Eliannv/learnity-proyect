import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Modal } from '../../shared/ui/retroalimentacion/modal';

type SeccionInformativa = 'ayuda' | 'sobre' | 'privacidad' | 'contacto';

/**
 * Footer. Hay solo dos versiones:
 *  - público (visitante): Cuenta → Iniciar sesión, Crear cuenta, Ayuda
 *  - autenticado (estudiante, docente y administrador): Cuenta → Ver mi perfil, Ayuda
 */
@Component({
  selector: 'app-footer-sitio',
  imports: [RouterLink, Modal],
  template: `
    <footer>
      <div class="contenedor interior">
        <div class="marca">
          <a class="nombre-marca" routerLink="/" aria-label="Learnity, inicio">Learnity</a>
          <p>Learnity · Plataforma de cursos en línea. Una comunidad donde aprendes y también enseñas.</p>
        </div>
        <nav class="columnas" aria-label="Enlaces del pie de página">
          <div>
            <h4>Plataforma</h4>
            <a routerLink="/cursos">Explorar cursos</a>
            <a routerLink="/cursos">Categorías</a>
            <a routerLink="/" fragment="como-funciona" (click)="irAComoFunciona($event)">Cómo funciona</a>
          </div>
          <div>
            <h4>Cuenta</h4>
            @if (autenticado()) {
              <a [routerLink]="rutaPerfil()">Ver mi perfil</a>
            } @else {
              <a routerLink="/login">Iniciar sesión</a>
              <a routerLink="/registro">Crear cuenta</a>
            }
            <button type="button" class="enlace-pie" (click)="seccionActiva.set('ayuda')">Ayuda</button>
          </div>
          <div>
            <h4>Institucional</h4>
            <button type="button" class="enlace-pie" (click)="seccionActiva.set('sobre')">Sobre Learnity</button>
            <button type="button" class="enlace-pie" (click)="seccionActiva.set('privacidad')">Privacidad</button>
            <button type="button" class="enlace-pie" (click)="seccionActiva.set('contacto')">Contacto</button>
          </div>
        </nav>
      </div>
    </footer>

    @if (seccionActiva(); as seccion) {
      <app-modal [titulo]="tituloModal()" (cerrar)="seccionActiva.set(null)">
        <div class="contenido-informativo">
          @switch (seccion) {
            @case ('sobre') {
              <p>
                <strong>Learnity</strong> es una plataforma educativa diseñada para aprender habilidades prácticas
                mediante cursos estructurados en módulos cortos, recursos descargables y evaluaciones de progreso.
              </p>
              <p>
                Nuestra comunidad conecta a estudiantes y docentes verificados en áreas como tecnología, diseño,
                idiomas, bienestar y ciencias, con seguimiento de avance en tiempo real y espacios de consulta directa.
              </p>
            }
            @case ('ayuda') {
              <p><strong>Preguntas frecuentes y guía rápida:</strong></p>
              <ul class="lista-info">
                <li><strong>Inscripción y avance:</strong> Inscríbete gratis en cualquier curso publicado, retoma tus videos donde los dejaste y descarga el material de apoyo en cada lección.</li>
                <li><strong>Evaluaciones:</strong> Cada módulo incluye una evaluación para comprobar tu aprendizaje y actualizar tu porcentaje de progreso.</li>
                <li><strong>Enseñar en Learnity:</strong> Si deseas compartir tus conocimientos, pulsa «Enseña en Learnity» en el encabezado o desde tu perfil para postular como docente en tu especialidad.</li>
              </ul>
            }
            @case ('privacidad') {
              <p>
                En <strong>Learnity</strong> protegemos tu información personal bajo estándares estrictos de seguridad:
              </p>
              <ul class="lista-info">
                <li>Tus credenciales se almacenan cifradas con Argon2id y las sesiones utilizan cookies seguras HttpOnly con protección CSRF.</li>
                <li>Los cambios sensibles de cuenta (como actualización de correo electrónico o restablecimiento de contraseña) requieren confirmación mediante enlace único enviado a tu bandeja.</li>
                <li>Tus datos académicos y de perfil solo se utilizan para gestionar tu progreso en los cursos y nunca se comparten con terceros con fines comerciales.</li>
              </ul>
            }
            @case ('contacto') {
              <p>
                ¿Tienes dudas técnicas, sugerencias o necesitas asistencia con tu cuenta o algún curso?
              </p>
              <div class="tarjeta-contacto">
                <p><strong>Soporte y atención a la comunidad:</strong></p>
                <p>Correo electrónico: <a href="mailto:info@hoppersoft.site">info@hoppersoft.site</a></p>
                <p class="texto-suave">Horario de atención: lunes a viernes de 08:00 a 18:00 (GMT-5).</p>
              </div>
            }
          }
          <div class="acciones-info">
            <button type="button" class="btn btn-primario" (click)="seccionActiva.set(null)">Entendido</button>
          </div>
        </div>
      </app-modal>
    }
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
      max-width: 440px;
      p {
        margin-top: 16px;
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
      a,
      .enlace-pie {
        color: #fff;
        font: inherit;
        font-size: 14px;
        text-align: left;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        text-underline-offset: 4px;
        &:hover {
          text-decoration: underline;
        }
      }
    }
    .contenido-informativo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 15px;
      line-height: 1.6;
      color: var(--tinta-2);
      p {
        margin: 0;
      }
      strong {
        color: var(--tinta);
      }
    }
    .lista-info {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tarjeta-contacto {
      padding: 14px 16px;
      border-radius: var(--radio);
      background: var(--superficie-2);
      border: 1px solid var(--borde);
      display: flex;
      flex-direction: column;
      gap: 6px;
      a {
        color: var(--acento);
        font-weight: 600;
        text-decoration: underline;
      }
    }
    .acciones-info {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    /* El nombre en letras grandes encabeza el footer, en lugar del logo con icono. Gris de 3,9:1 sobre la banda:
       suficiente para texto grande (AA pide 3:1). */
    .nombre-marca {
      display: block;
      font-size: clamp(48px, 7vw, 96px);
      font-weight: 700;
      line-height: 0.85;
      letter-spacing: -0.05em;
      color: #6b7280;
      text-decoration: none;
      white-space: nowrap;
      &:hover,
      &:focus-visible {
        color: #9ca3af;
      }
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
    }
  `,
})
export class FooterSitio {
  private readonly router = inject(Router);
  readonly autenticado = input(false);
  readonly rutaPerfil = input('/perfil');
  protected readonly seccionActiva = signal<SeccionInformativa | null>(null);

  protected readonly tituloModal = computed(() => {
    switch (this.seccionActiva()) {
      case 'sobre':
        return 'Sobre Learnity';
      case 'ayuda':
        return 'Centro de ayuda';
      case 'privacidad':
        return 'Política de privacidad y seguridad';
      case 'contacto':
        return 'Contacto y soporte';
      default:
        return '';
    }
  });

  protected irAComoFunciona(evento: Event): void {
    evento.preventDefault();
    const desplazar = () => {
      const el = document.getElementById('como-funciona');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    const existente = document.getElementById('como-funciona');
    if (existente) {
      desplazar();
      return;
    }
    void this.router.navigate(['/'], { fragment: 'como-funciona' }).then(() => {
      setTimeout(desplazar, 120);
    });
  }
}
