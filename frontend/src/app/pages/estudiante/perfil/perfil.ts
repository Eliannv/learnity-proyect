import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { PerfilService, fechaCorta } from '../../../core/auth/perfil.service';
import { SolicitudesDocenteService, type SolicitudDocente } from '../../../core/solicitudes/solicitudes-docente.service';
import { Avatar } from '../../../shared/ui/avatar';
import { Modal } from '../../../shared/ui/modal';
import { AYUDA_CONTRASENA, mensajeContrasena, politicaContrasena } from '../../../shared/validadores/contrasena';
import { erroresPorCampo, mensajeDeError } from '../../../core/http/error-api';
import { environment } from '../../../../environments/environment';

/** El cambio de contraseña es opcional: si se escribe una de las dos, se exigen ambas. */
function contrasenaOpcional(grupo: AbstractControl): ValidationErrors | null {
  const actual = grupo.get('contrasenaActual')!;
  const nueva = grupo.get('contrasenaNueva')!;
  if (!actual.value && !nueva.value) return null;
  return !actual.value ? { faltaActual: true } : !nueva.value ? { faltaNueva: true } : null;
}

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
  protected readonly sprint34Habilitado = environment.sprint34Habilitado;
  private readonly perfiles = inject(PerfilService);
  private readonly solicitudes = inject(SolicitudesDocenteService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** /perfil?solicitud=1 abre directamente la solicitud (enlace "Enseña en Learnity"). */
  readonly solicitud = input<string>();

  protected readonly ayudaContrasena = AYUDA_CONTRASENA;
  protected readonly mensajeContrasena = mensajeContrasena;
  protected readonly modalSolicitud = linkedSignal(() => !!this.solicitud());
  protected readonly solicitudEnviada = signal(false);
  /** Última solicitud de la cuenta: decide qué muestra la tarjeta "¿Quieres enseñar?". */
  protected readonly miSolicitud = signal<SolicitudDocente | null>(null);
  protected readonly enviandoSolicitud = signal(false);
  protected readonly errorSolicitud = signal<string | null>(null);
  protected readonly fechaCorta = fechaCorta;
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly activaDesde = signal('');

  protected readonly form = this.fb.group(
    {
      nombres: [this.auth.usuario()?.nombres ?? '', [Validators.required, Validators.maxLength(80)]],
      apellidos: [this.auth.usuario()?.apellidos ?? '', [Validators.required, Validators.maxLength(80)]],
      ciudad: ['', [Validators.maxLength(60)]],
      biografia: ['', [Validators.maxLength(300)]],
      contrasenaActual: [''],
      contrasenaNueva: ['', [politicaContrasena]],
    },
    { validators: contrasenaOpcional },
  );

  protected readonly formSolicitud = this.fb.group({
    especialidad: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    motivo: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(2000)]],
  });

  constructor() {
    void this.cargar();
    void this.cargarSolicitud();
  }

  /** Si ya la aprobaron, renueva la sesión para traer el rol Docente sin volver a iniciar sesión. */
  private async cargarSolicitud() {
    try {
      const s = await this.solicitudes.miSolicitud();
      this.miSolicitud.set(s);
      if (s?.estado === 'APROBADA' && !this.auth.esDocente()) await this.auth.renovar();
    } catch {
      // La tarjeta conserva el botón para solicitar; el envío mostrará el error si persiste.
    }
  }

  private async cargar() {
    try {
      const perfil = await this.perfiles.obtener();
      this.form.patchValue({
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        ciudad: perfil.ciudad ?? '',
        biografia: perfil.biografia ?? '',
      });
      this.form.markAsPristine();
      this.activaDesde.set(fechaCorta(perfil.creadoEn));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'La carga del perfil'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  /** RF-04 · PUT /api/perfil y, si se escribió una contraseña nueva, PUT /api/perfil/contrasena. */
  protected async guardar() {
    this.mensaje.set(null);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const datosDirty = ['nombres', 'apellidos', 'ciudad', 'biografia'].some((c) => this.form.get(c)!.dirty);
    this.guardando.set(true);
    const hechos: string[] = [];
    try {
      if (datosDirty) {
        await this.perfiles.actualizar({
          nombres: v.nombres,
          apellidos: v.apellidos,
          ciudad: v.ciudad.trim() || null,
          biografia: v.biografia.trim() || null,
        });
        hechos.push('Tus datos se guardaron.');
      }
      if (v.contrasenaNueva) {
        hechos.push(await this.perfiles.cambiarContrasena(v.contrasenaActual, v.contrasenaNueva));
        this.form.patchValue({ contrasenaActual: '', contrasenaNueva: '' });
      }
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.mensaje.set(hechos.join(' ') || 'No hay cambios por guardar.');
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      if (porCampo['actual']) this.form.controls.contrasenaActual.setErrors({ servidor: porCampo['actual'] });
      if (porCampo['nueva'] || porCampo['contrasena']) {
        this.form.controls.contrasenaNueva.setErrors({ servidor: porCampo['nueva'] ?? porCampo['contrasena'] });
      }
      this.form.markAllAsTouched();
      if (hechos.length) this.mensaje.set(hechos.join(' '));
      this.error.set(mensajeDeError(error, 'El guardado'));
    } finally {
      this.guardando.set(false);
    }
  }

  /** RF-05 · POST /api/solicitudes-docente. */
  protected async enviarSolicitud() {
    this.errorSolicitud.set(null);
    if (this.formSolicitud.invalid) {
      this.formSolicitud.markAllAsTouched();
      return;
    }
    const { especialidad, motivo } = this.formSolicitud.getRawValue();
    this.enviandoSolicitud.set(true);
    try {
      this.miSolicitud.set(await this.solicitudes.enviar(especialidad, motivo));
      this.solicitudEnviada.set(true);
      this.formSolicitud.reset();
    } catch (error) {
      this.errorSolicitud.set(mensajeDeError(error, 'El envío de la solicitud'));
      void this.cargarSolicitud();
    } finally {
      this.enviandoSolicitud.set(false);
    }
  }

  protected cerrarSolicitud() {
    this.modalSolicitud.set(false);
    this.solicitudEnviada.set(false);
    this.errorSolicitud.set(null);
  }
}
