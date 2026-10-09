import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AYUDA_CONTRASENA, caracteresDe, mensajeContrasena, politicaContrasena } from '../../../shared/validadores/contrasena';
import { MarcoAcceso } from '../marco-acceso';
import { erroresPorCampo, mensajeDeError } from '../mensaje-error';

function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const { contrasena, confirmar } = grupo.value as { contrasena: string; confirmar: string };
  return contrasena && confirmar && contrasena !== confirmar ? { noCoinciden: true } : null;
}

/**
 * RF-06 · Crear una nueva contraseña desde el enlace del correo: /restablecer-contrasena#token=…
 * El token viaja en el fragmento (#): el navegador no lo envía a ningún servidor ni en el Referer.
 * Apenas se lee, se quita de la barra de direcciones y del historial.
 */
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, MarcoAcceso],
  template: `
    <app-marco-acceso
      tituloAntes="Vuelve a tu espacio para"
      tituloResaltado="aprender"
      descripcion="Crea una contraseña nueva. Al guardarla cerraremos las sesiones abiertas en tus otros dispositivos."
    >
      <div class="encabezado">
        <h2>Crea una nueva contraseña</h2>
        <p>El enlace solo funciona una vez y vence en unos minutos</p>
      </div>

      @if (listo()) {
        <div class="resultado">
          <div class="aviso exito" role="status">
            <lucide-icon name="circle-check" [size]="18" />
            <span>{{ listo() }}</span>
          </div>
          <a class="btn btn-primario btn-lg btn-bloque" routerLink="/login">
            Iniciar sesión <lucide-icon name="arrow-right" [size]="20" />
          </a>
        </div>
      } @else if (!token) {
        <div class="resultado">
          <div class="aviso error" role="alert">
            <lucide-icon name="circle-alert" [size]="18" />
            <span>Este enlace no es válido. Ábrelo tal como llegó a tu correo o solicita uno nuevo.</span>
          </div>
          <a class="btn btn-primario btn-lg btn-bloque" routerLink="/recuperar-contrasena">Solicitar un enlace nuevo</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
          <div class="campo">
            <label class="etiqueta" for="contrasena">Nueva contraseña</label>
            <div class="control-icono">
              <lucide-icon name="lock" [size]="20" />
              <input
                id="contrasena"
                class="control"
                [class.invalido]="invalido('contrasena')"
                [type]="verContrasena() ? 'text' : 'password'"
                formControlName="contrasena"
                placeholder="Una frase de al menos 15 caracteres"
                autocomplete="new-password"
                aria-describedby="ayuda-contrasena"
              />
              <button type="button" class="accion-control" (click)="verContrasena.set(!verContrasena())" aria-label="Mostrar u ocultar contraseña">
                <lucide-icon [name]="verContrasena() ? 'eye' : 'eye-off'" [size]="20" />
              </button>
            </div>
            @if (invalido('contrasena')) {
              <span class="error-campo" role="alert">{{ mensajeContrasena(form.controls.contrasena.errors) }}</span>
            } @else {
              <span class="ayuda" id="ayuda-contrasena">{{ ayuda }} ({{ caracteresDe(form.controls.contrasena.value) }}/15)</span>
            }
          </div>

          <div class="campo">
            <label class="etiqueta" for="confirmar">Confirmar contraseña</label>
            <div class="control-icono">
              <lucide-icon name="lock" [size]="20" />
              <input
                id="confirmar"
                class="control"
                [class.invalido]="form.hasError('noCoinciden') && form.controls.confirmar.touched"
                [type]="verContrasena() ? 'text' : 'password'"
                formControlName="confirmar"
                placeholder="Repite la contraseña"
                autocomplete="new-password"
              />
            </div>
            @if (form.hasError('noCoinciden') && form.controls.confirmar.touched) {
              <span class="error-campo">Las contraseñas no coinciden.</span>
            }
          </div>

          @if (error()) {
            <div class="aviso error" role="alert">
              <lucide-icon name="circle-alert" [size]="18" />
              <span>{{ error() }}</span>
            </div>
            @if (enlaceInvalido()) {
              <a class="btn btn-contorno btn-lg btn-bloque" routerLink="/recuperar-contrasena">Solicitar un enlace nuevo</a>
            }
          }

          <button type="submit" class="btn btn-primario btn-lg btn-bloque" [disabled]="enviando()">
            {{ enviando() ? 'Guardando…' : 'Guardar contraseña' }}
            <lucide-icon name="arrow-right" [size]="20" />
          </button>
        </form>
      }

      <p class="pie">¿Recordaste tu contraseña?<a routerLink="/login">Inicia sesión</a></p>
    </app-marco-acceso>
  `,
  styleUrl: '../acceso.scss',
})
export class Restablecer {
  private readonly auth = inject(AuthService);

  /** Token del fragmento #token=… (43 caracteres base64url). */
  protected readonly token = leerToken(inject(ActivatedRoute).snapshot.fragment);
  protected readonly ayuda = AYUDA_CONTRASENA;
  protected readonly mensajeContrasena = mensajeContrasena;
  protected readonly caracteresDe = caracteresDe;
  protected readonly verContrasena = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enlaceInvalido = signal(false);
  protected readonly listo = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      contrasena: ['', [Validators.required, politicaContrasena]],
      confirmar: ['', [Validators.required]],
    },
    { validators: contrasenasIguales },
  );

  constructor() {
    // Quita el token de la barra de direcciones (y del historial) apenas se lee.
    inject(Location).replaceState('/restablecer-contrasena');
  }

  protected invalido(campo: 'contrasena' | 'confirmar') {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  protected async guardar() {
    this.error.set(null);
    this.enlaceInvalido.set(false);
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      this.listo.set(await this.auth.restablecerContrasena(this.token, this.form.getRawValue().contrasena));
      this.form.reset();
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      if (porCampo['contrasena']) {
        this.form.controls.contrasena.setErrors({ servidor: porCampo['contrasena'] });
        this.form.controls.contrasena.markAsTouched();
      } else {
        this.enlaceInvalido.set(!!porCampo['token']);
        this.error.set(mensajeDeError(error, 'El cambio de contraseña'));
      }
    } finally {
      this.enviando.set(false);
    }
  }
}

function leerToken(fragmento: string | null): string | null {
  const token = new URLSearchParams(fragmento ?? '').get('token');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
