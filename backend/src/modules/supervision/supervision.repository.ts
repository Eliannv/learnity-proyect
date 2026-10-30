import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { FiltroAlertasAdmin, FiltroAuditoriaAdmin } from './supervision.esquemas.js';
import type { SeveridadAlerta, TipoAlerta } from './supervision.modelo.js';

// Capa repository: la auditoría y la salud de la base se leen con las funciones SECURITY DEFINER de la 037.
// learnity_app no tiene permisos sobre auditoria_cambio ni sobre schema_migraciones.

export interface FilaCambio {
  id: string;
  tabla: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  registro: string | null;
  idActor: number | null;
  actor: string | null;
  actorCorreo: string | null;
  usuarioBd: string;
  fecha: Date;
  columnasCambiadas: string[] | null;
}

export interface FilaDetalle extends FilaCambio {
  idTransaccion: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export interface FilaAlerta {
  id: string;
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  descripcion: string;
  detectadaEn: Date;
  idUsuario: number | null;
  nombre: string | null;
  correo: string | null;
  evidencia: { auditoria?: number[]; accesos?: number[] };
  atendidaEn: Date | null;
  idAtendio: number | null;
  atendio: string | null;
  nota: string | null;
}

const SELECT_ALERTA = `
  SELECT a.id_alerta AS id, a.tipo, a.severidad, a.descripcion, a.detectada_en AS "detectadaEn",
         u.id_usuario AS "idUsuario", concat_ws(' ', pu.nombres, pu.apellidos) AS nombre, u.correo, a.evidencia,
         a.atendida_en AS "atendidaEn", a.atendida_por AS "idAtendio",
         NULLIF(concat_ws(' ', pa.nombres, pa.apellidos), '') AS atendio, a.nota
    FROM alerta_seguridad a
    LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
    LEFT JOIN persona pu ON pu.id_persona = u.id_persona
    LEFT JOIN persona pa ON pa.id_persona = a.atendida_por`;

const COLUMNAS = `
  id_auditoria AS id, tabla, operacion, registro, id_persona_actor AS "idActor", actor, actor_correo AS "actorCorreo",
  usuario_bd AS "usuarioBd", cambiado_en AS fecha, columnas_cambiadas AS "columnasCambiadas"`;

export const supervisionRepository = {
  /** Página filtrada (la función limita a 100 filas). `hasta` es exclusivo. */
  async listarCambios(filtro: FiltroAuditoriaAdmin): Promise<{ items: FilaCambio[]; total: number }> {
    const { rows } = await consultar<FilaCambio & { total: string }>(
      `SELECT ${COLUMNAS}, total FROM auditoria_listar($1, $2, $3, $4, $5, $6, $7, $8)`,
      [filtro.tabla ?? null, filtro.operacion ?? null, filtro.usuarioBd ?? null, filtro.actor ?? null,
        filtro.desde ?? null, filtro.hasta ?? null, filtro.limite, (filtro.pagina - 1) * filtro.limite],
    );
    return { total: Number(rows[0]?.total ?? 0), items: rows.map(({ total: _total, ...fila }) => fila) };
  },

  async detalleCambio(id: number): Promise<FilaDetalle | null> {
    const { rows } = await consultar<FilaDetalle>(
      `SELECT ${COLUMNAS}, id_transaccion AS "idTransaccion", antes, despues FROM auditoria_detalle($1)`,
      [id],
    );
    return rows[0] ?? null;
  },

  async opcionesAuditoria(): Promise<{ tipo: 'tabla' | 'usuario_bd' | 'actor'; valor: string; etiqueta: string }[]> {
    const { rows } = await consultar<{ tipo: 'tabla' | 'usuario_bd' | 'actor'; valor: string; etiqueta: string }>(
      'SELECT tipo, valor, etiqueta FROM auditoria_opciones()',
    );
    return rows;
  },

  // ------------------------------------------------------------ alertas (038)

  /** Página de alertas (la más reciente primero) y los contadores de las pestañas con los mismos filtros. */
  async listarAlertas(filtro: FiltroAlertasAdmin): Promise<{
    items: FilaAlerta[]; total: number; pendientes: number; todas: number;
  }> {
    const condiciones = ['($1::varchar IS NULL OR a.severidad = $1)', '($2::varchar IS NULL OR a.tipo = $2)'];
    const params: unknown[] = [filtro.severidad ?? null, filtro.tipo ?? null];
    const where = `WHERE ${condiciones.join(' AND ')}`;
    const [conteo, filas] = await Promise.all([
      consultar<{ pendientes: number; todas: number }>(
        `SELECT count(*) FILTER (WHERE a.atendida_en IS NULL)::int AS pendientes, count(*)::int AS todas
           FROM alerta_seguridad a ${where}`,
        params,
      ),
      consultar<FilaAlerta>(
        `${SELECT_ALERTA} ${where} ${filtro.estado === 'pendientes' ? 'AND a.atendida_en IS NULL' : ''}
          ORDER BY a.detectada_en DESC, a.id_alerta DESC
          LIMIT $3 OFFSET $4`,
        [...params, filtro.limite, (filtro.pagina - 1) * filtro.limite],
      ),
    ]);
    const { pendientes, todas } = conteo.rows[0]!;
    return { items: filas.rows, total: filtro.estado === 'pendientes' ? pendientes : todas, pendientes, todas };
  },

  async alertaPorId(id: number): Promise<FilaAlerta | null> {
    const { rows } = await consultar<FilaAlerta>(`${SELECT_ALERTA} WHERE a.id_alerta = $1`, [id]);
    return rows[0] ?? null;
  },

  /** Ejecuta las reglas de la 038 desde `desde`; devuelve cuántas alertas nuevas creó. */
  async analizarAlertas(cliente: PoolClient, desde: Date): Promise<number> {
    const { rows } = await cliente.query<{ nuevas: number }>(
      'SELECT analizar_alertas_seguridad($1) AS nuevas', [desde]);
    return rows[0]!.nuevas;
  },

  /** Marca la alerta como atendida. 'ok', 'ya' (ya estaba atendida) o 'no' (no existe). */
  async atenderAlerta(cliente: PoolClient, id: number, idAdmin: number, nota: string | null): Promise<'ok' | 'ya' | 'no'> {
    const { rows } = await cliente.query<{ atendida: boolean }>(
      'SELECT atendida_en IS NOT NULL AS atendida FROM alerta_seguridad WHERE id_alerta = $1 FOR UPDATE', [id]);
    if (!rows[0]) return 'no';
    if (rows[0].atendida) return 'ya';
    await cliente.query(
      'UPDATE alerta_seguridad SET atendida_en = now(), atendida_por = $2, nota = $3 WHERE id_alerta = $1',
      [id, idAdmin, nota],
    );
    return 'ok';
  },

  async estadoBaseDatos(): Promise<{
    version: string; tamanoBytes: string; conexiones: number; iniciadaEn: Date;
    ultimaMigracion: string | null; aplicadaEn: Date | null;
  }> {
    const { rows } = await consultar<{
      version: string; tamanoBytes: string; conexiones: number; iniciadaEn: Date;
      ultimaMigracion: string | null; aplicadaEn: Date | null;
    }>(
      `SELECT version, tamano_bytes AS "tamanoBytes", conexiones, iniciada_en AS "iniciadaEn",
              ultima_migracion AS "ultimaMigracion", aplicada_en AS "aplicadaEn"
         FROM estado_base_datos()`,
    );
    return rows[0]!;
  },
};
