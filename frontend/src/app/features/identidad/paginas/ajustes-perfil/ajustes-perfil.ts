import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilService, fechaCorta } from '../../../../core/auth/perfil.service';
import { erroresPorCampo, mensajeDeError } from '../../../../core/http/error-api';
import { Avatar } from '../../../../shared/ui/avatar';
import { AYUDA_CONTRASENA, mensajeContrasena, politicaContrasena } from '../../../../shared/validadores/contrasena';

type Pestana = 'perfil' | 'foto' | 'contrasena' | 'cuenta';

const NOMBRES_ROL = { ESTUDIANTE: 'Estudiante', DOCENTE: 'Docente', ADMIN: 'Administrador' } as const;
const DESCRIPCION_ROL = {
  ESTUDIANTE: 'Te inscribes en cursos y avanzas a tu ritmo.',
  DOCENTE: 'Creas cursos y los envías a revisión para publicarlos.',
  ADMIN: 'Gestionas usuarios, solicitudes, categorías y la revisión de cursos.',
} as const;

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FOTO_BYTES = 500 * 1024;

function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva')?.value as string;
  const confirmar = grupo.get('confirmar')?.value as string;
  return confirmar && nueva !== confirmar ? { distintas: true } : null;
}

@Component({
  selector: 'app-ajustes-perfil',
  imports: [ReactiveFormsModule, LucideAngularModule, Avatar],
  templateUrl: './ajustes-perfil.html',
  styleUrl: './ajustes-perfil.scss',
})
export class AjustesPerfil implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly perfiles = inject(PerfilService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'perfil', texto: 'Perfil' },
    { id: 'foto', texto: 'Foto de perfil' },
    { id: 'contrasena', texto: 'Contraseña' },
    { id: 'cuenta', texto: 'Cuenta y roles' },
  ];
  protected readonly pestana = signal<Pestana>('perfil');

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

  constructor() {
    void this.cargar();
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

  protected readonly fotoVista = signal<string | null>(null);
  protected readonly fotoError = signal('');

  protected elegirFoto(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      this.fotoError.set(`«${archivo.name}» no es JPG, PNG ni WEBP.`);
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      this.fotoError.set(`«${archivo.name}» pesa ${Math.round(archivo.size / 1024)} KB; el máximo es 500 KB.`);
      return;
    }
    this.fotoError.set('');
    this.liberarVista();
    this.fotoVista.set(URL.createObjectURL(archivo));
  }

  protected quitarFoto() {
    this.liberarVista();
    this.fotoVista.set(null);
  }

  private liberarVista() {
    const url = this.fotoVista();
    if (url) URL.revokeObjectURL(url);
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

  ngOnDestroy() {
    this.liberarVista();
  }
}
