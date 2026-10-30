import { consultar } from '../../shared/database/pool.js';
import type { FiltroAuditoriaAdmin } from './supervision.esquemas.js';

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
