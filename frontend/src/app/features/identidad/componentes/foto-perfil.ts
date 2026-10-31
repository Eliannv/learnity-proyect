import { Component, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { PerfilService } from '../../../core/auth/perfil.service';
import { mensajeDeError } from '../../../core/http/error-api';
import { Avatar } from '../../../shared/ui/marca/avatar';
import { ConfirmacionService } from '../../../shared/ui/retroalimentacion/confirmacion.service';
import { Modal } from '../../../shared/ui/retroalimentacion/modal';
import { RecortadorFoto } from '../../../shared/ui/recortador/recortador-foto';
import { ToastService } from '../../../shared/ui/retroalimentacion/toast.service';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
/** Tope del original: lo que se sube es el recorte (JPEG de 512 px), muy por debajo de los 2 MB del servidor. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Foto de perfil: elegir una imagen, encuadrarla en el recortador circular, guardarla o quitar la actual.
 * El servidor vuelve a comprobar el tipo por el contenido del archivo.
 */
@Component({
  selector: 'app-foto-perfil',
  imports: [LucideAngularModule, Avatar, Modal, RecortadorFoto],
  template: `
    <div class="foto-perfil">
      <app-avatar [texto]="auth.iniciales()" [imagen]="auth.usuario()?.fotoUrl" [tamano]="tamano()" />
      <div class="acciones">
        <label class="btn btn-contorno">
          <lucide-icon name="camera" [size]="18" aria-hidden="true" />
          {{ auth.usuario()?.fotoUrl ? 'Cambiar foto' : 'Subir foto' }}
          <input class="visualmente-oculto" type="file" accept="image/jpeg,image/png,image/webp" (change)="elegir($event)" />
        </label>
        @if (auth.usuario()?.fotoUrl) {
          <button type="button" class="btn btn-texto peligro" [disabled]="guardando()" (click)="quitar()">Quitar foto</button>
        }
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <p class="ayuda">JPG, PNG o WebP. Antes de guardarla la encuadras en un círculo; se ve en tu menú y, si eres docente, en tus cursos y reseñas.</p>
    </div>

    @if (archivo(); as a) {
      <app-modal titulo="Encuadra tu foto" icono="camera" [ancho]="420" (cerrar)="descartar()">
        <app-recortador-foto #recortador [archivo]="a" (listo)="lista.set($event)" />
        @if (errorModal()) { <p class="error" role="alert">{{ errorModal() }}</p> }
        <div class="acciones-modal">
          <button type="button" class="btn btn-suave" [disabled]="guardando()" (click)="descartar()">Cancelar</button>
          <button type="button" class="btn btn-primario" [disabled]="!lista() || guardando()" (click)="guardar(recortador)">
            {{ guardando() ? 'Guardando…' : 'Guardar foto' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .foto-perfil { display: grid; justify-items: center; gap: 12px; text-align: center; }
    .acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; .btn { display: inline-flex; align-items: center; gap: 6px; } }
    .acciones-modal { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    label.btn { cursor: pointer; }
    label.btn:focus-within { outline: 3px solid var(--azul-600); outline-offset: 3px; }
    .peligro { color: var(--rojo-700); }
    .error { margin: 12px 0 0; color: var(--rojo-700); }
    .ayuda { margin: 0; font-size: 13px; line-height: 1.5; color: var(--tinta-700); max-width: 40ch; }
  `,
})
export class FotoPerfil {
  protected readonly auth = inject(AuthService);
  private readonly perfil = inject(PerfilService);
  private readonly toast = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);

  readonly tamano = input(96);

  protected readonly archivo = signal<File | null>(null);
  protected readonly lista = signal(false);
  protected readonly error = signal('');
  protected readonly errorModal = signal('');
  protected readonly guardando = signal(false);

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
      this.error.set(`«${archivo.name}» pesa ${(archivo.size / (1024 * 1024)).toFixed(1)} MB; el máximo es 15 MB.`);
      return;
    }
    this.error.set('');
    this.errorModal.set('');
    this.lista.set(false);
    this.archivo.set(archivo);
  }

  protected async guardar(recortador: RecortadorFoto): Promise<void> {
    this.guardando.set(true);
    this.errorModal.set('');
    try {
      const recorte = await recortador.recortar();
      if (!recorte) throw new Error('recorte');
      await this.perfil.subirFoto(recorte);
      this.archivo.set(null);
      this.toast.exito('Foto de perfil actualizada.');
    } catch (error) {
      this.errorModal.set(mensajeDeError(error, 'Guardar la foto'));
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
    if (this.guardando()) return;
    this.archivo.set(null);
  }
}
