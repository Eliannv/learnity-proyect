// Fábrica de cursos, módulos y lecciones creados SOLO por HTTP (caja negra), con la marca de la suite.
import assert from 'node:assert/strict';
import { pdfMinimo, subirPdf } from './archivos.js';
import type { Servidor } from './servidor.js';
import type { Cuenta } from './sesiones.js';

export function fabricaCursos(srv: Servidor, marca: string, categoriaId: () => number) {
  let n = 0;
  const como = (c: Cuenta, metodo: string, ruta: string, cuerpo?: unknown) =>
    srv.pedir(ruta, { token: c.token, metodo, cuerpo });

  function datosCurso(sufijo: string, extra: Record<string, unknown> = {}) {
    return {
      titulo: `${marca} ${sufijo}`,
      subtitulo: 'Subtítulo de prueba',
      descripcion: 'Descripción de prueba',
      categoriaId: categoriaId(),
      nivel: 'PRINCIPIANTE',
      portadaUrl: '/img/portada-prueba.jpg',
      objetivos: ['Primer objetivo', 'Segundo objetivo', 'Tercer objetivo'],
      requisitos: [],
      ...extra,
    };
  }

  async function crearCurso(c: Cuenta, extra: Record<string, unknown> = {}): Promise<number> {
    const r = await como(c, 'POST', '/api/cursos', datosCurso(`curso ${++n}`, extra));
    assert.equal(r.status, 201, r.texto);
    return r.json.id as number;
  }

  async function crearModulo(c: Cuenta, idCurso: number, orden = 1): Promise<number> {
    const r = await como(c, 'POST', `/api/cursos/${idCurso}/modulos`, { titulo: `Módulo ${orden}`, orden });
    assert.equal(r.status, 201, r.texto);
    return (r.json.modulos as any[]).find((x) => x.orden === orden).id as number;
  }

  async function crearLeccion(c: Cuenta, idModulo: number, orden = 1): Promise<number> {
    const r = await como(c, 'POST', `/api/modulos/${idModulo}/lecciones`, { titulo: `Lección ${orden}`, orden, tipo: 'DOCUMENTO' });
    assert.equal(r.status, 201, r.texto);
    const m = (r.json.modulos as any[]).find((x) => x.id === idModulo);
    return m.lecciones.find((l: any) => l.orden === orden).id as number;
  }

  /** Curso BORRADOR con un módulo, una lección DOCUMENTO y un PDF de 2 páginas. */
  async function cursoCompleto(c: Cuenta) {
    const idCurso = await crearCurso(c);
    const idModulo = await crearModulo(c, idCurso);
    const idLeccion = await crearLeccion(c, idModulo);
    const sub = await subirPdf(srv, idLeccion, c.token, await pdfMinimo(2));
    assert.equal(sub.status, 200, sub.texto);
    return { idCurso, idModulo, idLeccion, idArchivo: sub.json.modulos[0].lecciones[0].archivo.id as number };
  }

  async function enviarARevision(c: Cuenta, idCurso: number) {
    const r = await como(c, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    assert.equal(r.status, 200, r.texto);
    return r;
  }

  return { como, datosCurso, crearCurso, crearModulo, crearLeccion, cursoCompleto, enviarARevision };
}
