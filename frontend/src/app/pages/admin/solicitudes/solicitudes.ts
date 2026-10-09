import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SOLICITUDES } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';

/** Solicitudes de docente (RF-22): aprobar asigna el rol Docente y conserva el de Estudiante. */
@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule, LucideAngularModule, Avatar],
  template: `
    <header>
      <h1 class="titulo-pagina">Solicitudes de docente</h1>
      <p class="subtitulo">
        Revisa las solicitudes de estudiantes que desean enseñar. Al aprobar, la cuenta obtiene el rol Docente y conserva el de Estudiante.
      </p>
    </header>

    <div class="distribucion">
      <section class="tarjeta lista">
        <div class="pestanas">
          <button type="button" class="activa">Pendientes ({{ solicitudes.length }})</button>
          <button type="button">Aprobadas</button>
          <button type="button">Rechazadas</button>
        </div>
        <ul>
          @for (s of solicitudes; track s.correo; let i = $index) {
            <li>
              <button type="button" class="item" [class.seleccionado]="i === indice()" (click)="seleccionar(i)">
                <app-avatar [texto]="s.iniciales" [tamano]="44" />
                <span class="quien">
                  <strong>{{ s.nombre }}</strong>
                  <span class="texto-suave">{{ s.especialidad }}</span>
                </span>
                <span class="texto-suave cuando">{{ s.cuando }}</span>
              </button>
            </li>
          }
        </ul>
      </section>

      <section class="tarjeta detalle">
        <div class="cabecera">
          <app-avatar [texto]="actual().iniciales" [tamano]="72" />
          <div class="quien">
            <h2>{{ actual().nombre }}</h2>
            <span class="texto-suave">{{ actual().correo }} · Estudiante desde el {{ actual().estudianteDesde }}</span>
          </div>
          <span class="pendiente" [class.aprobada]="decision() === 'APROBADA'" [class.rechazada]="decision() === 'RECHAZADA'">
            {{ decision() === 'APROBADA' ? 'Aprobada' : decision() === 'RECHAZADA' ? 'Rechazada' : 'Pendiente' }}
          </span>
        </div>

        <div class="datos">
          <div class="dato">
            <span class="eyebrow">Especialidad</span>
            <strong>{{ actual().especialidad }}</strong>
          </div>
          <div class="dato">
            <span class="eyebrow">Enviada</span>
            <strong>{{ actual().enviada }}</strong>
          </div>
          <div class="dato">
            <span class="eyebrow">Cursos completados</span>
            <strong>{{ actual().cursosCompletados }}</strong>
          </div>
        </div>

        <div>
          <h3>Motivación</h3>
          <p>{{ actual().motivacion }}</p>
        </div>

        <div class="campo">
          <label class="etiqueta" for="observacion">Observación (obligatoria si rechazas)</label>
          <textarea
            id="observacion"
            class="control"
            [class.invalido]="faltaObservacion()"
            [(ngModel)]="observacion"
            placeholder="Escribe el motivo para que el estudiante sepa qué mejorar…"
          ></textarea>
          @if (faltaObservacion()) {
            <span class="error-campo">Escribe la observación para poder rechazar.</span>
          }
        </div>

        @if (decision()) {
          <div class="aviso" [class.exito]="decision() === 'APROBADA'" role="status">
            <lucide-icon [name]="decision() === 'APROBADA' ? 'circle-check' : 'info'" [size]="18" />
            <span>
              {{ decision() === 'APROBADA'
                ? 'Solicitud aprobada (demostración): en el Sprint 2 se agrega el rol Docente y se crea su perfil docente.'
                : 'Solicitud rechazada (demostración): el estudiante verá tu observación.' }}
            </span>
          </div>
        }

        <div class="botones">
          <button type="button" class="btn btn-peligro btn-lg" (click)="rechazar()"><lucide-icon name="x" [size]="18" /> Rechazar</button>
          <button type="button" class="btn btn-primario btn-lg" (click)="decision.set('APROBADA')">
            <lucide-icon name="check" [size]="18" /> Aprobar y asignar rol Docente
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .distribucion {
      display: grid;
      grid-template-columns: 360px 1fr;
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
      gap: 16px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--gris-200);
      button {
        border: 0;
        background: none;
        color: var(--gris-500);
        font-weight: 500;
        font-size: 14px;
        white-space: nowrap;
        &.activa {
          color: var(--azul-700);
          font-weight: 600;
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
    .cabecera {
      display: flex;
      align-items: center;
      gap: 16px;
      h2 {
        font-size: 22px;
        font-weight: 600;
      }
    }
    .pendiente {
      align-self: flex-start;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--ambar-100);
      color: var(--ambar-600);
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
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .dato {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      border-radius: var(--radio);
      background: var(--azul-050);
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
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 600px) {
      .datos {
        grid-template-columns: 1fr;
      }
      .cabecera {
        flex-wrap: wrap;
      }
      .botones .btn {
        width: 100%;
      }
    }
  `,
})
export class Solicitudes {
  protected readonly solicitudes = SOLICITUDES;
  protected readonly indice = signal(0);
  protected readonly actual = computed(() => this.solicitudes[this.indice()]!);
  protected readonly decision = signal<'APROBADA' | 'RECHAZADA' | null>(null);
  protected readonly faltaObservacion = signal(false);
  protected observacion = '';

  protected seleccionar(i: number) {
    this.indice.set(i);
    this.decision.set(null);
    this.faltaObservacion.set(false);
    this.observacion = '';
  }

  protected rechazar() {
    if (!this.observacion.trim()) {
      this.faltaObservacion.set(true);
      return;
    }
    this.faltaObservacion.set(false);
    this.decision.set('RECHAZADA');
  }
}
