import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { fechaCorta } from '../../../core/auth/perfil.service';
import {
  type EstadoSolicitud,
  type SolicitudDocente,
  SolicitudesDocenteService,
} from '../../../core/solicitudes/solicitudes-docente.service';
import { Avatar } from '../../../shared/ui/avatar';
import { mensajeDeError } from '../../auth/mensaje-error';

const PESTANAS: { estado: EstadoSolicitud; texto: string }[] = [
  { estado: 'PENDIENTE', texto: 'Pendientes' },
  { estado: 'APROBADA', texto: 'Aprobadas' },
  { estado: 'RECHAZADA', texto: 'Rechazadas' },
];

const hora = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' });

/** Solicitudes de docente (RF-22): aprobar asigna el rol Docente y conserva el de Estudiante. */
@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule, LucideAngularModule, Avatar],
  template: `
    <header class="encabezado">
      <div>
        <h1 class="titulo-pagina">Solicitudes de docente</h1>
        <p class="subtitulo">
          Revisa las solicitudes de estudiantes que desean enseñar. Al aprobar, la cuenta obtiene el rol Docente y conserva el de Estudiante.
        </p>
      </div>
      <button type="button" class="btn btn-contorno" [disabled]="cargando()" (click)="cargar()">
        <lucide-icon name="rotate-ccw" [size]="16" /> Actualizar
      </button>
    </header>

    @if (aviso(); as a) {
      <div class="aviso" [class.exito]="a.tipo === 'exito'" role="status">
        <lucide-icon [name]="a.tipo === 'exito' ? 'circle-check' : 'info'" [size]="18" />
        <span>{{ a.texto }}</span>
      </div>
    }

    <div class="distribucion">
      <section class="tarjeta lista" aria-label="Solicitudes">
        <div class="pestanas" role="tablist">
          @for (p of pestanas; track p.estado) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="estado() === p.estado"
              [class.activa]="estado() === p.estado"
              (click)="cambiarEstado(p.estado)"
            >
              {{ p.texto }}@if (estado() === p.estado && !cargando()) { ({{ solicitudes().length }}) }
            </button>
          }
        </div>

        @if (cargando()) {
          <p class="vacio" role="status">Cargando solicitudes…</p>
        } @else if (error()) {
          <div class="vacio" role="alert">
            <p>{{ error() }}</p>
            <button type="button" class="btn btn-contorno" (click)="cargar()">Reintentar</button>
          </div>
        } @else {
          <ul>
            @for (s of solicitudes(); track s.id) {
              <li>
                <button type="button" class="item" [class.seleccionado]="s.id === idActual()" (click)="seleccionar(s.id)">
                  <app-avatar [texto]="iniciales(s)" [tamano]="44" />
                  <span class="quien">
                    <strong>{{ s.solicitante.nombres }} {{ s.solicitante.apellidos }}</strong>
                    <span class="texto-suave">{{ s.especialidad }}</span>
                  </span>
                  <span class="texto-suave cuando">{{ cuando(s) }}</span>
                </button>
              </li>
            } @empty {
              <li class="vacio">
                <lucide-icon name="inbox" [size]="28" />
                <p>{{ textoVacio() }}</p>
              </li>
            }
          </ul>
        }
      </section>

      @if (actual(); as s) {
        <section class="tarjeta detalle" aria-live="polite">
          <div class="cabecera">
            <app-avatar [texto]="iniciales(s)" [tamano]="72" />
            <div class="quien">
              <h2>{{ s.solicitante.nombres }} {{ s.solicitante.apellidos }}</h2>
              <span class="texto-suave">{{ s.solicitante.correo }} · Estudiante desde el {{ fecha(s.solicitante.estudianteDesde) }}</span>
            </div>
            <span class="estado" [class.aprobada]="s.estado === 'APROBADA'" [class.rechazada]="s.estado === 'RECHAZADA'">
              {{ s.estado === 'APROBADA' ? 'Aprobada' : s.estado === 'RECHAZADA' ? 'Rechazada' : 'Pendiente' }}
            </span>
          </div>

          <div class="datos">
            <div class="dato">
              <span class="eyebrow">Especialidad</span>
              <strong>{{ s.especialidad }}</strong>
            </div>
            <div class="dato">
              <span class="eyebrow">Enviada</span>
              <strong>{{ fecha(s.enviadaEn) }}</strong>
            </div>
            <div class="dato">
              <span class="eyebrow">Cursos completados</span>
              <strong>{{ s.solicitante.cursosCompletados }}</strong>
            </div>
          </div>

          <div>
            <h3>Motivación</h3>
            <p class="multilinea">{{ s.motivo }}</p>
          </div>

          @if (s.estado === 'PENDIENTE') {
            <div class="campo">
              <label class="etiqueta" for="observacion">Observación (obligatoria si rechazas)</label>
              <textarea
                id="observacion"
                class="control"
                maxlength="300"
                [class.invalido]="faltaObservacion()"
                [(ngModel)]="observacion"
                [disabled]="decidiendo()"
                placeholder="Escribe el motivo para que el estudiante sepa qué mejorar…"
              ></textarea>
              @if (faltaObservacion()) {
                <span class="error-campo">Escribe la observación para poder rechazar.</span>
              } @else {
                <span class="ayuda">{{ observacion.length }}/300 caracteres. El estudiante la verá en su perfil.</span>
              }
            </div>

            @if (errorDecision()) {
              <div class="aviso error" role="alert">
                <lucide-icon name="circle-alert" [size]="18" />
                <span>{{ errorDecision() }}</span>
              </div>
            }

            <div class="botones">
              <button type="button" class="btn btn-peligro btn-lg" [disabled]="decidiendo()" (click)="rechazar(s)">
                <lucide-icon name="x" [size]="18" /> Rechazar
              </button>
              <button type="button" class="btn btn-primario btn-lg" [disabled]="decidiendo()" (click)="aprobar(s)">
                <lucide-icon name="check" [size]="18" /> {{ decidiendo() ? 'Guardando…' : 'Aprobar y asignar rol Docente' }}
              </button>
            </div>
          } @else {
            <div class="aviso" [class.exito]="s.estado === 'APROBADA'">
              <lucide-icon [name]="s.estado === 'APROBADA' ? 'circle-check' : 'info'" [size]="18" />
              <span>
                {{ s.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada' }} el {{ fecha(s.revisadaEn) }}.
                @if (s.observacion) { Observación: {{ s.observacion }} }
              </span>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .encabezado {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      .subtitulo {
        max-width: 720px;
      }
    }
    .distribucion {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .lista ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .pestanas {
      display: flex;
      gap: 4px;
      padding: 8px;
      border-bottom: 1px solid var(--gris-200);
      overflow-x: auto;
      button {
        min-height: 40px;
        padding: 0 12px;
        border: 0;
        border-radius: var(--radio);
        background: none;
        color: var(--gris-500);
        font-weight: 500;
        font-size: 14px;
        white-space: nowrap;
        &.activa {
          background: var(--azul-050);
          color: var(--azul-700);
          font-weight: 600;
        }
        &:hover:not(.activa) {
          background: var(--gris-100);
        }
      }
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border: 0;
      border-left: 3px solid transparent;
      background: none;
      text-align: left;
      &.seleccionado {
        background: var(--azul-050);
        border-left-color: var(--azul-700);
      }
      &:hover:not(.seleccionado) {
        background: var(--gris-100);
      }
    }
    li + li .item {
      border-top: 1px solid var(--gris-200);
    }
    .vacio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 32px 16px;
      color: var(--gris-500);
      text-align: center;
    }
    .quien {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow-wrap: anywhere;
      strong {
        font-weight: 600;
      }
      span {
        font-size: 14px;
      }
    }
    .cuando {
      font-size: 13px;
      white-space: nowrap;
    }
    .detalle {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      h3 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 6px;
      }
    }
    .multilinea {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: 16px;
      h2 {
        font-size: 22px;
        font-weight: 600;
      }
    }
    .estado {
      align-self: flex-start;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--ambar-100);
      color: var(--ambar-800);
      font-weight: 600;
      font-size: 14px;
      &.aprobada {
        background: var(--verde-100);
        color: var(--verde-700);
      }
      &.rechazada {
        background: var(--rojo-050);
        color: var(--rojo-700);
      }
    }
    .datos {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .dato {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      border-radius: var(--radio);
      background: var(--azul-050);
      overflow-wrap: anywhere;
      strong {
        font-size: 17px;
        font-weight: 600;
      }
    }
    .botones {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
    }
    @media (max-width: 1100px) {
      .distribucion {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 600px) {
      .datos {
        grid-template-columns: minmax(0, 1fr);
      }
      .cabecera {
        flex-wrap: wrap;
        justify-content: space-between;
        .quien {
          flex-basis: 100%;
          order: 3;
        }
      }
      .detalle {
        padding: 18px;
      }
      .botones .btn {
        width: 100%;
      }
    }
  `,
})
export class Solicitudes {
  private readonly api = inject(SolicitudesDocenteService);

  protected readonly pestanas = PESTANAS;
  protected readonly estado = signal<EstadoSolicitud>('PENDIENTE');
  protected readonly solicitudes = signal<SolicitudDocente[]>([]);
  protected readonly seleccionada = signal<number | null>(null);
  protected readonly actual = computed(
    () => this.solicitudes().find((s) => s.id === this.seleccionada()) ?? this.solicitudes()[0] ?? null,
  );
  protected readonly idActual = computed(() => this.actual()?.id ?? null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly decidiendo = signal(false);
  protected readonly errorDecision = signal<string | null>(null);
  protected readonly faltaObservacion = signal(false);
  protected readonly aviso = signal<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  protected readonly textoVacio = computed(() =>
    this.estado() === 'PENDIENTE'
      ? 'No hay solicitudes pendientes. Cuando un estudiante pida ser docente, aparecerá aquí.'
      : this.estado() === 'APROBADA'
        ? 'Todavía no has aprobado solicitudes.'
        : 'No hay solicitudes rechazadas.',
  );
  protected observacion = '';
  protected readonly fecha = fechaCorta;

  constructor() {
    void this.cargar();
  }

  protected async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.solicitudes.set(await this.api.listar(this.estado()));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'La carga de solicitudes'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cambiarEstado(estado: EstadoSolicitud) {
    if (estado === this.estado()) return;
    this.estado.set(estado);
    this.seleccionada.set(null);
    this.aviso.set(null);
    this.limpiarDecision();
    void this.cargar();
  }

  protected seleccionar(id: number) {
    this.seleccionada.set(id);
    this.limpiarDecision();
  }

  protected iniciales(s: SolicitudDocente): string {
    return (s.solicitante.nombres.charAt(0) + s.solicitante.apellidos.charAt(0)).toUpperCase();
  }

  /** "Hoy, 09:14" o la fecha corta. */
  protected cuando(s: SolicitudDocente): string {
    const f = new Date(this.estado() === 'PENDIENTE' ? s.enviadaEn : (s.revisadaEn ?? s.enviadaEn));
    return f.toDateString() === new Date().toDateString() ? `Hoy, ${hora.format(f)}` : fechaCorta(f.toISOString());
  }

  protected aprobar(s: SolicitudDocente) {
    void this.decidir(s, { decision: 'APROBAR' }, `${s.solicitante.nombres} ya es docente. Verá su panel al volver a entrar o al recargar.`);
  }

  protected rechazar(s: SolicitudDocente) {
    const observacion = this.observacion.trim();
    if (!observacion) {
      this.faltaObservacion.set(true);
      return;
    }
    void this.decidir(s, { decision: 'RECHAZAR', observacion }, `Solicitud de ${s.solicitante.nombres} rechazada. Verá tu observación en su perfil.`);
  }

  private async decidir(s: SolicitudDocente, decision: Parameters<SolicitudesDocenteService['decidir']>[1], exito: string) {
    this.faltaObservacion.set(false);
    this.errorDecision.set(null);
    this.decidiendo.set(true);
    try {
      await this.api.decidir(s.id, decision);
      // Sale de "Pendientes": la siguiente queda seleccionada.
      this.solicitudes.update((lista) => lista.filter((x) => x.id !== s.id));
      this.seleccionada.set(null);
      this.observacion = '';
      this.aviso.set({ tipo: 'exito', texto: exito });
    } catch (e) {
      this.errorDecision.set(mensajeDeError(e, 'La decisión'));
    } finally {
      this.decidiendo.set(false);
    }
  }

  private limpiarDecision() {
    this.observacion = '';
    this.faltaObservacion.set(false);
    this.errorDecision.set(null);
  }
}
