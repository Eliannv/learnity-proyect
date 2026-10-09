import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { MarcoAcceso } from '../marco-acceso';
import { mensajeDeError } from '../mensaje-error';

function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const { contrasena, confirmar } = grupo.value as { contrasena: string; confirmar: string };
  return contrasena && confirmar && contrasena !== confirmar ? { noCoinciden: true } : null;
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, MarcoAcceso],
  templateUrl: './registro.html',
  styleUrl: '../acceso.scss',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly verContrasena = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  // La base guarda nombres y apellidos por separado (tabla persona).
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      nombres: ['', [Validators.required, Validators.maxLength(80)]],
      apellidos: ['', [Validators.required, Validators.maxLength(80)]],
      correo: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: contrasenasIguales },
  );

  protected invalido(campo: keyof typeof this.form.controls) {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /** RF-01 · Toda cuenta nueva es Estudiante (RN-01). */
  protected async registrar() {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      const { nombres, apellidos, correo, contrasena } = this.form.getRawValue();
      await this.auth.registrar({ nombres, apellidos, correo, contrasena });
      await this.router.navigateByUrl('/mi-aprendizaje');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'El registro'));
    } finally {
      this.enviando.set(false);
    }
  }
}
