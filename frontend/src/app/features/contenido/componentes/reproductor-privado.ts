import { Component, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ContenidoApi } from '../contenido.api';
import { mensajeDeError } from '../../../core/http/error-api';
import type { PosicionYoutube } from '../youtube';

@Component({
  selector: 'app-reproductor-privado',
  template: `
    @if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button type="button" class="btn btn-contorno" (click)="intento.update(incrementar)">
          Reintentar
        </button>
      </div>
    } @else if (url(); as fuente) {
      <video
        #video
        [src]="fuente"
        [attr.aria-label]="titulo()"
        controls
        playsinline
        preload="metadata"
        (loadedmetadata)="reanudar(video)"
        (timeupdate)="muestra(video, 'intervalo')"
        (pause)="muestra(video, 'pausa')"
        (seeked)="muestra(video, 'pausa')"
        (ended)="fin(video)"
        (error)="fallo()"
      ></video>
    } @else {
      <p role="status">Cargando la grabación…</p>
    }
  `,
  styles: [
    ':host{display:block;width:100%}video{display:block;width:100%;max-height:70vh;aspect-ratio:16/9;background:#10141d;border-radius:.5rem}',
  ],
})
export class ReproductorPrivado {
  readonly leccionId = input.required<number>();
  readonly grabacionId = input.required<string>();
  readonly titulo = input.required<string>();
  readonly posicionGuardada = input(0);
  readonly posicion = output<PosicionYoutube>();
  readonly terminado = output<{ leccionId: number; videoId: string }>();
  protected url = signal('');
  protected error = signal('');
  protected intento = signal(0);
  protected incrementar = (n: number) => n + 1;
  private readonly api = inject(ContenidoApi);
  private readonly elemento = viewChild<ElementRef<HTMLVideoElement>>('video');
  private ultima = 0;
  constructor() {
    effect((onCleanup) => {
      const leccion = this.leccionId(),
        grabacion = this.grabacionId();
      this.intento();
      this.url.set('');
      this.error.set('');
      this.ultima = 0;
      let vigente = true;
      const autorizar = async () => {
        try {
          const url = await this.api.autorizarVideo(leccion);
          if (vigente) this.url.set(url);
        } catch (e) {
          if (vigente) {
            this.url.set('');
            this.error.set(mensajeDeError(e, 'Abrir la grabación'));
          }
        }
      };
      void autorizar();
      const renovacion = setInterval(() => void autorizar(), 8 * 60 * 1000);
      onCleanup(() => {
        vigente = false;
        clearInterval(renovacion);
        const v = this.elemento()?.nativeElement;
        if (v && v.currentTime > 0)
          this.posicion.emit({
            leccionId: leccion,
            videoId: grabacion,
            segundos: Math.floor(v.currentTime),
            motivo: 'salida',
          });
      });
    });
  }
  protected reanudar(video: HTMLVideoElement) {
    const segundos = this.posicionGuardada();
    if (segundos > 0 && segundos < video.duration) video.currentTime = segundos;
  }
  protected muestra(v: HTMLVideoElement, motivo: PosicionYoutube['motivo']) {
    if (
      v.readyState < 1 ||
      !Number.isFinite(v.currentTime) ||
      (motivo === 'intervalo' && !v.currentTime) ||
      (motivo === 'intervalo' && Date.now() - this.ultima < 10000)
    )
      return;
    this.ultima = Date.now();
    this.posicion.emit({
      leccionId: this.leccionId(),
      videoId: this.grabacionId(),
      segundos: Math.floor(v.currentTime),
      motivo,
    });
  }
  protected fin(v: HTMLVideoElement) {
    this.muestra(v, 'fin');
    this.terminado.emit({ leccionId: this.leccionId(), videoId: this.grabacionId() });
  }
  protected fallo() {
    this.error.set('No se pudo reproducir la grabación. Reintenta para comprobar tu acceso.');
  }
}
