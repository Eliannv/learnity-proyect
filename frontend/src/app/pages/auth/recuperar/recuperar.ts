import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { MarcoAcceso } from '../marco-acceso';
import { mensajeDeError } from '../../../core/http/error-api';

@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, MarcoAcceso],
  template: `
    <app-marco-acceso
      tituloAntes="Tu espacio para"
      tituloResaltado="aprender"
      descripcion="Te enviaremos un enlace a tu correo para que crees una nueva contraseña y vuelvas a tus cursos."
    >
      <div class="encabezado">
        <h2>Recupera tu contraseña</h2>
        <p>Ingresa el correo con el que te registraste</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <div class="campo">
          <label class="etiqueta" for="correo">Correo electrónico</label>
          <div class="control-icono">
            <lucide-icon name="mail" [size]="20" />
            <input id="correo" class="control" type="email" formControlName="correo" placeholder="tucorreo@ejemplo.com" autocomplete="email" />
          </div>
        </div>

        @if (enviado()) {
          <div class="aviso exito" role="status">
            <lucide-icon name="circle-check" [size]="18" />
            <span>Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.</span>
          </div>
        }
        @if (error()) {
          <div class="aviso error" role="alert">
            <lucide-icon name="circle-alert" [size]="18" />
            <span>{{ error() }}</span>
          </div>
        }

        <button type="submit" class="btn btn-primario btn-lg btn-bloque" [disabled]="enviando()">
          {{ enviando() ? 'Enviando…' : 'Enviar enlace' }}
          <lucide-icon name="arrow-right" [size]="20" />
        </button>
      </form>

      <p class="pie">¿Recordaste tu contraseña?<a routerLink="/login">Inicia sesión</a></p>
    </app-marco-acceso>
  `,
  styleUrl: '../acceso.scss',
})
export class Recuperar {
  private readonly auth = inject(AuthService);
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  /** RF-06 · El backend responde siempre lo mismo, exista o no el correo. */
  protected async enviar() {
    this.error.set(null);
    this.enviado.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      await this.auth.solicitarRecuperacion(this.form.getRawValue().correo);
      this.enviado.set(true);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'La recuperación de contraseña'));
    } finally {
      this.enviando.set(false);
    }
  }
}
