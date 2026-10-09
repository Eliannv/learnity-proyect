import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CURSOS_DOCENTE, EstadoCurso } from '../../../data/datos-demo';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';

type Filtro = 'TODOS' | EstadoCurso;

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'BORRADOR', etiqueta: 'Borradores' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazados' },
  { valor: 'EN_REVISION', etiqueta: 'En revisión' },
  { valor: 'PUBLICADO', etiqueta: 'Publicados' },
];

/** Mis cursos del docente (RF-10): todos sus cursos, filtrados por estado, con su acción. */
@Component({
  selector: 'app-mis-cursos-docente',
  imports: [RouterLink, EstadoCursoBadge],
  template: `
    <header class="cabecera">
      <div>
        <h1 class="titulo-pagina">Mis cursos</h1>
        <p class="subtitulo">Publicar es decisión de Administración. Tú preparas el curso y lo envías a revisión.</p>
      </div>
      <a class="btn btn-acento btn-lg" routerLink="/docente/cursos/nuevo/editar">Nuevo curso</a>
    </header>

    <div class="filtros" role="tablist" aria-label="Filtrar por estado">
      @for (f of filtros; track f.valor) {
        <button type="button" role="tab" [attr.aria-selected]="filtro() === f.valor" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
          {{ f.etiqueta }} <span class="cuenta">{{ cuenta(f.valor) }}</span>
        </button>
      }
    </div>

    @if (visibles().length) {
      <ul class="cursos tarjeta">
        @for (c of visibles(); track c.id) {
          <li>
            <div class="info">
              <h2>{{ c.titulo }}</h2>
              <p class="texto-suave">{{ c.detalle }}</p>
            </div>
            <div class="datos">
              <app-estado-curso [estado]="c.estado" />
              <strong>{{ c.modulos }} de 1–10</strong>
              <strong>{{ c.minutos }} min</strong>
            </div>
            @if (c.estado === 'EN_REVISION') {
              <a class="btn btn-contorno btn-lg accion" [routerLink]="'/cursos/' + c.id">Ver</a>
            } @else {
              <a class="btn btn-contorno btn-lg accion" [routerLink]="'/docente/cursos/' + c.id + '/editar'">Editar</a>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="vacio tarjeta">No tienes cursos en este estado.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .filtros {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 0 16px;
        border: 1px solid var(--gris-200);
        border-radius: 999px;
        background: var(--blanco);
        color: var(--tinta-900);
        font-weight: 600;
        white-space: nowrap;
        &:hover {
          border-color: var(--azul-200);
        }
        &.activo {
          border-color: var(--tinta-900);
          background: var(--tinta-900);
          color: var(--blanco);
          .cuenta {
            background: rgb(255 255 255 / 18%);
            color: var(--blanco);
          }
        }
      }
      .cuenta {
        min-width: 22px;
        padding: 1px 7px;
        border-radius: 999px;
        background: var(--gris-100);
        color: var(--gris-500);
        font-size: 12px;
      }
    }
    .cursos {
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 22px 24px;
      }
      li + li {
        border-top: 1px solid var(--gris-200);
      }
    }
    .info {
      flex: 1;
      min-width: 0;
      h2 {
        font-size: 18px;
        font-weight: 600;
      }
      p {
        font-size: 14px;
        margin-top: 2px;
      }
    }
    .datos {
      display: flex;
      align-items: center;
      gap: 18px;
      white-space: nowrap;
      strong {
        font-weight: 600;
      }
    }
    .vacio {
      padding: 40px 24px;
      text-align: center;
      color: var(--gris-500);
    }
    @media (max-width: 900px) {
      :host {
        gap: 16px;
      }
      .cabecera {
        flex-direction: column;
        .btn {
          width: 100%;
        }
      }
      .cursos {
        border: 0;
        background: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        li {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          padding: 16px;
          border: 1px solid var(--gris-200);
          border-radius: var(--radio-md);
        }
        li + li {
          border-top: 1px solid var(--gris-200);
        }
      }
      .datos {
        gap: 10px;
        font-size: 14px;
      }
      .accion {
        width: 100%;
      }
    }
  `,
})
export class MisCursosDocente {
  protected readonly filtros = FILTROS;
  protected readonly filtro = signal<Filtro>('TODOS');
  protected readonly visibles = computed(() =>
    this.filtro() === 'TODOS' ? CURSOS_DOCENTE : CURSOS_DOCENTE.filter((c) => c.estado === this.filtro()),
  );

  protected cuenta(f: Filtro): number {
    return f === 'TODOS' ? CURSOS_DOCENTE.length : CURSOS_DOCENTE.filter((c) => c.estado === f).length;
  }
}
