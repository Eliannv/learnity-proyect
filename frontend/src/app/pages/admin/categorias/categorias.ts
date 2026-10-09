import { Component, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CATEGORIAS_ADMIN } from '../../../data/datos-demo';

/** Categorías del catálogo (RF-23): crear, editar, activar y desactivar. */
@Component({
  selector: 'app-categorias',
  imports: [LucideAngularModule],
  template: `
    <header class="cabecera">
      <div>
        <h1 class="titulo-pagina">Categorías</h1>
        <p class="subtitulo">Organizan el catálogo. Los docentes eligen una categoría al crear su curso.</p>
      </div>
      <button type="button" class="btn btn-primario btn-lg"><lucide-icon name="plus" [size]="20" /> Nueva categoría</button>
    </header>

    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Cursos</th>
            <th>Estudiantes</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (c of categorias(); track c.nombre; let i = $index) {
            <tr>
              <td>
                <div class="nombre">
                  <span class="icono"><lucide-icon [name]="c.icono" [size]="20" /></span>
                  <strong>{{ c.nombre }}</strong>
                </div>
              </td>
              <td>{{ c.cursos }}</td>
              <td>{{ c.estudiantes }}</td>
              <td>
                <span class="punto-estado" [class.activo]="c.activa" [class.inactivo]="!c.activa">{{ c.activa ? 'Activa' : 'Inactiva' }}</span>
              </td>
              <td>
                <div class="acciones">
                  <button type="button" class="enlace">Editar</button>
                  <button type="button" class="enlace" [class.peligro]="c.activa" (click)="alternar(i)">{{ c.activa ? 'Desactivar' : 'Activar' }}</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
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
    .nombre {
      display: flex;
      align-items: center;
      gap: 14px;
      strong {
        font-weight: 600;
      }
    }
    .icono {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radio);
      background: var(--azul-100);
      color: var(--azul-700);
    }
    .acciones {
      display: flex;
      gap: 20px;
    }
    .peligro {
      color: var(--rojo-700);
    }
    td {
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .cabecera {
        flex-direction: column;
        .btn {
          width: 100%;
        }
      }
    }
  `,
})
export class Categorias {
  protected readonly categorias = signal(CATEGORIAS_ADMIN.map((c) => ({ ...c })));

  protected alternar(i: number) {
    this.categorias.update((lista) => lista.map((c, idx) => (idx === i ? { ...c, activa: !c.activa } : c)));
  }
}
