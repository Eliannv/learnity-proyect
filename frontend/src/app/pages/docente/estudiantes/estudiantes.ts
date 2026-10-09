import { Component } from '@angular/core';
import { ESTUDIANTES_CURSO, INDICADORES_ESTUDIANTES } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';
import { Indicador } from '../../../shared/ui/indicador';

/** Estudiantes inscritos en un curso del docente y su avance (RF-20). */
@Component({
  selector: 'app-estudiantes-curso',
  imports: [Avatar, BarraProgreso, Indicador],
  template: `
    <header class="cabecera">
      <div>
        <h1 class="titulo-pagina">Estudiantes del curso</h1>
        <p class="subtitulo">Introducción a Python · 128 inscritos · progreso promedio 54 %</p>
      </div>
      <select class="control selector" aria-label="Curso">
        <option>Introducción a Python</option>
        <option>JavaScript para la web</option>
      </select>
    </header>

    <div class="grid-stats">
      @for (i of indicadores; track i.etiqueta) {
        <app-indicador [etiqueta]="i.etiqueta" [valor]="i.valor" [nota]="i.nota" />
      }
    </div>

    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Inscrito</th>
            <th>Progreso</th>
            <th>Última actividad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (e of estudiantes; track e.nombre) {
            <tr>
              <td>
                <div class="persona">
                  <app-avatar [texto]="e.iniciales" [tamano]="40" />
                  <strong>{{ e.nombre }}</strong>
                </div>
              </td>
              <td class="texto-suave">{{ e.inscrito }}</td>
              <td>
                <div class="progreso">
                  <app-barra-progreso [valor]="e.progreso" [verde]="e.completado" />
                  <strong>{{ e.progreso }} %</strong>
                </div>
              </td>
              <td class="texto-suave">{{ e.actividad }}</td>
              <td>
                <span class="chip" [class.completado]="e.completado" [class.en-curso]="!e.completado">
                  {{ e.completado ? 'Completado' : 'En curso' }}
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="texto-suave nota">Por privacidad, solo ves el progreso de los estudiantes inscritos en tus cursos.</p>
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
    .selector {
      width: 240px;
      font-weight: 600;
    }
    .persona {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
      strong {
        font-weight: 600;
      }
    }
    .progreso {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 200px;
      app-barra-progreso {
        flex: 1;
      }
      strong {
        width: 48px;
        text-align: right;
      }
    }
    .chip.en-curso {
      background: var(--azul-100);
      color: var(--azul-700);
      font-weight: 600;
    }
    .chip.completado {
      background: var(--verde-100);
      color: var(--verde-700);
      font-weight: 600;
    }
    .nota {
      font-size: 14px;
    }
    td {
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .cabecera {
        flex-direction: column;
      }
      .selector {
        width: 100%;
      }
    }
  `,
})
export class EstudiantesCurso {
  protected readonly estudiantes = ESTUDIANTES_CURSO;
  protected readonly indicadores = INDICADORES_ESTUDIANTES;
}
