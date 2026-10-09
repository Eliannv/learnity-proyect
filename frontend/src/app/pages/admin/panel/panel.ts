import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CURSOS_EN_REVISION, INDICADORES_ADMIN, SOLICITUDES } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';
import { Indicador } from '../../../shared/ui/indicador';

/** Panel de administración (RF-25): indicadores y tareas pendientes. */
@Component({
  selector: 'app-panel-admin',
  imports: [RouterLink, Avatar, EstadoCursoBadge, Indicador],
  template: `
    <header>
      <h1 class="titulo-pagina">Panel de administración</h1>
      <p class="subtitulo">Resumen de la plataforma y tareas pendientes de revisión.</p>
    </header>

    <div class="grid-stats">
      @for (i of indicadores; track i.etiqueta) {
        <app-indicador [etiqueta]="i.etiqueta" [valor]="i.valor" [nota]="i.nota" [icono]="i.icono" />
      }
    </div>

    <div class="paneles">
      <section class="tarjeta panel">
        <div class="cabecera-panel">
          <h2>Solicitudes de docente</h2>
          <a class="enlace" routerLink="/admin/solicitudes">Ver todas ({{ solicitudes.length }})</a>
        </div>
        <ul>
          @for (s of solicitudes.slice(0, 3); track s.nombre) {
            <li class="solicitud">
              <app-avatar [texto]="s.iniciales" [tamano]="48" />
              <div class="quien">
                <strong>{{ s.nombre }}</strong>
                <span class="texto-suave">{{ s.especialidad }} · {{ s.cuando.split(',')[0] }}</span>
              </div>
              <div class="botones">
                <a class="btn btn-peligro" routerLink="/admin/solicitudes">Rechazar</a>
                <a class="btn btn-primario" routerLink="/admin/solicitudes">Aprobar</a>
              </div>
            </li>
          }
        </ul>
      </section>

      <section class="tarjeta panel">
        <div class="cabecera-panel">
          <h2>Cursos en revisión</h2>
          <a class="enlace" routerLink="/admin/revision">Ver todos ({{ cursos.length }})</a>
        </div>
        <ul>
          @for (c of cursos; track c.id) {
            <li class="curso">
              <div class="quien">
                <strong>{{ c.titulo }}</strong>
                <span class="texto-suave">{{ c.detalle }}</span>
              </div>
              <app-estado-curso estado="EN_REVISION" class="estado-ancho" />
              <a class="btn btn-suave" [routerLink]="'/admin/revision/' + c.id">Revisar</a>
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
      padding: 16px 20px;
      border-bottom: 1px solid var(--gris-200);
      h2 {
        font-size: 18px;
        font-weight: 600;
      }
    }
    li {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
    }
    li + li {
      border-top: 1px solid var(--gris-200);
    }
    .quien {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      strong {
        font-weight: 600;
      }
      span {
        font-size: 14px;
      }
    }
    .botones {
      display: flex;
      gap: 10px;
    }
    @media (max-width: 1440px) and (min-width: 1201px) {
      .estado-ancho {
        display: none;
      }
    }
    @media (max-width: 1200px) {
      .paneles {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 600px) {
      .estado-ancho {
        display: none;
      }
    }
    @media (max-width: 600px) {
      .solicitud {
        flex-wrap: wrap;
        .botones {
          width: 100%;
          .btn {
            flex: 1;
          }
        }
      }
    }
  `,
})
export class PanelAdmin {
  protected readonly indicadores = INDICADORES_ADMIN;
  protected readonly solicitudes = SOLICITUDES;
  protected readonly cursos = CURSOS_EN_REVISION;
}
