import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { mensajeDeError } from '../../../core/http/error-api';
import { SolicitudesDocenteService } from '../../../core/solicitudes/solicitudes-docente.service';
import { Modal } from '../../../shared/ui/retroalimentacion/modal';

/**
 * Modal reutilizable «Solicitud para ser docente» (RF-05).
 * Puede abrirse desde cualquier vista del sitio («Enseña en Learnity» en el header o menú de cuenta)
 * sin redirigir forzosamente a `/perfil`, así como desde `ajustes-perfil` o `/perfil?solicitud=1`.
 */
@Component({
  selector: 'app-modal-solicitud-docente',
  imports: [ReactiveFormsModule, LucideAngularModule, Modal],
  template: `
    @if (visible()) {
      <app-modal titulo="Solicitud para ser docente" icono="presentation" [ancho]="560" (cerrar)="cerrar()">
        @if (solicitudEnviada() || auth.esDocente() || miSolicitud()?.estado === 'PENDIENTE') {
          <div class="aviso" [class.exito]="solicitudEnviada() || auth.esDocente()" role="status">
            <lucide-icon [name]="solicitudEnviada() || auth.esDocente() ? 'circle-check' : 'clock'" [size]="18" />
            <span>
              @if (auth.esDocente()) {
                Tu cuenta ya tiene el rol Docente.
              } @else if (solicitudEnviada()) {
                Solicitud enviada. Un administrador la revisará y verás el resultado en tu perfil.
              } @else {
                Ya tienes una solicitud en revisión. Verás el resultado en tu perfil.
              }
            </span>
          </div>
          <div class="acciones-modal">
            <button type="button" class="btn btn-primario" (click)="cerrar()">Entendido</button>
          </div>
        } @else {
          <p class="texto-suave intro">
            Cuéntanos qué te gustaría enseñar. Un administrador revisará tu solicitud y, si la aprueba, podrás crear cursos con esta misma cuenta.
          </p>
          <form class="form-solicitud" [formGroup]="formSolicitud" (ngSubmit)="enviarSolicitud()" novalidate>
            <div class="campo">
              <label class="etiqueta" for="especialidad">Especialidad o tema</label>
              <div class="control-icono">
                <lucide-icon name="briefcase" [size]="20" />
                <input
                  id="especialidad"
                  class="control"
                  [class.invalido]="formSolicitud.controls.especialidad.invalid && formSolicitud.controls.especialidad.touched"
                  formControlName="especialidad"
                  maxlength="100"
                  placeholder="Ej.: Programación web, Diseño gráfico"
                />
              </div>
              @if (formSolicitud.controls.especialidad.invalid && formSolicitud.controls.especialidad.touched) {
                <span class="error-campo">Escribe la especialidad o el tema (entre 3 y 100 caracteres).</span>
              }
            </div>
            <div class="campo">
              <label class="etiqueta" for="motivo">¿Por qué quieres enseñar?</label>
              <textarea
                id="motivo"
                class="control"
                [class.invalido]="formSolicitud.controls.motivo.invalid && formSolicitud.controls.motivo.touched"
                formControlName="motivo"
                placeholder="Describe tu experiencia y el curso que te gustaría publicar…"
              ></textarea>
              <span class="ayuda">Mínimo 50 caracteres ({{ formSolicitud.controls.motivo.value.length }}/50).</span>
            </div>
            @if (errorSolicitud()) {
              <div class="aviso error" role="alert">
                <lucide-icon name="circle-alert" [size]="18" />
                <span>{{ errorSolicitud() }}</span>
              </div>
            } @else {
              <div class="aviso">
                <lucide-icon name="info" [size]="18" />
                <span>Conservarás tus cursos e inscripciones como estudiante.</span>
              </div>
            }
            <div class="acciones-modal">
              <button type="button" class="btn btn-suave" (click)="cerrar()">Cancelar</button>
              <button type="submit" class="btn btn-primario" [disabled]="enviandoSolicitud()">
                {{ enviandoSolicitud() ? 'Enviando…' : 'Enviar solicitud' }} <lucide-icon name="arrow-right" [size]="18" />
              </button>
            </div>
          </form>
        }
      </app-modal>
    }
  `,
  styles: `
    .intro {
      margin: 0 0 16px;
      line-height: 1.5;
    }
    .form-solicitud {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    textarea.control {
      min-height: 112px;
    }
    .acciones-modal {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }
  `,
})
export class ModalSolicitudDocente {
  protected readonly auth = inject(AuthService);
  protected readonly solicitudes = inject(SolicitudesDocenteService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly instanciaId = Symbol('modal-solicitud-docente');

  protected readonly visible = computed(
    () => this.solicitudes.modalAbierto() && this.solicitudes.esAnfitrionActivo(this.instanciaId),
  );
  protected readonly miSolicitud = this.solicitudes.solicitudActual;
  protected readonly solicitudEnviada = signal(false);
  protected readonly enviandoSolicitud = signal(false);
  protected readonly errorSolicitud = signal<string | null>(null);

  protected readonly formSolicitud = this.fb.group({
    especialidad: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    motivo: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(2000)]],
  });

  constructor() {
    this.solicitudes.registrarAnfitrion(this.instanciaId);
    inject(DestroyRef).onDestroy(() => this.solicitudes.desregistrarAnfitrion(this.instanciaId));

    effect(() => {
      const abierto = this.visible();
      if (abierto) {
        untracked(() => {
          if (this.auth.autenticado() && !this.auth.esDocente()) {
            void this.sincronizarSolicitud();
          }
        });
      }
    });
  }

  private async sincronizarSolicitud(): Promise<void> {
    try {
      const s = await this.solicitudes.miSolicitud();
      if (s?.estado === 'APROBADA' && !this.auth.esDocente()) {
        await this.auth.renovar();
      }
    } catch {
      // Si falla la consulta previa, el envío informará del estado real.
    }
  }

  protected async enviarSolicitud(): Promise<void> {
    this.errorSolicitud.set(null);
    if (this.formSolicitud.invalid) {
      this.formSolicitud.markAllAsTouched();
      return;
    }
    const { especialidad, motivo } = this.formSolicitud.getRawValue();
    this.enviandoSolicitud.set(true);
    try {
      await this.solicitudes.enviar(especialidad, motivo);
      this.solicitudEnviada.set(true);
      this.formSolicitud.reset();
    } catch (error) {
      this.errorSolicitud.set(mensajeDeError(error, 'El envío de la solicitud'));
      void this.sincronizarSolicitud();
    } finally {
      this.enviandoSolicitud.set(false);
    }
  }

  protected cerrar(): void {
    this.solicitudes.cerrarModal();
    this.solicitudEnviada.set(false);
    this.errorSolicitud.set(null);
  }
}
