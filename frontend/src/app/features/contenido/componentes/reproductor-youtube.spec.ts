import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReproductorYoutube } from './reproductor-youtube';
import { YoutubeApi, type OpcionesYoutubeSdk, type ReproductorYoutubeSdk, type YoutubeSdk } from '../youtube-api';
import type { PosicionYoutube } from '../youtube';

const id = 'M7lc1UVf-VE';

describe('reproductor compartido YouTube', () => {
  let fixture: ComponentFixture<ReproductorYoutube>;
  let opciones: OpcionesYoutubeSdk[];
  let jugadores: JugadorPrueba[];
  let muestras: PosicionYoutube[];
  let api: { cargar: ReturnType<typeof vi.fn> };

  class JugadorPrueba implements ReproductorYoutubeSdk {
    segundos = 0;
    duracion = 180;
    readonly iframe = document.createElement('iframe');
    readonly seekTo = vi.fn();
    readonly playVideo = vi.fn();
    readonly destroy = vi.fn(() => this.iframe.remove());
    getCurrentTime = () => this.segundos;
    getDuration = () => this.duracion;
    getIframe = () => this.iframe;
    constructor(elemento: HTMLElement, opts: OpcionesYoutubeSdk) {
      elemento.replaceWith(this.iframe);
      opciones.push(opts);
      jugadores.push(this);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    opciones = [];
    jugadores = [];
    muestras = [];
    api = { cargar: vi.fn().mockResolvedValue({ Player: JugadorPrueba } satisfies YoutubeSdk) };
    TestBed.configureTestingModule({ providers: [{ provide: YoutubeApi, useValue: api }] });
    fixture = TestBed.createComponent(ReproductorYoutube);
    fixture.componentRef.setInput('videoId', id);
    fixture.componentRef.setInput('leccionId', 8);
    fixture.componentRef.setInput('titulo', 'Introducción');
    fixture.componentRef.setInput('observarPosicion', true);
    fixture.componentInstance.posicion.subscribe((m) => muestras.push(m));
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); vi.useRealTimers(); });

  function boton(texto: string): HTMLButtonElement {
    return [...fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>]
      .find((b) => b.textContent?.includes(texto))!;
  }
  /** El reproductor se carga solo: basta con dejar correr las promesas pendientes. */
  async function vaciar(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  async function cargar(listo = true): Promise<void> {
    await vaciar();
    if (listo) opciones.at(-1)!.events.onReady({ target: jugadores.at(-1)! });
    fixture.detectChanges();
  }

  it('se carga sin pedir un clic y construye el reproductor con origen y host fijos', async () => {
    expect(api.cargar).toHaveBeenCalledOnce();
    await cargar();
    expect(fixture.nativeElement.textContent).not.toContain('Cargar vídeo');
    expect(opciones[0]).toMatchObject({
      videoId: id, host: 'https://www.youtube-nocookie.com',
      playerVars: { origin: window.location.origin, autoplay: 0, controls: 1, playsinline: 1 },
    });
    expect(jugadores[0].iframe.title).toBe('Introducción');
  });

  it('rechaza URLs y HTML en la entrada de ID antes de cargar el SDK', async () => {
    api.cargar.mockClear();
    fixture.componentRef.setInput('videoId', '<iframe src="https://falso.example"></iframe>');
    fixture.detectChanges();
    await vaciar();
    expect(api.cargar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('identificador válido');
  });

  it('muestra la posición del servidor y reanuda solo por acción explícita', async () => {
    fixture.componentRef.setInput('posicionGuardada', 65);
    await cargar();
    expect(jugadores[0].seekTo).not.toHaveBeenCalled();
    boton('Reanudar desde 1:05').click();
    expect(jugadores[0].seekTo).toHaveBeenCalledWith(65, true);
    expect(jugadores[0].playVideo).toHaveBeenCalledOnce();
  });

  it('no escribe la posición cero solo por cargar o pausar sin reproducir', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 2 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(muestras).toEqual([]);
  });

  it('muestrea cada 15 segundos, conserva la última pausa y elimina duplicados', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 14;
    await vi.advanceTimersByTimeAsync(14_000);
    expect(muestras).toHaveLength(0);
    jugadores[0].segundos = 15.9;
    await vi.advanceTimersByTimeAsync(1000);
    expect(muestras).toEqual([{ leccionId: 8, videoId: id, segundos: 15, motivo: 'intervalo' }]);
    jugadores[0].segundos = 17;
    opciones[0].events.onStateChange({ data: 2 });
    jugadores[0].segundos = 18;
    opciones[0].events.onStateChange({ data: 2 });
    expect(muestras).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(muestras[1]).toEqual({ leccionId: 8, videoId: id, segundos: 18, motivo: 'pausa' });
    opciones[0].events.onStateChange({ data: 2 });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(muestras).toHaveLength(2);
  });

  it('no emite progreso para la vista previa pública', async () => {
    fixture.componentRef.setInput('observarPosicion', false);
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 50;
    await vi.advanceTimersByTimeAsync(60_000);
    opciones[0].events.onStateChange({ data: 2 });
    expect(muestras).toEqual([]);
  });

  it('emitir el final del vídeo no equivale a completar una lección', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 180;
    opciones[0].events.onStateChange({ data: 0 });
    expect(muestras).toEqual([{ leccionId: 8, videoId: id, segundos: 180, motivo: 'pausa' }]);
    expect('completada' in fixture.componentInstance).toBe(false);
  });

  it('identifica la última muestra del vídeo anterior al cambiar de lección', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 42;
    fixture.componentRef.setInput('videoId', 'dQw4w9WgXcQ');
    fixture.detectChanges();
    expect(muestras).toEqual([{ leccionId: 8, videoId: id, segundos: 42, motivo: 'salida' }]);
    expect(jugadores[0].destroy).toHaveBeenCalledOnce();
    opciones[0].events.onError({ data: 100 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('es privado');
  });

  it('ignora un SDK que termina de cargar después de cambiar de lección', async () => {
    await vaciar();
    let resolver!: (sdk: YoutubeSdk) => void;
    api.cargar.mockReturnValueOnce(new Promise<YoutubeSdk>((r) => { resolver = r; }));
    fixture.componentRef.setInput('videoId', 'dQw4w9WgXcQ');
    fixture.detectChanges();
    fixture.componentRef.setInput('videoId', id);
    fixture.detectChanges();
    resolver({ Player: JugadorPrueba });
    await vaciar();
    expect(opciones.map((o) => o.videoId)).not.toContain('dQw4w9WgXcQ');
  });

  it('reinicia al pasar a otra lección que reutiliza el mismo vídeo', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 23;
    fixture.componentRef.setInput('leccionId', 9);
    fixture.detectChanges();
    expect(muestras).toEqual([{ leccionId: 8, videoId: id, segundos: 23, motivo: 'salida' }]);
    expect(jugadores[0].destroy).toHaveBeenCalledOnce();
    await vaciar();
    expect(jugadores).toHaveLength(2);
  });

  it.each([100, 101, 150, 153])('muestra un error útil del SDK: %s', async (codigo) => {
    await cargar();
    opciones[0].events.onError({ data: codigo });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(boton('Reintentar')).toBeDefined();
    expect(jugadores[0].destroy).toHaveBeenCalledOnce();
  });

  it('limita la carga del reproductor y permite reintentar', async () => {
    await cargar(false);
    await vi.advanceTimersByTimeAsync(20_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('tarda demasiado');
    expect(boton('Reintentar')).toBeDefined();
  });

  it('informa la pérdida de red y limpia los temporizadores', async () => {
    await cargar();
    opciones[0].events.onStateChange({ data: 1 });
    jugadores[0].segundos = 12;
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Se perdió la conexión');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(muestras).toHaveLength(1);
  });
});
