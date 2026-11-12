import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilService } from '../../../../core/auth/perfil.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { MarcoAcceso } from '../../componentes/marco-acceso';

type Estado =
  | { tipo: 'confirmando' }
  | { tipo: 'listo'; mensaje: string; correo: string }
  | { tipo: 'error'; mensaje: string };

/**
 * Confirmación del cambio de correo (`/confirmar-correo#token=…`). Es pública: funciona con o sin sesión, y para
 * estudiantes, docentes y administradores. Con sesión iniciada actualiza el correo de la sesión al momento.
 * El token va en el fragmento (#), como en «Crear nueva contraseña», y se borra de la barra de direcciones al abrir.
 */
@Component({
  selector: 'app-confirmar-correo',
  imports: [RouterLink, LucideAngularModule, MarcoAcceso],
  template: `
    <app-marco-acceso
      tituloAntes="Tu espacio para"
      tituloResaltado="aprender"
      descripcion="Confirmamos que el nuevo correo es tuyo antes de usarlo para iniciar sesión y recibir avisos."
    >
      <div class="encabezado">
        <h2>Confirmar el nuevo correo</h2>
        <p>El enlace funciona una sola vez y vence en 24 horas</p>
      </div>

      @switch (estado().tipo) {
        @case ('confirmando') {
          <div class="aviso" role="status">
            <lucide-icon name="loader-circle" [size]="18" />
            <span>Confirmando tu nuevo correo…</span>
          </div>
        }
        @case ('listo') {
          @if (estado(); as e) {
            @if (e.tipo === 'listo') {
              <div class="resultado">
                <div class="aviso exito" role="status">
                  <lucide-icon name="circle-check" [size]="18" />
                  <span>{{ e.mensaje }} Desde ahora inicias sesión con <strong>{{ e.correo }}</strong>.</span>
                </div>
                @if (auth.autenticado()) {
                  <a class="btn btn-primario btn-lg btn-bloque" [routerLink]="auth.rutaPerfil()">
                    Ir a mi perfil <lucide-icon name="arrow-right" [size]="20" />
                  </a>
                } @else {
                  <a class="btn btn-primario btn-lg btn-bloque" routerLink="/login">
                    Iniciar sesión <lucide-icon name="arrow-right" [size]="20" />
                  </a>
                }
              </div>
            }
          }
        }
        @case ('error') {
          @if (estado(); as e) {
            @if (e.tipo === 'error') {
              <div class="resultado">
                <div class="aviso error" role="alert">
                  <lucide-icon name="circle-alert" [size]="18" />
                  <span>{{ e.mensaje }}</span>
                </div>
                <a class="btn btn-contorno btn-lg btn-bloque" [routerLink]="auth.autenticado() ? auth.rutaPerfil() : '/login'">
                  {{ auth.autenticado() ? 'Volver a mi perfil para pedir otro enlace' : 'Iniciar sesión' }}
                </a>
              </div>
            }
          }
        }
      }
    </app-marco-acceso>
  `,
  styleUrl: '../acceso.scss',
})
export class ConfirmarCorreo {
  protected readonly auth = inject(AuthService);
  private readonly perfiles = inject(PerfilService);
  protected readonly estado = signal<Estado>({ tipo: 'confirmando' });

  constructor() {
    const token = leerToken(inject(ActivatedRoute).snapshot.fragment);
    // Fuera de la barra de direcciones y del historial: recargar no reintenta un enlace de un solo uso.
    inject(Location).replaceState('/confirmar-correo');
    if (!token) {
      this.estado.set({
        tipo: 'error',
        mensaje: 'Este enlace no es válido. Ábrelo tal como llegó a tu correo o pide uno nuevo desde tu perfil.',
      });
      return;
    }
    void this.confirmar(token);
  }

  private async confirmar(token: string): Promise<void> {
    try {
      // PerfilService actualiza también el correo de la sesión abierta, si la hay.
      const r = await this.perfiles.confirmarCambioCorreo(token);
      this.estado.set({ tipo: 'listo', mensaje: r.mensaje, correo: r.correo });
    } catch (error) {
      this.estado.set({ tipo: 'error', mensaje: mensajeDeError(error, 'La confirmación del nuevo correo') });
    }
  }
}

/** El token llega en el fragmento (`#token=…`); se aceptan los tokens opacos de 43 caracteres de la API. */
export function leerToken(fragmento: string | null): string | null {
  const token = new URLSearchParams(fragmento ?? '').get('token');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
