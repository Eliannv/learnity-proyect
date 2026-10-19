/**
 * Todo el SQL de las semillas de desarrollo (`seed.ts` y `scripts/sembrar-catalogo.ts`).
 * Parámetros $1, $2… siempre; nada de datos interpolados. Cada función recibe el cliente de la
 * transacción (`Ejecutor`), así que la semilla completa se confirma o se deshace junta.
 */
import type { Ejecutor } from '../shared/database/pool.js';

export interface CuentaNueva {
  nombres: string;
  apellidos: string;
  ciudad: string;
  biografia: string | null;
  correo: string;
  contrasenaHash: string;
}

export interface CursoMuestra {
  idDocente: number;
  idCategoria: number;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  nivel: string;
  objetivos: string[];
  requisitos: string[];
  estado: string;
  /** Persona que aprobó el curso. Obligatoria si el estado es PUBLICADO (restricción de la migración 023). */
  revisadoPor: number | null;
  publicadoEn: Date | null;
}

export const semillasRepository = {
  async idRol(cliente: Ejecutor, nombre: string): Promise<number | null> {
    const { rows } = await cliente.query<{ id_rol: number }>('SELECT id_rol FROM rol WHERE nombre = $1', [nombre]);
    return rows[0]?.id_rol ?? null;
  },

  async idPersonaPorCorreo(cliente: Ejecutor, correo: string): Promise<number | null> {
    const { rows } = await cliente.query<{ id_persona: number }>('SELECT id_persona FROM usuario WHERE correo = $1', [correo]);
    return rows[0]?.id_persona ?? null;
  },

  /** Crea persona y usuario; devuelve sus identificadores. */
  async crearPersonaYUsuario(cliente: Ejecutor, cuenta: CuentaNueva): Promise<{ idPersona: number; idUsuario: number }> {
    const persona = await cliente.query<{ id_persona: number }>(
      'INSERT INTO persona (nombres, apellidos, ciudad, biografia) VALUES ($1, $2, $3, $4) RETURNING id_persona',
      [cuenta.nombres, cuenta.apellidos, cuenta.ciudad, cuenta.biografia],
    );
    const idPersona = persona.rows[0]!.id_persona;
    const usuario = await cliente.query<{ id_usuario: number }>(
      'INSERT INTO usuario (id_persona, correo, contrasena_hash) VALUES ($1, $2, $3) RETURNING id_usuario',
      [idPersona, cuenta.correo, cuenta.contrasenaHash],
    );
    return { idPersona, idUsuario: usuario.rows[0]!.id_usuario };
  },

  async asignarRol(cliente: Ejecutor, idUsuario: number, idRol: number, asignadoPor: number | null): Promise<void> {
    await cliente.query('INSERT INTO usuario_rol (id_usuario, id_rol, asignado_por) VALUES ($1, $2, $3)', [
      idUsuario,
      idRol,
      asignadoPor,
    ]);
  },

  /** Solicitud de docente ya aprobada, como la dejaría el flujo real. */
  async crearSolicitudDocenteAprobada(
    cliente: Ejecutor,
    idPersona: number,
    especialidad: string,
    motivo: string,
    revisadaPor: number | null,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO solicitud_docente (id_persona, especialidad, motivo, estado, revisada_por, revisada_en)
       VALUES ($1, $2, $3, 'APROBADA', $4, now())`,
      [idPersona, especialidad, motivo, revisadaPor],
    );
  },

  async crearDocente(cliente: Ejecutor, idPersona: number, especialidad: string): Promise<void> {
    await cliente.query('INSERT INTO docente (id_persona, especialidad) VALUES ($1, $2)', [idPersona, especialidad]);
  },

  /** Inserta la categoría si no existe. Devuelve `true` si la creó. */
  async crearCategoriaSiFalta(
    cliente: Ejecutor,
    categoria: { nombre: string; descripcion: string; activa: boolean },
    creadaPor: number,
  ): Promise<boolean> {
    const r = await cliente.query(
      `INSERT INTO categoria (nombre, descripcion, activa, creada_por)
       VALUES ($1, $2, $3, $4) ON CONFLICT (nombre) DO NOTHING`,
      [categoria.nombre, categoria.descripcion, categoria.activa, creadaPor],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async idDocentePorCorreo(cliente: Ejecutor, correo: string): Promise<number | null> {
    const { rows } = await cliente.query<{ id_docente: number }>(
      `SELECT d.id_docente FROM docente d
       JOIN persona p ON p.id_persona = d.id_persona
       JOIN usuario u ON u.id_persona = p.id_persona
       WHERE u.correo = $1`,
      [correo],
    );
    return rows[0]?.id_docente ?? null;
  },

  async idCategoriaActiva(cliente: Ejecutor, nombre: string): Promise<number | null> {
    const { rows } = await cliente.query<{ id_categoria: number }>(
      'SELECT id_categoria FROM categoria WHERE nombre = $1 AND activa = TRUE',
      [nombre],
    );
    return rows[0]?.id_categoria ?? null;
  },

  async existeCurso(cliente: Ejecutor, idDocente: number, titulo: string): Promise<boolean> {
    const { rows } = await cliente.query('SELECT id_curso FROM curso WHERE id_docente = $1 AND titulo = $2', [idDocente, titulo]);
    return rows.length > 0;
  },

  async crearCurso(cliente: Ejecutor, curso: CursoMuestra): Promise<number> {
    const { rows } = await cliente.query<{ id_curso: number }>(
      `INSERT INTO curso
       (id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, objetivos, requisitos, estado, revisado_por, publicado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id_curso`,
      [
        curso.idDocente,
        curso.idCategoria,
        curso.titulo,
        curso.subtitulo,
        curso.descripcion,
        curso.nivel,
        curso.objetivos,
        curso.requisitos,
        curso.estado,
        curso.revisadoPor,
        curso.publicadoEn,
      ],
    );
    return rows[0]!.id_curso;
  },

  async crearModulo(cliente: Ejecutor, idCurso: number, titulo: string, orden: number): Promise<number> {
    const { rows } = await cliente.query<{ id_modulo: number }>(
      'INSERT INTO modulo (id_curso, titulo, orden) VALUES ($1, $2, $3) RETURNING id_modulo',
      [idCurso, titulo, orden],
    );
    return rows[0]!.id_modulo;
  },

  async crearLeccionDocumento(cliente: Ejecutor, idModulo: number, titulo: string, orden: number): Promise<void> {
    await cliente.query("INSERT INTO leccion (id_modulo, titulo, tipo, orden) VALUES ($1, $2, 'DOCUMENTO', $3)", [
      idModulo,
      titulo,
      orden,
    ]);
  },
};
