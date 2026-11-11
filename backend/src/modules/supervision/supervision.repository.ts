import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import {
  guardarRespaldo041,
  leerRespaldo041,
  tieneMigracion041,
  type ReporteCurso041,
} from '../../shared/database/respaldo-041.js';
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
  evidencia: {
    auditoria?: number[];
    accesos?: number[];
    curso?: number | null;
    idCurso?: number | null;
    cursoTitulo?: string | null;
    motivo?: string | null;
  };
  atendidaEn: Date | null;
  idAtendio: number | null;
  atendio: string | null;
  nota: string | null;
}

export interface FilaResumen {
  solicitudesDocente: number; reportesResenas: number; alertasSeguridad: number; alertasAltas: number;
  activos: number; inactivos: number; cuentasBloqueadas: number; estudiantes: number; docentes: number; admins: number;
  cursosPorEstado: Record<string, number>;
  inscripciones: number; inscripcionesActivas: number; inscripcionesCompletadas: number;
  resenasPromedio: string | null; resenasTotal: number;
  generadoEn: Date;
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

/** Condición de cada pestaña de Alertas (texto fijo, sin datos del usuario). */
const ESTADO_ALERTA: Record<FiltroAlertasAdmin['estado'], string> = {
  pendientes: 'AND a.atendida_en IS NULL',
  atendidas: 'AND a.atendida_en IS NOT NULL',
  todas: '',
};

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

  // ------------------------------------------------------------ resumen

  /**
   * Indicadores del resumen en una sola consulta. Lee tablas de otros módulos solo para contar (como Analíticas):
   * learnity_app ya puede leerlas y aquí no se modifica nada.
   */
  async resumen(): Promise<FilaResumen> {
    const { rows } = await consultar<FilaResumen>(`
      SELECT
        (SELECT count(*)::int FROM solicitud_docente WHERE estado = 'PENDIENTE') AS "solicitudesDocente",
        (SELECT count(*)::int FROM reporte_resena WHERE estado = 'PENDIENTE') AS "reportesResenas",
        (SELECT count(*)::int FROM alerta_seguridad WHERE atendida_en IS NULL) AS "alertasSeguridad",
        (SELECT count(*)::int FROM alerta_seguridad WHERE atendida_en IS NULL AND severidad = 'ALTA') AS "alertasAltas",
        u.activos, u.inactivos, u.bloqueadas AS "cuentasBloqueadas", u.estudiantes, u.docentes, u.admins,
        c.por_estado AS "cursosPorEstado",
        i.total AS "inscripciones", i.activas AS "inscripcionesActivas", i.completadas AS "inscripcionesCompletadas",
        r.promedio AS "resenasPromedio", r.total AS "resenasTotal",
        now() AS "generadoEn"
      FROM (
        SELECT count(*) FILTER (WHERE us.estado = 'ACTIVO')::int AS activos,
               count(*) FILTER (WHERE us.estado = 'INACTIVO')::int AS inactivos,
               count(*) FILTER (WHERE us.bloqueado_hasta > now())::int AS bloqueadas,
               count(*) FILTER (WHERE us.estado = 'ACTIVO' AND roles.nombres @> ARRAY['ESTUDIANTE']::varchar[])::int AS estudiantes,
               count(*) FILTER (WHERE us.estado = 'ACTIVO' AND roles.nombres @> ARRAY['DOCENTE']::varchar[])::int AS docentes,
               count(*) FILTER (WHERE us.estado = 'ACTIVO' AND roles.nombres @> ARRAY['ADMIN']::varchar[])::int AS admins
          FROM usuario us
          CROSS JOIN LATERAL (
            SELECT COALESCE(array_agg(ro.nombre), '{}') AS nombres
              FROM usuario_rol ur JOIN rol ro ON ro.id_rol = ur.id_rol
             WHERE ur.id_usuario = us.id_usuario) roles
      ) u
      CROSS JOIN (
        SELECT COALESCE(jsonb_object_agg(estado, n), '{}') AS por_estado
          FROM (SELECT estado, count(*)::int AS n FROM curso GROUP BY estado) e
      ) c
      CROSS JOIN (
        SELECT count(*)::int AS total, count(*) FILTER (WHERE estado = 'ACTIVA')::int AS activas,
               count(*) FILTER (WHERE estado = 'COMPLETADA')::int AS completadas
          FROM inscripcion
      ) i
      CROSS JOIN (
        SELECT round(avg(re.estrellas), 1) AS promedio, count(*)::int AS total
          FROM resena re
          JOIN inscripcion ins ON ins.id_inscripcion = re.id_inscripcion
          JOIN curso cu ON cu.id_curso = ins.id_curso AND cu.estado = 'PUBLICADO'
         WHERE re.eliminado_en IS NULL AND re.ocultada_en IS NULL
      ) r`);
    return rows[0]!;
  },

  // ------------------------------------------------------------ alertas (038)

  /** Página de alertas en el orden pedido y los contadores de las pestañas con los mismos filtros. */
  async listarAlertas(filtro: FiltroAlertasAdmin): Promise<{
    items: FilaAlerta[]; total: number; pendientes: number; atendidas: number; todas: number;
  }> {
    const tiene041 = await tieneMigracion041({ query: consultar });
    const reportesRespaldo = tiene041 ? [] : leerRespaldo041().reportesCurso;
    if (tiene041 || (reportesRespaldo.length === 0 && filtro.tipo !== 'REPORTE_CURSO')) {
      const condiciones = ['($1::varchar IS NULL OR a.severidad = $1)', '($2::varchar IS NULL OR a.tipo = $2)'];
      const params: unknown[] = [filtro.severidad ?? null, filtro.tipo ?? null];
      const where = `WHERE ${condiciones.join(' AND ')}`;
      const [conteo, filas] = await Promise.all([
        consultar<{ pendientes: number; atendidas: number; todas: number }>(
          `SELECT count(*) FILTER (WHERE a.atendida_en IS NULL)::int AS pendientes,
                  count(*) FILTER (WHERE a.atendida_en IS NOT NULL)::int AS atendidas, count(*)::int AS todas
             FROM alerta_seguridad a ${where}`,
          params,
        ),
        consultar<FilaAlerta>(
          `${SELECT_ALERTA} ${where} ${ESTADO_ALERTA[filtro.estado]}
            ORDER BY ${filtro.orden === 'antiguas' ? 'a.detectada_en ASC, a.id_alerta ASC' : 'a.detectada_en DESC, a.id_alerta DESC'}
            LIMIT $3 OFFSET $4`,
          [...params, filtro.limite, (filtro.pagina - 1) * filtro.limite],
        ),
      ]);
      const { pendientes, atendidas, todas } = conteo.rows[0]!;
      const total = { pendientes, atendidas, todas }[filtro.estado];
      return { items: filas.rows, total, pendientes, atendidas, todas };
    }

    const dbFilas =
      filtro.tipo === 'REPORTE_CURSO'
        ? []
        : (
            await consultar<FilaAlerta>(
              `${SELECT_ALERTA}
                WHERE ($1::varchar IS NULL OR a.severidad = $1)
                  AND ($2::varchar IS NULL OR a.tipo = $2)`,
              [filtro.severidad ?? null, filtro.tipo ?? null],
            )
          ).rows;
    const idsUsuarios = [...new Set(reportesRespaldo.map((r) => r.idUsuario))];
    const mapaNombres = new Map<number, string>();
    if (idsUsuarios.length > 0) {
      const { rows: uRows } = await consultar<{ idUsuario: number; nombre: string }>(
        `SELECT u.id_usuario AS "idUsuario", concat_ws(' ', p.nombres, p.apellidos) AS nombre
           FROM usuario u JOIN persona p ON p.id_persona = u.id_persona
          WHERE u.id_usuario = ANY($1::int[])`,
        [idsUsuarios],
      );
      for (const u of uRows) mapaNombres.set(u.idUsuario, u.nombre);
    }
    const convertirReporte = (r: ReporteCurso041): FilaAlerta => ({
      id: String(r.idAlerta),
      tipo: 'REPORTE_CURSO',
      severidad: 'MEDIA',
      descripcion: `Curso reportado («${r.cursoTitulo}»): ${r.motivo}`.slice(0, 300),
      detectadaEn: new Date(r.detectadaEn),
      idUsuario: r.idUsuario,
      nombre: mapaNombres.get(r.idUsuario) ?? '',
      correo: r.correo,
      evidencia: { auditoria: [], accesos: [], curso: r.idCurso, cursoTitulo: r.cursoTitulo, motivo: r.motivo },
      atendidaEn: r.atendidaEn ? new Date(r.atendidaEn) : null,
      idAtendio: r.atendidaPor,
      atendio: r.atendidaPorNombre,
      nota: r.nota,
    });
    const extras = reportesRespaldo
      .filter(() => !filtro.severidad || filtro.severidad === 'MEDIA')
      .filter(() => !filtro.tipo || filtro.tipo === 'REPORTE_CURSO')
      .map(convertirReporte);
    const combinadas = [...dbFilas, ...extras];
    const pendientes = combinadas.filter((a) => a.atendidaEn === null).length;
    const atendidas = combinadas.filter((a) => a.atendidaEn !== null).length;
    const todas = combinadas.length;
    const filtradas = combinadas.filter((a) =>
      filtro.estado === 'pendientes'
        ? a.atendidaEn === null
        : filtro.estado === 'atendidas'
          ? a.atendidaEn !== null
          : true,
    );
    filtradas.sort((a, b) => {
      const diff = a.detectadaEn.getTime() - b.detectadaEn.getTime() || Number(a.id) - Number(b.id);
      return filtro.orden === 'antiguas' ? diff : -diff;
    });
    const inicio = (filtro.pagina - 1) * filtro.limite;
    return {
      items: filtradas.slice(inicio, inicio + filtro.limite),
      total: filtradas.length,
      pendientes,
      atendidas,
      todas,
    };
  },

  async alertaPorId(id: number): Promise<FilaAlerta | null> {
    const { rows } = await consultar<FilaAlerta>(`${SELECT_ALERTA} WHERE a.id_alerta = $1`, [id]);
    if (rows[0]) return rows[0];
    if (await tieneMigracion041({ query: consultar })) return null;
    const r = leerRespaldo041().reportesCurso.find((item) => item.idAlerta === id);
    if (!r) return null;
    const { rows: uRows } = await consultar<{ nombre: string }>(
      `SELECT concat_ws(' ', p.nombres, p.apellidos) AS nombre
         FROM usuario u JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.id_usuario = $1`,
      [r.idUsuario],
    );
    return {
      id: String(r.idAlerta),
      tipo: 'REPORTE_CURSO',
      severidad: 'MEDIA',
      descripcion: `Curso reportado («${r.cursoTitulo}»): ${r.motivo}`.slice(0, 300),
      detectadaEn: new Date(r.detectadaEn),
      idUsuario: r.idUsuario,
      nombre: uRows[0]?.nombre ?? '',
      correo: r.correo,
      evidencia: { auditoria: [], accesos: [], curso: r.idCurso, cursoTitulo: r.cursoTitulo, motivo: r.motivo },
      atendidaEn: r.atendidaEn ? new Date(r.atendidaEn) : null,
      idAtendio: r.atendidaPor,
      atendio: r.atendidaPorNombre,
      nota: r.nota,
    };
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
    if (rows[0]) {
      if (rows[0].atendida) return 'ya';
      await cliente.query(
        'UPDATE alerta_seguridad SET atendida_en = now(), atendida_por = $2, nota = $3 WHERE id_alerta = $1',
        [id, idAdmin, nota],
      );
      return 'ok';
    }
    if (await tieneMigracion041(cliente)) return 'no';
    const actual = leerRespaldo041().reportesCurso.find((item) => item.idAlerta === id);
    if (!actual) return 'no';
    if (actual.atendidaEn !== null) return 'ya';
    const { rows: pRows } = await cliente.query<{ nombre: string }>(
      `SELECT concat_ws(' ', nombres, apellidos) AS nombre FROM persona WHERE id_persona = $1`,
      [idAdmin],
    );
    guardarRespaldo041((estado) => {
      const objetivo = estado.reportesCurso.find((item) => item.idAlerta === id);
      if (objetivo) {
        objetivo.atendidaEn = new Date().toISOString();
        objetivo.atendidaPor = idAdmin;
        objetivo.atendidaPorNombre = pRows[0]?.nombre ?? null;
        objetivo.nota = nota;
      }
    });
    return 'ok';
  },

  async reportarCurso(
    cliente: PoolClient,
    idUsuario: number,
    idCurso: number,
    motivo: string,
  ): Promise<'REGISTRADO' | 'DUPLICADO' | 'NO_ENCONTRADO' | 'NO_AUTORIZADO' | 'MOTIVO_INVALIDO'> {
    if (await tieneMigracion041(cliente)) {
      const { rows } = await cliente.query<{ estado: 'REGISTRADO' | 'DUPLICADO' | 'NO_ENCONTRADO' | 'NO_AUTORIZADO' | 'MOTIVO_INVALIDO' }>(
        'SELECT registrar_reporte_curso($1, $2, $3) AS estado',
        [idUsuario, idCurso, motivo],
      );
      return rows[0]?.estado ?? 'NO_ENCONTRADO';
    }
    const { rows: uRows } = await cliente.query<{ correo: string }>(
      `SELECT correo FROM usuario WHERE id_usuario = $1 AND estado = 'ACTIVO'`,
      [idUsuario],
    );
    if (!uRows[0]) return 'NO_AUTORIZADO';
    const { rows: cRows } = await cliente.query<{ titulo: string }>(
      `SELECT titulo FROM curso WHERE id_curso = $1 AND estado = 'PUBLICADO'`,
      [idCurso],
    );
    if (!cRows[0]) return 'NO_ENCONTRADO';
    const clave = `REPORTE_CURSO:${idCurso}:${idUsuario}`;
    const estadoActual = leerRespaldo041();
    if (estadoActual.reportesCurso.some((r) => r.clave === clave && r.atendidaEn === null)) {
      return 'DUPLICADO';
    }
    guardarRespaldo041((estado) => {
      const idAlerta = estado.secuenciaAlerta++;
      estado.reportesCurso.push({
        idAlerta,
        idUsuario,
        correo: uRows[0]!.correo,
        idCurso,
        cursoTitulo: cRows[0]!.titulo,
        motivo,
        clave,
        detectadaEn: new Date().toISOString(),
        atendidaEn: null,
        atendidaPor: null,
        atendidaPorNombre: null,
        nota: null,
      });
    });
    return 'REGISTRADO';
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
