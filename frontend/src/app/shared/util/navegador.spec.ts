import { describe, expect, it } from 'vitest';
import { resumirNavegador } from './navegador';

describe('resumirNavegador', () => {
  it('reconoce los navegadores habituales y el sistema', () => {
    expect(resumirNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'))
      .toBe('Chrome 130 · Windows');
    expect(resumirNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'))
      .toBe('Edge 130 · Windows');
    expect(resumirNavegador('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox 131 · Linux');
    expect(resumirNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'))
      .toBe('Safari 17 · iOS');
    expect(resumirNavegador('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'))
      .toBe('Chrome 129 · Android');
  });

  it('herramientas y agentes desconocidos o vacíos', () => {
    expect(resumirNavegador('curl/8.4.0')).toBe('curl');
    expect(resumirNavegador('NavegadorDePrueba/1.0')).toBe('Otro navegador');
    expect(resumirNavegador(null)).toBe('Desconocido');
    expect(resumirNavegador('')).toBe('Desconocido');
  });
});
