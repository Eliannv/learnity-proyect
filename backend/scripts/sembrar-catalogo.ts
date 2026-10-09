/** Datos sintéticos para verificar las tres rutas públicas en la base local. */
import 'dotenv/config';
import { enTransaccion, pool } from '../src/shared/database/pool.js';
import { env } from '../src/shared/config/env.js';

if (env.NODE_ENV === 'production') throw new Error('No se permite sembrar cursos de prueba en producción.');

const cursos = [
  { titulo: '[Prueba Sprint 2] Python desde cero', categoria: 'Programación', nivel: 'PRINCIPIANTE', estado: 'PUBLICADO', dias: 3 },
  { titulo: '[Prueba Sprint 2] Diseño de interfaces', categoria: 'Diseño', nivel: 'INTERMEDIO', estado: 'PUBLICADO', dias: 2 },
  { titulo: '[Prueba Sprint 2] Python avanzado', categoria: 'Programación', nivel: 'AVANZADO', estado: 'PUBLICADO', dias: 1 },
  { titulo: '[Prueba Sprint 2] Borrador privado', categoria: 'Programación', nivel: 'PRINCIPIANTE', estado: 'BORRADOR', dias: 0 },
] as const;

try {
  await enTransaccion(async (cliente) => {
    const docente = await cliente.query<{ id_docente: number }>(
      `SELECT d.id_docente FROM docente d
       JOIN persona p ON p.id_persona = d.id_persona
       JOIN usuario u ON u.id_persona = p.id_persona
       WHERE u.correo = $1`,
      ['carlos.mendoza@correo.com'],
    );
    const idDocente = docente.rows[0]?.id_docente;
    if (!idDocente) throw new Error('Falta el docente de prueba. Ejecuta primero npm run db:seed.');

    for (const muestra of cursos) {
      const categoria = await cliente.query<{ id_categoria: number }>(
        'SELECT id_categoria FROM categoria WHERE nombre = $1 AND activa = TRUE', [muestra.categoria],
      );
      const idCategoria = categoria.rows[0]?.id_categoria;
      if (!idCategoria) throw new Error(`Falta la categoría activa ${muestra.categoria}. Ejecuta primero npm run db:seed.`);
      const existente = await cliente.query<{ id_curso: number }>(
        'SELECT id_curso FROM curso WHERE id_docente = $1 AND titulo = $2', [idDocente, muestra.titulo],
      );
      if (existente.rows[0]) {
        console.log(`= ${muestra.titulo}: ya existe`);
        continue;
      }
      const insertado = await cliente.query<{ id_curso: number }>(
        `INSERT INTO curso
         (id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, objetivos, requisitos, estado, publicado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id_curso`,
        [idDocente, idCategoria, muestra.titulo, 'Curso sintético para comprobar el catálogo público.',
          'Contenido de prueba local. No representa un curso aprobado mediante el flujo administrativo.',
          muestra.nivel, ['Conocer la estructura', 'Practicar los conceptos', 'Continuar aprendiendo'],
          ['Ninguno'], muestra.estado,
          muestra.estado === 'PUBLICADO' ? new Date(Date.now() - muestra.dias * 86400000) : null],
      );
      const idCurso = insertado.rows[0]!.id_curso;
      const modulo = await cliente.query<{ id_modulo: number }>(
        'INSERT INTO modulo (id_curso, titulo, orden) VALUES ($1, $2, 1) RETURNING id_modulo',
        [idCurso, 'Primer módulo'],
      );
      await cliente.query(
        `INSERT INTO leccion (id_modulo, titulo, tipo, orden)
         VALUES ($1, 'Lección de ejemplo', 'DOCUMENTO', 1)`,
        [modulo.rows[0]!.id_modulo],
      );
      console.log(`+ ${muestra.titulo}: id ${idCurso} (${muestra.estado})`);
    }
  });
} finally {
  await pool.end();
}
