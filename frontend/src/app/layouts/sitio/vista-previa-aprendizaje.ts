import { Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AprendizajeApi, type CursoInscrito } from '../../features/aprendizaje/aprendizaje.api';
import { BarraProgreso } from '../../shared/ui/datos/barra-progreso';
import { PortadaCurso } from '../../shared/ui/cursos/portada-curso';

/**
 * Enlace "Mi aprendizaje" del header. Al pasar el mouse (o al enfocarlo con el teclado)
 * muestra los cursos con actividad reciente y su avance; cada uno retoma la última lección.
 */
@Component({
  selector: 'app-vista-previa-aprendizaje',
  imports: [RouterLink, BarraProgreso, PortadaCurso],
  host: {
    '(mouseenter)': 'abrir()',
    '(mouseleave)': 'cerrarConPausa()',
    '(focusin)': 'abrir()',
    '(focusout)': 'alPerderFoco($event)',
    '(document:keydown.escape)': 'abierto.set(false)',
  },
  template: `
    <a class="disparador" routerLink="/mi-aprendizaje" [class.activo]="abierto()" [attr.aria-expanded]="abierto()" (click)="abierto.set(false)">
      Mi aprendizaje
    </a>

    @if (abierto()) {
      <div class="panel">
        @if (cargando() && !recientes()) {
          <div class="cargando" aria-busy="true" aria-label="Cargando tus cursos">
            @for (i of [1, 2]; track i) { <span class="esqueleto fila-esqueleto"></span> }
          </div>
        } @else if (error()) {
          <p class="vacio">No se pudieron cargar tus cursos. Abre Mi aprendizaje para verlos.</p>
        } @else if (recientes()?.length) {
          <ul>
            @for (i of recientes(); track i.curso.id) {
              <li>
                <a [routerLink]="ruta(i)" (click)="abierto.set(false)">
                  <span class="miniatura">
                    <app-portada-curso [iconoCategoria]="i.curso.categoria.icono" [imagen]="i.curso.portadaUrl" [compacta]="true" />
                  </span>
                  <span class="texto">
                    <strong>{{ i.curso.titulo }}</strong>
                    @if (i.inscripcion.progresoPct === 0) {
                      <small>Empieza el curso</small>
                    } @else {
                      <app-barra-progreso [valor]="i.inscripcion.progresoPct" [etiqueta]="'Progreso de ' + i.curso.titulo" />
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="vacio">Aún no te inscribes en ningún curso. Explora el catálogo y empieza hoy.</p>
        }
        <div class="pie">
          <a class="btn btn-primario btn-bloque" routerLink="/mi-aprendizaje" (click)="abierto.set(false)">Ir a Mi aprendizaje</a>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .disparador {
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 10px;
      border-radius: var(--radio);
      color: var(--tinta-900);
      font-weight: 600;
      white-space: nowrap;
      &:hover,
      &.activo {
        background: var(--azul-050);
        color: var(--azul-700);
      }
    }
    /* Puente invisible para que el mouse no "caiga" entre el enlace y el panel */
    .panel::before {
      content: '';
      position: absolute;
      top: -12px;
      left: 0;
      right: 0;
      height: 12px;
    }
    .panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 70;
      width: 340px;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-md);
      background: var(--blanco);
      box-shadow: 0 16px 40px rgb(15 23 42 / 16%);
      animation: aparecer 0.14s ease-out;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li + li {
      border-top: 1px solid var(--gris-200);
    }
    li a {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      color: var(--tinta-900);
      &:hover {
        background: var(--azul-050);
        strong {
          color: var(--azul-700);
        }
      }
    }
    .miniatura {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      border-radius: var(--radio);
      overflow: hidden;
    }
    .texto {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      strong {
        font-size: 14px;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      small {
        font-size: 13px;
        color: var(--azul-700);
        font-weight: 600;
      }
    }
    .cargando {
      display: grid;
      gap: 10px;
      padding: 14px 16px 4px;
    }
    .fila-esqueleto {
      height: 64px;
      border-radius: var(--radio);
    }
    .vacio {
      padding: 20px 16px 4px;
      font-size: 14px;
      color: var(--gris-500);
    }
    .pie {
      padding: 14px 16px 16px;
      border-top: 1px solid var(--gris-200);
    }
    @keyframes aparecer {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
    }
  `,
})
export class VistaPreviaAprendizaje implements OnDestroy {
  private readonly elemento = inject(ElementRef<HTMLElement>);
  private readonly api = inject(AprendizajeApi);
  private temporizador?: ReturnType<typeof setTimeout>;
  private cargadoEn = 0;

  /** Hasta 4 cursos sin terminar, de la inscripción más reciente a la más antigua (GET /api/mi-aprendizaje). */
  protected readonly recientes = signal<CursoInscrito[] | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal(false);
  protected readonly abierto = signal(false);

  protected abrir() {
    clearTimeout(this.temporizador);
    this.abierto.set(true);
    // Se pide al abrir el panel, como mucho cada 30 s, para no cargar la API en cada pasada del mouse.
    if (!this.cargando() && Date.now() - this.cargadoEn > 30_000) void this.cargar();
  }

  protected ruta(i: CursoInscrito): string {
    return i.inscripcion.ultimaLeccionId
      ? `/aprender/${i.curso.id}/${i.inscripcion.ultimaLeccionId}`
      : `/cursos/${i.curso.id}`;
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const { items } = await this.api.listar();
      this.recientes.set(items.filter((i) => i.inscripcion.estado !== 'COMPLETADA').slice(0, 4));
      this.error.set(false);
      this.cargadoEn = Date.now();
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Pequeña pausa al salir: evita que el panel se cierre al mover el mouse en diagonal. */
  protected cerrarConPausa() {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.abierto.set(false), 180);
  }

  protected alPerderFoco(evento: FocusEvent) {
    if (!this.elemento.nativeElement.contains(evento.relatedTarget as Node | null)) this.abierto.set(false);
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
  }
}
