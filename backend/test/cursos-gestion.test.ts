import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  datosCursoSchema,
  datosModuloSchema,
  datosLeccionSchema,
} from '../src/modules/cursos/cursos-gestion.esquemas.js';

describe('Integrante 2 - Backend de Cursos', () => {
  const cursoValido = {
    titulo: 'Introducción a la programación',
    subtitulo: 'Aprende desde cero',
    descripcion: 'Fundamentos básicos de programación',
    categoriaId: 1,
    nivel: 'PRINCIPIANTE',
    portadaUrl: '/img/portada.jpg',
    objetivos: [
      'Comprender conceptos básicos',
      'Identificar estructuras de control',
      'Resolver ejercicios sencillos',
    ],
    requisitos: [],
  };

  describe('Validación de cursos', () => {
    it('acepta los datos de un curso válido', () => {
      assert.equal(
        datosCursoSchema.safeParse(cursoValido).success,
        true,
      );
    });

    it('rechaza un título vacío', () => {
      assert.equal(
        datosCursoSchema.safeParse({
          ...cursoValido,
          titulo: '',
        }).success,
        false,
      );
    });

    it('rechaza una categoría con ID inválido', () => {
      assert.equal(
        datosCursoSchema.safeParse({
          ...cursoValido,
          categoriaId: -1,
        }).success,
        false,
      );
    });

    it('rechaza niveles no permitidos', () => {
      assert.equal(
        datosCursoSchema.safeParse({
          ...cursoValido,
          nivel: 'EXPERTO',
        }).success,
        false,
      );
    });

    it('rechaza títulos de más de 150 caracteres', () => {
      assert.equal(
        datosCursoSchema.safeParse({
          ...cursoValido,
          titulo: 'A'.repeat(151),
        }).success,
        false,
      );
    });
  });

  describe('Validación de módulos', () => {
    it('acepta un módulo válido', () => {
      assert.equal(
        datosModuloSchema.safeParse({
          titulo: 'Fundamentos',
          orden: 1,
        }).success,
        true,
      );
    });

    it('rechaza el módulo 11', () => {
      assert.equal(
        datosModuloSchema.safeParse({
          titulo: 'Módulo extra',
          orden: 11,
        }).success,
        false,
      );
    });

    it('rechaza un título vacío', () => {
      assert.equal(
        datosModuloSchema.safeParse({
          titulo: '',
          orden: 1,
        }).success,
        false,
      );
    });
  });

  describe('Validación de lecciones', () => {
    it('acepta una lección DOCUMENTO', () => {
      assert.equal(
        datosLeccionSchema.safeParse({
          titulo: 'Conceptos básicos',
          orden: 1,
          tipo: 'DOCUMENTO',
        }).success,
        true,
      );
    });

    it('rechaza una lección con orden 13', () => {
      assert.equal(
        datosLeccionSchema.safeParse({
          titulo: 'Lección extra',
          orden: 13,
          tipo: 'DOCUMENTO',
        }).success,
        false,
      );
    });

    it('rechaza tipos fuera del contrato', () => {
      assert.equal(
        datosLeccionSchema.safeParse({
          titulo: 'Lección',
          orden: 1,
          tipo: 'VIDEO',
        }).success,
        false,
      );
    });
  });
});
