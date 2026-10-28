import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';

type TipoError = '404' | '403';

const TEXTOS: Record<TipoError, { titulo: string; mensaje: string; icono: string }> = {
  '404': {
    titulo: 'No encontramos esta página',
    mensaje: 'La dirección no existe o el contenido se movió. Revisa el enlace o sigue explorando desde aquí.',
    icono: 'search',
  },
  '403': {
    titulo: 'No tienes acceso a esta sección',
    mensaje: 'Tu cuenta no tiene el rol necesario para entrar aquí. Si crees que es un error, pide acceso al equipo de Learnity.',
    icono: 'lock',
  },
};

/** Páginas de error 404 y 403: dicen qué pasó y ofrecen un camino, en vez de redirigir sin explicar. */
@Component({
  selector: 'app-pagina-error',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <section class="contenedor error" [attr.aria-labelledby]="'titulo-error'">
      <span class="codigo" aria-hidden="true">{{ tipo() }}</span>
      <span class="icono" aria-hidden="true"><lucide-icon [name]="textos().icono" [size]="28" /></span>
      <h1 id="titulo-error">{{ textos().titulo }}</h1>
      <p>{{ textos().mensaje }}</p>
      <div class="acciones">
        <a class="btn btn-primario" [routerLink]="inicio()">{{ auth.autenticado() ? 'Ir a mi inicio' : 'Ir al inicio' }}</a>
        <a class="btn btn-contorno" routerLink="/cursos">Explorar cursos</a>
      </div>
    </section>
  `,
  styles: `
    .error {
      display: grid;
      justify-items: center;
      gap: 14px;
      padding: 72px 16px 96px;
      text-align: center;
    }
    .codigo {
      font-size: clamp(72px, 16vw, 128px);
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--azul-100);
    }
    .icono {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      margin-top: -44px;
      border-radius: 50%;
      background: var(--azul-700);
      color: var(--blanco);
      box-shadow: 0 0 0 6px var(--blanco);
    }
    h1 { margin: 6px 0 0; font-size: clamp(24px, 4vw, 32px); }
    p { max-width: 52ch; margin: 0; line-height: 1.6; color: var(--tinta-800); }
    .acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 8px; }
    @media (max-width: 480px) { .acciones { width: 100%; .btn { flex: 1 1 100%; } } }
  `,
})
export class PaginaError {
  protected readonly auth = inject(AuthService);

  /** Se fija en `data.tipo` de la ruta (withComponentInputBinding). */
  readonly tipo = input<TipoError>('404');

  protected readonly textos = computed(() => TEXTOS[this.tipo()]);
  protected readonly inicio = computed(() => (this.auth.autenticado() ? this.auth.rutaInicio() : '/'));
}
