import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { Avatar } from '../../../shared/ui/avatar';
import { Modal } from '../../../shared/ui/modal';

/**
 * Mi perfil del Estudiante (diseño de Pencil) y solicitud para ser docente (RF-04, RF-05).
 * Docentes y administradores editan su perfil dentro de su panel (Ajustes y perfil).
 */
@Component({
  selector: 'app-perfil-estudiante',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, Avatar, Modal],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilEstudiante {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** /perfil?solicitud=1 abre directamente la solicitud (enlace "Enseña en Learnity"). */
  readonly solicitud = input<string>();

  protected readonly modalSolicitud = linkedSignal(() => !!this.solicitud());
  protected readonly solicitudEnviada = signal(false);
  protected readonly guardado = signal(false);

  protected readonly form = this.fb.group({
    nombres: [this.auth.usuario()?.nombres ?? '', [Validators.required, Validators.maxLength(80)]],
    apellidos: [this.auth.usuario()?.apellidos ?? '', [Validators.required, Validators.maxLength(80)]],
    ciudad: ['Machala', [Validators.maxLength(60)]],
    biografia: ['', [Validators.maxLength(300)]],
    contrasenaActual: [''],
    contrasenaNueva: ['', [Validators.minLength(8)]],
  });

  protected readonly formSolicitud = this.fb.group({
    especialidad: ['', [Validators.required, Validators.maxLength(100)]],
    motivo: ['', [Validators.required, Validators.minLength(50)]],
  });

  /** Sprint 1: aquí se llama a PUT /api/perfil y PUT /api/perfil/contrasena. */
  protected guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardado.set(true);
  }

  /** Sprint 2: aquí se llama a POST /api/solicitudes-docente. */
  protected enviarSolicitud() {
    if (this.formSolicitud.invalid) {
      this.formSolicitud.markAllAsTouched();
      return;
    }
    this.solicitudEnviada.set(true);
  }

  protected cerrarSolicitud() {
    this.modalSolicitud.set(false);
  }
}
