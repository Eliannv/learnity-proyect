import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Subconjunto del SDK oficial de YouTube que usa este feature. */
export interface ReproductorYoutubeSdk {
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  seekTo(segundos: number, permitirCarga: boolean): void;
  playVideo(): void;
  destroy(): void;
}

export interface OpcionesYoutubeSdk {
  videoId: string;
  width: string;
  height: string;
  host: string;
  playerVars: { origin: string; autoplay: number; controls: number; playsinline: number; rel: number };
  events: {
    onReady: (evento: { target: ReproductorYoutubeSdk }) => void;
    onStateChange: (evento: { data: number }) => void;
    onError: (evento: { data: number }) => void;
  };
}

export interface YoutubeSdk {
  Player: new (elemento: HTMLElement, opciones: OpcionesYoutubeSdk) => ReproductorYoutubeSdk;
}

type VentanaYoutube = Window & {
  YT?: YoutubeSdk;
  onYouTubeIframeAPIReady?: () => void;
};

@Injectable({ providedIn: 'root' })
export class YoutubeApi {
  private readonly documento = inject(DOCUMENT);
  private carga?: Promise<YoutubeSdk>;

  cargar(): Promise<YoutubeSdk> {
    const ventana = this.documento.defaultView as VentanaYoutube | null;
    if (!ventana) return Promise.reject(new Error('El vídeo necesita un navegador.'));
    if (ventana.YT?.Player) return Promise.resolve(ventana.YT);
    if (this.carga) return this.carga;

    this.carga = new Promise<YoutubeSdk>((resolver, rechazar) => {
      // Fuente constante: nunca procede de un docente ni del contrato HTTP.
      const script = this.documento.createElement('script');
      const anterior = ventana.onYouTubeIframeAPIReady;
      let terminado = false;
      let limite: ReturnType<typeof setTimeout>;
      const limpiar = () => {
        clearTimeout(limite);
        script.removeEventListener('error', fallar);
        if (ventana.onYouTubeIframeAPIReady === listo) {
          ventana.onYouTubeIframeAPIReady = anterior;
        }
      };
      const fallar = () => {
        if (terminado) return;
        terminado = true;
        limpiar();
        script.remove();
        rechazar(new Error('No se pudo conectar con YouTube. Comprueba tu conexión y reintenta.'));
      };
      const listo = () => {
        if (terminado) return;
        if (!ventana.YT?.Player) { fallar(); return; }
        terminado = true;
        limpiar();
        resolver(ventana.YT);
        // Conserva un consumidor anterior sin dejar que su fallo afecte a este.
        try { anterior?.(); } catch { /* callback de otra integración */ }
      };
      ventana.onYouTubeIframeAPIReady = listo;
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.addEventListener('error', fallar, { once: true });
      limite = setTimeout(fallar, 15_000);
      this.documento.head.appendChild(script);
    });
    void this.carga.catch(() => { this.carga = undefined; });
    return this.carga;
  }
}
