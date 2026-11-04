import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

/** Igual que el servidor: solo enlaces `https://` externos, sin credenciales y de hasta 255 caracteres. */
function esUrlImagenValida(valor: string): boolean {
  if (!valor || valor.length > 255 || /\s/.test(valor)) return false;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Foto de perfil: elegir una imagen y encuadrarla en el recortador circular (1:1),
 * o pegar una URL directa con vista previa circular, o quitar la foto actual.
 */
@Component({
  selector: 'app-foto-perfil',
  imports: [FormsModule, LucideAngularModule, Avatar, Modal, RecortadorFoto],
  template: `
    <div class="foto-perfil">
      <app-avatar [texto]="auth.iniciales()" [imagen]="auth.usuario()?.fotoUrl" [tamano]="tamano()" />
      <div class="acciones">
        <label class="btn btn-contorno">
          <lucide-icon name="camera" [size]="18" aria-hidden="true" />
          {{ auth.usuario()?.fotoUrl ? 'Cambiar foto' : 'Subir foto' }}
          <input class="visualmente-oculto" type="file" accept="image/jpeg,image/png,image/webp" (change)="elegir($event)" />
        </label>
        <button type="button" class="btn btn-contorno" [disabled]="guardando()" (click)="abrirModalUrl()">
          <lucide-icon name="globe" [size]="18" aria-hidden="true" />
          Usar enlace (URL)
        </button>
        @if (auth.usuario()?.fotoUrl) {
          <button type="button" class="btn btn-texto peligro" [disabled]="guardando()" (click)="quitar()">Quitar foto</button>
        }
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <p class="ayuda">Sube un archivo JPG, PNG o WebP con recorte circular, o pega el enlace directo de una imagen.</p>
    </div>

    @if (archivo(); as a) {
      <app-modal titulo="Encuadra tu foto" icono="camera" [ancho]="420" (cerrar)="descartar()">
        <app-recortador-foto #recortador [archivo]="a" proporcion="1:1" (listo)="lista.set($event)" />
        @if (errorModal()) { <p class="error" role="alert">{{ errorModal() }}</p> }
        <div class="acciones-modal">
          <button type="button" class="btn btn-suave" [disabled]="guardando()" (click)="descartar()">Cancelar</button>
          <button type="button" class="btn btn-primario" [disabled]="!lista() || guardando()" (click)="guardar(recortador)">
            {{ guardando() ? 'Guardando…' : 'Guardar foto' }}
          </button>
        </div>
      </app-modal>
    }

    @if (modalUrl()) {
      <app-modal titulo="Usar enlace de imagen" icono="globe" [ancho]="440" (cerrar)="cerrarModalUrl()">
        <div class="modal-url-cuerpo">
          <div class="preview-circular-contenedor">
            @if (urlLimpia() && urlFormatoValido() && !errorCargaUrl()) {
              <img
                class="preview-circular-img"
                [src]="urlLimpia()"
                alt="Vista previa circular de tu foto de perfil"
                width="112"
                height="112"
                (load)="urlCargada.set(true); errorCargaUrl.set(false)"
                (error)="errorCargaUrl.set(true); urlCargada.set(false)"
              />
            } @else {
              <app-avatar [texto]="auth.iniciales()" [imagen]="null" [tamano]="112" />
            }
          </div>

          <label class="campo-url">
            <span class="etiqueta">URL de la imagen</span>
            <input
              type="url"
              class="control"
              [ngModel]="enlaceUrl()"
              (ngModelChange)="alCambiarUrl($event)"
              maxlength="255"
              placeholder="https://ejemplo.com/mi-foto.jpg"
            />
            <span class="ayuda-url">Pega un enlace directo (https://…) a una imagen JPG, PNG o WebP.</span>
          </label>

          @if (errorCargaUrl()) {
            <p class="error" role="alert">No se pudo cargar una imagen desde ese enlace. Verifica que sea una URL pública directa.</p>
          }
          @if (errorModal()) {
            <p class="error" role="alert">{{ errorModal() }}</p>
          }

          <div class="acciones-modal">
            <button type="button" class="btn btn-suave" [disabled]="guardando()" (click)="cerrarModalUrl()">Cancelar</button>
            <button
              type="button"
              class="btn btn-primario"
              [disabled]="!urlFormatoValido() || errorCargaUrl() || guardando()"
              (click)="guardarUrl()"
            >
              {{ guardando() ? 'Guardando…' : 'Guardar foto' }}
            </button>
          </div>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .foto-perfil { display: grid; justify-items: center; gap: 12px; text-align: center; }
    .acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; .btn { display: inline-flex; align-items: center; gap: 6px; } }
    .acciones-modal { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    label.btn { cursor: pointer; }
    label.btn:focus-within { outline: 3px solid var(--azul-600); outline-offset: 3px; }
    .peligro { color: var(--rojo-700); }
    .error { margin: 8px 0 0; color: var(--rojo-700); font-size: 13px; }
    .ayuda { margin: 0; font-size: 13px; line-height: 1.5; color: var(--tinta-700); max-width: 40ch; }
    .modal-url-cuerpo { display: grid; gap: 14px; }
    .preview-circular-contenedor { display: grid; place-items: center; padding: 4px 0; }
    .preview-circular-img {
      width: 112px;
      height: 112px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--borde);
      background: var(--suelo);
    }
    .campo-url { display: grid; gap: 6px; text-align: left; }
    .ayuda-url { font-size: 12px; color: var(--tinta-2); }
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
  protected readonly modalUrl = signal(false);
  protected readonly enlaceUrl = signal('');
  protected readonly urlCargada = signal(false);
  protected readonly errorCargaUrl = signal(false);
  protected readonly urlLimpia = computed(() => this.enlaceUrl().trim());
  protected readonly urlFormatoValido = computed(() => esUrlImagenValida(this.urlLimpia()));
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

  protected abrirModalUrl(): void {
    const actual = this.auth.usuario()?.fotoUrl ?? '';
    this.enlaceUrl.set(actual.startsWith('/api/fotos/') ? '' : actual);
    this.urlCargada.set(false);
    this.errorCargaUrl.set(false);
    this.errorModal.set('');
    this.modalUrl.set(true);
  }

  protected cerrarModalUrl(): void {
    if (this.guardando()) return;
    this.modalUrl.set(false);
    this.errorModal.set('');
  }

  protected alCambiarUrl(valor: string): void {
    this.enlaceUrl.set(valor);
    this.urlCargada.set(false);
    this.errorCargaUrl.set(false);
    this.errorModal.set('');
  }

  protected async guardarUrl(): Promise<void> {
    const url = this.urlLimpia();
    if (!esUrlImagenValida(url)) {
      this.errorModal.set('Ingresa una URL válida (https://…).');
      return;
    }
    this.guardando.set(true);
    this.errorModal.set('');
    try {
      await this.perfil.guardarFotoUrl(url);
      this.modalUrl.set(false);
      this.toast.exito('Foto de perfil actualizada.');
    } catch (error) {
      this.errorModal.set(mensajeDeError(error, 'Guardar la foto'));
    } finally {
      this.guardando.set(false);
    }
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
