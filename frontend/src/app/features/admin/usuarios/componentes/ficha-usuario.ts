import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Avatar } from '../../../../shared/ui/marca/avatar';
import { EstadoVistaComponent } from '../../../../shared/ui/retroalimentacion/estado-vista';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { resumirNavegador } from '../../../../shared/util/navegador';
import type { DetalleUsuarioAdmin, RolUsuario } from '../usuarios.api';

const NOMBRE_ROL: Record<RolUsuario, string> = { ESTUDIANTE: 'Estudiante', DOCENTE: 'Docente', ADMIN: 'Administrador' };
const ESTADO_CURSO: Record<DetalleUsuarioAdmin['cursosCreados'][number]['estado'], string> = {
  BORRADOR: 'Borrador', EN_REVISION: 'En revisión', PUBLICADO: 'Publicado', RECHAZADO: 'Rechazado', ARCHIVADO: 'Archivado',
  SUSPENDIDO: 'Suspendido',
};

/** Acción de la ficha en curso, para deshabilitar su botón mientras responde la API. */
export type AccionFicha = 'desbloquear' | 'sesiones' | null;

/**
 * Ficha de una cuenta (presentación): datos, bloqueo, sesiones abiertas, inscripciones y cursos creados.
 * Las acciones se emiten; la página las ejecuta y vuelve a cargar el detalle.
 */
@Component({
  selector: 'app-ficha-usuario',
  imports: [DatePipe, LucideAngularModule, Avatar, EstadoVistaComponent, Modal],
  template: `
    <app-modal [titulo]="titulo()" icono="user" [ancho]="760" (cerrar)="cerrar.emit()">
      @if (error()) {
        <app-estado-vista estado="error" titulo="No se pudo cargar la ficha" [mensaje]="error()" (reintentar)="reintentar.emit()" />
      } @else if (!detalle()) {
        <div class="esqueleto bloque" aria-busy="true" aria-label="Cargando la ficha"></div>
      } @else if (detalle(); as u) {
        <div class="ficha">
          <header class="cabecera">
            <app-avatar [texto]="iniciales(u)" [imagen]="u.fotoUrl" [tamano]="56" />
            <div>
              <p class="nombre">{{ u.nombre }} @if (esYo()) { <small class="texto-suave">(tú)</small> }</p>
              <p class="texto-suave">{{ u.correo }}</p>
              <div class="chips">
                @for (r of u.roles; track r) { <span class="chip" [class.docente]="r === 'DOCENTE'" [class.admin]="r === 'ADMIN'">{{ nombreRol[r] }}</span> }
                <span class="punto-estado" [class.activo]="u.activo" [class.inactivo]="!u.activo">{{ u.activo ? 'Activa' : 'Inactiva' }}</span>
              </div>
            </div>
          </header>

          <dl class="datos">
            <div><dt>Registro</dt><dd>{{ u.creadoEn | date: 'd MMM y' }}</dd></div>
            <div><dt>Último inicio de sesión</dt><dd>{{ u.ultimoAcceso ? (u.ultimoAcceso | date: 'd MMM y, HH:mm') : 'Nunca ha entrado' }}</dd></div>
            @if (u.especialidad) { <div><dt>Especialidad</dt><dd>{{ u.especialidad }}</dd></div> }
            @if (u.invitacionPendienteHasta) {
              <div><dt>Invitación</dt><dd>Sin usar · vence {{ u.invitacionPendienteHasta | date: 'd MMM, HH:mm' }}</dd></div>
            }
          </dl>

          <section aria-labelledby="ficha-seguridad">
            <h3 id="ficha-seguridad">Acceso y seguridad</h3>
            @if (u.bloqueadoHasta) {
              <div class="aviso error bloqueo">
                <lucide-icon name="lock" [size]="18" />
                <span>Bloqueada por {{ u.intentosFallidos }} contraseñas incorrectas hasta las {{ u.bloqueadoHasta | date: 'HH:mm' }}.</span>
                <button type="button" class="btn btn-contorno btn-sm" [disabled]="ocupado() === 'desbloquear'" (click)="desbloquear.emit()">
                  <lucide-icon name="lock-open" [size]="16" aria-hidden="true" />
                  {{ ocupado() === 'desbloquear' ? 'Desbloqueando…' : 'Desbloquear' }}
                </button>
              </div>
            } @else {
              <p class="texto-suave linea">Sin bloqueo@if (u.intentosFallidos) { · {{ u.intentosFallidos }} intentos fallidos recientes }.</p>
            }

            <div class="titulo-lista">
              <h4>Sesiones abiertas ({{ u.sesiones.length }})</h4>
              <button type="button" class="btn btn-sm btn-texto-peligro"
                [disabled]="!u.sesiones.length || esYo() || ocupado() === 'sesiones'"
                [title]="esYo() ? 'Para cerrar tus sesiones usa «Cerrar sesión» en tu menú' : ''"
                (click)="cerrarSesiones.emit()">
                <lucide-icon name="log-out" [size]="16" aria-hidden="true" />
                {{ ocupado() === 'sesiones' ? 'Cerrando…' : 'Cerrar todas las sesiones' }}
              </button>
            </div>
            @if (u.sesiones.length) {
              <ul class="lista">
                @for (s of u.sesiones; track s.id) {
                  <li>
                    <span><lucide-icon name="monitor" [size]="16" aria-hidden="true" /> <strong>{{ navegador(s.agente) }}</strong></span>
                    <span class="texto-suave">Inició {{ s.iniciadaEn | date: 'd MMM, HH:mm' }} · activa {{ s.renovadaEn | date: 'd MMM, HH:mm' }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="texto-suave linea">No tiene sesiones abiertas.</p>
            }
          </section>

          <section aria-labelledby="ficha-inscripciones">
            <h3 id="ficha-inscripciones">Cursos en los que está inscrita ({{ u.inscripciones.length }})</h3>
            @if (u.inscripciones.length) {
              <ul class="lista">
                @for (i of u.inscripciones; track i.curso.id) {
                  <li>
                    <strong>{{ i.curso.titulo }}</strong>
                    <span class="avance">
                      <span class="barra" role="progressbar" [attr.aria-valuenow]="i.progresoPct" aria-valuemin="0" aria-valuemax="100"
                        [attr.aria-label]="'Avance en ' + i.curso.titulo"><span [style.width.%]="i.progresoPct"></span></span>
                      {{ i.estado === 'COMPLETADA' ? 'Completado' : i.progresoPct + ' %' }}
                    </span>
                  </li>
                }
              </ul>
            } @else {
              <p class="texto-suave linea">No está inscrita en ningún curso.</p>
            }
          </section>

          @if (u.cursosCreados.length || u.roles.includes('DOCENTE')) {
            <section aria-labelledby="ficha-cursos">
              <h3 id="ficha-cursos">Cursos que creó ({{ u.cursosCreados.length }})</h3>
              @if (u.cursosCreados.length) {
                <ul class="lista">
                  @for (c of u.cursosCreados; track c.id) {
                    <li>
                      <strong>{{ c.titulo }}</strong>
                      <span class="texto-suave">{{ estadoCurso[c.estado] }} · {{ c.inscritos }} {{ c.inscritos === 1 ? 'inscrito' : 'inscritos' }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="texto-suave linea">Todavía no ha creado cursos.</p>
              }
            </section>
          }
        </div>
      }
    </app-modal>
  `,
  styles: `
    .ficha { display: grid; gap: 22px; }
    .cabecera { display: flex; gap: 14px; align-items: center; p { margin: 0; } }
    .nombre { font-size: 18px; font-weight: 700; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; }
    .chip.docente { background: var(--azul-100); color: var(--azul-800); font-weight: 600; }
    .chip.admin { background: var(--tinta-900); color: var(--blanco); }
    .datos {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 0;
      div { padding: 10px 12px; border-radius: var(--radio); background: var(--gris-100); }
      dt { font-size: 12px; color: var(--gris-500); } dd { margin: 2px 0 0; font-weight: 600; font-size: 14px; }
    }
    section { display: grid; gap: 10px; }
    h3 { margin: 0; font-size: 15px; }
    h4 { margin: 0; font-size: 14px; }
    .linea { margin: 0; font-size: 14px; }
    .bloqueo { align-items: center; flex-wrap: wrap; .btn { margin-left: auto; display: inline-flex; gap: 6px; background: var(--blanco); } }
    .titulo-lista { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .btn-texto-peligro {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid transparent; background: transparent; color: var(--rojo-700);
      &:hover:not(:disabled) { background: var(--rojo-050); }
    }
    .lista {
      display: grid; gap: 8px; margin: 0; padding: 0; list-style: none;
      li {
        display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 12px;
        padding: 10px 12px; border: 1px solid var(--gris-200); border-radius: var(--radio); font-size: 14px;
      }
      span { display: inline-flex; align-items: center; gap: 6px; }
    }
    .avance { font-size: 13px; color: var(--tinta-700); }
    .barra {
      display: inline-block; width: 96px; height: 6px; border-radius: 999px; background: var(--gris-200); overflow: hidden;
      span { display: block; height: 100%; background: var(--azul-600); }
    }
    .bloque { height: 280px; border-radius: var(--radio); }
  `,
})
export class FichaUsuario {
  readonly detalle = input<DetalleUsuarioAdmin | null>(null);
  readonly error = input('');
  readonly titulo = input('Ficha de la cuenta');
  readonly esYo = input(false);
  readonly ocupado = input<AccionFicha>(null);
  readonly desbloquear = output<void>();
  readonly cerrarSesiones = output<void>();
  readonly reintentar = output<void>();
  readonly cerrar = output<void>();

  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly estadoCurso = ESTADO_CURSO;
  protected readonly navegador = resumirNavegador;

  protected iniciales(u: DetalleUsuarioAdmin): string {
    return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase();
  }
}
