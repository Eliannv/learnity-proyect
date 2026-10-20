// Pruebas unitarias puras de la política de estados y permisos del curso (ADR-003).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Rol, UsuarioSesion } from '../../src/shared/auth/tipos.js';
import { MENSAJES, politicaCurso } from '../../src/modules/cursos/politica-curso.js';
import type { ContextoCurso } from '../../src/modules/cursos/cursos.modelo.js';

const baseCtx: ContextoCurso = {
  id: 10,
  idPersonaDocente: 100,
  docenteActivo: true,
  estado: 'BORRADOR',
};

function sesion(idPersona: number, roles: Rol[]): UsuarioSesion {
  return {
    idUsuario: idPersona,
    idPersona,
    correo: `u${idPersona}@b.co`,
    roles,
    sid: '00000000-0000-4000-8000-000000000000',
  };
}

describe('Política pura de cursos (ADR-003)', () => {
  it('esEditable y puedePasar a EN_REVISION solo admiten BORRADOR y RECHAZADO', () => {
    for (const estado of ['BORRADOR', 'RECHAZADO'] as const) {
      assert.equal(politicaCurso.esEditable(estado), true);
      assert.equal(politicaCurso.puedePasar(estado, 'EN_REVISION'), true);
    }
    for (const estado of ['EN_REVISION', 'PUBLICADO', 'ARCHIVADO'] as const) {
      assert.equal(politicaCurso.esEditable(estado), false);
      assert.equal(politicaCurso.puedePasar(estado, 'EN_REVISION'), false);
    }
  });

  it('puedePasar desde EN_REVISION solo admite PUBLICADO y RECHAZADO', () => {
    assert.equal(politicaCurso.puedePasar('EN_REVISION', 'PUBLICADO'), true);
    assert.equal(politicaCurso.puedePasar('EN_REVISION', 'RECHAZADO'), true);
    assert.equal(politicaCurso.puedePasar('EN_REVISION', 'BORRADOR'), false);
    assert.equal(politicaCurso.puedePasar('PUBLICADO', 'BORRADOR'), false);
  });

  it('puedeLeerArchivos autoriza a ADMIN o al DOCENTE propietario', () => {
    assert.equal(politicaCurso.puedeLeerArchivos(baseCtx, sesion(999, ['ADMIN'])), true);
    assert.equal(politicaCurso.puedeLeerArchivos(baseCtx, sesion(100, ['ESTUDIANTE', 'DOCENTE'])), true);
    assert.equal(politicaCurso.puedeLeerArchivos(baseCtx, sesion(200, ['ESTUDIANTE', 'DOCENTE'])), false);
    assert.equal(politicaCurso.puedeLeerArchivos(baseCtx, sesion(100, ['ESTUDIANTE'])), false);
  });

  it('exigirEditable y exigirTransicion lanzan 403 ante no propietario y 409 CURSO_BLOQUEADO en estado inválido', () => {
    const dueno = sesion(100, ['DOCENTE']);
    const intruso = sesion(200, ['DOCENTE']);

    assert.doesNotThrow(() => politicaCurso.exigirEditable(baseCtx, dueno, MENSAJES.actualizarCurso));

    assert.throws(
      () => politicaCurso.exigirEditable(baseCtx, intruso, MENSAJES.actualizarCurso),
      (err: any) => err.status === 403 && err.message === MENSAJES.actualizarCurso.sinPermiso,
    );

    assert.throws(
      () => politicaCurso.exigirEditable({ ...baseCtx, estado: 'EN_REVISION' }, dueno, MENSAJES.actualizarCurso),
      (err: any) => err.status === 409 && err.codigo === 'CURSO_BLOQUEADO',
    );

    assert.throws(
      () =>
        politicaCurso.exigirTransicion(
          { ...baseCtx, estado: 'PUBLICADO' },
          dueno,
          'EN_REVISION',
          MENSAJES.enviarARevision,
        ),
      (err: any) => err.status === 409 && err.codigo === 'CURSO_BLOQUEADO',
    );
  });
});
