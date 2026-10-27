import { describe, expect, it } from 'vitest';
import {
  esIdYoutube, mensajeErrorYoutube, segundosSeguros, tiempoYoutube, validarEnlaceYoutube,
} from './youtube';

const id = 'M7lc1UVf-VE';

describe('validación del enlace YouTube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=lista&t=12`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=compartido`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    ` https://youtu.be/${id} `,
  ])('extrae solo el ID y elimina parámetros de %s', (enlace) => {
    expect(validarEnlaceYoutube(enlace)).toEqual({
      valido: true, videoId: id, enlaceCanonico: `https://www.youtube.com/watch?v=${id}`,
    });
  });

  it.each([
    '', id, `http://youtube.com/watch?v=${id}`, `javascript:alert(1)`,
    `<iframe src="https://youtube.com/embed/${id}"></iframe>`,
    `https://youtube.com.ejemplo.org/watch?v=${id}`, `https://falsoyoutube.com/watch?v=${id}`,
    `https://youtube.com@ejemplo.org/watch?v=${id}`, `https://usuario@youtube.com/watch?v=${id}`,
    `https://youtube.com:8080/watch?v=${id}`, `https://youtube.com/playlist?list=${id}`,
    `https://youtube.com/channel/${id}`, `https://youtube.com/watch?v=corto`,
    `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`,
    `https://youtu.be/${id}/otra-ruta`, `https://you\ntube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}%00`, `https://youtu.be/${'a'.repeat(2049)}`,
  ])('rechaza entradas engañosas o incompatibles: %s', (enlace) => {
    expect(validarEnlaceYoutube(enlace).valido).toBe(false);
  });

  it('explica por qué no se acepta HTML', () => {
    const resultado = validarEnlaceYoutube('<iframe></iframe>');
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.mensaje).toContain('HTML');
  });

  it.each([null, undefined, 123, 'aaaaaaaaaaa/../', 'aaaaaaaaaaa?x=1', '<aaaaaaaaa>', '短'.repeat(11)])(
    'el reproductor rechaza un ID inseguro: %s', (valor) => expect(esIdYoutube(valor)).toBe(false),
  );
  it('acepta los caracteres y longitud del ID', () => expect(esIdYoutube(id)).toBe(true));
});

describe('posición y errores de YouTube', () => {
  it('normaliza segundos y muestra minutos y horas', () => {
    expect(segundosSeguros(NaN)).toBe(0);
    expect(segundosSeguros(Infinity)).toBe(0);
    expect(segundosSeguros(-3)).toBe(0);
    expect(segundosSeguros(65.9)).toBe(65);
    expect(tiempoYoutube(65)).toBe('1:05');
    expect(tiempoYoutube(3661)).toBe('1:01:01');
  });
  it.each([2, 5, 100, 101, 150, 153, 999])('describe el fallo %s', (codigo) => {
    expect(mensajeErrorYoutube(codigo).length).toBeGreaterThan(20);
  });
});
