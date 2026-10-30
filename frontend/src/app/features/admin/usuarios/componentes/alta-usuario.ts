import { Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import type { NuevoUsuarioAdmin } from '../usuarios.api';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Formulario de alta de una cuenta (presentación). Valida lo básico antes de enviar; los errores de la API llegan
 * por `errores` (por campo) y `error` (general). La persona recibe una invitación: aquí no se escribe contraseña.
 */
@Component({
  selector: 'app-alta-usuario',
  imports: [LucideAngularModule, Modal],
  template: `
    <app-modal titulo="Crear usuario" icono="user-plus" [ancho]="520" (cerrar)="cerrar.emit()">
      <form class="formulario" (submit)="$event.preventDefault(); enviar()" novalidate>
        <p class="texto-suave intro">
          Le enviaremos un correo con un enlace para que cree su contraseña. El enlace vence en 72 horas.
        </p>
        <div class="fila">
          <div class="campo">
            <label class="etiqueta" for="alta-nombres">Nombres</label>
            <input id="alta-nombres" class="control" maxlength="80" autocomplete="off" [class.invalido]="mensaje('nombres')"
              [value]="nombres()" (input)="nombres.set($any($event.target).value)"
              [attr.aria-describedby]="mensaje('nombres') ? 'alta-nombres-error' : null" [attr.aria-invalid]="!!mensaje('nombres')" />
            @if (mensaje('nombres'); as m) { <span id="alta-nombres-error" class="error-campo">{{ m }}</span> }
          </div>
          <div class="campo">
            <label class="etiqueta" for="alta-apellidos">Apellidos</label>
            <input id="alta-apellidos" class="control" maxlength="80" autocomplete="off" [class.invalido]="mensaje('apellidos')"
              [value]="apellidos()" (input)="apellidos.set($any($event.target).value)"
              [attr.aria-describedby]="mensaje('apellidos') ? 'alta-apellidos-error' : null" [attr.aria-invalid]="!!mensaje('apellidos')" />
            @if (mensaje('apellidos'); as m) { <span id="alta-apellidos-error" class="error-campo">{{ m }}</span> }
          </div>
        </div>
        <div class="campo">
          <label class="etiqueta" for="alta-correo">Correo</label>
          <input id="alta-correo" class="control" type="email" maxlength="120" autocomplete="off" [class.invalido]="mensaje('correo')"
            [value]="correo()" (input)="correo.set($any($event.target).value)"
            [attr.aria-describedby]="mensaje('correo') ? 'alta-correo-error' : null" [attr.aria-invalid]="!!mensaje('correo')" />
          @if (mensaje('correo'); as m) { <span id="alta-correo-error" class="error-campo">{{ m }}</span> }
        </div>

        <fieldset class="roles">
          <legend class="etiqueta">Roles</legend>
          <p class="ayuda">Toda cuenta es Estudiante. Añade los roles que necesite.</p>
          <label class="opcion">
            <input type="checkbox" [checked]="docente()" (change)="docente.set($any($event.target).checked)" />
            <span><strong>Docente</strong> <small class="texto-suave">Crea cursos y los envía a revisión.</small></span>
          </label>
          <label class="opcion">
            <input type="checkbox" [checked]="admin()" (change)="admin.set($any($event.target).checked)" />
            <span><strong>Administrador</strong> <small class="texto-suave">Acceso completo a este panel.</small></span>
          </label>
        </fieldset>

        @if (docente()) {
          <div class="campo">
            <label class="etiqueta" for="alta-especialidad">Especialidad del docente</label>
            <input id="alta-especialidad" class="control" maxlength="100" placeholder="Por ejemplo, Matemáticas"
              [class.invalido]="mensaje('especialidad')" [value]="especialidad()" (input)="especialidad.set($any($event.target).value)"
              [attr.aria-describedby]="mensaje('especialidad') ? 'alta-especialidad-error' : null"
              [attr.aria-invalid]="!!mensaje('especialidad')" />
            @if (mensaje('especialidad'); as m) { <span id="alta-especialidad-error" class="error-campo">{{ m }}</span> }
          </div>
        }

        @if (error()) {
          <div class="aviso error" role="alert"><lucide-icon name="circle-alert" [size]="18" /><span>{{ error() }}</span></div>
        }
        <div class="pie">
          <button type="button" class="btn btn-contorno" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="enviando()">
            {{ enviando() ? 'Creando…' : 'Crear y enviar invitación' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .formulario { display: grid; gap: 16px; }
    .intro { margin: 0; font-size: 14px; line-height: 1.5; }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .roles { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
    .roles .ayuda { margin: 0 0 4px; }
    .opcion {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 14px; border: 1px solid var(--gris-200); border-radius: var(--radio); cursor: pointer;
      input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--azul-600); }
      span { display: grid; gap: 2px; }
      small { font-size: 13px; }
    }
    .pie { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    @media (max-width: 520px) { .fila { grid-template-columns: 1fr; } }
  `,
})
export class AltaUsuario {
  readonly enviando = input(false);
  /** Errores de la API por campo (`erroresPorCampo`). */
  readonly errores = input<Record<string, string>>({});
  /** Error general de la API. */
  readonly error = input('');
  readonly guardar = output<NuevoUsuarioAdmin>();
  readonly cerrar = output<void>();

  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');
  protected readonly correo = signal('');
  protected readonly docente = signal(false);
  protected readonly admin = signal(false);
  protected readonly especialidad = signal('');
  /** Se muestran los errores propios solo después del primer intento de enviar. */
  private readonly intentado = signal(false);

  private readonly locales = computed<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    if (!this.nombres().trim()) e['nombres'] = 'Escribe los nombres.';
    if (!this.apellidos().trim()) e['apellidos'] = 'Escribe los apellidos.';
    if (!CORREO.test(this.correo().trim())) e['correo'] = 'Escribe un correo válido.';
    if (this.docente() && this.especialidad().trim().length < 3) e['especialidad'] = 'Escribe la especialidad (mínimo 3 caracteres).';
    return e;
  });

  protected mensaje(campo: string): string {
    return (this.intentado() ? this.locales()[campo] : undefined) ?? this.errores()[campo] ?? '';
  }

  protected enviar(): void {
    this.intentado.set(true);
    if (Object.keys(this.locales()).length) return;
    const roles: NuevoUsuarioAdmin['roles'] = [];
    if (this.docente()) roles.push('DOCENTE');
    if (this.admin()) roles.push('ADMIN');
    this.guardar.emit({
      nombres: this.nombres().trim(),
      apellidos: this.apellidos().trim(),
      correo: this.correo().trim(),
      roles,
      ...(this.docente() ? { especialidad: this.especialidad().trim() } : {}),
    });
  }
}
