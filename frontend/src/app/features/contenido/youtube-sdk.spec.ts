import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YoutubeApi, type YoutubeSdk } from './youtube-sdk';

const ventana = window as Window & { YT?: YoutubeSdk; onYouTubeIframeAPIReady?: () => void };

describe('carga compartida del SDK YouTube', () => {
  const anterior = ventana.onYouTubeIframeAPIReady;
  const ytAnterior = ventana.YT;
  const sdk = { Player: vi.fn() } as unknown as YoutubeSdk;

  beforeEach(() => {
    vi.useFakeTimers();
    delete ventana.YT;
    delete ventana.onYouTubeIframeAPIReady;
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach((s) => s.remove());
    ventana.YT = ytAnterior;
    ventana.onYouTubeIframeAPIReady = anterior;
    vi.useRealTimers();
  });

  it('inserta una sola fuente fija para solicitudes simultáneas y conserva otro callback', async () => {
    const callback = vi.fn();
    ventana.onYouTubeIframeAPIReady = callback;
    const api = TestBed.inject(YoutubeApi);
    const primera = api.cargar();
    expect(api.cargar()).toBe(primera);
    expect(document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')).toHaveLength(1);
    ventana.YT = sdk;
    ventana.onYouTubeIframeAPIReady?.();
    await expect(primera).resolves.toBe(sdk);
    expect(callback).toHaveBeenCalledOnce();
    expect(ventana.onYouTubeIframeAPIReady).toBe(callback);
  });

  it('reutiliza un SDK disponible sin insertar scripts', async () => {
    ventana.YT = sdk;
    await expect(TestBed.inject(YoutubeApi).cargar()).resolves.toBe(sdk);
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull();
  });

  it('permite reintentar después de un fallo de red', async () => {
    const api = TestBed.inject(YoutubeApi);
    const primera = api.cargar();
    const fallo = expect(primera).rejects.toThrow('conectar con YouTube');
    document.querySelector('script[src="https://www.youtube.com/iframe_api"]')!.dispatchEvent(new Event('error'));
    await fallo;
    const segunda = api.cargar();
    expect(segunda).not.toBe(primera);
    ventana.YT = sdk;
    ventana.onYouTubeIframeAPIReady?.();
    await expect(segunda).resolves.toBe(sdk);
  });

  it('termina la espera a los 15 segundos sin dejar el callback propio', async () => {
    const espera = TestBed.inject(YoutubeApi).cargar();
    const fallo = expect(espera).rejects.toThrow('conectar con YouTube');
    await vi.advanceTimersByTimeAsync(15_000);
    await fallo;
    expect(ventana.onYouTubeIframeAPIReady).toBeUndefined();
  });
});
