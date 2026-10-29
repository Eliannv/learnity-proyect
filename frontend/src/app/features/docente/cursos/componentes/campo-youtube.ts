import { Component, computed, input, model, signal } from '@angular/core';
import { validarEnlaceYoutube } from '../../../contenido/youtube';

/** Campo de formulario sin HTTP, reutilizable en el módulo y el editor de contenido. */
@Component({
  selector: 'app-campo-youtube',
  templateUrl: './campo-youtube.html',
})
export class CampoYoutube {
  readonly id = input.required<string>();
  readonly requerido = input(true);
  readonly enlace = model('');
  readonly bloqueado = input(false);
  readonly errorServidor = input('');
  protected readonly tocado = signal(false);
  protected readonly resultado = computed(() => validarEnlaceYoutube(this.enlace()));
  protected readonly mensaje = computed(() => {
    if (this.errorServidor()) return this.errorServidor();
    if (!this.requerido() && !this.enlace().trim()) return '';
    const resultado = this.resultado();
    return this.tocado() && !resultado.valido ? resultado.mensaje : '';
  });

  validar(): boolean {
    this.tocado.set(true);
    if (!this.requerido() && !this.enlace().trim()) return !this.errorServidor();
    return this.resultado().valido && !this.errorServidor();
  }

  protected cambiar(evento: Event): void {
    this.enlace.set((evento.target as HTMLInputElement).value);
    this.tocado.set(true);
  }
}
