import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import type { CalificacionCurso } from '../../../../core/api/contrato';
import { DocenteResenasApi } from '../../../docente/resenas/resenas.api';
import { Estrellas } from '../../../../shared/ui/datos/estrellas';
import { FotoPerfil } from '../../componentes/foto-perfil';
import { ModalSolicitudDocente } from '../../componentes/modal-solicitud-docente';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilService, fechaCorta } from '../../../../core/auth/perfil.service';
import { erroresPorCampo, mensajeDeError } from '../../../../core/http/error-api';
import { Avatar } from '../../../../shared/ui/marca/avatar';
import { SolicitudesDocenteService } from '../../../../core/solicitudes/solicitudes-docente.service';
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

function calcularEdadAnios(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  const mesActual = hoy.getMonth() + 1;
  if (mesActual < m || (mesActual === m && hoy.getDate() < d)) {
    edad -= 1;
  }
  return edad >= 0 && edad <= 120 ? edad : null;
}

@Component({
  selector: 'app-ajustes-perfil',
  imports: [ReactiveFormsModule, LucideAngularModule, Avatar, FotoPerfil, DecimalPipe, Estrellas, ModalSolicitudDocente, Modal],
  templateUrl: './ajustes-perfil.html',
  styleUrl: './ajustes-perfil.scss',
})
export class AjustesPerfil {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly solicitudes = inject(SolicitudesDocenteService);
  protected readonly cerrandoSesion = signal(false);

  /** `data.marco` de la ruta: «pagina» en /perfil (sitio público, con contenedor); «panel» dentro del panel. */
  readonly marco = input<'pagina' | 'panel'>('panel');
  /** `?solicitud=1` abre directamente el formulario para ser docente. */
  readonly solicitud = input<string>();
  /** `?confirmarCorreo=<token>` confirma automáticamente el cambio de correo. */
  readonly confirmarCorreo = input<string>();
  protected readonly fechaCorta = fechaCorta;
  protected readonly miSolicitud = this.solicitudes.solicitudActual;
  private readonly perfiles = inject(PerfilService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly roles = computed(() =>
    this.auth.roles().map((r) => ({ nombre: NOMBRES_ROL[r], descripcion: DESCRIPCION_ROL[r] })),
  );
  protected readonly activaDesde = signal('');

  protected readonly form = this.fb.group({
    nombres: [this.auth.usuario()?.nombres ?? '', [Validators.required, Validators.maxLength(80)]],
    apellidos: [this.auth.usuario()?.apellidos ?? '', [Validators.required, Validators.maxLength(80)]],
    pais: ['', [Validators.maxLength(80)]],
    provincia: ['', [Validators.maxLength(80)]],
    ciudad: ['', [Validators.maxLength(60)]],
    fechaNacimiento: [''],
    biografia: ['', [Validators.maxLength(300)]],
  });
  protected readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly edadCalculada = computed(() => calcularEdadAnios(this.valores().fechaNacimiento));
  protected readonly guardandoPerfil = signal(false);
  protected readonly perfilMensaje = signal<string | null>(null);
  protected readonly perfilError = signal<string | null>(null);

  protected readonly modalCorreoAbierto = signal(false);
  protected readonly formCorreo = this.fb.group({
    nuevoCorreo: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    contrasenaActual: ['', [Validators.required]],
  });
  protected readonly enviandoCorreo = signal(false);
  protected readonly correoMensaje = signal<string | null>(null);
  protected readonly correoError = signal<string | null>(null);

  private readonly resenasApi = inject(DocenteResenasApi);
  /** Valoración global como docente; null mientras carga o si no se pudo leer. */
  protected readonly valoracion = signal<CalificacionCurso | null>(null);

  constructor() {
    void Promise.all([
      this.cargar(),
      this.auth.esDocente() ? this.cargarValoracion() : this.cargarSolicitud(),
    ]);

    effect(() => {
      if (this.solicitud()) {
        untracked(() => this.solicitudes.abrirModal());
      }
    });

    effect(() => {
      const token = this.confirmarCorreo()?.trim();
      if (token) {
        untracked(() => void this.ejecutarConfirmacionCorreo(token));
      }
    });
  }

  private async ejecutarConfirmacionCorreo(token: string) {
    try {
      const r = await this.perfiles.confirmarCambioCorreo(token);
      this.perfilMensaje.set(r.mensaje);
    } catch (error) {
      this.perfilError.set(mensajeDeError(error, 'La confirmación del nuevo correo'));
    }
  }

  private async cargarSolicitud() {
    try {
      const s = await this.solicitudes.miSolicitud();
      if (s?.estado === 'APROBADA' && !this.auth.esDocente()) await this.auth.renovar();
    } catch {
      // La tarjeta conserva el botón para solicitar; el envío mostrará el error si persiste.
    }
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
        pais: perfil.pais ?? '',
        provincia: perfil.provincia ?? '',
        ciudad: perfil.ciudad ?? '',
        fechaNacimiento: perfil.fechaNacimiento ?? '',
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
        pais: v.pais.trim() || null,
        provincia: v.provincia.trim() || null,
        ciudad: v.ciudad.trim() || null,
        fechaNacimiento: v.fechaNacimiento.trim() || null,
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

  protected abrirModalCorreo() {
    this.correoMensaje.set(null);
    this.correoError.set(null);
    this.formCorreo.reset({ nuevoCorreo: '', contrasenaActual: '' });
    this.modalCorreoAbierto.set(true);
  }

  protected cerrarModalCorreo() {
    if (this.enviandoCorreo()) return;
    this.modalCorreoAbierto.set(false);
  }

  protected async solicitarCambioCorreo() {
    this.correoMensaje.set(null);
    this.correoError.set(null);
    if (this.formCorreo.invalid) {
      this.formCorreo.markAllAsTouched();
      return;
    }
    const { nuevoCorreo, contrasenaActual } = this.formCorreo.getRawValue();
    this.enviandoCorreo.set(true);
    try {
      const msg = await this.perfiles.solicitarCambioCorreo(nuevoCorreo.trim(), contrasenaActual);
      this.correoMensaje.set(msg);
      this.formCorreo.reset({ nuevoCorreo: '', contrasenaActual: '' });
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      if (porCampo['nuevoCorreo']) this.formCorreo.controls.nuevoCorreo.setErrors({ servidor: porCampo['nuevoCorreo'] });
      if (porCampo['contrasenaActual']) this.formCorreo.controls.contrasenaActual.setErrors({ servidor: porCampo['contrasenaActual'] });
      if (!porCampo['nuevoCorreo'] && !porCampo['contrasenaActual']) {
        this.correoError.set(mensajeDeError(error, 'El cambio de correo'));
      }
      this.formCorreo.markAllAsTouched();
    } finally {
      this.enviandoCorreo.set(false);
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

  protected async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion()) return;
    this.cerrandoSesion.set(true);
    try {
      await this.auth.cerrarSesion();
      await this.router.navigateByUrl('/');
    } finally {
      this.cerrandoSesion.set(false);
    }
  }
}
