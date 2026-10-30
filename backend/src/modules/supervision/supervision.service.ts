import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import { identidadApi } from '../identidad/index.js';
import type { FiltroAccesosAdmin, FiltroAuditoriaAdmin, FiltroSesionesAdmin } from './supervision.esquemas.js';
import type {
  CambioAuditoria, CuentaBloqueadaAdmin, DetalleCambioAuditoria, EstadoBaseDatos, OpcionesAuditoria, PaginaAccesos,
  PaginaAuditoria, PaginaSesiones, Paginacion,
} from './supervision.modelo.js';
import { supervisionRepository as repo, type FilaCambio } from './supervision.repository.js';

// Capa service: supervisión del administrador. Los accesos, bloqueos y sesiones pertenecen a Identidad y se leen
// por su API; la auditoría y la salud de la base, con las funciones de la 037.

const paginacion = (total: number, pagina: number, limite: number): Paginacion =>
  ({ total, pagina, limite, totalPaginas: Math.ceil(total / limite) });

const cambio = (f: FilaCambio): CambioAuditoria => ({
  id: Number(f.id), fecha: f.fecha.toISOString(), tabla: f.tabla, operacion: f.operacion, registro: f.registro,
  actor: f.idActor === null ? null : { id: f.idActor, nombre: f.actor ?? 'Cuenta eliminada', correo: f.actorCorreo },
  usuarioBd: f.usuarioBd, columnasCambiadas: f.columnasCambiadas,
});

export const supervisionService = {
  async accesos(filtro: FiltroAccesosAdmin): Promise<PaginaAccesos> {
    const { items, total } = await identidadApi.listarAccesos({
      soloFallidos: filtro.resultado === 'fallidos',
      q: filtro.q || undefined,
      pagina: filtro.pagina,
      limite: filtro.limite,
    });
    return {
      items: items.map((e) => ({ ...e, fecha: e.fecha.toISOString() })),
      paginacion: paginacion(total, filtro.pagina, filtro.limite),
    };
  },

  async cuentasBloqueadas(): Promise<{ items: CuentaBloqueadaAdmin[] }> {
    const cuentas = await identidadApi.cuentasBloqueadas();
    return { items: cuentas.map((c) => ({ ...c, bloqueadoHasta: c.bloqueadoHasta.toISOString() })) };
  },

  // -------------------------------------------------------------- auditoría

  async auditoria(filtro: FiltroAuditoriaAdmin): Promise<PaginaAuditoria> {
    const { items, total } = await repo.listarCambios(filtro);
    return { items: items.map(cambio), paginacion: paginacion(total, filtro.pagina, filtro.limite) };
  },

  async detalleAuditoria(id: number): Promise<DetalleCambioAuditoria> {
    const fila = await repo.detalleCambio(id);
    if (!fila) throw AppError.noEncontrado('El registro de auditoría no existe.');
    return { ...cambio(fila), idTransaccion: Number(fila.idTransaccion), antes: fila.antes, despues: fila.despues };
  },

  async opcionesAuditoria(): Promise<OpcionesAuditoria> {
    const filas = await repo.opcionesAuditoria();
    return {
      tablas: filas.filter((f) => f.tipo === 'tabla').map((f) => f.valor),
      usuariosBd: filas.filter((f) => f.tipo === 'usuario_bd').map((f) => f.valor),
      actores: filas.filter((f) => f.tipo === 'actor').map((f) => ({ id: Number(f.valor), nombre: f.etiqueta })),
    };
  },

  async estadoBaseDatos(): Promise<EstadoBaseDatos> {
    const e = await repo.estadoBaseDatos();
    return {
      version: e.version, tamanoBytes: Number(e.tamanoBytes), conexiones: e.conexiones,
      iniciadaEn: e.iniciadaEn.toISOString(),
      ultimaMigracion: e.ultimaMigracion === null ? null
        : { version: e.ultimaMigracion, aplicadaEn: e.aplicadaEn?.toISOString() ?? null },
    };
  },

  // -------------------------------------------------------------- sesiones

  async sesiones(filtro: FiltroSesionesAdmin, usuario: UsuarioSesion): Promise<PaginaSesiones> {
    const { items, total } = await identidadApi.listarSesionesActivas({
      q: filtro.q || undefined, pagina: filtro.pagina, limite: filtro.limite,
    });
    return {
      items: items.map((s) => ({
        id: s.id, usuario: s.usuario, agente: s.agente, iniciadaEn: s.iniciadaEn.toISOString(),
        renovadaEn: s.renovadaEn.toISOString(), expiraEn: s.expiraEn.toISOString(), actual: s.id === usuario.sid,
      })),
      paginacion: paginacion(total, filtro.pagina, filtro.limite),
    };
  },

  /** Cierra una sesión abierta (motivo ADMIN). La propia solo con confirmación expresa. */
  async revocarSesion(familia: string, confirmoPropia: boolean, usuario: UsuarioSesion): Promise<void> {
    if (familia === usuario.sid && !confirmoPropia) {
      throw AppError.conflicto(
        'Es tu sesión actual: al cerrarla tendrás que volver a iniciar sesión. Confírmalo para continuar.', 'SESION_PROPIA');
    }
    const idUsuario = await identidadApi.revocarSesionPorAdmin(familia);
    if (idUsuario === null) throw AppError.noEncontrado('La sesión no existe o ya está cerrada.');
    registrarEvento('sesion_revocada_admin', { idUsuario, idAdmin: usuario.idPersona, propia: familia === usuario.sid });
  },
};
