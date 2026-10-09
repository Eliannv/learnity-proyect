import { Component, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { USUARIOS } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';

type Filtro = 'Todos' | 'Estudiante' | 'Docente' | 'Administrador';

/** Gestión de usuarios (RF-21): buscar, filtrar por rol, activar/desactivar y editar roles. */
@Component({
  selector: 'app-usuarios',
  imports: [LucideAngularModule, Avatar],
  template: `
    <header>
      <h1 class="titulo-pagina">Usuarios</h1>
      <p class="subtitulo">Gestiona cuentas, activa o desactiva usuarios y asigna el rol de Docente.</p>
    </header>

    <div class="filtros">
      <label class="control-icono buscador">
        <lucide-icon name="search" [size]="18" />
        <input class="control" type="search" placeholder="Buscar por nombre o correo" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
      </label>
      @for (f of filtros; track f.valor) {
        <button type="button" class="chip-filtro" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">{{ f.texto }}</button>
      }
    </div>

    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Roles</th>
            <th>Estado</th>
            <th>Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (u of lista(); track u.correo) {
            <tr>
              <td>
                <div class="persona">
                  <app-avatar [texto]="u.iniciales" [tamano]="40" />
                  <strong>{{ u.nombre }}</strong>
                </div>
              </td>
              <td class="texto-suave">{{ u.correo }}</td>
              <td>
                <div class="roles">
                  @for (r of u.roles; track r) {
                    <span class="chip" [class.docente]="r === 'Docente'" [class.admin]="r === 'Administrador'">{{ r }}</span>
                  }
                </div>
              </td>
              <td>
                <button type="button" class="punto-estado" [class.activo]="estados()[u.correo]" [class.inactivo]="!estados()[u.correo]" (click)="alternarEstado(u.correo)" title="Activar o desactivar">
                  {{ estados()[u.correo] ? 'Activo' : 'Inactivo' }}
                </button>
              </td>
              <td class="texto-suave">{{ u.registro }}</td>
              <td>
                <div class="acciones">
                  <button type="button" class="btn btn-suave btn-sm">Editar roles</button>
                  <button type="button" class="icono-btn" aria-label="Más acciones"><lucide-icon name="ellipsis-vertical" [size]="18" /></button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="texto-suave vacio">No hay usuarios que coincidan con la búsqueda.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <div class="paginacion">
      <span class="texto-suave">Mostrando {{ lista().length }} de 1 248 usuarios</span>
      <nav>
        <button type="button" class="enlace"><lucide-icon name="arrow-left" [size]="16" /> Anterior</button>
        <span class="paginas">1 2 3 … 208</span>
        <button type="button" class="enlace">Siguiente <lucide-icon name="arrow-right" [size]="16" /></button>
      </nav>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .buscador {
      flex: 0 1 380px;
    }
    .persona {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }
    .roles {
      display: flex;
      gap: 6px;
    }
    .chip.docente {
      background: var(--azul-100);
      color: var(--azul-700);
      font-weight: 600;
    }
    .chip.admin {
      background: var(--tinta-900);
      color: var(--blanco);
    }
    .punto-estado {
      border: 0;
      cursor: pointer;
    }
    .acciones {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .icono-btn {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--radio);
      background: none;
      color: var(--gris-500);
      &:hover {
        background: var(--gris-100);
      }
    }
    td {
      white-space: nowrap;
      font-size: 14px;
    }
    .tabla td,
    .tabla th {
      padding-left: 12px;
      padding-right: 12px;
    }
    .vacio {
      text-align: center;
      padding: 32px;
    }
    .paginacion {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      nav {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .enlace {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .paginas {
        color: var(--azul-700);
        font-weight: 600;
        word-spacing: 6px;
      }
    }
  `,
})
export class Usuarios {
  protected readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'Todos', texto: 'Todos · 1 248' },
    { valor: 'Estudiante', texto: 'Estudiantes · 1 212' },
    { valor: 'Docente', texto: 'Docentes · 36' },
    { valor: 'Administrador', texto: 'Administradores · 2' },
  ];
  protected readonly filtro = signal<Filtro>('Todos');
  protected readonly busqueda = signal('');
  protected readonly estados = signal<Record<string, boolean>>(Object.fromEntries(USUARIOS.map((u) => [u.correo, u.activo])));

  protected readonly lista = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return USUARIOS.filter(
      (u) =>
        (this.filtro() === 'Todos' || u.roles.includes(this.filtro() as Exclude<Filtro, 'Todos'>)) &&
        (!termino || u.nombre.toLowerCase().includes(termino) || u.correo.includes(termino)),
    );
  });

  protected alternarEstado(correo: string) {
    this.estados.update((e) => ({ ...e, [correo]: !e[correo] }));
  }
}
