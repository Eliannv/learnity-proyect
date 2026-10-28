import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { PerfilService } from '../../../core/auth/perfil.service';
import { mensajeDeError } from '../../../core/http/error-api';
import { Avatar } from '../../../shared/ui/avatar';
import { ConfirmacionService } from '../../../shared/ui/confirmacion.service';
import { ToastService } from '../../../shared/ui/toast.service';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Foto de perfil: elegir, ver la vista previa, guardar o quitar la actual.
 * El servidor vuelve a comprobar el tipo por el contenido del archivo.
 */
@Component({
  selector: 'app-foto-perfil',
  imports: [LucideAngularModule, Avatar],
  template: `
    <div class="foto-perfil" [class.grande]="tamano() > 120">
      @if (vista()) {
        <img class="vista" [src]="vista()" alt="Vista previa de tu nueva foto" [style.--t.px]="tamano()" [width]="tamano()" [height]="tamano()" />
      } @else {
        <app-avatar [texto]="auth.iniciales()" [imagen]="auth.usuario()?.fotoUrl" [tamano]="tamano()" />
      }
      <div class="acciones">
        @if (vista()) {
          <button type="button" class="btn btn-primario" [disabled]="guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando…' : 'Guardar foto' }}
          </button>
          <button type="button" class="btn btn-texto" [disabled]="guardando()" (click)="descartar()">Descartar</button>
        } @else {
          <label class="btn btn-contorno">
            <lucide-icon name="camera" [size]="18" aria-hidden="true" />
            {{ auth.usuario()?.fotoUrl ? 'Cambiar foto' : 'Subir foto' }}
            <input class="visualmente-oculto" type="file" accept="image/jpeg,image/png,image/webp" (change)="elegir($event)" />
          </label>
          @if (auth.usuario()?.fotoUrl) {
            <button type="button" class="btn btn-texto peligro" [disabled]="guardando()" (click)="quitar()">Quitar foto</button>
          }
        }
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <p class="ayuda">JPG, PNG o WebP de hasta 2 MB. Se ve en tu menú y, si eres docente, en tus cursos y reseñas.</p>
    </div>
  `,
  styles: `
    .foto-perfil { display: grid; justify-items: start; gap: 12px; }
    .vista { width: var(--t, 96px); height: auto; aspect-ratio: 1; border-radius: 50%; object-fit: cover; }
    .acciones { display: flex; flex-wrap: wrap; gap: 8px; .btn { display: inline-flex; align-items: center; gap: 6px; } }
    label.btn { cursor: pointer; }
    label.btn:focus-within { outline: 3px solid var(--azul-600); outline-offset: 3px; }
    .peligro { color: var(--rojo-700); }
    .error { margin: 0; color: var(--rojo-700); }
    .ayuda { margin: 0; font-size: 13px; line-height: 1.5; color: var(--tinta-700); max-width: 40ch; }
  `,
})
export class FotoPerfil {
  protected readonly auth = inject(AuthService);
  private readonly perfil = inject(PerfilService);
  private readonly toast = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private archivo: File | null = null;

  readonly tamano = input(96);

  protected readonly vista = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly guardando = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberar());
  }

  protected elegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      this.error.set(`«${archivo.name}» no es JPG, PNG ni WebP.`);
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.error.set(`«${archivo.name}» pesa ${(archivo.size / (1024 * 1024)).toFixed(1)} MB; el máximo es 2 MB.`);
      return;
    }
    this.error.set('');
    this.liberar();
    this.archivo = archivo;
    this.vista.set(URL.createObjectURL(archivo));
  }

  protected async guardar(): Promise<void> {
    if (!this.archivo) return;
    this.guardando.set(true);
    try {
      await this.perfil.subirFoto(this.archivo);
      this.descartar();
      this.toast.exito('Foto de perfil actualizada.');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Guardar la foto'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async quitar(): Promise<void> {
    const confirmado = await this.confirmacion.confirmar({
      titulo: '¿Quitar tu foto de perfil?',
      mensaje: 'Volverán a mostrarse tus iniciales. Puedes subir otra cuando quieras.',
      accion: 'Quitar foto', peligro: true, icono: 'camera',
    });
    if (!confirmado) return;
    this.guardando.set(true);
    try {
      await this.perfil.quitarFoto();
      this.toast.exito('Foto de perfil quitada.');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Quitar la foto'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected descartar(): void {
    this.liberar();
    this.archivo = null;
    this.vista.set(null);
  }

  private liberar(): void {
    const url = this.vista();
    if (url) URL.revokeObjectURL(url);
  }
}
