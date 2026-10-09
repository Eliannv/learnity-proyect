import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import type { Rol } from '../../../core/auth/sesion.model';
import { MarcoAcceso } from '../marco-acceso';
import { mensajeDeError } from '../mensaje-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, MarcoAcceso],
  templateUrl: './login.html',
  styleUrl: '../acceso.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly modoDemo = environment.modoDemo;
  protected readonly verContrasena = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
  });

  protected invalido(campo: 'correo' | 'contrasena') {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /** RF-02 · Inicio de sesión real contra la API (lo completa el Sprint 1 en el backend). */
  protected async iniciarSesion() {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      const { correo, contrasena } = this.form.getRawValue();
      await this.auth.iniciarSesion(correo, contrasena);
      await this.irAlInicio();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'El inicio de sesión'));
    } finally {
      this.enviando.set(false);
    }
  }

  /** Modo demostración: entra con una cuenta de prueba del rol elegido. */
  protected async entrarDemo(rol: Rol) {
    this.auth.iniciarDemo(rol);
    await this.irAlInicio();
  }

  private async irAlInicio() {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    await this.router.navigateByUrl(volver ?? this.auth.rutaInicio());
  }
}
