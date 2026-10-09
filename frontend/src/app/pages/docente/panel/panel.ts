import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { CURSOS_DOCENTE, CursoDocente, ESTUDIANTES_CURSO, EstadoCurso, INDICADORES_DOCENTE } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';
import { Indicador } from '../../../shared/ui/indicador';

/** Orden de "Requiere tu atención": primero lo que Administración devolvió. */
const PRIORIDAD: Partial<Record<EstadoCurso, number>> = { RECHAZADO: 0, BORRADOR: 1, EN_REVISION: 2 };

const ATAJOS = [
  { icono: 'plus', titulo: 'Crear un curso', texto: 'Empieza un borrador con sus módulos y lecciones', ruta: '/docente/cursos/nuevo/editar' },
  { icono: 'book-open', titulo: 'Mis cursos', texto: `${CURSOS_DOCENTE.length} cursos · revisa su estado`, ruta: '/docente/cursos' },
  { icono: 'graduation-cap', titulo: 'Estudiantes', texto: 'Avance y notas de tus inscritos', ruta: '/docente/estudiantes' },
  { icono: 'user', titulo: 'Ajustes y perfil', texto: 'Así te ven tus estudiantes', ruta: '/docente/perfil' },
];

/** Panel del docente: resumen, accesos directos y lo que requiere su atención (la gestión está en Mis cursos). */
@Component({
  selector: 'app-panel-docente',
  imports: [RouterLink, LucideAngularModule, Avatar, BarraProgreso, EstadoCursoBadge, Indicador],
  template: `
    <header>
      <h1 class="titulo-pagina">Hola, {{ auth.usuario()?.nombres }}</h1>
      <p class="subtitulo">Resumen de tus cursos y de lo que necesita tu atención.</p>
    </header>

    <div class="grid-stats">
      @for (i of indicadores; track i.etiqueta) {
        <app-indicador [etiqueta]="i.etiqueta" [valor]="i.valor" [nota]="i.nota" [icono]="i.icono" />
      }
    </div>

    <section aria-labelledby="titulo-atajos">
      <h2 id="titulo-atajos" class="titulo-seccion">Accesos directos</h2>
      <div class="atajos">
        @for (a of atajos; track a.ruta) {
          <a class="atajo tarjeta" [routerLink]="a.ruta">
            <span class="atajo-icono"><lucide-icon [name]="a.icono" [size]="22" /></span>
            <span class="atajo-texto">
              <strong>{{ a.titulo }}</strong>
              <small>{{ a.texto }}</small>
            </span>
            <lucide-icon class="flecha" name="chevron-right" [size]="18" />
          </a>
        }
      </div>
    </section>

    <div class="paneles">
      <section class="tarjeta panel">
        <div class="cabecera-panel">
          <h2>Requiere tu atención</h2>
          <a class="enlace" routerLink="/docente/cursos">Ver mis cursos</a>
        </div>
        <ul>
          @for (c of pendientes; track c.id) {
            <li class="pendiente">
              <div class="quien">
                <span class="fila-titulo">
                  <strong>{{ c.titulo }}</strong>
                  <app-estado-curso [estado]="c.estado" />
                </span>
                <span class="texto-suave">{{ motivo(c) }}</span>
              </div>
              @switch (c.estado) {
                @case ('RECHAZADO') {
                  <a class="btn btn-primario" [routerLink]="'/docente/cursos/' + c.id + '/editar'">Corregir</a>
                }
                @case ('BORRADOR') {
                  <a class="btn btn-suave" [routerLink]="'/docente/cursos/' + c.id + '/editar'">Continuar</a>
                }
                @default {
                  <a class="btn btn-suave" [routerLink]="'/cursos/' + c.id">Ver</a>
                }
              }
            </li>
          } @empty {
            <li class="texto-suave">Todo al día: no tienes cursos pendientes.</li>
          }
        </ul>
      </section>

      <section class="tarjeta panel">
        <div class="cabecera-panel">
          <h2>Actividad de tus estudiantes</h2>
          <a class="enlace" routerLink="/docente/estudiantes">Ver todos</a>
        </div>
        <ul>
          @for (e of estudiantes; track e.nombre) {
            <li>
              <app-avatar [texto]="e.iniciales" [tamano]="40" />
              <div class="quien">
                <strong>{{ e.nombre }}</strong>
                <span class="texto-suave">Introducción a Python · {{ e.actividad }}</span>
              </div>
              <div class="avance">
                <app-barra-progreso [valor]="e.progreso" [verde]="e.completado" />
                <span>{{ e.progreso }} %</span>
              </div>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .titulo-seccion {
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: 600;
    }
    .atajos {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
    .atajo {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 88px;
      padding: 16px;
      color: var(--tinta-900);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
      &:hover {
        border-color: var(--azul-200);
        box-shadow: 0 6px 18px rgb(15 23 42 / 8%);
        .flecha {
          color: var(--azul-700);
          transform: translateX(2px);
        }
      }
    }
    .atajo-icono {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: var(--radio);
      background: var(--azul-050);
      color: var(--azul-700);
    }
    .atajo-texto {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong {
        font-weight: 600;
      }
      small {
        font-size: 13px;
        color: var(--gris-500);
      }
    }
    .flecha {
      flex: none;
      color: var(--gris-500);
      transition: transform 0.15s;
    }
    .paneles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    }
    .panel ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cabecera-panel {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--gris-200);
      h2 {
        font-size: 18px;
        font-weight: 600;
      }
      .enlace {
        white-space: nowrap;
      }
    }
    li {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
    }
    li + li {
      border-top: 1px solid var(--gris-200);
    }
    .quien {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong {
        font-weight: 600;
      }
      > span:last-child {
        font-size: 14px;
      }
    }
    .fila-titulo {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .avance {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 120px;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      app-barra-progreso {
        flex: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .atajo,
      .flecha {
        transition: none;
      }
    }
    @media (max-width: 1200px) {
      .atajos {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .paneles {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 600px) {
      .atajos {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .atajo {
        min-height: 72px;
      }
      .pendiente {
        flex-wrap: wrap;
        .btn {
          width: 100%;
        }
      }
      .avance {
        width: 88px;
      }
    }
  `,
})
export class PanelDocente {
  protected readonly auth = inject(AuthService);
  protected readonly indicadores = INDICADORES_DOCENTE;
  protected readonly atajos = ATAJOS;
  protected readonly estudiantes = ESTUDIANTES_CURSO.slice(0, 4);
  protected readonly pendientes = CURSOS_DOCENTE.filter((c) => c.estado in PRIORIDAD).sort(
    (a, b) => PRIORIDAD[a.estado]! - PRIORIDAD[b.estado]!,
  );

  /** Lo que el docente debe saber del curso (última parte del detalle). */
  protected motivo(c: CursoDocente): string {
    return c.detalle.split(' · ').at(-1)!;
  }
}
