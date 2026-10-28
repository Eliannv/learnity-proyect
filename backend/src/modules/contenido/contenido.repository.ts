import type { PoolClient } from 'pg';

import {
  consultar,
} from '../../shared/database/pool.js';

export interface ArchivoInterno {
  id: number;
  idCurso: number;
  tipo: string;
  nombreOriginal: string;
  ruta: string;
  tamanoBytes: number;
  leccionId: number | null;
}

export const contenidoRepository = {
  async buscar(
    id: number,
    cliente?: PoolClient,
  ): Promise<ArchivoInterno | null> {
    const sql = `
      SELECT
        a.id_archivo AS id,
        a.id_curso AS "idCurso",
        a.tipo,
        a.nombre_original AS "nombreOriginal",
        a.ruta,
        a.tamano_bytes AS "tamanoBytes",
        COALESCE(l.id_leccion, ra.id_leccion) AS "leccionId"
      FROM archivo a
      LEFT JOIN leccion l
        ON l.id_archivo = a.id_archivo
      LEFT JOIN recurso_adjunto ra
        ON ra.id_archivo = a.id_archivo
      WHERE a.id_archivo = $1
    `;

    const resultado = cliente
      ? await cliente.query<ArchivoInterno>(
          sql,
          [id],
        )
      : await consultar<ArchivoInterno>(
          sql,
          [id],
        );

    return resultado.rows[0] ?? null;
  },

  async crear(
    cliente: PoolClient,
    idCurso: number,
    original: string,
    nombre: string,
    bytes: number,
    tipo: 'PDF' | 'PPT' | 'ZIP' = 'PDF',
  ): Promise<number> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        INSERT INTO archivo (
          id_curso,
          tipo,
          nombre_original,
          ruta,
          tamano_bytes
        )
        VALUES ($1, $5, $2, $3, $4)
        RETURNING id_archivo AS id
      `,
      [
        idCurso,
        original,
        nombre,
        bytes,
        tipo,
      ],
    );

    return rows[0]!.id;
  },

  async retirarSiHuerfano(
    cliente: PoolClient,
    id: number,
    idCurso: number,
  ): Promise<string | null> {
    const { rows } = await cliente.query<{
      ruta: string;
    }>(
      `
        DELETE FROM archivo a
        WHERE a.id_archivo = $1
          AND a.id_curso = $2
          AND NOT EXISTS (
            SELECT 1
            FROM leccion l
            WHERE l.id_archivo = a.id_archivo
          )
          AND NOT EXISTS (
            SELECT 1
            FROM recurso_adjunto r
            WHERE r.id_archivo = a.id_archivo
          )
        RETURNING ruta
      `,
      [id, idCurso],
    );

    return rows[0]?.ruta ?? null;
  },

  async programarNuevo(
    nombre: string,
  ): Promise<void> {
    await consultar(
      `
        INSERT INTO archivo_borrado_pendiente (
          nombre,
          disponible_desde
        )
        VALUES (
          $1,
          now() + interval '1 hour'
        )
      `,
      [nombre],
    );
  },

  async bloquearNombre(
    cliente: PoolClient,
    nombre: string,
  ): Promise<void> {
    await cliente.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [nombre],
    );
  },

  async reservaVigente(
    cliente: PoolClient,
    nombre: string,
  ): Promise<boolean> {
    const { rowCount } = await cliente.query(
      `
        SELECT nombre
        FROM archivo_borrado_pendiente
        WHERE nombre = $1
          AND disponible_desde > now()
        FOR UPDATE
      `,
      [nombre],
    );

    return rowCount === 1;
  },

  async cancelarRetiro(
    cliente: PoolClient,
    nombre: string,
  ): Promise<void> {
    await cliente.query(
      `
        DELETE FROM archivo_borrado_pendiente
        WHERE nombre = $1
      `,
      [nombre],
    );
  },

  async programarRetiro(
    cliente: PoolClient,
    nombre: string,
  ): Promise<void> {
    await cliente.query(
      `
        INSERT INTO archivo_borrado_pendiente (
          nombre
        )
        VALUES ($1)
        ON CONFLICT (nombre)
        DO UPDATE
        SET disponible_desde = LEAST(
          archivo_borrado_pendiente.disponible_desde,
          now()
        )
      `,
      [nombre],
    );
  },

  async adelantarSiHuerfano(
    nombre: string,
  ): Promise<void> {
    await consultar(
      `
        UPDATE archivo_borrado_pendiente
        SET disponible_desde = now()
        WHERE nombre = $1
          AND NOT EXISTS (
            SELECT 1
            FROM archivo
            WHERE ruta = $1
          )
      `,
      [nombre],
    );
  },

  async pendientes(): Promise<string[]> {
    const { rows } = await consultar<{
      nombre: string;
    }>(
      `
        SELECT nombre
        FROM archivo_borrado_pendiente
        WHERE disponible_desde <= now()
        ORDER BY creado_en
        LIMIT 50
      `,
    );

    return rows.map(fila => fila.nombre);
  },

  async pendienteSinReferencia(
    cliente: PoolClient,
    nombre: string,
  ): Promise<boolean> {
    const { rowCount } = await cliente.query(
      `
        SELECT p.nombre
        FROM archivo_borrado_pendiente p
        WHERE p.nombre = $1
          AND p.disponible_desde <= now()
          AND NOT EXISTS (
            SELECT 1
            FROM archivo a
            WHERE a.ruta = p.nombre
          )
        FOR UPDATE OF p
      `,
      [nombre],
    );

    return rowCount === 1;
  },
};