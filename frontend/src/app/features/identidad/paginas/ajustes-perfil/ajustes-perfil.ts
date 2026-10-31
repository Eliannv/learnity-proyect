import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { CalificacionCurso } from '../../../../core/api/contrato';
import { DocenteResenasApi } from '../../../docente/resenas/resenas.api';
import { Estrellas } from '../../../../shared/ui/datos/estrellas';
import { FotoPerfil } from '../../componentes/foto-perfil';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilService, fechaCorta } from '../../../../core/auth/perfil.service';
import { erroresPorCampo, mensajeDeError } from '../../../../core/http/error-api';
import { Avatar } from '../../../../shared/ui/marca/avatar';
import { SolicitudesDocenteService, type SolicitudDocente } from '../../../../core/solicitudes/solicitudes-docente.service';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { AYUDA_CONTRASENA, mensajeContrasena, politicaContrasena } from '../../../../shared/validadores/contrasena';

const NOMBRES_ROL = { ESTUDIANTE: 'Estudiante', DOCENTE: 'Docente', ADMIN: 'Administrador' } as const;
const DESCRIPCION_ROL = {
  ESTUDIANTE: 'Te inscribes en cursos y avanzas a tu ritmo.',
  DOCENTE: 'Creas cursos y los envías a revisión para publicarlos.',
  ADMIN: 'Gestionas usuarios, solicitudes, categorías y la revisión de cursos.',
} as const;


function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva')?.value as string;
  const confirmar = grupo.get('confirmar')?.value as string;
  return confirmar && nueva !== confirmar ? { distintas: true } : null;
}

@Component({
  selector: 'app-ajustes-perfil',
  imports: [ReactiveFormsModule, LucideAngularModule, Avatar, FotoPerfil, DecimalPipe, Estrellas, Modal],
  templateUrl: './ajustes-perfil.html',
  styleUrl: './ajustes-perfil.scss',
})
export class AjustesPerfil {
  protected readonly auth = inject(AuthService);
  private readonly solicitudes = inject(SolicitudesDocenteService);

  /** `data.marco` de la ruta: «pagina» en /perfil (sitio público, con contenedor); «panel» dentro del panel. */
  readonly marco = input<'pagina' | 'panel'>('panel');
  /** `?solicitud=1` abre directamente el formulario para ser docente. */
  readonly solicitud = input<string>();
  protected readonly fechaCorta = fechaCorta;
  protected readonly modalSolicitud = linkedSignal(() => !!this.solicitud());
  protected readonly solicitudEnviada = signal(false);
  protected readonly miSolicitud = signal<SolicitudDocente | null>(null);
  protected readonly enviandoSolicitud = signal(false);
  protected readonly errorSolicitud = signal<string | null>(null);
  protected readonly formSolicitud = inject(FormBuilder).nonNullable.group({
    especialidad: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    motivo: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(2000)]],
  });
  private readonly perfiles = inject(PerfilService);
  private readonly fb = inject(FormBuilder).nonNullable;


  protected readonly roles = computed(() =>
    this.auth.roles().map((r) => ({ nombre: NOMBRES_ROL[r], descripcion: DESCRIPCION_ROL[r] })),
  );
  protected readonly activaDesde = signal('');

  protected readonly form = this.fb.group({
    nombres: [this.auth.usuario()?.nombres ?? '', [Validators.required, Validators.maxLength(80)]],
    apellidos: [this.auth.usuario()?.apellidos ?? '', [Validators.required, Validators.maxLength(80)]],
    ciudad: ['', [Validators.maxLength(60)]],
    biografia: ['', [Validators.maxLength(300)]],
  });
  protected readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly guardandoPerfil = signal(false);
  protected readonly perfilMensaje = signal<string | null>(null);
  protected readonly perfilError = signal<string | null>(null);
  private readonly resenasApi = inject(DocenteResenasApi);
  /** Valoración global como docente; null mientras carga o si no se pudo leer. */
  protected readonly valoracion = signal<CalificacionCurso | null>(null);

  constructor() {
    void this.cargar();
    if (this.auth.esDocente()) void this.cargarValoracion();
    else void this.cargarSolicitud();
  }

  private async cargarSolicitud() {
    try {
      const s = await this.solicitudes.miSolicitud();
      this.miSolicitud.set(s);
      if (s?.estado === 'APROBADA' && !this.auth.esDocente()) await this.auth.renovar();
    } catch {
      // La tarjeta conserva el botón para solicitar; el envío mostrará el error si persiste.
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

  private async cargarValoracion(): Promise<void> {
    try {
      this.valoracion.set(await this.resenasApi.valoracion());
    } catch {
      this.valoracion.set(null); // la vista previa se muestra igual, sin la valoración
    }
  }

  private async cargar() {
    try {
      const perfil = await this.perfiles.obtener();
      this.form.reset({
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        ciudad: perfil.ciudad ?? '',
        biografia: perfil.biografia ?? '',
      });
      this.activaDesde.set(fechaCorta(perfil.creadoEn));
    } catch (error) {
      this.perfilError.set(mensajeDeError(error, 'La carga del perfil'));
    }
  }

  /** RF-04 · PUT /api/perfil */
  protected async guardarPerfil() {
    this.perfilMensaje.set(null);
    this.perfilError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardandoPerfil.set(true);
    try {
      await this.perfiles.actualizar({
        nombres: v.nombres,
        apellidos: v.apellidos,
        ciudad: v.ciudad.trim() || null,
        biografia: v.biografia.trim() || null,
      });
      this.form.markAsPristine();
      this.perfilMensaje.set('Tu perfil se guardó.');
    } catch (error) {
      this.perfilError.set(mensajeDeError(error, 'El guardado del perfil'));
    } finally {
      this.guardandoPerfil.set(false);
    }
  }

  protected readonly ayudaContrasena = AYUDA_CONTRASENA;
  protected readonly mensajeContrasena = mensajeContrasena;
  protected readonly formContrasena = this.fb.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, politicaContrasena]],
      confirmar: ['', [Validators.required]],
    },
    { validators: contrasenasIguales },
  );
  protected readonly verContrasenas = signal(false);
  protected readonly guardandoContrasena = signal(false);
  protected readonly contrasenaMensaje = signal<string | null>(null);
  protected readonly contrasenaError = signal<string | null>(null);

  /** RF-04 · PUT /api/perfil/contrasena (la API cierra las sesiones de los demás dispositivos). */
  protected async cambiarContrasena() {
    this.contrasenaMensaje.set(null);
    this.contrasenaError.set(null);
    if (this.formContrasena.invalid) {
      this.formContrasena.markAllAsTouched();
      return;
    }
    const { actual, nueva } = this.formContrasena.getRawValue();
    this.guardandoContrasena.set(true);
    try {
      this.contrasenaMensaje.set(await this.perfiles.cambiarContrasena(actual, nueva));
      this.formContrasena.reset();
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      if (porCampo['actual']) this.formContrasena.controls.actual.setErrors({ servidor: porCampo['actual'] });
      if (porCampo['nueva']) this.formContrasena.controls.nueva.setErrors({ servidor: porCampo['nueva'] });
      if (!porCampo['actual'] && !porCampo['nueva']) this.contrasenaError.set(mensajeDeError(error, 'El cambio de contraseña'));
      this.formContrasena.markAllAsTouched();
    } finally {
      this.guardandoContrasena.set(false);
    }
  }

  protected invalido(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }
}
