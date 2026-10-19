/** Datos sintéticos para verificar las tres rutas públicas en la base local. */
import 'dotenv/config';
import { enTransaccion, pool } from '../src/shared/database/pool.js';
import { env } from '../src/shared/config/env.js';
import { semillasRepository } from '../src/database/semillas.repository.js';

if (env.NODE_ENV === 'production') throw new Error('No se permite sembrar cursos de prueba en producción.');

const cursos = [
  { titulo: '[Prueba Sprint 2] Python desde cero', categoria: 'Programación', nivel: 'PRINCIPIANTE', estado: 'PUBLICADO', dias: 3 },
  { titulo: '[Prueba Sprint 2] Diseño de interfaces', categoria: 'Diseño', nivel: 'INTERMEDIO', estado: 'PUBLICADO', dias: 2 },
  { titulo: '[Prueba Sprint 2] Python avanzado', categoria: 'Programación', nivel: 'AVANZADO', estado: 'PUBLICADO', dias: 1 },
  { titulo: '[Prueba Sprint 2] Borrador privado', categoria: 'Programación', nivel: 'PRINCIPIANTE', estado: 'BORRADOR', dias: 0 },
] as const;

try {
  await enTransaccion(async (cliente) => {
    const idDocente = await semillasRepository.idDocentePorCorreo(cliente, 'carlos.mendoza@correo.com');
    if (!idDocente) throw new Error('Falta el docente de prueba. Ejecuta primero npm run db:seed.');
    // Un curso PUBLICADO exige quién lo revisó y cuándo se publicó (migración 023).
    const idRevisor = await semillasRepository.idPersonaPorCorreo(cliente, 'ana.torres@learnity.com');
    if (!idRevisor) throw new Error('Falta el administrador de prueba. Ejecuta primero npm run db:seed.');

    for (const muestra of cursos) {
      const idCategoria = await semillasRepository.idCategoriaActiva(cliente, muestra.categoria);
      if (!idCategoria) throw new Error(`Falta la categoría activa ${muestra.categoria}. Ejecuta primero npm run db:seed.`);
      if (await semillasRepository.existeCurso(cliente, idDocente, muestra.titulo)) {
        console.log(`= ${muestra.titulo}: ya existe`);
        continue;
      }
      const publicado = muestra.estado === 'PUBLICADO';
      const idCurso = await semillasRepository.crearCurso(cliente, {
        idDocente,
        idCategoria,
        titulo: muestra.titulo,
        subtitulo: 'Curso sintético para comprobar el catálogo público.',
        descripcion: 'Contenido de prueba local. No representa un curso aprobado mediante el flujo administrativo.',
        nivel: muestra.nivel,
        objetivos: ['Conocer la estructura', 'Practicar los conceptos', 'Continuar aprendiendo'],
        requisitos: ['Ninguno'],
        estado: muestra.estado,
        revisadoPor: publicado ? idRevisor : null,
        publicadoEn: publicado ? new Date(Date.now() - muestra.dias * 86400000) : null,
      });
      const idModulo = await semillasRepository.crearModulo(cliente, idCurso, 'Primer módulo', 1);
      await semillasRepository.crearLeccionDocumento(cliente, idModulo, 'Lección de ejemplo', 1);
      console.log(`+ ${muestra.titulo}: id ${idCurso} (${muestra.estado})`);
    }
  });
} finally {
  await pool.end();
}
