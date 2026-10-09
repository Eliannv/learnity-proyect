import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { Avatar } from '../../../shared/ui/avatar';

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

/**
 * Ajustes y perfil (RF-04) de Docente y Administrador, dentro de su panel
 * (/docente/perfil y /admin/perfil). Se abre con un clic en la foto de perfil.
 * El Estudiante tiene su propia página: pages/estudiante/perfil.
 */
@Component({
  selector: 'app-ajustes-perfil',
  imports: [ReactiveFormsModule, LucideAngularModule, Avatar],
  templateUrl: './ajustes-perfil.html',
  styleUrl: './ajustes-perfil.scss',
})
export class AjustesPerfil implements OnDestroy {
  protected readonly auth = inject(AuthService);
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

  // ------------------------------------------------------------ Perfil
  protected readonly form = this.fb.group({
    nombres: [this.auth.usuario()?.nombres ?? '', [Validators.required, Validators.maxLength(80)]],
    apellidos: [this.auth.usuario()?.apellidos ?? '', [Validators.required, Validators.maxLength(80)]],
    especialidad: [this.auth.esDocente() ? 'Programación y desarrollo web' : '', [Validators.maxLength(100)]],
    ciudad: ['Machala', [Validators.maxLength(60)]],
    biografia: [
      this.auth.esDocente() ? 'Ingeniero de software con 8 años de experiencia. Enseño programación desde 2018.' : '',
      [Validators.maxLength(300)],
    ],
  });
  /** Para la vista previa y los contadores en vivo. */
  protected readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly perfilGuardado = signal(false);

  /** Sprint 1: PUT /api/perfil */
  protected guardarPerfil() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.form.markAsPristine();
    this.perfilGuardado.set(true);
  }

  // ------------------------------------------------------------ Foto
  protected readonly fotoVista = signal<string | null>(null);
  protected readonly fotoError = signal('');
  protected readonly fotoGuardada = signal(false);

  protected elegirFoto(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    this.fotoGuardada.set(false);
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
    this.fotoGuardada.set(false);
  }

  private liberarVista() {
    const url = this.fotoVista();
    if (url) URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------ Contraseña
  protected readonly formContrasena = this.fb.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: contrasenasIguales },
  );
  protected readonly verContrasenas = signal(false);
  protected readonly contrasenaGuardada = signal(false);

  /** Sprint 1: PUT /api/perfil/contrasena */
  protected cambiarContrasena() {
    if (this.formContrasena.invalid) {
      this.formContrasena.markAllAsTouched();
      return;
    }
    this.formContrasena.reset();
    this.contrasenaGuardada.set(true);
  }

  protected invalido(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  ngOnDestroy() {
    this.liberarVista();
  }
}
