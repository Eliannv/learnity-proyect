import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { REVISION_UX, iconoLeccion } from '../../../data/datos-demo';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';

/** Revisión de un curso (RF-24): publicar o rechazar con motivo (RN-05). */
@Component({
  selector: 'app-revision-curso',
  imports: [FormsModule, RouterLink, LucideAngularModule, EstadoCursoBadge],
  template: `
    <nav class="migas" aria-label="Ruta">
      <a routerLink="/admin">Revisión de cursos</a>
      <lucide-icon name="chevron-right" [size]="16" />
      <span>{{ curso.titulo }}</span>
    </nav>

    <div class="distribucion">
      <div class="principal">
        <section class="tarjeta resumen">
          <div class="portada"><lucide-icon name="pen-tool" [size]="40" /></div>
          <div class="info">
            <div class="fila">
              <app-estado-curso [estado]="decision() ?? 'EN_REVISION'" />
              <span class="texto-suave">{{ curso.categoria }}</span>
            </div>
            <h1>{{ curso.titulo }}</h1>
            <p class="texto-suave descripcion">{{ curso.descripcion }}</p>
            <p class="texto-suave meta">{{ curso.meta }}</p>
          </div>
        </section>

        <section class="tarjeta contenido">
          <h2>Contenido del curso</h2>
          @for (m of curso.modulos; track m.titulo) {
            <div class="cabecera-modulo">
              <strong>{{ m.titulo }}</strong>
              <span class="texto-suave">{{ m.resumen }}</span>
            </div>
            <ul>
              @for (l of m.lecciones; track l.titulo) {
                <li>
                  <lucide-icon [name]="icono(l.tipo)" [size]="22" />
                  <span class="nombre">{{ l.titulo }}</span>
                  <span class="texto-suave detalle">{{ l.detalle }}</span>
                  <button type="button" class="enlace">Ver</button>
                </li>
              }
            </ul>
          }
          <button type="button" class="enlace mas">+ 2 módulos más</button>
        </section>
      </div>

      <aside class="lateral">
        <section class="tarjeta verificacion">
          <h2>Verificación automática</h2>
          <ul>
            @for (v of curso.verificacion; track v) {
              <li><lucide-icon name="circle-check" [size]="20" /> {{ v }}</li>
            }
          </ul>
        </section>

        <section class="tarjeta decision">
          <h2>Decisión</h2>
          <p class="texto-suave">Revisa el contenido antes de publicar. Si rechazas, el docente verá tu motivo en su panel.</p>
          <textarea class="control" [class.invalido]="faltaMotivo()" [(ngModel)]="motivo" placeholder="Motivo del rechazo (obligatorio)…"></textarea>
          @if (faltaMotivo()) {
            <span class="error-campo">El rechazo debe incluir un motivo.</span>
          }
          @if (decision(); as d) {
            <div class="aviso" [class.exito]="d === 'PUBLICADO'" role="status">
              <lucide-icon [name]="d === 'PUBLICADO' ? 'circle-check' : 'info'" [size]="18" />
              <span>{{ d === 'PUBLICADO' ? 'Curso publicado (demostración).' : 'Curso devuelto al docente con tu motivo (demostración).' }}</span>
            </div>
          }
          <button type="button" class="btn btn-primario btn-lg btn-bloque" (click)="publicar()">
            <lucide-icon name="check" [size]="18" /> Aprobar y publicar
          </button>
          <button type="button" class="btn btn-peligro btn-lg btn-bloque" (click)="rechazar()">Rechazar con motivo</button>
        </section>
      </aside>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .distribucion {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 16px;
      align-items: start;
    }
    .principal,
    .lateral {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .resumen {
      display: flex;
      gap: 18px;
      padding: 16px;
    }
    .portada {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 200px;
      aspect-ratio: 16 / 9;
      border-radius: var(--radio);
      background: linear-gradient(135deg, var(--azul-600), var(--azul-700));
      color: var(--blanco);
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      h1 {
        font-size: 24px;
        font-weight: 700;
      }
      .descripcion {
        font-size: 16px;
      }
      .meta {
        font-size: 14px;
      }
    }
    .contenido {
      overflow: hidden;
      h2 {
        padding: 16px;
        font-size: 18px;
        font-weight: 600;
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        border-top: 1px solid var(--gris-200);
        lucide-icon {
          color: var(--azul-700);
        }
        .nombre {
          flex: 1;
        }
        .detalle {
          font-size: 14px;
        }
      }
      .mas {
        padding: 14px 16px;
      }
    }
    .cabecera-modulo {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--azul-050);
      border-top: 1px solid var(--gris-200);
      strong {
        font-weight: 600;
      }
      span {
        font-size: 14px;
      }
    }
    .verificacion,
    .decision {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
      h2 {
        font-size: 18px;
        font-weight: 600;
      }
    }
    .verificacion ul {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      lucide-icon {
        color: var(--verde-700);
      }
    }
    .decision p {
      font-size: 14px;
    }
    @media (max-width: 1100px) {
      .distribucion {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 600px) {
      .resumen {
        flex-direction: column;
      }
      .portada {
        width: 100%;
      }
      .contenido li {
        flex-wrap: wrap;
        .detalle {
          order: 3;
          width: 100%;
          padding-left: 34px;
        }
      }
    }
  `,
})
export class RevisionCurso {
  protected readonly curso = REVISION_UX;
  protected readonly icono = iconoLeccion;
  protected readonly decision = signal<'PUBLICADO' | 'RECHAZADO' | null>(null);
  protected readonly faltaMotivo = signal(false);
  protected motivo = '';

  protected publicar() {
    this.faltaMotivo.set(false);
    this.decision.set('PUBLICADO');
  }

  protected rechazar() {
    if (!this.motivo.trim()) {
      this.faltaMotivo.set(true);
      return;
    }
    this.faltaMotivo.set(false);
    this.decision.set('RECHAZADO');
  }
}
